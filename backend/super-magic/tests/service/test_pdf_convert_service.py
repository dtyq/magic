from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from app.service.file_convert.base_convert_service import ConvertStageError
from app.service.file_convert.pdf_convert_service import PdfConvertService
from app.utils.metadata_utils import AigcMetadataUtil


class FakePage:
    def __init__(self) -> None:
        self.content = ""
        self.pdf_options = []
        self.styles = []
        self.url = "about:blank"
        self.image_statuses = [{"total": 0, "loaded": 0, "pending": 0, "failed": 0, "samples": []}]
        self.image_status_index = 0
        self.wait_for_function_calls = []
        self.wait_for_function_error = None
        self.viewport_sizes = []
        self.markdown_dimensions = {
            "viewportWidth": 1920,
            "viewportHeight": 1080,
            "scrollWidth": 1920,
            "scrollHeight": 1080,
            "contentWidth": 1920,
            "contentHeight": 1080,
            "hasHorizontalScroll": False,
            "hasVerticalScroll": False,
        }

    def set_default_timeout(self, timeout: int) -> None:
        self.timeout = timeout

    def on(self, event: str, callback) -> None:
        self.event = event
        self.callback = callback

    async def set_content(self, content: str, **kwargs) -> None:
        self.content = content
        self.set_content_kwargs = kwargs

    async def set_viewport_size(self, viewport: dict) -> None:
        self.viewport_sizes.append(viewport)

    async def wait_for_load_state(self, *args, **kwargs) -> None:
        self.wait_for_load_state_args = args
        self.wait_for_load_state_kwargs = kwargs

    async def evaluate(self, script: str):
        if "document.images" in script:
            status = self.image_statuses[min(self.image_status_index, len(self.image_statuses) - 1)]
            self.image_status_index += 1
            return status
        if "contentWidth" in script and "scrollHeight" in script:
            return self.markdown_dimensions
        return None

    async def wait_for_function(self, script: str, **kwargs) -> None:
        self.wait_for_function_calls.append((script, kwargs))
        if self.wait_for_function_error:
            raise self.wait_for_function_error

    async def add_style_tag(self, **kwargs) -> None:
        self.styles.append(kwargs.get("content", ""))

    async def pdf(self, path: str, **kwargs) -> None:
        self.pdf_options.append(kwargs)
        Path(path).write_bytes(b"%PDF-1.4\n% test\n")

    async def close(self) -> None:
        self.closed = True


class FakeContext:
    def __init__(self, page: FakePage) -> None:
        self.page = page

    async def new_page(self) -> FakePage:
        return self.page


def _patch_browser(monkeypatch: pytest.MonkeyPatch, service: PdfConvertService, page: FakePage) -> None:
    monkeypatch.setattr(
        service,
        "_create_shared_browser_context",
        AsyncMock(return_value=(None, None, FakeContext(page))),
    )
    monkeypatch.setattr(service, "_close_shared_browser_context", AsyncMock(return_value=None))
    monkeypatch.setattr(service, "_embed_aigc_metadata_with_logging", AsyncMock(return_value=None))


@pytest.mark.asyncio
async def test_markdown_html_uses_magic_web_tiptap_layout(tmp_path):
    md_path = tmp_path / "story.md"
    md_path.write_text("# 标题\n\n正文\n\n---\n\n## 小节\n", encoding="utf-8")

    html = await PdfConvertService._process_markdown_content(
        md_path,
        base_href="http://127.0.0.1:8003/story/",
    )

    assert '<base href="http://127.0.0.1:8003/story/">' in html
    assert 'class="simple-editor-wrapper tiptap-editor-root"' in html
    assert 'class="simple-editor-content"' in html
    assert 'class="tiptap ProseMirror simple-editor"' in html
    assert "padding: 1.5rem 4rem 30vh" in html
    assert "line-height: 1.5" in html
    assert "max-width: 800px" not in html
    assert "margin: 0 auto" not in html
    assert "@page { size: A4" not in html
    assert "border-bottom: 2px solid #e5e7eb" not in html


