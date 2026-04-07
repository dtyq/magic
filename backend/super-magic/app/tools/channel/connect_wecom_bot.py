"""
ConnectWecomBot — 建立企微 AI Bot WS 连接的 Tool。

不挂载到 LLM tool list，仅供 Skill snippet 通过 /api/skills/call_tool 调用。
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
        description="""<!--zh: 企业微信后台获取的 AI Bot ID-->
The WeCom AI Bot ID from the WeCom admin console.""",
    )
    secret: str = Field(
        ...,
        description="""<!--zh: 企业微信后台获取的 AI Bot Secret-->
The WeCom AI Bot secret from the WeCom admin console.""",
    )


@tool()
class ConnectWecomBot(BaseTool[ConnectWecomBotParams]):
    """<!--zh
    建立企业微信 AI Bot WebSocket 长连接。仅供 Skill snippet 调用，不挂载到 LLM。
    -->
    Start the WeCom AI Bot WebSocket connection. Intended for skill snippets only and not exposed as a normal LLM tool.
    """

    async def execute(self, tool_context: ToolContext, params: ConnectWecomBotParams) -> ToolResult:
        try:
            manager = WeComChannel.get_instance()
            await manager.connect(params.bot_id, params.secret)

            config = await load_config()
            config.wecom = WeComCredential(
                bot_id=params.bot_id,
                secret=params.secret,
                sandbox_id=tool_context.sandbox_id,
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
