import io
import json
import zipfile
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.core.entity.checkpoint import CheckpointInfo, CheckpointManifest, VirtualCheckpoint
from app.core.exceptions import RollbackException
from app.infrastructure.checkpoint.remote_sync import CheckpointRemoteSync
from app.service.rollback_service import RollbackService

TOPIC_ID = "topic-123"
# get_storage_dir(credentials) -> "dir"；combine_path("dir","checkpoints") -> "dir/checkpoints"
MANIFEST_KEY = "dir/checkpoints/topic-123/manifest.json"


class FakeStorage:
    """内存版对象存储，模拟 upload/download/exists/delete/download_file_by_stream。"""

    def __init__(self):
        self.objects = {}
        self.deleted_keys = []
        self.credentials = SimpleNamespace(get_dir=lambda: "dir")

    async def upload(self, file, key, options=None):
        with open(file, "rb") as f:
            self.objects[key] = f.read()
        return SimpleNamespace(key=key)

    async def download(self, key, options=None):
        return io.BytesIO(self.objects[key])

    async def download_file_by_stream(self, key, dest_path, options=None, chunk_size=4 * 1024 * 1024):
        with open(dest_path, "wb") as f:
            f.write(self.objects[key])
        return len(self.objects[key])

    async def exists(self, key, options=None):
        return key in self.objects

    async def delete(self, key, options=None):
        self.objects.pop(key, None)
        self.deleted_keys.append(key)
        return True


def checkpoint_key(checkpoint_id: str) -> str:
    return f"dir/checkpoints/topic-123/{checkpoint_id}.zip"


def write_local_checkpoint(checkpoints_root: Path, checkpoint_id: str, extra_files=None) -> None:
    """按分区契约构造本地 checkpoint：Python 簿记 + project 空间流水。"""
    cp_dir = checkpoints_root / checkpoint_id
    cp_dir.mkdir(parents=True, exist_ok=True)
    (cp_dir / "checkpoint_info.json").write_text(
        json.dumps({"checkpoint_id": checkpoint_id, "created_time": datetime.now().isoformat()}),
        encoding="utf-8",
    )
    space_dir = cp_dir / "project"
    space_dir.mkdir(parents=True, exist_ok=True)
    (space_dir / "operations.json").write_text(
        json.dumps({"checkpoint_id": checkpoint_id, "file_snapshots": []}),
        encoding="utf-8",
    )
    for name, content in (extra_files or {}).items():
        (cp_dir / name).write_text(content, encoding="utf-8")


def write_local_manifest(checkpoints_root: Path, checkpoint_ids, current=None) -> None:
    manifest = CheckpointManifest(
        checkpoints=[VirtualCheckpoint.INITIAL, *checkpoint_ids],
        current_checkpoint_id=current or (checkpoint_ids[-1] if checkpoint_ids else None),
        created_time=datetime.now(),
        updated_time=datetime.now(),
    )
    (checkpoints_root / "checkpoint_manifest.json").write_text(
        json.dumps(manifest.model_dump(), default=str), encoding="utf-8"
    )


@pytest.mark.asyncio
async def test_upload_checkpoint_uploads_only_that_checkpoint(tmp_path):
    checkpoints_root = tmp_path / ".checkpoints"
    checkpoints_root.mkdir()
    write_local_checkpoint(checkpoints_root, "cp1", extra_files={"snapshot.txt": "hello"})

    storage = FakeStorage()
    with patch("app.path_manager.PathManager.get_checkpoints_dir", return_value=checkpoints_root):
        sync = CheckpointRemoteSync(storage, TOPIC_ID)
        assert await sync.upload_checkpoint("cp1") is True

    assert checkpoint_key("cp1") in storage.objects
    with zipfile.ZipFile(io.BytesIO(storage.objects[checkpoint_key("cp1")])) as zf:
        names = set(zf.namelist())
        assert "checkpoint_info.json" in names
        assert "project/operations.json" in names
        assert "snapshot.txt" in names
        assert zf.read("snapshot.txt") == b"hello"


