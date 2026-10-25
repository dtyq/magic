"""Aggregate file discovery preserves authorization, coverage, and cancellation."""

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError

from app.i18n import i18n
from app.infrastructure.sdk.magic_service.kernel.magic_service_exception import MagicServiceUnauthorizedException
from app.tools.core.tool_call_event_manager import ToolCallEventManager
from app.tools.super_magic import search_files
from app.tools.super_magic.search_files import SearchProjectFiles, SearchProjectFilesParams


def page(items=(), cursor=None, more=False):
    return {"list": list(items), "next_parent_ids": cursor or [], "has_more": more}


def file(identifier, name):
    return {"file_id": identifier, "file_name": name, "relative_file_path": "reports/" + name, "is_directory": False}


@pytest.fixture
def context(monkeypatch):
    event = asyncio.Event()
    agent = SimpleNamespace(
        get_interruption_event=lambda: event,
        is_interruption_requested=event.is_set,
        update_activity_time=lambda: None,
        get_super_magic_product_context=lambda: None,
    )
    api = SimpleNamespace(list_project_async=AsyncMock())
    product = SimpleNamespace(agent=agent, auth=object(), sdk=SimpleNamespace(file=api))
    monkeypatch.setattr("app.tools.super_magic.display.current_product_context", lambda _: product)
    tool_context = SimpleNamespace(get_extension=lambda _: agent)
    return tool_context, product, event


def params(**overrides):
    return SearchProjectFilesParams(**{
        "projects": [{"project_id": "1", "project_name": "Review project"}],
        "keywords": ["review"], **overrides,
    })


@pytest.mark.asyncio
async def test_aggregate_pages_use_current_auth_without_inner_tool_events(context, monkeypatch):
    tool_context, product, _ = context
    cursor = [{"parent_id": "91", "after_sort": 7, "after_file_id": "92"}]
    product.sdk.file.list_project_async.side_effect = [
        page([{"file_id": "91", "file_name": "review", "is_directory": True}], cursor, True),
        page([file("22", "review.pptx")]),
        page([file("11", "Annual REVIEW.md"), file("11", "Annual REVIEW.md"), file("12", "notes.txt")]),
    ]
    before, after = AsyncMock(), AsyncMock()
    monkeypatch.setattr(ToolCallEventManager, "trigger_before_tool_call", before)
    monkeypatch.setattr(ToolCallEventManager, "trigger_after_tool_call", after)
    result = await SearchProjectFiles().execute(tool_context, params(projects=[
        {"project_id": "1", "project_name": "First"},
        {"project_id": "2", "project_name": "Second"},
    ]))
    calls = product.sdk.file.list_project_async.call_args_list
    assert [c.args[1] for c in calls] == ["1", "2", "1"]
    assert all(c.args[0] is product.auth for c in calls)
    assert calls[2].args[2]["next_parent_ids"] == cursor
    assert result.ok and result.data["search_complete"]
    assert [(f["project_id"], f["file_id"]) for f in result.data["items"]] == [("2", "22"), ("1", "11")]
    assert "Annual REVIEW.md" in result.content
    before.assert_not_called()
    after.assert_not_called()


@pytest.mark.asyncio
async def test_page_budget_keeps_exact_continuation_and_unvisited_scope(context):
    tool_context, product, _ = context
    cursor = [{"parent_id": "91", "after_file_id": "92"}]
    product.sdk.file.list_project_async.return_value = page([], cursor, True)
    result = await SearchProjectFiles().execute(tool_context, params(
        projects=[{"project_id": "1"}, {"project_id": "2"}], max_pages=1,
    ))
    assert not result.data["search_complete"]
    assert result.data["search_scopes"][0]["next_parent_ids"] == cursor
    assert result.data["search_scopes"][1]["pages_scanned"] == 0
    assert "incomplete" in result.content
    assert product.sdk.file.list_project_async.await_count == 1
    pending = [{key: scope[key] for key in ("project_id", "project_name", "parent_id", "next_parent_ids")}
               for scope in result.data["search_scopes"]]
    product.sdk.file.list_project_async.reset_mock(side_effect=True)
    product.sdk.file.list_project_async.return_value = page()
    resumed = await SearchProjectFiles().execute(tool_context, params(projects=pending))
    assert resumed.data["search_complete"]
    assert product.sdk.file.list_project_async.call_args_list[0].args[2]["next_parent_ids"] == cursor


@pytest.mark.asyncio
async def test_permission_failure_keeps_other_scope_results(context):
    tool_context, product, _ = context
    product.sdk.file.list_project_async.side_effect = [MagicServiceUnauthorizedException("private auth detail"), page([file("22", "review.md")])]
    result = await SearchProjectFiles().execute(tool_context, params(projects=[{"project_id": "1"}, {"project_id": "2"}]))
    assert result.ok and not result.data["search_complete"]
    assert result.data["items"][0]["file_id"] == "22"
    assert result.data["search_scopes"][0]["error_code"] == "authorization_failed"
    assert "private auth detail" not in result.content


@pytest.mark.asyncio
async def test_all_failed_differs_from_complete_empty_search(context):
    tool_context, product, _ = context
    product.sdk.file.list_project_async.side_effect = MagicServiceUnauthorizedException()
    failed = await SearchProjectFiles().execute(tool_context, params())
    assert not failed.ok and not failed.data["search_complete"]
    product.sdk.file.list_project_async.side_effect = None
    product.sdk.file.list_project_async.return_value = page()
    empty = await SearchProjectFiles().execute(tool_context, params())
    assert empty.ok and empty.data["search_complete"] and empty.data["items"] == []


