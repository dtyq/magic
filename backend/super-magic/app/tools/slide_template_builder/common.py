"""Shared validation helpers for slide template tools."""

import json
import re
import time
import unicodedata
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.tools.slide_template_builder import taxonomy_source
from app.tools.slide_template_builder.canvas import validate_canvas_size
from app.tools.slide_template_builder.errors import SlideTemplateBuilderError
from app.tools.slide_template_builder.models import (
    BACKEND_CATEGORY_CODE_PATTERN,
    BACKEND_TEMPLATE_ID_PATTERN,
    LAYOUT_PATTERN,
    SLIDE_FILE_PATTERN,
    TemplateCanvas,
)
from app.tools.slide_template_builder.taxonomy import active_category_codes, tag_records_by_code
from app.utils.async_file_utils import (
    async_exists,
    async_mkdir,
    async_read_json,
    async_read_text,
    async_rmtree,
    async_scandir,
    async_stat,
)
from app.utils.runtime_storage import get_runtime_config_int, trigger_opportunistic_cleanup

SCAFFOLD_MARKER = "slide-template-scaffold"
WORK_DIR_NAME = ".template-work"
RUNTIME_CAPABILITY_NAME = "slide-template-maker"
ANALYSIS_DIR_NAME = "source-analysis"
CONVERTER_DIR_NAME = "converter"
SOURCE_ANALYSIS_FILE = "source-analysis.json"
RECONSTRUCTION_MODES = {"high-fidelity", "template-abstraction", "hybrid"}
# 底色分组容差：同一设计里的同类底色允许存在渲染噪声
BACKGROUND_VARIANT_STEP = 24
REVIEW_INDEX_LIMIT = 12
HIGH_FIDELITY_REVIEW_INDEX_LIMIT = 40
MAX_TAG_CODES = 10
# 单次回顾的页数上限。同一批内的页面并发送审，批量越大总耗时越低。
MAX_REVIEW_INDEXES_PER_CALL = 6


def public_asset_id(index: int) -> str:
    return f"asset-{index:02d}"


def display_template_name(template_dir: str | None) -> str:
    """Return the folder name users should see, never a sandbox path."""
    value = str(template_dir or "").strip().rstrip("/\\")
    if not value or value == "-":
        return "-"
    return Path(value).name or "-"


def _background_variant_key(probe: dict[str, Any]) -> str | None:
    color = str(probe.get("color") or "").lower()
    if not re.fullmatch(r"#[0-9a-f]{6}", color):
        return None
    channels = [int(color[position : position + 2], 16) for position in (1, 3, 5)]
    bucket = "-".join(str(round(channel / BACKGROUND_VARIANT_STEP)) for channel in channels)
    tone = str(probe.get("tone") or "unknown")
    surface = "flat" if probe.get("uniform") else "textured"
    return f"{tone}:{surface}:{bucket}"


def background_variants(slides: list[Any]) -> list[dict[str, Any]]:
    """Group source pages by measured background so each one can be reviewed and rebuilt."""
    groups: dict[str, dict[str, Any]] = {}
    for position, slide in enumerate(slides, 1):
        if not isinstance(slide, dict):
            continue
        probe = slide.get("background_probe")
        if not isinstance(probe, dict):
            continue
        key = _background_variant_key(probe)
        if key is None:
            continue
        source_index = slide.get("source_index")
        page = source_index if isinstance(source_index, int) and source_index > 0 else position
        variant = groups.get(key)
        if variant is None:
            groups[key] = {
                "key": key,
                "color": str(probe.get("color") or ""),
                "tone": str(probe.get("tone") or "unknown"),
                "uniform": bool(probe.get("uniform")),
                "pages": [page],
            }
            continue
        if page not in variant["pages"]:
            variant["pages"].append(page)
    variants = list(groups.values())
    for variant in variants:
        variant["pages"].sort()
    variants.sort(key=lambda item: (-len(item["pages"]), item["pages"][0]))
    return variants


def format_page_ranges(pages: list[int]) -> str:
    ordered = sorted({page for page in pages if isinstance(page, int) and page > 0})
    if not ordered:
        return ""
    spans: list[tuple[int, int]] = []
    start = previous = ordered[0]
    for page in ordered[1:]:
        if page == previous + 1:
            previous = page
            continue
        spans.append((start, previous))
        start = previous = page
    spans.append((start, previous))
    return ", ".join(
        str(first) if first == last else f"{first}-{last}"
        for first, last in spans
    )


