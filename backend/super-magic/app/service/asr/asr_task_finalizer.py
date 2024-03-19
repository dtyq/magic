"""
ASR 任务完成处理器

负责任务完成相关的所有操作：
- 重命名音频文件
- 处理笔记文件
- 处理流式识别文件
- 清理临时文件
- 重命名目录
- 清理取消的任务
"""

import asyncio
import shutil
import time
import traceback
from pathlib import Path

from loguru import logger

from app.service.asr.asr_base import AsrServiceBase
from app.service.asr.asr_local_proxy import AsrLocalWorkspaceProxy
from app.service.asr.asr_merge_operations import AsrMergeOperations
from app.service.asr.asr_merge_task_manager import AsrMergeTaskManager, AsrTaskStatus
from app.service.asr.asr_size_config import asr_size_config
from app.service.asr.asr_time_config import asr_time_config
from app.service.asr.asr_utils import resolve_path

ASR_RECORDINGS_DIR_NAME = ".asr_recordings"
WORKSPACE_DIR_NAME = ".workspace"
TRANSCRIPT_ACTION_DELETE = "delete"

# action_performed 常量（便于阅读、避免字符串拼写错误）
ACTION_RENAMED_AND_MOVED = "renamed_and_moved"
ACTION_DELETED_EMPTY = "deleted_empty"
ACTION_DELETED = "deleted"


def is_under_asr_recordings(path: Path) -> bool:
    """
    判断路径是否位于 .asr_recordings 目录下
    """
    try:
        resolved = path.resolve()
    except (OSError, RuntimeError):
        resolved = path
    return any(parent.name == ASR_RECORDINGS_DIR_NAME for parent in [resolved] + list(resolved.parents))


