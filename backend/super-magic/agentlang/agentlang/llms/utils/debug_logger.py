"""
LLM 调试日志工具

该模块提供 LLM 请求和响应的调试日志记录功能
"""

import json
import os
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Optional

from openai.types.chat import ChatCompletion

from agentlang.logger import get_logger
from agentlang.utils.security import sanitize_api_key

logger = get_logger(__name__)

# 是否启用成功请求的调试日志（失败请求总是记录）
ENABLE_LLM_SUCCESS_REQUEST_LOG = os.getenv(
    "ENABLE_LLM_SUCCESS_REQUEST_LOG", "false"
).lower() in ("true", "1", "yes", "on")


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

        # 创建聊天历史目录下的 llm_request 子目录
        from agentlang.path_manager import PathManager
        chat_history_dir = PathManager.get_chat_history_dir()
        llm_request_dir = chat_history_dir / "llm_request"
        llm_request_dir.mkdir(exist_ok=True)

        # 计算耗时（毫秒）
        duration_ms = _calculate_duration_ms(start_timestamp, end_timestamp)

        # 生成调试日志文件名，包含耗时信息
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]  # 毫秒精度
        filename = f"{debug_info.model_id}_{timestamp}_{duration_ms}_{status}.log"
        file_path = llm_request_dir / filename

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

        # 写入文件
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(log_content)

        logger.debug(f"已保存调试日志: {file_path}")

    except Exception as e:
        logger.warning(f"保存 LLM 调试日志时出错: {e}")


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
        json.dumps(request_params, indent=2, ensure_ascii=False),
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
            f"Error Message: {str(exception)}",
            f"Exception repr: {repr(exception)}",
            ""
        ])

    log_lines.append("=== END LOG ===")

    return '\n'.join(log_lines)
