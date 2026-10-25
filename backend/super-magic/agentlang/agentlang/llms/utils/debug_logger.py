"""
LLM 调试日志工具

该模块提供 LLM 请求和响应的调试日志记录功能
"""

import asyncio
import json
import os
import re
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from openai.types.chat import ChatCompletion

from agentlang.logger import get_logger
from agentlang.utils.security import sanitize_api_key, sanitize_log_value

logger = get_logger(__name__)

_FAILED_ARCHIVE_LOCK = asyncio.Lock()
_FAILED_ARCHIVE_NAME = re.compile(r".+_\d{8}_\d{6}_\d{3}_-?\d+_[0-9a-f]{32}_failed\.log")
_LOG_END_MARKER = b"=== END LOG ==="
_DEFAULT_FAILED_ARCHIVE_MAX_FILES = 3


@dataclass(frozen=True, slots=True)
class _ArchivedLog:
    path: Path
    modified_at_ns: int

# 是否启用成功请求的调试日志（失败请求总是记录）
ENABLE_LLM_SUCCESS_REQUEST_LOG = os.getenv(
    "ENABLE_LLM_SUCCESS_REQUEST_LOG", "false"
).lower() in ("true", "1", "yes", "on")

def _get_llm_request_log_max_files() -> int:
    """读取 LLM 请求日志保留上限。"""
    from app.utils.runtime_storage import get_runtime_config_int

    return get_runtime_config_int(
        "runtime_cleanup.llm_request.max_file_count",
        minimum=0,
    )

def _sanitize_for_filename(value: str) -> str:
    """将输入字符串转换为可安全用于单个文件名片段的值。"""
    if not value:
        return "unknown"

    sanitized = value.replace("/", "_").replace("\\", "_")

    if os.sep and os.sep not in ("/", "\\"):
        sanitized = sanitized.replace(os.sep, "_")
    if os.altsep and os.altsep not in ("/", "\\"):
        sanitized = sanitized.replace(os.altsep, "_")

    return sanitized or "unknown"


@dataclass
class LLMDebugInfo:
    """LLM 调试日志所需的配置信息"""

    model_id: str
    model_name: str
    provider: str
    api_base_url: Optional[str]
    api_key: str


async def save_llm_debug_log(
    debug_info: LLMDebugInfo,
    request_params: Dict[str, Any],
    response: Optional[ChatCompletion] = None,
    exception: Optional[Exception] = None,
    start_timestamp: Optional[str] = None,
    end_timestamp: Optional[str] = None
) -> None:
    """
    统一记录 LLM 请求和响应/错误信息到调试日志文件

    注意：
        - 失败的请求总是记录日志
        - 成功的请求只在 ENABLE_LLM_SUCCESS_REQUEST_LOG 环境变量开启时记录
        - 无论是否写入日志，请求结束后都会异步检查并清理积压日志

    Args:
        debug_info: LLM 调试信息
        request_params: 请求参数字典
        response: 成功时的响应对象，可选
        exception: 失败时的异常对象，可选
        start_timestamp: 请求开始时间，可选
        end_timestamp: 请求结束时间，可选
    """
    try:
        # 确定是成功还是失败
        is_success = response is not None and exception is None
        status = "success" if is_success else "failed"

        # 成功的请求需要检查环境变量，失败的请求总是记录
        if is_success and not ENABLE_LLM_SUCCESS_REQUEST_LOG:
            return

        # 计算耗时（毫秒）
        duration_ms = _calculate_duration_ms(start_timestamp, end_timestamp)

        # 生成调试日志文件名，包含耗时信息
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]  # 毫秒精度
        safe_model_id = _sanitize_for_filename(debug_info.model_id)
        filename = f"{safe_model_id}_{timestamp}_{duration_ms}_{uuid.uuid4().hex}_{status}.log"

        # 构建调试日志内容
        log_content = _build_log_content(
            debug_info=debug_info,
            request_params=request_params,
            response=response,
            exception=exception,
            start_timestamp=start_timestamp,
            end_timestamp=end_timestamp,
            status=status,
            duration_ms=duration_ms
        )

        # 本地故障与持久化故障分别处理；任一写入失败都不能阻止另一处保存完整正文。
        try:
            from app.path_manager import PathManager
            from app.utils.async_file_utils import async_write_text
            from app.utils.runtime_storage import ensure_runtime_directory

            llm_requests_dir = await ensure_runtime_directory(PathManager.get_llm_requests_dir())
            file_path = llm_requests_dir / filename
            await async_write_text(file_path, log_content)

            from app.service.chat_history_cleanup_service import ChatHistoryCleanupService
            ChatHistoryCleanupService.trigger()
            logger.debug(f"已保存调试日志: {file_path}")
        except Exception as error:
            logger.warning(f"保存本地 LLM 调试日志失败: {error}")

        if not is_success:
            await _save_failed_log_archive(filename, log_content)

    except Exception as e:
        logger.warning(f"保存 LLM 调试日志时出错: {e}")
    finally:
        await prune_llm_request_logs_if_needed()


