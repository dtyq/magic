"""
ConnectDingTalkBot — 建立钉钉 Stream 连接的 Tool。

不挂载到 LLM tool list，仅供 Skill snippet 通过 /api/skills/call_tool 调用。
"""
from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.channel.dingtalk.channel import DingTalkChannel
from app.channel.config import load_config, save_config, DingTalkCredential
from app.tools.core import BaseTool, BaseToolParams, tool

logger = get_logger(__name__)


class ConnectDingTalkBotParams(BaseToolParams):
    client_id: str = Field(..., description="钉钉开放平台应用的 Client ID (AppKey)")
    client_secret: str = Field(..., description="钉钉开放平台应用的 Client Secret (AppSecret)")


@tool()
class ConnectDingTalkBot(BaseTool[ConnectDingTalkBotParams]):
    """建立钉钉 Stream 模式 AI Bot 长连接。仅供 Skill snippet 调用，不挂载到 LLM。"""

    async def execute(self, tool_context: ToolContext, params: ConnectDingTalkBotParams) -> ToolResult:
        try:
            manager = DingTalkChannel.get_instance()
            await manager.connect(params.client_id, params.client_secret)

            # 连接建立后立即检测 AI 卡片权限，确保回复能正常送达
            perm_error = await manager.verify_card_permission()
            if perm_error:
                logger.error(f"[ConnectDingTalkBot] 权限检测失败: {perm_error}")
                return ToolResult.error(f"钉钉机器人已提交连接请求，但 AI 卡片权限未开通，消息将无法回复：\n{perm_error}")

            config = await load_config()
            config.dingtalk = DingTalkCredential(
                client_id=params.client_id,
                client_secret=params.client_secret,
                sandbox_id=tool_context.sandbox_id,
            )
            await save_config(config)

            return ToolResult(content=f"钉钉机器人已开始连接（client_id={params.client_id}），可在钉钉中继续对话")
        except Exception as e:
            logger.error(f"[ConnectDingTalkBot] 连接失败: {e}")
            return ToolResult.error(f"连接失败: {e}")
