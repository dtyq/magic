"""Validate a semantic slide template and generate local preview assets."""

from pathlib import Path
from typing import Any, Dict, Optional

from pydantic import Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.tools.core import BaseToolParams, tool
from app.tools.core.tool_keepalive import start_tool_keep_alive, stop_tool_keep_alive
from app.tools.slide_template_builder.common import (
    SlideTemplateBuilderError,
    cleanup_template_intermediates,
    display_template_name,
    resolve_workspace_template_dir,
    validate_template_project,
)
from app.tools.slide_template_builder import taxonomy_source
from app.tools.slide_template_builder.preview import render_slide_previews, write_preview_images
from app.tools.workspace_tool import WorkspaceTool
from app.utils.async_file_utils import (
    async_exists,
    async_mkdir,
    async_rename,
    async_rmtree,
    async_write_json,
)


class FinalizeSlideTemplateParams(BaseToolParams):
    template_dir: str = Field(
        ...,
        description="""<!--zh: 工作区内语义化模板目录，例如 SLIDE-navy-business-review。目录必须包含 template.json、visual-spec.md、theme.css、images/ 和 slides/。-->
Semantic template directory inside the workspace, for example SLIDE-navy-business-review. It must contain template.json, visual-spec.md, theme.css, images/, and slides/.""",
    )

    @field_validator("template_dir")
    @classmethod
    def strip_template_dir(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("template_dir is required")
        return value


@tool(name="finalize_slide_template", code_mode_only=True)
class FinalizeSlideTemplate(WorkspaceTool[FinalizeSlideTemplateParams]):
    """<!--zh
    校验最终模板 HTML，并在同一模板目录的 previews/ 下生成缩略图、拼图和逐页预览图。不创建 ZIP，也不上传后台。
    -->
    Validate final template HTML and generate thumbnail, collage, and page previews under previews/ in the same template directory. This tool does not create a ZIP or upload files.
    """

    name = "finalize_slide_template"

    async def execute(self, tool_context: ToolContext, params: FinalizeSlideTemplateParams) -> ToolResult:
        template_dir = resolve_workspace_template_dir(Path(self.base_dir), params.template_dir)
        temp_preview_dir = template_dir / ".previews-tmp"
        preview_dir = template_dir / "previews"
        keep_alive_task = start_tool_keep_alive(tool_context)
        try:
            snapshot = await taxonomy_source.resolve_taxonomy(
                taxonomy_source.access_context_from_tool(tool_context)
            )
            validated = await validate_template_project(template_dir, snapshot.catalog)
            if await async_exists(temp_preview_dir):
                await async_rmtree(temp_preview_dir)
            await async_mkdir(temp_preview_dir / "slides", parents=True, exist_ok=False)

            captures = await render_slide_previews(
                workspace_dir=Path(self.base_dir),
                template_dir=template_dir,
                slides=validated.slides,
                canvas=validated.canvas,
            )
            slide_buffers = [capture.screenshot for capture in captures]
            inspections = [
                {"index": index, "file": slide["file"], **capture.inspection}
                for index, (slide, capture) in enumerate(zip(validated.slides, captures, strict=True), 1)
            ]

            preview_images = await write_preview_images(
                temp_preview_dir,
                slide_buffers,
                validated.canvas,
            )
            if await async_exists(preview_dir):
                await async_rmtree(preview_dir)
            await async_rename(temp_preview_dir, preview_dir)
            removed_temporary_paths = await cleanup_template_intermediates(template_dir)

            relative_slide_paths = [f"previews/slides/{path.name}" for path in preview_images.slide_paths]
            manifest = {
                "schema_version": "1.0",
                "template_id": validated.metadata["template_id"],
                "category_code": validated.metadata["category_code"],
                "tag_codes": validated.metadata["tag_codes"],
                "template_source_dir": ".",
                "local_files": {
                    "thumbnail": "previews/thumbnail.png",
                    "collage": "previews/collage.png",
                    "preview_images": relative_slide_paths,
                },
                "backend_fields": {
                    "code": validated.metadata["template_id"],
                    "category_code": validated.metadata["category_code"],
                    "label": validated.metadata["label"],
                    "description": validated.metadata["description"],
                    "thumbnail_file_key": None,
                    "collage_file_key": None,
                    "preview_image_file_keys": [],
                    "template_file_key": None,
                    "preview_url": None,
                    "status": 1,
                    "sort": 0,
                    "tag_codes": validated.metadata["tag_codes"],
                },
                "upload_required_fields": [
                    "thumbnail_file_key",
                    "collage_file_key",
                    "preview_image_file_keys",
                    "template_file_key",
                ],
                "not_generated": {
                    "template_file_key": "A separate publish workflow packages and uploads the template source directory.",
                    "preview_url": "Assigned by the publish workflow when available.",
                    "colors": "Extracted by the backend from the uploaded thumbnail.",
                },
                "slide_count": len(validated.slides),
                "collage_slide_count": min(len(validated.slides), 9),
                "validation": {
                    "canvas": validated.canvas.model_dump(),
                    "slides": inspections,
                },
                "source_analysis": validated.source_analysis_summary,
                "cleanup": {
                    "removed_temporary_paths": removed_temporary_paths,
                    "working_directory_removed": bool(removed_temporary_paths),
                },
            }
            manifest_path = template_dir / "template-assets.json"
            await async_write_json(manifest_path, manifest, ensure_ascii=False, indent=2)

            summary = validated.source_analysis_summary if isinstance(validated.source_analysis_summary, dict) else {}
            warnings = summary.get("warnings") if isinstance(summary.get("warnings"), list) else []
            unreviewed = (
                summary.get("unreviewed_source_indexes")
                if isinstance(summary.get("unreviewed_source_indexes"), list)
                else []
            )
            data = {
                "template_id": validated.metadata["template_id"],
                "category_code": validated.metadata["category_code"],
                "tag_codes": validated.metadata["tag_codes"],
                "template_directory": str(template_dir),
                "preview_directory": str(preview_dir),
                "thumbnail": str(preview_dir / preview_images.thumbnail_path.name),
                "collage": str(preview_dir / preview_images.collage_path.name),
                "preview_images": [str(preview_dir / "slides" / path.name) for path in preview_images.slide_paths],
                "manifest": str(manifest_path),
                "slide_count": len(preview_images.slide_paths),
                "removed_temporary_paths": removed_temporary_paths,
                "zip_created": False,
                "warnings": warnings,
                "unreviewed_source_indexes": unreviewed,
            }
            warning_note = f" Warnings: {' '.join(str(item) for item in warnings)}" if warnings else ""
            unreviewed_note = (
                f" Unreviewed source indexes: {', '.join(str(item) for item in unreviewed)}."
                if unreviewed
                else ""
            )
            return ToolResult(
                content=(
                    f"Slide template finalized: {len(preview_images.slide_paths)} slides rendered. "
                    f"Preview assets and source files are together under `{template_dir}`. "
                    f"Removed {len(removed_temporary_paths)} temporary work path(s). No ZIP was created."
                    f"{warning_note}{unreviewed_note} "
                    "Compare `previews/slides/` with the source pages before reporting completion. "
                    "If thumbnail, collage, or a page preview is missing, the template is blocked, not complete."
                ),
                data=data,
                extra_info=data,
            )
        except SlideTemplateBuilderError as exc:
            return ToolResult.error(
                f"{exc} Do not tell the user the template is complete. "
                "Report this blocker and the remaining steps, including any missing previews."
            )
        except Exception as exc:
            return ToolResult.error(
                f"Failed to finalize slide template: {exc} "
                "Do not tell the user the template is complete. "
                "Report this blocker and the remaining steps, including any missing previews."
            )
        finally:
            stop_tool_keep_alive(keep_alive_task)
            if await async_exists(temp_preview_dir):
                await async_rmtree(temp_preview_dir)

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] | None = None
    ) -> Dict:
        template_dir = display_template_name((arguments or {}).get("template_dir"))
        return {
            "tool_name": tool_name,
            "action": i18n.translate("finalize_slide_template", category="tool.actions"),
            "remark": i18n.translate(
                "finalize_slide_template.before",
                category="tool.messages",
                template_dir=template_dir,
            ),
        }

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] | None = None,
    ) -> Dict:
        data = result.data if isinstance(result.data, dict) else {}
        template_id = str(
            data.get("template_id") or display_template_name((arguments or {}).get("template_dir"))
        )
        key = "finalize_slide_template.after_success" if result.ok else "finalize_slide_template.after_failed"
        return {
            "tool_name": tool_name,
            "action": i18n.translate("finalize_slide_template", category="tool.actions"),
            "remark": i18n.translate(key, category="tool.messages", template_id=template_id),
        }

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] | None = None
    ) -> Optional[ToolDetail]:
        data = result.data if isinstance(result.data, dict) else {}
        if result.ok:
            content = "\n".join([
                "# Slide template assets",
                "",
                f"- Template ID: `{data.get('template_id', '')}`",
                f"- Category: `{data.get('category_code', '')}`",
                f"- Tags: {', '.join(data.get('tag_codes', []))}",
                f"- Directory: `{data.get('template_directory', '')}`",
                f"- Thumbnail: `{data.get('thumbnail', '')}`",
                f"- Collage: `{data.get('collage', '')}`",
                f"- Page previews: {data.get('slide_count', 0)}",
                f"- Temporary work paths removed: {len(data.get('removed_temporary_paths', []))}",
                "- ZIP created: no",
            ])
        else:
            content = f"# Slide template finalization failed\n\n{result.content}"
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(file_name="slide_template_assets.md", content=content),
        )
