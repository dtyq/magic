"""Render validated slide templates and build aspect-preserving previews."""

import asyncio
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image

from app.service.browser.browser_config_adapter import BrowserConfigAdapter
from app.service.browser.workspace_page_loader import load_workspace_page
from app.tools.slide_template_builder.canvas import PixelSize, default_canvas_size, fit_size
from app.tools.slide_template_builder.errors import SlideTemplateBuilderError
from app.tools.slide_template_builder.models import TemplateCanvas
from app.utils.async_file_utils import async_realpath, async_write_bytes
from magic_use import BrowserClient, create_browser

THUMBNAIL_BOUNDS = PixelSize(width=1280, height=720)
COLLAGE_TILE_BOUNDS = PixelSize(width=640, height=360)
COLLAGE_COLUMNS = 3
COLLAGE_GAP = 24
COLLAGE_PADDING = 32
COLLAGE_BACKGROUND = "#f5f7fa"
MAX_COLLAGE_SLIDES = 9

_SLIDE_READY_SCRIPT = """
async () => {
  const resourcesReady = async () => {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    await Promise.all(Array.from(document.images).map(async (image) => {
      if (!image.complete) {
        await new Promise((resolve) => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        });
      }
      if (typeof image.decode === 'function' && image.naturalWidth > 0) {
        try {
          await image.decode();
        } catch (_error) {
          // Broken images are reported by the inspection step below.
        }
      }
    }));
  };
  await Promise.race([
    resourcesReady(),
    new Promise((resolve) => setTimeout(resolve, 5000))
  ]);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}
"""

_SLIDE_INSPECTION_SCRIPT = """
() => ({
  scrollWidth: document.documentElement.scrollWidth,
  scrollHeight: document.documentElement.scrollHeight,
  bodyScrollWidth: document.body ? document.body.scrollWidth : 0,
  bodyScrollHeight: document.body ? document.body.scrollHeight : 0,
  brokenImages: Array.from(document.images)
    .filter((img) => !img.complete || img.naturalWidth === 0)
    .map((img) => img.getAttribute('src') || ''),
  slideBounds: (() => {
    const slide = document.querySelector('.slide-container, .slide') || document.body;
    if (!slide) return null;
    const rect = slide.getBoundingClientRect();
    return { width: Math.round(rect.width), height: Math.round(rect.height) };
  })(),
  viewport: { width: window.innerWidth, height: window.innerHeight }
})
"""


@dataclass(frozen=True)
class SlideCapture:
    screenshot: bytes
    inspection: dict[str, Any]


@dataclass(frozen=True)
class PreviewImages:
    thumbnail_path: Path
    collage_path: Path
    slide_paths: tuple[Path, ...]


def _validate_slide_inspection(
    inspection: dict[str, Any],
    slide_name: str,
    canvas: TemplateCanvas,
) -> None:
    canvas_width = canvas.width
    canvas_height = canvas.height
    overflow = (
        max(inspection["scrollWidth"], inspection["bodyScrollWidth"]) > canvas_width
        or max(inspection["scrollHeight"], inspection["bodyScrollHeight"]) > canvas_height
    )
    if overflow:
        raise SlideTemplateBuilderError(f"Slide overflows the {canvas_width}x{canvas_height} canvas: {slide_name}")
    slide_bounds = inspection.get("slideBounds")
    if slide_bounds and (
        abs(slide_bounds["width"] - canvas_width) > 1 or abs(slide_bounds["height"] - canvas_height) > 1
    ):
        raise SlideTemplateBuilderError(
            f"Slide root is {slide_bounds['width']}x{slide_bounds['height']}, "
            f"but source.canvas is {canvas_width}x{canvas_height}: {slide_name}"
        )
    if inspection["brokenImages"]:
        raise SlideTemplateBuilderError(
            f"Slide contains broken images: {slide_name}: {', '.join(inspection['brokenImages'][:5])}"
        )


