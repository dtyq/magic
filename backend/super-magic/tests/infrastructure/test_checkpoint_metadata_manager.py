import json
from pathlib import Path
from unittest.mock import patch

from app.core.entity.checkpoint import CheckpointInfo, VirtualCheckpoint
from app.path_manager import PathManager
from app.infrastructure.checkpoint.metadata_manager import CheckpointMetadataManager


class FakeCheckpointStorage:
    """用于验证 checkpoint 元数据管理器异步调用行为的假存储。"""

    def __init__(self, exists: bool, base_dir: Path):
        """初始化假存储的存在状态与测试目录。"""

        self.exists = exists
        self.base_dir = base_dir
        self.exists_calls: list[str] = []
        self.create_calls: list[str] = []

    async def checkpoint_exists(self, checkpoint_id: str) -> bool:
        """记录存在性检查调用，并返回预设结果。"""

        self.exists_calls.append(checkpoint_id)
        return self.exists

    async def create_checkpoint_directory(self, checkpoint_id: str) -> str:
        """记录目录创建调用，并创建测试目录。"""

        self.create_calls.append(checkpoint_id)
        checkpoint_dir = self.base_dir / checkpoint_id
        checkpoint_dir.mkdir(parents=True, exist_ok=True)
        return str(checkpoint_dir)

    def get_checkpoint_info_file_path(self, checkpoint_id: str) -> Path:
        """返回 checkpoint 信息文件路径。"""

        return self.base_dir / checkpoint_id / "checkpoint_info.json"


async def test_ensure_initial_checkpoint_creates_missing_initial(tmp_path: Path, monkeypatch):
    """初始 checkpoint 不存在时，应 await 检查、创建目录并保存元信息。"""

    manager = CheckpointMetadataManager()
    storage = FakeCheckpointStorage(exists=False, base_dir=tmp_path)
    saved_infos: list[CheckpointInfo] = []

    async def save_checkpoint_info(checkpoint_info: CheckpointInfo) -> bool:
        """记录保存的 checkpoint 元信息。"""

        saved_infos.append(checkpoint_info)
        return True

    manager.storage = storage
    monkeypatch.setattr(manager, "save_checkpoint_info", save_checkpoint_info)

    assert await manager.ensure_initial_checkpoint_created() is True
    assert storage.exists_calls == [VirtualCheckpoint.INITIAL]
    assert storage.create_calls == [VirtualCheckpoint.INITIAL]
    assert [info.checkpoint_id for info in saved_infos] == [VirtualCheckpoint.INITIAL]


async def test_ensure_initial_checkpoint_skips_existing_initial(tmp_path: Path, monkeypatch):
    """初始 checkpoint 已存在时，应只 await 检查而不重复创建。"""

    manager = CheckpointMetadataManager()
    storage = FakeCheckpointStorage(exists=True, base_dir=tmp_path)
    saved_infos: list[CheckpointInfo] = []

    async def save_checkpoint_info(checkpoint_info: CheckpointInfo) -> bool:
        """记录不应被调用的保存请求。"""

        saved_infos.append(checkpoint_info)
        return True

    manager.storage = storage
    monkeypatch.setattr(manager, "save_checkpoint_info", save_checkpoint_info)

    assert await manager.ensure_initial_checkpoint_created() is True
    assert storage.exists_calls == [VirtualCheckpoint.INITIAL]
    assert storage.create_calls == []
    assert saved_infos == []


async def test_load_checkpoint_info_aggregates_space_operations(tmp_path: Path):
    """加载时应合并各空间 operations.json 的流水；簿记本身不含 file_snapshots。"""

    checkpoints_root = tmp_path
    manager = CheckpointMetadataManager()

    checkpoint_id = "951497283793154048"
    cp_dir = checkpoints_root / checkpoint_id
    cp_dir.mkdir(parents=True)

    # Python 簿记：仅两字段
    (cp_dir / "checkpoint_info.json").write_text(
        json.dumps({"checkpoint_id": checkpoint_id, "created_time": "2026-08-27T15:10:35"}),
        encoding="utf-8",
    )
    # project 分区：两条流水（一条折叠计数）
    (cp_dir / "project").mkdir()
    (cp_dir / "project" / "operations.json").write_text(
        json.dumps({
            "checkpoint_id": checkpoint_id,
            "file_snapshots": [
                {"file_id": "1", "file_path": "/mnt/agfs-vol/agfs/magicfs/project/a.txt",
                 "modified_time": "2026-08-27 15:10:36", "operation": "updated",
                 "file_type": "file", "space": "project"},
                {"file_id": "2", "file_path": "/mnt/agfs-vol/agfs/magicfs/project/b.txt",
                 "modified_time": "2026-08-27 15:10:37", "operation": "created",
                 "file_type": "file", "space": "project"},
            ],
        }),
        encoding="utf-8",
    )
    # topic 分区：一条流水
    (cp_dir / "topic").mkdir()
    (cp_dir / "topic" / "operations.json").write_text(
        json.dumps({
            "checkpoint_id": checkpoint_id,
            "file_snapshots": [
                {"file_id": "3", "file_path": "/mnt/agfs-vol/agfs/magicfs/topic/chat_history/m.json",
                 "modified_time": "2026-08-27 15:10:40", "operation": "updated",
                 "file_type": "file", "space": "topic"},
            ],
        }),
        encoding="utf-8",
    )

    with patch.object(PathManager, "get_checkpoint_dir", classmethod(lambda cls, cid: checkpoints_root / cid)):
        info = await manager.load_checkpoint_info(checkpoint_id)

    assert info is not None
    assert info.checkpoint_id == checkpoint_id
    assert [s.file_id for s in info.file_snapshots] == ["1", "2", "3"]
    assert {s.space for s in info.file_snapshots} == {"project", "topic"}

    # 缺失的空间分区静默跳过，不产生错误
    empty_manager = CheckpointMetadataManager()
    only_book = checkpoints_root / "empty-cp"
    only_book.mkdir()
    (only_book / "checkpoint_info.json").write_text(
        json.dumps({"checkpoint_id": "empty-cp", "created_time": "2026-08-27T15:10:35"}),
        encoding="utf-8",
    )
    with patch.object(PathManager, "get_checkpoint_dir", classmethod(lambda cls, cid: checkpoints_root / cid)):
        empty_info = await empty_manager.load_checkpoint_info("empty-cp")
    assert empty_info is not None and empty_info.file_snapshots == []
