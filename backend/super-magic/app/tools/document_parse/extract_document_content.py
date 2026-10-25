"""Extract selected document content into markdown chunks.

Internal responsibility:
- Reads only requested structural ranges and writes bounded Markdown chunks.
- Updates index/outline artifacts so chunks remain attached to the document map.
- Does not act as a blind whole-file converter or final summarizer.
"""

from __future__ import annotations

from dataclasses import asdict
from pathlib import Path
from typing import Any, Dict, Literal, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.event.event import EventType
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool
from app.utils.async_file_utils import async_exists
from app.utils.document_parse.constants import DEFAULT_CHUNK_MAX_CHARS, INDEX_FILENAME
from app.utils.document_parse.service.document_extractor import DocumentExtractor
from app.utils.document_parse.service.document_indexer import DocumentIndexer
from app.utils.document_parse.service.document_output_version import DocumentOutputVersionResolver
from app.utils.document_parse.service.reading_state import ReadingStateStore

from .path_utils import (
    build_document_parse_after_remark,
    build_document_parse_error_detail,
    build_document_parse_model_error,
    prepend_correction_note,
    require_absolute_path,
    require_valid_input_file,
)


class ExtractDocumentContentParams(BaseToolParams):
    input_path: str = Field(
        ...,
        description="Absolute document path to extract from. Relative paths are not accepted."
    )
    output_dir: str = Field(
        ...,
        description="Absolute output directory for document.index.json, document.outline.md, and chunks/."
    )
    ranges: Optional[str] = Field(
        None,
        description="Optional range expression for pages, slides, sections, sheets, or cells, such as `1-3,8`."
    )
    asset_strategy: Literal["auto", "text_only", "page_visual", "reusable_assets", "full_fidelity"] = Field(
        "auto",
        description=(
            "Asset output strategy: text_only, page_visual, reusable_assets, full_fidelity, or auto. "
            "Use auto after inspection and sampling when the best strategy should be recommended."
        ),
    )


@tool(code_mode_only=True)
class ExtractDocumentContent(AbstractFileTool[ExtractDocumentContentParams], WorkspaceTool[ExtractDocumentContentParams]):
    """Extract targeted document content into Markdown chunks and update the document index."""

    async def execute(self, tool_context: ToolContext, params: ExtractDocumentContentParams) -> ToolResult:
        """Extract selected document ranges into bounded Markdown chunks."""
        _, error = require_absolute_path(params.input_path, "input_path")
        if error:
            return error
        output_dir, error = require_absolute_path(params.output_dir, "output_dir")
        if error:
            return error
        assert output_dir is not None
        requested_output_dir = output_dir
        resolved, error = await require_valid_input_file(params.input_path, "input_path")
        if error:
            return error
        assert resolved is not None
        input_path = resolved.path
        try:
            if params.asset_strategy != "auto" and await async_exists(output_dir / INDEX_FILENAME):
                output_dir = await DocumentOutputVersionResolver.resolve(
                    output_dir,
                    input_path,
                    params.asset_strategy,
                    params.asset_strategy,
                )
            extraction = await DocumentExtractor().extract(
                input_path,
                output_dir,
                ranges=params.ranges,
                mode="auto",
                max_chars=DEFAULT_CHUNK_MAX_CHARS,
                asset_strategy=params.asset_strategy,
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
        except Exception as exc:
            return ToolResult.error(build_document_parse_model_error("extract_document_content", str(exc), input_path=str(input_path), output_dir=str(output_dir)))

        output_dir_str = str(output_dir)
        content = (
            f"Document content extracted: `{input_path.name}`\n\n"
            f"- Output directory: `{output_dir_str}`\n"
            f"- Chunk count: {len(extraction.chunks)}\n"
            f"- Processed units: {extraction.pages_processed}/{extraction.total_units}\n"
            f"- Execution batches: {len(extraction.metadata.get('execution_batches') or [1])}\n"
            f"- Asset strategy: {(extraction.metadata.get('asset_strategy') or {}).get('resolved_strategy', params.asset_strategy)}\n"
            f"- Index: `{output_dir_str}/document.index.json`\n"
            f"- Outline: `{output_dir_str}/document.outline.md`\n"
            f"- Reading state: `{output_dir_str}/document.reading_state.json`"
        )
        execution_limits = extraction.metadata.get("execution_limits") or {}
        if execution_limits.get("max_units_per_call"):
            content += (
                f"\n- Execution limit: {execution_limits['max_units_per_call']} units per call; "
                "batching was handled automatically"
            )
        extra = asdict(extraction)
        extra["index_path"] = f"{output_dir_str}/document.index.json"
        extra["outline_path"] = f"{output_dir_str}/document.outline.md"
        extra["structure"] = structure.to_dict()
        extra["requested_output_dir"] = str(requested_output_dir)
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
