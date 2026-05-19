"""MCP mention handler"""
from typing import TYPE_CHECKING, Any, Dict, List, Optional
from app.service.mention.base import BaseMentionHandler, logger

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext


class MCPHandler(BaseMentionHandler):
    """处理MCP插件类型的mention"""

    def get_type(self) -> str:
        return "mcp"

    async def get_tip(self, mention: Dict[str, Any], agent_context: Optional["AgentContext"] = None) -> str:
        return "Use the referenced MCP tool as needed"

    async def handle(self, mention: Dict[str, Any], index: int, agent_context: Optional["AgentContext"] = None) -> List[str]:
        mcp_name = mention.get("name", "unknown-mcp-tool")

        logger.info(f"用户prompt添加MCP插件引用: {mcp_name}")

        return [f"{index}. [@mcp:{mcp_name}]"]