class AsrTaskFinalizer(AsrServiceBase):
    """ASR 任务完成处理器"""

    def __init__(self, merge_operations: AsrMergeOperations):
        """
        初始化任务完成处理器

        Args:
            merge_operations: 合并操作实例
        """
        self.merge_operations = merge_operations
        logger.info(f"{self.LOG_PREFIX} 🎯 ASR任务完成处理器初始化完成")

    @staticmethod
    def _init_task_artifacts(task_state) -> tuple[dict, dict, list]:
        """初始化 files/operations/deleted_files，避免重复样板代码"""
        existing_files = task_state.files if isinstance(task_state.files, dict) else {}
        files_detail = dict(existing_files)
        existing_operations = task_state.operations if isinstance(task_state.operations, dict) else {}
        operations_result = dict(existing_operations)
        existing_deleted_files = task_state.deleted_files if isinstance(task_state.deleted_files, list) else []
        deleted_files = list(existing_deleted_files)
        return files_detail, operations_result, deleted_files

    @staticmethod
    async def _fail_task(
        task_key: str,
        reason: str,
        log_message: str | None = None,
        log_func=logger.error,
    ) -> None:
        """统一失败处理与日志输出"""
        if log_message:
            log_func(log_message)
        await AsrMergeTaskManager.instance().fail_task(task_key, reason)

    async def complete_task(self, task_key: str, source_dir: Path) -> None:
        """
        完成任务：改名文件、清理无关文件、重命名目录

        Args:
            task_key: 任务标识
            source_dir: 源目录路径
        """
        try:
            logger.info(f"{self.LOG_PREFIX} 🔄 task_key={task_key} 开始完成任务 (Rename Strategy)")

            # 1. 获取任务配置（内存优先，必要时从文件恢复）
            task_state = await AsrMergeTaskManager.instance().get_task(task_key)
            if not task_state:
                logger.error(f"{self.LOG_PREFIX} task_key={task_key} 任务不存在")
                return

            # 检查必要的配置
            if not task_state.target_dir or not task_state.intelligent_title:
                await self._fail_task(
                    task_key,
                    "缺少目标目录或标题配置",
                    log_message=(
                        f"{self.LOG_PREFIX} task_key={task_key} 缺少必要配置: "
                        f"target_dir={task_state.target_dir}, title={task_state.intelligent_title}"
                    ),
                )
                return

            # 解析路径
            target_dir = resolve_path(task_state.target_dir, WORKSPACE_DIR_NAME)
            output_filename = task_state.intelligent_title
            final_audio_name = f"{output_filename}.wav"

            # 确保目标目录存在（提前创建，以便检查目标文件）
            await asyncio.to_thread(target_dir.mkdir, parents=True, exist_ok=True)
            final_audio_path = target_dir / final_audio_name

            # 2. 处理笔记文件 (移动笔记所在目录下的所有内容)
            files_detail, operations_result, deleted_files = self._init_task_artifacts(task_state)

            # 已完成且 files 已齐全时直接 short-circuit，避免重复写入
            if task_state.status in [AsrTaskStatus.COMPLETED.value, AsrTaskStatus.FINISHED.value]:
                audio_file = (
                    files_detail.get("audio_file") if isinstance(files_detail.get("audio_file"), dict) else None
                )
                has_audio = bool(audio_file and audio_file.get("path"))
                note_expected = bool(task_state.note_file_config)
                note_process = operations_result.get("note_process")
                note_unknown = note_expected and note_process is None
                note_required = note_expected and note_process == "success"
                note_file = files_detail.get("note_file") if isinstance(files_detail.get("note_file"), dict) else None
                has_note = bool(note_file and note_file.get("path"))

                if has_audio and not note_unknown and (not note_required or has_note):
                    logger.info(f"{self.LOG_PREFIX} ✅ task_key={task_key} 已完成且 files 完整，跳过重复完成流程")
                    return
            if task_state.note_file_config:
                note_result = await self.process_note_file(
                    task_key,
                    task_state.note_file_config,
                    files_detail,
                    target_dir=target_dir,
                    timeout=asr_time_config.FINALIZE_FILE_WAIT_TIMEOUT,
                )
                if note_result:
                    operations_result["note_process"] = "success"
                elif "note_process" not in operations_result:
                    operations_result["note_process"] = "skipped"

            # 3. 移动并重命名音频文件
            # 先快速检查哪个文件存在（不调用 wait_for_file_ready）
            merged_file = source_dir / self.MERGED_WAV_FILENAME
            merged_exists = await asyncio.to_thread(merged_file.exists)
            final_exists = await asyncio.to_thread(final_audio_path.exists)

            # 情况1: merged.wav 存在 -> 本地重命名，再单次上传到目标目录
            if merged_exists:
                logger.info(
                    f"{self.LOG_PREFIX} task_key={task_key} {self.MERGED_WAV_FILENAME} 存在，开始本地重命名后上传目标目录"
                )

                # 1. 等待源 merged.wav 就绪（远端）
                is_ready, reason = await AsrMergeOperations.wait_for_file_ready(
                    merged_file,
                    min_size=asr_size_config.MERGED_OUTPUT_MIN_SIZE,
                    retries=asr_time_config.MERGED_FILE_READY_RETRIES,
                )
                if not is_ready:
                    await self._fail_task(
                        task_key,
                        f"合并文件不可用: {reason}",
                        log_message=(
                            f"{self.LOG_PREFIX} ❌ task_key={task_key} merged.wav 不可用: "
                            f"file={merged_file} reason={reason} retries={asr_time_config.MERGED_FILE_READY_RETRIES}"
                        ),
                    )
                    return

                # 2. 将 merged.wav 同步到本地缓存
                source_proxy = AsrLocalWorkspaceProxy(task_key, source_dir)
                try:
                    local_merged_path = await source_proxy.ensure_remote_file_to_local(
                        self.MERGED_WAV_FILENAME, required=True, verbose=False
                    )
                except Exception as e:
                    await self._fail_task(
                        task_key,
                        f"本地缓存失败: {e}",
                        log_message=(
                            f"{self.LOG_PREFIX} ❌ task_key={task_key} 拉取 {self.MERGED_WAV_FILENAME} 到本地失败: {e}"
                        ),
                    )
                    return

                if not local_merged_path or not await asyncio.to_thread(local_merged_path.exists):
                    await AsrMergeTaskManager.instance().fail_task(task_key, f"本地缓存缺失 {self.MERGED_WAV_FILENAME}")
                    return

                # 3. 获取音频信息（本地）
                file_size = await asyncio.to_thread(lambda: local_merged_path.stat().st_size)
                duration = await self.merge_operations.get_audio_duration(local_merged_path)

                # 4. 在本地重命名为智能标题
                local_final_path = source_proxy.get_local_path(final_audio_name)
                try:
                    await asyncio.to_thread(local_final_path.unlink, missing_ok=True)
                except OSError as e:
                    logger.warning(f"{self.LOG_PREFIX} ⚠️ task_key={task_key} 预清理本地文件失败: {e}")
                try:
                    await asyncio.to_thread(local_merged_path.rename, local_final_path)
                except Exception as e:
                    await self._fail_task(
                        task_key,
                        f"本地重命名失败: {e}",
                        log_message=f"{self.LOG_PREFIX} ❌ task_key={task_key} 本地重命名失败: {e}",
                    )
                    return

                # 5. 单次上传到目标目录，避免远端重命名
                target_proxy = AsrLocalWorkspaceProxy(task_key, target_dir)
                upload_ok = await target_proxy.sync_local_to_remote_single_pass(final_audio_name)
                if not upload_ok:
                    await self._fail_task(task_key, "音频上传目标目录失败")
                    return

                # 上传成功后使用目标文件路径作为后续详情
                logger.info(
                    f"{self.LOG_PREFIX} 📛 task_key={task_key} 本地重命名并上传: "
                    f"{local_final_path.name} -> {final_audio_path}"
                )

            # 情况2: merged.wav 不存在，但 final_audio_path 存在 -> 目标文件已就绪，继续补写任务状态
            elif final_exists:
                logger.info(
                    f"{self.LOG_PREFIX} ✅ task_key={task_key} {self.MERGED_WAV_FILENAME} 已移动到目标位置，开始验证目标文件"
                )

                # 使用状态记录的历史大小作为预期值，避免只校验 100B
                expected_size = None
                try:
                    if task_state.file_size and task_state.file_size > 0:
                        expected_size = int(task_state.file_size)
                except (TypeError, ValueError):
                    expected_size = None

                # 等待目标文件就绪（确保文件完整可用）
                is_ready, reason = await AsrMergeOperations.wait_for_file_ready(
                    final_audio_path,
                    min_size=asr_size_config.MERGED_OUTPUT_MIN_SIZE,
                    expected_size=expected_size,
                    retries=asr_time_config.MERGED_FILE_READY_RETRIES,
                )
                if not is_ready:
                    await self._fail_task(
                        task_key,
                        f"目标文件不可用: {reason}",
                        log_message=(
                            f"{self.LOG_PREFIX} ⚠️ task_key={task_key} 目标文件存在但不可用: {reason}，任务可能未完全完成"
                        ),
                        log_func=logger.warning,
                    )
                    return

                try:
                    file_size = await asyncio.to_thread(lambda: final_audio_path.stat().st_size)
                except OSError:
                    file_size = int(task_state.file_size) if task_state.file_size else 0

                duration = await self.merge_operations.get_audio_duration(final_audio_path)
                if not duration and task_state.duration:
                    duration = float(task_state.duration)

                logger.info(
                    f"{self.LOG_PREFIX} ✅ task_key={task_key} 目标文件已就绪 ({final_audio_path})，继续补写任务状态"
                )

            # 情况3: 两个文件都不存在 -> 异常
            else:
                await AsrMergeTaskManager.instance().fail_task(task_key, "源文件和目标文件均不存在")
                return

            # 4. 构建文件详情
            files_detail["audio_file"] = {
                "filename": final_audio_name,
                "path": f"{task_state.target_dir}/{final_audio_name}",
                "size": file_size,
                "duration": duration,
                "action_performed": ACTION_RENAMED_AND_MOVED,
            }

            operations_result["audio_merge"] = "success"

            # 5. 处理流式识别文件 (删除)
            if task_state.transcript_file_config:
                transcript_deleted = await self.process_transcript_file(
                    task_key, task_state.transcript_file_config, timeout=asr_time_config.FINALIZE_FILE_WAIT_TIMEOUT
                )
                if transcript_deleted:
                    deleted_files.extend(transcript_deleted)
                    operations_result["transcript_cleanup"] = "success"

            # 6. 清理音频源目录 (此时音频已移走，笔记如果同目录也已处理，剩余的都是临时文件)
            # 无论笔记目录是否独立，音频源目录的任务已完成，应该清理
            await self.delete_audio_source_directory(source_dir, task_key)

            # 7. 更新任务状态为 completed
            await AsrMergeTaskManager.instance().finish_task(
                task_key,
                file_path=f"{task_state.target_dir}/{final_audio_name}",
                duration=duration,
                file_size=file_size,
                target_dir=task_state.target_dir,
                intelligent_title=output_filename,
                files=files_detail,
                deleted_files=deleted_files,
                operations=operations_result,
            )

            logger.info(
                f"{self.LOG_PREFIX} ✅ task_key={task_key} 任务完成, "
                f"音频文件: {task_state.target_dir}/{final_audio_name}, "
                f"时长: {duration}秒"
            )

        except Exception as e:
            logger.error(f"{self.LOG_PREFIX} ❌ task_key={task_key} 完成任务失败: {e}")
            logger.error(f"{self.LOG_PREFIX} task_key={task_key} 堆栈信息:\n{traceback.format_exc()}")
            await AsrMergeTaskManager.instance().fail_task(task_key, f"完成失败: {e!s}")

    async def delete_audio_source_directory(self, source_dir: Path, task_key: str) -> None:
        """
        删除音频文件源目录
        正常情况下直接删除；只有删除失败（如文件占用/网络盘延迟）才进入轮询重试，避免无意义等待。

        Args:
            source_dir: 音频源目录路径
            task_key: 任务标识
        """
        try:
            # Workaround: 网络磁盘 bug，rename 后 source_dir 可能消失，但业务需要它存在以便执行后续清理逻辑
            if not await asyncio.to_thread(source_dir.exists):
                logger.warning(f"{self.LOG_PREFIX} ⚠️ source_dir 不存在，尝试重建以修复业务逻辑: {source_dir}")
                try:
                    await asyncio.to_thread(source_dir.mkdir, parents=True, exist_ok=True)
                except Exception as mkdir_err:
                    logger.error(f"{self.LOG_PREFIX} ❌ 重建 source_dir 失败: {mkdir_err}")

            if not await asyncio.to_thread(source_dir.exists):
                logger.info(
                    f"{self.LOG_PREFIX} ✅ task_key={task_key} 源目录已不存在（已通过重命名处理）: {source_dir}"
                )
                return

            # 先尝试直接删除（大多数情况下不需要等待目录变空）
            try:
                await asyncio.to_thread(self._rmtree_dir, source_dir)
                # 网络盘/缓存场景下，删除完成后目录视图可能短暂不同步：这里做一次存在性确认
                if not await asyncio.to_thread(source_dir.exists):
                    logger.info(f"{self.LOG_PREFIX} 🗑️ task_key={task_key} 已删除源目录: {source_dir}")
                    return
                # 如果仍然“可见”，进入重试流程（先小等一会再试）
                item_count, item_sample = await asyncio.to_thread(self._summarize_dir_items, source_dir)
                logger.info(
                    f"{self.LOG_PREFIX} ⏳ task_key={task_key} 已执行删除但目录仍可见，进入重试等待"
                    f" dir={source_dir} remaining={item_count} sample={item_sample}"
                )
            except Exception as first_err:
                item_count, item_sample = await asyncio.to_thread(self._summarize_dir_items, source_dir)
                logger.info(
                    f"{self.LOG_PREFIX} ⏳ task_key={task_key} 源目录删除失败，进入重试等待"
                    f" dir={source_dir} remaining={item_count} sample={item_sample} err={first_err}"
                )

            # 删除失败才进入轮询重试（直到超时）
            start_time = time.time()
            has_waited = False
            last_item_names: list[str] | None = None
            # 小等一会再开始第一轮重试，给网络盘/后台写入释放时间
            await asyncio.sleep(min(0.2, asr_time_config.SOURCE_DIR_CLEANUP_POLL_INTERVAL))
            while time.time() - start_time < asr_time_config.SOURCE_DIR_CLEANUP_TIMEOUT:
                has_waited = True
                try:
                    await asyncio.to_thread(self._rmtree_dir, source_dir)
                    logger.info(
                        f"{self.LOG_PREFIX} 🗑️ task_key={task_key} 重试删除成功"
                        f" (耗时: {time.time() - start_time:.2f}s) dir={source_dir}"
                    )
                    return
                except Exception as retry_err:
                    item_count, item_sample = await asyncio.to_thread(self._summarize_dir_items, source_dir)
                    if last_item_names != item_sample:
                        logger.info(
                            f"{self.LOG_PREFIX} ⏳ task_key={task_key} 重试删除源目录失败，继续等待"
                            f" dir={source_dir} remaining={item_count} sample={item_sample} err={retry_err}"
                        )
                        last_item_names = item_sample
                    else:
                        logger.debug(
                            f"{self.LOG_PREFIX} ⏳ task_key={task_key} 重试删除仍失败，继续等待"
                            f" dir={source_dir} err={retry_err}"
                        )
                    logger.debug(
                        f"{self.LOG_PREFIX} ⏳ task_key={task_key} 重试删除失败，继续等待"
                        f" dir={source_dir} err={retry_err}"
                    )
                await asyncio.sleep(asr_time_config.SOURCE_DIR_CLEANUP_POLL_INTERVAL)

            if has_waited:
                item_count, item_sample = await asyncio.to_thread(self._summarize_dir_items, source_dir)
                logger.warning(
                    f"{self.LOG_PREFIX} ⏱️ task_key={task_key} 源目录删除重试超时（放弃）"
                    f" (耗时: {time.time() - start_time:.2f}s) dir={source_dir} "
                    f"remaining={item_count} sample={item_sample}"
                )

        except (OSError, shutil.Error) as e:
            logger.warning(f"{self.LOG_PREFIX} ⚠️ task_key={task_key} 删除源目录失败: {source_dir}, 错误: {e}")

    @staticmethod
    def _rmtree_dir(dir_path: Path) -> None:
        """同步删除目录（供 asyncio.to_thread 调用）"""
        shutil.rmtree(str(dir_path), ignore_errors=False)

    @staticmethod
    def _summarize_dir_items(dir_path: Path, max_names: int = 12) -> tuple[int, list[str]]:
        """同步列出目录残留项（供 asyncio.to_thread 调用），用于日志展示“为什么删不掉”"""
        try:
            items = list(dir_path.iterdir())
        except OSError:
            return 0, []

        names: list[str] = []
        for p in items:
            name = p.name
            try:
                if p.is_dir():
                    name = f"{name}/"
            except OSError:
                pass
            names.append(name)

        names.sort()
        sample = names[:max_names]
        if len(names) > max_names:
            sample.append(f"...(+{len(names) - max_names} more)")
        return len(names), sample

    async def cleanup_source_directory_files(self, source_dir: Path, keep_filenames: set) -> None:
        """
        清理源目录中的临时文件，只保留指定文件

        Args:
            source_dir: 源目录路径
            keep_filenames: 要保留的文件名集合
        """
        try:
            logger.info(f"{self.LOG_PREFIX} 🧹 清理源目录临时文件, 保留: {keep_filenames}")
            items = await asyncio.to_thread(lambda: list(source_dir.iterdir()))
            for item in items:
                if item.name in keep_filenames:
                    continue

                # 删除 .wav (int.wav, chunks)
                if item.suffix == ".wav":
                    try:
                        await asyncio.to_thread(item.unlink)
                    except Exception as e:
                        logger.warning(f"删除临时音频失败: {item.name}: {e}")

                # 删除 metadata.json 和 merged_metadata.json
                elif item.name == "metadata.json" or item.name == AsrLocalWorkspaceProxy.METADATA_FILE:
                    try:
                        await asyncio.to_thread(item.unlink)
                        logger.debug(f"{self.LOG_PREFIX} 🗑️ 已删除元数据文件: {item.name}")
                    except Exception as e:
                        logger.warning(f"删除元数据失败: {item.name}: {e}")

                # 删除其他可能不需要的文件 (比如 .concat_list 等)
                elif item.name.startswith("."):
                    try:
                        if await asyncio.to_thread(item.is_dir):
                            await asyncio.to_thread(lambda: shutil.rmtree(str(item), ignore_errors=False))
                        else:
                            await asyncio.to_thread(item.unlink)
                    except (OSError, PermissionError) as e:
                        logger.debug(f"{self.LOG_PREFIX} 删除隐藏文件/目录失败: {item.name}: {e}")

        except Exception as e:
            logger.warning(f"{self.LOG_PREFIX} ⚠️ 清理源目录文件失败: {e}")

    async def _is_note_file_empty(self, note_path: Path, timeout: int | None = None) -> tuple[bool, int | None]:
        """判断笔记文件是否为空（0 字节或去掉空白后为空）"""
        size_stat: int | None = None
        try:
            size_stat = await asyncio.to_thread(lambda: note_path.stat().st_size)
        except OSError as stat_err:
            logger.warning(f"{self.LOG_PREFIX} ⚠️ 读取笔记大小失败，继续处理: {stat_err}")

        # 注意：有些生成器会先创建 0 字节文件，随后再写入内容。
        # 如果直接判空并删除，可能误删“还没写完”的笔记文件。
        timeout_s = timeout or 0
        if size_stat == 0 and timeout_s > 0:
            poll_interval = 0.2
            deadline = time.time() + timeout_s
            while True:
                remaining = deadline - time.time()
                if remaining <= 0:
                    break

                await asyncio.sleep(min(poll_interval, remaining))

                try:
                    size_stat = await asyncio.to_thread(lambda: note_path.stat().st_size)
                except OSError:
                    break

                if (size_stat or 0) > 0:
                    break

        if size_stat == 0:
            return True, size_stat

        try:
            note_content = await asyncio.to_thread(note_path.read_text)
        except (OSError, UnicodeDecodeError) as read_err:
            logger.warning(f"{self.LOG_PREFIX} ⚠️ 读取笔记内容失败，继续按非空处理: {read_err}")
            return False, size_stat

        if len(note_content.strip()) == 0:
            return True, size_stat

        return False, size_stat

    async def process_note_file(
        self,
        task_key: str,
        note_file_config: dict,
        files_detail: dict,
        target_dir: Path,
        timeout: int = asr_time_config.NOTE_FILE_TIMEOUT,
    ) -> bool:
        """
        处理笔记文件及所在目录

        策略：
        1. 找到笔记文件所在的目录 (note_dir)。
        2. **优先将笔记所在目录整体 move/rename 到 target_path 的目录名**，
           从而保留目录内的所有资源（例如 images/xxx.jpg），保证笔记中的相对路径依然可用。
           - 若目标目录已存在且为空（常见：提前 mkdir 了 target_dir），会先删除空目录再 rename。
           - 若目标目录已存在且非空，退化为“合并搬运目录内容”到目标目录（尽量避免覆盖冲突）。
        3. 在目录到位后，将笔记文件重命名为 target_path 的文件名。
        4. 笔记内容为空则删除笔记文件（但目录仍会按上述规则搬运/改名，避免误删资源文件）。

        Args:
            task_key: 任务标识
            note_file_config: 笔记文件配置
            files_detail: 文件详情字典
            target_dir: 目标目录
            timeout: 等待超时时间

        Returns:
            bool: 是否处理成功
        """
        try:
            note_source_path_str = note_file_config.get("source_path")
            note_target_path_str = note_file_config.get("target_path")

            if not note_source_path_str or not note_target_path_str:
                return False

            note_source_path = resolve_path(note_source_path_str, WORKSPACE_DIR_NAME)
            note_dir = note_source_path.parent
            target_filename = Path(note_target_path_str).name
            target_note_dir_rel = str(Path(note_target_path_str).parent)
            # target_path 的 parent 可能是 "."，此时沿用传入的 target_dir
            desired_target_dir = (
                target_dir
                if target_note_dir_rel in ("", ".")
                else resolve_path(target_note_dir_rel, WORKSPACE_DIR_NAME)
            )
            final_note_path = desired_target_dir / target_filename

            # 如果文件不存在，直接跳过
            if not await asyncio.to_thread(note_source_path.exists):
                logger.info(f"{self.LOG_PREFIX} 📝 task_key={task_key} 笔记文件不存在，跳过: {note_source_path_str}")
                return False

            note_is_empty, _note_size_stat = await self._is_note_file_empty(note_source_path, timeout=timeout)

            # 笔记为空：先删笔记文件，但仍会搬运/改名目录以避免误删同目录下的资源
            if note_is_empty:
                try:
                    await asyncio.to_thread(note_source_path.unlink)
                    logger.info(f"{self.LOG_PREFIX} 📝 task_key={task_key} 笔记为空，已删除: {note_source_path_str}")
                except Exception as delete_err:
                    logger.warning(f"{self.LOG_PREFIX} ⚠️ 删除空笔记文件失败: {delete_err}")
                # 不直接失败：后续仍可能需要搬运目录（例如 images）
            else:
                logger.info(
                    f"{self.LOG_PREFIX} 📝 task_key={task_key} 等待笔记文件: {note_source_path_str} (timeout={timeout}s)"
                )
                is_ready, reason = await AsrMergeOperations.wait_for_file_ready(
                    note_source_path, min_size=asr_size_config.OPTIONAL_FILE_MIN_SIZE, timeout=timeout
                )
                if not is_ready:
                    logger.info(
                        f"{self.LOG_PREFIX} 📝 task_key={task_key} "
                        f"笔记文件不可用，跳过处理: {note_source_path_str} ({reason})"
                    )
                    return False

            # 目录整体 move/rename（优先），以保留 images 等资源并维持相对路径
            await self._move_or_merge_note_directory(note_dir, desired_target_dir, task_key=task_key)
            # 目录到位后，定位笔记文件的新位置（幂等：可能已在 final 位置）
            moved_note_path = desired_target_dir / note_source_path.name

            # 重命名笔记文件到目标文件名（如果笔记文件已被删除为空，则跳过）
            if await asyncio.to_thread(final_note_path.exists):
                logger.info(
                    f"{self.LOG_PREFIX} 📝 task_key={task_key} 目标笔记文件已存在，跳过重命名（幂等）: {final_note_path}"
                )
            else:
                moved_exists = await asyncio.to_thread(moved_note_path.exists)
                if moved_exists and moved_note_path != final_note_path:
                    try:
                        await asyncio.to_thread(shutil.move, str(moved_note_path), str(final_note_path))
                        logger.info(f"{self.LOG_PREFIX} 📝 重命名笔记文件: {moved_note_path.name} -> {final_note_path}")
                    except Exception as move_err:
                        logger.warning(f"{self.LOG_PREFIX} ⚠️ 重命名笔记文件失败 {moved_note_path.name}: {move_err}")
                        return False

                # 兜底：目录未搬运成功（例如位于 .asr_recordings 下被保护跳过），则按旧逻辑仅搬运笔记文件本身
                if (not moved_exists) and (not note_is_empty) and await asyncio.to_thread(note_source_path.exists):
                    try:
                        await asyncio.to_thread(shutil.move, str(note_source_path), str(final_note_path))
                        logger.info(
                            f"{self.LOG_PREFIX} 📝 移动笔记文件(兜底): {note_source_path.name} -> {final_note_path}"
                        )
                    except Exception as move_err:
                        logger.warning(
                            f"{self.LOG_PREFIX} ⚠️ 移动笔记文件(兜底)失败 {note_source_path.name}: {move_err}"
                        )
                        return False

                # 笔记非空但最终没落地：记录一下，允许继续（目录资源可能已搬运）
                if (not note_is_empty) and (not await asyncio.to_thread(final_note_path.exists)):
                    logger.warning(
                        f"{self.LOG_PREFIX} ⚠️ task_key={task_key} 目录已处理但找不到笔记文件: {moved_note_path}"
                    )

            # 读取笔记大小用于返回
            note_size = 0
            if await asyncio.to_thread(final_note_path.exists):
                note_size = await asyncio.to_thread(lambda: final_note_path.stat().st_size)

            files_detail["note_file"] = {
                "filename": Path(note_target_path_str).name,
                "path": note_target_path_str,
                "size": note_size,
                "duration": None,
                # 为保持 API/DTO 兼容，action_performed 仍沿用已有语义（不引入新枚举值）
                "action_performed": ACTION_RENAMED_AND_MOVED if not note_is_empty else ACTION_DELETED_EMPTY,
                "source_path": note_source_path_str,
            }

            return True

        except Exception as e:
            logger.warning(f"{self.LOG_PREFIX} ⚠️ task_key={task_key} 处理笔记文件失败: {e}")
            return False

    async def _move_or_merge_note_directory(
        self, note_source_dir: Path, desired_target_dir: Path, task_key: str
    ) -> str:
        """
        将笔记所在目录整体搬运/改名到 desired_target_dir，以保留 images 等资源文件。

        Returns:
            str: 操作描述（仅用于日志/调试）
        """
        try:
            if note_source_dir == desired_target_dir:
                return "noop_already_in_place"

            # 安全保护：不对 .asr_recordings 下的目录做整体搬运（避免把音频分片一并搬走）
            if is_under_asr_recordings(note_source_dir):
                logger.warning(
                    f"{self.LOG_PREFIX} ⚠️ task_key={task_key} 笔记目录位于 .asr_recordings 下，跳过目录整体搬运: {note_source_dir}"
                )
                # 退化：仅保证目标目录存在
                await asyncio.to_thread(desired_target_dir.mkdir, parents=True, exist_ok=True)
                return "skipped_under_asr_recordings"

            await asyncio.to_thread(desired_target_dir.parent.mkdir, parents=True, exist_ok=True)

            # 目标目录已存在：若为空，先删除空目录以便 rename；否则合并搬运内容
            if await asyncio.to_thread(desired_target_dir.exists):
                try:
                    items = await asyncio.to_thread(lambda: list(desired_target_dir.iterdir()))
                except OSError:
                    items = []

                if len(items) == 0:
                    try:
                        await asyncio.to_thread(desired_target_dir.rmdir)
                        logger.debug(
                            f"{self.LOG_PREFIX} task_key={task_key} 删除预创建的空目标目录以便改名: {desired_target_dir}"
                        )
                    except OSError as rmdir_err:
                        logger.debug(
                            f"{self.LOG_PREFIX} task_key={task_key} 删除空目标目录失败，改用合并搬运: {rmdir_err}"
                        )
                        items = [Path("force_merge")]

                if len(items) > 0:
                    # 合并搬运：把 note_source_dir 下的所有内容搬到 desired_target_dir 下
                    await asyncio.to_thread(desired_target_dir.mkdir, parents=True, exist_ok=True)
                    moved = 0
                    for child in await asyncio.to_thread(lambda: list(note_source_dir.iterdir())):
                        target_child = desired_target_dir / child.name
                        if await asyncio.to_thread(target_child.exists):
                            # 避免覆盖：追加后缀
                            suffix = f".dup_{int(time.time())}"
                            target_child = desired_target_dir / f"{child.name}{suffix}"
                        try:
                            await asyncio.to_thread(shutil.move, str(child), str(target_child))
                            moved += 1
                        except (OSError, shutil.Error) as move_err:
                            logger.warning(
                                f"{self.LOG_PREFIX} ⚠️ task_key={task_key} 合并搬运失败: {child} -> {target_child}: {move_err}"
                            )
                    # 如果源目录已空，可安全删除；否则保留（避免误删资源）
                    try:
                        remaining = await asyncio.to_thread(lambda: list(note_source_dir.iterdir()))
                        if len(remaining) == 0:
                            await asyncio.to_thread(note_source_dir.rmdir)
                    except OSError:
                        pass
                    return f"merged_into_existing_dir(moved={moved})"

            # 目标目录不存在：直接整体 move/rename
            await asyncio.to_thread(shutil.move, str(note_source_dir), str(desired_target_dir))
            logger.info(
                f"{self.LOG_PREFIX} 📝 task_key={task_key} 目录已改名/搬运: {note_source_dir.name} -> {desired_target_dir}"
            )
            return "renamed_dir"

        except (OSError, shutil.Error) as e:
            logger.warning(
                f"{self.LOG_PREFIX} ⚠️ task_key={task_key} 目录改名/搬运失败，将退化为仅保证目标目录存在: {e}"
            )
            try:
                await asyncio.to_thread(desired_target_dir.mkdir, parents=True, exist_ok=True)
            except OSError:
                pass
            return "failed_fallback_mkdir"

    async def cleanup_note_source_dir_if_needed(self, note_source_dir: Path, note_target_dir: Path) -> bool:
        """
        当笔记目录已变更且不在 .asr_recordings 下时删除旧目录

        Args:
            note_source_dir: 原笔记所在目录
            note_target_dir: 目标笔记所在目录

        Returns:
            bool: 是否执行了目录删除
        """
        try:
            if note_source_dir == note_target_dir:
                return False
            if is_under_asr_recordings(note_source_dir):
                return False
            if not await asyncio.to_thread(note_source_dir.exists):
                return False
            # 仅当目录为空时才删除，避免误删同目录下的资源文件（例如 images）
            items = await asyncio.to_thread(lambda: list(note_source_dir.iterdir()))
            if items:
                logger.info(
                    f"{self.LOG_PREFIX} 📝 旧笔记目录非空，跳过删除以保留资源文件: {note_source_dir} (items={len(items)})"
                )
                return False

            await asyncio.to_thread(note_source_dir.rmdir)
            logger.info(f"{self.LOG_PREFIX} 🗑️ 已删除空的旧笔记目录: {note_source_dir}")
            return True
        except Exception as err:
            logger.warning(f"{self.LOG_PREFIX} ⚠️ 删除旧笔记目录失败: {note_source_dir}, 错误: {err}")
            return False

    async def process_transcript_file(
        self, task_key: str, transcript_file_config: dict, timeout: int = asr_time_config.TRANSCRIPT_FILE_TIMEOUT
    ) -> list:
        """
        处理流式识别文件

        Args:
            task_key: 任务标识
            transcript_file_config: 流式识别文件配置
            timeout: 等待超时时间

        Returns:
            list: 删除的文件列表
        """
        deleted_files = []
        try:
            transcript_source_path_str = transcript_file_config.get("source_path")
            transcript_action = transcript_file_config.get("action", TRANSCRIPT_ACTION_DELETE)

            if not transcript_source_path_str:
                return deleted_files

            transcript_abs_path = resolve_path(transcript_source_path_str, WORKSPACE_DIR_NAME)

            # 如果文件不存在，直接跳过
            if not await asyncio.to_thread(transcript_abs_path.exists):
                logger.info(
                    f"{self.LOG_PREFIX} 🗑️ task_key={task_key} 流式文件不存在，跳过: {transcript_source_path_str}"
                )
                return deleted_files

            # 等待流式识别文件就绪
            logger.info(
                f"{self.LOG_PREFIX} 🗑️ task_key={task_key} 等待流式文件: {transcript_source_path_str} (timeout={timeout}s)"
            )
            is_ready, reason = await AsrMergeOperations.wait_for_file_ready(
                transcript_abs_path, min_size=asr_size_config.OPTIONAL_FILE_MIN_SIZE, timeout=timeout
            )
            if not is_ready:
                if transcript_action == "delete":
                    logger.warning(
                        f"{self.LOG_PREFIX} ⚠️ 流式识别文件不可用: {transcript_abs_path} ({reason})，但由于操作是删除，将强制执行"
                    )
                else:
                    logger.warning(f"{self.LOG_PREFIX} ⚠️ 流式识别文件不可用: {transcript_abs_path} ({reason})")
                    return deleted_files

            if transcript_action == TRANSCRIPT_ACTION_DELETE:
                transcript_size = await asyncio.to_thread(lambda: transcript_abs_path.stat().st_size)
                await asyncio.to_thread(transcript_abs_path.unlink)
                logger.info(
                    f"{self.LOG_PREFIX} 🗑️ task_key={task_key} 删除流式识别文件: "
                    f"{transcript_source_path_str}, 原大小={transcript_size / 1024:.2f}KB"
                )
                deleted_files.append({"path": transcript_source_path_str, "action_performed": ACTION_DELETED})

        except Exception as e:
            logger.warning(f"{self.LOG_PREFIX} ⚠️ task_key={task_key} 处理流式识别文件失败: {e}")

        return deleted_files

    async def cleanup_canceled_task_resources(self, task_key: str, workspace_dir: str, task_state):
        """
        清理已取消任务的资源

        清理内容：
        1. 源目录（包含音频分片、笔记、流式识别文件）
        2. 目标目录（如果已创建）
        3. 状态文件

        Args:
            task_key: 任务标识
            workspace_dir: 工作区目录
            task_state: 任务状态对象
        """
        try:
            logger.info(
                f"{self.LOG_PREFIX} 🧹 task_key={task_key} 开始清理任务资源, "
                f"source_dir={getattr(task_state, 'source_dir', None)}, "
                f"target_dir={getattr(task_state, 'target_dir', None)}"
            )

            # 构建可能的目录路径列表
            workspace_path = resolve_path("", workspace_dir)
            possible_dirs = []

            # 1. 从任务状态中获取的目录
            if hasattr(task_state, "source_dir") and task_state.source_dir:
                possible_dirs.append(("source_dir (from state)", task_state.source_dir))

            if hasattr(task_state, "target_dir") and task_state.target_dir:
                possible_dirs.append(("target_dir (from state)", task_state.target_dir))

            # 2. 扫描 workspace 目录，查找与 task_key 匹配的目录
            if workspace_path.exists():
                for item in workspace_path.iterdir():
                    if item.is_dir() and (
                        item.name == task_key
                        or item.name.startswith(f"{task_key}_")
                        or item.name.endswith(f"_{task_key}")
                    ):
                        possible_dirs.append(("scanned dir", item.name))

            # 删除所有找到的目录（去重）
            cleaned_dirs = set()
            for label, dir_name in possible_dirs:
                dir_path = workspace_path / dir_name
                if dir_path not in cleaned_dirs and dir_path.exists():
                    try:
                        file_count = len(list(dir_path.rglob("*")))
                        await asyncio.to_thread(lambda: shutil.rmtree(str(dir_path), ignore_errors=False))
                        logger.info(f"{self.LOG_PREFIX} ✅ 已删除{label}: {dir_path} (包含 {file_count} 个文件/目录)")
                        cleaned_dirs.add(dir_path)
                    except (OSError, PermissionError) as e:
                        logger.warning(f"{self.LOG_PREFIX} ⚠️ 删除{label}失败: {e}")

            if not cleaned_dirs:
                logger.warning(f"{self.LOG_PREFIX} ⚠️ task_key={task_key} 未找到需要清理的目录")

            # 删除状态文件
            await self.delete_state_file(task_key)

            logger.info(f"{self.LOG_PREFIX} ✅ task_key={task_key} 资源清理完成")

        except Exception as e:
            logger.error(f"{self.LOG_PREFIX} ❌ task_key={task_key} 清理任务资源失败: {e}")
            logger.error(f"{self.LOG_PREFIX} 堆栈信息:\n{traceback.format_exc()}")

    async def delete_state_file(self, task_key: str) -> None:
        """
        删除任务状态文件

        Args:
            task_key: 任务标识
        """
        try:
            state_file = AsrMergeTaskManager.instance().get_state_file_path(task_key)
            if state_file.exists():
                await asyncio.to_thread(state_file.unlink)
                logger.info(f"{self.LOG_PREFIX} ✅ 已删除状态文件: {state_file}")
            else:
                logger.debug(f"{self.LOG_PREFIX} 状态文件不存在: {state_file}")
        except Exception as e:
            logger.warning(f"{self.LOG_PREFIX} ⚠️ 删除状态文件失败: {e}")
