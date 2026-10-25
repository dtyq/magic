from __future__ import annotations

import json
import os
import random
from pathlib import Path

import pytest
from PIL import Image

from app.path_manager import PathManager
from app.tools.visual_understanding_utils import image_compression_service
from app.tools.visual_understanding_utils.image_base64_cache import (
    CACHE_DIRECTORY_NAME,
    CACHE_VERSION,
    CachedImageBase64,
    ImageBase64Cache,
    ImageBase64CacheKey,
)
from app.tools.visual_understanding_utils.image_compression_service import (
    ImageCompressionService,
    _flatten_alpha_sync,
)


def _make_key(**overrides) -> ImageBase64CacheKey:
    values = {
        "source_path": "/workspace/.tmp/source.png",
        "source_mtime_ns": 1_700_000_000_000_000_000,
        "source_size": 2048,
        "quality": 90,
        "max_dimension": 1920,
        "max_size_bytes": 512 * 1024,
    }
    values.update(overrides)
    return ImageBase64CacheKey(**values)


def _make_value(data_url: str = "data:image/webp;base64,QUJD") -> CachedImageBase64:
    return CachedImageBase64(data_url=data_url, width=100, height=50, output_size=3)


@pytest.fixture
def runtime_root(tmp_path, monkeypatch):
    """把 `.runtime` 根指向临时目录；缓存目录必须位于该根之内。"""
    monkeypatch.setattr(PathManager, "get_runtime_dir", classmethod(lambda cls: tmp_path))
    return tmp_path


@pytest.fixture
def cache(runtime_root) -> ImageBase64Cache:
    return ImageBase64Cache()


def _entry_path(runtime_root, key: ImageBase64CacheKey):
    return runtime_root / CACHE_DIRECTORY_NAME / f"{key.digest()}.json"


@pytest.mark.asyncio
async def test_put_then_get_round_trips(cache):
    """写入后再读取应得到完全相同的结果。"""
    key = _make_key()
    value = _make_value()

    await cache.put(key, value)

    assert await cache.get(key) == value


@pytest.mark.asyncio
async def test_different_compression_inputs_do_not_share_entry(cache):
    """图片版本或压缩参数变化时必须视为未命中。"""
    await cache.put(_make_key(), _make_value())

    assert await cache.get(_make_key(quality=50)) is None
    assert await cache.get(_make_key(source_mtime_ns=2)) is None
    assert await cache.get(_make_key(source_size=4096)) is None
    assert await cache.get(_make_key(max_dimension=1024)) is None
    assert await cache.get(_make_key(max_size_bytes=1024)) is None
    assert await cache.get(_make_key(source_path="/workspace/.tmp/other.png")) is None


@pytest.mark.asyncio
async def test_cache_directory_and_entry_are_private(cache, runtime_root):
    """缓存目录 0700、缓存文件 0600。"""
    key = _make_key()
    await cache.put(key, _make_value())

    cache_dir = runtime_root / CACHE_DIRECTORY_NAME
    assert cache_dir.is_dir()
    assert cache_dir.stat().st_mode & 0o777 == 0o700
    assert _entry_path(runtime_root, key).stat().st_mode & 0o777 == 0o600


@pytest.mark.asyncio
async def test_corrupted_entry_is_treated_as_miss(cache, runtime_root):
    """损坏的缓存文件不能中断主流程，只当作未命中。"""
    key = _make_key()
    await cache.put(key, _make_value())
    _entry_path(runtime_root, key).write_text("{not json", encoding="utf-8")

    assert await cache.get(key) is None


@pytest.mark.asyncio
async def test_version_mismatch_is_treated_as_miss(cache, runtime_root):
    """缓存结构版本变化后旧条目应失效。"""
    key = _make_key()
    await cache.put(key, _make_value())

    path = _entry_path(runtime_root, key)
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["version"] = CACHE_VERSION + 1
    path.write_text(json.dumps(payload), encoding="utf-8")

    assert await cache.get(key) is None


@pytest.mark.asyncio
async def test_entry_with_mismatched_key_is_treated_as_miss(cache, runtime_root):
    """摘要命中但键内容不同时必须未命中，避免串图。"""
    key = _make_key()
    await cache.put(key, _make_value())

    path = _entry_path(runtime_root, key)
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["key"]["source_path"] = "/workspace/.tmp/other.png"
    path.write_text(json.dumps(payload), encoding="utf-8")

    assert await cache.get(key) is None


@pytest.mark.asyncio
async def test_cache_disabled_when_runtime_dir_unavailable(monkeypatch):
    """.runtime 不可用时缓存整体关闭，读写都是无副作用空操作。"""

    def _raise(cls):
        raise RuntimeError("runtime unavailable")

    monkeypatch.setattr(PathManager, "get_runtime_dir", classmethod(_raise))
    disabled = ImageBase64Cache()

    assert disabled.enabled is False
    assert disabled.cache_dir is None
    assert await disabled.get(_make_key()) is None
    await disabled.put(_make_key(), _make_value())


def test_flatten_alpha_composites_transparency_onto_white():
    """降级重试把透明像素合成到白底，不透明像素保持原色。"""
    image = Image.new("RGBA", (2, 1))
    image.putpixel((0, 0), (255, 0, 0, 255))
    image.putpixel((1, 0), (0, 0, 255, 0))

    flattened = _flatten_alpha_sync(image)

    assert flattened.mode == "RGB"
    assert flattened.getpixel((0, 0)) == (255, 0, 0)
    assert flattened.getpixel((1, 0)) == (255, 255, 255)


