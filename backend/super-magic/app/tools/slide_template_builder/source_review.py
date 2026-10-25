"""Review source pages and write visual analysis into the official manifest."""

from __future__ import annotations

import asyncio
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Optional

from pydantic import Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.tools.core import BaseToolParams, tool
from app.tools.slide_template_builder.common import (
    MAX_REVIEW_INDEXES_PER_CALL,
    SOURCE_ANALYSIS_FILE,
    SlideTemplateBuilderError,
    display_template_name,
    resolve_template_working_directory,
    resolve_workspace_template_dir,
    unreviewed_source_indexes,
    validate_template_directory,
)
from app.tools.workspace_tool import WorkspaceTool
from app.utils.async_file_utils import async_is_file, async_read_json, async_write_json

SOURCE_REVIEW_QUERY_TEMPLATE = """Analyze this source slide so it can be rebuilt as fixed-canvas HTML and CSS.
The first image is the full page. Remaining images are representative detail crops.
{measured_note}
Report geometry as percentages of page width or page height, never in pixels, so the values survive
a canvas resize. Report every color as a hex value read from the image, never as a color name.
Return JSON only with this shape:
{{
  "summary": "one paragraph describing this page's visual grammar",
  "background": {{
    "tone": "dark or light",
    "base_color": "#rrggbb",
    "treatment": "flat, gradient, image, pattern, or split",
    "detail": "how the background is built, including gradient direction, split ratio, or overlay",
    "text_color": "#rrggbb for the main body text sitting on this background"
  }},
  "palette": [{{"role": "accent", "hex": "#rrggbb", "usage": "where it appears on this page"}}],
  "typography": [
    {{"role": "page-title", "size_pct_of_height": 6.5, "weight": 700, "case": "none", "color": "#rrggbb"}}
  ],
  "composition": {{
    "margin_pct": {{"top": 8, "right": 6, "bottom": 8, "left": 6}},
    "columns": 2,
    "title_block": {{"x_pct": 6, "y_pct": 10, "width_pct": 55, "align": "left"}},
    "content_blocks": [
      {{"role": "kpi-row", "x_pct": 6, "y_pct": 40, "width_pct": 88, "height_pct": 22}}
    ],
    "alignment": "the shared alignment axis, for example all blocks start at x 6%",
    "density": "low, medium, or high"
  }},
  "visual_elements": [{{"role": "...", "description": "..."}}],
  "style_tokens": {{"accent": "#rrggbb", "corner_radius_px": 0, "border": "...", "shadow": "..."}},
  "image_details": [],
  "must_preserve": ["concrete detail that would change the style if lost"],
  "uncertainties": []
}}
Measure the real margins and block positions instead of assuming a centered or evenly split layout.
State the background tone explicitly even when it matches the previous page.
"""
SOURCE_REVIEW_MEASURED_NOTE = (
    "The page background was already measured programmatically: {color} ({tone}, {surface}, "
    "relative luminance {luminance}). Treat that as ground truth for base_color and tone, and "
    "describe how the background is constructed on top of it."
)
JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.DOTALL | re.IGNORECASE)
PALETTE_DIGEST_LIMIT = 6
TYPOGRAPHY_DIGEST_LIMIT = 5
CONTENT_BLOCK_DIGEST_LIMIT = 5
MUST_PRESERVE_DIGEST_LIMIT = 6


@dataclass
class SourceReviewRequest:
    """One page queued for visual review, with everything the batch needs to run concurrently."""

    source_index: int
    slide: dict[str, Any]
    probe: dict[str, Any] | None
    images: list[str] = field(default_factory=list)


def build_source_review_query(probe: dict[str, Any] | None) -> str:
    measured_note = ""
    if isinstance(probe, dict) and probe.get("color"):
        measured_note = SOURCE_REVIEW_MEASURED_NOTE.format(
            color=probe.get("color"),
            tone=probe.get("tone") or "unknown tone",
            surface="flat fill" if probe.get("uniform") else "textured or image-backed",
            luminance=probe.get("luminance"),
        )
    return SOURCE_REVIEW_QUERY_TEMPLATE.format(measured_note=measured_note)


