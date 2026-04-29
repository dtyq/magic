"""
消息工厂注册表。

根据版本号返回对应的消息工厂类。
"""

from typing import TYPE_CHECKING, Dict, Type

from agentlang.logger import get_logger

if TYPE_CHECKING:
    from app.core.entity.factory.task_message_factory_protocol import TaskMessageFactoryProtocol

logger = get_logger(__name__)

# 延迟导入，避免循环引用
_registry: Dict[str, Type["TaskMessageFactoryProtocol"]] = {}
_initialized = False


def _ensure_initialized():
    global _initialized
    if _initialized:
        return
    from app.core.entity.factory.task_message_factory import TaskMessageFactory
    from app.core.entity.factory.task_message_factory_v2 import TaskMessageFactoryV2

    _registry["v1"] = TaskMessageFactory
    _registry["v2"] = TaskMessageFactoryV2
    _initialized = True


def get_factory_by_version(version: str) -> "Type[TaskMessageFactoryProtocol]":
    """
    根据版本号获取对应的消息工厂类。

    Args:
        version: 消息版本号，如 "v1" / "v2"

    Returns:
        对应的消息工厂类
    """
    _ensure_initialized()
    factory = _registry.get(version)
    if factory is None:
        logger.warning(f"未知的消息版本 '{version}'，回退到 v1")
        factory = _registry["v1"]
    return factory