@pytest.mark.asyncio
async def test_get_base64_reuses_cached_result_without_recompressing(runtime_root, tmp_path, monkeypatch):
    """换一个服务实例处理同一张图时，应直接命中缓存，不再进入压缩搜索。"""
    source = tmp_path / "source.png"
    image = Image.new("RGB", (64, 48), color="red")
    image.save(source, format="PNG")
    image.close()

    cache_dir = runtime_root / CACHE_DIRECTORY_NAME
    first = await ImageCompressionService(base64_cache=ImageBase64Cache(cache_dir)).get_base64(source)

    async def _unexpected_search(*args, **kwargs):
        raise AssertionError("缓存命中时不应重新压缩")

    monkeypatch.setattr(ImageCompressionService, "_search_webp", _unexpected_search)

    second = await ImageCompressionService(base64_cache=ImageBase64Cache(cache_dir)).get_base64(source)

    assert second == first
    assert second.startswith("data:image/webp;base64,")


@pytest.mark.asyncio
async def test_get_base64_recompresses_after_source_changes(runtime_root, tmp_path):
    """图片内容变化后不能复用旧缓存。"""
    source = tmp_path / "source.png"
    cache_dir = runtime_root / CACHE_DIRECTORY_NAME

    Image.new("RGB", (64, 48), color="red").save(source, format="PNG")
    first = await ImageCompressionService(base64_cache=ImageBase64Cache(cache_dir)).get_base64(source)

    Image.new("RGB", (64, 48), color="blue").save(source, format="PNG")
    stat = source.stat()
    os.utime(source, ns=(stat.st_atime_ns, stat.st_mtime_ns + 1_000_000))

    second = await ImageCompressionService(base64_cache=ImageBase64Cache(cache_dir)).get_base64(source)

    assert second != first


@pytest.mark.asyncio
async def test_rgba_search_failure_falls_back_to_flattened_image(runtime_root, tmp_path):
    """保留透明无法达标时，最终结果必须来自白底展平后的图像。"""
    source = tmp_path / "transparent.png"
    image = Image.new("RGBA", (64, 64), color=(255, 0, 0, 128))
    image.save(source, format="PNG")
    image.close()

    data_url = await ImageCompressionService(
        base64_cache=ImageBase64Cache(runtime_root / CACHE_DIRECTORY_NAME)
    ).get_base64(source)

    assert data_url.startswith("data:image/webp;base64,")


def _write_alpha_dominated_png(path: Path, size: int = 512) -> None:
    """构造一张 alpha 平面自身无法压到预算内的抠图 PNG。

    RGB 是纯白（展平后只剩一片白，极易压缩），alpha 是随机噪声（不可压缩）。
    实测这种构造下 lossy WebP 的 alpha 平面完全主导体积，q90 和 q1 输出
    字节数完全相同（512×512 均为 262700 字节），所以靠降质量永远无法达标；
    而白底展平后只有几百字节。真实抠图 PNG 的 alpha 平面同理。
    """
    rng = random.Random(20260920)
    image = Image.new("RGB", (size, size), color=(255, 255, 255))
    image.putalpha(Image.frombytes("L", (size, size), rng.randbytes(size * size)))
    image.save(path, format="PNG")
    image.close()


@pytest.mark.asyncio
async def test_alpha_dominated_image_encodes_few_times_at_full_resolution(
    runtime_root, tmp_path, monkeypatch
):
    """alpha 超预算时应尽早改走白底展平，而不是把质量档位试穿、再一路缩小。

    这是"首次处理 28 次编码、占满一个核心"的回归测试：保留透明的版本在原始尺寸下
    任何质量都不达标，改造前要把 10 档质量 × 多个尺寸全试一遍；现在连续失败两次就
    探底，探底失败立刻换展平版本，因此编码次数受控且保住原分辨率。
    """
    source = tmp_path / "alpha-noise.png"
    _write_alpha_dominated_png(source)

    qualities: list[int] = []
    original_encode = image_compression_service._encode_webp_sync

    def counting_encode(candidate: Image.Image, webp_quality: int) -> bytes:
        qualities.append(webp_quality)
        return original_encode(candidate, webp_quality)

    monkeypatch.setattr(image_compression_service, "_encode_webp_sync", counting_encode)

    result = await ImageCompressionService(
        base64_cache=ImageBase64Cache(runtime_root / CACHE_DIRECTORY_NAME)
    ).compress_to_webp(source, tmp_path / "out", max_size_bytes=16 * 1024)

    # 预期 4 次：RGBA q90 失败、q80 失败、q1 探底失败 → 展平 q90 命中。
    assert len(qualities) == 4, f"编码次数应受控，实际 {len(qualities)} 次: {qualities}"
    # 展平后能达标，就不该拿分辨率换透明。
    assert (result.width, result.height) == (512, 512)
    assert result.output_size <= 16 * 1024


@pytest.mark.asyncio
async def test_compressible_image_hits_preferred_quality_in_one_encode(
    runtime_root, tmp_path, monkeypatch
):
    """普通可压缩图片应一次命中首选质量，不产生额外编码。"""
    source = tmp_path / "plain.png"
    image = Image.new("RGB", (120, 80), color="red")
    image.save(source, format="PNG")
    image.close()

    qualities: list[int] = []
    original_encode = image_compression_service._encode_webp_sync

    def counting_encode(candidate: Image.Image, webp_quality: int) -> bytes:
        qualities.append(webp_quality)
        return original_encode(candidate, webp_quality)

    monkeypatch.setattr(image_compression_service, "_encode_webp_sync", counting_encode)

    await ImageCompressionService(
        base64_cache=ImageBase64Cache(runtime_root / CACHE_DIRECTORY_NAME)
    ).compress_to_webp(source, tmp_path / "out")

    assert qualities == [90]
