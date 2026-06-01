"""Sample a document before choosing a reading strategy.

Internal responsibility:
- Gives Code Mode agents a low-cost first read of a large or complex document.
- Writes bounded Markdown samples under samples/ without committing formal chunks/.
- Updates document.reading_state.json with sample signals and recommended next actions.
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
from app.utils.document_parse.service.document_sampler import DocumentSampler

from .path_utils import require_absolute_path


class SampleDocumentContentParams(BaseToolParams):
    input_path: str = Field(
        ...,
        description="""<!--zh: 要抽样阅读的文档绝对路径，不接受相对路径-->
Absolute document path to sample. Relative paths are not accepted"""
    )
    output_dir: str = Field(
        ...,
        description="""<!--zh: 输出目录的绝对路径，用于保存 samples/ 和 document.reading_state.json-->
Absolute output directory for samples/ and document.reading_state.json"""
    )
    strategy: str = Field(
        "auto",
        description="""<!--zh: 抽样策略，默认 auto-->
Sampling strategy. Use auto unless a specific range is needed"""
    )
    ranges: Optional[str] = Field(
        None,
        description="""<!--zh: 可选范围表达式，例如页码或 slide 范围 `1-3,8`-->
Optional range expression such as pages or slides `1-3,8`"""
    )
    max_units: int = Field(
        5,
        description="""<!--zh: 最多抽样的结构单位数量，例如页、slide 或 sheet，默认 5-->
Maximum sampled units, such as pages, slides, or sheets. Default is 5"""
    )
    include_images: bool = Field(
        True,
        description="""<!--zh: 支持时是否提取图片链接；不会主动进行视觉理解-->
Whether to include image links when supported. This does not run visual understanding"""
    )


@tool()
class SampleDocumentContent(AbstractFileTool[SampleDocumentContentParams], WorkspaceTool[SampleDocumentContentParams]):
    """<!--zh: 抽样阅读文档，帮助大模型决定后续大文档阅读策略。-->
    Sample document content so the model can choose the next reading strategy."""

    code_mode_only = True

    async def execute(self, tool_context: ToolContext, params: SampleDocumentContentParams) -> ToolResult:
        """Write bounded document samples and update progressive reading state."""
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

        result = await DocumentSampler().sample(
            input_path,
            output_dir,
            strategy=params.strategy,
            ranges=params.ranges,
            max_units=params.max_units,
            include_images=params.include_images,
        )

        if tool_context:
            await self._dispatch_file_event(tool_context, str(output_dir), EventType.FILE_CREATED)

        profile = result["profile"]
        signal = result["text_signal"]
        content = "\n".join([
            f"Document sample completed: `{profile.file_name}`",
            "",
            f"- Output directory: `{output_dir}`",
            f"- Sample file: `{result['sample_path']}`",
            f"- Sample range: {result['sample_range']}",
            f"- Has extractable text: {signal['has_extractable_text']}",
            f"- Image dominant: {signal['image_dominant']}",
            f"- Recommended next actions: {'; '.join(result['recommendations'])}",
            f"- Reading state: `{output_dir}/document.reading_state.json`",
        ])
        return ToolResult(
            content=content,
            extra_info={
                "profile": asdict(profile),
                "sample_path": result["sample_path"],
                "sample_range": result["sample_range"],
                "text_signal": signal,
                "recommendations": result["recommendations"],
                "state": result["state"],
            },
        )

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] = None
    ) -> Dict:
        name = Path((arguments or {}).get("input_path", "document")).name
        return {
            "tool_name": tool_name,
            "action": i18n.translate("sample_document_content", category="tool.actions"),
            "remark": i18n.translate("sample_document_content.before", category="tool.messages", file_name=name),
        }

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        if not result.ok or not result.extra_info:
            return None
        lines = [
            f"# {i18n.translate('sample_document_content.detail_title', category='tool.messages')}",
            "",
            f"- {i18n.translate('document_parse.detail_sample_file', category='tool.messages')}: `{result.extra_info.get('sample_path', '')}`",
            f"- {i18n.translate('document_parse.detail_sample_range', category='tool.messages')}: `{result.extra_info.get('sample_range', '')}`",
        ]
        for action in result.extra_info.get("recommendations") or []:
            lines.append(f"- {action}")
        return ToolDetail(type=DisplayType.MD, data=FileContent(file_name="document_sample.md", content="\n".join(lines)))

    async def get_after_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None
    ) -> Dict:
        name = Path((arguments or {}).get("input_path", "document")).name
        key = "sample_document_content.after_success" if result.ok else "sample_document_content.after_failed"
        return {
            "tool_name": tool_name,
            "action": i18n.translate("sample_document_content", category="tool.actions"),
            "remark": i18n.translate(key, category="tool.messages", file_name=name),
        }
