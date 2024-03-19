import asyncio
import json
import os
import shutil
import time
from pathlib import Path
from typing import Optional
from loguru import logger
from app.service.asr.asr_time_config import asr_time_config
from app.service.asr.asr_size_config import asr_size_config
from app.service.asr.asr_base import AsrServiceBase, ReadJsonOptions


class AsrLocalWorkspaceProxy(AsrServiceBase):
    """
    ASR 本地工作区代理

    实现 "Local-First Write-Through Cache" (本地优先透写缓存) 模式。
    解决网络挂载盘 (OSS/S3/NFS) 的高延迟、不稳定性导致的文件操作失败问题。

    核心逻辑：
    1. 所有读取操作：先从 Remote 同步到 Local，再读取 Local。
    2. 所有计算操作 (FFmpeg)：只在 Local 进行，确保高性能和稳定性。
    3. 所有写入操作：先写入 Local，成功后原子同步 (Atomic Sync) 到 Remote。

    本地缓存目录选择：
    - 优先使用环境变量 ASR_LOCAL_CACHE_DIR
    - 默认使用应用工作目录下的 .local_cache/asr_workspace
    - 该目录在 Pod 存活期间不会被系统清理，Pod 重启时自然清除
    """

    METADATA_FILE = "merged_metadata.json"

    # Metadata 结构示例:
    # {
    #   "task_key": "uuid-string",
    #   "last_index": 5,          # 当前 merged.wav 包含的最大文件索引 (即已合并 0.wav ... 5.wav)
    #   "timestamp": 1234567890.1 # 最后更新时间戳
    # }

    @staticmethod
    def get_default_local_cache_dir() -> str:
        """
        获取默认的本地缓存目录

        优先级：
        1. 环境变量 ASR_LOCAL_CACHE_DIR
        2. 应用工作目录/.local_cache/asr_workspace

        Returns:
            str: 本地缓存基础目录路径
        """
        # 1. 检查环境变量
        env_cache_dir = os.getenv("ASR_LOCAL_CACHE_DIR")
        if env_cache_dir:
            return env_cache_dir

        # 2. 使用应用工作目录下的缓存目录
        # 获取项目根目录（假设当前文件在 app/service/asr/ 下）
        try:
            from app.paths import PathManager

            project_root = PathManager.get_project_root()
            return str(project_root / ".local_cache" / "asr_workspace")
        except (ImportError, AttributeError, RuntimeError):
            # 如果无法获取项目根目录，使用当前工作目录
            return str(Path.cwd() / ".local_cache" / "asr_workspace")

    def __init__(self, task_key: str, remote_dir: Path, local_base_dir: str = None):
        self.task_key = task_key
        self.remote_dir = remote_dir

        # 如果未指定 local_base_dir，使用默认值
        if local_base_dir is None:
            local_base_dir = self.get_default_local_cache_dir()

        # 本地缓存目录: {local_base_dir}/{task_key}
        self.local_dir = Path(local_base_dir) / task_key
        # init 不支持 async，这里只能容忍同步，或者由调用者保证。但通常 init 很快。
        # 考虑到这是构造函数，我们暂时保留同步，或者后续改为 async classmethod create
        self.local_dir.mkdir(parents=True, exist_ok=True)

        logger.info(f"{self.LOG_PREFIX} 🚀 初始化本地工作区: {self.local_dir} (Remote: {self.remote_dir})")

    def get_local_path(self, filename: str) -> Path:
        """获取文件的本地路径"""
        return self.local_dir / filename

    async def save_metadata(self, last_index: int) -> bool:
        """保存合并元数据到本地并同步到远程"""
        try:
            metadata = {"task_key": self.task_key, "last_index": last_index, "timestamp": time.time()}

            local_meta_path = self.local_dir / self.METADATA_FILE
            await asyncio.to_thread(
                local_meta_path.write_text, json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
            )

            # 同步到远程
            return await self.sync_local_to_remote_atomic(self.METADATA_FILE)
        except Exception as e:
            logger.error(f"{self.LOG_PREFIX} ❌ 保存元数据失败: {e}")
            return False

    async def load_remote_metadata(self) -> Optional[dict]:
        """加载远程元数据（如果存在）"""
        try:
            local_path = await self.ensure_remote_file_to_local(self.METADATA_FILE, required=False)
            if local_path and local_path.exists():
                return await self.read_json_with_retry(
                    local_path,
                    "metadata",
                    options=ReadJsonOptions(min_size=1, stable_count=1, max_attempts=1),
                )
        except Exception as e:
            logger.warning(f"{self.LOG_PREFIX} ⚠️ 加载远程元数据失败: {e}")
        return None

    async def ensure_remote_file_to_local(
        self, filename: str, required: bool = True, verbose: bool = True
    ) -> Optional[Path]:
        """
        确保远程文件已同步到本地

        Args:
            filename: 文件名
            required: 如果为 True 且远程文件不存在，抛出异常；否则返回 None
            verbose: 是否打印详细的同步日志（批量同步时建议设为 False）

        Returns:
            Path: 本地文件路径
        """
        remote_path = self.remote_dir / filename
        local_path = self.local_dir / filename

        # 1. 检查远程文件是否存在
        if not await asyncio.to_thread(remote_path.exists):
            if required:
                raise FileNotFoundError(f"Remote file not found: {remote_path}")
            return None

        # 2. 检查是否需要同步 (简单策略：如果本地不存在或大小不同则同步)
        # 注意：对于 append-only 的 merged.wav，大小不同通常意味着远程更新了，或者本地更新了
        # 这里假设 Remote 是 Source of Truth (对于输入文件) 或 Checkpoint (对于 merged.wav)
        need_sync = False
        if not await asyncio.to_thread(local_path.exists):
            need_sync = True
        else:
            try:
                remote_stat = await asyncio.to_thread(remote_path.stat)
                local_stat = await asyncio.to_thread(local_path.stat)
                if remote_stat.st_size != local_stat.st_size:
                    need_sync = True
            except OSError:
                need_sync = True

        if need_sync:
            if verbose:
                logger.info(f"{self.LOG_PREFIX} ⬇️ 同步文件 Remote -> Local: {filename}")
            # 使用 wait_for_file_ready 确保远程文件已就绪（防止下载到半截文件）
            is_ready, reason = await self.wait_for_file_ready(
                remote_path,
                min_size=asr_size_config.OPTIONAL_FILE_MIN_SIZE,
                retries=asr_time_config.SINGLE_FILE_SYNC_RETRIES,
                wait_interval=asr_time_config.FILE_READY_WAIT_INTERVAL,
            )
            if not is_ready:
                if required:
                    raise IOError(f"Remote file not ready: {reason}")
                return None

            await asyncio.to_thread(shutil.copy2, str(remote_path), str(local_path))

        return local_path

    async def ensure_remote_files_to_local_batch(
        self, filenames: list[str], required: bool = True, retries: int = None
    ) -> list[Optional[Path]]:
        """
        批量同步远程文件到本地 (并发，支持重试)
        """
        if retries is None:
            retries = asr_time_config.BATCH_SYNC_RETRIES

        if not filenames:
            return []

        async def _sync_with_retry(filename: str) -> Optional[Path]:
            last_exception = None
            for attempt in range(retries + 1):
                try:
                    # 批量同步时禁用详细日志，避免重复输出
                    return await self.ensure_remote_file_to_local(filename, required=required, verbose=False)
                except Exception as e:
                    last_exception = e
                    if attempt < retries:
                        wait_time = asr_time_config.BATCH_SYNC_INITIAL_BACKOFF * (
                            asr_time_config.BATCH_SYNC_BACKOFF_MULTIPLIER**attempt
                        )
                        logger.warning(
                            f"{self.LOG_PREFIX} ⚠️ 同步文件 {filename} 失败，{wait_time}s 后重试 ({attempt + 1}/{retries}): {e}"
                        )
                        await asyncio.sleep(wait_time)
                    else:
                        logger.error(f"{self.LOG_PREFIX} ❌ 同步文件 {filename} 最终失败: {e}")

            if required and last_exception:
                raise last_exception
            return None

        # 使用 asyncio.gather 并发执行带重试的任务
        tasks = [_sync_with_retry(filename) for filename in filenames]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 处理结果
        final_results = []
        success_files = []
        for i, res in enumerate(results):
            if isinstance(res, Exception):
                if required:
                    # 如果是 required，抛出第一个遇到的异常
                    raise res
                else:
                    final_results.append(None)
            else:
                if res is not None:
                    success_files.append(filenames[i])
                final_results.append(res)

        # 打印汇总信息和成功文件列表（只打印一次，避免重复日志）
        if success_files:
            # 如果文件数量较多，只显示前10个，其余用省略号表示
            if len(success_files) <= 100:
                files_list = ", ".join(success_files)
            else:
                files_list = ", ".join(success_files[:10]) + f", ... (共 {len(success_files)} 个)"
            logger.info(
                f"{self.LOG_PREFIX} ✅ 批量同步完成：共 {len(filenames)} 个文件，成功 {len(success_files)} 个 - {files_list}"
            )
        else:
            logger.info(f"{self.LOG_PREFIX} ✅ 批量同步完成：共 {len(filenames)} 个文件，成功 0 个")
        return final_results

    async def sync_local_to_remote_atomic(self, filename: str) -> bool:
        """
        将本地文件原子同步到远程 (Write-Through)

        策略：
        1. Upload local_file -> remote_dir/.tmp_filename
        2. Rename remote_dir/.tmp_filename -> remote_dir/filename

        这样保证 remote_dir/filename 永远是完整的。

        注意：
        虽然直接上传 merged.wav 看起来更简单，但在网络文件系统（如 OSS/S3 挂载）上，
        大文件的写入不是原子的。如果写入过程中断，merged.wav 可能会损坏或不完整。
        使用 "上传临时文件 + Rename" 是标准的原子更新模式 (Atomic Replace)。
        Rename 操作在大多数文件系统（包括对象存储网关）上通常是原子的。
        """
        local_path = self.local_dir / filename
        remote_path = self.remote_dir / filename
        temp_remote_path = self.remote_dir / f".tmp_upload_{filename}"

        if not await asyncio.to_thread(local_path.exists):
            logger.warning(f"{self.LOG_PREFIX} ⚠️ 本地文件不存在，无法同步: {local_path}")
            return False

        try:
            # 1. 上传到临时文件
            await asyncio.to_thread(shutil.copy2, str(local_path), str(temp_remote_path))

            # 2. 强制刷新磁盘缓存 (如果是 NFS/OSS 挂载，这一步很重要)
            # Python 的 shutil.copy2 已经包含了一些 flush，但为了保险可以显式 sync
            # 但在 asyncio 中很难对 fd 进行 fsync，依赖 OS 层面

            # 3. 原子重命名
            await asyncio.to_thread(temp_remote_path.replace, remote_path)

            logger.info(f"{self.LOG_PREFIX} ✅ 同步完成: {filename}")
            return True
        except Exception as e:
            logger.error(f"{self.LOG_PREFIX} ❌ 同步失败 {filename}: {e}")
            # 尝试清理临时文件
            await asyncio.to_thread(temp_remote_path.unlink, missing_ok=True)
            return False

    async def sync_local_to_remote_single_pass(self, filename: str, retries: int | None = None) -> bool:
        """
        将本地文件以单次写入方式同步到远程（非原子），并在失败时清理远端残留。

        适用场景：大文件在 FUSE/S3 挂载盘上的两次写入成本过高时，牺牲原子性，换取更少的网络写入。

        策略：
        1. 直接 copy2 到目标文件（一次写入）
        2. 通过 wait_for_file_ready + size 校验确认远端文件完整
        3. 失败则删除远端残留并按配置重试
        """
        if retries is None:
            retries = asr_time_config.SINGLE_FILE_SYNC_RETRIES

        local_path = self.local_dir / filename
        remote_path = self.remote_dir / filename

        if not await asyncio.to_thread(local_path.exists):
            logger.warning(f"{self.LOG_PREFIX} ⚠️ 本地文件不存在，无法同步: {local_path}")
            return False

        try:
            local_size = await asyncio.to_thread(lambda: local_path.stat().st_size)
        except Exception as e:
            logger.error(f"{self.LOG_PREFIX} ❌ 获取本地文件信息失败: {e}")
            return False

        # 对大文件适当放宽就绪等待时间（默认 30s 可能不足），这里统一提升到 300s
        ready_timeout = max(asr_time_config.FILE_READY_TIMEOUT, 300)

        for attempt in range(retries + 1):
            try:
                # 单次写入到远端
                await asyncio.to_thread(shutil.copy2, str(local_path), str(remote_path))

                # 等待远端文件稳定并达到预期大小
                is_ready, reason = await self.wait_for_file_ready(
                    remote_path,
                    min_size=asr_size_config.MERGED_OUTPUT_MIN_SIZE,
                    expected_size=local_size,
                    retries=asr_time_config.MERGED_FILE_READY_RETRIES,
                    wait_interval=asr_time_config.FILE_READY_WAIT_INTERVAL,
                    timeout=ready_timeout,
                    stable_count=asr_time_config.FILE_STABLE_COUNT,
                )
                if not is_ready:
                    raise IOError(f"远端文件未就绪: {reason}")

                remote_size = await asyncio.to_thread(lambda: remote_path.stat().st_size)
                if remote_size != local_size:
                    raise IOError(f"远端大小不一致 local={local_size}B remote={remote_size}B")

                logger.info(
                    f"{self.LOG_PREFIX} ✅ 同步完成(单次写) {filename} size={remote_size}B attempt={attempt + 1}/{retries + 1}"
                )
                return True
            except Exception as e:
                logger.error(f"{self.LOG_PREFIX} ❌ 同步失败(单次写) {filename} 尝试 {attempt + 1}/{retries + 1}: {e}")
                # 清理可能的半截文件，避免脏数据
                await asyncio.to_thread(remote_path.unlink, missing_ok=True)

                if attempt < retries:
                    await asyncio.sleep(asr_time_config.OPERATION_RETRY_WAIT)

        return False

    async def cleanup_local(self, force: bool = False):
        """
        清理本地工作区

        Args:
            force: 如果为 True，即使有错误也强制删除（用于任务启动时的清理）
        """
        try:
            if await asyncio.to_thread(self.local_dir.exists):
                await asyncio.to_thread(lambda: shutil.rmtree(str(self.local_dir)))
                logger.info(f"{self.LOG_PREFIX} 🧹 已清理本地缓存: {self.local_dir}")
                # 重新创建空目录
                await asyncio.to_thread(self.local_dir.mkdir, parents=True, exist_ok=True)
        except Exception as e:
            if force:
                logger.warning(f"{self.LOG_PREFIX} ⚠️ 清理本地缓存失败，但继续执行: {e}")
            else:
                logger.warning(f"{self.LOG_PREFIX} ⚠️ 清理本地缓存失败: {e}")
                raise

    async def validate_and_sync_checkpoint(self, is_first_run: bool = False) -> tuple[bool, int]:
        """
        验证并同步检查点文件（merged.wav 和 metadata.json）

        核心策略：以 Remote 为准，但优先复用本地缓存

        Args:
            is_first_run: 是否是任务首次运行

        返回：
            (is_valid, last_index):
                - is_valid: 检查点是否有效（可以增量合并）
                - last_index: 最后合并的索引，-1 表示需要全量合并

        逻辑：
        1. 检查 Remote 的 merged.wav 和 metadata.json 是否同时存在
        2. 如果只存在一个，删除它，返回 (False, -1)
        3. 如果都存在，验证 metadata 中的 last_index
        4. 如果是首次运行，对比本地和 Remote 的检查点是否一致
           - 一致：复用本地缓存
           - 不一致：清空本地缓存，重新同步
        5. 如果都不存在，返回 (False, -1)
        """
        try:
            remote_merged = self.remote_dir / self.MERGED_WAV_FILENAME
            remote_metadata = self.remote_dir / self.METADATA_FILE

            merged_exists = await asyncio.to_thread(remote_merged.exists)
            metadata_exists = await asyncio.to_thread(remote_metadata.exists)

            # Case 1: 都不存在 -> 全量合并
            if not merged_exists and not metadata_exists:
                logger.info(f"{self.LOG_PREFIX} ✨ task_key={self.task_key} Remote 无检查点文件，将进行全量合并")
                return False, -1

            # Case 2: 只存在一个 -> 数据不一致，删除并全量合并
            if merged_exists != metadata_exists:
                logger.warning(
                    f"{self.LOG_PREFIX} ⚠️ task_key={self.task_key} "
                    f"Remote 检查点数据不一致 ({self.MERGED_WAV_FILENAME}={merged_exists}, metadata={metadata_exists})"
                )

                # 删除存在的文件
                if merged_exists:
                    await asyncio.to_thread(remote_merged.unlink, missing_ok=True)
                    logger.info(f"{self.LOG_PREFIX} 🗑️ 已删除不一致的 {self.MERGED_WAV_FILENAME}")

                if metadata_exists:
                    await asyncio.to_thread(remote_metadata.unlink, missing_ok=True)
                    logger.info(f"{self.LOG_PREFIX} 🗑️ 已删除不一致的 metadata.json")

                return False, -1

            # Case 3: 都存在 -> 验证并同步
            logger.info(f"{self.LOG_PREFIX} ✅ task_key={self.task_key} Remote 检查点文件完整，开始验证并同步")

            # 3.1 先读取 metadata 验证 last_index（等待稳定 + 解析重试）
            metadata = await self.read_json_with_retry(
                remote_metadata,
                "metadata",
                options=ReadJsonOptions(
                    min_size=1,
                    retries=asr_time_config.FILE_READY_RETRIES,
                    wait_interval=asr_time_config.FILE_READY_WAIT_INTERVAL,
                    max_attempts=5,
                    backoff=0.05,
                ),
            )

            if metadata is None:
                logger.warning(f"{self.LOG_PREFIX} ⚠️ task_key={self.task_key} metadata 不可用，删除检查点文件")
                await asyncio.to_thread(remote_merged.unlink, missing_ok=True)
                await asyncio.to_thread(remote_metadata.unlink, missing_ok=True)
                return False, -1

            last_index = metadata.get("last_index", -1)

            if last_index < 0:
                logger.warning(
                    f"{self.LOG_PREFIX} ⚠️ task_key={self.task_key} "
                    f"metadata 中 last_index={last_index} 无效，删除检查点文件"
                )
                await asyncio.to_thread(remote_merged.unlink, missing_ok=True)
                await asyncio.to_thread(remote_metadata.unlink, missing_ok=True)
                return False, -1

            # 3.2 验证 merged.wav 文件大小
            merged_size = await asyncio.to_thread(lambda: remote_merged.stat().st_size)
            if merged_size == 0:
                logger.warning(
                    f"{self.LOG_PREFIX} ⚠️ task_key={self.task_key} {self.MERGED_WAV_FILENAME} 大小为 0，删除检查点文件"
                )
                await asyncio.to_thread(remote_merged.unlink, missing_ok=True)
                await asyncio.to_thread(remote_metadata.unlink, missing_ok=True)
                return False, -1

            # 3.3 检查本地缓存是否与 Remote 一致（仅首次运行时）
            local_merged = self.local_dir / self.MERGED_WAV_FILENAME
            local_metadata = self.local_dir / self.METADATA_FILE

            need_sync = True

            if (
                is_first_run
                and await asyncio.to_thread(local_merged.exists)
                and await asyncio.to_thread(local_metadata.exists)
            ):
                # 对比本地和 Remote 的检查点
                try:
                    # 对比文件大小
                    local_merged_size = await asyncio.to_thread(lambda: local_merged.stat().st_size)
                    if local_merged_size == merged_size:
                        # 对比 metadata 内容
                        local_metadata_content = await asyncio.to_thread(local_metadata.read_text, encoding="utf-8")
                        local_metadata_data = json.loads(local_metadata_content)
                        local_last_index = local_metadata_data.get("last_index", -1)

                        if local_last_index == last_index:
                            # 完全一致，复用本地缓存
                            need_sync = False
                            logger.info(
                                f"{self.LOG_PREFIX} ✅ task_key={self.task_key} "
                                f"本地缓存与 Remote 一致，复用缓存 "
                                f"(last_index={last_index}, size={merged_size / 1024:.1f}KB)"
                            )
                        else:
                            logger.info(
                                f"{self.LOG_PREFIX} ⚠️ task_key={self.task_key} "
                                f"本地缓存 last_index 不一致 (local={local_last_index}, remote={last_index})，"
                                f"清空并重新同步"
                            )
                    else:
                        logger.info(
                            f"{self.LOG_PREFIX} ⚠️ task_key={self.task_key} "
                            f"本地缓存大小不一致 (local={local_merged_size / 1024:.1f}KB, remote={merged_size / 1024:.1f}KB)，"
                            f"清空并重新同步"
                        )
                except Exception as e:
                    logger.warning(f"{self.LOG_PREFIX} ⚠️ 对比本地缓存失败: {e}，清空并重新同步")

            # 3.4 如果需要同步，清空本地缓存并重新同步
            if need_sync:
                # 清空本地缓存（如果存在）
                if await asyncio.to_thread(local_merged.exists) or await asyncio.to_thread(local_metadata.exists):
                    await asyncio.to_thread(local_merged.unlink, missing_ok=True)
                    await asyncio.to_thread(local_metadata.unlink, missing_ok=True)

                # 等待文件就绪后同步
                is_ready, reason = await self.wait_for_file_ready(
                    remote_merged,
                    min_size=asr_size_config.MERGED_OUTPUT_MIN_SIZE,
                    retries=asr_time_config.SINGLE_FILE_SYNC_RETRIES,
                    wait_interval=asr_time_config.FILE_READY_WAIT_INTERVAL,
                )

                if not is_ready:
                    logger.warning(f"{self.LOG_PREFIX} ⚠️ {self.MERGED_WAV_FILENAME} 不可用: {reason}，删除检查点")
                    await asyncio.to_thread(remote_merged.unlink, missing_ok=True)
                    await asyncio.to_thread(remote_metadata.unlink, missing_ok=True)
                    return False, -1

                # 复制文件
                await asyncio.to_thread(shutil.copy2, str(remote_merged), str(local_merged))
                await asyncio.to_thread(shutil.copy2, str(remote_metadata), str(local_metadata))

            logger.info(
                f"{self.LOG_PREFIX} ✅ task_key={self.task_key} 检查点验证完成，可以增量合并 (base_index={last_index})"
            )

            return True, last_index

        except Exception as e:
            logger.error(f"{self.LOG_PREFIX} ❌ task_key={self.task_key} 验证检查点失败: {e}")
            # 发生异常，安全起见删除检查点文件
            try:
                await asyncio.to_thread((self.remote_dir / self.MERGED_WAV_FILENAME).unlink, missing_ok=True)
                await asyncio.to_thread((self.remote_dir / self.METADATA_FILE).unlink, missing_ok=True)
            except OSError:
                # 文件删除失败，忽略错误（已经是清理操作）
                pass
            return False, -1
