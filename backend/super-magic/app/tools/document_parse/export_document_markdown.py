"""Export a document to Markdown artifacts.

Internal responsibility:
- Composite Code Mode tool for the common "convert this document to Markdown" request.
- Runs extraction, updates index/outline, and writes an optional combined Markdown file.
- Returns artifact paths only; it does not stream large document content back to the model.
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
from app.utils.async_file_utils import (
    CopyConflict,
    async_copytree,
    async_exists,
    async_is_dir,
    async_mkdir,
    async_read_json,
    async_read_text,
    async_rmtree,
)
from app.utils.document_parse.constants import (
    ASSETS_DIRNAME,
    DEFAULT_CHUNK_MAX_CHARS,
    INDEX_FILENAME,
    VISUAL_RESULTS_DIRNAME,
)
from app.utils.document_parse.models import DocumentChunk
from app.utils.document_parse.output.markdown_writer import MarkdownWriter
from app.utils.document_parse.service.document_artifact_mode import DocumentArtifactModeSelector
from app.utils.document_parse.service.document_extractor import DocumentExtractor
from app.utils.document_parse.service.document_indexer import DocumentIndexer
from app.utils.document_parse.service.document_inspector import DocumentInspector
from app.utils.document_parse.service.reading_state import ReadingStateStore
from app.utils.document_parse.structure.range_parser import RangeParser

from .path_utils import (
    build_document_parse_after_remark,
    build_document_parse_error_detail,
    build_document_parse_model_error,
    prepend_correction_note,
    require_absolute_path,
    require_valid_input_file,
)


class ExportDocumentMarkdownParams(BaseToolParams):
    input_path: str = Field(
        ...,
        description="""<!--zh: 要导出为 Markdown 的文档绝对路径，不接受相对路径-->
Absolute document path to export as Markdown. Relative paths are not accepted"""
    )
    output_dir: str = Field(
        ...,
        description="""<!--zh: Markdown 导出产物的输出目录绝对路径-->
Absolute output directory for Markdown export artifacts"""
    )
    ranges: Optional[str] = Field(
        None,
        description="""<!--zh: 可选范围表达式；为空表示导出整个文档-->