class ReviewSlideTemplateSourceParams(BaseToolParams):
    template_dir: str = Field(
        ...,
        description="""<!--zh: 已调用 prepare_slide_template_source 的模板目录。-->
Template directory previously prepared by prepare_slide_template_source.""",
    )
    source_indexes: list[int] = Field(
        ...,
        min_length=1,
        description="""<!--zh: 本次回顾的源页序号，从 1 开始，每批最多 6 页。同一批内并发回顾，所以按满批发送，不要一页一页调。取值用 prepare 返回的 recommended_review_indexes。-->
1-based source page indexes to review in this call, at most 6 per call. Pages inside one call are reviewed in parallel, so send full batches instead of one page at a time. Take the values from prepare's recommended_review_indexes.""",
    )

    @field_validator("template_dir")
    @classmethod
    def strip_template_dir(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("template_dir is required")
        return value

    @field_validator("source_indexes")
    @classmethod
    def normalize_source_indexes(cls, values: list[int]) -> list[int]:
        unique: list[int] = []
        for index in values:
            if index < 1:
                raise ValueError("source_indexes must be 1-based")
            if index not in unique:
                unique.append(index)
        if not unique:
            raise ValueError("source_indexes is required")
        return unique


def split_review_indexes(
    indexes: list[int],
    limit: int = MAX_REVIEW_INDEXES_PER_CALL,
) -> tuple[list[int], list[int]]:
    return indexes[:limit], indexes[limit:]


def parse_source_review_payload(raw: str, probe: dict[str, Any] | None = None) -> dict[str, Any]:
    text = (raw or "").strip()
    candidates: list[str] = []
    fence = JSON_FENCE_RE.search(text)
    if fence:
        candidates.append(fence.group(1))
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        candidates.append(text[start : end + 1])
    for candidate in candidates:
        try:
            payload = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict):
            return _normalize_review_payload(payload, text, probe)
    return _normalize_review_payload({}, text, probe)


def _merge_measured_background(background: dict[str, Any], probe: dict[str, Any] | None) -> dict[str, Any]:
    """Measured values win over model guesses, so the per-page light/dark rhythm survives."""
    merged = dict(background)
    if not isinstance(probe, dict):
        return merged
    if probe.get("color"):
        merged["base_color"] = probe["color"]
        merged["measured_color"] = probe["color"]
    if probe.get("tone"):
        merged["tone"] = probe["tone"]
    if probe.get("luminance") is not None:
        merged["measured_luminance"] = probe["luminance"]
    if not merged.get("treatment"):
        merged["treatment"] = "flat" if probe.get("uniform") else "textured"
    return merged


def _normalize_review_payload(
    payload: dict[str, Any],
    raw: str,
    probe: dict[str, Any] | None = None,
) -> dict[str, Any]:
    summary = str(payload.get("summary") or "").strip() or raw.strip() or "Visual review recorded."
    must_preserve = payload.get("must_preserve")
    if not isinstance(must_preserve, list) or not must_preserve:
        must_preserve = [summary]
    visual_elements = payload.get("visual_elements")
    if not isinstance(visual_elements, list) or not visual_elements:
        visual_elements = [{"role": "page", "description": summary}]
    style_tokens = payload.get("style_tokens")
    if not isinstance(style_tokens, dict) or not style_tokens:
        style_tokens = {"notes": "unparsed"}
    background = payload.get("background") if isinstance(payload.get("background"), dict) else {}
    return {
        "summary": summary,
        "must_preserve": [str(item).strip() for item in must_preserve if str(item).strip()],
        "visual_elements": visual_elements,
        "style_tokens": style_tokens,
        "background": _merge_measured_background(background, probe),
        "palette": payload.get("palette") if isinstance(payload.get("palette"), list) else [],
        "typography": payload.get("typography") if isinstance(payload.get("typography"), list) else [],
        "composition": payload.get("composition") if isinstance(payload.get("composition"), dict) else {},
        "image_details": payload.get("image_details") if isinstance(payload.get("image_details"), list) else [],
        "uncertainties": payload.get("uncertainties") if isinstance(payload.get("uncertainties"), list) else [],
    }


