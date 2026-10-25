# -*- coding: utf-8 -*-
"""
从 checkpoint 流水中挑选"用户可见的文件变更"与"文件版本"候选。

权威数据源是 agfs 侧按空间分区的 operations.json，聚合后的流水包含
各空间（project / user / topic / chat_history，以及未来新增空间）的
条目。附件与文件版本是两条独立的空间策略（见空间注册表）：

- 变更附件（用户可见的变更列表）：仅项目空间条目；
- 文件版本创建：全部工作区空间（project / user，含用户空间的记忆
  文件等隐藏目录下的持久文件）。

内部状态空间（topic / chat_history 等）是 Agent 的内部状态，随
checkpoint 恢复，两者都不进入。

本模块为纯函数，无重依赖；监听服务委托本模块做选择，测试可直接导入。
"""

from typing import List

from app.core.entity.checkpoint import (
    FileOperation,
    FileSnapshot,
    FileType,
    is_change_attachment_space,
    is_file_version_space,
)


def _select_operation_paths(
    file_snapshots: List[FileSnapshot],
    *,
    space_matches,
) -> List[str]:
    """按空间谓词从聚合流水中挑出文件路径（去重、保序）。

    公共过滤规则：
    - 跳过目录快照（附件与版本都只针对文件）
    - 跳过 DELETED 操作（文件已不存在）
    - 跳过 RENAMED 操作（内容未变，避免无意义的版本创建）
    - 不按"隐藏路径"过滤：以 "." 开头的目录（.magic/、.venv/ 等）里的
      持久文件同样进入变更附件与文件版本链路
    - 按 file_path 首次出现去重，保持出现顺序
    """
    seen: set = set()
    ordered: List[str] = []
    for snapshot in file_snapshots:
        if not space_matches(snapshot.space):
            continue
        if snapshot.file_type == FileType.DIRECTORY:
            continue
        if snapshot.operation == FileOperation.DELETED:
            continue
        if snapshot.operation == FileOperation.RENAMED:
            continue

        path = snapshot.file_path
        if path in seen:
            continue

        seen.add(path)
        ordered.append(path)
    return ordered


def select_changed_attachment_paths(file_snapshots: List[FileSnapshot]) -> List[str]:
    """从聚合流水中挑出需要构造变更附件的文件路径（仅项目空间）。

    Returns:
        List[str]: workspace 内文件为相对路径，跨项目挂载/referenced 文件
        为 agent 可见绝对路径（即流水记录的原样路径）。
    """
    return _select_operation_paths(
        file_snapshots, space_matches=is_change_attachment_space,
    )


def select_file_version_paths(file_snapshots: List[FileSnapshot]) -> List[str]:
    """从聚合流水中挑出需要创建文件版本的文件路径（工作区空间：project / user）。

    Returns:
        List[str]: workspace 内文件为相对路径，跨项目挂载/referenced 文件
        为 agent 可见绝对路径（即流水记录的原样路径）。
    """
    return _select_operation_paths(
        file_snapshots, space_matches=is_file_version_space,
    )