Optional range expression. Omit to export the whole document"""
    )


@tool()
class ExportDocumentMarkdown(AbstractFileTool[ExportDocumentMarkdownParams], WorkspaceTool[ExportDocumentMarkdownParams]):
    """<!--zh: 将文档导出为 Markdown chunks，并按需生成合并版 Markdown 文件。-->
    Export a document to Markdown chunks and an optional combined Markdown file."""

    code_mode_only = True

    async def execute(self, tool_context: ToolContext, params: ExportDocumentMarkdownParams) -> ToolResult:
        """Export selected or full document content as Markdown artifacts."""
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
        try:
            profile = await DocumentInspector().inspect(input_path)
            artifact_mode = DocumentArtifactModeSelector.resolve("auto", profile, DEFAULT_CHUNK_MAX_CHARS)
        except ValueError as exc:
            return ToolResult.error(build_document_parse_model_error("export_document_markdown", str(exc), input_path=str(input_path), output_dir=str(output_dir)))
        except Exception as exc:
            return ToolResult.error(build_document_parse_model_error("export_document_markdown", str(exc), input_path=str(input_path), output_dir=str(output_dir)))

        try:
            if artifact_mode == "simple":
                return await self._execute_simple(tool_context, params, input_path, output_dir, profile.file_type, resolved.correction_note)
            return await self._execute_progressive(tool_context, params, input_path, output_dir, resolved.correction_note)
        except Exception as exc:
            return ToolResult.error(build_document_parse_model_error("export_document_markdown", str(exc), input_path=str(input_path), output_dir=str(output_dir)))

    async def _execute_progressive(
        self,
        tool_context: ToolContext,
        params: ExportDocumentMarkdownParams,
        input_path: Path,
        output_dir: Path,
        correction_note: str | None,
    ) -> ToolResult:
        existing_chunks = await self._load_existing_chunks_for_export(input_path, output_dir, params.ranges)
        if existing_chunks:
            return await self._write_existing_progressive_export(tool_context, input_path, output_dir, existing_chunks, correction_note)

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

        combined_path: Path | None = None
        combined_filename = "document.md"
        if combined_filename:
            combined_path = await MarkdownWriter.write_combined(output_dir / combined_filename, extraction.chunks, input_path.stem)
            if tool_context:
                await self._dispatch_file_event(tool_context, str(combined_path), EventType.FILE_CREATED)

        if tool_context:
            await self._dispatch_file_event(tool_context, str(output_dir), EventType.FILE_CREATED)

        output_dir_str = str(output_dir)
        combined_path_str = str(combined_path) if combined_path else None
        content_lines = [
            f"Document Markdown export completed: `{input_path.name}`",
            "",
            f"- Output directory: `{output_dir_str}`",
            f"- Chunk count: {len(extraction.chunks)}",
            f"- Index: `{output_dir_str}/document.index.json`",
            f"- Outline: `{output_dir_str}/document.outline.md`",
            f"- Reading state: `{output_dir_str}/document.reading_state.json`",
        ]
        if combined_path_str:
            content_lines.append(f"- Combined Markdown: `{combined_path_str}`")

        extra = asdict(extraction)
        extra["index_path"] = f"{output_dir_str}/document.index.json"
        extra["outline_path"] = f"{output_dir_str}/document.outline.md"
        extra["combined_path"] = combined_path_str
        extra["artifact_mode"] = "progressive"
        extra["structure"] = structure.to_dict()
        return ToolResult(content=prepend_correction_note("\n".join(content_lines), correction_note), extra_info=extra)

    async def _write_existing_progressive_export(
        self,
        tool_context: ToolContext,
        input_path: Path,
        output_dir: Path,
        chunks: list[DocumentChunk],
        correction_note: str | None,
    ) -> ToolResult:
        combined_path = await MarkdownWriter.write_combined(output_dir / "document.md", chunks, input_path.stem)
        if tool_context:
            await self._dispatch_file_event(tool_context, str(combined_path), EventType.FILE_CREATED)
            await self._dispatch_file_event(tool_context, str(output_dir), EventType.FILE_CREATED)
        output_dir_str = str(output_dir)
        combined_path_str = str(combined_path)
        content_lines = [
            f"Document Markdown export completed from existing chunks: `{input_path.name}`",
            "",
            f"- Output directory: `{output_dir_str}`",
            f"- Chunk count: {len(chunks)}",
            f"- Index: `{output_dir_str}/document.index.json`",
            f"- Outline: `{output_dir_str}/document.outline.md`",
            f"- Combined Markdown: `{combined_path_str}`",
        ]
        return ToolResult(
            content=prepend_correction_note("\n".join(content_lines), correction_note),
            extra_info={
                "chunks": [asdict(chunk) for chunk in chunks],
                "index_path": f"{output_dir_str}/document.index.json",
                "outline_path": f"{output_dir_str}/document.outline.md",
                "combined_path": combined_path_str,
                "artifact_mode": "progressive",
                "reused_existing_chunks": True,
            },
        )

    async def _execute_simple(
        self,
        tool_context: ToolContext,
        params: ExportDocumentMarkdownParams,
        input_path: Path,
        output_dir: Path,
        file_type: str,
        correction_note: str | None,
    ) -> ToolResult:
        await async_mkdir(output_dir, parents=True, exist_ok=True)
        temp_dir = output_dir / ".simple-export-tmp"
        if await async_exists(temp_dir):
            await async_rmtree(temp_dir)
        combined_path = output_dir / "document.md"
        try:
            extraction = await DocumentExtractor().extract(
                input_path,
                temp_dir,
                ranges=params.ranges,
                mode="auto",
                max_chars=DEFAULT_CHUNK_MAX_CHARS,
                extract_images=True,
                exclude_watermark_images=True,
                deduplicate_repeated_images=True,
            )
            await MarkdownWriter.write_combined(combined_path, extraction.chunks, input_path.stem)
            await self._copy_simple_optional_dir(temp_dir, output_dir, ASSETS_DIRNAME)
            await self._copy_simple_optional_dir(temp_dir, output_dir, VISUAL_RESULTS_DIRNAME)
        finally:
            if await async_exists(temp_dir):
                await async_rmtree(temp_dir)

        if tool_context:
            await self._dispatch_file_event(tool_context, str(combined_path), EventType.FILE_CREATED)
            await self._dispatch_file_event(tool_context, str(output_dir), EventType.FILE_CREATED)

        content_lines = [
            f"Document Markdown export completed: `{input_path.name}`",
            "",
            "- Artifact mode: simple",
            f"- Output directory: `{output_dir}`",
            f"- Main Markdown: `{combined_path}`",
            f"- Chunk count: {len(extraction.chunks)}",
        ]
        if file_type == "spreadsheet":
            content_lines.append("- Note: spreadsheet files may need targeted sheet/range extraction for large tables.")

        extra = asdict(extraction)
        for chunk in extra.get("chunks") or []:
            chunk["path"] = str(combined_path)
        extra["artifact_mode"] = "simple"
        extra["combined_path"] = str(combined_path)
        extra["main_markdown_path"] = str(combined_path)
        extra["index_path"] = None
        extra["outline_path"] = None
        extra["reading_state_path"] = None
        return ToolResult(content=prepend_correction_note("\n".join(content_lines), correction_note), extra_info=extra)

    @staticmethod
    async def _copy_simple_optional_dir(temp_dir: Path, output_dir: Path, dirname: str) -> None:
        source = temp_dir / dirname
        if await async_exists(source) and await async_is_dir(source):
            await async_copytree(source, output_dir / dirname, on_conflict=CopyConflict.OVERWRITE)

    async def _load_existing_chunks_for_export(
        self,
        input_path: Path,
        output_dir: Path,
        ranges: Optional[str],
    ) -> list[DocumentChunk]:
        index_path = output_dir / INDEX_FILENAME
        if not await async_exists(index_path):
            return []
        index = await async_read_json(index_path)
        if str(index.get("source_path") or "") != str(input_path):
            return []
        chunks_data = index.get("chunks") or []
        if not chunks_data:
            return []
        total_units = int(index.get("total_units") or 0)
        if not self._chunks_cover_requested_range(chunks_data, ranges, total_units):
            return []
        chunks: list[DocumentChunk] = []
        for item in chunks_data:
            chunk_path_text = str(item.get("path") or "")
            chunk_path = output_dir / chunk_path_text
            if not chunk_path_text or not await async_exists(chunk_path):
                return []
            chunks.append(DocumentChunk(
                chunk_id=str(item.get("chunk_id") or ""),
                title=str(item.get("title") or ""),
                content=await async_read_text(chunk_path, errors="ignore"),
                source_range=str(item.get("source_range") or ""),
                path=chunk_path_text,
                parent_node_id=item.get("parent_node_id"),
                previous_chunk_id=item.get("previous_chunk_id"),
                next_chunk_id=item.get("next_chunk_id"),
                metadata=dict(item.get("metadata") or {}),
            ))
        return chunks

    @staticmethod
    def _chunks_cover_requested_range(chunks: list[dict], ranges: Optional[str], total_units: int) -> bool:
        if not chunks:
            return False
        if total_units <= 0:
            return ranges is None
        requested = set(RangeParser.parse_numeric(ranges, total_units) if ranges else range(1, total_units + 1))
        covered: set[int] = set()
        for chunk in chunks:
            source_range = str(chunk.get("source_range") or "")
            normalized = (
                source_range
                .removeprefix("pages:")
                .removeprefix("slides:")
                .removeprefix("sections:")
                .strip()
            )
            if normalized == "all":
                covered.update(range(1, total_units + 1))
            else:
                covered.update(RangeParser.parse_numeric(normalized, total_units))
        return bool(requested) and requested.issubset(covered)

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] | None = None
    ) -> Dict:
        name = Path((arguments or {}).get("input_path", "document")).name
        return {
            "tool_name": tool_name,
            "action": i18n.translate("export_document_markdown", category="tool.actions"),
            "remark": i18n.translate("export_document_markdown.before", category="tool.messages", file_name=name),
        }

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] | None = None) -> Optional[ToolDetail]:
        if not result.ok:
            return build_document_parse_error_detail("export_document_markdown", result, arguments)
        if not result.extra_info:
            return None
        chunks = result.extra_info.get("chunks") or []
        lines = [
            f"# {i18n.translate('export_document_markdown.detail_title', category='tool.messages')}",
            "",
            f"- Artifact mode: `{result.extra_info.get('artifact_mode', 'progressive')}`",
            f"- {i18n.translate('document_parse.detail_chunk_count', category='tool.messages')}: {len(chunks)}",
        ]
        if result.extra_info.get("index_path"):
            lines.append(f"- {i18n.translate('document_parse.detail_index_file', category='tool.messages')}: `{result.extra_info.get('index_path', '')}`")
        if result.extra_info.get("outline_path"):
            lines.append(f"- {i18n.translate('document_parse.detail_outline_file', category='tool.messages')}: `{result.extra_info.get('outline_path', '')}`")
        combined_path = result.extra_info.get("combined_path")
        if combined_path:
            lines.append(f"- {i18n.translate('document_parse.detail_combined_file', category='tool.messages')}: `{combined_path}`")
        return ToolDetail(type=DisplayType.MD, data=FileContent(file_name="document_markdown_export.md", content="\n".join(lines)))

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] | None = None) -> Dict:
        name = Path((arguments or {}).get("input_path", "document")).name
        return build_document_parse_after_remark(tool_name, "export_document_markdown", "export_document_markdown", result, name)
