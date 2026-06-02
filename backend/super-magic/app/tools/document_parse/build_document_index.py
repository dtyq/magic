"""Build a document index without full extraction.

Internal responsibility:
- Creates the navigation artifacts for a document workspace.
- Writes `document.index.json` for machines and `document.outline.md` for model reading.
- Does not extract body content, generate chunks, summarize, or convert formats.
"""

from __future__ import annotations

from dataclasses import asdict
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
from app.utils.document_parse.service.document_indexer import DocumentIndexer
from .path_utils import prepend_correction_note, require_absolute_path, require_valid_input_file


class BuildDocumentIndexParams(BaseToolParams):
    input_path: str = Field(
        ...,
        description="""<!--zh: 要建立索引的文档绝对路径，不接受相对路径-->
Absolute document path to index. Relative paths are not accepted"""
    )
    output_dir: str = Field(
        ...,
        description="""<!--zh: 输出目录的绝对路径，用于保存 document.index.json 和 document.outline.md-->
Absolute output directory for document.index.json and document.outline.md"""
    )


@tool()
class BuildDocumentIndex(AbstractFileTool[BuildDocumentIndexParams], WorkspaceTool[BuildDocumentIndexParams]):
    """<!--zh: 为文档生成机器可读索引和模型可读目录。-->
    Build a machine-readable document index and model-readable outline."""

    code_mode_only = True

    async def execute(self, tool_context: ToolContext, params: BuildDocumentIndexParams) -> ToolResult:
        """Write an empty index/outline based on document structure only."""
        _, error = require_absolute_path(params.input_path, "input_path")
        if error:
            return error
        output_dir, error = require_absolute_path(params.output_dir, "output_dir")
        if error:
            return error
        resolved, error = await require_valid_input_file(params.input_path, "input_path")
        if error:
            return error
        assert resolved is not None
        input_path = resolved.path
        structure = await DocumentIndexer().build_empty(input_path, output_dir)
        if tool_context:
            await self._dispatch_file_event(tool_context, str(output_dir / "document.index.json"), EventType.FILE_CREATED)
            await self._dispatch_file_event(tool_context, str(output_dir / "document.outline.md"), EventType.FILE_CREATED)
        return ToolResult(
            content=prepend_correction_note(
                f"Document index generated: `{output_dir}/document.index.json` and `{output_dir}/document.outline.md`",
                resolved.correction_note,
            ),
            extra_info={"output_dir": str(output_dir), "structure": structure.to_dict()},
        )

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] = None
    ) -> Dict:
        name = Path((arguments or {}).get("input_path", "document")).name
        return {
            "tool_name": tool_name,
            "action": i18n.translate("build_document_index", category="tool.actions"),
            "remark": i18n.translate("build_document_index.before", category="tool.messages", file_name=name),
        }

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        if not result.ok or not result.extra_info:
            return None
        output_dir = result.extra_info.get("output_dir", "")
        structure = result.extra_info.get("structure", {}) or {}
        lines = [
            f"# {i18n.translate('build_document_index.detail_title', category='tool.messages')}",
            "",
            f"- {i18n.translate('document_parse.detail_output_dir', category='tool.messages')}: `{output_dir}`",
            f"- {i18n.translate('document_parse.detail_index_file', category='tool.messages')}: `{output_dir}/document.index.json`",
            f"- {i18n.translate('document_parse.detail_outline_file', category='tool.messages')}: `{output_dir}/document.outline.md`",
            f"- {i18n.translate('document_parse.detail_node_count', category='tool.messages')}: {len(structure.get('nodes') or [])}",
        ]
        return ToolDetail(type=DisplayType.MD, data=FileContent(file_name="document_index.md", content="\n".join(lines)))

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None) -> Dict:
        name = Path((arguments or {}).get("input_path", "document")).name
        key = "build_document_index.after_success" if result.ok else "build_document_index.after_failed"
        return {
            "tool_name": tool_name,
            "action": i18n.translate("build_document_index", category="tool.actions"),
            "remark": i18n.translate(key, category="tool.messages", file_name=name),
        }
