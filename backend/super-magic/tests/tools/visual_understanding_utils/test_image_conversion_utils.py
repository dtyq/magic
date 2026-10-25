from __future__ import annotations

import base64
import io

import pytest
from PIL import Image

from app.tools.visual_understanding_utils.image_compression_service import (
    WEBP_BASE64_MAX_SIZE_BYTES,
    ImageCompressionService,
)


def _decode_data_url(data_url: str) -> tuple[str, bytes]:
    """解析测试用 Data URL，返回 MIME 类型和二进制内容。"""
    header, encoded = data_url.split(",", 1)
    return header.removeprefix("data:").split(";", 1)[0], base64.b64decode(encoded)


@pytest.mark.asyncio
async def test_image_compression_service_get_base64_returns_webp_for_compressible_image(tmp_path):
    """可压缩图片应返回 WebP Data URL。"""
    source = tmp_path / "source.png"
    image = Image.new("RGB", (120, 80), color="red")
    image.save(source, format="PNG")
    image.close()

    data_url = await ImageCompressionService().get_base64(source)

    content_type, encoded = _decode_data_url(data_url)
    assert content_type == "image/webp"
    with Image.open(io.BytesIO(encoded)) as result:
        assert result.format == "WEBP"
        assert result.size == (120, 80)


@pytest.mark.asyncio
async def test_image_compression_service_get_base64_resizes_large_image(tmp_path):
    """超过最大边长的图片应按比例缩放后编码。"""
    source = tmp_path / "large.png"
    image = Image.new("RGB", (400, 200), color="blue")
    image.save(source, format="PNG")
    image.close()

    data_url = await ImageCompressionService().get_base64(source, max_dimension=100)

    _, encoded = _decode_data_url(data_url)
    with Image.open(io.BytesIO(encoded)) as result:
        assert result.format == "WEBP"
        assert result.size == (100, 50)


@pytest.mark.asyncio
async def test_image_compression_service_get_base64_preserves_transparency(tmp_path):
    """透明图片转 WebP 后应保留 Alpha 通道。"""
    source = tmp_path / "transparent.png"
    image = Image.new("RGBA", (256, 256))
    pixels = image.load()
    for y in range(256):
        for x in range(256):
            pixels[x, y] = (x, y, (x * y) % 256, (x + y) % 256)
    pixels[0, 0] = (255, 0, 0, 255)
    image.save(source, format="PNG")
    image.close()

    data_url = await ImageCompressionService().get_base64(source)

    content_type, encoded = _decode_data_url(data_url)
    assert content_type == "image/webp"
    with Image.open(io.BytesIO(encoded)) as result:
        assert result.mode == "RGBA"
        assert result.getpixel((0, 0))[3] > 200
        assert result.getpixel((1, 1))[3] < 20


@pytest.mark.asyncio
async def test_image_compression_service_rejects_invalid_options(tmp_path):
    """质量和尺寸参数非法时应尽早失败。"""
    source = tmp_path / "source.png"
    image = Image.new("RGB", (8, 8), color="white")
    image.save(source, format="PNG")
    image.close()

    with pytest.raises(ValueError, match="quality"):
        await ImageCompressionService().get_base64(source, quality=0)
    with pytest.raises(ValueError, match="max_dimension"):
        await ImageCompressionService().get_base64(source, max_dimension=-1)


@pytest.mark.asyncio
async def test_image_compression_service_applies_default_and_custom_size_limits(tmp_path):
    """默认大小上限为 512 KB，且调用方可以覆盖该上限。"""
    assert WEBP_BASE64_MAX_SIZE_BYTES == 512 * 1024

    source = tmp_path / "detailed.png"
    image = Image.effect_noise((800, 800), 100)
    image.save(source, format="PNG")
    image.close()

    data_url = await ImageCompressionService().get_base64(source, max_size_bytes=16 * 1024)

    assert len(data_url.encode("utf-8")) <= 16 * 1024


@pytest.mark.asyncio
async def test_compress_to_webp_copies_workspace_source_to_external_output_dir(tmp_path):
    """工作区图片压缩前应复制到工作区外，且输出目录只产生 WebP 文件。"""
    workspace_dir = tmp_path / "workspace"
    output_dir = tmp_path / "image-output"
    workspace_dir.mkdir()
    source = workspace_dir / "source.png"
    image = Image.new("RGB", (32, 24), color="green")
    image.save(source, format="PNG")
    image.close()

    result = await ImageCompressionService(workspace_dir=workspace_dir).compress_to_webp(
        source,
        output_dir,
    )

    assert result.output_path.parent == output_dir
    assert result.output_path.suffix == ".webp"
    assert result.output_path.exists()
    assert not list(output_dir.glob(".source_*"))
    with Image.open(result.output_path) as compressed:
        assert compressed.format == "WEBP"

    with pytest.raises(ValueError, match="outside the workspace"):
        await ImageCompressionService(workspace_dir=workspace_dir).compress_to_webp(
            source,
            workspace_dir / "output",
        )


@pytest.mark.asyncio
async def test_file_to_base64_only_reads_file_without_compression(tmp_path):
    """Base64 方法只读取指定文件，不产生额外图片处理文件。"""
    source = tmp_path / "payload.bin"
    source.write_bytes(b"mock-payload")

    data_url = await ImageCompressionService().file_to_base64(source, "application/octet-stream")

    assert data_url == "data:application/octet-stream;base64,bW9jay1wYXlsb2Fk"