def _get_failed_archive_max_files() -> int:
    """持久档案只接受正整数，非法配置不能变成无限保留。"""
    from agentlang.config.config import config

    key = "diagnostic_retention.llm_failed_max_count"
    value = config.get(key, _DEFAULT_FAILED_ARCHIVE_MAX_FILES)
    if not isinstance(value, bool) and isinstance(value, (int, str)):
        try:
            parsed = int(value)
            if parsed > 0:
                return parsed
        except ValueError:
            pass
    logger.warning(f"无效持久日志配额 {key}={value!r}，使用默认值 {_DEFAULT_FAILED_ARCHIVE_MAX_FILES}")
    return _DEFAULT_FAILED_ARCHIVE_MAX_FILES


async def _is_complete_failed_log(file_path: Path, size: int) -> bool:
    from app.utils.async_file_utils import async_read_bytes

    if size < len(_LOG_END_MARKER):
        return False
    return await async_read_bytes(
        file_path, size=len(_LOG_END_MARKER), offset=size - len(_LOG_END_MARKER)
    ) == _LOG_END_MARKER


async def _save_failed_log_archive(filename: str, log_content: str) -> None:
    """完整写入失败档案后才淘汰旧档案，不改变 Agent 的本地活动目录。"""
    from app.path_manager import PathManager
    from app.utils.async_file_utils import (
        async_chmod, async_exists, async_is_symlink, async_mkdir,
        async_stat, async_unlink, async_write_text,
    )

    archive_dir = PathManager.get_llm_failed_logs_archive_dir()
    file_path = archive_dir / filename
    expected_size = len(log_content.encode("utf-8"))
    remote_size: int | None = None
    created = False
    async with _FAILED_ARCHIVE_LOCK:
        try:
            if not _FAILED_ARCHIVE_NAME.fullmatch(filename):
                raise ValueError("Invalid failed-log archive filename")
            for directory in (PathManager.get_topic_archives_dir(), archive_dir):
                if await async_is_symlink(directory):
                    raise ValueError(f"Archive directory must not be a symbolic link: {directory}")
                await async_mkdir(directory, parents=True, exist_ok=True)
                await async_chmod(directory, 0o700)
            if await async_is_symlink(file_path):
                raise ValueError("Failed-log archive must not be a symbolic link")
            created = not await async_exists(file_path)
            if not created:
                remote_size = (await async_stat(file_path)).st_size
                if await _is_complete_failed_log(file_path, remote_size):
                    # 同一文件名代表同一次存档；已完成的重试不再覆盖或制造新版本。
                    await _prune_failed_archives(archive_dir)
                    return
            await async_write_text(file_path, log_content)
            await async_chmod(file_path, 0o600)
            remote_size = (await async_stat(file_path)).st_size
            if remote_size != expected_size or not await _is_complete_failed_log(file_path, remote_size):
                raise OSError("Failed-log archive is incomplete")
        except (Exception, asyncio.CancelledError) as error:
            logger.warning(
                f"NETWORK_FILE_WRITE_FAILED workspace_type=.topic file_path={file_path} "
                f"file_name={filename} "
                f"operation=direct_overwrite local_size={expected_size} remote_size={remote_size} "
                f"error={error!r}"
            )
            if created:
                try:
                    if await async_exists(file_path):
                        await async_unlink(file_path)
                except OSError as cleanup_error:
                    logger.warning(f"清理本次未完成失败日志失败: {file_path}: {cleanup_error}")
            if isinstance(error, asyncio.CancelledError):
                raise
            return
        await _prune_failed_archives(archive_dir)
        logger.debug(f"已写入话题失败日志存档: {file_path}")


async def _prune_failed_archives(archive_dir: Path) -> None:
    """只处理本能力的完整日志和已确认半写残留，不跨目录清理。"""
    from app.utils.async_file_utils import async_scandir, async_stat, async_unlink

    try:
        completed: list[_ArchivedLog] = []
        for entry in await async_scandir(archive_dir):
            if not entry.is_file(follow_symlinks=False) or not _FAILED_ARCHIVE_NAME.fullmatch(entry.name):
                continue
            path = Path(entry.path)
            try:
                stat = await async_stat(path)
                if await _is_complete_failed_log(path, stat.st_size):
                    completed.append(_ArchivedLog(path, stat.st_mtime_ns))
                else:
                    await async_unlink(path)
            except OSError as error:
                # 读取失败不能推断为半写；保留无法确认的文件。
                logger.warning(f"检查或清理失败日志存档失败: {path}: {error}")
        completed.sort(key=lambda item: (item.modified_at_ns, item.path.name), reverse=True)
        for item in completed[_get_failed_archive_max_files():]:
            await async_unlink(item.path)
    except Exception as error:
        logger.warning(f"清理失败日志存档失败: {archive_dir}: {error}")


