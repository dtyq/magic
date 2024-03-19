from app.i18n import i18n
from typing import Any, Dict
from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.tools.core import BaseTool, BaseToolParams, tool
from agentlang.logger import get_logger
from app.core.context.agent_context import AgentContext

logger = get_logger(__name__)


class CompactChatHistoryParams(BaseToolParams):
    analysis: str = Field(
        ...,
        description="The thinking process and analysis of the conversation"
    )
    summary: str = Field(
        ...,
        description="The summary of the conversation"
    )


@tool()
class CompactChatHistory(BaseTool[CompactChatHistoryParams]):
    """<!--zh: 当对话变得过长时压缩当前聊天历史，在用户告知你之前不要使用此工具-->
Compress the current chat history when the conversation becomes too long, DO NOT use this tool before user tell you to do so."""

    async def execute(self, tool_context: ToolContext, params: CompactChatHistoryParams) -> ToolResult:
        """Execute chat history compaction"""
        # Log compaction action
        logger.info(f"Executing chat history compaction. Analysis length: {len(params.analysis)} chars, Summary length: {len(params.summary)} chars")

        # Return with special system marker for Agent to process
        return ToolResult(
            content="Compact chat history done, this conversation is finished and should not be continued anymore.",
            system="COMPACT_HISTORY",  # Special system marker for compaction
            extra_info={
                "analysis": params.analysis,
                "summary": params.summary
            },
        )

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None
    ) -> Dict:
        """Return action and remark for UI display"""
        # 从 ToolContext 的扩展中获取 AgentContext
        agent_context = tool_context.get_extension_typed("agent_context", AgentContext)
        agent_name = agent_context.get_agent_name()

        return {
            "action": i18n.translate("compact_chat_history", category="tool.actions"),
            "remark": i18n.translate("compact_chat_history.remark", category="tool.messages", agent_name=agent_name)
        }
