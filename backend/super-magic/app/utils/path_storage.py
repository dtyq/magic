"""
判断一个路径落在哪一层存储上。

沙盒里同一棵目录树下混着不同存储，写入耗时相差上万倍，只看路径字面无法判断：

| 层级 | 判据 | 例子 | 小文件写入 | 持久／用户可见 |
| --- | --- | --- | --- | --- |
| NETWORK | 节点或最近带 xattr 的祖先是 user.magicfs.* | .workspace、普通子目录 | 约 2 秒／个 | 是 |
| LOCAL_DEPENDENCY | 挂载点下、自身无 xattr、最近带 xattr 的祖先是 magicfs | mkdir 创建的 node_modules 及其子树 | 毫秒级 | 否，重建后为空目录 |
| PLATFORM_INTERNAL | 挂载点下、xattr 属于其他插件，或一路都没有 xattr | localfs 挂载的 chat_history | 快 | 平台自管 |
| CONTAINER_LOCAL | 解析后不在挂载点下 | .box、/tmp、~/.cache | 毫秒级 | 否，重建后清空 |

xattr 前缀由 agfs-fuse 按插件名生成（user.<插件名>.*），影子目录不经过插件，所以没有 xattr。
按 xattr 判断而不是按目录名白名单判断，gateway 调整影子目录名单后结果仍然准确。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path

from app.path_manager import PathManager
from app.utils.async_file_utils import async_exists, async_list_xattr_names, async_realpath

_XATTR_USER_PREFIX = "user."
_MAGICFS_PLUGIN = "magicfs"


class PathStorageLayer(StrEnum):
    NETWORK = "network"
    LOCAL_DEPENDENCY = "local_dependency"
    PLATFORM_INTERNAL = "platform_internal"
    CONTAINER_LOCAL = "container_local"


@dataclass(frozen=True, slots=True)
class PathStorageInfo:
    path: str  # 调用方原样输入
    resolved_path: str  # 解析软链后的绝对路径
    exists: bool
    checked_path: str  # 实际检查的节点：存在时为自身，否则为最近存在的祖先
    layer: PathStorageLayer


async def inspect_path_storage(path: Path) -> PathStorageInfo:
    """相对路径按 .workspace 解析；路径尚不存在时按最近存在的祖先判断，即「在这里新建会落在哪一层」。"""
    raw_path = path.expanduser()
    absolute_path = raw_path if raw_path.is_absolute() else PathManager.get_workspace_dir() / raw_path
    resolved_path = await async_realpath(absolute_path)

    checked_path = resolved_path
    while not await async_exists(checked_path) and checked_path != checked_path.parent:
        checked_path = checked_path.parent

    return PathStorageInfo(
        path=str(path),
        resolved_path=str(resolved_path),
        exists=checked_path == resolved_path,
        checked_path=str(checked_path),
        layer=await _detect_layer(checked_path),
    )


async def _detect_layer(checked_path: Path) -> PathStorageLayer:
    mount_root = await async_realpath(PathManager.get_agfs_fuse_mount_path())
    if not checked_path.is_relative_to(mount_root):
        return PathStorageLayer.CONTAINER_LOCAL

    own_plugin = await _get_xattr_plugin(checked_path)
    if own_plugin is not None:
        return PathStorageLayer.NETWORK if own_plugin == _MAGICFS_PLUGIN else PathStorageLayer.PLATFORM_INTERNAL

    # 自身没有 xattr：要么是 magicfs 下的影子目录（及其子树），要么是不带 xattr 的平台挂载
    for ancestor in checked_path.parents:
        if not ancestor.is_relative_to(mount_root):
            break
        ancestor_plugin = await _get_xattr_plugin(ancestor)
        if ancestor_plugin is not None:
            return (
                PathStorageLayer.LOCAL_DEPENDENCY
                if ancestor_plugin == _MAGICFS_PLUGIN
                else PathStorageLayer.PLATFORM_INTERNAL
            )
    return PathStorageLayer.PLATFORM_INTERNAL


async def _get_xattr_plugin(path: Path) -> str | None:
    """从 user.<插件名>.<字段> 中取插件名；没有 user.* 属性时返回 None。"""
    for name in await async_list_xattr_names(path):
        if name.startswith(_XATTR_USER_PREFIX):
            plugin, separator, _ = name[len(_XATTR_USER_PREFIX):].partition(".")
            if separator and plugin:
                return plugin
    return None
