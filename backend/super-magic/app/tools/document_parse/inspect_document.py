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
from app.utils.document_parse.constants import DEFAULT_SIMPLE_DOCUMENT_MAX_UNITS
from app.utils.document_parse.models import DocumentProfile
from app.utils.document_parse.service.document_artifact_mode import DocumentArtifactModeSelector
from app.utils.document_parse.service.document_inspector import DocumentInspector

from .path_utils import (
    build_document_parse_after_remark,
    build_document_parse_error_detail,
    prepend_correction_note,
    require_valid_input_file,
)


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
        format_check = _build_format_check(profile, path)
        next_actions = _build_next_actions(profile)
        data["format_check"] = format_check
        data["next_actions"] = next_actions
        outline_count = len(profile.outline)
        lines = [
            f"Document inspection completed: `{profile.file_name}`",
            "",
            f"- Detected type: {profile.file_type}",
            f"- File extension: {profile.file_extension or path.suffix.lower()}",
            f"- Format check: {format_check['status']}",
            f"- Structure unit: {profile.unit_type}",
            f"- Unit count: {profile.total_units}",
            f"- Outline nodes: {outline_count}",
            f"- Recommended strategy: {profile.recommended_strategy}",
            "",
            "Recommended next actions:",
        ]
        lines.extend(f"{index}. {action}" for index, action in enumerate(next_actions, start=1))
        content = "\n".join(lines)
        return ToolResult(content=prepend_correction_note(content, resolved.correction_note), extra_info=data)

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] | None = None
    ) -> Dict:
        name = Path((arguments or {}).get("input_path", "document")).name
        return {
            "tool_name": tool_name,
            "action": i18n.translate("inspect_document", category="tool.actions"),
            "remark": i18n.translate("inspect_document.before", category="tool.messages", file_name=name),
        }

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] | None = None) -> Optional[ToolDetail]:
        if not result.ok:
            return build_document_parse_error_detail("inspect_document", result, arguments)
        if not result.extra_info:
            return None
        info = result.extra_info
        format_check = info.get("format_check") or {}
        next_actions = info.get("next_actions") or []
        lines = [
            f"# {i18n.translate('inspect_document.detail_title', category='tool.messages')}",
            "",
            f"## {info.get('file_name', 'Document')}",
            "",
            f"- {i18n.translate('document_parse.detail_type', category='tool.messages')}: `{info.get('file_type')}`",
            f"- {i18n.translate('document_parse.detail_extension', category='tool.messages')}: `{info.get('file_extension')}`",
            f"- {i18n.translate('document_parse.detail_format_check', category='tool.messages')}: {format_check.get('status', '')}",
            f"- {i18n.translate('document_parse.detail_unit_type', category='tool.messages')}: `{info.get('unit_type')}`",
            f"- {i18n.translate('document_parse.detail_total_units', category='tool.messages')}: `{info.get('total_units')}`",
            f"- {i18n.translate('document_parse.detail_strategy', category='tool.messages')}: {info.get('recommended_strategy', '')}",
        ]
        if next_actions:
            lines.extend([
                "",
                f"## {i18n.translate('document_parse.detail_next_actions', category='tool.messages')}",
            ])
            lines.extend(f"{index}. {action}" for index, action in enumerate(next_actions, start=1))
        return ToolDetail(type=DisplayType.MD, data=FileContent(file_name="document_inspection.md", content="\n".join(lines)))

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] | None = None) -> Dict:
        name = Path((arguments or {}).get("input_path", "document")).name
        return build_document_parse_after_remark(tool_name, "inspect_document", "inspect_document", result, name)


def _build_format_check(profile: DocumentProfile, path: Path) -> dict[str, Any]:
    metadata = profile.metadata or {}
    status = "passed; extension and lightweight signature checks are consistent"
    if profile.file_type == "pdf" and metadata.get("is_scanned_like"):
        status += "; PDF appears scanned-like from the page sample"
    return {
        "status": status,
        "extension": profile.file_extension or path.suffix.lower(),
        "detected_type": profile.file_type,
        "source_path": str(path),
        "metadata": {
            key: metadata.get(key)
            for key in (
                "text_density",
                "has_images_in_sample",
                "image_pages_in_sample",
                "full_page_image_pages_in_sample",
                "is_scanned_like",
            )
            if key in metadata
        },
    }


def _build_next_actions(profile: DocumentProfile) -> list[str]:
    metadata = profile.metadata or {}
    if profile.file_type == "spreadsheet":
        return [
            "Use sample_document_content with a stable output_dir to inspect sheet names, headers, and example rows.",
            "Use extract_document_content with a selected sheet or range only after the target table area is clear.",
        ]
    if profile.file_type == "image":
        return [
            "Use extract_document_content with output_dir to create document.md and assets for the image.",
            "Use understand_document_images only when semantic visual content is needed for the user goal.",
        ]
    if profile.file_type == "pdf" and metadata.get("is_scanned_like"):
        return [
            "Use sample_document_content first; local text may be empty because this PDF appears image-dominant.",
            "Use extract_document_content for a bounded page range to create chunks and image assets.",
            "Use understand_document_images on the extracted range when the page images must be read.",
        ]
    if DocumentArtifactModeSelector.is_small_document(profile):
        return [
            "Use export_document_markdown with input_path and output_dir to produce a simple document.md.",
            "If the output contains important images, use understand_document_images only for those needed by the goal.",
        ]
    if profile.file_type in {"pdf", "word", "powerpoint"} and int(profile.total_units or 0) > DEFAULT_SIMPLE_DOCUMENT_MAX_UNITS:
        return [
            "Use sample_document_content with the same output_dir before extracting the full document.",
            "Use plan_document_reading with that output_dir and the user goal to choose the next bounded range.",
            "Use extract_document_content for the recommended range; avoid full export unless the user explicitly asked for complete Markdown.",
        ]
    if profile.file_type in {"text", "markdown", "html"}:
        return [
            "Use export_document_markdown if the user needs a Markdown artifact.",
            "Use extract_document_content with ranges only when targeted reading is needed.",
        ]
    return [
        "Use sample_document_content with a stable output_dir to inspect representative content.",
        "Use plan_document_reading to choose the next bounded extraction step.",
    ]
