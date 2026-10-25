"""
ConnectLarkBot — 建立飞书 AI Bot 长连接的 Tool。

不挂载到 LLM tool list，仅供 SDK snippet 通过 /api/sdk/tool/call 调用。
"""
from typing import Any, Dict

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.channel.lark.channel import LarkChannel
from app.channel.config import load_config, save_config, LarkCredential
from app.i18n import i18n
from app.tools.core import BaseTool, BaseToolParams, tool

logger = get_logger(__name__)


class ConnectLarkBotParams(BaseToolParams):
    app_id: str = Field(
        ...,
        description="Lark custom app ID from the Lark developer console.",
    )
    app_secret: str = Field(
        ...,
        description="Lark custom app secret from the Lark developer console.",
    )


@tool(code_mode_only=True)
class ConnectLarkBot(BaseTool[ConnectLarkBotParams]):
    """Start the Lark bot WebSocket connection from an SDK snippet."""

    async def execute(self, tool_context: ToolContext, params: ConnectLarkBotParams) -> ToolResult:
        if not tool_context.topic_id:
            return ToolResult.error("The current topic ID is missing, so the Lark channel cannot be bound.")

        try:
            manager = LarkChannel.get_instance()
            await manager.connect(params.app_id, params.app_secret)

            # 连接建立后立即检测权限，确保 CardKit 和消息功能可用
            perm_error = await manager.verify_permissions()
            if perm_error:
                logger.error(f"[ConnectLarkBot] 权限检测失败: {perm_error}")
                return ToolResult.error(
                    "The Lark bot connection request was submitted, but required permissions are still missing, "
                    f"so replies may fail:\n{perm_error}"
                )

            config = await load_config()
            config.lark = LarkCredential(
                app_id=params.app_id,
                app_secret=params.app_secret,
                topic_id=tool_context.topic_id,
            )
            await save_config(config)

            return ToolResult(
                content=(
                    f"The Lark bot connection request has been submitted (app_id={params.app_id}). "
                    "Tell the user to send a message in Lark shortly to confirm it works."
                )
            )
        except Exception as e:
            logger.error(f"[ConnectLarkBot] 连接失败: {e}")
            return ToolResult.error(f"Lark connection failed: {e}")

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
                    "channel.connect_lark_bot.error",
                    category="tool.messages",
                    error=result.content,
                ),
            }
        app_id = (arguments or {}).get("app_id") or ""
        return {
            "action": action,
            "remark": i18n.translate(
                "channel.connect_lark_bot.success",
                category="tool.messages",
                app_id=app_id,
            ),
        }