async def prune_llm_request_logs_if_needed() -> None:
    """按配置保留 llm_requests 目录下最新的日志文件，清理更旧和积压文件。"""
    try:
        max_files = _get_llm_request_log_max_files()
        if max_files <= 0:
            return

        from app.path_manager import PathManager

        llm_requests_dir = PathManager.get_llm_requests_dir()
        await _prune_llm_request_logs(llm_requests_dir, max_files)
    except Exception as e:
        logger.warning("清理 LLM 请求日志时出错: %s", e)


async def _prune_llm_request_logs(llm_requests_dir: Path, max_files: int) -> None:
    """保留目录下最新的 max_files 个 .log 文件，删除更旧的。"""
    if max_files <= 0:
        return

    try:
        from app.utils.async_file_utils import async_exists, async_scandir, async_unlink

        # 调试日志目录按需创建；目录尚不存在时没有需要清理的内容
        if not await async_exists(llm_requests_dir):
            return

        entries = await async_scandir(llm_requests_dir)
        log_entries = [
            entry for entry in entries
            if entry.is_file() and entry.name.endswith(".log")
        ]
        if len(log_entries) <= max_files:
            return

        log_entries.sort(key=lambda entry: entry.stat().st_mtime, reverse=True)
        for entry in log_entries[max_files:]:
            await async_unlink(entry.path)
            logger.debug("已淘汰最老 LLM 请求日志: %s", entry.path)
    except Exception as e:
        logger.warning("清理 LLM 请求日志时出错: %s", e)


def _calculate_duration_ms(
    start_timestamp: Optional[str],
    end_timestamp: Optional[str]
) -> int:
    """
    计算请求耗时（毫秒）

    Args:
        start_timestamp: 开始时间戳
        end_timestamp: 结束时间戳

    Returns:
        耗时毫秒数，如果无法计算则返回 0
    """
    if not start_timestamp or not end_timestamp:
        return 0

    try:
        start_dt = datetime.fromisoformat(start_timestamp)
        end_dt = datetime.fromisoformat(end_timestamp)
        return int((end_dt - start_dt).total_seconds() * 1000)
    except Exception:
        return 0


def _build_log_content(
    debug_info: LLMDebugInfo,
    request_params: Dict[str, Any],
    response: Optional[ChatCompletion],
    exception: Optional[Exception],
    start_timestamp: Optional[str],
    end_timestamp: Optional[str],
    status: str,
    duration_ms: int
) -> str:
    """
    构建调试日志内容

    Args:
        debug_info: LLM 调试信息
        request_params: 请求参数
        response: 响应对象
        exception: 异常对象
        start_timestamp: 开始时间
        end_timestamp: 结束时间
        status: 状态（success/failed）
        duration_ms: 耗时毫秒数

    Returns:
        格式化的日志内容字符串
    """
    log_lines = [
        "=== LLM DEBUG LOG ===",
        f"Model ID: {debug_info.model_id}",
        f"Model Name: {debug_info.model_name}",
        f"Provider: {debug_info.provider}",
        f"API Base URL: {debug_info.api_base_url}",
        f"API Key: {sanitize_api_key(debug_info.api_key)}",
        f"Start Time: {start_timestamp or 'N/A'}",
        f"End Time: {end_timestamp or 'N/A'}",
        f"Status: {status}",
        f"Duration: {duration_ms} ms",
        ""
    ]

    # 添加请求参数
    log_lines.extend([
        "",
        "=== REQUEST PARAMETERS ===",
        json.dumps(_sanitize_request_params(request_params), indent=2, ensure_ascii=False),
        ""
    ])

    # TOKEN 使用情况
    token_usage = f"{response.usage}" if response and response.usage else "N/A"
    log_lines.extend([
        "=== TOKEN USAGE ===",
        token_usage,
        ""
    ])

    # 响应体
    response_body = f"{response}" if response else "N/A"
    log_lines.extend([
        "=== RESPONSE BODY ===",
        response_body,
        ""
    ])

    # 异常信息（仅失败时）
    if exception:
        log_lines.extend([
            "=== EXCEPTION DETAILS ===",
            f"Error Type: {type(exception).__name__}",
            f"Error Message: {exception!s}",
            f"Exception repr: {exception!r}",
            ""
        ])

    log_lines.append("=== END LOG ===")

    return '\n'.join(log_lines)


def _sanitize_request_params(value: Any) -> Any:
    """脱敏请求参数，避免失败日志把 header/token 类信息落盘。"""
    return sanitize_log_value(value)