@pytest.mark.asyncio
async def test_upload_checkpoint_skips_incomplete_dir(tmp_path):
    checkpoints_root = tmp_path / ".checkpoints"
    checkpoints_root.mkdir()
    (checkpoints_root / "cp1").mkdir()

    storage = FakeStorage()
    with patch("app.path_manager.PathManager.get_checkpoints_dir", return_value=checkpoints_root):
        sync = CheckpointRemoteSync(storage, TOPIC_ID)
        assert await sync.upload_checkpoint("cp1") is False

    assert storage.objects == {}


@pytest.mark.asyncio
async def test_download_manifest_restores_local(tmp_path):
    checkpoints_root = tmp_path / ".checkpoints"
    checkpoints_root.mkdir()
    manifest_body = json.dumps(
        CheckpointManifest(
            checkpoints=["__INITIAL__", "cp1"],
            current_checkpoint_id="cp1",
            created_time=datetime.now(),
            updated_time=datetime.now(),
        ).model_dump(),
        default=str,
    ).encode("utf-8")

    storage = FakeStorage()
    storage.objects[MANIFEST_KEY] = manifest_body
    with patch("app.path_manager.PathManager.get_checkpoints_dir", return_value=checkpoints_root):
        sync = CheckpointRemoteSync(storage, TOPIC_ID)
        assert await sync.download_manifest() is True

    assert (checkpoints_root / "checkpoint_manifest.json").read_bytes() == manifest_body


@pytest.mark.asyncio
async def test_download_manifest_skips_when_absent(tmp_path):
    checkpoints_root = tmp_path / ".checkpoints"
    checkpoints_root.mkdir()

    storage = FakeStorage()
    with patch("app.path_manager.PathManager.get_checkpoints_dir", return_value=checkpoints_root):
        sync = CheckpointRemoteSync(storage, TOPIC_ID)
        assert await sync.download_manifest() is False
    assert not (checkpoints_root / "checkpoint_manifest.json").exists()


@pytest.mark.asyncio
async def test_ensure_checkpoints_available_downloads_missing(tmp_path):
    checkpoints_root = tmp_path / ".checkpoints"
    checkpoints_root.mkdir()
    # 远端有 cp2 归档，本地没有
    storage = FakeStorage()
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as zf:
        zf.writestr("project/operations.json", "{}")
        zf.writestr("project/file_snapshots/.keep", "")
    storage.objects[checkpoint_key("cp2")] = buffer.getvalue()

    with patch("app.path_manager.PathManager.get_checkpoints_dir", return_value=checkpoints_root):
        sync = CheckpointRemoteSync(storage, TOPIC_ID)
        await sync.ensure_checkpoints_available(["cp2"])

    # 下载完成判定走新口径：project 分区的 operations.json 即视为已就位
    assert (checkpoints_root / "cp2" / "project" / "operations.json").exists()
    assert (checkpoints_root / "cp2" / "project" / "file_snapshots" / ".keep").exists()


@pytest.mark.asyncio
async def test_ensure_checkpoints_available_skips_existing(tmp_path):
    checkpoints_root = tmp_path / ".checkpoints"
    checkpoints_root.mkdir()
    write_local_checkpoint(checkpoints_root, "cp1")

    storage = FakeStorage()
    with patch("app.path_manager.PathManager.get_checkpoints_dir", return_value=checkpoints_root):
        sync = CheckpointRemoteSync(storage, TOPIC_ID)
        await sync.ensure_checkpoints_available(["cp1"])

    assert storage.objects == {}


