"""
ConnectLarkBot — 建立飞书 AI Bot 长连接的 Tool。

不挂载到 LLM tool list，仅供 SDK snippet 通过 /api/sdk-runtime/call_tool 调用。
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
        description="""<!--zh: 飞书开放平台企业自建应用的 App ID-->
The Lark self-built app ID from the Lark developer console.""",
    )
    app_secret: str = Field(
        ...,
        description="""<!--zh: 飞书开放平台企业自建应用的 App Secret-->
The Lark self-built app secret from the Lark developer console.""",
    )


@tool()
class ConnectLarkBot(BaseTool[ConnectLarkBotParams]):
    """<!--zh
    建立飞书 WebSocket 长连接。仅供 SDK snippet 调用，不挂载到 LLM。
    -->
    Start the Lark WebSocket connection. Intended for SDK snippets only and not exposed as a normal LLM tool.
    """

    async def execute(self, tool_context: ToolContext, params: ConnectLarkBotParams) -> ToolResult:
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
                sandbox_id=tool_context.sandbox_id,
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
