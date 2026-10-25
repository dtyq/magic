"""
ConnectWecomBot — 建立企微 AI Bot WS 连接的 Tool。

不挂载到 LLM tool list，仅供 SDK snippet 通过 /api/sdk/tool/call 调用。
"""
from typing import Any, Dict

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.channel.wecom.channel import WeComChannel
from app.channel.config import load_config, save_config, WeComCredential
from app.i18n import i18n
from app.tools.core import BaseTool, BaseToolParams, tool

logger = get_logger(__name__)


class ConnectWecomBotParams(BaseToolParams):
    bot_id: str = Field(
        ...,
        description="WeCom AI Bot ID from the WeCom admin console.",
    )
    secret: str = Field(
        ...,
        description="WeCom AI Bot secret from the WeCom admin console.",
    )


@tool(code_mode_only=True)
class ConnectWecomBot(BaseTool[ConnectWecomBotParams]):
    """Start the WeCom AI Bot WebSocket connection from an SDK snippet."""

    async def execute(self, tool_context: ToolContext, params: ConnectWecomBotParams) -> ToolResult:
        if not tool_context.topic_id:
            return ToolResult.error("The current topic ID is missing, so the WeCom channel cannot be bound.")

        try:
            manager = WeComChannel.get_instance()
            await manager.connect(params.bot_id, params.secret)

            config = await load_config()
            config.wecom = WeComCredential(
                bot_id=params.bot_id,
                secret=params.secret,
                topic_id=tool_context.topic_id,
            )
            await save_config(config)

            return ToolResult(
                content=(
                    f"The WeCom bot connection request has been submitted (bot_id={params.bot_id}). "
                    "Tell the user to verify the conversation in WeCom shortly."
                )
            )
        except Exception as e:
            logger.error(f"[ConnectWecomBot] 连接失败: {e}")
            return ToolResult.error(f"WeCom connection failed: {e}")

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        action = i18n.translate(self.name, category="tool.actions")
        if not result.ok:
            return {
                "action": action,
                "remark": i18n.translate(
                    "channel.connect_wecom_bot.error",
                    category="tool.messages",
                    error=result.content,
                ),
            }
        bot_id = (arguments or {}).get("bot_id") or ""
        return {
            "action": action,
            "remark": i18n.translate(
                "channel.connect_wecom_bot.success",
                category="tool.messages",
                bot_id=bot_id,
            ),
        }
