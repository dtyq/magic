"""
Think Event Manager

管理 Agent 思考事件的触发和状态管理
"""

import uuid
from datetime import datetime
from typing import Optional

from agentlang.event.data import AfterAgentThinkEventData, BeforeAgentThinkEventData
from agentlang.event.event import EventType
from agentlang.interface.context import AgentContextInterface
from agentlang.logger import get_logger

logger = get_logger(__name__)


class ThinkEventManager:
    """Think 事件管理器，纯静态工具类，封装所有 THINK 事件相关的逻辑"""

    @staticmethod
    async def trigger_before_think(
        agent_context: AgentContextInterface,
        model_id: str,
        model_name: str
    ) -> str:
        """触发 BEFORE_AGENT_THINK 事件（自动检查是否已在思考中，避免重复触发）

        Args:
            agent_context: Agent 上下文
            model_id: 模型 ID
            model_name: 模型名称

        Returns:
            str: correlation_id（如果已在思考中，返回现有的；否则生成新的）
        """
        if not agent_context:
            return ""

        # 检查是否已经在思考中（思考边界检查）
        existing_correlation_id = agent_context.get_thinking_correlation_id()
        if existing_correlation_id:
            logger.debug(f"思考进行中，跳过 BEFORE_AGENT_THINK 触发，使用现有 correlation_id={existing_correlation_id}")
            return existing_correlation_id

        # 生成 request_id 和 timestamp
        request_id = str(uuid.uuid4())
        request_timestamp = datetime.now().isoformat()

        # 创建事件数据
        event_data = BeforeAgentThinkEventData(
            agent_context=agent_context,
            model_id=model_id,
            model_name=model_name,
            request_id=request_id,
            request_timestamp=request_timestamp,
            use_stream_mode=True
        )

        # 分发事件（correlation_id 会自动生成）
        await agent_context.dispatch_event(
            EventType.BEFORE_AGENT_THINK,
            event_data
        )

        # 获取生成的 correlation_id 并存储到 agent_context
        correlation_id = event_data.correlation_id
        agent_context.set_thinking_correlation_id(correlation_id)
        logger.debug(f"BEFORE_AGENT_THINK 触发完成，correlation_id={correlation_id}")

        return correlation_id

    @staticmethod
    async def trigger_after_think(
        agent_context: AgentContextInterface,
        model_id: str,
        model_name: str,
        request_id: str = "",
        success: bool = True
    ) -> bool:
        """触发 AFTER_AGENT_THINK 事件（自动检查是否需要触发，避免重复）

        Args:
            agent_context: Agent 上下文
            model_id: 模型 ID
            model_name: 模型名称
            request_id: 请求 ID（可选，未提供则自动生成）
            success: 是否成功（默认 True）

        Returns:
            bool: 是否触发了事件
        """
        if not agent_context:
            return False

        # 如果未提供 request_id，自动生成一个
        if not request_id:
            request_id = str(uuid.uuid4())

        # 检查是否需要触发（如果 correlation_id 不存在，说明已经被触发过了）
        if not agent_context.get_thinking_correlation_id():
            logger.debug(f"[{request_id}] AFTER_AGENT_THINK 已触发过，跳过")
            return False

        # 创建事件数据
        event_data = AfterAgentThinkEventData(
            agent_context=agent_context,
            model_id=model_id,
            model_name=model_name,
            request_id=request_id,
            request_timestamp="",  # 会从 correlation_id_manager 获取
            response_timestamp=datetime.now().isoformat(),
            execution_time=agent_context.get_thinking_duration_ms(),
            use_stream_mode=True,
            success=success
        )

        # 分发事件
        await agent_context.dispatch_event(
            EventType.AFTER_AGENT_THINK,
            event_data
        )

        # 重置思考状态
        agent_context.reset_thinking_state()

        logger.debug(f"[{request_id}] AFTER_AGENT_THINK 事件已触发 (success={success})")
        return True