@pytest.mark.asyncio
async def test_markdown_pdf_conversion_uses_base_href_without_temp_file(tmp_path, monkeypatch):
    workspace = tmp_path / ".workspace"
    article_dir = workspace / "story"
    article_dir.mkdir(parents=True)
    md_path = article_dir / "森林里的星空邮递员.md"
    md_path.write_text("# 标题\n\n![图](images/pic.png)\n", encoding="utf-8")

    service = PdfConvertService()
    page = FakePage()
    page.image_statuses = [
        {
            "total": 1,
            "loaded": 0,
            "pending": 1,
            "failed": 0,
            "samples": [{"index": 0, "src": "http://127.0.0.1:8003/story/images/pic.png"}],
        },
        {"total": 1, "loaded": 1, "pending": 0, "failed": 0, "samples": []},
    ]
    _patch_browser(monkeypatch, service, page)
    monkeypatch.setattr(service, "_setup_local_cdn_route", AsyncMock(return_value=True))
    monkeypatch.setattr(
        service,
        "_get_base_href_for_workspace_file",
        AsyncMock(return_value="http://127.0.0.1:8003/story/"),
    )
    monkeypatch.setattr(service, "_load_external_resources_with_retry", AsyncMock(return_value=True))
    monkeypatch.setattr(service, "_wait_for_fonts_optimized", AsyncMock(return_value=True))

    pdf_dir = tmp_path / "pdf"
    pdf_dir.mkdir()

    pdf_files, errors = await service._convert_files_concurrent(
        {"story/森林里的星空邮递员.md": str(md_path)},
        pdf_dir,
        options={"format": "A4", "margin_top": "1cm", "print_background": True},
        valid_files_count=1,
    )

    assert errors == []
    assert len(pdf_files) == 1
    assert pdf_files[0].exists()
    assert '<base href="http://127.0.0.1:8003/story/">' in page.content
    assert 'class="simple-editor-wrapper tiptap-editor-root"' in page.content
    assert 'src="images/pic.png"' in page.content
    assert page.wait_for_function_calls
    assert page.pdf_options[0]["format"] == "A4"
    assert page.pdf_options[0]["margin"]["top"] == "1cm"
    assert page.viewport_sizes[-1] == {"width": 1920, "height": 1080}
    assert list(article_dir.glob(".tmp_森林里的星空邮递员_*.html")) == []


@pytest.mark.asyncio
async def test_markdown_page_load_failure_keeps_stage_error(tmp_path, monkeypatch):
    md_path = tmp_path / "broken.md"
    md_path.write_text("# broken", encoding="utf-8")

    service = PdfConvertService()
    page = FakePage()
    _patch_browser(monkeypatch, service, page)
    monkeypatch.setattr(
        service,
        "_load_markdown_page_standard",
        AsyncMock(side_effect=ConvertStageError("page_load", "Markdown页面加载失败: set_content boom")),
    )

    pdf_dir = tmp_path / "pdf"
    pdf_dir.mkdir()

    pdf_files, errors = await service._convert_files_concurrent(
        {"broken.md": md_path},
        pdf_dir,
        valid_files_count=1,
    )

    assert pdf_files == []
    assert len(errors) == 1
    assert "page_load失败" in errors[0]
    assert "set_content boom" in errors[0]
    assert "'str' object has no attribute 'exists'" not in errors[0]
    assert list(tmp_path.glob(".tmp_broken_*.html")) == []


@pytest.mark.asyncio
async def test_markdown_full_page_without_explicit_size_uses_magic_web_pdf_options(tmp_path, monkeypatch):
    md_path = tmp_path / "long.md"
    md_path.write_text("# long\n\ncontent\n", encoding="utf-8")

    service = PdfConvertService(enable_full_page=True)
    page = FakePage()
    _patch_browser(monkeypatch, service, page)
    page.markdown_dimensions = {
        "viewportWidth": 1920,
        "viewportHeight": 1080,
        "scrollWidth": 1920,
        "scrollHeight": 2400,
        "contentWidth": 1920,
        "contentHeight": 2400,
        "hasHorizontalScroll": False,
        "hasVerticalScroll": True,
    }
    monkeypatch.setattr(service, "_setup_local_cdn_route", AsyncMock(return_value=True))
    monkeypatch.setattr(service, "_get_base_href_for_workspace_file", AsyncMock(return_value=tmp_path.as_uri() + "/"))
    monkeypatch.setattr(service, "_load_external_resources_with_retry", AsyncMock(return_value=True))
    monkeypatch.setattr(service, "_wait_for_fonts_optimized", AsyncMock(return_value=True))
    monkeypatch.setattr(
        service,
        "_adjust_viewport_for_full_page",
        AsyncMock(side_effect=AssertionError("Markdown不应调整为长截图布局视口")),
    )

    pdf_dir = tmp_path / "pdf"
    pdf_dir.mkdir()

    pdf_files, errors = await service._convert_files_concurrent(
        {"long.md": md_path},
        pdf_dir,
        valid_files_count=1,
    )

    assert errors == []
    assert len(pdf_files) == 1
    assert pdf_files[0].exists()
    assert page.pdf_options[0]["prefer_css_page_size"] is True
    assert "format" not in page.pdf_options[0]
    assert page.pdf_options[0]["margin"] == {"top": "0px", "right": "0px", "bottom": "0px", "left": "0px"}
    assert page.viewport_sizes[-1] == {"width": 1920, "height": 1080}
    assert any("size: 1920px 2400px" in style for style in page.styles)
    assert any("padding-bottom: 324px" in style for style in page.styles)


def test_markdown_magic_web_pdf_options_keep_1920_width_and_min_1080_height():
    options = PdfConvertService._get_markdown_magic_web_pdf_options({"contentHeight": 640})

    assert options["_page_width"] == 1920
    assert options["_page_height"] == 1080
    assert options["prefer_css_page_size"] is True


