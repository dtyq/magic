"""图片临时压缩与 Base64 编码服务。

Base64 结果会写入 `.runtime/native_visual_cache/`，同一张图在后续 run 中直接复用，
不再重复解码和编码；缓存细节见 `image_base64_cache.py`。
"""

from __future__ import annotations

import asyncio
import base64
import io
import mimetypes
import shutil
import tempfile
import time
import uuid
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps

from agentlang.logger import get_logger
from app.path_manager import PathManager
from app.tools.visual_understanding_utils.image_base64_cache import (
    CachedImageBase64,
    ImageBase64Cache,
    ImageBase64CacheKey,
)
from app.utils.async_file_utils import async_mkdir, async_read_bytes, async_stat

logger = get_logger(__name__)

WEBP_BASE64_QUALITY = 90
WEBP_BASE64_MAX_DIMENSION = 1920
WEBP_BASE64_MAX_SIZE_BYTES = 512 * 1024

# WebP 的 method 是"投入多少算力换多少体积"的档位，0 最快、6 最慢。
# 实测一张 1280×1706 RGBA 图在 q90 下：
#   method=6 → 14.32s / 820KB
#   method=5 →  0.26s / 834KB
# 慢 55 倍只换来 1.8% 的体积。一次调用要试多个"尺寸 × 质量"组合，
# 所以固定用 5，不追求最高压缩率。
WEBP_ENCODE_METHOD = 5

# 单次压缩搜索的时间预算。正常图片远达不到上限，它只兜住病态输入：
# 例如 alpha 平面本身超过目标体积时，搜索要一路缩到很小才可能命中。
WEBP_SEARCH_MAX_SECONDS = 60.0

# 单次压缩搜索的编码次数上限，与时间预算互为兜底。
# 改造前是"每个缩小尺寸都把 10 档质量全试一遍"，实测那张 1280×1706 的抠图 PNG
# 用了 28 次编码（其中只有 1 次有效）；现在正常图片 1 次命中，需要降质或降尺寸的
# 图片也在十几次以内，48 次足以覆盖合法路径，同时给病态输入兜住 CPU。
WEBP_SEARCH_MAX_ATTEMPTS = 48

# 连续失败多少次质量试探后，插一次"最低质量"试探。
# 体积对质量单调递减，所以最低质量失败就等价于"该尺寸下任何质量都无法达标"。
# 抠图类 PNG 的 alpha 平面独立压缩、基本不随 quality 变化，正是这种情况：
# 实测一张 1280×1706 的抠图 PNG，在原尺寸下 10 个质量全部超标，
# 提前探底可以把 10 次无效编码压到 3 次。设成 2 是为了不拖慢
# "只是稍微超标、降一两档就够"的常见图片。
WEBP_QUALITY_FEASIBILITY_PROBE_AFTER = 2


@dataclass(frozen=True)
class WebPCompressionResult:
    """WebP 压缩结果，记录输出文件和图片元数据。"""

    output_path: Path
    width: int
    height: int
    output_size: int


@dataclass(frozen=True)
class _WebpCandidate:
    """搜索命中的一次编码结果，附带本次搜索累计的尝试次数。"""

    content: bytes
    width: int
    height: int
    attempts: int


@dataclass
class _SearchBudget:
    """一次 WebP 搜索的时间预算与尝试计数，透明降级重试共用同一份预算。"""

    deadline: float
    attempts: int = 0


class _SearchBudgetExceeded(Exception):
    """搜索超出时间预算，由调用方决定是否降级。"""


def _build_data_url(content_type: str, content: bytes) -> str:
    """将文件内容编码为带 MIME 前缀的 Data URL。"""
    encoded = base64.b64encode(content).decode("utf-8")
    return f"data:{content_type};base64,{encoded}"


