"""Plan the next bounded document reading step.

Internal responsibility:
- Reads existing document-converter artifacts and returns a recommended next action.
- Does not extract, convert, summarize, or visually understand content.
- Updates document.reading_state.json with the current recommendation.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool
from app.utils.async_file_utils import async_exists, async_is_dir
from app.utils.document_parse.service.document_reading_planner import DocumentReadingPlanner

from .path_utils import require_absolute_path


class PlanDocumentReadingParams(BaseToolParams):
    output_dir: str = Field(
        ...,
        description="""<!--zh: 文档解析输出目录的绝对路径，目录中应包含抽样、索引或 chunk 产物-->
Absolute document output directory containing samples, index, or chunks"""
    )
    goal: str = Field(
        "",
        description="""<!--zh: 当前阅读目标，例如总结全文、查找条款、提取审批意见-->
Current reading goal, such as summarizing, finding clauses, or extracting decisions"""
    )
    budget: Optional[str] = Field(
        None,
        description="""<!--zh: 可选阅读预算，例如 `20 pages` 或 `10 images`-->
Optional reading budget such as `20 pages` or `10 images`"""
    )


@tool()
class PlanDocumentReading(AbstractFileTool[PlanDocumentReadingParams], WorkspaceTool[PlanDocumentReadingParams]):
    """<!--zh: 基于已生成的文档产物规划下一步阅读动作。-->
    Plan the next progressive document reading action."""

    code_mode_only = True

    async def execute(self, tool_context: ToolContext, params: PlanDocumentReadingParams) -> ToolResult:
        """Return the next recommended bounded document reading step."""
        output_dir, error = require_absolute_path(params.output_dir, "output_dir")
        if error:
            return error
        if not await async_exists(output_dir):
            return ToolResult.error(f"Output directory does not exist: {params.output_dir}")
        if not await async_is_dir(output_dir):
            return ToolResult.error(f"Output path is not a directory: {params.output_dir}")

        plan = await DocumentReadingPlanner().plan(output_dir, goal=params.goal, budget=params.budget)
        content = "\n".join([
            "Document reading plan completed.",
            "",
            f"- Recommended action: `{plan['recommended_action']}`",
            f"- Recommended mode: `{plan['recommended_mode']}`",
            f"- Recommended range: `{plan.get('recommended_range') or 'not specified'}`",
            f"- Max images: {plan.get('max_images')}",
            f"- Reason: {plan.get('reason')}",
            f"- State: `{plan.get('state_path')}`",
        ])
        if plan.get("risks"):
            content += "\n" + "\n".join(f"- Risk: {risk}" for risk in plan["risks"])
        return ToolResult(content=content, extra_info=plan)

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] = None
    ) -> Dict:
        name = Path((arguments or {}).get("output_dir", "document")).name
        return {
            "tool_name": tool_name,
            "action": i18n.translate("plan_document_reading", category="tool.actions"),
            "remark": i18n.translate("plan_document_reading.before", category="tool.messages", file_name=name),
        }

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        if not result.ok or not result.extra_info:
            return None
        info = result.extra_info
        lines = [
            f"# {i18n.translate('plan_document_reading.detail_title', category='tool.messages')}",
            "",
            f"- {i18n.translate('document_parse.detail_recommended_action', category='tool.messages')}: `{info.get('recommended_action')}`",
            f"- {i18n.translate('document_parse.detail_recommended_range', category='tool.messages')}: `{info.get('recommended_range') or ''}`",
            f"- {i18n.translate('document_parse.detail_strategy', category='tool.messages')}: {info.get('reason', '')}",
        ]
        return ToolDetail(type=DisplayType.MD, data=FileContent(file_name="document_reading_plan.md", content="\n".join(lines)))

    async def get_after_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None
    ) -> Dict:
        name = Path((arguments or {}).get("output_dir", "document")).name
        key = "plan_document_reading.after_success" if result.ok else "plan_document_reading.after_failed"
        return {
            "tool_name": tool_name,
            "action": i18n.translate("plan_document_reading", category="tool.actions"),
            "remark": i18n.translate(key, category="tool.messages", file_name=name),
        }
