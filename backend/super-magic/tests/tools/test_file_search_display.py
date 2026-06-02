import pytest

from agentlang.context.tool_context import ToolContext
from app.core.entity.message.server_message import DisplayType
from app.tools.file_search import FileSearch, FileSearchParams


@pytest.mark.asyncio
async def test_file_search_builds_display_lifecycle(tmp_path):
    (tmp_path / "docs").mkdir()
    target = tmp_path / "docs" / "alpha_notes.md"
    target.write_text("hello\nworld\n", encoding="utf-8")

    tool = FileSearch(base_dir=tmp_path)
    arguments = {"query": "alpha"}
    tool_context = ToolContext(tool_name="file_search", arguments=arguments)

    before = await tool.get_before_tool_call_friendly_action_and_remark(
        "file_search",
        tool_context,
        arguments,
    )
    result = await tool.execute(tool_context, FileSearchParams(query="alpha"))
    detail = await tool.get_tool_detail(tool_context, result, arguments)
    after = await tool.get_after_tool_call_friendly_action_and_remark(
        "file_search",
        tool_context,
        result,
        0.1,
        arguments,
    )

    assert before["tool_name"] == "file_search"
    assert "alpha" in before["remark"]
    assert result.ok
    assert result.extra_info["match_count"] == 1
    assert result.extra_info["matches"][0]["path"] == "docs/alpha_notes.md"
    assert detail is not None
    assert detail.type == DisplayType.MD
    assert str(tmp_path) in detail.data.content
    assert "docs/alpha_notes.md" in detail.data.content
    assert after["tool_name"] == "file_search"
    assert "1" in after["remark"]


@pytest.mark.asyncio
async def test_file_search_detail_shows_empty_result(tmp_path):
    tool = FileSearch(base_dir=tmp_path)
    arguments = {"query": "missing"}
    tool_context = ToolContext(tool_name="file_search", arguments=arguments)

    result = await tool.execute(tool_context, FileSearchParams(query="missing"))
    detail = await tool.get_tool_detail(tool_context, result, arguments)

    assert result.ok
    assert result.extra_info["match_count"] == 0
    assert detail is not None
    assert "missing" in detail.data.content
