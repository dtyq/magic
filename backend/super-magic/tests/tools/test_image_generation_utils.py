from PIL import Image

from app.tools.image_utils.image_generation_utils import (
    detect_image_file_extension,
    resolve_safe_save_path,
)


async def test_detect_image_file_extension_reads_real_png_format(tmp_path):
    image_path = tmp_path / "generated.jpg"
    Image.new("RGBA", (2, 2), (255, 0, 0, 0)).save(image_path, format="PNG")

    extension = await detect_image_file_extension(str(image_path))

    assert extension == ".png"


async def test_resolve_safe_save_path_uses_given_extension_and_avoids_conflicts(tmp_path):
    save_dir = tmp_path / "images"
    save_dir.mkdir()
    (save_dir / "pink-dot-pattern.png").write_bytes(b"existing")

    path = await resolve_safe_save_path(save_dir, "pink-dot-pattern", ".png")

    assert path == save_dir / "pink-dot-pattern_1.png"
