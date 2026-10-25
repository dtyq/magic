"""Canvas 生图文件名并发安全测试。"""

from datetime import datetime

from app.tools.canvas.generation.image_filename import build_image_filename


def test_build_image_filename_preserves_legacy_format_without_unique_key() -> None:
    """未提供唯一键时保持既有 Design 文件名格式。"""
    generated_at = datetime(2026, 9, 1, 12, 34, 56)

    assert build_image_filename("mock image", generated_at) == "mock image_20260901123456"


def test_build_image_filename_uses_unique_key_to_avoid_concurrent_collisions() -> None:
    """同名同秒的并发图片应根据 Content 唯一键生成不同路径。"""
    generated_at = datetime(2026, 9, 1, 12, 34, 56)

    first = build_image_filename("mock image", generated_at, "content-a")
    second = build_image_filename("mock image", generated_at, "content-b")

    assert first != second
    assert first == build_image_filename("mock image", generated_at, "content-a")
    assert first.endswith("_20260901123456")
    assert second.endswith("_20260901123456")
