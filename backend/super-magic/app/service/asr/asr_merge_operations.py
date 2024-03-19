"""
ASR 核心合并操作模块

负责音频文件的合并、重命名、remux 等核心操作
包含 FFmpeg 相关的所有底层操作
"""

import asyncio
import re
import shutil
import traceback
from pathlib import Path
from typing import List
from uuid import uuid4

from loguru import logger

from app.service.asr.asr_file_detector import AsrFileDetector
from app.service.asr.asr_time_config import asr_time_config
from app.service.asr.asr_size_config import asr_size_config
from app.service.asr.asr_base import AsrServiceBase
from app.service.asr.asr_local_proxy import AsrLocalWorkspaceProxy
from app.service.asr.asr_merge_task_manager import AsrMergeTaskManager


class AsrMergeOperations(AsrServiceBase):
    """ASR 合并操作类 - 简化版,只支持 WAV 格式"""

    def __init__(self, file_detector: AsrFileDetector):
        """
        初始化合并操作

        Args:
            file_detector: 文件检测器实例
        """
        self.file_detector = file_detector
        self._concat_locks = {}  # 合并操作锁

        logger.info(
            f"{self.LOG_PREFIX} ⚙️ 网络文件系统优化已启用 "
            f"(超时={asr_time_config.FILE_READY_TIMEOUT}s, 初始间隔={asr_time_config.FILE_READY_WAIT_INTERVAL}s)"
        )

    def get_concat_lock(self, task_key: str) -> asyncio.Lock:
        """获取指定 task_key 的 concat 操作锁"""
        lock = self._concat_locks.get(task_key)
        if lock is None:
            lock = asyncio.Lock()
            self._concat_locks[task_key] = lock
        return lock

    @staticmethod
    def update_agent_activity(operation: str = "ASR音频合并") -> None:
        """更新agent活动时间，保持沙箱存活"""
        try:
            # 延迟导入，避免循环导入问题
            from app.service.agent_dispatcher import AgentDispatcher

            dispatcher = AgentDispatcher.get_instance()
            if dispatcher and dispatcher.agent_context:
                dispatcher.agent_context.update_activity_time()
                logger.debug(f"{AsrMergeOperations.LOG_PREFIX} 已重置 agent idle 时间 - {operation}")
        except Exception as e:
            logger.warning(f"{AsrMergeOperations.LOG_PREFIX} ⚠️ 更新 agent 活动时间失败: {e}")

    async def safe_rename_file(
        self, source: Path, target: Path, operation_name: str = "重命名", max_retries: int = 2
    ) -> bool:
        """安全地重命名/移动文件，支持 fallback 和重试"""
        for attempt in range(max_retries):
            success = await self._try_rename_once(source, target, operation_name, attempt)
            if success:
                return True

            if attempt < max_retries - 1:
                await asyncio.sleep(asr_time_config.OPERATION_RETRY_WAIT)

        logger.error(
            f"{self.LOG_PREFIX} ❌ {operation_name}最终失败 (已重试 {max_retries} 次): {source.name} -> {target.name}"
        )
        return False

    async def _try_rename_once(self, source: Path, target: Path, operation_name: str, attempt: int) -> bool:
        try:
            await asyncio.to_thread(source.rename, target)
            if attempt > 0:
                logger.info(f"{self.LOG_PREFIX} ✅ {operation_name}成功 (第 {attempt + 1} 次尝试)")
            return True
        except OSError as e:
            return await self._handle_rename_error(source, target, operation_name, attempt, e)
        except Exception as e:
            logger.error(f"{self.LOG_PREFIX} ❌ {operation_name}遇到未预期异常: {e}")
            logger.error(f"{self.LOG_PREFIX} 堆栈信息:\n{traceback.format_exc()}")
            return False

    async def _handle_rename_error(
        self, source: Path, target: Path, operation_name: str, attempt: int, error: OSError
    ) -> bool:
        error_code = error.errno if hasattr(error, "errno") else "N/A"
        logger.warning(
            f"{self.LOG_PREFIX} ⚠️ {operation_name} rename 失败 (attempt {attempt + 1}): {error}, 错误码={error_code}"
        )

        # 尝试使用 shutil.move 作为 fallback
        try:
            await asyncio.to_thread(shutil.move, str(source), str(target))
            logger.info(f"{self.LOG_PREFIX} ✅ {operation_name}成功 (shutil.move fallback)")
            return True
        except Exception as move_error:
            logger.warning(f"{self.LOG_PREFIX} ⚠️ {operation_name} shutil.move 失败: {move_error}")
            return False

    async def concat_group_files(
        self, task_key: str, group_files: List[Path], output_path: Path, operation_name: str = "合并"
    ) -> bool:
        """使用ffmpeg concat合并多个 WAV 文件"""
        async with self.get_concat_lock(task_key):
            return await self._run_concat_task(task_key, group_files, output_path, operation_name)

    async def _run_concat_task(
        self, task_key: str, group_files: List[Path], output_path: Path, operation_name: str
    ) -> bool:
        if not group_files:
            logger.warning(f"{self.LOG_PREFIX} ⚠️ task_key={task_key} 没有文件需要{operation_name}")
            return False

        if len(group_files) == 1:
            return await self._handle_single_file(group_files[0], output_path, operation_name)

        # 直接合并所有文件，不再进行分批
        # 之前的分批逻辑会导致日志和行为不一致，且 ffmpeg concat list 模式本身支持大量文件
        return await self._execute_concat_with_retry(task_key, group_files, output_path, operation_name)

    async def _handle_single_file(self, source: Path, target: Path, operation_name: str) -> bool:
        if source != target:
            logger.info(
                f"{self.LOG_PREFIX} ✅ {operation_name}: 只有1个文件，直接重命名 "
                f"[源文件: {source.name}, 目标文件: {target.name}]"
            )
            await asyncio.to_thread(source.rename, target)
        else:
            logger.info(f"{self.LOG_PREFIX} ✅ {operation_name}: 只有1个文件且已是目标文件 [{target.name}]")
        return True

    async def _execute_concat_with_retry(
        self, task_key: str, group_files: List[Path], output_path: Path, operation_name: str, max_retries: int = 1
    ) -> bool:
        for attempt in range(max_retries + 1):
            if attempt > 0:
                logger.info(f"{self.LOG_PREFIX} 🔄 task_key={task_key} {operation_name} 重试第 {attempt} 次")
                await asyncio.sleep(asr_time_config.OPERATION_RETRY_WAIT)

            if await self._do_ffmpeg_concat(task_key, group_files, output_path, operation_name):
                return True

        logger.error(f"{self.LOG_PREFIX} ❌ {operation_name} 失败（已重试 {max_retries} 次）")
        return False

    async def _do_ffmpeg_concat(
        self, task_key: str, group_files: List[Path], output_path: Path, operation_name: str
    ) -> bool:
        """执行 ffmpeg concat 操作"""
        # 准备临时文件路径
        operation_slug = re.sub(r"[^0-9A-Za-z]+", "_", operation_name).strip("_") or "concat"
        unique_token = uuid4().hex
        temp_output = output_path.parent / (
            f".concat_temp_{operation_slug}_{unique_token}_{output_path.stem}{output_path.suffix}"
        )
        concat_list_file = output_path.parent / f".concat_list_{task_key}_{operation_slug}_{unique_token}.txt"

        try:
            # 1. 验证文件
            valid_files, expected_size = await self._validate_source_files(task_key, group_files, operation_name)
            if not valid_files:
                return False

            # 2. 生成列表文件
            await self._create_concat_list_file(valid_files, concat_list_file)

            logger.info(
                f"{self.LOG_PREFIX} 🔄 task_key={task_key} {operation_name}: 合并 {len(valid_files)} 个有效文件 "
                f"[源文件: {[f.name for f in valid_files]}, 目标文件: {output_path.name}]"
            )

            # 3. 执行 FFmpeg
            if not await self._run_ffmpeg_process(concat_list_file, temp_output, operation_name):
                return False

            # 4. 验证并替换结果
            return await self._finalize_concat_result(
                temp_output, output_path, operation_name, len(valid_files), expected_size
            )

        except Exception as e:
            logger.error(f"{self.LOG_PREFIX} ❌ {operation_name} concat异常: {e}")
            logger.error(f"{self.LOG_PREFIX} 堆栈信息:\n{traceback.format_exc()}")
            return False
        finally:
            # 清理 concat_list_file，但保留 temp_output 以便重试（如果 finalize 失败）
            await asyncio.to_thread(concat_list_file.unlink, missing_ok=True)

    async def _validate_source_files(
        self, task_key: str, group_files: List[Path], operation_name: str
    ) -> tuple[List[Path], int]:
        """验证并过滤有效的源文件，返回有效文件列表和预期总大小"""
        valid_files = []
        invalid_files = []

        sem = asyncio.Semaphore(50)  # 限制并发检查数，避免打开过多文件

        # 并发检查文件
        async def check_file(f: Path):
            async with sem:
                is_ready, reason = await self.wait_for_file_ready(
                    f,
                    min_size=asr_size_config.AUDIO_FILE_MIN_SIZE,
                    retries=asr_time_config.FILE_READY_RETRIES,
                    wait_interval=asr_time_config.FILE_READY_WAIT_INTERVAL,
                    timeout=asr_time_config.FILE_READY_TIMEOUT,
                )
                return f, is_ready, reason

        results = await asyncio.gather(*[check_file(f) for f in group_files])

        for f, file_ready, ready_reason in results:
            if file_ready:
                valid_files.append(f)
            else:
                invalid_files.append((f.name, ready_reason))

        self._log_validation_results(task_key, operation_name, len(group_files), valid_files, invalid_files)

        if not valid_files:
            logger.error(
                f"{self.LOG_PREFIX} ❌ task_key={task_key} {operation_name}: "
                f"没有有效的源文件可供合并（共检查了 {len(group_files)} 个文件）"
            )
            return [], 0

        # 预期输出大小 = 有效输入文件大小总和（用于后续 80% 校验）
        try:
            expected_size = sum(
                await asyncio.gather(*[asyncio.to_thread(lambda p=f: p.stat().st_size) for f in valid_files])
            )
        except Exception as e:
            logger.warning(f"{self.LOG_PREFIX} ⚠️ 获取源文件大小失败，使用 0 作为预期大小: {e}")
            expected_size = 0

        return valid_files, expected_size

    def _log_validation_results(self, task_key, operation_name, total_count, valid_files, invalid_files):
        if invalid_files:
            logger.warning(
                f"{self.LOG_PREFIX} ⚠️ task_key={task_key} {operation_name}: "
                f"发现 {len(invalid_files)} 个无效文件，将被跳过："
            )
            for fname, reason in invalid_files:
                logger.warning(f"{self.LOG_PREFIX}   - {fname}: {reason}")

        if len(valid_files) < total_count:
            logger.warning(
                f"{self.LOG_PREFIX} ⚠️ task_key={task_key} {operation_name}: "
                f"仅 {len(valid_files)}/{total_count} 个文件有效，继续合并"
            )

    @staticmethod
    async def _create_concat_list_file(valid_files: List[Path], list_file: Path):
        """创建 ffmpeg concat 列表文件"""
        concat_lines = [f"file '{f.absolute()}'" for f in valid_files]
        await asyncio.to_thread(list_file.write_text, "\n".join(concat_lines), encoding="utf-8")

    async def _run_ffmpeg_process(self, list_file: Path, temp_output: Path, operation_name: str) -> bool:
        """执行 FFmpeg 进程"""
        cmd = [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-fflags",
            "+genpts",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(list_file),
            "-c",
            "copy",
            "-avoid_negative_ts",
            "make_zero",
            "-reset_timestamps",
            "1",
            str(temp_output),
        ]

        process = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )

        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=asr_time_config.FFMPEG_TIMEOUT)
        except asyncio.TimeoutError:
            logger.error(f"{self.LOG_PREFIX} ❌ {operation_name} 超时")
            self._kill_process(process)
            return False

        if process.returncode != 0:
            stderr_text = stderr.decode("utf-8", errors="ignore")
            logger.error(f"{self.LOG_PREFIX} ❌ {operation_name} concat失败: {stderr_text}")
            return False

        return True

    def _kill_process(self, process):
        try:
            process.kill()
        except Exception as e:
            logger.error(f"{self.LOG_PREFIX} ⚠️ 终止进程异常: {e}")

    async def _finalize_concat_result(
        self, temp_output: Path, output_path: Path, operation_name: str, source_count: int, expected_size: int
    ) -> bool:
        """验证临时文件，移动到目标路径，并再次验证"""

        if (
            not await asyncio.to_thread(temp_output.exists)
            or await asyncio.to_thread(lambda: temp_output.stat().st_size) == 0
        ):
            logger.error(f"{self.LOG_PREFIX} ❌ {operation_name}输出文件无效")
            return False

        # 1. 验证临时输出文件
        is_ready, reason = await self.wait_for_file_ready(
            temp_output,
            min_size=asr_size_config.MERGED_OUTPUT_MIN_SIZE,
            expected_size=expected_size or None,
            retries=asr_time_config.MERGED_FILE_READY_RETRIES,
            wait_interval=asr_time_config.FILE_READY_WAIT_INTERVAL,
            timeout=asr_time_config.FILE_READY_TIMEOUT,
        )

        if not is_ready:
            logger.error(
                f"{self.LOG_PREFIX} ❌ {operation_name}临时输出文件不可用: {reason}，"
                f"跳过 replace 操作以避免损坏目标文件"
            )
            return False

        # 2. 替换目标文件
        await asyncio.to_thread(temp_output.replace, output_path)

        # 3. 等待同步
        await asyncio.sleep(asr_time_config.OPERATION_RETRY_WAIT)

        # 4. 验证目标文件
        return await self._verify_final_output(output_path, operation_name, source_count, expected_size)

    async def _verify_final_output(
        self, output_path: Path, operation_name: str, source_count: int, expected_size: int
    ) -> bool:
        is_ready, reason = await self.wait_for_file_ready(
            output_path,
            min_size=asr_size_config.MERGED_OUTPUT_MIN_SIZE,
            expected_size=expected_size or None,
            retries=asr_time_config.MERGED_FILE_READY_RETRIES,
            wait_interval=asr_time_config.FILE_READY_WAIT_INTERVAL,
            timeout=asr_time_config.FILE_READY_TIMEOUT,
        )

        if not is_ready:
            logger.error(f"{self.LOG_PREFIX} ❌ {operation_name}目标文件不可用: {reason}，replace 操作可能未完全同步")
            return False

        file_size_kb = (await asyncio.to_thread(lambda: output_path.stat().st_size)) / 1024
        logger.info(
            f"{self.LOG_PREFIX} ✅ {operation_name}成功: {source_count} 个文件 -> "
            f"{output_path.name} ({file_size_kb:.1f}KB)"
        )
        return True

    async def cleanup_temp_files(self, source_dir: Path, audio_format: str) -> None:
        """清理目录中的临时文件"""
        cleanup_patterns = [
            f".remux_*.{audio_format}",
            f".consolidate_temp.{audio_format}",
            f".concat_temp_*",
            ".concat_list_*.txt",
        ]

        cleaned_count = 0
        for pattern in cleanup_patterns:
            cleaned_count += await self._cleanup_files_by_pattern(source_dir, pattern)

        if cleaned_count > 0:
            logger.info(f"{self.LOG_PREFIX} ✅ 清理了 {cleaned_count} 个残留临时文件")

    async def _cleanup_files_by_pattern(self, source_dir: Path, pattern: str) -> int:
        count = 0
        try:
            files = await asyncio.to_thread(lambda: list(source_dir.glob(pattern)))
            for temp_file in files:
                try:
                    await asyncio.to_thread(temp_file.unlink, missing_ok=True)
                    count += 1
                    logger.debug(f"{self.LOG_PREFIX} 🧹 清理临时文件: {temp_file.name}")
                except Exception as e:
                    logger.warning(f"{self.LOG_PREFIX} ⚠️ 清理临时文件失败: {temp_file.name}, {e}")
        except Exception as e:
            logger.warning(f"{self.LOG_PREFIX} ⚠️ 遍历临时文件失败: {pattern}, {e}")
        return count

    async def cleanup_invalid_files(self, source_dir: Path, invalid_files: List[Path]) -> int:
        """清理无效的音频文件"""
        invalid_dir = source_dir / ".invalid_files"

        if invalid_files and not await self._ensure_dir_exists(invalid_dir):
            return 0

        cleaned_count = 0
        for file_path in invalid_files:
            if await self._move_to_invalid_dir(file_path, source_dir, invalid_dir):
                cleaned_count += 1

        if cleaned_count > 0:
            logger.info(f"{self.LOG_PREFIX} ✅ 清理了 {cleaned_count} 个无效音频文件")

        return cleaned_count

    async def _ensure_dir_exists(self, directory: Path) -> bool:
        if directory.exists():
            return True
        try:
            await asyncio.to_thread(directory.mkdir, exist_ok=True)
            return True
        except Exception as e:
            logger.warning(f"{self.LOG_PREFIX} ⚠️ 创建无效文件目录失败: {e}")
            return False

    async def _move_to_invalid_dir(self, file_path: Path, source_dir: Path, invalid_dir: Path) -> bool:
        try:
            if await asyncio.to_thread(file_path.exists) and file_path.parent == source_dir:
                target_path = invalid_dir / file_path.name
                await asyncio.to_thread(shutil.move, str(file_path), str(target_path))
                logger.info(f"{self.LOG_PREFIX} 🗑️ 已移动无效文件: {file_path.name} -> .invalid_files/")
                return True
        except Exception as e:
            logger.warning(f"{self.LOG_PREFIX} ⚠️ 移动无效文件失败: {file_path.name}, {e}")
        return False

    async def get_audio_duration(self, audio_file: Path) -> int:
        """
        获取音频时长（使用 ffprobe）

        Args:
            audio_file: 音频文件路径

        Returns:
            int: 时长（秒），获取失败返回0
        """
        try:
            process = await asyncio.create_subprocess_exec(
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(audio_file),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await asyncio.wait_for(process.communicate(), timeout=asr_time_config.FFPROBE_TIMEOUT)

            if process.returncode == 0 and stdout:
                duration_str = stdout.decode().strip()
                if duration_str:
                    return round(float(duration_str))
        except Exception as e:
            logger.debug(f"{self.LOG_PREFIX} 无法获取音频时长: {e}")

        return 0

    async def prepare_merge_files(
        self, task_key: str, source_dir: Path, all_files: list, is_first_run: bool = False
    ) -> tuple[list[Path], Path | None, bool]:
        """
        准备合并所需的文件

        策略（以 Remote 为准，优先复用本地缓存）：
        1. 验证并同步 Remote 的检查点（merged.wav + metadata.json）
        2. 根据检查点有效性决定增量或全量
        3. 同步需要的源文件
        4. 准备合并输入

        Args:
            task_key: 任务标识
            source_dir: 源目录路径
            all_files: 所有文件列表 [(index, path), ...]
            is_first_run: 是否首次运行

        Returns:
            tuple: (本地文件路径列表, 临时合并输入文件, 是否增量合并)
        """
        proxy = AsrLocalWorkspaceProxy(task_key, source_dir)
        local_merged_path = proxy.get_local_path(self.MERGED_WAV_FILENAME)

        # 1. 验证并同步检查点
        checkpoint_valid, last_merged_index = await proxy.validate_and_sync_checkpoint(is_first_run=is_first_run)

        # 2. 根据检查点决定同步哪些源文件
        files_to_sync = []

        if checkpoint_valid and last_merged_index >= 0:
            # 增量同步：只同步新文件
            new_files_indices = [idx for idx, _ in all_files if idx > last_merged_index]
            if new_files_indices:
                files_to_sync = [remote_path.name for idx, remote_path in all_files if idx > last_merged_index]
                logger.info(
                    f"{self.LOG_PREFIX} 📥 task_key={task_key} "
                    f"增量同步模式：last_index={last_merged_index}, "
                    f"需要同步 {len(files_to_sync)} 个新文件 (索引范围: {min(new_files_indices)}-{max(new_files_indices)})"
                )
            else:
                current_max_index = max([idx for idx, _ in all_files]) if all_files else -1
                logger.info(
                    f"{self.LOG_PREFIX} 📥 task_key={task_key} "
                    f"无需同步新文件：last_index={last_merged_index}, "
                    f"当前最大索引={current_max_index}, 所有文件已合并"
                )
        else:
            # 全量同步：同步所有源文件
            files_to_sync = [remote_path.name for _, remote_path in all_files]
            index_range = (
                f"{min([idx for idx, _ in all_files])}-{max([idx for idx, _ in all_files])}" if all_files else "无"
            )
            logger.info(
                f"{self.LOG_PREFIX} 📥 task_key={task_key} "
                f"全量同步模式：同步所有 {len(files_to_sync)} 个文件 (索引范围: {index_range})"
            )

        # 3. 同步源文件
        if files_to_sync:
            try:
                await proxy.ensure_remote_files_to_local_batch(files_to_sync, required=True)
            except Exception as e:
                logger.error(f"{self.LOG_PREFIX} ❌ 同步源文件失败: {e}")
                return [], None, False

        # 4. 构建文件映射
        all_files_map = {}
        for idx, remote_path in all_files:
            local_path = proxy.get_local_path(remote_path.name)
            if await asyncio.to_thread(local_path.exists):
                all_files_map[idx] = local_path

        # 5. 决定合并策略（增量 vs 全量）
        use_incremental = False
        local_merged_temp_input = None
        local_file_paths = []
        incremental_prepare_failed = False

        # 只有检查点有效且有新文件时才尝试增量
        if checkpoint_valid and last_merged_index >= 0 and await asyncio.to_thread(local_merged_path.exists):
            new_files_indices = [idx for idx, _ in all_files if idx > last_merged_index]

            if new_files_indices:
                # 准备增量合并
                use_incremental = True
                logger.info(f"{self.LOG_PREFIX} 🚀 task_key={task_key} 采用增量合并 (Base Index: {last_merged_index})")

                local_merged_temp_input = proxy.get_local_path(f".merged_input_{uuid4().hex}.wav")
                try:
                    await asyncio.to_thread(local_merged_path.rename, local_merged_temp_input)
                    local_file_paths.append(local_merged_temp_input)

                    # 添加新文件（按索引排序）
                    for idx in sorted(new_files_indices):
                        if idx in all_files_map:
                            local_file_paths.append(all_files_map[idx])
                except Exception as e:
                    logger.warning(f"{self.LOG_PREFIX} ⚠️ 准备增量文件失败: {e}, 等待下一轮重试")
                    incremental_prepare_failed = True
                    use_incremental = False
                    # 恢复 merged.wav
                    if local_merged_temp_input and await asyncio.to_thread(local_merged_temp_input.exists):
                        if not await asyncio.to_thread(local_merged_path.exists):
                            await asyncio.to_thread(local_merged_temp_input.rename, local_merged_path)
                        else:
                            await asyncio.to_thread(local_merged_temp_input.unlink)
                    local_merged_temp_input = None
                    local_file_paths = []

        # 6. 全量合并（增量失败或不满足条件，但增量准备失败时跳过）
        if not use_incremental and not incremental_prepare_failed:
            logger.info(f"{self.LOG_PREFIX} 🔄 task_key={task_key} 采用全量合并策略 (All Files)")
            # 使用所有本地文件（按索引排序）
            local_file_paths = [all_files_map[idx] for idx, _ in all_files if idx in all_files_map]
            # 清理可能存在的临时文件
            if local_merged_temp_input and await asyncio.to_thread(local_merged_temp_input.exists):
                await asyncio.to_thread(local_merged_temp_input.unlink)
            local_merged_temp_input = None

        return local_file_paths, local_merged_temp_input, use_incremental

    async def execute_merge_transaction(
        self,
        task_key: str,
        source_dir: Path,
        local_file_paths: list[Path],
        local_merged_temp_input: Path | None,
        use_incremental: bool,
        current_indices: set,
        total_files_count: int,
    ) -> bool:
        """
        执行合并、同步及后续处理

        Args:
            task_key: 任务标识
            source_dir: 源目录路径
            local_file_paths: 本地文件路径列表
            local_merged_temp_input: 临时合并输入文件
            use_incremental: 是否使用增量合并
            current_indices: 当前索引集合
            total_files_count: 总文件数

        Returns:
            bool: 是否完成任务（触发了任务完成流程）
        """
        proxy = AsrLocalWorkspaceProxy(task_key, source_dir)
        local_merged_path = proxy.get_local_path(self.MERGED_WAV_FILENAME)

        success = await self.concat_group_files(
            task_key, local_file_paths, local_merged_path, f"{'增量' if use_incremental else '全量'}合并(Local)"
        )

        if not success:
            # 合并失败恢复
            if local_merged_temp_input and await asyncio.to_thread(local_merged_temp_input.exists):
                await asyncio.to_thread(local_merged_temp_input.rename, local_merged_path)
                logger.warning(f"{self.LOG_PREFIX} ⚠️ 合并失败，已恢复本地 {self.MERGED_WAV_FILENAME}")
            return False

        # 合并成功，同步回 Remote
        # 大文件采用单次写回，减少网络挂载盘的双重写入开销（非原子，但失败会清理远端残留）
        sync_success = await proxy.sync_local_to_remote_single_pass(self.MERGED_WAV_FILENAME)

        if not sync_success:
            logger.error(f"{self.LOG_PREFIX} ❌ 同步 {self.MERGED_WAV_FILENAME} 到远程失败")
            return False

        # 同步成功，保存元数据并清理
        current_max_index = max(current_indices) if current_indices else -1
        await proxy.save_metadata(current_max_index)

        # 清理资源
        if local_merged_temp_input and await asyncio.to_thread(local_merged_temp_input.exists):
            await asyncio.to_thread(local_merged_temp_input.unlink, missing_ok=True)

        for local_file in local_file_paths:
            if local_file != local_merged_path:
                await asyncio.to_thread(local_file.unlink, missing_ok=True)

        # 更新进度
        await AsrMergeTaskManager.instance().update_progress(task_key, current_max_index, total_files_count)

        # 获取信息并日志
        merged_size = await asyncio.to_thread(lambda: local_merged_path.stat().st_size)
        merged_duration = await self.get_audio_duration(local_merged_path)
        logger.info(
            f"{self.LOG_PREFIX} ✅ task_key={task_key} "
            f"合并并同步成功 [Size: {merged_size / 1024:.1f}KB, Duration: {merged_duration}s]"
        )

        # 检查完成状态
        # 统一复用 TaskManager 的 complete_check，避免仅凭 upload_completed 提前结束
        latest_progress = await AsrMergeTaskManager.instance().get_progress(task_key)
        if latest_progress and latest_progress.upload_completed:
            should_complete = await AsrMergeTaskManager.instance().check_should_complete(
                task_key=task_key,
                source_dir=source_dir,
                scanned_file_count=total_files_count,
            )

            if should_complete:
                logger.info(f"{self.LOG_PREFIX} 🎉 task_key={task_key} 完成条件满足，任务结束")
                return True

            logger.info(
                f"{self.LOG_PREFIX} ⏳ task_key={task_key} upload_completed=True 但尚未满足完成条件, "
                f"current_max_index={current_max_index}, total_files_count={total_files_count}"
            )

        return False
