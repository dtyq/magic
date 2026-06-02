"""Summarize an indexed document.

Internal responsibility:
- Reads `document.index.json` and existing chunk files from an output directory.
- Produces a summary draft from already extracted content.
- Does not read the original large document or perform extraction/conversion.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.event.event import EventType
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool
from app.utils.document_parse.constants import DEFAULT_SUMMARY_CHUNK_MAX_CHARS
from app.utils.document_parse.service.document_summarizer import DocumentSummarizer

from .path_utils import (
    build_document_parse_after_remark,
    build_document_parse_error_detail,
    prepend_correction_note,
    require_existing_output_dir,
)


class SummarizeDocumentParams(BaseToolParams):
    output_dir: str = Field(
        ...,
        description="""<!--zh: 包含 document.index.json 和 chunks/ 的输出目录绝对路径，不接受相对路径-->
Absolute output directory containing document.index.json and chunks/. Relative paths are not accepted"""
    )


@tool()
class SummarizeDocument(AbstractFileTool[SummarizeDocumentParams], WorkspaceTool[SummarizeDocumentParams]):
    """<!--zh: 基于文档索引和已提取 chunks 生成摘要草稿。-->
    Summarize an indexed document from its chunks."""

    code_mode_only = True

    async def execute(self, tool_context: ToolContext, params: SummarizeDocumentParams) -> ToolResult:
        """Generate a summary draft from the extracted chunk set."""
        resolved, error = await require_existing_output_dir(params.output_dir, "output_dir")
        if error:
            return error
        assert resolved is not None
        output_dir = resolved.path
        summary = await DocumentSummarizer().summarize(output_dir, DEFAULT_SUMMARY_CHUNK_MAX_CHARS)
        summary_path = output_dir / "document.summary.md"
        if tool_context:
            await self._dispatch_file_event(tool_context, str(summary_path), EventType.FILE_CREATED)
        summary_path_str = str(summary_path)
        content = f"Document summary draft generated: `{summary_path_str}`"
        return ToolResult(content=prepend_correction_note(content, resolved.correction_note), extra_info={"summary_path": summary_path_str, "summary": summary})

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] | None = None
    ) -> Dict:
        name = Path((arguments or {}).get("output_dir", "document")).name
        return {
            "tool_name": tool_name,
            "action": i18n.translate("summarize_document", category="tool.actions"),
            "remark": i18n.translate("summarize_document.before", category="tool.messages", file_name=name),
        }

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] | None = None) -> Optional[ToolDetail]:
        if not result.ok:
            return build_document_parse_error_detail("summarize_document", result, arguments)
        if not result.extra_info:
            return None
        summary_path = result.extra_info.get("summary_path", "")
        summary = result.extra_info.get("summary", "")
        lines = [
            f"# {i18n.translate('summarize_document.detail_title', category='tool.messages')}",
            "",
            f"- {i18n.translate('document_parse.detail_summary_file', category='tool.messages')}: `{summary_path}`",
            "",
            str(summary),
        ]
        return ToolDetail(type=DisplayType.MD, data=FileContent(file_name="document_summary.md", content="\n".join(lines)))

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] | None = None) -> Dict:
        name = Path((arguments or {}).get("output_dir", "document")).name
        return build_document_parse_after_remark(tool_name, "summarize_document", "summarize_document", result, name)
