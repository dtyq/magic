# -*- coding: utf-8 -*-
"""变更附件候选与文件版本候选选择器的过滤规则测试。

覆盖核心策略拆分：
- 变更附件（用户可见的变更列表）：仅项目空间条目；
- 文件版本创建：全部工作区空间（project / user，含用户空间 .magic/
  等隐藏目录下的持久文件）；
- topic / chat_history 等内部状态空间两者均不进入。
"""

from datetime import datetime

from app.core.entity.checkpoint import (
    TOPIC_SPACE,
    USER_SPACE,
    FileOperation,
    FileSnapshot,
    FileType,
)
from app.infrastructure.checkpoint.attachment_candidates import (
    select_changed_attachment_paths,
    select_file_version_paths,
)


def _snap(
    file_id: str,
    file_path: str,
    operation: FileOperation = FileOperation.UPDATED,
    *,
    space: str = "project",
    file_type: FileType = FileType.FILE,
) -> FileSnapshot:
    return FileSnapshot(
        file_id=file_id,
        file_path=file_path,
        modified_time=datetime(2026, 8, 27, 12, 0, 0),
        operation=operation,
        file_type=file_type,
        snapshot_path=f"cp/file_snapshots/{file_id}",
        space=space,
    )


def test_internal_space_entries_excluded_from_both():
    """核心回归：topic 空间条目（聊天历史）不进附件也不进版本。"""
    snapshots = [
        _snap("1", "/mnt/agfs-vol/agfs/magicfs/project/report.md", space="project"),
        # 聊天历史文件：本轮被频繁保存，但属于内部状态
        _snap("2", "/mnt/agfs-vol/agfs/magicfs/topic/chat_history/magic<main>.json",
              space=TOPIC_SPACE),
        _snap("3", "/mnt/agfs-vol/agfs/magicfs/topic/chat_history/magic<main>.horizon.json",
              space=TOPIC_SPACE),
    ]

    assert select_changed_attachment_paths(snapshots) == [
        "/mnt/agfs-vol/agfs/magicfs/project/report.md",
    ]
    assert select_file_version_paths(snapshots) == [
        "/mnt/agfs-vol/agfs/magicfs/project/report.md",
    ]


def test_user_space_in_versions_but_not_attachments():
    """策略拆分核心：user 空间变更创建文件版本，但不进变更附件列表。"""
    snapshots = [
        _snap("1", "/mnt/agfs-vol/agfs/magicfs/project/report.md", space="project"),
        _snap("2", "/mnt/agfs-vol/agfs/magicfs/user/notes.txt", space=USER_SPACE),
    ]

    assert select_changed_attachment_paths(snapshots) == [
        "/mnt/agfs-vol/agfs/magicfs/project/report.md",
    ]
    assert select_file_version_paths(snapshots) == [
        "/mnt/agfs-vol/agfs/magicfs/project/report.md",
        "/mnt/agfs-vol/agfs/magicfs/user/notes.txt",
    ]


def test_hidden_path_files_in_versions_and_project_attachments():
    """回归（生产案例）：以 "." 开头的目录里的持久文件不得被过滤。

    用户空间的记忆文件位于 .magic/ 下，曾因隐藏路径过滤被整条剔除，
    导致文件版本停在 v1。用户空间隐藏文件只进版本；项目空间隐藏文件
    进附件与版本。
    """
    snapshots = [
        _snap("1", "/mnt/agfs-vol/agfs/magicfs/user/.magic/memory/global/MEMORY.md",
              FileOperation.CREATED, space=USER_SPACE),
        _snap("2", "/mnt/agfs-vol/agfs/magicfs/user/.venv/lib.py", space=USER_SPACE),
        _snap("3", "/mnt/agfs-vol/agfs/magicfs/project/.magic/skills/README.md",
              space="project"),
    ]

    assert select_changed_attachment_paths(snapshots) == [
        "/mnt/agfs-vol/agfs/magicfs/project/.magic/skills/README.md",
    ]
    assert select_file_version_paths(snapshots) == [
        "/mnt/agfs-vol/agfs/magicfs/user/.magic/memory/global/MEMORY.md",
        "/mnt/agfs-vol/agfs/magicfs/user/.venv/lib.py",
        "/mnt/agfs-vol/agfs/magicfs/project/.magic/skills/README.md",
    ]


def test_legacy_empty_space_treated_as_project():
    """旧格式条目（space 为空）按项目空间解析：进附件也进版本。"""
    snapshots = [
        _snap("1", "legacy.txt", space=""),
    ]

    assert select_changed_attachment_paths(snapshots) == ["legacy.txt"]
    assert select_file_version_paths(snapshots) == ["legacy.txt"]


def test_operation_rules_shared_by_both_selectors():
    """既有规则不回归：created 保留、deleted/renamed/目录剔除。"""
    snapshots = [
        _snap("1", "created.txt", FileOperation.CREATED),
        _snap("2", "deleted.txt", FileOperation.DELETED),
        _snap("3", "renamed-target.txt", FileOperation.RENAMED),
        _snap("4", "docs/readme.md"),
        _snap("5", "a-dir", FileOperation.CREATED, file_type=FileType.DIRECTORY),
    ]

    assert select_changed_attachment_paths(snapshots) == ["created.txt", "docs/readme.md"]
    assert select_file_version_paths(snapshots) == ["created.txt", "docs/readme.md"]


def test_renamed_then_updated_keeps_target():
    """rename 后同 file_id 出现 UPDATED 时，新路径仍进列表（按 path 去重）。"""
    snapshots = [
        _snap("9", "final.txt", FileOperation.RENAMED),
        _snap("9", "final.txt", FileOperation.UPDATED),
    ]

    assert select_changed_attachment_paths(snapshots) == ["final.txt"]
    assert select_file_version_paths(snapshots) == ["final.txt"]


def test_duplicate_paths_deduped_keeping_first_occurrence():
    snapshots = [
        _snap("1", "dup.txt"),
        _snap("2", "other.txt"),
        _snap("3", "dup.txt"),
    ]

    assert select_changed_attachment_paths(snapshots) == ["dup.txt", "other.txt"]
    assert select_file_version_paths(snapshots) == ["dup.txt", "other.txt"]
