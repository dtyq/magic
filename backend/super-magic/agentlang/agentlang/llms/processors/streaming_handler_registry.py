"""
流式处理器注册表。

根据消息版本号返回对应的 StreamResponseHandlerBase 实例，
采用惰性初始化避免循环引用，与 factory_registry / builder_registry 保持一致的设计风格。
"""

from typing import Dict

from agentlang.logger import get_logger
from agentlang.llms.processors.streaming_context_base import StreamResponseHandlerBase

logger = get_logger(__name__)

_registry: Dict[str, StreamResponseHandlerBase] = {}
_initialized = False


def _ensure_initialized() -> None:
    global _initialized
    if _initialized:
        return
    from agentlang.llms.processors.streaming_handler import StreamResponseHandler
    from agentlang.llms.processors.streaming_handler_v2 import StreamResponseHandlerV2

    _registry["v1"] = StreamResponseHandler()
    _registry["v2"] = StreamResponseHandlerV2()
    _initialized = True


def get_handler_by_version(version: str) -> StreamResponseHandlerBase:
    """根据版本号获取对应的流式处理器实例。

    Args:
        version: 消息版本号，如 "v1" / "v2"

    Returns:
        对应版本的 StreamResponseHandlerBase 实例，未知版本回退到 v1
    """
    _ensure_initialized()
    handler = _registry.get(version)
    if handler is None:
        logger.warning(f"未知的流式处理器版本 '{version}'，回退到 v1")
        handler = _registry["v1"]
    return handler
