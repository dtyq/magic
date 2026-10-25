# -*- coding: utf-8 -*-
"""checkpoint manifest activity 状态机测试。

activity 描述 checkpoint 系统当前在做什么（idle / rollback / restore）。
任何非 idle 活动期间 agfs 侧 checkpoint hook 跳过记账，因此写侧必须保证：
- 恢复 manifest 时置 restore（关闭恢复窗口的记账）；
- 登记首个新 checkpoint 时清回 idle；
- 旧 manifest 无该字段按 idle 处理（兼容）。
"""

import json
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.core.entity.checkpoint import CheckpointActivity
from app.infrastructure.checkpoint.metadata_manager import CheckpointMetadataManager
from app.infrastructure.checkpoint.remote_sync import CheckpointRemoteSync


TOPIC_ID = "topic-1"


def _write_manifest(checkpoints_root: Path, *, activity: str | None, current: str | None = None) -> None:
    data = {
        "checkpoints": [],
        "current_checkpoint_id": current,
        "created_time": datetime.now().isoformat(),
        "updated_time": datetime.now().isoformat(),
    }
    if activity is not None:
        data["activity"] = activity
    checkpoints_root.mkdir(parents=True, exist_ok=True)
    (checkpoints_root / "checkpoint_manifest.json").write_text(
        json.dumps(data), encoding="utf-8"
    )


@pytest.fixture
def manager(checkpoints_root, monkeypatch) -> CheckpointMetadataManager:
    monkeypatch.setattr(
        "app.path_manager.PathManager.get_checkpoints_dir", classmethod(lambda cls: checkpoints_root),
        raising=True,
    )
    return CheckpointMetadataManager()


@pytest.fixture
def checkpoints_root(tmp_path: Path) -> Path:
    return tmp_path / "checkpoints"


@pytest.mark.asyncio
async def test_new_checkpoint_resets_activity_to_idle(manager, checkpoints_root):
    """登记首个新 checkpoint 时把 restore 清回 idle，hook 恢复记账。"""
    _write_manifest(checkpoints_root, activity="restore", current="cp-old")

    assert await manager.update_checkpoint_manifest("cp-new") is True

    data = json.loads((checkpoints_root / "checkpoint_manifest.json").read_text(encoding="utf-8"))
    assert data["activity"] == CheckpointActivity.IDLE.value
    assert data["checkpoints"] == ["cp-new"]


@pytest.mark.asyncio
async def test_set_activity_roundtrip(manager, checkpoints_root):
    _write_manifest(checkpoints_root, activity="idle", current="cp-1")

    assert await manager.set_activity(CheckpointActivity.ROLLBACK) is True
    data = json.loads((checkpoints_root / "checkpoint_manifest.json").read_text(encoding="utf-8"))
    assert data["activity"] == "rollback"

    manifest = await manager.load_checkpoint_manifest()
    assert manifest.activity == CheckpointActivity.ROLLBACK


@pytest.mark.asyncio
async def test_manifest_without_activity_field_is_idle(manager, checkpoints_root):
    """旧 manifest 没有 activity 字段：按 idle 处理，读写不报错。"""
    _write_manifest(checkpoints_root, activity=None, current="cp-1")

    manifest = await manager.load_checkpoint_manifest()
    assert manifest.activity == CheckpointActivity.IDLE


@pytest.mark.asyncio
async def test_set_activity_without_manifest_is_noop(manager, checkpoints_root):
    assert await manager.set_activity(CheckpointActivity.RESTORE) is False


class _FakeStorage:
    def __init__(self, objects: dict[str, bytes]):
        self.objects = objects
        self.credentials = SimpleNamespace(get_dir=lambda: "dir")

    async def exists(self, key, options=None):
        return key in self.objects

    async def download(self, key, options=None):
        import io
        return io.BytesIO(self.objects[key])


@pytest.mark.asyncio
async def test_download_manifest_stamps_restore_activity(checkpoints_root, monkeypatch):
    """沙箱重启恢复 manifest 时写入 activity=restore，关闭记账窗口。"""
    monkeypatch.setattr(
        "app.path_manager.PathManager.get_checkpoints_dir", classmethod(lambda cls: checkpoints_root),
        raising=True,
    )
    manifest_body = json.dumps({
        "checkpoints": ["cp1"],
        "current_checkpoint_id": "cp1",
        "created_time": datetime.now().isoformat(),
        "updated_time": datetime.now().isoformat(),
    }).encode("utf-8")

    sync = CheckpointRemoteSync(_FakeStorage({}), TOPIC_ID)
    sync.storage_service.objects[sync.manifest_key()] = manifest_body
    assert await sync.download_manifest() is True

    data = json.loads((checkpoints_root / "checkpoint_manifest.json").read_text(encoding="utf-8"))
    assert data["activity"] == CheckpointActivity.RESTORE.value
    assert data["current_checkpoint_id"] == "cp1"
