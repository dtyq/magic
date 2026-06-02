"""Extract selected document content into markdown chunks.

Internal responsibility:
- Reads only requested structural ranges and writes bounded Markdown chunks.
- Updates index/outline artifacts so chunks remain attached to the document map.
- Does not act as a blind whole-file converter or final summarizer.
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
from app.utils.document_parse.constants import DEFAULT_CHUNK_MAX_CHARS
from app.utils.document_parse.service.document_extractor import DocumentExtractor
from app.utils.document_parse.service.document_indexer import DocumentIndexer
from app.utils.document_parse.service.reading_state import ReadingStateStore

from .path_utils import (
    build_document_parse_after_remark,
    build_document_parse_error_detail,
    prepend_correction_note,
    require_absolute_path,
    require_valid_input_file,
)


class ExtractDocumentContentParams(BaseToolParams):
    input_path: str = Field(
        ...,
        description="""<!--zh: 要提取内容的文档绝对路径，不接受相对路径-->
Absolute document path to extract from. Relative paths are not accepted"""
    )
    output_dir: str = Field(
        ...,
        description="""<!--zh: 输出目录的绝对路径，用于保存 document.index.json、document.outline.md 和 chunks/-->
Absolute output directory for document.index.json, document.outline.md, and chunks/"""
    )
    ranges: Optional[str] = Field(
        None,
        description="""<!--zh: 可选范围表达式，例如页码 `1-3,8`，也可表示 slides、sections、sheets 或 cells-->
Optional range expression, e.g. pages `1-3,8`, slides, sections, sheets, or cells"""
    )


@tool()
class ExtractDocumentContent(AbstractFileTool[ExtractDocumentContentParams], WorkspaceTool[ExtractDocumentContentParams]):
    """<!--zh: 按范围提取文档内容，输出 Markdown chunks 并更新文档索引。-->
    Extract targeted document content into Markdown chunks and update the document index."""

    code_mode_only = True

    async def execute(self, tool_context: ToolContext, params: ExtractDocumentContentParams) -> ToolResult:
        """Extract selected document ranges into bounded Markdown chunks."""
        _, error = require_absolute_path(params.input_path, "input_path")
        if error:
            return error
        output_dir, error = require_absolute_path(params.output_dir, "output_dir")
        if error:
            return error
        assert output_dir is not None
        resolved, error = await require_valid_input_file(params.input_path, "input_path")
        if error:
            return error
        assert resolved is not None
        input_path = resolved.path
        extraction = await DocumentExtractor().extract(
            input_path,
            output_dir,
            ranges=params.ranges,
            mode="auto",
            max_chars=DEFAULT_CHUNK_MAX_CHARS,
            extract_images=True,
            exclude_watermark_images=True,
            deduplicate_repeated_images=True,
        )
        structure = await DocumentIndexer().build_from_extraction(input_path, output_dir, extraction)
        await ReadingStateStore().mark_extracted(
            output_dir,
            source_path=str(input_path),
            total_units=extraction.total_units,
            unit_type=structure.unit_type,
            file_type=structure.file_type,
            extracted_range=str(extraction.metadata.get("source_range") or params.ranges or "all"),
        )

        if tool_context:
            await self._dispatch_file_event(tool_context, str(output_dir), EventType.FILE_CREATED)

        output_dir_str = str(output_dir)
        content = (
            f"Document content extracted: `{input_path.name}`\n\n"
            f"- Output directory: `{output_dir_str}`\n"
            f"- Chunk count: {len(extraction.chunks)}\n"
            f"- Processed units: {extraction.pages_processed}/{extraction.total_units}\n"
            f"- Index: `{output_dir_str}/document.index.json`\n"
            f"- Outline: `{output_dir_str}/document.outline.md`\n"
            f"- Reading state: `{output_dir_str}/document.reading_state.json`"
        )
        extra = asdict(extraction)
        extra["index_path"] = f"{output_dir_str}/document.index.json"
        extra["outline_path"] = f"{output_dir_str}/document.outline.md"
        extra["structure"] = structure.to_dict()
        return ToolResult(content=prepend_correction_note(content, resolved.correction_note), extra_info=extra)

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] | None = None
    ) -> Dict:
        name = Path((arguments or {}).get("input_path", "document")).name
        return {
            "tool_name": tool_name,
            "action": i18n.translate("extract_document_content", category="tool.actions"),
            "remark": i18n.translate("extract_document_content.before", category="tool.messages", file_name=name),
        }

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] | None = None) -> Optional[ToolDetail]:
        if not result.ok:
            return build_document_parse_error_detail("extract_document_content", result, arguments)
        if not result.extra_info:
            return None
        chunks = result.extra_info.get("chunks") or []
        lines = [
            f"# {i18n.translate('extract_document_content.detail_title', category='tool.messages')}",
            "",
            f"- {i18n.translate('document_parse.detail_chunk_count', category='tool.messages')}: {len(chunks)}",
        ]
        for chunk in chunks[:20]:
            lines.append(f"- `{chunk.get('path')}`: {chunk.get('title')}")
        return ToolDetail(type=DisplayType.MD, data=FileContent(file_name="document_extraction.md", content="\n".join(lines)))

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] | None = None) -> Dict:
        name = Path((arguments or {}).get("input_path", "document")).name
        return build_document_parse_after_remark(tool_name, "extract_document_content", "extract_document_content", result, name)
