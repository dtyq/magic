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
from app.utils.async_file_utils import async_exists, async_is_dir
from app.utils.document_parse.output.markdown_writer import MarkdownWriter
from app.utils.document_parse.service.document_extractor import DocumentExtractor
from app.utils.document_parse.service.document_indexer import DocumentIndexer

from .path_utils import require_absolute_path


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
    mode: str = Field(
        "auto",
        description="""<!--zh: 提取模式。PDF 可使用 local_text 或 visual-->
Extraction mode. For PDF use local_text or visual"""
    )
    max_chars: int = Field(
        12000,
        description="""<!--zh: 每个 chunk 的最大字符数-->
Maximum characters per chunk"""
    )
    combined_filename: str = Field(
        "document.md",
        description="""<!--zh: 合并版 Markdown 文件名，留空则不生成合并版文件-->
Combined Markdown file name. Leave empty to skip writing a combined file"""
    )


@tool()
class ExportDocumentMarkdown(AbstractFileTool[ExportDocumentMarkdownParams], WorkspaceTool[ExportDocumentMarkdownParams]):
    """<!--zh: 将文档导出为 Markdown chunks，并按需生成合并版 Markdown 文件。-->
    Export a document to Markdown chunks and an optional combined Markdown file."""

    code_mode_only = True

    async def execute(self, tool_context: ToolContext, params: ExportDocumentMarkdownParams) -> ToolResult:
        """Export selected or full document content as Markdown artifacts."""
        input_path, error = require_absolute_path(params.input_path, "input_path")
        if error:
            return error
        output_dir, error = require_absolute_path(params.output_dir, "output_dir")
        if error:
            return error
        if not await async_exists(input_path):
            return ToolResult.error(f"File does not exist: {params.input_path}")
        if await async_is_dir(input_path):
            return ToolResult.error(f"Input path is a directory, not a file: {params.input_path}")
        if params.mode not in {"auto", "local_text", "visual"}:
            return ToolResult.error("Unsupported extraction mode. For PDF, use local_text or visual.")

        extraction = await DocumentExtractor().extract(
            input_path,
            output_dir,
            ranges=params.ranges,
            mode=params.mode,
            max_chars=params.max_chars,
            extract_images=True,
        )
        structure = await DocumentIndexer().build_from_extraction(input_path, output_dir, extraction)

        combined_path: Path | None = None
        combined_filename = params.combined_filename.strip()
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
        ]
        if combined_path_str:
            content_lines.append(f"- Combined Markdown: `{combined_path_str}`")

        extra = asdict(extraction)
        extra["index_path"] = f"{output_dir_str}/document.index.json"
        extra["outline_path"] = f"{output_dir_str}/document.outline.md"
        extra["combined_path"] = combined_path_str
        extra["structure"] = structure.to_dict()
        return ToolResult(content="\n".join(content_lines), extra_info=extra)

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] = None
    ) -> Dict:
        name = Path((arguments or {}).get("input_path", "document")).name
        return {
            "tool_name": tool_name,
            "action": i18n.translate("export_document_markdown", category="tool.actions"),
            "remark": i18n.translate("export_document_markdown.before", category="tool.messages", file_name=name),
        }

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        if not result.ok or not result.extra_info:
            return None
        chunks = result.extra_info.get("chunks") or []
        lines = [
            f"# {i18n.translate('export_document_markdown.detail_title', category='tool.messages')}",
            "",
            f"- {i18n.translate('document_parse.detail_chunk_count', category='tool.messages')}: {len(chunks)}",
            f"- {i18n.translate('document_parse.detail_index_file', category='tool.messages')}: `{result.extra_info.get('index_path', '')}`",
            f"- {i18n.translate('document_parse.detail_outline_file', category='tool.messages')}: `{result.extra_info.get('outline_path', '')}`",
        ]
        combined_path = result.extra_info.get("combined_path")
        if combined_path:
            lines.append(f"- {i18n.translate('document_parse.detail_combined_file', category='tool.messages')}: `{combined_path}`")
        return ToolDetail(type=DisplayType.MD, data=FileContent(file_name="document_markdown_export.md", content="\n".join(lines)))

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None) -> Dict:
        name = Path((arguments or {}).get("input_path", "document")).name
        key = "export_document_markdown.after_success" if result.ok else "export_document_markdown.after_failed"
        return {
            "tool_name": tool_name,
            "action": i18n.translate("export_document_markdown", category="tool.actions"),
            "remark": i18n.translate(key, category="tool.messages", file_name=name),
        }
