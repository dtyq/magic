"""
ConnectLarkBot — 建立飞书 AI Bot 长连接的 Tool。

不挂载到 LLM tool list，仅供 Skill snippet 通过 /api/skills/call_tool 调用。
"""
from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.channel.lark.channel import LarkChannel
from app.channel.config import load_config, save_config, LarkCredential
from app.tools.core import BaseTool, BaseToolParams, tool

logger = get_logger(__name__)


class ConnectLarkBotParams(BaseToolParams):
    app_id: str = Field(..., description="飞书开放平台企业自建应用的 App ID")
    app_secret: str = Field(..., description="飞书开放平台企业自建应用的 App Secret")


@tool()
class ConnectLarkBot(BaseTool[ConnectLarkBotParams]):
    """建立飞书 WebSocket 长连接。仅供 Skill snippet 调用，不挂载到 LLM。"""

    async def execute(self, tool_context: ToolContext, params: ConnectLarkBotParams) -> ToolResult:
        try:
            manager = LarkChannel.get_instance()
            await manager.connect(params.app_id, params.app_secret)

            # 连接建立后立即检测权限，确保 CardKit 和消息功能可用
            perm_error = await manager.verify_permissions()
            if perm_error:
                logger.error(f"[ConnectLarkBot] 权限检测失败: {perm_error}")
                return ToolResult.error(
                    f"飞书机器人连接请求已提交，但检测到缺少必要权限，消息可能无法正常回复：\n{perm_error}"
                )

            config = await load_config()
            config.lark = LarkCredential(
                app_id=params.app_id,
                app_secret=params.app_secret,
                sandbox_id=tool_context.sandbox_id,
            )
            await save_config(config)

            return ToolResult(
                content=f"飞书机器人连接请求已提交（app_id={params.app_id}），请稍后在飞书中发消息确认是否可用"
            )
        except Exception as e:
            logger.error(f"[ConnectLarkBot] 连接失败: {e}")
            return ToolResult.error(f"连接失败: {e}")