def _data_url_size(content_type: str, content: bytes) -> int:
    """计算 Data URL 的 UTF-8 字节大小。"""
    encoded_size = 4 * ((len(content) + 2) // 3)
    prefix_size = len(f"data:{content_type};base64,".encode("utf-8"))
    return prefix_size + encoded_size


def _quality_candidates(quality: int) -> list[int]:
    """生成从首选质量到最低质量的有序候选值。"""
    candidates = [quality, 80, 70, 60, 50, 40, 30, 20, 10, 1]
    return list(dict.fromkeys(value for value in candidates if value <= quality))


def _resize_for_max_dimension(image: Image.Image, max_dimension: int) -> Image.Image:
    """复制并按最大边长缩放图片。"""
    resized = image.copy()
    if max_dimension and max(resized.size) > max_dimension:
        resized.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
    return resized


def _decode_image_sync(file_content: bytes) -> Image.Image:
    """解码图片并规范化颜色模式，返回脱离原始文件缓冲的独立图像。"""
    with Image.open(io.BytesIO(file_content)) as source_image:
        # 动图原生视觉只使用第一帧，避免把动画容器传给静态图片接口。
        if getattr(source_image, "is_animated", False):
            source_image.seek(0)

        image = ImageOps.exif_transpose(source_image)
        if image is source_image:
            image = source_image.copy()
        else:
            image.load()

    # WebP 支持透明通道；其余模式统一转 RGB，避免保存阶段出现模式错误。
    if image.mode in ("RGBA", "LA", "PA"):
        return image.convert("RGBA")
    if image.mode != "RGB":
        return image.convert("RGB")
    return image


def _flatten_alpha_sync(image: Image.Image) -> Image.Image:
    """把透明区域合成到白底，用于 alpha 平面本身超预算时的降级重试。"""
    flattened = Image.new("RGB", image.size, (255, 255, 255))
    flattened.paste(image, mask=image.split()[-1])
    return flattened


def _encode_webp_sync(candidate: Image.Image, webp_quality: int) -> bytes:
    """将候选图片编码为 WebP 二进制内容。"""
    output = io.BytesIO()
    candidate.save(output, format="WEBP", quality=webp_quality, method=WEBP_ENCODE_METHOD)
    return output.getvalue()


class ImageCompressionService:
    """负责在非工作区目录完成图片 WebP 压缩和 Base64 编码。"""

    def __init__(
        self,
        workspace_dir: str | Path | None = None,
        base64_cache: ImageBase64Cache | None = None,
    ) -> None:
        """初始化服务，可显式传入工作区路径和缓存以便测试或多工作区场景使用。"""
        self._base64_cache = base64_cache if base64_cache is not None else ImageBase64Cache()
        if workspace_dir is not None:
            self.workspace_dir = Path(workspace_dir).expanduser().resolve()
            return

        try:
            self.workspace_dir = Path(PathManager.get_workspace_dir()).resolve()
        except RuntimeError:
            self.workspace_dir = None

    def is_workspace_file(self, file_path: str | Path) -> bool:
        """判断路径是否位于工作区内。"""
        if self.workspace_dir is None:
            return False
        try:
            Path(file_path).expanduser().resolve().relative_to(self.workspace_dir)
            return True
        except ValueError:
            return False

    async def compress_to_webp(
        self,
        file_path: str | Path,
        output_dir: str | Path,
        *,
        quality: int = WEBP_BASE64_QUALITY,
        max_dimension: int = WEBP_BASE64_MAX_DIMENSION,
        max_size_bytes: int = WEBP_BASE64_MAX_SIZE_BYTES,
    ) -> WebPCompressionResult:
        """将图片压缩为 WebP 文件，并写入指定的非工作区目录。"""
        if not 1 <= quality <= 100:
            raise ValueError("quality must be between 1 and 100")
        if max_dimension < 0:
            raise ValueError("max_dimension must be non-negative")
        if max_size_bytes <= 0:
            raise ValueError("max_size_bytes must be positive")

        source_path = Path(file_path).expanduser().resolve()
        target_dir = Path(output_dir).expanduser().resolve()
        source_in_workspace = self.is_workspace_file(source_path)
        target_in_workspace = self.is_workspace_file(target_dir)
        started_at = time.monotonic()
        logger.info(
            f"开始压缩图片: source={source_path} source_in_workspace={source_in_workspace} "
            f"output_dir={target_dir} quality={quality} max_dimension={max_dimension} "
            f"max_data_url_size={max_size_bytes} method={WEBP_ENCODE_METHOD}"
        )
        if target_in_workspace:
            raise ValueError("image processing output must be outside the workspace")
        await async_mkdir(target_dir, parents=True, exist_ok=True)

        staging_path: Path | None = None
        processing_path = source_path
        try:
            if source_in_workspace:
                staging_path = target_dir / f".source_{uuid.uuid4().hex}{source_path.suffix}"
                await asyncio.to_thread(shutil.copy2, source_path, staging_path)
                processing_path = staging_path
                logger.info(f"工作区图片已复制到临时目录: source={source_path} staging={staging_path}")

            file_content = await async_read_bytes(str(processing_path))
            image = await asyncio.to_thread(_decode_image_sync, file_content)
            # 时间预算和编码次数在整次搜索内共享，避免"保留 alpha + 白底展平"
            # 两轮各自计时导致实际耗时翻倍。
            budget = _SearchBudget(deadline=time.monotonic() + WEBP_SEARCH_MAX_SECONDS)
            candidate = await self._search_webp(
                image,
                quality=quality,
                max_dimension=max_dimension,
                max_size_bytes=max_size_bytes,
                source_label=str(source_path),
                budget=budget,
            )
            if candidate is None:
                raise ValueError(f"image cannot be compressed below {max_size_bytes} bytes")

            output_path = target_dir / f"{source_path.stem}_{uuid.uuid4().hex}.webp"
            await asyncio.to_thread(output_path.write_bytes, candidate.content)
            data_url_size = _data_url_size("image/webp", candidate.content)
            logger.info(
                f"图片压缩完成: source={source_path} output={output_path} "
                f"source_size={len(file_content)} output_size={len(candidate.content)} "
                f"data_url_size={data_url_size} dimensions={candidate.width}x{candidate.height} "
                f"attempts={candidate.attempts} "
                f"elapsed_ms={(time.monotonic() - started_at) * 1000:.1f}"
            )
            return WebPCompressionResult(
                output_path=output_path,
                width=candidate.width,
                height=candidate.height,
                output_size=len(candidate.content),
            )
        except Exception:
            logger.exception(
                f"图片压缩失败: source={source_path} output_dir={target_dir} "
                f"elapsed_ms={(time.monotonic() - started_at) * 1000:.1f}"
            )
            raise
        finally:
            if staging_path is not None:
                await asyncio.to_thread(staging_path.unlink, missing_ok=True)

    async def _encode_candidate(
        self,
        image: Image.Image,
        webp_quality: int,
        *,
        budget: _SearchBudget,
        source_label: str,
        variant: str,
    ) -> tuple[bytes, int]:
        """在预算内编码一次，返回 (WebP 内容, Data URL 大小)。

        超出预算时抛 `_SearchBudgetExceeded`，由搜索入口统一转成"找不到可行结果"。
        每次编码单独交给工作线程，事件循环在两次尝试之间可以处理取消信号。
        """
        if budget.attempts >= WEBP_SEARCH_MAX_ATTEMPTS or time.monotonic() >= budget.deadline:
            raise _SearchBudgetExceeded

        content = await asyncio.to_thread(_encode_webp_sync, image, webp_quality)
        budget.attempts += 1
        data_url_size = _data_url_size("image/webp", content)
        logger.debug(
            f"WebP 候选: source={source_label} variant={variant} "
            f"dimensions={image.width}x{image.height} quality={webp_quality} "
            f"raw_size={len(content)} data_url_size={data_url_size} attempts={budget.attempts}"
        )
        return content, data_url_size

    async def _search_at_dimension(
        self,
        image: Image.Image,
        *,
        quality: int,
        max_size_bytes: int,
        budget: _SearchBudget,
        source_label: str,
        variant: str,
    ) -> _WebpCandidate | None:
        """固定尺寸下从高到低试质量，返回第一个满足体积上限的编码结果。

        体积对质量单调递减，所以命中后就不必再试更低的质量；反过来，
        连续失败 `WEBP_QUALITY_FEASIBILITY_PROBE_AFTER` 次后插一次最低质量试探，
        用来尽早判定"该尺寸下没有任何质量可用"，避免把 10 档质量白试一遍。
        """
        ladder = _quality_candidates(quality)
        lowest = ladder[-1]
        failures_in_a_row = 0
        probed_lowest = False

        for candidate_quality in ladder:
            content, data_url_size = await self._encode_candidate(
                image,
                candidate_quality,
                budget=budget,
                source_label=source_label,
                variant=variant,
            )
            if data_url_size <= max_size_bytes:
                return _WebpCandidate(
                    content=content,
                    width=int(image.width),
                    height=int(image.height),
                    attempts=budget.attempts,
                )

            failures_in_a_row += 1
            if probed_lowest or failures_in_a_row < WEBP_QUALITY_FEASIBILITY_PROBE_AFTER:
                continue
            if candidate_quality == lowest:
                break

            # 最低质量也不达标，说明这个尺寸已经无解，不必再试中间的质量档位。
            probed_lowest = True
            _, lowest_size = await self._encode_candidate(
                image,
                lowest,
                budget=budget,
                source_label=source_label,
                variant=variant,
            )
            if lowest_size > max_size_bytes:
                logger.debug(
                    f"WebP 尺寸判定无解: source={source_label} variant={variant} "
                    f"dimensions={image.width}x{image.height} lowest_quality={lowest} "
                    f"data_url_size={lowest_size} attempts={budget.attempts}"
                )
                return None

        return None

    async def _search_webp(
        self,
        image: Image.Image,
        *,
        quality: int,
        max_dimension: int,
        max_size_bytes: int,
        source_label: str,
        budget: _SearchBudget,
    ) -> _WebpCandidate | None:
        """搜索满足体积上限的编码结果，按"尺寸优先、必要时才丢透明"的顺序。

        每个尺寸先试保留 alpha 的版本，再试白底展平的版本，最后才缩小尺寸。
        之所以把展平提到缩小之前：lossy WebP 的 alpha 平面独立压缩，`quality`
        对它几乎无效，抠图 PNG 的 alpha 平面本身就可能超过目标体积；这种情况下
        一路缩小只是拿分辨率换透明，而展平能保住原分辨率（模型看到的只是背景
        由透明变成白色）。实测那张 1280×1706 的抠图 PNG，改造前要缩到 1091px
        并降到 q20 才达标，改造后原尺寸展平 q90 直接命中。

        返回 None 表示预算内没有可行结果，由调用方决定如何收场。
        """
        # 先把原图限制到 max_dimension，再从这里继续往下缩。
        initial_image = await asyncio.to_thread(_resize_for_max_dimension, image, max_dimension)
        flattened_image = (
            await asyncio.to_thread(_flatten_alpha_sync, initial_image)
            if initial_image.mode == "RGBA"
            else None
        )
        dimension = max(initial_image.size)

        try:
            while dimension >= 1:
                candidate_image = await asyncio.to_thread(
                    _resize_for_max_dimension, initial_image, dimension
                )
                candidate = await self._search_at_dimension(
                    candidate_image,
                    quality=quality,
                    max_size_bytes=max_size_bytes,
                    budget=budget,
                    source_label=source_label,
                    variant="rgba" if flattened_image is not None else "rgb",
                )
                if candidate is not None:
                    return candidate

                if flattened_image is not None:
                    flattened_candidate_image = await asyncio.to_thread(
                        _resize_for_max_dimension, flattened_image, dimension
                    )
                    candidate = await self._search_at_dimension(
                        flattened_candidate_image,
                        quality=quality,
                        max_size_bytes=max_size_bytes,
                        budget=budget,
                        source_label=source_label,
                        variant="flattened",
                    )
                    if candidate is not None:
                        logger.info(
                            f"保留透明无法满足体积上限，改用白底展平: source={source_label} "
                            f"dimensions={candidate.width}x{candidate.height} "
                            f"attempts={candidate.attempts}"
                        )
                        return candidate

                if dimension == 1:
                    break
                dimension = max(1, int(dimension * 0.8))
        except _SearchBudgetExceeded:
            logger.warning(
                f"WebP 搜索超出预算: source={source_label} attempts={budget.attempts} "
                f"dimension={dimension} max_attempts={WEBP_SEARCH_MAX_ATTEMPTS} "
                f"budget_s={WEBP_SEARCH_MAX_SECONDS}"
            )
            return None

        return None

    async def _build_cache_key(
        self,
        source_path: Path,
        *,
        quality: int,
        max_dimension: int,
        max_size_bytes: int,
    ) -> ImageBase64CacheKey | None:
        """构造文件缓存键；缓存关闭或图片不可 stat 时返回 None，表示本次不读写缓存。"""
        if not self._base64_cache.enabled:
            return None
        try:
            stat_result = await async_stat(source_path)
        except OSError:
            return None
        return ImageBase64CacheKey(
            source_path=str(source_path),
            source_mtime_ns=stat_result.st_mtime_ns,
            source_size=stat_result.st_size,
            quality=quality,
            max_dimension=max_dimension,
            max_size_bytes=max_size_bytes,
        )

    async def file_to_base64(
        self,
        file_path: str | Path,
        content_type: str | None = None,
    ) -> str:
        """读取文件并生成 Base64 Data URL，不执行图片压缩。"""
        path = Path(file_path).expanduser().resolve()
        file_content = await async_read_bytes(str(path))
        mime_type = (content_type or mimetypes.guess_type(path.name)[0] or "application/octet-stream").split(";", 1)[0]
        return _build_data_url(mime_type, file_content)

    async def get_base64(
        self,
        file_path: str | Path,
        *,
        output_dir: str | Path | None = None,
        quality: int = WEBP_BASE64_QUALITY,
        max_dimension: int = WEBP_BASE64_MAX_DIMENSION,
        max_size_bytes: int = WEBP_BASE64_MAX_SIZE_BYTES,
    ) -> str:
        """压缩图片并返回最终 Base64；未指定目录时自动使用系统临时目录。

        命中 `.runtime` 文件缓存时直接返回，不再解码和编码。
        """
        started_at = time.monotonic()
        source_path = Path(file_path).expanduser().resolve()

        cache_key = await self._build_cache_key(
            source_path,
            quality=quality,
            max_dimension=max_dimension,
            max_size_bytes=max_size_bytes,
        )
        if cache_key is not None:
            cached = await self._base64_cache.get(cache_key)
            if cached is not None:
                logger.info(
                    f"图片 Base64 命中文件缓存: source={source_path} "
                    f"output_size={cached.output_size} dimensions={cached.width}x{cached.height} "
                    f"elapsed_ms={(time.monotonic() - started_at) * 1000:.1f}"
                )
                return cached.data_url

        owns_output_dir = output_dir is None
        temporary_dir = Path(tempfile.mkdtemp(prefix="super_magic_image_")) if owns_output_dir else None
        target_dir = temporary_dir or Path(output_dir).expanduser().resolve()
        logger.info(
            f"开始生成图片 Base64: source={source_path} "
            f"output_dir={target_dir} temporary_dir={owns_output_dir}"
        )
        try:
            result = await self.compress_to_webp(
                source_path,
                target_dir,
                quality=quality,
                max_dimension=max_dimension,
                max_size_bytes=max_size_bytes,
            )
            data_url = await self.file_to_base64(result.output_path, "image/webp")
            if cache_key is not None:
                await self._base64_cache.put(
                    cache_key,
                    CachedImageBase64(
                        data_url=data_url,
                        width=result.width,
                        height=result.height,
                        output_size=result.output_size,
                    ),
                )
            logger.info(
                f"图片 Base64 生成完成: source={source_path} "
                f"output_size={result.output_size} data_url_size={len(data_url.encode('utf-8'))} "
                f"elapsed_ms={(time.monotonic() - started_at) * 1000:.1f}"
            )
            return data_url
        except Exception:
            logger.exception(
                f"图片 Base64 生成失败: source={source_path} "
                f"elapsed_ms={(time.monotonic() - started_at) * 1000:.1f}"
            )
            raise
        finally:
            if temporary_dir is not None:
                await asyncio.to_thread(shutil.rmtree, temporary_dir, ignore_errors=True)
