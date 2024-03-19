"""工具核心模块

提供工具架构的核心组件
"""

from app.tools.core.base_tool import BaseTool
from app.tools.core.base_tool_params import BaseToolParams
from app.tools.core.tool_decorator import tool
from app.tools.core.tool_factory import tool_factory

# Register the app metadata provider to agentlang
# This allows agentlang to access tool metadata without depending on app
from app.tools.core.app_metadata_provider import register_app_metadata_provider
register_app_metadata_provider()

__all__ = [
    "BaseTool",
    "BaseToolParams",
    "tool",
    "tool_factory"
]
