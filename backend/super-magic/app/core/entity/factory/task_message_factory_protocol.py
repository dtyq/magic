"""
消息工厂 Protocol 接口定义。

定义所有事件→消息方法签名，v1/v2 工厂均需实现此 Protocol。
"""

from typing import Optional, runtime_checkable, Protocol

from agentlang.event.data import (
    BeforeInitEventData,
    AfterInitEventData,
    AfterMainAgentRunEventData,
    BeforeLlmRequestEventData,
    AfterLlmResponseEventData,
    BeforeAgentThinkEventData,
    AfterAgentThinkEventData,
    BeforeAgentReplyEventData,
    AfterAgentReplyEventData,
    BeforeToolCallEventData,
    AfterToolCallEventData,
    PendingToolCallEventData,
)
from app.core.entity.event.event import (
    AfterClientChatEventData,
    BeforeMcpInitEventData,
    AfterMcpInitEventData,
)
from app.core.entity.message.server_message import ServerMessage
from app.core.entity.final_task_state import FinalTaskState
from agentlang.event.event import Event


@runtime_checkable
class TaskMessageFactoryProtocol(Protocol):
    """消息工厂 Protocol，定义所有事件→消息的方法签名。"""

    @classmethod
    def create_error_message(
        cls,
        agent_context,
        final_task_state: FinalTaskState,
    ) -> ServerMessage: ...

    @classmethod
    def create_before_init_message(
        cls,
        event: Event[BeforeInitEventData],
    ) -> Optional[ServerMessage]: ...

    @classmethod
    def create_after_init_message(
        cls,
        event: Event[AfterInitEventData],
    ) -> Optional[ServerMessage]: ...

    @classmethod
    def create_after_client_chat_message(
        cls,
        event: Event[AfterClientChatEventData],
    ) -> Optional[ServerMessage]: ...

    @classmethod
    def create_agent_suspended_message(
        cls,
        agent_context,
        final_task_state: FinalTaskState,
    ) -> ServerMessage: ...

    @classmethod
    async def create_after_main_agent_run_message(
        cls,
        event: Event[AfterMainAgentRunEventData],
    ) -> ServerMessage: ...

    @classmethod
    def create_before_llm_request_message(
        cls,
        event: Event[BeforeLlmRequestEventData],
    ) -> Optional[ServerMessage]: ...

    @classmethod
    def create_after_llm_response_message(
        cls,
        event: Event[AfterLlmResponseEventData],
    ) -> Optional[ServerMessage]: ...

    @classmethod
    def create_before_agent_think_message(
        cls,
        event: Event[BeforeAgentThinkEventData],
    ) -> Optional[ServerMessage]: ...

    @classmethod
    def create_after_agent_think_message(
        cls,
        event: Event[AfterAgentThinkEventData],
    ) -> Optional[ServerMessage]: ...

    @classmethod
    def create_before_agent_reply_message(
        cls,
        event: Event[BeforeAgentReplyEventData],
    ) -> Optional[ServerMessage]: ...

    @classmethod
    def create_after_agent_reply_message(
        cls,
        event: Event[AfterAgentReplyEventData],
    ) -> Optional[ServerMessage]: ...

    @classmethod
    async def create_before_tool_call_message(
        cls,
        event: Event[BeforeToolCallEventData],
    ) -> Optional[ServerMessage]: ...

    @classmethod
    async def create_pending_tool_call_message(
        cls,
        event: Event[PendingToolCallEventData],
    ) -> Optional[ServerMessage]: ...

    @classmethod
    async def create_after_tool_call_message(
        cls,
        event: Event[AfterToolCallEventData],
    ) -> Optional[ServerMessage]: ...

    @classmethod
    def create_before_mcp_init_message(
        cls,
        event: Event[BeforeMcpInitEventData],
    ) -> Optional[ServerMessage]: ...

    @classmethod
    def create_after_mcp_init_message(
        cls,
        event: Event[AfterMcpInitEventData],
    ) -> Optional[ServerMessage]: ...
