from io import BytesIO
from pathlib import Path
from unittest.mock import patch

import pytest
from PIL import Image

from agentlang.context.tool_context import ToolContext
from app.tools.slide_template_builder import CreateSlideTemplateProject, FinalizeSlideTemplate
from app.tools.slide_template_builder.create_project import CreateSlideTemplateProjectParams
from app.tools.slide_template_builder.finalize_project import FinalizeSlideTemplateParams
from app.tools.slide_template_builder.models import (
    TemplateDescriptionText,
    TemplateLabelText,
    TemplateSlideParams,
    TemplateSourceParams,
)
from app.tools.slide_template_builder.preview import SlideCapture
from app.utils.async_file_utils import async_exists, async_write_text


def _workspace(tmp_path: Path) -> Path:
    workspace = tmp_path / ".workspace"
    workspace.mkdir(exist_ok=True)
    return workspace


def _params() -> CreateSlideTemplateProjectParams:
    return CreateSlideTemplateProjectParams(
        template_id="SLIDE-navy-quarterly-review",
        category_code="PPT-CATE-business-report",
        tag_codes=["style-business"],
        label=TemplateLabelText(zh_CN="深蓝经营复盘", en_US="Navy Business Review"),
        description=TemplateDescriptionText(zh_CN="适合经营复盘。", en_US="A reusable operating review template."),
        source=TemplateSourceParams(kind="original", method="manual", file=""),
        slides=[
            TemplateSlideParams(
                file="slides/cover.html",
                title="Business Review",
                layout="cover",
                description="Opening cover.",
            )
        ],
    )


@pytest.mark.asyncio
async def test_finalize_project_uses_browser_sdk_instead_of_direct_playwright(tmp_path: Path):
    create_tool = CreateSlideTemplateProject(base_dir=_workspace(tmp_path))
    create_result = await create_tool.execute(ToolContext(tool_name=create_tool.name, arguments={}), _params())
    assert create_result.ok
    template_dir = Path(create_result.data["template_directory"])
    await async_write_text(template_dir / "visual-spec.md", "# Visual Specification\n\nNavy report system.\n")
    await async_write_text(
        template_dir / "theme.css",
        ":root { --navy: #102a43; }\n"
        "html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; }\n"
        ".slide-container { width: 1920px; height: 1080px; background: var(--navy); }\n",
    )
    await async_write_text(
        template_dir / "slides/cover.html",
        '<!doctype html><html><head><link rel="stylesheet" href="../theme.css"></head>'
        '<body><main class="slide-container" data-width="1920" data-height="1080">'
        '<h1 data-slot="title">Business Review</h1>'
        '<p data-slot="subtitle">Q4</p><span data-slot="meta">Strategy Team</span></main></body></html>',
    )

    screenshot = BytesIO()
    Image.new("RGB", (1920, 1080), "#102a43").save(screenshot, format="PNG")

    async def fake_render_slide_previews(*, workspace_dir, template_dir, slides, canvas):
        assert workspace_dir == _workspace(tmp_path)
        assert template_dir == Path(create_result.data["template_directory"])
        assert [slide["file"] for slide in slides] == ["slides/cover.html"]
        assert canvas.as_tuple() == (1920, 1080)
        return [
            SlideCapture(
                screenshot=screenshot.getvalue(),
                inspection={
                    "scrollWidth": 1920,
                    "scrollHeight": 1080,
                    "bodyScrollWidth": 1920,
                    "bodyScrollHeight": 1080,
                    "brokenImages": [],
                    "slideBounds": {"width": 1920, "height": 1080},
                    "viewport": {"width": 1920, "height": 1080},
                },
            )
        ]

    finalize_tool = FinalizeSlideTemplate(base_dir=_workspace(tmp_path))
    with (
        patch(
            "app.tools.slide_template_builder.finalize_project.render_slide_previews",
            new=fake_render_slide_previews,
        ),
        patch(
            "playwright.async_api.async_playwright",
            side_effect=AssertionError("finalization must not launch Playwright directly"),
        ),
    ):
        result = await finalize_tool.execute(
            ToolContext(tool_name=finalize_tool.name, arguments={}),
            FinalizeSlideTemplateParams(template_dir=create_result.data["template_id"]),
        )

    assert result.ok, result.content
    assert await async_exists(template_dir / "previews/slides/slide-001.png")
