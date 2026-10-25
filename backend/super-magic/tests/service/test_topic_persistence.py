# -*- coding: utf-8 -*-
"""TopicPersistenceManager 恢复/清空路径测试。

运行期聊天历史目录在沙箱内是指向 localfs 挂载的 symlink；恢复与清空
必须原地操作（解析 symlink 后清空再拷入），不能整目录 rename 替换
（容器 overlay → FUSE 跨设备 EXDEV）。
"""

from pathlib import Path

import pytest

from app.service.topic_persistence import TopicPersistenceManager


def test_clear_directory_removes_contents_keeps_symlink(tmp_path: Path):
    real_dir = tmp_path / "mounts" / "chat_history"
    real_dir.mkdir(parents=True)
    (real_dir / "history.json").write_text("{}", encoding="utf-8")
    sub = real_dir / "subagents"
    sub.mkdir()
    (sub / "a.json").write_text("{}", encoding="utf-8")

    link = tmp_path / ".chat_history"
    link.symlink_to(real_dir)

    TopicPersistenceManager.clear_directory(link)

    # symlink 与目标目录本体保留，内容被清空
    assert link.is_symlink()
    assert real_dir.exists()
    assert list(real_dir.iterdir()) == []


def test_clear_directory_works_on_plain_dir(tmp_path: Path):
    target = tmp_path / ".chat_history"
    target.mkdir()
    (target / "history.json").write_text("{}", encoding="utf-8")

    TopicPersistenceManager.clear_directory(target)

    assert target.exists()
    assert list(target.iterdir()) == []


def test_replace_directory_swaps_content_without_merge(tmp_path: Path):
    """恢复是幂等全量替换：目标中的陈旧文件不得残留。"""
    source = tmp_path / "source"
    source.mkdir()
    (source / "history.json").write_text("v2", encoding="utf-8")

    target = tmp_path / ".chat_history"
    target.mkdir()
    (target / "history.json").write_text("v1", encoding="utf-8")
    (target / "stale.json").write_text("old", encoding="utf-8")

    TopicPersistenceManager._replace_directory(source, target)

    assert (target / "history.json").read_text(encoding="utf-8") == "v2"
    assert not (target / "stale.json").exists()


def test_replace_directory_follows_symlink_target(tmp_path: Path):
    """目标为 symlink 时解析到真实目录操作，替换后 symlink 仍有效。"""
    real_dir = tmp_path / "mounts" / "chat_history"
    real_dir.mkdir(parents=True)
    (real_dir / "stale.json").write_text("old", encoding="utf-8")

    link = tmp_path / ".chat_history"
    link.symlink_to(real_dir)

    manager = TopicPersistenceManager(tmp_path)
    manager.ensure_directories()
    (manager.chat_history_dir / "history.json").write_text("fresh", encoding="utf-8")

    manager.restore_topic_chat_history(link)

    assert link.is_symlink()
    assert (real_dir / "history.json").read_text(encoding="utf-8") == "fresh"
    assert not (real_dir / "stale.json").exists()
