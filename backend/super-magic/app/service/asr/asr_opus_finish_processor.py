"""Opus finish 状态机。"""

import time
from pathlib import Path
from typing import Protocol

from loguru import logger

from app.service.asr.asr_base import AsrServiceBase
from app.service.asr.asr_merge_task_manager import AsrMergeTaskManager
from app.service.asr.asr_monitoring_task import AsrMonitoringTask
from app.service.asr.asr_opus_merge_operations import (
    AsrOpusMergeOperations,
    OpusShardsNotReadyError,
)


class _TaskFinalizer(Protocol):
    async def complete_task(self, task_key: str, source_dir: Path) -> None: ...


class AsrOpusFinishProcessor(AsrServiceBase):
    """Coordinate Opus pending/merging/completed/failed transitions."""

    def __init__(
        self,
        merge_operations: AsrOpusMergeOperations,
        task_finalizer: _TaskFinalizer,
    ) -> None:
        self.merge_operations = merge_operations
        self.task_finalizer = task_finalizer

    @staticmethod
    def should_run(upload_completed: bool, merge_status: str) -> bool:
        return upload_completed and merge_status in {"pending", "failed"}

    async def process(
        self,
        task: AsrMonitoringTask,
        all_files: list[tuple[int, Path]],
    ) -> bool:
        task_manager = AsrMergeTaskManager.instance()
        progress = await task_manager.get_progress(task.task_key)
        if not progress or not progress.upload_completed:
            return False

        if progress.opus_merge_status == "completed":
            if await task_manager.check_should_complete_opus(
                task.task_key, task.source_dir, len(all_files)
            ):
                await self.task_finalizer.complete_task(task.task_key, task.source_dir)
                return True
            return False

        if not self.should_run(progress.upload_completed, progress.opus_merge_status):
            return False
        ready, terminal_failed = await task_manager.update_finish_shard_stability(
            task.task_key, all_files
        )
        if terminal_failed:
            return True
        if not ready:
            logger.info(
                f"{self.LOG_PREFIX} ⏳ task_key={task.task_key} 等待分片稳定: "
                f"count={len(all_files)}, declared={progress.file_shard_count}"
            )
            return False
        if not await task_manager.claim_opus_merge(task.task_key):
            return False

        claimed_progress = await task_manager.get_progress(task.task_key)
        if not claimed_progress:
            return False
        attempt_id = claimed_progress.opus_merge_attempt_id

        try:
            # silence_fill（含旧值 middle_gap_silence_fill）必须用声明总数作为合并范围，
            # 否则尾部缺片进不了补齐范围；尾部截断收敛只存在旧持久化状态中。
            if claimed_progress.finish_completion_mode == "tail_missing_convergence":
                expected_shard_count = len(all_files)
            elif claimed_progress.file_shard_count >= 0:
                expected_shard_count = claimed_progress.file_shard_count
            else:
                expected_shard_count = None
            is_silence_fill = claimed_progress.finish_completion_mode in {
                "silence_fill",
                "middle_gap_silence_fill",
            }
            await self.merge_operations.merge_opus_on_finish(
                task.task_key,
                task.source_dir,
                all_files,
                expected_shard_count=expected_shard_count,
                merge_attempt_id=attempt_id,
                missing_indices=claimed_progress.accepted_missing_shard_indices
                if is_silence_fill
                else None,
            )
        except OpusShardsNotReadyError as exc:
            if self._deadline_reached(claimed_progress.completion_deadline_at):
                await task_manager.set_opus_merge_status(
                    task.task_key, "failed", str(exc), expected_attempt_id=attempt_id
                )
                await task_manager.fail_task(task.task_key, f"Opus 分片未就绪: {exc}")
                return True
            await task_manager.set_opus_merge_status(
                task.task_key, "pending", str(exc), expected_attempt_id=attempt_id
            )
            logger.info(f"{self.LOG_PREFIX} ⏳ task_key={task.task_key} 等待 Opus 分片: {exc}")
            return False
        except Exception as exc:
            await task_manager.set_opus_merge_status(
                task.task_key, "failed", str(exc), expected_attempt_id=attempt_id
            )
            logger.error(
                f"{self.LOG_PREFIX} ❌ task_key={task.task_key} "
                f"attempt_id={attempt_id} Opus finish 合并失败: {exc}"
            )
            if self._deadline_reached(claimed_progress.completion_deadline_at):
                await task_manager.fail_task(task.task_key, f"Opus finish 合并失败: {exc}")
                return True
            return False

        if claimed_progress.finish_completion_mode in {"silence_fill", "middle_gap_silence_fill"}:
            degraded_saved = await task_manager.set_degraded_merge_info(
                task.task_key,
                claimed_progress.finish_completion_mode,
                claimed_progress.accepted_missing_shard_indices,
            )
            if not degraded_saved:
                await task_manager.set_opus_merge_status(
                    task.task_key, "failed", "记录降级合并结果失败", expected_attempt_id=attempt_id
                )
                logger.error(
                    f"{self.LOG_PREFIX} ❌ task_key={task.task_key} "
                    "降级合并结果写入失败，阻止任务完成"
                )
                return False
        status_saved = await task_manager.set_opus_merge_status(
            task.task_key,
            "completed",
            expected_attempt_id=attempt_id,
        )
        if not status_saved:
            logger.error(
                f"{self.LOG_PREFIX} ❌ task_key={task.task_key} Opus 产物已上传，"
                f"attempt_id={attempt_id} completed 状态写入失败"
            )
            return False
        if await task_manager.check_should_complete_opus(
            task.task_key, task.source_dir, len(all_files)
        ):
            await self.task_finalizer.complete_task(task.task_key, task.source_dir)
            return True
        return False

    @staticmethod
    def _deadline_reached(deadline_at: float | None) -> bool:
        return deadline_at is not None and time.time() >= deadline_at