def _percent(value: Any) -> str | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return f"{value:g}%"


def _describe_background(background: dict[str, Any]) -> str:
    tone = str(background.get("tone") or "unknown tone")
    color = str(background.get("base_color") or "unknown color")
    treatment = str(background.get("treatment") or "unspecified treatment")
    detail = str(background.get("detail") or "").strip()
    text_color = str(background.get("text_color") or "").strip()
    line = f"{tone} {color}, {treatment}"
    if detail:
        line += f" ({detail})"
    if text_color:
        line += f". Body text {text_color}"
    return line


def _describe_palette(palette: list[Any]) -> str:
    entries = []
    for item in palette[:PALETTE_DIGEST_LIMIT]:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role") or "color")
        hex_value = str(item.get("hex") or "?")
        usage = str(item.get("usage") or "").strip()
        entries.append(f"{role} {hex_value}" + (f" ({usage})" if usage else ""))
    return "; ".join(entries)


def _describe_typography(typography: list[Any]) -> str:
    entries = []
    for item in typography[:TYPOGRAPHY_DIGEST_LIMIT]:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role") or "text")
        size = _percent(item.get("size_pct_of_height"))
        weight = item.get("weight")
        parts = [role]
        if size:
            parts.append(f"{size} of height")
        if isinstance(weight, (int, float)) and not isinstance(weight, bool):
            parts.append(f"weight {weight:g}")
        entries.append(" ".join(parts))
    return "; ".join(entries)


def _describe_composition(composition: dict[str, Any]) -> str:
    parts = []
    margin = composition.get("margin_pct")
    if isinstance(margin, dict):
        sides = [
            f"{label}{value}"
            for label, key in (("T", "top"), ("R", "right"), ("B", "bottom"), ("L", "left"))
            if (value := _percent(margin.get(key)))
        ]
        if sides:
            parts.append("margins " + " ".join(sides))
    columns = composition.get("columns")
    if isinstance(columns, (int, float)) and not isinstance(columns, bool):
        parts.append(f"{columns:g} column(s)")
    title_block = composition.get("title_block")
    if isinstance(title_block, dict):
        coordinates = [
            f"{label}{value}"
            for label, key in (("x", "x_pct"), ("y", "y_pct"), ("w", "width_pct"))
            if (value := _percent(title_block.get(key)))
        ]
        align = str(title_block.get("align") or "").strip()
        if coordinates or align:
            parts.append("title block " + " ".join([*coordinates, align]).strip())
    blocks = composition.get("content_blocks")
    if isinstance(blocks, list):
        described = []
        for block in blocks[:CONTENT_BLOCK_DIGEST_LIMIT]:
            if not isinstance(block, dict):
                continue
            coordinates = [
                f"{label}{value}"
                for label, key in (("x", "x_pct"), ("y", "y_pct"), ("w", "width_pct"), ("h", "height_pct"))
                if (value := _percent(block.get(key)))
            ]
            described.append(f"{block.get('role') or 'block'} " + " ".join(coordinates))
        if described:
            parts.append("blocks " + "; ".join(described))
    alignment = str(composition.get("alignment") or "").strip()
    if alignment:
        parts.append(f"alignment {alignment}")
    density = str(composition.get("density") or "").strip()
    if density:
        parts.append(f"{density} density")
    return ", ".join(parts)


def render_page_digest(index: int, payload: dict[str, Any]) -> str:
    lines = [f"Page {index}: {payload['summary']}"]
    for label, text in (
        ("Background", _describe_background(payload["background"])),
        ("Palette", _describe_palette(payload["palette"])),
        ("Composition", _describe_composition(payload["composition"])),
        ("Type scale", _describe_typography(payload["typography"])),
        ("Must preserve", "; ".join(payload["must_preserve"][:MUST_PRESERVE_DIGEST_LIMIT])),
    ):
        if text:
            lines.append(f"- {label}: {text}")
    return "\n".join(lines)


