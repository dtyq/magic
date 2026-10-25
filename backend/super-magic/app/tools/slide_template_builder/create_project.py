"""Create a standard semantic slide template workspace project."""

from pathlib import Path
from typing import Any, Dict, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.tools.core import BaseToolParams, tool
from app.tools.slide_template_builder.common import (
    MAX_TAG_CODES,
    SCAFFOLD_MARKER,
    SlideTemplateBuilderError,
    ensure_template_working_directory,
    generate_semantic_directory_name,
    generate_unique_template_id,
    resolve_template_converter_output_dir,
    resolve_template_working_directory,
    resolve_workspace_template_dir,
    safe_slide_path,
    validate_taxonomy_selection,
    validate_template_id,
)
from app.tools.slide_template_builder import taxonomy_source
from app.tools.slide_template_builder.models import (
    BACKEND_CATEGORY_CODE_PATTERN,
    TemplateCanvas,
    TemplateDescriptionText,
    TemplateLabelText,
    TemplateSlideParams,
    TemplateSourceParams,
)
from app.tools.workspace_tool import WorkspaceTool
from app.utils.async_file_utils import async_mkdir, async_write_json, async_write_text


class CreateSlideTemplateProjectParams(BaseToolParams):
    template_id: str = Field(
        ...,
        description="""<!--zh: 模板 ID 基础名，使用 SLIDE- 加小写 kebab-case。工具会自动追加随机唯一后缀，不要自行添加随机后缀。-->
Semantic base template ID using SLIDE- plus alphanumeric kebab-case segments. The tool appends a short six-character uppercase hexadecimal suffix automatically; do not add the suffix yourself.""",
    )
    category_code: str = Field(
        ...,
        pattern=BACKEND_CATEGORY_CODE_PATTERN,
        description="""<!--zh: 当前有效分类目录中的准确分类 code。按本模板的受众和用途从 result.data 语义挑选，不能按文件名或关键词匹配，也不能只按格式编造。-->
Exact active category code from query_slide_template_taxonomy result.data. Pick it by this template's audience and use case, not by filename or keyword match.""",
    )
    label: TemplateLabelText = Field(..., description="Template display names in Simplified Chinese and English.")
    description: TemplateDescriptionText = Field(..., description="Reusable template descriptions in Simplified Chinese and English.")
    tag_codes: list[str] = Field(
        ...,
        min_length=1,
        max_length=MAX_TAG_CODES,
        description="""<!--zh: 当前有效标签目录中的准确标签 code，4-10 个，不重复。按本模板可见的用途、风格、配色、版式、氛围和语言从 result.data 语义挑选，不要关键词匹配，不要自动添加 featured。-->
Exact tag codes from query_slide_template_taxonomy result.data, 4-10 of them. Pick them by this template's visible purpose, style, color, layout, mood, and language. Never keyword-match names or add featured automatically.""",
    )
    source: TemplateSourceParams = Field(..., description="Template source classification and source basename.")
    slides: list[TemplateSlideParams] = Field(
        ...,
        min_length=1,
        description="Planned semantic slide files in their default order. Each file must be under slides/.",
    )


