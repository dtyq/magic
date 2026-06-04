"""Convert document formats without semantic extraction.

Internal responsibility:
- Performs raw format conversion only, such as Office to PDF or PDF pages to images.
- Returns converted file paths for downstream steps.
- Does not inspect semantics, extract text, build indexes, chunk content, or summarize.
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
from app.utils.document_parse.service.document_format_converter import DocumentFormatConverter

from .path_utils import (
    build_document_parse_after_remark,
    build_document_parse_error_detail,
    build_document_parse_model_error,
    prepend_correction_note,
    require_absolute_path,
    require_existing_input_file,
)


class ConvertDocumentFormatParams(BaseToolParams):
    input_path: str = Field(
        ...,
        description="""<!--zh: 要转换的输入文档绝对路径，不接受相对路径-->
Absolute input document path. Relative paths are not accepted"""
    )
    output_dir: str = Field(
        ...,
        description="""<!--zh: 转换后文件输出目录的绝对路径，不接受相对路径-->
Absolute directory for converted files. Relative paths are not accepted"""
    )
    target_format: str = Field(
        ...,
        description="""<!--zh: 目标格式，例如 pdf、png、docx、pptx、xlsx-->
Target format, e.g. pdf, png, docx, pptx, xlsx"""
    )
    ranges: Optional[str] = Field(
        None,
        description="""<!--zh: 可选页码范围，用于 PDF 页面渲染等场景-->
Optional page range for PDF image rendering"""
    )


@tool()
class ConvertDocumentFormat(AbstractFileTool[ConvertDocumentFormatParams], WorkspaceTool[ConvertDocumentFormatParams]):
    """<!--zh: 只做文档格式转换，不做语义提取、索引或总结。-->
    Convert document formats without semantic extraction."""

    code_mode_only = True

    async def execute(self, tool_context: ToolContext, params: ConvertDocumentFormatParams) -> ToolResult:
        """Convert the source file into the requested output format."""
        _, error = require_absolute_path(params.input_path, "input_path")
        if error:
            return error
        output_dir, error = require_absolute_path(params.output_dir, "output_dir")
        if error:
            return error
        assert output_dir is not None
        resolved, error = await require_existing_input_file(params.input_path, "input_path")
        if error:
            return error
        assert resolved is not None
        input_path = resolved.path
        try:
            outputs = await DocumentFormatConverter().convert(input_path, output_dir, params.target_format, params.ranges)
            output_paths = [str(path) for path in outputs]
            if tool_context:
                for path in outputs:
                    await self._dispatch_file_event(tool_context, str(path), EventType.FILE_CREATED)
        except Exception as exc:
            return ToolResult.error(build_document_parse_model_error("convert_document_format", str(exc), input_path=str(input_path), output_dir=str(output_dir)))
        content = "Format conversion completed:\n" + "\n".join(f"- `{path}`" for path in output_paths)
        return ToolResult(
            content=prepend_correction_note(content, resolved.correction_note),
            extra_info={
                "output_files": output_paths,
                # Alias kept so Code Mode snippets can reliably pass the converted path
                # to the next document-converter tool instead of falling back to input_path.
                "converted_files": output_paths,
            },
        )

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] | None = None
    ) -> Dict:
        name = Path((arguments or {}).get("input_path", "document")).name
        return {
            "tool_name": tool_name,
            "action": i18n.translate("convert_document_format", category="tool.actions"),
            "remark": i18n.translate("convert_document_format.before", category="tool.messages", file_name=name),
        }

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] | None = None) -> Optional[ToolDetail]:
        if not result.ok:
            return build_document_parse_error_detail("convert_document_format", result, arguments)
        if not result.extra_info:
            return None
        output_files = result.extra_info.get("output_files") or []
        lines = [
            f"# {i18n.translate('convert_document_format.detail_title', category='tool.messages')}",
            "",
        ]
        lines.extend(f"- `{path}`" for path in output_files)
        return ToolDetail(type=DisplayType.MD, data=FileContent(file_name="document_conversion.md", content="\n".join(lines)))

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] | None = None) -> Dict:
        name = Path((arguments or {}).get("input_path", "document")).name
        return build_document_parse_after_remark(tool_name, "convert_document_format", "convert_document_format", result, name)
