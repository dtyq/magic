"""
Correlation ID 管理器

实现 before 生成、after 消耗的 correlation_id 管理模式，
根据不同消息类型的 before 和 after 来管理事件配对。
用于解决 LLM 重试时 correlation_id 不匹配的问题。
"""

import uuid
from typing import Optional, Dict
from dataclasses import dataclass
from enum import Enum

from agentlang.logger import get_logger

logger = get_logger(__name__)


class EventPairType(str, Enum):
    """事件配对类型枚举"""
    # 核心流程事件配对
    INIT = "init"                        # BEFORE_INIT <-> AFTER_INIT
    LLM_REQUEST = "llm_request"          # BEFORE_LLM_REQUEST <-> AFTER_LLM_REQUEST
    AGENT_THINK = "agent_think"          # BEFORE_AGENT_THINK <-> AFTER_AGENT_THINK
    AGENT_REPLY = "agent_reply"          # BEFORE_AGENT_REPLY <-> AFTER_AGENT_REPLY
    TOOL_CALL = "tool_call"              # BEFORE_TOOL_CALL <-> AFTER_TOOL_CALL
    MAIN_AGENT_RUN = "main_agent_run"    # BEFORE_MAIN_AGENT_RUN <-> AFTER_MAIN_AGENT_RUN


    # MCP 事件配对（属于工具调用的子类型）
    MCP_INIT = "mcp_init"                # BEFORE_MCP_INIT <-> AFTER_MCP_INIT


# 事件类型到事件对类型的映射
EVENT_TYPE_TO_PAIR_TYPE = {
    # INIT 事件配对
    "before_init": EventPairType.INIT,
    "after_init": EventPairType.INIT,

    # LLM_REQUEST 事件配对
    "before_llm_request": EventPairType.LLM_REQUEST,
    "after_llm_request": EventPairType.LLM_REQUEST,

    # AGENT_THINK 事件配对
    "before_agent_think": EventPairType.AGENT_THINK,
    "after_agent_think": EventPairType.AGENT_THINK,

    # AGENT_REPLY 事件配对
    "before_agent_reply": EventPairType.AGENT_REPLY,
    "after_agent_reply": EventPairType.AGENT_REPLY,

    # TOOL_CALL 事件配对
    "before_tool_call": EventPairType.TOOL_CALL,
    "after_tool_call": EventPairType.TOOL_CALL,

    # MAIN_AGENT_RUN 事件配对
    "before_main_agent_run": EventPairType.MAIN_AGENT_RUN,
    "after_main_agent_run": EventPairType.MAIN_AGENT_RUN,
}


def is_before_event(event_type: str) -> bool:
    """判断是否为 before 事件"""
    return event_type.startswith("before_")


def is_after_event(event_type: str) -> bool:
    """判断是否为 after 事件"""
    return event_type.startswith("after_")


def get_event_pair_type(event_type: str) -> Optional[EventPairType]:
    """根据事件类型获取对应的事件对类型"""
    return EVENT_TYPE_TO_PAIR_TYPE.get(event_type)


@dataclass
class CorrelationContext:
    """Correlation 上下文信息"""
    correlation_id: str
    event_pair_type: EventPairType  # 事件配对类型
    created_at: float
    consumed: bool = False
    retry_count: int = 0  # 重试次数


class CorrelationIdManager:
    """
    Correlation ID 管理器

    根据不同事件类型的 before 和 after 来管理事件配对：
    - before 事件时生成 correlation_id
    - after 事件时消耗对应的 correlation_id
    - 支持重试场景下的 correlation_id 复用

    事件配对关系：
    - BEFORE_AGENT_THINK <-> AFTER_AGENT_THINK
    - BEFORE_AGENT_REPLY <-> AFTER_AGENT_REPLY
    - BEFORE_LLM_REQUEST <-> AFTER_LLM_REQUEST
    - BEFORE_TOOL_CALL <-> AFTER_TOOL_CALL
    """

    def __init__(self):
        self._contexts: Dict[str, CorrelationContext] = {}
        # 按事件类型存储当前活跃的 correlation_id（每种类型只有一个）
        # 注意：由于 asyncio 是单线程模型，不需要线程锁
        self._active_correlations: Dict[EventPairType, str] = {}

    def generate_for_before_event(self, event_pair_type: EventPairType) -> str:
        """
        为 before 事件生成 correlation_id

        如果同类型事件已有活跃的 correlation_id（未被消耗），则复用它（重试场景）
        否则生成新的 correlation_id

        Args:
            event_pair_type: 事件配对类型

        Returns:
            str: correlation_id
        """
        import time

        # 检查是否有同类型的活跃 correlation_id（重试场景）
        existing_correlation_id = self._active_correlations.get(event_pair_type)
        if existing_correlation_id and existing_correlation_id in self._contexts:
            context = self._contexts[existing_correlation_id]
            if not context.consumed:
                context.retry_count += 1
                logger.debug(f"复用 correlation_id: {existing_correlation_id}, "
                           f"事件类型: {event_pair_type}, 重试次数: {context.retry_count}")
                return existing_correlation_id

        # 生成新的 correlation_id
        correlation_id = str(uuid.uuid4())
        context = CorrelationContext(
            correlation_id=correlation_id,
            event_pair_type=event_pair_type,
            created_at=time.time(),
            consumed=False,
            retry_count=0
        )

        self._contexts[correlation_id] = context
        self._active_correlations[event_pair_type] = correlation_id

        logger.debug(f"生成 correlation_id: {correlation_id}, 事件类型: {event_pair_type}")
        return correlation_id

    def get_active_correlation_id(self, event_pair_type: EventPairType) -> Optional[str]:
        """
        获取指定事件类型的活跃 correlation_id

        Args:
            event_pair_type: 事件配对类型

        Returns:
            Optional[str]: 活跃的 correlation_id，如果没有则返回 None
        """
        correlation_id = self._active_correlations.get(event_pair_type)
        if correlation_id and correlation_id in self._contexts:
            context = self._contexts[correlation_id]
            if not context.consumed:
                return correlation_id
        return None

    def consume_for_after_event(self, event_pair_type: EventPairType) -> Optional[str]:
        """
        为 after 事件消耗对应的 correlation_id

        Args:
            event_pair_type: 事件配对类型

        Returns:
            Optional[str]: 被消耗的 correlation_id，如果没有对应的活跃 correlation_id 则返回 None
        """
        correlation_id = self._active_correlations.get(event_pair_type)
        if correlation_id and correlation_id in self._contexts:
            context = self._contexts[correlation_id]
            if not context.consumed:
                context.consumed = True
                # 清理活跃列表
                del self._active_correlations[event_pair_type]

                logger.debug(f"消耗 correlation_id: {correlation_id}, "
                           f"事件类型: {event_pair_type}, 重试次数: {context.retry_count}")
                return correlation_id

        logger.warning(f"无法为事件类型 {event_pair_type} 找到可消耗的 correlation_id")
        return None



# 全局单例实例
_correlation_manager = CorrelationIdManager()


def get_correlation_manager() -> CorrelationIdManager:
    """获取全局 correlation_id 管理器实例"""
    return _correlation_manager
