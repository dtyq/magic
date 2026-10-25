"""Canvas validation and aspect-ratio helpers for slide templates."""

from dataclasses import dataclass
from typing import Any

from app.tools.slide_template_builder.models import TemplateCanvas

DEFAULT_CANVAS_WIDTH = 1920
DEFAULT_CANVAS_HEIGHT = 1080
MIN_CANVAS_WIDTH = 320
MIN_CANVAS_HEIGHT = 180
MAX_CANVAS_WIDTH = 8192
MAX_CANVAS_HEIGHT = 8192


@dataclass(frozen=True)
class PixelSize:
    width: int
    height: int

    def as_tuple(self) -> tuple[int, int]:
        return self.width, self.height


@dataclass(frozen=True)
class CanvasDetection:
    canvas: TemplateCanvas
    warning: str | None


def default_canvas_size() -> TemplateCanvas:
    return TemplateCanvas(width=DEFAULT_CANVAS_WIDTH, height=DEFAULT_CANVAS_HEIGHT)


def validate_canvas_size(value: Any, field_name: str = "source.canvas") -> TemplateCanvas:
    if not isinstance(value, dict):
        raise ValueError(f"{field_name} must be an object.")
    width = value.get("width")
    height = value.get("height")
    if (
        isinstance(width, bool)
        or isinstance(height, bool)
        or not isinstance(width, int)
        or not isinstance(height, int)
    ):
        raise ValueError(f"{field_name} width and height must be integers.")
    if (
        width < MIN_CANVAS_WIDTH
        or height < MIN_CANVAS_HEIGHT
        or width > MAX_CANVAS_WIDTH
        or height > MAX_CANVAS_HEIGHT
    ):
        raise ValueError(
            f"{field_name} must be between {MIN_CANVAS_WIDTH}x{MIN_CANVAS_HEIGHT} "
            f"and {MAX_CANVAS_WIDTH}x{MAX_CANVAS_HEIGHT} pixels."
        )
    return TemplateCanvas(width=width, height=height)


def normalize_canvas_size(width: int, height: int, max_dimension: int = 1920) -> TemplateCanvas:
    """Scale a source size to a stable authoring size without changing its ratio."""
    if width <= 0 or height <= 0:
        raise ValueError("Canvas width and height must be positive.")
    scale = max(max_dimension / max(width, height), MIN_CANVAS_WIDTH / width, MIN_CANVAS_HEIGHT / height)
    return validate_canvas_size(
        {"width": round(width * scale), "height": round(height * scale)},
        "normalized canvas",
    )


def canvas_aspect_matches(
    left: TemplateCanvas | PixelSize,
    right: TemplateCanvas | PixelSize,
    tolerance: float = 0.001,
) -> bool:
    return abs(left.width / left.height - right.width / right.height) <= tolerance


def detect_source_canvas(
    declared_canvas: TemplateCanvas,
    source_page_sizes: list[PixelSize],
    presentation_canvas: TemplateCanvas | None = None,
) -> CanvasDetection:
    if not source_page_sizes:
        raise ValueError("At least one source page size is required.")
    first_source_size = source_page_sizes[0]
    inconsistent_size = next(
        (size for size in source_page_sizes[1:] if not canvas_aspect_matches(first_source_size, size)),
        None,
    )
    if inconsistent_size:
        raise ValueError(
            "Source pages use different aspect ratios and cannot share one template canvas: "
            f"{first_source_size.width}x{first_source_size.height} and "
            f"{inconsistent_size.width}x{inconsistent_size.height}."
        )
    rendered_canvas = normalize_canvas_size(first_source_size.width, first_source_size.height)
    if presentation_canvas is not None:
        if not canvas_aspect_matches(presentation_canvas, first_source_size):
            raise ValueError(
                f"Rendered page aspect ratio {first_source_size.width}x{first_source_size.height} "
                f"does not match the PPTX canvas {presentation_canvas.width}x{presentation_canvas.height}. "
                "Re-render the source pages without changing their aspect ratio."
            )
        detected_canvas = presentation_canvas
        if declared_canvas == detected_canvas:
            return CanvasDetection(canvas=declared_canvas, warning=None)
    else:
        detected_canvas = rendered_canvas
        if canvas_aspect_matches(declared_canvas, detected_canvas):
            return CanvasDetection(canvas=declared_canvas, warning=None)
    source_label = "source presentation" if presentation_canvas is not None else "rendered page"
    warning = (
        f"Source canvas changed from {declared_canvas.width}x{declared_canvas.height} to "
        f"{detected_canvas.width}x{detected_canvas.height} to preserve the {source_label} aspect ratio."
    )
    return CanvasDetection(canvas=detected_canvas, warning=warning)


def fit_size(size: TemplateCanvas, bounds: PixelSize) -> PixelSize:
    """Fit a size inside bounds while preserving its aspect ratio."""
    scale = min(bounds.width / size.width, bounds.height / size.height)
    return PixelSize(
        width=max(1, round(size.width * scale)),
        height=max(1, round(size.height * scale)),
    )