def representative_crop_files(crops: list[Any]) -> list[str]:
    records = [item for item in crops if isinstance(item, dict) and item.get("file")]
    if not records:
        return []
    rows = [item.get("row") for item in records if isinstance(item.get("row"), int)]
    cols = [item.get("column") for item in records if isinstance(item.get("column"), int)]
    if not rows or not cols:
        return [str(item["file"]) for item in records[:4]]
    by_key = {
        (item.get("row"), item.get("column")): str(item["file"])
        for item in records
        if isinstance(item.get("row"), int) and isinstance(item.get("column"), int)
    }
    keys = [
        (min(rows), min(cols)),
        (min(rows), max(cols)),
        (max(rows), min(cols)),
        (max(rows), max(cols)),
    ]
    files: list[str] = []
    seen: set[str] = set()
    for key in keys:
        file = by_key.get(key)
        if file and file not in seen:
            seen.add(file)
            files.append(file)
    return files


async def inspect_source_images(images: list[str], query: str) -> ToolResult:
    from app.tools.visual_understanding import VisualUnderstanding, VisualUnderstandingParams

    return await VisualUnderstanding().execute_purely(
        VisualUnderstandingParams(images=images, query=query),
        include_download_info_in_content=False,
        include_dimensions_info_in_content=False,
    )


