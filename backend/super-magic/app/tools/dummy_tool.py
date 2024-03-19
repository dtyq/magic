"""
假工具模块 - 用于测试目的，不执行任何实际操作
"""

from typing import Dict, Any
from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.tools.core import BaseTool, BaseToolParams, tool


class DummyToolParams(BaseToolParams):
    pass


@tool()
class DummyTool(BaseTool[DummyToolParams]):
    """假工具 - 不执行任何操作

    这是一个用于测试目的的假工具，调用后不会执行任何实际操作，
    仅返回成功状态。
    """

    async def execute(self, tool_context: ToolContext, params: DummyToolParams) -> ToolResult:
        """
        执行工具（实际上什么都不做）

        Args:
            tool_context: 工具上下文
            params: 工具参数（空参数）

        Returns:
            ToolResult: 始终返回成功状态
        """
        # 什么都不做，直接返回成功
        return ToolResult(
            name=self.name,
            content="Dummy tool executed successfully - no operation performed",
            ok=True
        )
