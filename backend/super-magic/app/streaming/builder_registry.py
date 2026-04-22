"""
消息构建器注册表（app 层）。

根据消息版本号返回对应的 MessageBuilderInterface 实例，
采用惰性初始化避免循环引用，与 factory_registry.py 保持一致的设计风格。
"""

from typing import Dict, Type

from agentlang.logger import get_logger
from agentlang.streaming.message_builder import MessageBuilderInterface

logger = get_logger(__name__)

_registry: Dict[str, Type[MessageBuilderInterface]] = {}
_initialized = False


def _ensure_initialized() -> None:
    global _initialized
    if _initialized:
        return
    from app.streaming.message_builder import LLMStreamingMessageBuilder
    from app.streaming.message_builder_v2 import LLMStreamingMessageBuilderV2

    _registry["v1"] = LLMStreamingMessageBuilder
    _registry["v2"] = LLMStreamingMessageBuilderV2
    _initialized = True


def get_builder_by_version(version: str) -> MessageBuilderInterface:
    """根据版本号获取对应的消息构建器实例。

    Args:
        version: 消息版本号，如 "v1" / "v2"

    Returns:
        对应版本的 MessageBuilderInterface 实例，未知版本回退到 v1
    """
    _ensure_initialized()
    cls = _registry.get(version)
    if cls is None:
        logger.warning(f"未知的消息构建器版本 '{version}'，回退到 v1")
        cls = _registry["v1"]
    return cls()
