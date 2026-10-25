"""Prepare multi-scale visual evidence and read-only PPTX structure for template reconstruction."""

from __future__ import annotations

import asyncio
import re
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, Optional

from PIL import Image
from pydantic import Field, field_validator, model_validator

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.tools.core import BaseToolParams, tool
from app.tools.slide_template_builder.canvas import PixelSize, detect_source_canvas
from app.tools.slide_template_builder.common import (
    ANALYSIS_DIR_NAME,
    MAX_REVIEW_INDEXES_PER_CALL,
    SOURCE_ANALYSIS_FILE,
    SlideTemplateBuilderError,
    background_variants,
    describe_background_variants,
    display_template_name,
    ensure_template_working_directory,
    public_asset_id,
    recommended_review_indexes,
    resolve_template_converter_output_dir,
    resolve_template_working_directory,
    resolve_workspace_template_dir,
    validate_template_directory,
    validate_canvas,
)
from app.tools.slide_template_builder.models import ReconstructionMode, TemplateCanvas
from app.tools.slide_template_builder.pptx_structure import extract_pptx_structure
from app.tools.slide_template_builder.source_images import build_page_artifacts, create_contact_sheet
from app.tools.workspace_tool import WorkspaceTool
from app.utils.document_parse.service.document_format_converter import DocumentFormatConverter
from app.utils.async_file_utils import (
    async_exists,
    async_is_file,
    async_mkdir,
    async_read_bytes,
    async_read_json,
    async_rmtree,
    async_write_bytes,
    async_write_json,
)

SUPPORTED_PRESENTATION_STRUCTURE_SUFFIXES = {".pptx", ".pptm", ".potx", ".potm", ".ppsx", ".ppsm"}
PAGE_RENDER_FORMAT = "png"
PAGE_NUMBER_RE = re.compile(r"(\d+)")


def _page_order_key(path: Path) -> tuple[int, str]:
    """Order converter page renders by their trailing page number, not by string sort."""
    numbers = PAGE_NUMBER_RE.findall(path.stem)
    return (int(numbers[-1]) if numbers else 0, path.name)


async def _render_presentation_pages(presentation_path: Path, output_dir: Path) -> list[Path]:
    """Render every source page to PNG inside the template runtime dir.

    走工具内部渲染，Agent 就不需要先调两次 convert_document_format，
    也就不会再把 PDF 和页图写进 MagicFS 工作区。
    """
    converter = DocumentFormatConverter()
    try:
        pdf_outputs = await converter.convert(presentation_path, output_dir, "pdf", None)
    except Exception as exc:
        raise SlideTemplateBuilderError(f"Failed to render the source presentation to PDF: {exc}") from exc
    pdf_path = next((Path(item) for item in pdf_outputs if str(item).lower().endswith(".pdf")), None)
    if pdf_path is None:
        raise SlideTemplateBuilderError("Source presentation did not produce a PDF render.")
    try:
        page_outputs = await converter.convert(pdf_path, output_dir, PAGE_RENDER_FORMAT, None)
    except Exception as exc:
        raise SlideTemplateBuilderError(f"Failed to render source pages to images: {exc}") from exc
    pages = sorted(
        (Path(item) for item in page_outputs if str(item).lower().endswith(f".{PAGE_RENDER_FORMAT}")),
        key=_page_order_key,
    )
    if not pages:
        raise SlideTemplateBuilderError("Source presentation did not produce any page image.")
    return pages


