"""Build visual evidence images for slide template source analysis."""

import math
from collections import Counter
from dataclasses import dataclass
from io import BytesIO

from PIL import Image, ImageDraw, ImageOps

from app.tools.slide_template_builder.errors import SlideTemplateBuilderError

# 底色探测参数：只采样页面外框带，避开正文内容区
BACKGROUND_BAND_RATIO = 0.06
BACKGROUND_SAMPLE_BUDGET = 18000
BACKGROUND_QUANTIZE_STEP = 16
BACKGROUND_MATCH_DISTANCE = 28.0
BACKGROUND_UNIFORM_COVERAGE = 0.7
# WCAG 相对亮度阈值：低于该值时白字对比度优于黑字
DARK_TONE_LUMINANCE = 0.18


@dataclass(frozen=True)
class CropArtifact:
    row: int
    column: int
    bounds: tuple[int, int, int, int]
    png: bytes


@dataclass(frozen=True)
class BackgroundProbe:
    """Measured page background, used to keep per-page light/dark rhythm."""

    color: str
    tone: str
    luminance: float
    coverage: float
    uniform: bool

    def as_dict(self) -> dict[str, object]:
        return {
            "color": self.color,
            "tone": self.tone,
            "luminance": self.luminance,
            "coverage": self.coverage,
            "uniform": self.uniform,
        }


@dataclass(frozen=True)
class PageArtifacts:
    width: int
    height: int
    full_png: bytes
    crops: tuple[CropArtifact, ...]
    background: BackgroundProbe


def _png_bytes(image: Image.Image) -> bytes:
    output = BytesIO()
    image.save(output, format="PNG", optimize=True)
    return output.getvalue()


def _linear_channel(value: int) -> float:
    channel = value / 255.0
    if channel <= 0.04045:
        return channel / 12.92
    return ((channel + 0.055) / 1.055) ** 2.4


def _relative_luminance(rgb: tuple[int, int, int]) -> float:
    red, green, blue = (_linear_channel(channel) for channel in rgb)
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue


def _border_samples(image: Image.Image) -> list[tuple[int, int, int]]:
    width, height = image.size
    band = max(2, round(min(width, height) * BACKGROUND_BAND_RATIO))
    step = max(1, round(math.sqrt(width * height / BACKGROUND_SAMPLE_BUDGET)))
    pixels = image.load()
    samples: list[tuple[int, int, int]] = []
    for y in range(0, height, step):
        horizontal_band = y < band or y >= height - band
        for x in range(0, width, step):
            if horizontal_band or x < band or x >= width - band:
                samples.append(pixels[x, y])
    return samples


def probe_page_background(image: Image.Image) -> BackgroundProbe:
    """Measure the dominant border color of a rendered page.

    The border band carries the page background on almost every slide layout,
    so this stays reliable without asking a vision model for a color value.
    """
    samples = _border_samples(image)
    if not samples:
        samples = [image.convert("RGB").getpixel((0, 0))]
    buckets: Counter[tuple[int, int, int]] = Counter(
        tuple(channel // BACKGROUND_QUANTIZE_STEP for channel in sample) for sample in samples
    )
    dominant_bucket, _ = buckets.most_common(1)[0]
    bucket_members = [
        sample
        for sample in samples
        if tuple(channel // BACKGROUND_QUANTIZE_STEP for channel in sample) == dominant_bucket
    ]
    dominant = tuple(round(sum(channels) / len(bucket_members)) for channels in zip(*bucket_members, strict=True))
    matches = sum(
        1
        for sample in samples
        if math.dist(sample, dominant) <= BACKGROUND_MATCH_DISTANCE
    )
    coverage = matches / len(samples)
    luminance = _relative_luminance(dominant)
    return BackgroundProbe(
        color="#{:02x}{:02x}{:02x}".format(*dominant),
        tone="dark" if luminance <= DARK_TONE_LUMINANCE else "light",
        luminance=round(luminance, 4),
        coverage=round(coverage, 4),
        uniform=coverage >= BACKGROUND_UNIFORM_COVERAGE,
    )


def build_page_artifacts(data: bytes, columns: int, rows: int) -> PageArtifacts:
    with Image.open(BytesIO(data)) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
    width, height = image.size
    if width < 320 or height < 180:
        raise SlideTemplateBuilderError(f"Source page image is too small for detailed analysis: {width}x{height}")
    cell_width = width / columns
    cell_height = height / rows
    overlap_x = cell_width * 0.1
    overlap_y = cell_height * 0.1
    crops = []
    for row in range(rows):
        for column in range(columns):
            left = max(0, math.floor(column * cell_width - overlap_x))
            top = max(0, math.floor(row * cell_height - overlap_y))
            right = min(width, math.ceil((column + 1) * cell_width + overlap_x))
            bottom = min(height, math.ceil((row + 1) * cell_height + overlap_y))
            crops.append(CropArtifact(
                row=row + 1,
                column=column + 1,
                bounds=(left, top, right, bottom),
                png=_png_bytes(image.crop((left, top, right, bottom))),
            ))
    return PageArtifacts(
        width=width,
        height=height,
        full_png=_png_bytes(image),
        crops=tuple(crops),
        background=probe_page_background(image),
    )


def create_contact_sheet(pages: list[bytes]) -> bytes:
    columns = min(4, len(pages))
    rows = math.ceil(len(pages) / columns)
    tile_width, tile_height = 480, 270
    label_height = 28
    gap = 20
    padding = 24
    width = padding * 2 + columns * tile_width + (columns - 1) * gap
    height = padding * 2 + rows * (tile_height + label_height) + (rows - 1) * gap
    sheet = Image.new("RGB", (width, height), "#eef1f5")
    draw = ImageDraw.Draw(sheet)
    for index, data in enumerate(pages, 1):
        with Image.open(BytesIO(data)) as source:
            image = ImageOps.pad(source.convert("RGB"), (tile_width, tile_height), color="#ffffff")
        left = padding + ((index - 1) % columns) * (tile_width + gap)
        top = padding + ((index - 1) // columns) * (tile_height + label_height + gap)
        sheet.paste(image, (left, top))
        draw.text((left, top + tile_height + 6), f"Slide {index:03d}", fill="#1f2937")
    return _png_bytes(sheet)
