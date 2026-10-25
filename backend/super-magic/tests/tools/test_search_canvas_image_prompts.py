"""Canvas 提示词库工具的 mock 测试。"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.tools.canvas.tools.search_canvas_image_prompts import (
    SearchCanvasImagePrompts,
    SearchCanvasImagePromptsParams,
)

PROMPTS = [
    {
        "rank": 2,
        "id": "prompt-2",
        "prompt": "A premium product hero on a marble table",
        "author_name": "mock-author",
        "categories": ["Product & Brand"],
        "likes": 20,
        "views": 100,
        "image": "https://mock.invalid/preview-2.png",
        "source_url": "https://mock.invalid/prompt-2",
    },
    {
        "rank": 1,
        "id": "prompt-1",
        "prompt": "A cinematic mountain landscape at sunrise",
        "author_name": "mock-author",
        "categories": ["Photography"],
        "likes": 10,
        "views": 80,
        "image": "https://mock.invalid/preview-1.png",
        "source_url": "https://mock.invalid/prompt-1",
    },
]


def test_prompt_search_filters_category_and_ranks_keyword_matches() -> None:
    """提示词搜索应支持分类过滤并按命中分返回结果。"""
    from app.tools.canvas.tools.search_canvas_image_prompts import _do_search

    results, total = _do_search(
        prompts=PROMPTS,
        query="product hero",
        category="Product & Brand",
        sort_by="rank",
        limit=5,
        offset=0,
        use_random=False,
    )

    assert total == 1
    assert [item["id"] for item in results] == ["prompt-2"]


@pytest.mark.asyncio
async def test_prompt_tool_returns_model_content_and_structured_results(monkeypatch) -> None:
    """提示词工具应返回可读 content 和精简结构化结果。"""
    from app.tools.canvas.tools import search_canvas_image_prompts as module

    async def load_mock_prompts():
        """返回隔离的 mock 提示词，不读取真实提示词库。"""
        return PROMPTS

    monkeypatch.setattr(module, "_load_prompts", load_mock_prompts)
    tool = SearchCanvasImagePrompts()

    result = await tool.execute(
        None,
        SearchCanvasImagePromptsParams(query="mountain", limit=1),
    )

    assert result.ok is True
    assert "Prompt library:" in result.content
    assert result.data["query"] == "mountain"
    assert result.data["total_matched"] == 1
    assert result.data["results"][0]["id"] == "prompt-1"


def test_prompt_tool_exposes_all_feedback_hooks() -> None:
    """Canvas 提示词工具应提供开始、完成和详情反馈钩子。"""
    hooks = SearchCanvasImagePrompts.__dict__

    assert "get_before_tool_call_friendly_action_and_remark" in hooks
    assert "get_after_tool_call_friendly_action_and_remark" in hooks
    assert "get_tool_detail" in hooks


def test_prompt_tool_schema_keeps_default_fields_optional() -> None:
    """工具 Schema 不应把带默认值的提示词筛选参数误标为必填。"""
    parameters = SearchCanvasImagePrompts().to_param()["function"]["parameters"]

    assert parameters.get("required") == []
    assert parameters["additionalProperties"] is False
    assert parameters["properties"]["limit"]["minimum"] == 1
    assert parameters["properties"]["limit"]["maximum"] == 20
    assert parameters["properties"]["offset"]["minimum"] == 0


def test_prompt_tool_rejects_unknown_parameters() -> None:
    """提示词工具不应静默忽略 Schema 之外的参数。"""
    with pytest.raises(ValidationError, match="Extra inputs are not permitted"):
        SearchCanvasImagePromptsParams(unexpected="value")