@pytest.mark.asyncio
@pytest.mark.parametrize("raw", [{"list": [], "has_more": True}, {"list": []}, {"unexpected": []}])
async def test_missing_cursor_or_invalid_page_never_means_complete(context, raw):
    tool_context, product, _ = context
    product.sdk.file.list_project_async.return_value = raw
    result = await SearchProjectFiles().execute(tool_context, params())
    assert not result.data["search_complete"]
    assert result.data["search_scopes"][0]["error_code"] == "invalid_input_or_response"
    assert product.sdk.file.list_project_async.await_count == 1


@pytest.mark.asyncio
async def test_repeated_cursor_stops_without_duplicate_hits(context):
    tool_context, product, _ = context
    product.sdk.file.list_project_async.return_value = page([file("11", "review.md")], [{"parent_id": "91"}], True)
    result = await SearchProjectFiles().execute(tool_context, params())
    assert product.sdk.file.list_project_async.await_count == 2
    assert len(result.data["items"]) == 1
    assert result.data["search_scopes"][0]["status"] == "failed"


@pytest.mark.asyncio
async def test_result_cap_distinguishes_omitted_matches_from_unsearched_pages(context):
    tool_context, product, _ = context
    product.sdk.file.list_project_async.return_value = page([file("11", "review.md"), file("12", "review.pptx")])
    result = await SearchProjectFiles().execute(tool_context, params(max_results=1))
    assert result.data["search_complete"] and result.data["results_truncated"]
    assert result.data["matched_count"] == 2 and len(result.data["items"]) == 1
    assert "will not recover omitted matches" in result.content


@pytest.mark.asyncio
async def test_page_timeout_preserves_other_scopes(context, monkeypatch):
    tool_context, product, _ = context
    monkeypatch.setattr(search_files, "PAGE_SECONDS", 0.01)

    async def request(auth, project_id, body):
        if project_id == "1":
            await asyncio.sleep(10)
        return page([file("22", "review.md")])

    product.sdk.file.list_project_async.side_effect = request
    result = await SearchProjectFiles().execute(tool_context, params(projects=[{"project_id": "1"}, {"project_id": "2"}]))
    assert result.ok and len(result.data["items"]) == 1
    assert result.data["search_scopes"][0]["error_code"] == "network_error"


@pytest.mark.asyncio
async def test_timed_out_page_counts_toward_request_budget(context, monkeypatch):
    tool_context, product, _ = context
    monkeypatch.setattr(search_files, "PAGE_SECONDS", 0.01)

    async def request(*args):
        await asyncio.sleep(10)

    product.sdk.file.list_project_async.side_effect = request
    result = await SearchProjectFiles().execute(tool_context, params(
        projects=[{"project_id": "1"}, {"project_id": "2"}], max_pages=1,
    ))
    assert product.sdk.file.list_project_async.await_count == 1
    assert result.data["pages_requested"] == 1
    assert result.data["search_scopes"][1]["status"] == "pending"


@pytest.mark.asyncio
async def test_overall_time_budget_preserves_pending_cursor(context, monkeypatch):
    tool_context, product, _ = context
    monkeypatch.setattr(search_files, "SEARCH_SECONDS", 0.01)
    cursor = [{"parent_id": "91"}]

    async def request(*args):
        await asyncio.sleep(10)

    product.sdk.file.list_project_async.side_effect = request
    result = await SearchProjectFiles().execute(tool_context, params(
        projects=[{"project_id": "1", "next_parent_ids": cursor}],
    ))
    scope = result.data["search_scopes"][0]
    assert scope["status"] == "pending" and "error_code" not in scope
    assert scope["next_parent_ids"] == cursor
    assert not result.data["search_complete"]


@pytest.mark.asyncio
async def test_user_interruption_cancels_inflight_request(context):
    tool_context, product, event = context
    entered, canceled = asyncio.Event(), asyncio.Event()

    async def request(*args):
        entered.set()
        try:
            await asyncio.Event().wait()
        finally:
            canceled.set()

    product.sdk.file.list_project_async.side_effect = request
    task = asyncio.create_task(SearchProjectFiles().execute(tool_context, params()))
    await asyncio.wait_for(entered.wait(), 1)
    event.set()
    with pytest.raises(asyncio.CancelledError):
        await asyncio.wait_for(task, 1)
    assert canceled.is_set()


@pytest.mark.parametrize("overrides", [
    {"keywords": [" "]}, {"keywords": ["x" * 101]}, {"projects": [{"project_id": "0"}]},
    {"projects": [{"project_id": "1"}, {"project_id": "1"}]}, {"max_pages": 51},
])
def test_search_input_is_bounded(overrides):
    with pytest.raises(ValidationError):
        params(**overrides)


@pytest.mark.asyncio
@pytest.mark.parametrize("language", ["zh_CN", "en_US"])
async def test_one_localized_search_detail_contains_scope_and_matches(context, language):
    tool_context, product, _ = context
    product.sdk.file.list_project_async.side_effect = [
        page([file("987654321012345678", "review.md")], [{"parent_id": "88"}], True),
    ]
    i18n.set_language(language)
    try:
        tool = SearchProjectFiles()
        result = await tool.execute(tool_context, params(max_pages=1))
        detail = await tool.get_tool_detail(tool_context, result, {})
        remark = await tool.get_after_tool_call_friendly_action_and_remark(tool.name, tool_context, result, 0, {})
        assert "Review project" in detail.data.content and r"| review\.md |" in detail.data.content
        assert "部分文件处理失败" not in detail.data.content
        assert "987654321012345678" not in detail.data.content
        assert "next_parent_ids" not in detail.data.content
        assert "{{" not in str(remark)
        assert ("未完成" if language == "zh_CN" else "Incomplete coverage") in remark["remark"]
    finally:
        i18n.reset_language()