async def _capture_browser_slide(
    browser: BrowserClient,
    page_id: str,
    workspace_root: Path,
    slide_path: Path,
    slide_name: str,
    canvas: TemplateCanvas,
) -> SlideCapture:
    await load_workspace_page(browser, page_id, workspace_root, slide_path)
    await browser.evaluate(page_id, _SLIDE_READY_SCRIPT)
    inspection_value = await browser.evaluate(page_id, _SLIDE_INSPECTION_SCRIPT)
    if not isinstance(inspection_value, dict):
        raise SlideTemplateBuilderError(f"Slide inspection returned invalid data: {slide_name}")
    inspection = dict(inspection_value)
    _validate_slide_inspection(inspection, slide_name, canvas)
    screenshot = await browser.screenshot(page_id)
    return SlideCapture(screenshot=screenshot.image, inspection=inspection)


async def render_slide_previews(
    *,
    workspace_dir: Path,
    template_dir: Path,
    slides: list[dict[str, Any]],
    canvas: TemplateCanvas,
) -> list[SlideCapture]:
    workspace_root = await async_realpath(workspace_dir, strict=True)
    template_root = await async_realpath(template_dir, strict=True)
    config = await BrowserConfigAdapter.build_playwright(
        str(workspace_root),
        viewport_width=canvas.width,
        viewport_height=canvas.height,
        device_scale_factor=1,
    )
    browser = await create_browser(config)
    try:
        pages = await browser.list_pages()
        if not pages:
            raise SlideTemplateBuilderError("The Browser runtime did not provide an active page.")
        page_id = pages[0].id
        captures = []
        for slide in slides:
            slide_path = template_root / slide["file"]
            captures.append(
                await _capture_browser_slide(
                    browser,
                    page_id,
                    workspace_root,
                    slide_path,
                    slide_path.name,
                    canvas,
                )
            )
        return captures
    finally:
        await browser.close()


def _resize_png(buffer: bytes, size: tuple[int, int]) -> bytes:
    with Image.open(BytesIO(buffer)) as image:
        rendered = image.convert("RGB").resize(size, Image.Resampling.LANCZOS)
        output = BytesIO()
        rendered.save(output, format="PNG")
        return output.getvalue()


def _create_collage(
    buffers: list[bytes],
    canvas_size: TemplateCanvas | None = None,
) -> bytes:
    canvas = canvas_size or default_canvas_size()
    selected = buffers[:MAX_COLLAGE_SLIDES]
    columns = min(COLLAGE_COLUMNS, len(selected))
    rows = (len(selected) + columns - 1) // columns
    tile_size = fit_size(canvas, COLLAGE_TILE_BOUNDS)
    width = COLLAGE_PADDING * 2 + columns * tile_size.width + (columns - 1) * COLLAGE_GAP
    height = COLLAGE_PADDING * 2 + rows * tile_size.height + (rows - 1) * COLLAGE_GAP
    collage = Image.new("RGB", (width, height), COLLAGE_BACKGROUND)
    for index, buffer in enumerate(selected):
        with Image.open(BytesIO(buffer)) as image:
            tile = image.convert("RGB").resize(tile_size.as_tuple(), Image.Resampling.LANCZOS)
        left = COLLAGE_PADDING + (index % columns) * (tile_size.width + COLLAGE_GAP)
        top = COLLAGE_PADDING + (index // columns) * (tile_size.height + COLLAGE_GAP)
        collage.paste(tile, (left, top))
    output = BytesIO()
    collage.save(output, format="PNG")
    return output.getvalue()


async def write_preview_images(
    preview_dir: Path,
    slide_buffers: list[bytes],
    canvas_size: TemplateCanvas | None = None,
) -> PreviewImages:
    canvas = canvas_size or default_canvas_size()
    slides_dir = preview_dir / "slides"
    slide_paths = []
    for index, buffer in enumerate(slide_buffers, 1):
        slide_path = slides_dir / f"slide-{index:03d}.png"
        await async_write_bytes(slide_path, buffer)
        slide_paths.append(slide_path)
    thumbnail_path = preview_dir / "thumbnail.png"
    collage_path = preview_dir / "collage.png"
    thumbnail = await asyncio.to_thread(
        _resize_png,
        slide_buffers[0],
        fit_size(canvas, THUMBNAIL_BOUNDS).as_tuple(),
    )
    collage = await asyncio.to_thread(_create_collage, slide_buffers, canvas)
    await async_write_bytes(thumbnail_path, thumbnail)
    await async_write_bytes(collage_path, collage)
    return PreviewImages(
        thumbnail_path=thumbnail_path,
        collage_path=collage_path,
        slide_paths=tuple(slide_paths),
    )
