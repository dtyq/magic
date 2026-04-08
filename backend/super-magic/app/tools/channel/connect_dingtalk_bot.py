"""
ConnectDingTalkBot — 建立钉钉 Stream 连接的 Tool。

不挂载到 LLM tool list，仅供 SDK snippet 通过 /api/sdk/tool/call 调用。
"""
from typing import Any, Dict

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.channel.dingtalk.channel import DingTalkChannel
from app.channel.config import load_config, save_config, DingTalkCredential
from app.i18n import i18n
from app.tools.core import BaseTool, BaseToolParams, tool

logger = get_logger(__name__)


class ConnectDingTalkBotParams(BaseToolParams):
    client_id: str = Field(
        ...,
        description="""<!--zh: 钉钉开放平台应用的 Client ID (AppKey)-->
The DingTalk app Client ID (AppKey).""",
    )
    client_secret: str = Field(
        ...,
        description="""<!--zh: 钉钉开放平台应用的 Client Secret (AppSecret)-->
The DingTalk app Client Secret (AppSecret).""",
    )


@tool()
class ConnectDingTalkBot(BaseTool[ConnectDingTalkBotParams]):
    """<!--zh
    建立钉钉 Stream 模式 AI Bot 长连接。仅供 SDK snippet 调用，不挂载到 LLM。
    -->
    Start the DingTalk stream-mode AI bot connection. Intended for SDK snippets only and not exposed as a normal LLM tool.
    """

    async def execute(self, tool_context: ToolContext, params: ConnectDingTalkBotParams) -> ToolResult:
        try:
            manager = DingTalkChannel.get_instance()
            await manager.connect(params.client_id, params.client_secret)

            # 连接建立后立即检测 AI 卡片权限，确保回复能正常送达
            perm_error = await manager.verify_card_permission()
            if perm_error:
                logger.error(f"[ConnectDingTalkBot] 权限检测失败: {perm_error}")
                return ToolResult.error(
                    "The DingTalk bot connection request was submitted, but the AI card permissions are missing, "
                    f"so replies cannot be delivered yet:\n{perm_error}"
                )

            config = await load_config()
            config.dingtalk = DingTalkCredential(
                client_id=params.client_id,
                client_secret=params.client_secret,
                sandbox_id=tool_context.sandbox_id,
            )
            await save_config(config)

            return ToolResult(
                content=(
                    f"The DingTalk bot has started connecting (client_id={params.client_id}). "
                    "Tell the user they can continue the conversation in DingTalk."
                )
            )
        except Exception as e:
            logger.error(f"[ConnectDingTalkBot] 连接失败: {e}")
            return ToolResult.error(f"DingTalk connection failed: {e}")

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
                    "channel.connect_dingtalk_bot.error",
                    category="tool.messages",
                    error=result.content,
                ),
            }
        client_id = (arguments or {}).get("client_id") or ""
        return {
            "action": action,
            "remark": i18n.translate(
                "channel.connect_dingtalk_bot.success",
                category="tool.messages",
                client_id=client_id,
            ),
        }