@pytest.mark.asyncio
async def test_sync_manifest_and_evicted_deletes_evicted_archives(tmp_path):
    checkpoints_root = tmp_path / ".checkpoints"
    checkpoints_root.mkdir()
    write_local_manifest(checkpoints_root, ["cp1", "cp2"], current="cp2")

    # 上一轮已上传 cp1/cp2/cp3，本轮 manifest 只剩 cp1/cp2，cp3 应被删除
    (checkpoints_root / ".remote_sync_state.json").write_text(
        json.dumps({"uploaded_checkpoint_ids": ["cp1", "cp2", "cp3"]}), encoding="utf-8"
    )

    storage = FakeStorage()
    storage.objects[checkpoint_key("cp1")] = b"z1"
    storage.objects[checkpoint_key("cp2")] = b"z2"
    storage.objects[checkpoint_key("cp3")] = b"z3"

    with patch("app.path_manager.PathManager.get_checkpoints_dir", return_value=checkpoints_root):
        sync = CheckpointRemoteSync(storage, TOPIC_ID)
        await sync.sync_manifest_and_evicted()

    assert checkpoint_key("cp3") not in storage.objects
    assert checkpoint_key("cp1") in storage.objects
    assert checkpoint_key("cp2") in storage.objects
    assert checkpoint_key("cp3") in storage.deleted_keys
    assert MANIFEST_KEY in storage.objects
    state = json.loads((checkpoints_root / ".remote_sync_state.json").read_text(encoding="utf-8"))
    assert state["uploaded_checkpoint_ids"] == ["cp1", "cp2"]


@pytest.mark.asyncio
async def test_sync_manifest_and_evicted_backfills_missing_archive(tmp_path):
    """本地 manifest 里尚未确认上传的归档每轮自动补传，补齐后才发布 manifest。"""
    checkpoints_root = tmp_path / ".checkpoints"
    checkpoints_root.mkdir()
    write_local_manifest(checkpoints_root, ["cp1", "cp2"], current="cp2")
    # cp1 已确认上传，cp2 的归档缺失（模拟上一轮上传失败）
    write_local_checkpoint(checkpoints_root, "cp2")
    (checkpoints_root / ".remote_sync_state.json").write_text(
        json.dumps({"uploaded_checkpoint_ids": ["cp1"]}), encoding="utf-8"
    )

    storage = FakeStorage()
    storage.objects[checkpoint_key("cp1")] = b"z1"

    with patch("app.path_manager.PathManager.get_checkpoints_dir", return_value=checkpoints_root):
        sync = CheckpointRemoteSync(storage, TOPIC_ID)
        await sync.sync_manifest_and_evicted()

    assert checkpoint_key("cp2") in storage.objects
    assert MANIFEST_KEY in storage.objects
    state = json.loads((checkpoints_root / ".remote_sync_state.json").read_text(encoding="utf-8"))
    assert state["uploaded_checkpoint_ids"] == ["cp1", "cp2"]


@pytest.mark.asyncio
async def test_sync_manifest_blocked_when_archive_upload_fails(tmp_path):
    """存在归档上传失败的 checkpoint 时，本轮不发布 manifest，避免远端引用空归档。"""
    checkpoints_root = tmp_path / ".checkpoints"
    checkpoints_root.mkdir()
    write_local_manifest(checkpoints_root, ["cp1"], current="cp1")
    # cp1 本地目录缺失 -> upload_checkpoint 失败（无 checkpoint_info.json）

    storage = FakeStorage()
    with patch("app.path_manager.PathManager.get_checkpoints_dir", return_value=checkpoints_root):
        sync = CheckpointRemoteSync(storage, TOPIC_ID)
        await sync.sync_manifest_and_evicted()

    assert MANIFEST_KEY not in storage.objects
    assert checkpoint_key("cp1") not in storage.objects
    state = json.loads((checkpoints_root / ".remote_sync_state.json").read_text(encoding="utf-8"))
    assert state["uploaded_checkpoint_ids"] == []


@pytest.mark.asyncio
async def test_download_manifest_seeds_sync_state(tmp_path):
    """重启恢复 manifest 后，用其包含的 checkpoint 集合初始化本地同步状态。"""
    checkpoints_root = tmp_path / ".checkpoints"
    checkpoints_root.mkdir()
    manifest_body = json.dumps(
        CheckpointManifest(
            checkpoints=["__INITIAL__", "cp1", "cp2"],
            current_checkpoint_id="cp2",
            created_time=datetime.now(),
            updated_time=datetime.now(),
        ).model_dump(),
        default=str,
    ).encode("utf-8")

    storage = FakeStorage()
    storage.objects[MANIFEST_KEY] = manifest_body
    with patch("app.path_manager.PathManager.get_checkpoints_dir", return_value=checkpoints_root):
        sync = CheckpointRemoteSync(storage, TOPIC_ID)
        assert await sync.download_manifest() is True

    state = json.loads((checkpoints_root / ".remote_sync_state.json").read_text(encoding="utf-8"))
    assert state["uploaded_checkpoint_ids"] == ["cp1", "cp2"]