@tool(name="create_slide_template_project", code_mode_only=True)
class CreateSlideTemplateProject(WorkspaceTool[CreateSlideTemplateProjectParams]):
    """<!--zh
    在工作区根目录创建标准的语义 HTML 幻灯片模板结构。必须在写入模板内容前调用。
    -->
    Create the standard semantic HTML slide template structure at the workspace root. Call it before authoring template content.
    """

    name = "create_slide_template_project"

    async def execute(self, tool_context: ToolContext, params: CreateSlideTemplateProjectParams) -> ToolResult:
        try:
            requested_template_id = validate_template_id(params.template_id)
            snapshot = await taxonomy_source.resolve_taxonomy(
                taxonomy_source.access_context_from_tool(tool_context)
            )
            category_code, tag_codes = validate_taxonomy_selection(
                params.category_code, params.tag_codes, snapshot.catalog
            )
            slide_files = [item.file for item in params.slides]
            if len(slide_files) != len(set(slide_files)):
                return ToolResult.error("Slide file paths must be unique.")

            template_id = None
            for _ in range(5):
                candidate_id = generate_unique_template_id(requested_template_id)
                candidate_dir = resolve_workspace_template_dir(Path(self.base_dir), candidate_id)
                if not candidate_dir.exists():
                    template_id = candidate_id
                    break
            if template_id is None:
                return ToolResult.error(
                    f"Could not allocate a unique template ID from base: {requested_template_id}"
                )

            directory_name = generate_semantic_directory_name(params.label.model_dump(), tag_codes)
            template_dir = resolve_workspace_template_dir(Path(self.base_dir), directory_name)
            try:
                await async_mkdir(template_dir, parents=True, exist_ok=False)
            except FileExistsError:
                return ToolResult.error(
                    f"Semantic template directory already exists: {directory_name}. "
                    "Use a more specific label or update the existing template."
                )

            await async_mkdir(template_dir / "images", parents=True, exist_ok=False)
            await async_mkdir(template_dir / "slides", parents=True, exist_ok=False)
            work_dir = await ensure_template_working_directory(
                resolve_template_working_directory(template_dir, template_id)
            )
            converter_output_dir = resolve_template_converter_output_dir(work_dir)
            await async_mkdir(converter_output_dir, parents=True, exist_ok=True)

            metadata = {
                "schema_version": "1.0",
                "template_id": template_id,
                "category_code": category_code,
                "tag_codes": tag_codes,
                "label": params.label.model_dump(),
                "description": params.description.model_dump(),
                "files": {
                    "visual_spec": "visual-spec.md",
                    "theme_css": "theme.css",
                    "slides_dir": "slides",
                    "images_dir": "images",
                },
                "slides": [item.model_dump() for item in params.slides],
                "source": {
                    **params.source.model_dump(),
                },
                "warnings": [],
            }
            await async_write_json(template_dir / "template.json", metadata, ensure_ascii=False, indent=2)
            await async_write_text(
                template_dir / "visual-spec.md",
                f"<!-- {SCAFFOLD_MARKER} -->\n# Visual Specification\n\nReplace this scaffold with the complete design system.\n",
            )
            await async_write_text(
                template_dir / "theme.css",
                f"/* {SCAFFOLD_MARKER} */\n/* Replace this scaffold with the complete shared template theme. */\n",
            )
            for slide in params.slides:
                slide_path = safe_slide_path(template_dir, slide.file)
                await async_mkdir(slide_path.parent, parents=True, exist_ok=True)
                await async_write_text(
                    slide_path,
                    self._slide_scaffold(slide.title, slide.layout, params.source.canvas),
                )

            data = {
                "requested_template_id": requested_template_id,
                "template_id": template_id,
                "category_code": category_code,
                "tag_codes": tag_codes,
                "template_directory": str(template_dir),
                "template_json": str(template_dir / "template.json"),
                "visual_spec": str(template_dir / "visual-spec.md"),
                "theme_css": str(template_dir / "theme.css"),
                "images_directory": str(template_dir / "images"),
                "slides_directory": str(template_dir / "slides"),
                "working_directory": str(work_dir),
                "converter_output_dir": str(converter_output_dir),
                "slide_count": len(params.slides),
                "canvas": params.source.canvas.model_dump(),
                "canvas_contract": {
                    "selector": ".slide-container",
                    "width_attribute": "data-width",
                    "height_attribute": "data-height",
                    "width": params.source.canvas.width,
                    "height": params.source.canvas.height,
                },
            }
            if params.source.method == "visual-reconstruction":
                source_next = (
                    "For this OOXML reconstruction, call prepare_slide_template_source with source_presentation and "
                    "let it render the pages; do not convert the deck yourself and do not write PDF, page images, "
                    "or converter dumps into the workspace. "
                    "Finalize hard-blocks missing prepare for this method. "
                )
            else:
                source_next = (
                    "This source is not an OOXML presentation file. Do not call prepare_slide_template_source, "
                    "review_slide_template_source, or select_slide_template_source_assets. "
                    "Finalize does not need PPTX, OOXML, or source analysis. "
                    "Do not skip it because the source is HTML, images, or text. "
                )
            return ToolResult(
                content=(
                    f"Slide template project created at `{template_dir}` with {len(params.slides)} planned slides. "
                    "Later source tools only need this template_dir. "
                    + source_next
                    + "Each slide scaffold contains a required `main.slide-container` canvas root with `data-width` and "
                    "`data-height` matching `template.json.source.canvas`; preserve this contract when authoring. "
                    "Only author `visual-spec.md`, `theme.css`, `images/`, and the declared `slides/*.html` files. "
                    "Do not replace `template.json`, invent `source-analysis.json`, or create `.template-work/` "
                    "inside the template directory. "
                    "Replace every scaffold file, then always call finalize_slide_template and check `result.ok`; "
                    "it renders authored HTML into previews/, and the template is not complete until finalization succeeds."
                ),
                data=data,
                extra_info=data,
            )
        except SlideTemplateBuilderError as exc:
            return ToolResult.error(str(exc))
        except Exception as exc:
            return ToolResult.error(f"Failed to create slide template project: {exc}")

    @staticmethod
    def _slide_scaffold(title: str, layout: str, canvas: TemplateCanvas) -> str:
        return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width={canvas.width}, height={canvas.height}">
  <title>{title}</title>
  <link rel="stylesheet" href="../theme.css">
  <!-- {SCAFFOLD_MARKER} -->
</head>
<body>
  <main class="slide-container" data-width="{canvas.width}" data-height="{canvas.height}" data-layout="{layout}"></main>
</body>
</html>
"""

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] | None = None
    ) -> Dict:
        template_id = str((arguments or {}).get("template_id") or "-")
        return {
            "tool_name": tool_name,
            "action": i18n.translate("create_slide_template_project", category="tool.actions"),
            "remark": i18n.translate(
                "create_slide_template_project.before",
                category="tool.messages",
                template_id=template_id,
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
        template_id = str((result.data or {}).get("template_id") or (arguments or {}).get("template_id") or "-")
        key = "create_slide_template_project.after_success" if result.ok else "create_slide_template_project.after_failed"
        return {
            "tool_name": tool_name,
            "action": i18n.translate("create_slide_template_project", category="tool.actions"),
            "remark": i18n.translate(key, category="tool.messages", template_id=template_id),
        }

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] | None = None
    ) -> Optional[ToolDetail]:
        data = result.data if isinstance(result.data, dict) else {}
        if result.ok:
            content = "\n".join([
                "# Slide template project",
                "",
                f"- Requested base ID: `{data.get('requested_template_id', '')}`",
                f"- Template ID: `{data.get('template_id', '')}`",
                f"- Category: `{data.get('category_code', '')}`",
                f"- Tags: {', '.join(data.get('tag_codes', []))}",
                f"- Directory: `{data.get('template_directory', '')}`",
                f"- Planned slides: {data.get('slide_count', 0)}",
            ])
        else:
            content = f"# Slide template project creation failed\n\n{result.content}"
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(file_name="slide_template_project.md", content=content),
        )
