from pathlib import Path

import pytest

from app.service.browser.workspace_page_loader import (
    build_self_contained_workspace_page,
    load_workspace_page,
)
from app.utils.async_file_utils import async_mkdir, async_write_bytes, async_write_text


class FakeBrowser:
    def __init__(self) -> None:
        self.html = ""
        self.navigated_url = ""

    async def evaluate(self, page_id: str, expression: str, argument: str) -> str:
        assert page_id == "page-1"
        assert "URL.createObjectURL" in expression
        self.html = argument
        return "blob:https://browser.example/rendered-page"

    async def navigate(self, page_id: str, url: str) -> None:
        assert page_id == "page-1"
        self.navigated_url = url


@pytest.mark.asyncio
async def test_build_self_contained_workspace_page_inlines_local_css_and_images(tmp_path: Path):
    slides_dir = tmp_path / "template" / "slides"
    images_dir = tmp_path / "template" / "images"
    await async_mkdir(slides_dir, parents=True)
    await async_mkdir(images_dir, parents=True)
    await async_write_bytes(images_dir / "hero.png", b"png-image")
    await async_write_text(
        tmp_path / "template" / "theme.css",
        '.slide { background-image: url("images/hero.png"); }',
    )
    slide_path = slides_dir / "cover.html"
    await async_write_text(
        slide_path,
        '<!doctype html><html><head><link rel="stylesheet" href="../theme.css"></head>'
        '<body><main class="slide"><img src="../images/hero.png"></main></body></html>',
    )

    html = await build_self_contained_workspace_page(tmp_path, slide_path)

    assert "<style" in html
    assert "../theme.css" not in html
    assert "../images/hero.png" not in html
    assert html.count("data:image/png;base64,") == 2


@pytest.mark.asyncio
async def test_load_workspace_page_uses_browser_local_blob_url(tmp_path: Path):
    slide_path = tmp_path / "cover.html"
    await async_write_text(slide_path, "<!doctype html><main>Cover</main>")
    browser = FakeBrowser()

    target_url = await load_workspace_page(browser, "page-1", tmp_path, slide_path)

    assert target_url == "blob:https://browser.example/rendered-page"
    assert browser.navigated_url == target_url
    assert browser.html.startswith("<!DOCTYPE html>")
    assert not target_url.startswith(("file://", "http://127.0.0.1"))


@pytest.mark.asyncio
async def test_build_self_contained_workspace_page_rejects_files_outside_workspace(tmp_path: Path):
    workspace_dir = tmp_path / "workspace"
    await async_mkdir(workspace_dir)
    outside_file = tmp_path / "outside.html"
    await async_write_text(outside_file, "<!doctype html><main>Outside</main>")

    with pytest.raises(ValueError, match="inside the current workspace"):
        await build_self_contained_workspace_page(workspace_dir, outside_file)
