"""
ASR 音频合并服务（精简版）

核心职责：任务调度和轮询管理
业务逻辑：委托给专门的业务类处理
"""

import asyncio
import time
import traceback
from functools import lru_cache
from typing import Dict

from loguru import logger

from app.service.asr.asr_file_detector import AsrFileDetector
from app.service.asr.asr_merge_operations import AsrMergeOperations
from app.service.asr.asr_task_finalizer import AsrTaskFinalizer
from app.service.asr.asr_monitoring_task import AsrMonitoringTask
from app.service.asr.asr_utils import check_ffmpeg_installed, log_ffmpeg_warning, resolve_path
from app.service.asr.asr_merge_task_manager import AsrMergeTaskManager, AsrTaskStatus
from app.service.asr.asr_time_config import asr_time_config
from app.service.asr.asr_base import AsrServiceBase


class AsrMergeService(AsrServiceBase):
    """
    ASR音频合并服务 - 核心调度器

    职责：
    - 管理任务生命周期（启动、停止、取消）
    - 轮询监听音频文件目录
    - 协调各业务模块完成任务

    委托业务：
    - AsrMergeOperations: 合并操作、准备文件、执行事务
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
        self.merge_operations = AsrMergeOperations(self.file_detector)
        self.task_finalizer = AsrTaskFinalizer(self.merge_operations)

        logger.info(f"{self.LOG_PREFIX} 🎙️ ASR音频合并服务初始化完成 (简化版,只支持 WAV)")

    async def _monitor_and_merge(self, task: AsrMonitoringTask) -> None:
        """
        轮询目录并全量合并 WAV 文件

        这是核心调度循环，负责：
        1. 扫描文件
        2. 检查完成条件
        3. 触发合并操作
        4. 触发任务完成
        """
        logger.info(
            f"{self.LOG_PREFIX} 🔍 task_key={task.task_key} "
            f"开始轮询目录: {task.source_dir} (每{asr_time_config.POLL_INTERVAL}秒)"
        )

        await asyncio.sleep(asr_time_config.INITIAL_DELAY)

        last_new_file_time = time.time()
        last_indices = set()
        is_first_run = True

        # 获取任务管理器单例
        task_manager = AsrMergeTaskManager.instance()

        try:
            while True:
                # 0. 更新活跃时间，防止沙箱因超时被杀 (agent_idle_timeout default 20min)
                self.merge_operations.update_agent_activity(f"ASR轮询: {task.task_key}")

                # 1. 扫描所有 WAV 文件
                all_files = await asyncio.to_thread(
                    self.file_detector.scan_audio_files, task.source_dir, include_merged=False
                )

                # 2. 检查是否应该完成任务
                if await task_manager.check_should_complete(task.task_key, task.source_dir, len(all_files)):
                    await self.task_finalizer.complete_task(task.task_key, task.source_dir)
                    break

                # 3. 检查超时
                idle_time = time.time() - last_new_file_time
                if idle_time >= asr_time_config.NO_NEW_FILE_TIMEOUT:
                    # 再次检查是否应该完成任务（边缘情况）
                    if await task_manager.check_should_complete(task.task_key, task.source_dir, len(all_files)):
                        await self.task_finalizer.complete_task(task.task_key, task.source_dir)
                        break

                    # 若已 finish 且尚未到 completion_deadline_at，不因“无新文件超时”提前退出。
                    progress = await task_manager.get_progress(task.task_key)
                    now_ts = time.time()
                    if (
                        progress
                        and progress.upload_completed
                        and progress.completion_deadline_at is not None
                        and now_ts < progress.completion_deadline_at
                    ):
                        remaining = int(progress.completion_deadline_at - now_ts)
                        logger.info(
                            f"{self.LOG_PREFIX} ⏳ task_key={task.task_key} "
                            f"无新文件超时但未到 completion_deadline_at，继续轮询: 剩余{remaining}s"
                        )
                        await asyncio.sleep(asr_time_config.POLL_INTERVAL)
                        continue

                    logger.info(
                        f"{self.LOG_PREFIX} ⏰ task_key={task.task_key} "
                        f"{asr_time_config.NO_NEW_FILE_TIMEOUT}秒无新文件，退出轮询"
                    )
                    break

                if not all_files:
                    logger.debug(
                        f"{self.LOG_PREFIX} ⏳ task_key={task.task_key} "
                        f"无文件 ({int(idle_time)}秒/{asr_time_config.NO_NEW_FILE_TIMEOUT}秒)"
                    )
                    await asyncio.sleep(asr_time_config.POLL_INTERVAL)
                    continue

                # 4. 检测是否有新文件
                current_indices = {idx for idx, _ in all_files}
                if current_indices == last_indices:
                    logger.debug(
                        f"{self.LOG_PREFIX} ⏳ task_key={task.task_key} "
                        f"无新文件 ({int(idle_time)}秒/{asr_time_config.NO_NEW_FILE_TIMEOUT}秒)"
                    )
                    await asyncio.sleep(asr_time_config.POLL_INTERVAL)
                    continue

                # 5. 有新文件，处理合并
                completed = await self._process_new_files(task, all_files, current_indices, is_first_run)

                if completed:
                    break

                # 重置状态
                if is_first_run:
                    is_first_run = False
                last_new_file_time = time.time()
                last_indices = current_indices

                # 等待下一次轮询
                await asyncio.sleep(asr_time_config.POLL_INTERVAL)

        except Exception as e:
            logger.error(f"{self.LOG_PREFIX} ❌ task_key={task.task_key} 监听和合并过程出错: {e}")
            logger.error(f"{self.LOG_PREFIX} task_key={task.task_key} 堆栈信息:\n{traceback.format_exc()}")
            await AsrMergeTaskManager.instance().fail_task(task.task_key, f"监听失败: {str(e)}")
        finally:
            logger.info(f"{self.LOG_PREFIX} 🛑 task_key={task.task_key} 停止轮询目录: {task.source_dir}")

    async def _process_new_files(
        self, task: AsrMonitoringTask, all_files: list, current_indices: set, is_first_run: bool
    ) -> bool:
        """
        处理新文件：准备合并、执行合并、检查完成

        Returns:
            bool: 是否触发了任务完成
        """
        # 准备合并文件
        local_file_paths, local_merged_temp_input, use_incremental = await self.merge_operations.prepare_merge_files(
            task.task_key, task.source_dir, all_files, is_first_run
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

                await AsrMergeTaskManager.instance().start_monitoring(task_key)

                asyncio_task = asyncio.create_task(self._monitor_and_merge(monitoring_task))
                monitoring_task.asyncio_task = asyncio_task

                logger.info(f"{self.LOG_PREFIX} ✅ 启动ASR监听任务: {task_key}")
                return True

            except Exception as e:
                logger.error(f"{self.LOG_PREFIX} ❌ task_key={task_key} 启动监听任务失败: {e}")
                logger.error(f"{self.LOG_PREFIX} task_key={task_key} 堆栈信息:\n{traceback.format_exc()}")
                if task_key in self.tasks:
                    del self.tasks[task_key]
                await AsrMergeTaskManager.instance().fail_task(task_key, f"启动失败: {str(e)}")
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
