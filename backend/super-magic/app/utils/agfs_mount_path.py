"""AGFS FUSE 挂载根的解析。

沙箱里所有空间目录（工作区、用户空间、话题空间、聊天记录、跨项目挂载）都位于
同一个 FUSE 挂载根之下，因此这个根是判断"某个绝对路径是否可达"的唯一依据。

挂载根由沙箱网关通过 `AGFS_FUSE_MOUNT_PATH` 注入 agent 容器。网关侧的空卷根
（`AGFS_FUSE_VOLUME_PATH`）与 FUSE 挂载点（该根下的 `agfs` 子目录）是两个不同的
路径，注入 agent 的必须是后者：

| 网关侧取值                     | 容器内可见性                       |
|-------------------------------|-----------------------------------|
| /mnt/agfs-vol                 | 空卷根，只有挂载点本身，无 AGFS 内容 |
| /mnt/agfs-vol/agfs（注入值）   | FUSE 挂载点，magicfs/localfs 在此之下 |

保留默认值是为了兼容尚未注入该变量的旧沙箱；新沙箱一律以环境变量为准。
"""

import os
from pathlib import Path

# FUSE 挂载根环境变量名，由沙箱网关写入 agent 容器。
AGFS_FUSE_MOUNT_PATH_ENV = "AGFS_FUSE_MOUNT_PATH"

# 兼容旧沙箱的挂载根默认值；新沙箱由环境变量覆盖。
DEFAULT_AGFS_FUSE_MOUNT_PATH = "/mnt/agfs"


def get_agfs_fuse_mount_root() -> Path:
    """返回当前沙箱的 AGFS FUSE 挂载根。

    例：注入 `/mnt/agfs-vol/agfs` 时，工作区路径为
    `/mnt/agfs-vol/agfs/magicfs/project`，跨项目挂载根为
    `/mnt/agfs-vol/agfs/magicfs/referenced-projects`。
    """
    raw = os.getenv(AGFS_FUSE_MOUNT_PATH_ENV, "").strip()
    return Path(os.path.normpath(raw or DEFAULT_AGFS_FUSE_MOUNT_PATH))


def get_referenced_project_mount_base() -> Path:
    """返回跨项目（referenced project）挂载根。

    `AGENT_REFERENCED_PROJECT_MOUNT_BASE_PATH` 由网关显式注入时优先使用，
    否则退化为 `<FUSE 挂载根>/magicfs/referenced-projects`，与网关侧
    `magicfs` 插件的逻辑前缀保持一致。
    """
    explicit = os.getenv("AGENT_REFERENCED_PROJECT_MOUNT_BASE_PATH", "").strip()
    if explicit:
        return Path(os.path.normpath(explicit))
    return get_agfs_fuse_mount_root() / "magicfs" / "referenced-projects"


# 工作区在 AGFS 命名空间里的挂载点。网关按这个路径挂载 magicfs 插件（见
# sandbox-gateway 的 bindSandbox），所有需要"按挂载点寻址"的调用方都从这里取值，
# 避免同一个字符串在多处各写一遍。
WORKSPACE_MOUNT_PATH = "/magicfs/project"
