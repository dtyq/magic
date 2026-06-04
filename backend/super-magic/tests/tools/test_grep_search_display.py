import pytest

from agentlang.context.tool_context import ToolContext
from app.tools.grep_search import GrepSearch, GrepSearchParams


def _grep_search_tool(tmp_path):
    tool = GrepSearch(base_dir=tmp_path)

    async def noop_update_file_timestamps(*args, **kwargs):
        return None

    tool._update_file_timestamps = noop_update_file_timestamps
    return tool


@pytest.mark.asyncio
async def test_grep_search_after_remark_includes_matched_file_count(tmp_path):
    (tmp_path / "a.py").write_text("needle = 1\n", encoding="utf-8")
    (tmp_path / "b.py").write_text("needle = 2\n", encoding="utf-8")

    tool = _grep_search_tool(tmp_path)
    arguments = {"pattern": "needle", "include": "*.py", "path": "."}
    tool_context = ToolContext(tool_name="grep_search", arguments=arguments)

    result = await tool.execute(tool_context, GrepSearchParams(**arguments))
    after = await tool.get_after_tool_call_friendly_action_and_remark(
        "grep_search",
        tool_context,
        result,
        0.1,
        arguments,
    )

    assert result.ok
    assert result.extra_info["matched_files_count"] == 2
    assert "needle" in after["remark"]
    assert "2" in after["remark"]


@pytest.mark.asyncio
async def test_grep_search_detail_exists_when_no_matches(tmp_path):
    (tmp_path / "a.py").write_text("haystack = 1\n", encoding="utf-8")

    tool = _grep_search_tool(tmp_path)
    arguments = {"pattern": "needle", "include": "*.py", "path": "."}
    tool_context = ToolContext(tool_name="grep_search", arguments=arguments)

    result = await tool.execute(tool_context, GrepSearchParams(**arguments))
    detail = await tool.get_tool_detail(tool_context, result, arguments)

    assert result.ok
    assert result.extra_info["matched_files_count"] == 0
    assert detail is not None
    assert "needle" in detail.data.content
    assert "Files matched:** 0" in detail.data.content
    assert "No matches found" in detail.data.content