@tool(name="review_slide_template_source", code_mode_only=True)
class ReviewSlideTemplateSource(WorkspaceTool[ReviewSlideTemplateSourceParams]):
    """<!--zh
    回顾源 PPT 指定页面：工具自行带上官方整页图和代表裁剪，写入视觉分析，并返回给人看的摘要。
    -->
    Review selected source pages. The tool attaches official full-page images and representative crops, writes visual analysis, and returns a human-readable summary.
    """

    name = "review_slide_template_source"

    async def execute(self, tool_context: ToolContext, params: ReviewSlideTemplateSourceParams) -> ToolResult:
        template_dir = resolve_workspace_template_dir(Path(self.base_dir), params.template_dir)
        try:
            metadata = await async_read_json(template_dir / "template.json")
            validate_template_directory(template_dir, metadata)
            work_dir = resolve_template_working_directory(template_dir, str(metadata.get("template_id") or ""))
            analysis_file = work_dir / SOURCE_ANALYSIS_FILE
            if not await async_is_file(analysis_file):
                raise SlideTemplateBuilderError("Call prepare_slide_template_source before reviewing source pages.")
            analysis = await async_read_json(analysis_file)
            slides = analysis.get("slides")
            if not isinstance(slides, list) or not slides:
                raise SlideTemplateBuilderError("source-analysis.json must contain analyzed source slides.")
            slides_by_index = {
                int(slide.get("source_index")): slide
                for slide in slides
                if isinstance(slide, dict) and isinstance(slide.get("source_index"), int)
            }
            batch_indexes, deferred_indexes = split_review_indexes(params.source_indexes)
            missing = [index for index in batch_indexes if index not in slides_by_index]
            if missing:
                raise SlideTemplateBuilderError(
                    "Unknown source_indexes: "
                    + ", ".join(str(index) for index in missing)
                    + f". Valid range is 1-{len(slides)}."
                )

            requests: list[SourceReviewRequest] = []
            for index in batch_indexes:
                slide = slides_by_index[index]
                full_image = str(slide.get("full_image") or "")
                if not full_image:
                    raise SlideTemplateBuilderError(f"Source analysis full image is missing for slide {index}.")
                crop_files = representative_crop_files(
                    slide.get("detail_crops") if isinstance(slide.get("detail_crops"), list) else []
                )
                probe = slide.get("background_probe") if isinstance(slide.get("background_probe"), dict) else None
                requests.append(SourceReviewRequest(
                    source_index=index,
                    slide=slide,
                    probe=probe,
                    images=[str(work_dir / full_image), *[str(work_dir / path) for path in crop_files]],
                ))

            # 一批内的页面互不依赖，并发送审把回顾耗时从「页数 x 单页」压回「约等于单页」。
            results = await asyncio.gather(*(
                inspect_source_images(request.images, build_source_review_query(request.probe))
                for request in requests
            ))

            digests: list[str] = []
            preserve_notes: list[str] = []
            page_backgrounds: list[dict[str, Any]] = []
            for request, result in zip(requests, results):
                if not result.ok:
                    raise SlideTemplateBuilderError(
                        f"Visual review failed for source page {request.source_index}: {result.content}"
                    )
                payload = parse_source_review_payload(str(result.content or ""), request.probe)
                visual = request.slide.get("visual_analysis")
                if not isinstance(visual, dict):
                    visual = {}
                    request.slide["visual_analysis"] = visual
                visual.update({"status": "complete", **payload})
                digests.append(render_page_digest(request.source_index, payload))
                preserve_notes.extend(
                    str(item) for item in payload["must_preserve"][:MUST_PRESERVE_DIGEST_LIMIT]
                )
                page_backgrounds.append({"source_index": request.source_index, **payload["background"]})

            await async_write_json(analysis_file, analysis, ensure_ascii=False, indent=2)
            remaining = unreviewed_source_indexes(slides)
            remaining_note = (
                f"Remaining unreviewed pages: {', '.join(str(index) for index in remaining)}."
                if remaining
                else "All prepared source pages have been reviewed."
            )
            if deferred_indexes:
                remaining_note += (
                    f" This call reviews at most {MAX_REVIEW_INDEXES_PER_CALL} pages; call again for: "
                    + ", ".join(str(index) for index in deferred_indexes)
                    + "."
                )
            data = {
                "template_directory": str(template_dir),
                "reviewed_source_indexes": batch_indexes,
                "unreviewed_source_indexes": remaining,
                "page_backgrounds": page_backgrounds,
                "must_preserve": preserve_notes,
            }
            return ToolResult(
                content="\n\n".join([
                    "Source visual review updated.",
                    *digests,
                    "Carry these values into visual-spec.md and theme.css. Rebuild each page on the "
                    "background reported for the source page it derives from, keep the measured margins "
                    "and alignment axis instead of centering everything, and scale type from the "
                    "percentages above so it stays readable on the declared canvas.",
                    remaining_note,
                ]),
                data=data,
                extra_info=data,
            )
        except SlideTemplateBuilderError as exc:
            return ToolResult.error(str(exc))
        except Exception as exc:
            return ToolResult.error(f"Failed to review slide template source: {exc}")

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] | None = None
    ) -> Dict:
        template_dir = display_template_name((arguments or {}).get("template_dir"))
        return {
            "tool_name": tool_name,
            "action": i18n.translate("review_slide_template_source", category="tool.actions"),
            "remark": i18n.translate(
                "review_slide_template_source.before",
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
        key = (
            "review_slide_template_source.after_success"
            if result.ok
            else "review_slide_template_source.after_failed"
        )
        return {
            "tool_name": tool_name,
            "action": i18n.translate("review_slide_template_source", category="tool.actions"),
            "remark": i18n.translate(key, category="tool.messages", template_dir=template_dir),
        }

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] | None = None
    ) -> Optional[ToolDetail]:
        data = result.data if isinstance(result.data, dict) else {}
        if result.ok:
            content = "\n".join([
                "# Slide template source review",
                "",
                f"- Reviewed pages: {', '.join(str(item) for item in data.get('reviewed_source_indexes', [])) or '-'}",
                f"- Remaining pages: {', '.join(str(item) for item in data.get('unreviewed_source_indexes', [])) or 'none'}",
                "- Backgrounds: "
                + (
                    "; ".join(
                        f"page {item.get('source_index')} {item.get('tone', '')} {item.get('base_color', '')}".strip()
                        for item in data.get("page_backgrounds", [])
                    )
                    or "-"
                ),
                f"- Must preserve: {'; '.join(data.get('must_preserve', [])) or '-'}",
            ])
        else:
            content = f"# Source review failed\n\n{result.content}"
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(file_name="slide_template_source_review.md", content=content),
        )