class PrepareSlideTemplateSourceParams(BaseToolParams):
    template_dir: str = Field(
        ...,
        description="""<!--zh: 已由 create_slide_template_project 创建的模板目录。-->
Template directory previously created by create_slide_template_project.""",
    )
    source_presentation: Optional[str] = Field(
        None,
        description="""<!--zh: OOXML 演示文件路径。给了它就不用再自己渲染页图，本工具会直接渲染全部页面并只读提取文本框、字体、形状、图片、裁切和图层信息。支持 PPTX/PPTM/POTX/POTM/PPSX/PPSM；旧 PPT 应先通过 document-converter 转为 PPTX。-->
OOXML presentation path. Pass it and this tool renders every page itself, so no separate conversion step is needed, and it also extracts text boxes, fonts, shapes, images, crops, and layer order read-only. Supports PPTX/PPTM/POTX/POTM/PPSX/PPSM. Convert legacy PPT to PPTX through document-converter first.""",
    )
    page_images: Optional[list[str]] = Field(
        None,
        max_length=100,
        description="""<!--zh: 仅当源不是演示文件（例如截图、图片素材）时才需要传：按源顺序排列的高分辨率整页图片路径。传了 source_presentation 时留空，本工具会自行渲染。不要传 contact sheet 或缩略图。-->
Only needed when the source is not a presentation, for example screenshots or image references: high-resolution full-page image paths in source order. Leave empty when source_presentation is set, because this tool renders the pages itself. Never pass contact sheets or thumbnails.""",
    )
    reconstruction_mode: ReconstructionMode = Field(
        "hybrid",
        description="""<!--zh: 重建模式。high-fidelity 保留代表页细节；template-abstraction 强调可复用布局；hybrid 默认混合两者。-->
Reconstruction mode. high-fidelity preserves representative page details, template-abstraction prioritizes reusable layouts, and hybrid combines both.""",
    )
    crop_columns: int = Field(3, ge=2, le=4, description="Columns used for overlapping detail crops.")
    crop_rows: int = Field(3, ge=2, le=4, description="Rows used for overlapping detail crops.")

    @field_validator("template_dir")
    @classmethod
    def strip_template_dir(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("template_dir is required")
        return value

    @field_validator("page_images")
    @classmethod
    def normalize_page_images(cls, values: list[str] | None) -> list[str] | None:
        if values is None:
            return None
        normalized = [value.strip() for value in values]
        if any(not value for value in normalized):
            raise ValueError("page image paths cannot be empty")
        return normalized

    @model_validator(mode="after")
    def require_a_source(self) -> "PrepareSlideTemplateSourceParams":
        if not self.page_images and not self.source_presentation:
            raise ValueError(
                "Pass source_presentation so the pages can be rendered here, "
                "or page_images when the source is not a presentation file."
            )
        return self


def _source_asset_slide_indices(structure: dict[str, Any]) -> dict[str, list[int]]:
    indices: dict[str, set[int]] = {}

    def visit(shapes: list[dict[str, Any]], slide_index: int) -> None:
        for shape in shapes:
            image = shape.get("image") if isinstance(shape.get("image"), dict) else {}
            asset = image.get("asset")
            if isinstance(asset, str) and asset:
                indices.setdefault(asset, set()).add(slide_index)
            children = shape.get("children")
            if isinstance(children, list):
                visit([child for child in children if isinstance(child, dict)], slide_index)

    for slide in structure.get("slides", []):
        if not isinstance(slide, dict):
            continue
        slide_index = int(slide.get("index") or 0)
        shapes = slide.get("shapes")
        if slide_index > 0 and isinstance(shapes, list):
            visit([shape for shape in shapes if isinstance(shape, dict)], slide_index)
    return {asset: sorted(slides) for asset, slides in indices.items()}


def _source_asset_metadata(data: bytes) -> dict[str, Any]:
    try:
        with Image.open(BytesIO(data)) as image:
            width, height = image.size
            return {
                "width": width,
                "height": height,
                "aspect_ratio": round(width / height, 4) if height else None,
                "format": image.format,
                "mode": image.mode,
                "has_transparency": "A" in image.getbands() or "transparency" in image.info,
                "quality_flags": [
                    flag
                    for flag, enabled in (
                        ("small-dimensions", width < 256 or height < 128),
                        ("very-small-dimensions", width < 128 or height < 64),
                    )
                    if enabled
                ],
            }
    except (OSError, ValueError):
        return {
            "width": None,
            "height": None,
            "aspect_ratio": None,
            "format": None,
            "mode": None,
            "has_transparency": None,
            "quality_flags": ["needs-format-review"],
        }


@tool(name="prepare_slide_template_source", code_mode_only=True)
class PrepareSlideTemplateSource(WorkspaceTool[PrepareSlideTemplateSourceParams]):
    """<!--zh
    为模板视觉重建准备素材：传入 source_presentation 即可，本工具自行渲染全部页面，产出高分辨率整页图、重叠局部裁剪、联系表和 PPTX 只读结构数据。不需要先调 convert_document_format，也不会生成 HTML。
    -->
    Prepare reconstruction evidence. Pass source_presentation and this tool renders every page itself, producing high-resolution full pages, overlapping detail crops, a contact sheet, and read-only PPTX structure. No separate convert_document_format step is needed. This tool does not generate HTML.
    """

    name = "prepare_slide_template_source"

    async def execute(self, tool_context: ToolContext, params: PrepareSlideTemplateSourceParams) -> ToolResult:
        template_dir = resolve_workspace_template_dir(Path(self.base_dir), params.template_dir)
        try:
            metadata_path = template_dir / "template.json"
            if not await async_is_file(metadata_path):
                raise SlideTemplateBuilderError("Template project must be created before source preparation.")
            metadata = await async_read_json(metadata_path)
            validate_template_directory(template_dir, metadata)
            work_dir = await ensure_template_working_directory(
                resolve_template_working_directory(template_dir, str(metadata.get("template_id") or ""))
            )
            analysis_root = work_dir / ANALYSIS_DIR_NAME
            analysis_file = work_dir / SOURCE_ANALYSIS_FILE

            structure = None
            presentation_canvas = None
            structure_warning = None
            presentation_path = None
            if params.source_presentation:
                presentation_path = self.resolve_path(params.source_presentation).resolve(strict=False)
                if not await async_is_file(presentation_path):
                    raise SlideTemplateBuilderError(f"Source presentation does not exist: {presentation_path}")
                if presentation_path.suffix.lower() not in SUPPORTED_PRESENTATION_STRUCTURE_SUFFIXES:
                    raise SlideTemplateBuilderError(
                        "source_presentation must be an OOXML presentation. Convert legacy PPT to PPTX first."
                    )
                try:
                    structure = await asyncio.to_thread(extract_pptx_structure, presentation_path)
                    presentation_canvas = TemplateCanvas.model_validate(structure.metadata["normalized_canvas"])
                except Exception as exc:
                    structure_warning = (
                        "PPTX structure extraction failed; continue from rendered page images. "
                        f"Details: {exc}"
                    )

            rendered_pages_here = False
            if params.page_images:
                page_paths = [self.resolve_path(value).resolve(strict=False) for value in params.page_images]
                for page_path in page_paths:
                    if not await async_is_file(page_path):
                        raise SlideTemplateBuilderError(f"Source page image does not exist: {page_path}")
            else:
                assert presentation_path is not None
                page_paths = await _render_presentation_pages(
                    presentation_path,
                    resolve_template_converter_output_dir(work_dir),
                )
                rendered_pages_here = True

            if await async_exists(analysis_root):
                await async_rmtree(analysis_root)
            await async_mkdir(analysis_root / "full", parents=True, exist_ok=False)
            await async_mkdir(analysis_root / "crops", parents=True, exist_ok=False)

            slide_records = []
            analysis_batches = []
            full_page_buffers = []
            source_page_sizes = []
            for index, page_path in enumerate(page_paths, 1):
                source_bytes = await async_read_bytes(page_path)
                artifacts = await asyncio.to_thread(
                    build_page_artifacts,
                    source_bytes,
                    params.crop_columns,
                    params.crop_rows,
                )
                full_relative = f"{ANALYSIS_DIR_NAME}/full/slide-{index:03d}.png"
                full_path = work_dir / full_relative
                await async_write_bytes(full_path, artifacts.full_png)
                full_page_buffers.append(artifacts.full_png)
                source_page_sizes.append(PixelSize(width=artifacts.width, height=artifacts.height))

                crop_records = []
                crop_paths = []
                crop_dir = analysis_root / "crops" / f"slide-{index:03d}"
                await async_mkdir(crop_dir, parents=True, exist_ok=False)
                for crop in artifacts.crops:
                    crop_name = f"region-r{crop.row:02d}-c{crop.column:02d}.png"
                    crop_path = crop_dir / crop_name
                    await async_write_bytes(crop_path, crop.png)
                    crop_relative = f"{ANALYSIS_DIR_NAME}/crops/slide-{index:03d}/{crop_name}"
                    crop_records.append({
                        "file": crop_relative,
                        "row": crop.row,
                        "column": crop.column,
                        "bounds": {
                            "left": crop.bounds[0],
                            "top": crop.bounds[1],
                            "right": crop.bounds[2],
                            "bottom": crop.bounds[3],
                        },
                    })
                    crop_paths.append(str(crop_path))
                slide_records.append({
                    "source_index": index,
                    "source_image": page_path.name,
                    "full_image": full_relative,
                    "source_size": {"width": artifacts.width, "height": artifacts.height},
                    "background_probe": artifacts.background.as_dict(),
                    "detail_crops": crop_records,
                    "visual_analysis": {
                        "status": "pending",
                        "summary": "",
                        "background": {},
                        "palette": [],
                        "typography": [],
                        "composition": {},
                        "visual_elements": [],
                        "image_details": [],
                        "style_tokens": {},
                        "must_preserve": [],
                        "uncertainties": [],
                    },
                })
                analysis_batches.append({
                    "source_index": index,
                    "images": [str(full_path), *crop_paths],
                })

            source = metadata.get("source") if isinstance(metadata.get("source"), dict) else {}
            declared_canvas = validate_canvas(source.get("canvas"))
            canvas_warnings = []
            try:
                canvas_detection = detect_source_canvas(
                    declared_canvas,
                    source_page_sizes,
                    presentation_canvas,
                )
            except ValueError as exc:
                raise SlideTemplateBuilderError(str(exc)) from exc
            detected_canvas = canvas_detection.canvas
            canvas_warning = canvas_detection.warning
            if canvas_warning:
                source["canvas"] = detected_canvas.model_dump()
                metadata["source"] = source
                metadata_warnings = metadata.get("warnings")
                if not isinstance(metadata_warnings, list):
                    metadata_warnings = []
                if canvas_warning not in metadata_warnings:
                    metadata_warnings.append(canvas_warning)
                metadata["warnings"] = metadata_warnings
                canvas_warnings.append(canvas_warning)
                await async_write_json(metadata_path, metadata, ensure_ascii=False, indent=2)

            contact_sheet = await asyncio.to_thread(create_contact_sheet, full_page_buffers)
            contact_sheet_path = analysis_root / "contact-sheet.png"
            await async_write_bytes(contact_sheet_path, contact_sheet)

            structure_path = None
            structure_slide_count = None
            extracted_asset_count = 0
            asset_catalog = []
            asset_analysis_paths = []
            if structure is not None:
                structure_path = analysis_root / "pptx-structure.json"
                await async_write_json(structure_path, structure.metadata, ensure_ascii=False, indent=2)
                structure_slide_count = structure.metadata["slide_count"]
                slide_indices = _source_asset_slide_indices(structure.metadata)
                for asset in structure.assets:
                    source_path = analysis_root / asset.relative_path
                    await async_write_bytes(source_path, asset.data)
                    source_slides = slide_indices.get(asset.relative_path, [])
                    asset_metadata = await asyncio.to_thread(_source_asset_metadata, asset.data)
                    if not source_slides:
                        asset_metadata["quality_flags"].append("not-linked-from-slide-shapes")
                    asset_catalog.append({
                        "id": public_asset_id(len(asset_catalog) + 1),
                        "source_file": f"{ANALYSIS_DIR_NAME}/{asset.relative_path}",
                        "asset": asset.relative_path,
                        "sha256": asset.sha256,
                        "size_bytes": len(asset.data),
                        "source_slides": source_slides,
                        "usage_count": len(source_slides),
                        "metadata": asset_metadata,
                        "decision": "pending",
                        "asset_type": "unknown",
                        "quality": "unknown",
                        "rationale": "",
                        "intended_role": "",
                        "target_name": None,
                        "final_file": None,
                    })
                    asset_analysis_paths.append(str(source_path))
                extracted_asset_count = len(structure.assets)

            warnings = list(canvas_warnings)
            if structure_warning:
                warnings.append(structure_warning)
            if structure_slide_count is not None and structure_slide_count != len(slide_records):
                warnings.append(
                    f"Rendered page count ({len(slide_records)}) differs from PPTX slide count ({structure_slide_count})."
                )
            page_backgrounds = background_variants(slide_records)
            background_map = describe_background_variants(page_backgrounds)
            manifest = {
                "schema_version": "1.0",
                "reconstruction_mode": params.reconstruction_mode,
                "background_variants": page_backgrounds,
                "source_presentation": Path(params.source_presentation).name if params.source_presentation else "",
                "capture": {
                    "contact_sheet": f"{ANALYSIS_DIR_NAME}/contact-sheet.png",
                    "crop_grid": {"columns": params.crop_columns, "rows": params.crop_rows, "overlap_ratio": 0.1},
                    "pptx_structure": (
                        f"{ANALYSIS_DIR_NAME}/pptx-structure.json" if structure_path else None
                    ),
                    "source_assets_dir": f"{ANALYSIS_DIR_NAME}/source-assets",
                },
                "slides": slide_records,
                "asset_catalog": asset_catalog,
                "warnings": warnings,
            }
            await async_write_json(analysis_file, manifest, ensure_ascii=False, indent=2)

            review_indexes = recommended_review_indexes(
                len(slide_records), page_backgrounds, params.reconstruction_mode
            )
            public_ids = [str(item.get("id") or "") for item in asset_catalog if item.get("id")]
            data = {
                "template_directory": str(template_dir),
                "working_directory": str(work_dir),
                "source_analysis": str(analysis_file),
                "contact_sheet": str(contact_sheet_path),
                "pptx_structure": str(structure_path) if structure_path else None,
                "reconstruction_mode": params.reconstruction_mode,
                "canvas": detected_canvas.model_dump(),
                "slide_count": len(slide_records),
                "pages_rendered_by_tool": rendered_pages_here,
                "background_variants": page_backgrounds,
                "page_backgrounds": [
                    {"source_index": record["source_index"], **record["background_probe"]}
                    for record in slide_records
                ],
                "detail_crop_count": len(slide_records) * params.crop_columns * params.crop_rows,
                "extracted_asset_count": extracted_asset_count,
                "asset_catalog": asset_catalog,
                "recommended_review_indexes": review_indexes,
                "asset_analysis_batches": [
                    asset_analysis_paths[index:index + 8]
                    for index in range(0, len(asset_analysis_paths), 8)
                ],
                "analysis_batches": analysis_batches,
                "warnings": warnings,
            }
            catalog_note = f" Catalog ids: {', '.join(public_ids)}. " if public_ids else ""
            background_note = (
                f"Measured page backgrounds: {background_map}. "
                "Rebuild every page on the background of the source page it derives from, and switch "
                "text and border colors with it. Never flatten the deck to a single background. "
                if background_map
                else ""
            )
            if len(page_backgrounds) > 1:
                background_note += (
                    f"The source mixes {len(page_backgrounds)} background schemes, so theme.css needs one "
                    "surface class per scheme with its own foreground colors instead of a single body background. "
                )
            review_reason = (
                "high-fidelity rebuilds every page, so every page needs measured geometry"
                if params.reconstruction_mode == "high-fidelity"
                else "that list already covers every measured background scheme"
            )
            review_note = (
                f"Recommended review pages: {', '.join(str(index) for index in review_indexes)}. "
                f"Review all of them because {review_reason}; every page you skip is a page you invent. "
                f"Call review_slide_template_source with up to {MAX_REVIEW_INDEXES_PER_CALL} source_indexes per call; "
                "pages inside one call are reviewed in parallel, so send full batches instead of one page at a time. "
            )
            select_note = (
                "Then call select_slide_template_source_assets with complete decision objects for those catalog ids. "
                "Each item needs asset, decision, asset_type, quality, and rationale. "
                "Do not pass converter filenames, catalog rows, or id-only lists. "
                if extracted_asset_count
                else "No extracted assets to select. "
            )
            render_note = (
                f"Rendered {len(slide_records)} page(s) from the source presentation. "
                if rendered_pages_here
                else ""
            )
            return ToolResult(
                content=(
                    render_note
                    + f"Slide template source prepared for {len(slide_records)} page(s) in {params.reconstruction_mode} mode. "
                    f"Canvas: {detected_canvas.width}x{detected_canvas.height}. "
                    f"Extracted {extracted_asset_count} source asset candidate(s)."
                    + catalog_note
                    + background_note
                    + review_note
                    + select_note
                    + (f"Warnings: {' '.join(warnings)} " if warnings else "")
                    + "Later tools only need template_dir. Do not write source-analysis.json "
                    "or create .template-work inside the template directory."
                ),
                data=data,
                extra_info=data,
            )
        except SlideTemplateBuilderError as exc:
            return ToolResult.error(str(exc))
        except Exception as exc:
            return ToolResult.error(f"Failed to prepare slide template source: {exc}")

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] | None = None
    ) -> Dict:
        template_dir = display_template_name((arguments or {}).get("template_dir"))
        return {
            "tool_name": tool_name,
            "action": i18n.translate("prepare_slide_template_source", category="tool.actions"),
            "remark": i18n.translate(
                "prepare_slide_template_source.before",
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
        template_dir = display_template_name(
            data.get("template_directory") or (arguments or {}).get("template_dir")
        )
        key = "prepare_slide_template_source.after_success" if result.ok else "prepare_slide_template_source.after_failed"
        return {
            "tool_name": tool_name,
            "action": i18n.translate("prepare_slide_template_source", category="tool.actions"),
            "remark": i18n.translate(key, category="tool.messages", template_dir=template_dir),
        }

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] | None = None
    ) -> Optional[ToolDetail]:
        data = result.data if isinstance(result.data, dict) else {}
        if result.ok:
            content = "\n".join([
                "# Slide template source analysis",
                "",
                f"- Mode: `{data.get('reconstruction_mode', '')}`",
                f"- Source pages: {data.get('slide_count', 0)}",
                f"- Background schemes: {len(data.get('background_variants', []))}",
                f"- Detail crops: {data.get('detail_crop_count', 0)}",
                f"- Extracted PPTX assets: {data.get('extracted_asset_count', 0)}",
                f"- Source assets pending review: {data.get('extracted_asset_count', 0)}",
                f"- Analysis manifest: `{data.get('source_analysis', '')}`",
            ])
        else:
            content = f"# Slide template source preparation failed\n\n{result.content}"
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(file_name="slide_template_source_analysis.md", content=content),
        )
