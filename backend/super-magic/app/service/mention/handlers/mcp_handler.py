"""MCP mention handler"""
from typing import Dict, List, Any
from app.service.mention.base import BaseMentionHandler, logger


class MCPHandler(BaseMentionHandler):
    """处理MCP插件类型的mention"""

    def get_type(self) -> str:
        return "mcp"

    async def get_tip(self, mention: Dict[str, Any]) -> str:
        """MCP类型的mention返回提示文本"""
        return "可按需求使用上述 MCP 工具"

    async def handle(self, mention: Dict[str, Any], index: int) -> List[str]:
        """处理MCP插件引用（异步）

        Args:
            mention: mention数据
            index: mention序号

        Returns:
            List[str]: 格式化的上下文行列表
        """
        mcp_name = mention.get('name', '未知MCP工具')

        logger.info(f"用户prompt添加MCP插件引用: {mcp_name}")

        return [f"{index}. [@mcp:{mcp_name}]"]
