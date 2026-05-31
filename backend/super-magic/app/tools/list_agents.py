"""list_agents 工具：查询当前用户可用的所有员工列表

用于在代码生成阶段获取用户有权限使用的员工（agent）及其 agentId/code，
以便在生成微应用代码时直接写入正确的 agentId。
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.i18n import i18n
from app.infrastructure.sdk.magic_service.factory import get_magic_service_sdk
from app.infrastructure.sdk.magic_service.parameter.list_agents_parameter import ListAgentsParameter
from app.tools.core import BaseTool, BaseToolParams, tool

logger = get_logger(__name__)


class ListAgentsParams(BaseToolParams):
    """list_agents 工具参数"""

    name_filter: Optional[str] = Field(
        default=None,
        description=(
            "<!--zh: 可选。按员工名称模糊过滤，不区分大小写。"
            "例如：\"数据分析\" 会匹配名称中含有该关键词的员工。-->\n"
            "Optional. Fuzzy filter by agent name (case-insensitive). "
            "E.g. \"data analysis\" matches agents whose name contains the keyword."
        ),
    )


@tool()
class ListAgentsTool(BaseTool[ListAgentsParams]):
    """<!--zh
    查询当前用户可用的所有员工列表。返回每个员工的 code（agentId）、名称、描述和类型。
    适用于代码生成阶段需要获取真实 agentId 的场景，避免硬编码或猜测。
    -->
    List all agents available to the current user. Returns each agent's code (agentId),
    name, description and type. Use this during code generation to get real agentId values
    instead of hardcoding or guessing.
    """

    async def execute(self, tool_context: ToolContext, params: ListAgentsParams) -> ToolResult:
        try:
            magic_service = get_magic_service_sdk()
            parameter = ListAgentsParameter()
            result = await magic_service.agent.list_agents_async(parameter)
        except Exception as e:
            logger.error(f"Failed to list agents: {e}", exc_info=True)
            return ToolResult.error(f"获取员工列表失败: {e}")

        agents = result.get_agents()

        # Apply optional name filter
        if params.name_filter:
            keyword = params.name_filter.lower()
            agents = [a for a in agents if keyword in a.name.lower()]

        if not agents:
            return ToolResult(
                content="当前用户没有可用的员工。",
                extra_info={"total": 0, "agents": []},
            )

        # Format output for the model
        lines: List[str] = []
        lines.append(f"共 {len(agents)} 个可用员工：\n")
        for agent in agents:
            line = f"- **{agent.name}** (code: `{agent.code}`)"
            if agent.type:
                line += f" [{agent.type}]"
            if agent.description:
                line += f"\n  {agent.description}"
            lines.append(line)

        content = "\n".join(lines)

        return ToolResult(
            content=content,
            extra_info={
                "total": len(agents),
                "agents": [a.to_dict() for a in agents],
            },
        )

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] = None
    ) -> Dict:
        return {
            "action": "查询员工列表",
            "remark": "正在获取当前用户可用的员工列表...",
            "tool_name": tool_name,
        }

    async def get_after_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None
    ) -> Dict:
        extra = result.extra_info or {}
        total = extra.get("total", 0)
        return {
            "action": "查询员工列表",
            "remark": f"已获取 {total} 个可用员工",
            "tool_name": tool_name,
        }
