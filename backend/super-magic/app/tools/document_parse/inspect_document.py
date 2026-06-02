"""Inspect a document before expensive extraction.

Internal responsibility:
- Low-cost planning step for the document-converter skill.
- Returns document type, scale, structural unit, outline, samples, and strategy.
- Does not extract full content, write chunks, summarize, or convert formats.
"""

from __future__ import annotations

from dataclasses import asdict
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
from app.utils.document_parse.service.document_inspector import DocumentInspector
from .path_utils import prepend_correction_note, require_valid_input_file


class InspectDocumentParams(BaseToolParams):
    input_path: str = Field(
        ...,
        description="""<!--zh: 要探测的文档绝对路径，不接受相对路径-->
Absolute document path to inspect. Relative paths are not accepted"""
    )


@tool()
class InspectDocument(AbstractFileTool[InspectDocumentParams], WorkspaceTool[InspectDocumentParams]):
    """<!--zh: 低成本探测文档结构，用于大文件提取前规划阅读范围。-->
    Inspect document structure and scale before extraction."""

    code_mode_only = True

    async def execute(self, tool_context: ToolContext, params: InspectDocumentParams) -> ToolResult:
        """Return a lightweight document profile for planning later reads."""
        resolved, error = await require_valid_input_file(params.input_path, "input_path")
        if error:
            return error
        assert resolved is not None
        path = resolved.path
        profile = await DocumentInspector().inspect(path)
        data = asdict(profile)
        outline_count = len(profile.outline)
        content = (
            f"Document inspection completed: `{profile.file_name}`\n\n"
            f"- Type: {profile.file_type}\n"
            f"- Structure unit: {profile.unit_type}\n"
            f"- Unit count: {profile.total_units}\n"
            f"- Outline nodes: {outline_count}\n"
            f"- Recommended strategy: {profile.recommended_strategy}"
        )
        return ToolResult(content=prepend_correction_note(content, resolved.correction_note), extra_info=data)

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] = None
    ) -> Dict:
        name = Path((arguments or {}).get("input_path", "document")).name
        return {
            "tool_name": tool_name,
            "action": i18n.translate("inspect_document", category="tool.actions"),
            "remark": i18n.translate("inspect_document.before", category="tool.messages", file_name=name),
        }

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        if not result.ok or not result.extra_info:
            return None
        info = result.extra_info
        lines = [
            f"# {i18n.translate('inspect_document.detail_title', category='tool.messages')}",
            "",
            f"## {info.get('file_name', 'Document')}",
            "",
            f"- {i18n.translate('document_parse.detail_type', category='tool.messages')}: `{info.get('file_type')}`",
            f"- {i18n.translate('document_parse.detail_unit_type', category='tool.messages')}: `{info.get('unit_type')}`",
            f"- {i18n.translate('document_parse.detail_total_units', category='tool.messages')}: `{info.get('total_units')}`",
            f"- {i18n.translate('document_parse.detail_strategy', category='tool.messages')}: {info.get('recommended_strategy', '')}",
        ]
        return ToolDetail(type=DisplayType.MD, data=FileContent(file_name="document_inspection.md", content="\n".join(lines)))

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None) -> Dict:
        name = Path((arguments or {}).get("input_path", "document")).name
        key = "inspect_document.after_success" if result.ok else "inspect_document.after_failed"
        return {
            "tool_name": tool_name,
            "action": i18n.translate("inspect_document", category="tool.actions"),
            "remark": i18n.translate(key, category="tool.messages", file_name=name),
        }