@pytest.mark.asyncio
async def test_start_rollback_pulls_range_and_syncs_manifest_on_success():
    """回滚前按需拉取范围内缺失的 checkpoint，成功后把回滚位置同步到远端 manifest。"""
    service = RollbackService.__new__(RollbackService)
    service.checkpoint_service = SimpleNamespace(
        metadata_manager=SimpleNamespace(
            get_previous_checkpoint_in_checkpoint_manifest=AsyncMock(return_value="cp2"),
            get_current_checkpoint=AsyncMock(return_value="cp5"),
            set_activity=AsyncMock(return_value=True),
            get_checkpoints_between_in_checkpoint_manifest=AsyncMock(
                return_value=("backward", ["cp3", "cp4", "cp5"])
            ),
        )
    )
    service.rollback_executor = SimpleNamespace(start_rollback=AsyncMock(return_value=(True, [])))
    service._build_remote_sync_context = AsyncMock(return_value=("fake_storage", TOPIC_ID))
    service._create_file_versions_after_rollback = AsyncMock()

    with patch("app.service.rollback_service.CheckpointRemoteSync") as mock_sync_cls:
        mock_sync = mock_sync_cls.return_value
        mock_sync.ensure_checkpoints_available = AsyncMock()
        mock_sync.sync_manifest_and_evicted = AsyncMock()
        affected = await service.start_rollback("cp3")

    assert affected == []
    # 拉取范围 + 成功后同步 manifest，共构造两次远端同步器
    mock_sync_cls.assert_any_call("fake_storage", TOPIC_ID)
    assert mock_sync_cls.call_count == 2
    mock_sync.ensure_checkpoints_available.assert_awaited_once_with(["cp3", "cp4", "cp5"])
    mock_sync.sync_manifest_and_evicted.assert_awaited_once()
    # executor 不感知远端，只接收解析后的实际回滚目标
    service.rollback_executor.start_rollback.assert_awaited_once_with("cp2")
    service.checkpoint_service.metadata_manager.set_activity.assert_awaited()


@pytest.mark.asyncio
async def test_start_rollback_does_not_sync_manifest_on_failure():
    """回滚执行失败时不应把回滚位置同步到远端 manifest。"""
    service = RollbackService.__new__(RollbackService)
    service.checkpoint_service = SimpleNamespace(
        metadata_manager=SimpleNamespace(
            get_previous_checkpoint_in_checkpoint_manifest=AsyncMock(return_value="cp2"),
            get_current_checkpoint=AsyncMock(return_value="cp5"),
            set_activity=AsyncMock(return_value=True),
            get_checkpoints_between_in_checkpoint_manifest=AsyncMock(
                return_value=("backward", ["cp3", "cp4", "cp5"])
            ),
        )
    )
    service.rollback_executor = SimpleNamespace(start_rollback=AsyncMock(return_value=(False, [])))
    service._build_remote_sync_context = AsyncMock(return_value=("fake_storage", TOPIC_ID))
    service._create_file_versions_after_rollback = AsyncMock()

    with patch("app.service.rollback_service.CheckpointRemoteSync") as mock_sync_cls:
        mock_sync = mock_sync_cls.return_value
        mock_sync.ensure_checkpoints_available = AsyncMock()
        mock_sync.sync_manifest_and_evicted = AsyncMock()
        with pytest.raises(RollbackException):
            await service.start_rollback("cp3")

    # 拉取照常进行，但失败后不再同步 manifest
    mock_sync.ensure_checkpoints_available.assert_awaited_once_with(["cp3", "cp4", "cp5"])
    mock_sync.sync_manifest_and_evicted.assert_not_awaited()
    service._create_file_versions_after_rollback.assert_not_awaited()
