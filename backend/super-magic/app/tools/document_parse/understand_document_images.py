"""Understand document images and write recognition results back.

Internal responsibility:
- Processes only image assets that belong to an existing document output directory.
- Limits each call to 10 images and runs bounded concurrent visual understanding.
- Persists results under visual-results/ and writes them back into related chunks.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

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
from app.utils.document_parse.service.document_image_understander import DocumentImageUnderstander

from .path_utils import require_absolute_path


class UnderstandDocumentImagesParams(BaseToolParams):
    output_dir: str = Field(
        ...,
        description="""<!--zh: 文档解析输出目录的绝对路径，必须包含 document.index.json-->
Absolute document output directory containing document.index.json"""
    )
    images: Optional[List[str]] = Field(
        None,
        description="""<!--zh: 可选图片绝对路径列表；每次最多处理 10 张-->
Optional absolute image paths to understand. At most 10 images per call"""
    )
    ranges: Optional[str] = Field(
        None,
        description="""<!--zh: 可选页码或 slide 范围，例如 `1-10`，用于选择对应图片-->
Optional page or slide range such as `1-10` to select related images"""
    )
    chunk_ids: Optional[List[str]] = Field(
        None,
        description="""<!--zh: 可选 chunk id 列表，用于处理指定 chunk 中引用的图片-->
Optional chunk ids whose referenced images should be understood"""
    )
    query: Optional[str] = Field(
        None,
        description="""<!--zh: 可选视觉理解要求；为空时按文档图片转结构化 Markdown 处理-->
Optional visual understanding instruction. Defaults to structured Markdown document reading"""
    )
    write_mode: str = Field(
        "append_after_image",
        description="""<!--zh: 写回方式，默认把识别结果追加到 chunk 中对应图片链接后-->
Write-back mode. Default appends recognition result after the image link in chunks"""
    )
    max_images: int = Field(
        10,
        description="""<!--zh: 每次最多处理的图片数量，硬上限 10-->
Maximum images to process in one call. Hard limit is 10"""
    )
    concurrency: int = Field(
        5,
        description="""<!--zh: 内部视觉理解并发数，最大 10-->
Internal visual understanding concurrency. Maximum is 10"""
    )
    force: bool = Field(
        False,
        description="""<!--zh: 是否重新理解已经有结果的图片-->
Whether to reprocess images that already have visual understanding results"""
    )


@tool()
class UnderstandDocumentImages(AbstractFileTool[UnderstandDocumentImagesParams], WorkspaceTool[UnderstandDocumentImagesParams]):
    """<!--zh: 对文档图片进行视觉理解，并把结果写回 chunk。-->
    Understand document image assets and write results back into chunks."""

    code_mode_only = True

    async def execute(self, tool_context: ToolContext, params: UnderstandDocumentImagesParams) -> ToolResult:
        """Run bounded visual understanding for document image assets."""
        output_dir, error = require_absolute_path(params.output_dir, "output_dir")
        if error:
            return error
        image_paths: list[Path] = []
        for image in params.images or []:
            path, error = require_absolute_path(image, "images")
            if error:
                return error
            image_paths.append(path)
        if not await async_exists(output_dir):
            return ToolResult.error(f"Output directory does not exist: {params.output_dir}")
        if not await async_is_dir(output_dir):
            return ToolResult.error(f"Output path is not a directory: {params.output_dir}")
        if params.max_images > 10:
            return ToolResult.error("understand_document_images supports at most 10 images per call.")
        if params.concurrency > 10:
            return ToolResult.error("understand_document_images supports concurrency at most 10.")

        try:
            result = await DocumentImageUnderstander().understand(
                output_dir,
                images=image_paths,
                ranges=params.ranges,
                chunk_ids=params.chunk_ids,
                query=params.query,
                write_mode=params.write_mode,
                max_images=params.max_images,
                concurrency=params.concurrency,
                force=params.force,
            )
        except FileNotFoundError as exc:
            return ToolResult.error(str(exc))
        except ValueError as exc:
            return ToolResult.error(str(exc))

        if tool_context:
            await self._dispatch_file_event(tool_context, str(output_dir), EventType.FILE_CREATED)

        processed = result.get("processed") or []
        ok_count = len([item for item in processed if item.get("ok")])
        content = "\n".join([
            "Document image understanding completed.",
            "",
            f"- Output directory: `{output_dir}`",
            f"- Processed images: {len(processed)}",
            f"- Successful images: {ok_count}",
            f"- Index: `{result.get('index_path')}`",
            f"- Reading state: `{output_dir}/document.reading_state.json`",
        ])
        return ToolResult(content=content, extra_info=result)

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] = None
    ) -> Dict:
        name = Path((arguments or {}).get("output_dir", "document")).name
        return {
            "tool_name": tool_name,
            "action": i18n.translate("understand_document_images", category="tool.actions"),
            "remark": i18n.translate("understand_document_images.before", category="tool.messages", file_name=name),
        }

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        if not result.ok or not result.extra_info:
            return None
        processed = result.extra_info.get("processed") or []
        lines = [
            f"# {i18n.translate('understand_document_images.detail_title', category='tool.messages')}",
            "",
            f"- {i18n.translate('document_parse.detail_processed_images', category='tool.messages')}: {len(processed)}",
        ]
        for item in processed[:10]:
            lines.append(f"- `{item.get('asset_path')}` -> `{item.get('result_path')}`")
        return ToolDetail(type=DisplayType.MD, data=FileContent(file_name="document_image_understanding.md", content="\n".join(lines)))

    async def get_after_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None
    ) -> Dict:
        name = Path((arguments or {}).get("output_dir", "document")).name
        key = "understand_document_images.after_success" if result.ok else "understand_document_images.after_failed"
        return {
            "tool_name": tool_name,
            "action": i18n.translate("understand_document_images", category="tool.actions"),
            "remark": i18n.translate(key, category="tool.messages", file_name=name),
        }
