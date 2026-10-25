import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from PIL import Image

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.tools.slide_template_builder import (
    CreateSlideTemplateProject,
    PrepareSlideTemplateSource,
    ReviewSlideTemplateSource,
)
from app.tools.slide_template_builder.common import recommended_review_indexes
from app.tools.slide_template_builder.create_project import CreateSlideTemplateProjectParams
from app.tools.slide_template_builder.models import (
    TemplateDescriptionText,
    TemplateLabelText,
    TemplateSlideParams,
    TemplateSourceParams,
)
from app.tools.slide_template_builder.source_analysis import PrepareSlideTemplateSourceParams
from app.tools.slide_template_builder.source_review import (
    ReviewSlideTemplateSourceParams,
    parse_source_review_payload,
    split_review_indexes,
)
from app.utils.async_file_utils import async_read_json


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
        source=TemplateSourceParams(kind="derived", method="visual-reconstruction", file="source.pptx"),
        slides=[
            TemplateSlideParams(
                file="slides/cover.html",
                title="Business Review",
                layout="cover",
                description="Opening cover.",
            )
        ],
    )


def test_recommended_review_indexes_covers_cover_middle_and_close():
    assert recommended_review_indexes(1) == [1]
    assert recommended_review_indexes(4) == [1, 2, 3, 4]
    assert recommended_review_indexes(15) == [1, 5, 10, 15]


def test_review_params_defer_indexes_beyond_one_batch():
    params = ReviewSlideTemplateSourceParams(
        template_dir="navy-review",
        source_indexes=[1, 2, 3, 4, 5, 6, 7, 8],
    )
    assert params.source_indexes == [1, 2, 3, 4, 5, 6, 7, 8]
    assert split_review_indexes(params.source_indexes) == ([1, 2, 3, 4, 5, 6], [7, 8])


def test_parse_source_review_payload_reads_json_block():
    payload = parse_source_review_payload(
        "Notes before\n```json\n"
        '{"summary": "Orange cover with mascot.", "must_preserve": ["Orange accent"],'
        ' "visual_elements": [{"role": "mascot", "description": "Standing mascot."}],'
        ' "style_tokens": {"accent": "#ff8c00"}}\n'
        "```\n"
    )
    assert payload["summary"] == "Orange cover with mascot."
    assert payload["must_preserve"] == ["Orange accent"]
    assert payload["style_tokens"]["accent"] == "#ff8c00"


@pytest.mark.asyncio
async def test_review_source_writes_official_visual_analysis(tmp_path):
    create_tool = CreateSlideTemplateProject(base_dir=_workspace(tmp_path))
    created = await create_tool.execute(ToolContext(tool_name=create_tool.name, arguments={}), _params())
    assert created.ok, created.content
    page_image = tmp_path / "source-page.png"
    Image.new("RGB", (1920, 1080), "#102a43").save(page_image)
    prepare_tool = PrepareSlideTemplateSource(base_dir=_workspace(tmp_path))
    prepared = await prepare_tool.execute(
        ToolContext(tool_name=prepare_tool.name, arguments={}),
        PrepareSlideTemplateSourceParams(
            template_dir=created.data["template_id"],
            page_images=[str(page_image)],
        ),
    )
    assert prepared.ok, prepared.content

    visual_json = json.dumps({
        "summary": "Navy cover with left title anchor.",
        "must_preserve": ["Navy canvas", "Left title"],
        "visual_elements": [{"role": "title-anchor", "description": "Large left title."}],
        "style_tokens": {"accent": "#e6b566"},
    })
    review_tool = ReviewSlideTemplateSource(base_dir=_workspace(tmp_path))
    with patch(
        "app.tools.slide_template_builder.source_review.inspect_source_images",
        new=AsyncMock(return_value=ToolResult(content=visual_json)),
    ) as inspect:
        result = await review_tool.execute(
            ToolContext(tool_name=review_tool.name, arguments={}),
            ReviewSlideTemplateSourceParams(template_dir=created.data["template_directory"], source_indexes=[1]),
        )

    assert result.ok, result.content
    assert "Navy canvas" in result.content
    assert inspect.await_count == 1
    sent_images = inspect.await_args.args[0]
    assert any(path.endswith("full/slide-001.png") for path in sent_images)
    assert any("crops/slide-001" in path for path in sent_images)

    # 测量到的底色要作为事实注入提问，并在模型漏答时补位到回传内容里
    assert "#102a43" in inspect.await_args.args[1]
    assert "Background: dark #102a43" in result.content
    assert result.data["page_backgrounds"] == [
        {
            "source_index": 1,
            "base_color": "#102a43",
            "measured_color": "#102a43",
            "tone": "dark",
            "measured_luminance": 0.0217,
            "treatment": "flat",
        }
    ]

    manifest = await async_read_json(Path(prepared.data["source_analysis"]))
    visual = manifest["slides"][0]["visual_analysis"]
    assert visual["status"] == "complete"
    assert visual["must_preserve"] == ["Navy canvas", "Left title"]
    assert visual["background"]["base_color"] == "#102a43"
    assert result.data["unreviewed_source_indexes"] == []