def describe_background_variants(variants: list[dict[str, Any]]) -> str:
    """Render the background map as one line the model can act on directly."""
    parts = []
    for variant in variants:
        surface = "flat" if variant.get("uniform") else "textured or image-backed"
        parts.append(
            f"{variant.get('tone', 'unknown')} {variant.get('color', '')} ({surface}) "
            f"on page {format_page_ranges(variant.get('pages') or [])}"
        )
    return "; ".join(parts)


def recommended_review_indexes(
    slide_count: int,
    variants: list[dict[str, Any]] | None = None,
    reconstruction_mode: str = "hybrid",
) -> list[int]:
    """Sample pages for deep review, covering every measured background variant.

    高保真是逐页重建，每一页都会成为最终页，抽样会让未回顾页的版心和字号只能靠猜，
    所以这里返回全部页；其它模式只做代表页抽样。
    """
    if slide_count <= 0:
        return []
    if reconstruction_mode == "high-fidelity":
        return list(range(1, min(slide_count, HIGH_FIDELITY_REVIEW_INDEX_LIMIT) + 1))
    if slide_count <= 4:
        return list(range(1, slide_count + 1))
    indexes = {1, slide_count // 3, (2 * slide_count) // 3, slide_count}
    indexes.discard(0)
    for variant in variants or []:
        if len(indexes) >= REVIEW_INDEX_LIMIT:
            break
        pages = [page for page in variant.get("pages") or [] if isinstance(page, int) and 0 < page <= slide_count]
        if pages and not indexes.intersection(pages):
            indexes.add(pages[0])
    return sorted(indexes)


def unreviewed_background_variants(slides: list[Any]) -> list[dict[str, Any]]:
    """Background variants whose pages were all skipped during deep review."""
    reviewed = set()
    for position, slide in enumerate(slides, 1):
        if not isinstance(slide, dict):
            continue
        visual = slide.get("visual_analysis")
        if not isinstance(visual, dict) or visual.get("status") != "complete":
            continue
        source_index = slide.get("source_index")
        reviewed.add(source_index if isinstance(source_index, int) and source_index > 0 else position)
    return [
        variant
        for variant in background_variants(slides)
        if not reviewed.intersection(variant["pages"])
    ]


def unreviewed_source_indexes(slides: list[Any]) -> list[int]:
    indexes: list[int] = []
    for position, slide in enumerate(slides, 1):
        if not isinstance(slide, dict):
            indexes.append(position)
            continue
        source_index = slide.get("source_index")
        index = source_index if isinstance(source_index, int) and source_index > 0 else position
        visual = slide.get("visual_analysis")
        if not isinstance(visual, dict) or visual.get("status") != "complete":
            indexes.append(index)
    return indexes


@dataclass(frozen=True)
class ValidatedTemplate:
    template_dir: Path
    metadata: dict[str, Any]
    slides: list[dict[str, Any]]
    canvas: TemplateCanvas
    source_analysis_summary: dict[str, Any] | None


def resolve_runtime_root(workspace: Path) -> Path:
    """Place runtime data beside the workspace, never inside it."""
    resolved = workspace.resolve(strict=False)
    try:
        from app.path_manager import PathManager

        official_workspace = PathManager.get_workspace_dir().resolve(strict=False)
        if resolved == official_workspace:
            return PathManager.get_runtime_dir()
    except (RuntimeError, AttributeError, TypeError):
        pass
    if resolved.name == ".workspace":
        return resolved.parent / ".runtime"
    return resolved.parent / f"{resolved.name}.runtime"


def resolve_template_working_directory(template_dir: Path, template_id: str) -> Path:
    """Resolve the authoring work directory outside the workspace."""
    normalized_id = str(template_id or "").strip()
    if not normalized_id:
        raise SlideTemplateBuilderError("template_id is required to resolve the working directory.")
    return resolve_runtime_root(template_dir.parent) / RUNTIME_CAPABILITY_NAME / normalized_id


def resolve_template_converter_output_dir(work_dir: Path) -> Path:
    """Place PPTX conversion artifacts beside template authoring state, outside the workspace."""
    return work_dir / CONVERTER_DIR_NAME


async def evict_stale_template_working_directories(
    capability_root: Path,
    *,
    protected_paths: frozenset[Path] = frozenset(),
    max_age_seconds: int | None = None,
    max_entries: int | None = None,
) -> None:
    """Drop abandoned authoring dirs by age, then by oldest-first count."""
    if max_age_seconds is None:
        max_age_seconds = (
            get_runtime_config_int(
                "runtime_cleanup.slide_template_maker.max_age_days",
                minimum=1,
            )
            * 24
            * 60
            * 60
        )
    if max_entries is None:
        max_entries = get_runtime_config_int(
            "runtime_cleanup.slide_template_maker.max_directory_count",
            minimum=1,
        )
    if not await async_exists(capability_root):
        return
    protected = {path.resolve(strict=False) for path in protected_paths}
    candidates: list[tuple[float, Path]] = []
    for entry in await async_scandir(capability_root):
        path = Path(entry.path)
        if path.resolve(strict=False) in protected or entry.is_symlink() or not entry.is_dir():
            continue
        try:
            stat = await async_stat(path)
        except FileNotFoundError:
            continue
        candidates.append((stat.st_mtime, path))
    candidates.sort()
    now = time.time()
    remaining: list[Path] = []
    for modified_at, path in candidates:
        if now - modified_at > max_age_seconds:
            await async_rmtree(path)
        else:
            remaining.append(path)
    overflow = len(remaining) - max_entries
    if overflow <= 0:
        return
    for path in remaining[:overflow]:
        await async_rmtree(path)


async def ensure_template_working_directory(work_dir: Path) -> Path:
    """Create the authoring work directory, using official runtime rules when possible."""
    try:
        from app.path_manager import PathManager
        from app.utils.runtime_storage import ensure_runtime_directory

        official = PathManager.get_runtime_dir().resolve(strict=False)
        target = work_dir.resolve(strict=False)
        if target == official or official in target.parents:
            created = await ensure_runtime_directory(work_dir)
            trigger_opportunistic_cleanup(
                "slide-template-maker",
                lambda: evict_stale_template_working_directories(
                    official / RUNTIME_CAPABILITY_NAME,
                    protected_paths=frozenset({created}),
                ),
            )
            return created
    except RuntimeError:
        pass
    await async_mkdir(work_dir, parents=True, exist_ok=True)
    trigger_opportunistic_cleanup(
        f"slide-template-maker:{work_dir.parent}",
        lambda: evict_stale_template_working_directories(
            work_dir.parent,
            protected_paths=frozenset({work_dir}),
        ),
    )
    return work_dir


def resolve_workspace_template_dir(base_dir: Path, value: str) -> Path:
    raw_path = Path(value.strip())
    candidate = raw_path if raw_path.is_absolute() else base_dir / raw_path
    resolved = candidate.resolve(strict=False)
    workspace = base_dir.resolve(strict=False)
    try:
        resolved.relative_to(workspace)
    except ValueError as exc:
        raise SlideTemplateBuilderError("Template directory must stay inside the workspace.") from exc
    if not resolved.exists() and not raw_path.is_absolute() and raw_path.parent == Path("."):
        for entry in workspace.iterdir():
            if not entry.is_dir():
                continue
            metadata_path = entry / "template.json"
            try:
                metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            if str(metadata.get("template_id") or "").strip() == value.strip():
                resolved = entry.resolve(strict=False)
                break
    return resolved


def validate_template_id(value: str) -> str:
    template_id = value.strip()
    if not re.fullmatch(BACKEND_TEMPLATE_ID_PATTERN, template_id):
        raise SlideTemplateBuilderError(
            "template_id must match the backend format: SLIDE- followed by alphanumeric kebab-case segments."
        )
    return template_id


def generate_unique_template_id(base_id: str) -> str:
    """Append a short uppercase UUID-derived suffix to a validated semantic ID."""
    semantic_id = validate_template_id(base_id)
    return f"{semantic_id}-{uuid.uuid4().hex[:6].upper()}"


def _semantic_directory_part(value: str, *, max_length: int) -> str:
    normalized = unicodedata.normalize("NFKC", str(value or "")).strip()
    normalized = re.sub(
        r"[^A-Za-z0-9\u3400-\u4DBF\u4E00-\u9FFF]+",
        "-",
        normalized,
    )
    normalized = re.sub(r"-+", "-", normalized).strip("-").lower()
    return normalized[:max_length].rstrip("-")


def generate_semantic_directory_name(label: Any, tag_codes: Any) -> str:
    """Build a readable local directory name in the template's selected language."""
    label_data = label if isinstance(label, dict) else {}
    tags = set(tag_codes) if isinstance(tag_codes, list) else set()
    if "language-chinese" in tags:
        semantic_part = _semantic_directory_part(label_data.get("zh_CN", ""), max_length=48) or "模板"
    else:
        semantic_part = _semantic_directory_part(label_data.get("en_US", ""), max_length=64) or "template"
    return f"SLIDE-{semantic_part}"


def validate_template_directory(template_dir: Path, metadata: dict[str, Any]) -> None:
    template_id = validate_template_id(str(metadata.get("template_id") or ""))
    if template_dir.name == template_id:
        return
    label = metadata.get("label")
    expected_name = generate_semantic_directory_name(label, metadata.get("tag_codes"))
    if template_dir.name != expected_name:
        raise SlideTemplateBuilderError("Template directory name does not match its localized semantic name.")


def validate_taxonomy_selection(
    category_code: Any,
    tag_codes: Any,
    taxonomy: dict[str, Any] | None = None,
) -> tuple[str, list[str]]:
    category = str(category_code or "").strip()
    active_categories = sorted(active_category_codes(taxonomy))
    if category not in active_categories:
        # 目录会随后端调整而漂移，直接把当前可用值回给模型，避免它再查一次目录后重发整个请求。
        raise SlideTemplateBuilderError(
            f"category_code is not an active PPT category: {category or '<empty>'}. "
            f"Retry with the closest match from the currently active codes: {', '.join(active_categories)}."
        )
    if not isinstance(tag_codes, list) or not tag_codes:
        raise SlideTemplateBuilderError("tag_codes must contain at least one active tag code.")
    normalized = [str(code).strip() for code in tag_codes]
    if any(not code for code in normalized):
        raise SlideTemplateBuilderError("tag_codes cannot contain empty values.")
    if len(normalized) != len(set(normalized)):
        raise SlideTemplateBuilderError("tag_codes cannot contain duplicates.")
    if len(normalized) > MAX_TAG_CODES:
        raise SlideTemplateBuilderError(
            f"tag_codes accepts at most {MAX_TAG_CODES} codes, received {len(normalized)}. "
            "Keep the codes that describe this template best and drop the rest."
        )
    records = tag_records_by_code(taxonomy)
    unknown = [code for code in normalized if code not in records]
    if unknown:
        raise SlideTemplateBuilderError(
            f"tag_codes contain unknown codes: {', '.join(unknown)}. "
            "Call query_slide_template_taxonomy and copy exact codes from result.data."
        )
    return category, normalized


def _validate_slide_canvas_contract(slide_text: str, slide_file: str, canvas: TemplateCanvas) -> None:
    roots = []
    for match in re.finditer(r"<main\b([^>]*)>", slide_text, re.IGNORECASE):
        attributes = match.group(1)
        class_match = re.search(r'''\bclass\s*=\s*["']([^"']*)["']''', attributes, re.IGNORECASE)
        if class_match and "slide-container" in class_match.group(1).split():
            roots.append(attributes)

    if not roots:
        for match in re.finditer(r"<[a-z][^>]*>", slide_text, re.IGNORECASE):
            class_match = re.search(r'''\bclass\s*=\s*["']([^"']*)["']''', match.group(0), re.IGNORECASE)
            if class_match and {"slide", "ft-canvas"}.intersection(class_match.group(1).split()):
                return
        raise SlideTemplateBuilderError(
            f"Slide must contain a main.slide-container root or a legacy slide canvas: {slide_file}"
        )
    if len(roots) != 1:
        raise SlideTemplateBuilderError(
            f"Slide must contain exactly one main.slide-container root: {slide_file}"
        )

    attributes = roots[0]
    dimensions = {}
    for name in ("data-width", "data-height"):
        value_match = re.search(rf'''\b{name}\s*=\s*["']([^"']+)["']''', attributes, re.IGNORECASE)
        if not value_match:
            raise SlideTemplateBuilderError(f"Slide canvas must declare {name}: {slide_file}")
        dimensions[name] = value_match.group(1)

    if dimensions["data-width"] != str(canvas.width) or dimensions["data-height"] != str(canvas.height):
        raise SlideTemplateBuilderError(
            f"Slide canvas data-width/data-height must match source.canvas {canvas.width}x{canvas.height}: {slide_file}"
        )


def safe_slide_path(template_dir: Path, relative_path: str) -> Path:
    if not re.fullmatch(SLIDE_FILE_PATTERN, relative_path):
        raise SlideTemplateBuilderError(f"Invalid slide file path: {relative_path}")
    resolved = (template_dir / relative_path).resolve(strict=False)
    slides_root = (template_dir / "slides").resolve(strict=False)
    try:
        resolved.relative_to(slides_root)
    except ValueError as exc:
        raise SlideTemplateBuilderError(f"Slide path escapes slides directory: {relative_path}") from exc
    return resolved


def _required_text(value: Any, field_name: str) -> str:
    text = str(value or "").strip()
    if not text:
        raise SlideTemplateBuilderError(f"Missing required template field: {field_name}")
    return text


def validate_canvas(value: Any, field_name: str = "source.canvas") -> TemplateCanvas:
    try:
        return validate_canvas_size(value, field_name)
    except ValueError as exc:
        raise SlideTemplateBuilderError(str(exc)) from exc


def _resolve_analysis_artifact(work_dir: Path, relative_path: str) -> Path:
    resolved = (work_dir / relative_path).resolve(strict=False)
    analysis_root = (work_dir / ANALYSIS_DIR_NAME).resolve(strict=False)
    try:
        resolved.relative_to(analysis_root)
    except ValueError as exc:
        raise SlideTemplateBuilderError(f"Source analysis path escapes its working directory: {relative_path}") from exc
    return resolved


def _resolve_template_image_asset(template_dir: Path, relative_path: str) -> Path:
    resolved = (template_dir / relative_path).resolve(strict=False)
    images_root = (template_dir / "images").resolve(strict=False)
    try:
        resolved.relative_to(images_root)
    except ValueError as exc:
        raise SlideTemplateBuilderError(f"Source asset path must stay inside images/: {relative_path}") from exc
    return resolved


async def _validate_source_analysis(
    template_dir: Path,
    metadata: dict[str, Any],
) -> dict[str, Any] | None:
    source = metadata.get("source") if isinstance(metadata.get("source"), dict) else {}
    if source.get("method") != "visual-reconstruction":
        return None

    work_dir = resolve_template_working_directory(template_dir, str(metadata.get("template_id") or ""))
    analysis_path = work_dir / SOURCE_ANALYSIS_FILE
    if not await async_exists(analysis_path):
        existing_manifest_path = template_dir / "template-assets.json"
        if await async_exists(existing_manifest_path):
            existing_manifest = await async_read_json(existing_manifest_path)
            existing_summary = existing_manifest.get("source_analysis")
            if isinstance(existing_summary, dict) and existing_summary.get("completed") is True:
                return existing_summary
        raise SlideTemplateBuilderError(
            "Visual reconstruction requires completed source analysis. Call prepare_slide_template_source first."
        )

    analysis = await async_read_json(analysis_path)
    mode = str(analysis.get("reconstruction_mode") or "")
    if mode not in RECONSTRUCTION_MODES:
        raise SlideTemplateBuilderError("source-analysis.json reconstruction_mode is invalid.")
    analysis_slides = analysis.get("slides")
    if not isinstance(analysis_slides, list) or not analysis_slides:
        raise SlideTemplateBuilderError("source-analysis.json must contain analyzed source slides.")

    asset_catalog = analysis.get("asset_catalog")
    if asset_catalog is None:
        asset_catalog = []
    if not isinstance(asset_catalog, list):
        raise SlideTemplateBuilderError("source-analysis.json asset_catalog must be an array.")
    selected_asset_count = 0
    discarded_asset_count = 0
    selected_source_files = []
    for index, asset in enumerate(asset_catalog, 1):
        if not isinstance(asset, dict):
            raise SlideTemplateBuilderError(f"Source asset {index} must be an object.")
        decision = str(asset.get("decision") or "")
        quality = str(asset.get("quality") or "")
        rationale = str(asset.get("rationale") or "").strip()
        if decision == "pending":
            raise SlideTemplateBuilderError(
                f"Source asset review is incomplete for {asset.get('asset') or index}. "
                "Call select_slide_template_source_assets first."
            )
        if decision not in {"reuse", "discard"}:
            raise SlideTemplateBuilderError(f"Source asset {index} has an invalid decision.")
        if quality not in {"high", "acceptable", "poor"}:
            raise SlideTemplateBuilderError(f"Source asset {index} has an invalid quality rating.")
        if not rationale:
            raise SlideTemplateBuilderError(f"Source asset {index} must include a review rationale.")
        if decision == "reuse":
            if quality == "poor":
                raise SlideTemplateBuilderError(f"Poor-quality source asset cannot be selected: {asset.get('asset')}")
            final_file = str(asset.get("final_file") or "")
            if not final_file or not await async_exists(_resolve_template_image_asset(template_dir, final_file)):
                raise SlideTemplateBuilderError(f"Selected source asset is missing: {final_file or '<empty>'}")
            selected_asset_count += 1
            selected_source_files.append(final_file)
        else:
            if asset.get("final_file"):
                raise SlideTemplateBuilderError(f"Discarded source asset must not have a final file: {asset.get('asset')}")
            discarded_asset_count += 1

    must_preserve_count = 0
    visual_element_count = 0
    unreviewed = []
    for index, slide in enumerate(analysis_slides, 1):
        if not isinstance(slide, dict):
            raise SlideTemplateBuilderError(f"Source analysis slide {index} must be an object.")
        full_image = str(slide.get("full_image") or "")
        if not full_image or not await async_exists(_resolve_analysis_artifact(work_dir, full_image)):
            raise SlideTemplateBuilderError(f"Source analysis full image is missing for slide {index}.")
        crops = slide.get("detail_crops")
        if not isinstance(crops, list) or len(crops) < 4:
            raise SlideTemplateBuilderError(f"Source analysis needs at least four detail crops for slide {index}.")
        for crop in crops:
            crop_file = str(crop.get("file") or "") if isinstance(crop, dict) else ""
            if not crop_file or not await async_exists(_resolve_analysis_artifact(work_dir, crop_file)):
                raise SlideTemplateBuilderError(f"Source analysis crop is missing for slide {index}.")
        visual = slide.get("visual_analysis")
        source_index = slide.get("source_index") if isinstance(slide.get("source_index"), int) else index
        if not isinstance(visual, dict) or visual.get("status") != "complete":
            unreviewed.append(source_index)
            continue
        must_preserve = visual.get("must_preserve")
        visual_elements = visual.get("visual_elements")
        style_tokens = visual.get("style_tokens")
        if not isinstance(must_preserve, list) or not must_preserve:
            raise SlideTemplateBuilderError(f"Source analysis must list must_preserve details for slide {index}.")
        if not isinstance(visual_elements, list) or not visual_elements:
            raise SlideTemplateBuilderError(f"Source analysis must list visual elements for slide {index}.")
        if not isinstance(style_tokens, dict) or not style_tokens:
            raise SlideTemplateBuilderError(f"Source analysis must record style tokens for slide {index}.")
        must_preserve_count += len(must_preserve)
        visual_element_count += len(visual_elements)

    capture = analysis.get("capture") if isinstance(analysis.get("capture"), dict) else {}
    warnings = [str(item) for item in analysis.get("warnings")] if isinstance(analysis.get("warnings"), list) else []
    if unreviewed:
        warnings.append(
            "Unreviewed source pages: "
            + ", ".join(str(item) for item in unreviewed)
            + ". Call review_slide_template_source with those source_indexes."
        )
    variants = background_variants(analysis_slides)
    unreviewed_variants = unreviewed_background_variants(analysis_slides)
    if unreviewed_variants:
        warnings.append(
            "These source background variants were never reviewed: "
            + describe_background_variants(unreviewed_variants)
            + ". Their light/dark treatment is likely missing from the template."
        )
    return {
        "completed": True,
        "reconstruction_mode": mode,
        "source_slide_count": len(analysis_slides),
        "reviewed_slide_count": len(analysis_slides) - len(unreviewed),
        "unreviewed_source_indexes": unreviewed,
        "background_variants": variants,
        "background_map": describe_background_variants(variants),
        "unreviewed_background_variants": [variant["key"] for variant in unreviewed_variants],
        "must_preserve_count": must_preserve_count,
        "visual_element_count": visual_element_count,
        "pptx_structure_extracted": bool(capture.get("pptx_structure")),
        "source_asset_count": len(asset_catalog),
        "selected_source_asset_count": selected_asset_count,
        "discarded_source_asset_count": discarded_asset_count,
        "selected_source_files": selected_source_files,
        "warnings": warnings,
    }


async def validate_template_project(
    template_dir: Path,
    taxonomy: dict[str, Any] | None = None,
) -> ValidatedTemplate:
    required_paths = [
        template_dir / "template.json",
        template_dir / "visual-spec.md",
        template_dir / "theme.css",
        template_dir / "images",
        template_dir / "slides",
    ]
    missing = [str(path.name) for path in required_paths if not await async_exists(path)]
    if missing:
        raise SlideTemplateBuilderError(f"Template structure is incomplete: {', '.join(missing)}")

    metadata = await async_read_json(template_dir / "template.json")
    validate_template_directory(template_dir, metadata)
    if metadata.get("schema_version") != "1.0":
        raise SlideTemplateBuilderError("schema_version must be 1.0.")
    catalog = taxonomy if taxonomy is not None else (await taxonomy_source.resolve_taxonomy()).catalog
    category_code, _ = validate_taxonomy_selection(
        metadata.get("category_code"), metadata.get("tag_codes"), catalog
    )
    if not re.fullmatch(BACKEND_CATEGORY_CODE_PATTERN, category_code):
        raise SlideTemplateBuilderError("category_code does not match the backend category code format.")

    for field_name in ("label", "description"):
        value = metadata.get(field_name)
        if not isinstance(value, dict):
            raise SlideTemplateBuilderError(f"{field_name} must be an object.")
        _required_text(value.get("zh_CN"), f"{field_name}.zh_CN")
        _required_text(value.get("en_US"), f"{field_name}.en_US")

    files = metadata.get("files")
    expected_files = {
        "visual_spec": "visual-spec.md",
        "theme_css": "theme.css",
        "slides_dir": "slides",
        "images_dir": "images",
    }
    if files != expected_files:
        raise SlideTemplateBuilderError("template.json files must use the standard slide template paths.")

    source = metadata.get("source")
    if not isinstance(source, dict):
        raise SlideTemplateBuilderError("source must be an object.")
    if source.get("kind") not in {"original", "derived"}:
        raise SlideTemplateBuilderError("source.kind must be original or derived.")
    if source.get("method") not in {
        "manual", "brief-generator", "image-rebuild", "html-import",
        "visual-reconstruction", "project-extract",
    }:
        raise SlideTemplateBuilderError("source.method is invalid.")
    source_file = str(source.get("file") or "")
    if "/" in source_file or "\\" in source_file:
        raise SlideTemplateBuilderError("source.file must be a basename.")
    canvas = validate_canvas(source.get("canvas"))

    slides = metadata.get("slides")
    if not isinstance(slides, list) or not slides:
        raise SlideTemplateBuilderError("template.json slides must contain at least one page.")
    seen_files: set[str] = set()
    for index, slide in enumerate(slides, 1):
        if not isinstance(slide, dict):
            raise SlideTemplateBuilderError(f"Slide {index} metadata must be an object.")
        relative_path = str(slide.get("file") or "")
        if relative_path in seen_files:
            raise SlideTemplateBuilderError(f"Duplicate slide file: {relative_path}")
        seen_files.add(relative_path)
        slide_path = safe_slide_path(template_dir, relative_path)
        if not await async_exists(slide_path):
            raise SlideTemplateBuilderError(f"Declared slide file does not exist: {relative_path}")
        _required_text(slide.get("title"), f"slides[{index}].title")
        layout = str(slide.get("layout") or "")
        if not re.fullmatch(LAYOUT_PATTERN, layout):
            raise SlideTemplateBuilderError(f"Invalid slide layout: {layout}")
        _required_text(slide.get("description"), f"slides[{index}].description")

    texts = [
        await async_read_text(template_dir / "visual-spec.md"),
        await async_read_text(template_dir / "theme.css"),
    ]
    for item in slides:
        slide_text = await async_read_text(safe_slide_path(template_dir, item["file"]))
        if not re.search(r'<link\b[^>]*href=["\']\.\./theme\.css(?:["\']|\?)', slide_text, re.IGNORECASE):
            raise SlideTemplateBuilderError(f"Slide must load ../theme.css: {item['file']}")
        if len(re.findall(r'\bdata-slot=["\']', slide_text, re.IGNORECASE)) < 3:
            raise SlideTemplateBuilderError(f"Slide must expose at least three editable data-slot regions: {item['file']}")
        _validate_slide_canvas_contract(slide_text, item["file"], canvas)
        texts.append(slide_text)
    if any(SCAFFOLD_MARKER in text for text in texts):
        raise SlideTemplateBuilderError("Template scaffold markers remain. Replace every scaffold file before finalizing.")

    forbidden_fragments = (
        "Converted Slide", "legacy-frame", "legacy-stage", "preview-header",
        "slides-grid", "pptx-to-html", "convert_pptx_to_slide_template",
    )
    combined = "\n".join(texts)
    residue = next((item for item in forbidden_fragments if item in combined), "")
    if residue:
        raise SlideTemplateBuilderError(f"Legacy conversion residue found: {residue}")
    if re.search(r"(?:src|href)=[\"'](?:https?:|file:|/)", combined, re.IGNORECASE):
        raise SlideTemplateBuilderError("Template pages must use local relative assets only.")
    if re.search(r"url\(\s*[\"']?(?:https?:|file:|/)", combined, re.IGNORECASE):
        raise SlideTemplateBuilderError("Template styles must use local relative assets only.")

    unexpected = []
    for item in await async_scandir(template_dir / "slides"):
        if item.is_file() and Path(item.name).suffix.lower() == ".html":
            relative = f"slides/{item.name}"
            if relative not in seen_files:
                unexpected.append(relative)
    if unexpected:
        raise SlideTemplateBuilderError(f"Unindexed slide files found: {', '.join(sorted(unexpected))}")

    source_analysis_summary = await _validate_source_analysis(template_dir, metadata)
    if source_analysis_summary:
        selected_source_files = source_analysis_summary.get("selected_source_files")
        if not isinstance(selected_source_files, list):
            selected_source_files = []
        referenced_source_assets = [
            path
            for path in selected_source_files
            if isinstance(path, str)
            and any(candidate in combined for candidate in (path, f"../{path}"))
        ]
        source_analysis_summary["referenced_source_asset_count"] = len(referenced_source_assets)
        unreferenced_source_assets = sorted(set(selected_source_files) - set(referenced_source_assets))
        if unreferenced_source_assets:
            raise SlideTemplateBuilderError(
                "Every selected source asset must be referenced by the final HTML or CSS. Unused assets: "
                + ", ".join(unreferenced_source_assets)
            )
        source_assets_dir = template_dir / "images" / "source-assets"
        unexpected_source_assets = []
        if await async_exists(source_assets_dir):
            for item in await async_scandir(source_assets_dir):
                if item.is_file():
                    relative = f"images/source-assets/{item.name}"
                    if relative not in selected_source_files:
                        unexpected_source_assets.append(relative)
                elif item.is_dir():
                    unexpected_source_assets.append(f"images/source-assets/{item.name}/")
        if unexpected_source_assets:
            raise SlideTemplateBuilderError(
                "Unused files remain in images/source-assets/: " + ", ".join(sorted(unexpected_source_assets))
            )
    return ValidatedTemplate(
        template_dir=template_dir,
        metadata=metadata,
        slides=slides,
        canvas=canvas,
        source_analysis_summary=source_analysis_summary,
    )


async def cleanup_template_intermediates(template_dir: Path) -> list[str]:
    """Remove the runtime work directory and any leftover in-project scratch dir."""

    removed: list[str] = []
    legacy_dir = template_dir / WORK_DIR_NAME
    if await async_exists(legacy_dir):
        await async_rmtree(legacy_dir)
        removed.append(WORK_DIR_NAME)

    metadata_path = template_dir / "template.json"
    if await async_exists(metadata_path):
        try:
            metadata = await async_read_json(metadata_path)
        except (OSError, ValueError):
            metadata = {}
        template_id = str(metadata.get("template_id") or "").strip() if isinstance(metadata, dict) else ""
        if template_id:
            work_dir = resolve_template_working_directory(template_dir, template_id)
            if await async_exists(work_dir):
                await async_rmtree(work_dir)
                removed.append(str(work_dir))
    return removed