@pytest.mark.asyncio
async def test_markdown_image_timeout_returns_clear_page_load_error(tmp_path, monkeypatch):
    md_path = tmp_path / "broken-image.md"
    md_path.write_text("# broken\n\n![图](missing.png)", encoding="utf-8")

    service = PdfConvertService()
    page = FakePage()
    page.image_statuses = [
        {
            "total": 1,
            "loaded": 0,
            "pending": 1,
            "failed": 0,
            "samples": [{"index": 0, "src": "file:///tmp/missing.png"}],
        },
        {
            "total": 1,
            "loaded": 0,
            "pending": 1,
            "failed": 0,
            "samples": [{"index": 0, "src": "file:///tmp/missing.png"}],
        },
    ]
    page.wait_for_function_error = TimeoutError("image wait timeout")
    _patch_browser(monkeypatch, service, page)
    monkeypatch.setattr(service, "_setup_local_cdn_route", AsyncMock(return_value=True))
    monkeypatch.setattr(service, "_get_base_href_for_workspace_file", AsyncMock(return_value=tmp_path.as_uri() + "/"))
    monkeypatch.setattr(service, "_load_external_resources_with_retry", AsyncMock(return_value=True))
    monkeypatch.setattr(service, "_wait_for_fonts_optimized", AsyncMock(return_value=True))

    pdf_dir = tmp_path / "pdf"
    pdf_dir.mkdir()

    pdf_files, errors = await service._convert_files_concurrent(
        {"broken-image.md": md_path},
        pdf_dir,
        valid_files_count=1,
    )

    assert pdf_files == []
    assert len(errors) == 1
    assert "page_load失败" in errors[0]
    assert "图片资源加载超时或失败" in errors[0]
    assert "missing.png" in errors[0]
    assert page.pdf_options == []


@pytest.mark.asyncio
async def test_html_pdf_conversion_still_generates_pdf(tmp_path, monkeypatch):
    html_path = tmp_path / "index.html"
    html_path.write_text("<!doctype html><html><body>ok</body></html>", encoding="utf-8")

    service = PdfConvertService()
    page = FakePage()
    _patch_browser(monkeypatch, service, page)
    monkeypatch.setattr(service, "_load_html_page_standard", AsyncMock(return_value=True))
    monkeypatch.setattr(service, "_scroll_to_trigger_lazy_loading", AsyncMock(return_value=True))
    monkeypatch.setattr(
        service,
        "_detect_content_dimensions",
        AsyncMock(
            return_value={
                "contentWidth": 1000,
                "contentHeight": 800,
                "hasVerticalScroll": False,
            }
        ),
    )

    pdf_dir = tmp_path / "pdf"
    pdf_dir.mkdir()

    pdf_files, errors = await service._convert_files_concurrent(
        {"index.html": html_path},
        pdf_dir,
        valid_files_count=1,
    )

    assert errors == []
    assert len(pdf_files) == 1
    assert pdf_files[0].exists()
    assert page.pdf_options[0]["print_background"] is True


@pytest.mark.asyncio
async def test_unsupported_extension_returns_clear_error(tmp_path, monkeypatch):
    txt_path = tmp_path / "note.txt"
    txt_path.write_text("unsupported", encoding="utf-8")

    service = PdfConvertService()
    _patch_browser(monkeypatch, service, FakePage())

    pdf_dir = tmp_path / "pdf"
    pdf_dir.mkdir()

    pdf_files, errors = await service._convert_files_concurrent(
        {"note.txt": txt_path},
        pdf_dir,
        valid_files_count=1,
    )

    assert pdf_files == []
    assert errors == ["文件 note.txt: 跳过非 HTML/Markdown 文件 (文件类型: .txt)"]


@pytest.mark.asyncio
async def test_markdown_base_href_prefers_workspace_static_server(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    md_path = tmp_path / ".workspace" / "story" / "note.md"
    md_path.parent.mkdir(parents=True)
    md_path.write_text("# title", encoding="utf-8")

    service = PdfConvertService()
    monkeypatch.setattr(service, "_start_static_file_server_on_demand", AsyncMock(return_value=True))
    monkeypatch.setattr(service, "_verify_http_server_workspace_access", AsyncMock(return_value=True))

    base_href = await service._get_base_href_for_workspace_file(md_path, "test")

    assert base_href == "http://127.0.0.1:8003/story/"


@pytest.mark.asyncio
async def test_pdf_metadata_accepts_str_and_path_and_missing_file(tmp_path, monkeypatch):
    fitz = pytest.importorskip("fitz")

    async def fake_signed_metadata(file_path, aigc_params=None):
        return "{}"

    monkeypatch.setattr(AigcMetadataUtil, "create_signed_metadata", fake_signed_metadata)

    for name, as_path in (("str.pdf", False), ("path.pdf", True)):
        pdf_path = tmp_path / name
        doc = fitz.open()
        doc.new_page()
        doc.save(str(pdf_path))
        doc.close()

        await AigcMetadataUtil.embed_pdf_metadata(pdf_path if as_path else str(pdf_path))
        assert pdf_path.exists()

    with pytest.raises(FileNotFoundError):
        await AigcMetadataUtil.embed_pdf_metadata(str(tmp_path / "missing.pdf"))
