from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.tools.analysis_slide_webpage import AnalysisSlideWebpage, AnalysisSlideWebpageParams
from app.tools.visual_understanding_webpage import (
    VisualUnderstandingWebpage,
    VisualUnderstandingWebpageParams,
)
from app.utils.async_file_utils import async_write_text
from magic_use.config import BrowserRuntimeConfig


class FakeBrowser:
    def __init__(self) -> None:
        self.navigated_urls: list[str] = []
        self.closed = False

    async def list_pages(self):
        return [SimpleNamespace(id="page-1")]

    async def navigate(self, page_id: str, url: str):
        assert page_id == "page-1"
        self.navigated_urls.append(url)

    async def evaluate(self, page_id: str, expression: str):
        assert page_id == "page-1"
        if expression == "document.documentElement.outerHTML":
            return "<html><body>Rendered</body></html>"
        return {"issues": []}

    async def screenshot(self, page_id: str):
        assert page_id == "page-1"
        return SimpleNamespace(image=b"png")

    async def close(self):
        self.closed = True


@pytest.mark.asyncio
async def test_visual_understanding_webpage_applies_fixed_canvas_viewport(tmp_path):
    base_config = BrowserRuntimeConfig()
    browser = object()
    tool = VisualUnderstandingWebpage(base_dir=tmp_path)

    with (
        patch(
            "app.tools.visual_understanding_webpage.BrowserConfigAdapter.build_playwright",
            new=AsyncMock(return_value=base_config),
        ) as build_playwright_mock,
        patch(
            "app.tools.visual_understanding_webpage.create_browser",
            new=AsyncMock(return_value=browser),
        ) as create_browser_mock,
    ):
        result = await tool._create_browser(
            viewport_width=1920,
            viewport_height=1080,
            device_scale_factor=1,
        )

    assert result is browser
    build_playwright_mock.assert_awaited_once_with(
        str(tmp_path),
        viewport_width=1920,
        viewport_height=1080,
        device_scale_factor=1,
    )
    assert create_browser_mock.await_args.args[0] is base_config


@pytest.mark.asyncio
async def test_analysis_slide_webpage_uses_declared_canvas_as_viewport(tmp_path):
    base_config = BrowserRuntimeConfig()
    browser = object()
    tool = AnalysisSlideWebpage(base_dir=tmp_path)

    with (
        patch(
            "app.tools.analysis_slide_webpage.BrowserConfigAdapter.build_playwright",
            new=AsyncMock(return_value=base_config),
        ) as build_playwright_mock,
        patch(
            "app.tools.analysis_slide_webpage.create_browser",
            new=AsyncMock(return_value=browser),
        ) as create_browser_mock,
    ):
        result = await tool._create_browser(viewport_width=1080, viewport_height=1080)

    assert result is browser
    build_playwright_mock.assert_awaited_once_with(
        str(tmp_path),
        viewport_width=1080,
        viewport_height=1080,
        device_scale_factor=1,
    )
    assert create_browser_mock.await_args.args[0] is base_config


@pytest.mark.asyncio
async def test_browser_config_adapter_applies_playwright_viewport_overrides(tmp_path):
    from app.service.browser.browser_config_adapter import BrowserConfigAdapter

    base_config = BrowserRuntimeConfig()
    with patch.object(BrowserConfigAdapter, "build", new=AsyncMock(return_value=base_config)):
        result = await BrowserConfigAdapter.build_playwright(
            str(tmp_path),
            viewport_width=1920,
            viewport_height=1080,
            device_scale_factor=1,
        )

    assert result.context.viewport_width == 1920
    assert result.context.viewport_height == 1080
    assert result.context.device_scale_factor == 1


@pytest.mark.asyncio
async def test_visual_understanding_webpage_loads_local_html_through_browser_blob(tmp_path):
    await async_write_text(tmp_path / "slide.html", "<!doctype html><main>Slide</main>")
    browser = FakeBrowser()
    tool = VisualUnderstandingWebpage(base_dir=tmp_path)
    load_page = AsyncMock(return_value="blob:https://browser.example/slide")

    with (
        patch.object(tool, "_create_browser", new=AsyncMock(return_value=browser)),
        patch("app.tools.visual_understanding_webpage.load_workspace_page", new=load_page),
        patch(
            "app.tools.visual_understanding_webpage.VisualUnderstanding.execute_purely",
            new=AsyncMock(return_value=ToolResult(content="Rendered correctly")),
        ),
    ):
        result = await tool.execute(
            ToolContext(tool_name=tool.name, arguments={}),
            VisualUnderstandingWebpageParams(target="slide.html", query="Review the slide"),
        )

    assert result.ok, result.content
    load_page.assert_awaited_once_with(browser, "page-1", tmp_path, tmp_path / "slide.html")
    assert browser.navigated_urls == []
    assert browser.closed is True


@pytest.mark.asyncio
async def test_analysis_slide_webpage_loads_local_html_through_browser_blob(tmp_path):
    await async_write_text(tmp_path / "slide.html", "<!doctype html><main>Slide</main>")
    browser = FakeBrowser()
    tool = AnalysisSlideWebpage(base_dir=tmp_path)
    load_page = AsyncMock(return_value="blob:https://browser.example/slide")

    with (
        patch.object(tool, "_create_browser", new=AsyncMock(return_value=browser)),
        patch.object(tool, "_get_analyzer_script", new=AsyncMock(return_value="return {MAX_WIDTH};")),
        patch.object(tool, "_analyze_with_ai", new=AsyncMock(return_value="No issues")),
        patch("app.tools.analysis_slide_webpage.load_workspace_page", new=load_page),
    ):
        result = await tool.execute(
            ToolContext(tool_name=tool.name, arguments={}),
            AnalysisSlideWebpageParams(target="slide.html", max_width=1920, max_height=1080),
        )

    assert result.ok, result.content
    load_page.assert_awaited_once_with(browser, "page-1", tmp_path, tmp_path / "slide.html")
    assert browser.navigated_urls == []
    assert browser.closed is True
