"""
ASR 服务基类
"""

import asyncio
import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional
from loguru import logger

from app.service.asr.asr_time_config import asr_time_config
from app.service.asr.asr_size_config import asr_size_config


@dataclass(frozen=True)
class ReadJsonOptions:
    """JSON 读取重试选项（集中管理标量参数）"""

    min_size: int = 1
    retries: int | None = None
    wait_interval: float | None = None
    timeout: int | None = None
    stable_count: int | None = None
    max_attempts: int = 5
    backoff: float = 0.05


class AsrServiceBase:
    """
    ASR 服务基类，提供公共配置和常量
    """

    LOG_PREFIX = "[asrmerge]"
    MERGED_WAV_FILENAME = "merged.wav"

    @classmethod
    async def wait_for_file_ready(
        cls,
        file_path: Path,
        min_size: int = None,
        expected_size: int | None = None,
        expected_ratio: float | None = 0.8,
        retries: int = None,
        wait_interval: float = None,
        timeout: int = None,
        stable_count: int = None,
    ) -> tuple[bool, str]:
        """等待文件就绪（针对网络文件系统优化）"""
        # 使用配置默认值
        if min_size is None:
            min_size = asr_size_config.AUDIO_FILE_MIN_SIZE
        if retries is None:
            retries = asr_time_config.FILE_READY_RETRIES
        if wait_interval is None:
            wait_interval = asr_time_config.FILE_READY_WAIT_INTERVAL
        if timeout is None:
            timeout = asr_time_config.FILE_READY_TIMEOUT
        if stable_count is None:
            stable_count = asr_time_config.FILE_STABLE_COUNT

        # 预期大小阈值：只有当文件达到预期的 80%(默认) 才视为就绪
        expected_threshold = None
        if expected_size is not None and expected_ratio:
            expected_threshold = int(expected_size * expected_ratio)

        # 最低可接受大小 = max(显式最小值, 预期阈值)
        effective_min_size = max(min_size, expected_threshold or 0)

        log_prefix = cls.LOG_PREFIX
        start_time = time.time()
        current_wait = wait_interval
        current_timeout = timeout  # 支持动态调整超时时间

        consecutive_stable = 0
        last_size = -1
        last_reason = "未知"
        attempt = 0

        # 定义等待和重试的辅助逻辑
        async def wait_next_loop(backoff: bool = False):
            nonlocal current_wait, attempt
            if backoff:
                current_wait = min(
                    current_wait * asr_time_config.FILE_READY_BACKOFF_MULTIPLIER,
                    asr_time_config.FILE_READY_MAX_BACKOFF_INTERVAL,
                )
            await asyncio.sleep(current_wait)
            attempt += 1

        while True:
            elapsed = time.time() - start_time

            # 1. 检查超时
            if elapsed > current_timeout:
                remote_exists = await asyncio.to_thread(file_path.exists)
                if not remote_exists:
                    logger.warning(
                        f"{log_prefix} ❌ 文件不可用(超时): file={file_path} "
                        f"reason={last_reason} elapsed={elapsed:.2f}s "
                        f"timeout={current_timeout}s retries={retries} attempts={attempt} wait={current_wait}s"
                    )
                    return False, f"等待文件超时 ({current_timeout}s) - 最后状态: {last_reason}"

                try:
                    current_size = await asyncio.to_thread(lambda: file_path.stat().st_size)
                except OSError:
                    current_size = -1

                if current_size >= effective_min_size:
                    logger.warning(
                        f"{log_prefix} ⚠️ 等待超时但文件存在，强制标记为就绪: {file_path.name} ({last_reason})"
                    )
                    return True, f"等待超时但文件存在 ({last_reason})"

                logger.warning(
                    f"{log_prefix} ❌ 文件存在但低于最低要求: file={file_path} "
                    f"size={current_size}B < min={effective_min_size}B reason={last_reason}"
                )
                return False, (
                    f"等待超时且文件低于最低要求 (size={current_size}B < min={effective_min_size}B, {last_reason})"
                )

            # 2. 检查尝试次数
            if current_timeout == timeout and attempt >= retries:
                remote_exists = await asyncio.to_thread(file_path.exists)
                if not remote_exists:
                    logger.warning(
                        f"{log_prefix} ❌ 文件不可用(超过重试次数): file={file_path} "
                        f"reason={last_reason} elapsed={elapsed:.2f}s "
                        f"timeout={current_timeout}s retries={retries} attempts={attempt} wait={current_wait}s"
                    )
                    return False, f"超过最大重试次数({retries})"

                try:
                    current_size = await asyncio.to_thread(lambda: file_path.stat().st_size)
                except OSError:
                    current_size = -1

                if current_size < effective_min_size:
                    logger.warning(
                        f"{log_prefix} ❌ 超过重试次数但文件低于最低要求: "
                        f"{file_path.name} size={current_size}B < min={effective_min_size}B ({last_reason})"
                    )
                    return False, (
                        f"超过重试次数且文件低于最低要求 "
                        f"(size={current_size}B < min={effective_min_size}B, {last_reason})"
                    )

                logger.warning(
                    f"{log_prefix} ⚠️ 超过重试次数但文件存在，强制标记为就绪: {file_path.name} ({last_reason})"
                )
                return True, f"超过重试次数但文件存在 ({last_reason})"

            # 3. 检查文件是否存在
            if not await asyncio.to_thread(file_path.exists):
                consecutive_stable = 0
                last_size = -1
                last_reason = "文件不存在"
                if 0 < attempt < retries - 1:
                    logger.debug(
                        f"{log_prefix} 文件不存在，等待中 (耗时 {int(time.time() - start_time)}s): {file_path.name}"
                    )
                await wait_next_loop(backoff=True)
                continue

            # 4. 获取文件大小
            try:
                current_size = await asyncio.to_thread(lambda: file_path.stat().st_size)
            except OSError:
                consecutive_stable = 0
                last_size = -1
                last_reason = "无法获取文件信息"
                await wait_next_loop()
                continue

            # 5. 检查文件是否为空
            if current_size == 0 and effective_min_size > 0:
                consecutive_stable = 0
                last_size = 0
                last_reason = "文件为空(0字节)"
                if 0 < attempt < retries - 1:
                    logger.debug(
                        f"{log_prefix} 文件为空，等待传输 (耗时 {int(time.time() - start_time)}s): {file_path.name}"
                    )
                await wait_next_loop(backoff=True)
                continue

            # 6. 检查稳定性
            is_unstable_change = False
            if current_size == last_size:
                consecutive_stable += 1
            else:
                if last_size != -1:
                    logger.debug(
                        f"{log_prefix} 文件大小变化 {last_size} -> {current_size}，重置稳定性计数 ({file_path.name})"
                    )
                    is_unstable_change = True
                consecutive_stable = 1
                last_size = current_size

            if consecutive_stable < stable_count:
                if is_unstable_change:
                    last_reason = "文件大小不稳定"
                    # 动态延长超时时间
                    new_timeout = min(
                        current_timeout + asr_time_config.UNSTABLE_FILE_TIMEOUT_EXTENSION,
                        asr_time_config.MAX_UNSTABLE_FILE_TIMEOUT,
                    )
                    if new_timeout > current_timeout:
                        logger.info(
                            f"{log_prefix} ⚠️ 文件大小不稳定，延长超时时间: {current_timeout}s -> {new_timeout}s "
                            f"(文件: {file_path.name})"
                        )
                        current_timeout = new_timeout
                else:
                    last_reason = f"等待文件稳定 ({consecutive_stable}/{stable_count})"

                await wait_next_loop()
                continue

            # 7. 检查最低大小（包含预期阈值）
            if current_size < effective_min_size:
                if expected_threshold and current_size < expected_threshold:
                    logger.warning(
                        f"{log_prefix} ⚠️ 文件稳定但低于预期阈值: {file_path.name} "
                        f"({current_size}B < {expected_threshold}B，预期80%)"
                    )
                    last_reason = f"文件低于预期阈值({current_size}B < {expected_threshold}B, ratio=80%)"
                else:
                    logger.warning(
                        f"{log_prefix} ⚠️ 文件稳定但过小: {file_path.name} ({current_size} < {effective_min_size})"
                    )
                    last_reason = "文件过小"

                consecutive_stable = 0
                await wait_next_loop()
                continue

            # 8. 检查可读性
            if not await asyncio.to_thread(cls._check_readable, file_path):
                consecutive_stable = 0
                last_reason = "文件不可读"
                if 0 < attempt < retries - 1:
                    logger.debug(
                        f"{log_prefix} 文件不可读，等待中 (耗时 {int(time.time() - start_time)}s): {file_path.name}"
                    )
                await wait_next_loop()
                continue

            # 9. 成功
            if attempt > 0:
                logger.debug(
                    f"{log_prefix} ✅ 文件就绪 (耗时 {int(time.time() - start_time)}s): "
                    f"{file_path.name} ({current_size}字节)"
                )
            return True, f"就绪({current_size}字节)"

        # 永远不会执行到这里，但为了类型检查器
        return False, "Unreachable"

    @classmethod
    async def read_json_with_retry(
        cls,
        file_path: Path,
        label: str,
        options: ReadJsonOptions | None = None,
        read_text_func: Optional[Callable[[], str]] = None,
    ) -> Optional[dict]:
        """
        读取 JSON 文件（等待就绪 + 解析重试）

        Args:
            file_path: 文件路径
            label: 日志标识
            options: 读取与重试参数
            read_text_func: 自定义读取函数（用于加锁/特殊读取场景）

        Returns:
            dict | None: 解析成功返回 dict，失败返回 None
        """
        if options is None:
            options = ReadJsonOptions()

        if not await asyncio.to_thread(file_path.exists):
            return None

        current_backoff = options.backoff
        for attempt in range(options.max_attempts):
            is_ready, reason = await cls.wait_for_file_ready(
                file_path,
                min_size=options.min_size,
                retries=options.retries,
                wait_interval=options.wait_interval,
                timeout=options.timeout,
                stable_count=options.stable_count,
            )
            if not is_ready:
                if attempt < options.max_attempts - 1:
                    logger.warning(
                        f"⚠️ {cls.LOG_PREFIX} {label} 未就绪，等待重试 "
                        f"{file_path.name} ({attempt + 1}/{options.max_attempts}): {reason}"
                    )
                    await asyncio.sleep(current_backoff)
                    current_backoff = min(current_backoff * 2, 0.4)
                    continue
                logger.warning(f"⚠️ {cls.LOG_PREFIX} {label} 未就绪，放弃读取: {file_path.name} - {reason}")
                return None

            try:
                if read_text_func is None:
                    content = await asyncio.to_thread(file_path.read_text, encoding="utf-8")
                else:
                    content = await asyncio.to_thread(read_text_func)
                return json.loads(content)
            except FileNotFoundError:
                return None
            except json.JSONDecodeError as e:
                if attempt < options.max_attempts - 1:
                    logger.warning(
                        f"⚠️ {cls.LOG_PREFIX} {label} JSON解析失败，重试 "
                        f"{file_path.name} ({attempt + 1}/{options.max_attempts}): {e}"
                    )
                    await asyncio.sleep(current_backoff)
                    current_backoff = min(current_backoff * 2, 0.4)
                    continue
                logger.error(f"❌ {cls.LOG_PREFIX} {label} JSON解析失败: {e}")
                return None
            except OSError as e:
                logger.error(f"❌ {cls.LOG_PREFIX} 读取{label}IO错误: {e}")
                return None

        return None

    @classmethod
    def read_json_with_retry_sync(
        cls,
        file_path: Path,
        label: str,
        options: ReadJsonOptions | None = None,
        read_text_func: Optional[Callable[[], str]] = None,
    ) -> Optional[dict]:
        """
        同步读取 JSON 文件（用于 to_thread 场景）

        Args:
            file_path: 文件路径
            label: 日志标识
            options: 读取与重试参数
            read_text_func: 自定义读取函数（用于加锁/特殊读取场景）
        """
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            logger.warning(f"⚠️ {cls.LOG_PREFIX} read_json_with_retry_sync 在事件循环中被调用，已跳过: {label}")
            return None

        return asyncio.run(
            cls.read_json_with_retry(
                file_path=file_path,
                label=label,
                options=options,
                read_text_func=read_text_func,
            )
        )

    @staticmethod
    def _check_readable(file_path: Path) -> bool:
        try:
            with file_path.open("rb") as f:
                f.read(16)
            return True
        except (IOError, OSError):
            return False
