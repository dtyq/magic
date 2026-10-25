"""
ASR 音频合并服务（精简版）

核心职责：任务调度和轮询管理
业务逻辑：委托给专门的业务类处理
"""

import asyncio
import time
import traceback
from functools import lru_cache
from pathlib import Path
from typing import Dict

from loguru import logger

from app.service.asr.asr_base import AsrServiceBase
from app.service.asr.asr_file_detector import AsrFileDetector
from app.service.asr.asr_merge_task_manager import AsrMergeTaskManager, AsrTaskStatus
from app.service.asr.asr_monitoring_task import AsrMonitoringTask
from app.service.asr.asr_opus_finish_processor import AsrOpusFinishProcessor
from app.service.asr.asr_opus_merge_operations import AsrOpusMergeOperations
from app.service.asr.asr_task_finalizer import AsrTaskFinalizer
from app.service.asr.asr_time_config import asr_time_config
from app.service.asr.asr_utils import (
    check_ffmpeg_installed,
    log_ffmpeg_warning,
    resolve_path,
    validate_audio_format_for_write,
)
from app.service.asr.asr_wav_merge_operations import AsrWavMergeOperations


class AsrMergeService(AsrServiceBase):
    """
    ASR音频合并服务 - 核心调度器

    职责：
    - 管理任务生命周期（启动、停止、取消）
    - 轮询监听音频文件目录
    - 协调各业务模块完成任务

    委托业务：
    - AsrWavMergeOperations: WAV 合并操作、准备文件、执行事务
    - AsrTaskFinalizer: 任务完成处理
    - AsrMergeTaskManager: 任务状态管理、完成检查
    """

    def __init__(self):
        """初始化服务"""
        self.tasks: Dict[str, AsrMonitoringTask] = {}
        self.start_lock = asyncio.Lock()

        # 检查 ffmpeg
        self.ffmpeg_available = check_ffmpeg_installed()
        if not self.ffmpeg_available:
            log_ffmpeg_warning()
        else:
            logger.info(f"{self.LOG_PREFIX} ✅ FFmpeg 已安装")

        # 初始化子服务
        self.file_detector = AsrFileDetector()
        self.merge_operations = AsrWavMergeOperations(self.file_detector)
        self.task_finalizer = AsrTaskFinalizer(self.merge_operations)
        self.opus_merge_operations = AsrOpusMergeOperations(self.file_detector)
        self.opus_finish_processor = AsrOpusFinishProcessor(
            self.opus_merge_operations, self.task_finalizer
        )

        logger.info(f"{self.LOG_PREFIX} 🎙️ ASR音频合并服务初始化完成 (支持 WAV/OPUS)")

    async def _monitor_and_merge(self, task: AsrMonitoringTask) -> None:
        """Resolve the task format once, then dispatch to an isolated strategy."""
        logger.info(
            f"{self.LOG_PREFIX} 🔍 task_key={task.task_key} "
            f"开始轮询目录: {task.source_dir} (每{asr_time_config.POLL_INTERVAL}秒)"
        )
        await asyncio.sleep(asr_time_config.INITIAL_DELAY)
        try:
            audio_format = await self._wait_for_task_audio_format(task)
            if audio_format == "opus":
                await self._monitor_opus_task(task)
            elif audio_format == "wav":
                await self._monitor_wav_task(task)
        except Exception as e:
            logger.error(f"{self.LOG_PREFIX} ❌ task_key={task.task_key} 监听和合并过程出错: {e}")
            logger.error(f"{self.LOG_PREFIX} task_key={task.task_key} 堆栈信息:\n{traceback.format_exc()}")
            await AsrMergeTaskManager.instance().fail_task(task.task_key, f"监听失败: {e!s}")
        finally:
            logger.info(f"{self.LOG_PREFIX} 🛑 task_key={task.task_key} 停止轮询目录: {task.source_dir}")

    async def _wait_for_task_audio_format(self, task: AsrMonitoringTask) -> str | None:
        """Wait for the first valid shard and pin the task to WAV or Opus."""
        task_manager = AsrMergeTaskManager.instance()
        started_at = time.time()
        while True:
            task_state = await task_manager.get_task(task.task_key)
            if not task_state or task_state.status in {
                AsrTaskStatus.ERROR.value,
                AsrTaskStatus.CANCELED.value,
            }:
                return None
            if task_state.audio_format:
                return validate_audio_format_for_write(task_state.audio_format)

            all_files, conflicts = await asyncio.to_thread(
                self.file_detector.scan_audio_files_with_conflicts,
                task.source_dir,
                False,
            )
            if conflicts:
                if await self._handle_format_conflicts(task, conflicts):
                    return None
                await asyncio.sleep(asr_time_config.POLL_INTERVAL)
                continue
            all_files = AsrFileDetector.deduplicate_files(all_files)
            audio_format = await self._ensure_task_audio_format(task.task_key, all_files)
            if audio_format:
                return audio_format

            progress = await task_manager.get_progress(task.task_key)
            if progress and progress.upload_completed:
                if (
                    progress.completion_deadline_at is not None
                    and time.time() >= progress.completion_deadline_at
                ):
                    await task_manager.fail_task(task.task_key, "finish 后未找到可用音频分片")
                    return None
            elif time.time() - started_at >= asr_time_config.NO_NEW_FILE_TIMEOUT:
                return None
            await asyncio.sleep(asr_time_config.POLL_INTERVAL)

    async def _monitor_opus_task(self, task: AsrMonitoringTask) -> None:
        """Opus: recording only stores shards; finish triggers one full rebuild."""
        task_manager = AsrMergeTaskManager.instance()
        await task_manager.ensure_opus_finish_deadline(task.task_key)
        while True:
            self.merge_operations.update_agent_activity(f"Opus轮询: {task.task_key}")
            all_files, terminal = await self._scan_files_for_format(task, "opus")
            if terminal:
                return
            if await self.opus_finish_processor.process(task, all_files):
                return
            await asyncio.sleep(asr_time_config.POLL_INTERVAL)

    async def _monitor_wav_task(self, task: AsrMonitoringTask) -> None:
        """WAV: keep the existing recording-time incremental merge strategy."""
        task_manager = AsrMergeTaskManager.instance()
        last_new_file_time = time.time()
        last_indices: set[int] = set()
        is_first_run = True

        while True:
            self.merge_operations.update_agent_activity(f"WAV轮询: {task.task_key}")
            all_files, terminal = await self._scan_files_for_format(task, "wav")
            if terminal:
                return

            progress = await task_manager.get_progress(task.task_key)
            finish_ready = True
            if progress and progress.upload_completed:
                ready, terminal_failed = await task_manager.update_finish_shard_stability(
                    task.task_key, all_files
                )
                if terminal_failed:
                    return
                finish_ready = ready

            if finish_ready and await task_manager.check_should_complete(
                task.task_key, task.source_dir, len(all_files)
            ):
                await self.task_finalizer.complete_task(task.task_key, task.source_dir)
                return

            current_indices = {index for index, _ in all_files}
            idle_time = time.time() - last_new_file_time
            if idle_time >= asr_time_config.NO_NEW_FILE_TIMEOUT:
                progress = await task_manager.get_progress(task.task_key)
                if (
                    progress
                    and progress.upload_completed
                    and progress.completion_deadline_at is not None
                    and time.time() < progress.completion_deadline_at
                ):
                    await asyncio.sleep(asr_time_config.POLL_INTERVAL)
                    continue
                return

            if not all_files or current_indices == last_indices:
                await asyncio.sleep(asr_time_config.POLL_INTERVAL)
                continue

            if await self._process_new_files(
                task, all_files, current_indices, is_first_run, "wav"
            ):
                return
            is_first_run = False
            last_new_file_time = time.time()
            last_indices = current_indices
            await asyncio.sleep(asr_time_config.POLL_INTERVAL)

    async def _scan_files_for_format(
        self, task: AsrMonitoringTask, audio_format: str
    ) -> tuple[list[tuple[int, Path]], bool]:
        all_files, conflicts = await asyncio.to_thread(
            self.file_detector.scan_audio_files_with_conflicts,
            task.source_dir,
            False,
        )
        if conflicts:
            terminal = await self._handle_format_conflicts(task, conflicts)
            return [], terminal

        task_state = await AsrMergeTaskManager.instance().get_task(task.task_key)
        if not task_state or task_state.status in {
            AsrTaskStatus.ERROR.value,
            AsrTaskStatus.CANCELED.value,
        }:
            return [], True

        deduplicated = AsrFileDetector.deduplicate_files(all_files)
        return AsrFileDetector.filter_by_format(deduplicated, audio_format), False

    async def _handle_format_conflicts(
        self, task: AsrMonitoringTask, conflicts: list[dict]
    ) -> bool:
        if not conflicts:
            return False
        task_manager = AsrMergeTaskManager.instance()
        message = self._format_conflict_message(conflicts)
        progress = await task_manager.get_progress(task.task_key)
        if progress and progress.upload_completed:
            await task_manager.set_audio_format_error(task.task_key, message)
            await task_manager.fail_task(task.task_key, message)
            return True
        logger.warning(f"{self.LOG_PREFIX} ⚠️ task_key={task.task_key} {message}")
        return False

    @staticmethod
    def _format_conflict_message(conflicts: list[dict]) -> str:
        details = []
        for conflict in conflicts:
            names = ", ".join(path.name for path in conflict.get("files", []))
            if conflict.get("type") == "mixed_format":
                details.append(f"mixed_format={','.join(conflict.get('formats', []))}: {names}")
            else:
                details.append(f"index={conflict.get('index')}: {names}")
        return "audio format conflict (" + "; ".join(details) + ")"

    async def _ensure_task_audio_format(self, task_key: str, all_files: list) -> str | None:
        """
        确定任务音频格式（任务级钉住：首次扫描到分片时确定并持久化，之后不再变更）

        Args:
            task_key: 任务标识
            all_files: 本轮扫描到的分片列表 [(index, path), ...]

        Returns:
            str | None: 任务音频格式（wav/opus）；尚未有任何分片时返回 None
        """
        task_manager = AsrMergeTaskManager.instance()

        task_state = await task_manager.get_task(task_key)
        if task_state and task_state.audio_format:
            try:
                return validate_audio_format_for_write(task_state.audio_format)
            except ValueError as exc:
                progress = await task_manager.get_progress(task_key)
                if progress and progress.upload_completed:
                    await task_manager.set_audio_format_error(task_key, str(exc))
                return None

        detected = AsrFileDetector.detect_audio_format(all_files)
        if detected is None:
            return None

        candidate_path = min(all_files, key=lambda item: item[0])[1]
        valid, reason = await self.file_detector.validate_audio_file(candidate_path, detected)
        if not valid:
            progress = await task_manager.get_progress(task_key)
            if progress and progress.upload_completed:
                await task_manager.set_audio_format_error(task_key, reason)
            logger.error(
                f"{self.LOG_PREFIX} ❌ task_key={task_key} 首片音频格式校验失败: "
                f"file={candidate_path.name}, reason={reason}"
            )
            return None

        await task_manager.set_audio_format(task_key, detected)
        logger.info(f"{self.LOG_PREFIX} 🎵 task_key={task_key} 检测到音频分片格式: {detected}")
        return detected

    async def _process_new_files(
        self, task: AsrMonitoringTask, all_files: list, current_indices: set, is_first_run: bool,
        audio_format: str | None
    ) -> bool:
        """
        处理新文件：准备合并、执行合并、检查完成

        Returns:
            bool: 是否触发了任务完成
        """
        # 准备合并文件
        local_file_paths, local_merged_temp_input, use_incremental = await self.merge_operations.prepare_merge_files(
            task.task_key, task.source_dir, all_files, is_first_run, audio_format
        )

        if not local_file_paths:
            return False

        # 执行合并事务
        completed = await self.merge_operations.execute_merge_transaction(
            task.task_key,
            task.source_dir,
            local_file_paths,
            local_merged_temp_input,
            use_incremental,
            current_indices,
            len(all_files),
            audio_format,
        )

        # 如果标记为完成，触发完成流程
        if completed:
            await self.task_finalizer.complete_task(task.task_key, task.source_dir)
            return True

        return False

    async def start_monitoring_task(self, task_key: str, source_dir: str, workspace_dir: str = ".workspace") -> bool:
        """
        开始监听任务

        Args:
            task_key: 任务标识
            source_dir: 源目录
            workspace_dir: 工作区目录

        Returns:
            bool: 是否启动成功
        """
        async with self.start_lock:
            try:
                if task_key in self.tasks:
                    existing_task = self.tasks[task_key]
                    if existing_task.asyncio_task and not existing_task.asyncio_task.done():
                        logger.warning(f"{self.LOG_PREFIX} 任务 {task_key} 已在运行中")
                        return True
                    else:
                        logger.info(f"{self.LOG_PREFIX} 🔄 任务 {task_key} 已停止，清理旧记录并重启")
                        del self.tasks[task_key]

                source_path = resolve_path(source_dir, workspace_dir)

                dir_existed = await asyncio.to_thread(source_path.exists)
                await asyncio.to_thread(source_path.mkdir, parents=True, exist_ok=True)
                if not dir_existed:
                    logger.info(f"{self.LOG_PREFIX} 创建源目录: {source_path}")

                monitoring_task = AsrMonitoringTask(task_key=task_key, source_dir=source_path)

                self.tasks[task_key] = monitoring_task

                task_manager = AsrMergeTaskManager.instance()
                await task_manager.recover_interrupted_opus_merge(task_key)
                await task_manager.start_monitoring(task_key)

                asyncio_task = asyncio.create_task(self._monitor_and_merge(monitoring_task))
                monitoring_task.asyncio_task = asyncio_task

                logger.info(f"{self.LOG_PREFIX} ✅ 启动ASR监听任务: {task_key}")
                return True

            except Exception as e:
                logger.error(f"{self.LOG_PREFIX} ❌ task_key={task_key} 启动监听任务失败: {e}")
                logger.error(f"{self.LOG_PREFIX} task_key={task_key} 堆栈信息:\n{traceback.format_exc()}")
                if task_key in self.tasks:
                    del self.tasks[task_key]
                await AsrMergeTaskManager.instance().fail_task(task_key, f"启动失败: {e!s}")
                return False

    async def cancel_task(self, task_key: str, workspace_dir: str = ".workspace") -> bool:
        """
        取消 ASR 录音任务

        Args:
            task_key: 任务标识
            workspace_dir: 工作区目录

        Returns:
            bool: 是否取消成功
        """
        try:
            logger.info(f"{self.LOG_PREFIX} 🔄 task_key={task_key} 开始取消任务")

            task_state = await AsrMergeTaskManager.instance().get_task(task_key)

            if not task_state:
                logger.warning(f"{self.LOG_PREFIX} 任务不存在: {task_key}")
                return False

            # 检查任务状态
            completed_statuses = [AsrTaskStatus.COMPLETED.value, AsrTaskStatus.FINISHED.value]

            if task_state.status in completed_statuses:
                logger.warning(f"{self.LOG_PREFIX} 任务已完成，不允许取消: {task_key}, status={task_state.status}")
                return False

            # 检查是否已经是 canceled 状态
            already_canceled = task_state.status == AsrTaskStatus.CANCELED.value

            if already_canceled:
                logger.info(f"{self.LOG_PREFIX} 任务已处于 canceled 状态: {task_key}，仍会执行清理操作（幂等性）")
            else:
                # 1. 取消并等待后台轮询任务
                async with self.start_lock:
                    task = self.tasks.get(task_key)
                    if task and task.asyncio_task:
                        task.asyncio_task.cancel()
                        logger.info(f"{self.LOG_PREFIX} 🛑 已发送取消信号: {task_key}")
                        try:
                            await task.asyncio_task
                        except asyncio.CancelledError:
                            logger.info(f"{self.LOG_PREFIX} ✅ 后台轮询任务已停止: {task_key}")
                        except Exception as e:
                            logger.warning(f"{self.LOG_PREFIX} 取消后台任务时出错: {e}")

                    # 2. 从任务列表移除
                    if task_key in self.tasks:
                        del self.tasks[task_key]
                        logger.info(f"{self.LOG_PREFIX} 🗑️ 已从任务列表移除: {task_key}")

                # 3. 更新任务状态为 canceled
                await AsrMergeTaskManager.instance().cancel_task(task_key, "User canceled")
                logger.info(f"{self.LOG_PREFIX} ✅ 任务状态已更新为 canceled: {task_key}")

            # 4. 异步清理资源
            asyncio.create_task(
                self.task_finalizer.cleanup_canceled_task_resources(task_key, workspace_dir, task_state)
            )
            logger.info(f"{self.LOG_PREFIX} 🧹 已启动异步清理任务: {task_key}")

            logger.info(f"{self.LOG_PREFIX} ✅ task_key={task_key} 任务取消成功")
            return True

        except Exception as e:
            logger.error(f"{self.LOG_PREFIX} ❌ task_key={task_key} 取消任务失败: {e}")
            logger.error(f"{self.LOG_PREFIX} task_key={task_key} 堆栈信息:\n{traceback.format_exc()}")
            return False

    @classmethod
    @lru_cache
    def instance(cls) -> "AsrMergeService":
        """获取ASR合并服务单例（懒加载）"""
        return cls()
