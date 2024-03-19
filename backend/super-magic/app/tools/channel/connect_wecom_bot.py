"""
ConnectWecomBot — 建立企微 AI Bot WS 连接的 Tool。

不挂载到 LLM tool list，仅供 Skill snippet 通过 /api/skills/call_tool 调用。
"""
from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.channel.wecom.channel import WeComChannel
from app.channel.config import load_config, save_config, WeComCredential
from app.tools.core import BaseTool, BaseToolParams, tool

logger = get_logger(__name__)


class ConnectWecomBotParams(BaseToolParams):
    bot_id: str = Field(..., description="企业微信后台获取的 AI Bot ID")
    secret: str = Field(..., description="企业微信后台获取的 AI Bot Secret")


@tool()
class ConnectWecomBot(BaseTool[ConnectWecomBotParams]):
    """建立企业微信 AI Bot WebSocket 长连接。仅供 Skill snippet 调用，不挂载到 LLM。"""

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
                content=f"企业微信机器人连接请求已提交（bot_id={params.bot_id}），请稍候在企微中确认是否可对话"
            )
        except Exception as e:
            logger.error(f"[ConnectWecomBot] 连接失败: {e}")
            return ToolResult.error(f"连接失败: {e}")
