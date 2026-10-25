from types import SimpleNamespace
from unittest.mock import AsyncMock, call

import pytest

from app.service.checkpoint_service import CheckpointService
from app.service.rollback_service import RollbackService


def _build_checkpoint_service(*, current_checkpoint_id: str, checkpoint_ids: list[str]) -> CheckpointService:
    """构造只使用 mock 依赖的 checkpoint 服务。"""
    service = CheckpointService.__new__(CheckpointService)
    service.storage = SimpleNamespace(
        delete_checkpoint_directory=AsyncMock(return_value=True),
    )
    service.metadata_manager = SimpleNamespace(
        get_current_checkpoint=AsyncMock(return_value=current_checkpoint_id),
        load_checkpoint_manifest=AsyncMock(
            return_value=SimpleNamespace(checkpoints=list(checkpoint_ids)),
        ),
        remove_from_manifest=AsyncMock(return_value=True),
    )
    return service


@pytest.mark.asyncio
async def test_discard_future_checkpoints_skips_latest_checkpoint() -> None:
    """当前已是最新 checkpoint 时，不应删除目录或触发其他副作用。"""
    service = _build_checkpoint_service(
        current_checkpoint_id="checkpoint-2",
        checkpoint_ids=["checkpoint-1", "checkpoint-2"],
    )

    deleted_checkpoint_ids = await service.discard_future_checkpoints()

    assert deleted_checkpoint_ids == []
    service.storage.delete_checkpoint_directory.assert_not_awaited()
    service.metadata_manager.remove_from_manifest.assert_not_awaited()


@pytest.mark.asyncio
async def test_discard_future_checkpoints_removes_only_future_branch() -> None:
    """创建新分支前，应删除当前 checkpoint 之后的全部 checkpoint。"""
    service = _build_checkpoint_service(
        current_checkpoint_id="checkpoint-2",
        checkpoint_ids=["checkpoint-1", "checkpoint-2", "checkpoint-3", "checkpoint-4"],
    )

    deleted_checkpoint_ids = await service.discard_future_checkpoints()

    assert deleted_checkpoint_ids == ["checkpoint-3", "checkpoint-4"]
    assert service.storage.delete_checkpoint_directory.await_args_list == [
        call("checkpoint-3"),
        call("checkpoint-4"),
    ]
    service.metadata_manager.remove_from_manifest.assert_awaited_once_with(
        ["checkpoint-3", "checkpoint-4"],
    )


@pytest.mark.asyncio
async def test_checkpoint_creation_cleanup_does_not_enter_rollback_service() -> None:
    """普通 checkpoint 创建前只清理未来分支，不执行持久状态重载。"""
    service = CheckpointService.__new__(CheckpointService)
    service.discard_future_checkpoints = AsyncMock(return_value=[])

    await service._ensure_clean_state_before_create()

    service.discard_future_checkpoints.assert_awaited_once_with()


@pytest.mark.asyncio
async def test_explicit_rollback_commit_reloads_persistent_state() -> None:
    """显式回滚提交完成后，仍需同步磁盘上的 ChatHistory 和 Horizon。"""
    service = RollbackService.__new__(RollbackService)
    service.checkpoint_service = SimpleNamespace(
        discard_future_checkpoints=AsyncMock(return_value=["checkpoint-3"]),
    )
    service._reload_main_agent_persistent_state = AsyncMock()

    await service.commit_rollback()

    service.checkpoint_service.discard_future_checkpoints.assert_awaited_once_with()
    service._reload_main_agent_persistent_state.assert_awaited_once_with()
