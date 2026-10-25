"""User-visible cards and details for every registered product tool."""
import ast
import importlib
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult

from app.core.entity.factory.task_message_factory_v2 import TaskMessageFactoryV2
from app.i18n import i18n
from app.tools.super_magic.display import TOOL_SUBJECTS, ProductTool, product_detail
from app.tools.super_magic.topics import CreateTopic


def registered_tools():
    classes = []
    directory = Path(__file__).parents[3] / "app/tools/super_magic"
    for path in directory.glob("*.py"):
        for node in ast.parse(path.read_text()).body:
            if isinstance(node, ast.ClassDef) and any(isinstance(d, ast.Call) and isinstance(d.func, ast.Name) and d.func.id == "tool" for d in node.decorator_list):
                module = importlib.import_module(f"app.tools.super_magic.{path.stem}")
                classes.append(getattr(module, node.name))
    return classes


TOOLS = registered_tools()


@pytest.mark.parametrize("language", ["zh_CN", "en_US"])
@pytest.mark.parametrize("tool_class", TOOLS, ids=lambda cls: cls.name)
@pytest.mark.asyncio
async def test_each_tool_has_running_success_and_failure_display(tool_class, language):
    i18n.set_language(language)
    try:
        instance = tool_class()
        ctx = ToolContext(tool_call_id="call", tool_name=instance.name)
        arguments = {"name": "Research plan", "file_ids": ["1", "2"], "keyword": "research"}
        before = await instance.get_before_tool_call_friendly_action_and_remark(instance.name, ctx, arguments)
        running = await instance.get_before_tool_detail(ctx, arguments)
        assert before["action"] and "Research plan" in before["remark"]
        assert "Research plan" in running.data.content
        for result in (ToolResult(content="Model output", data={"name": "Research plan", "status": "accepted"}), ToolResult.error("private service body", data={"code": "outcome_unknown"}, use_custom_remark=True)):
            after = await instance.get_after_tool_call_friendly_action_and_remark(instance.name, ctx, result, 0, arguments)
            detail = await instance.get_tool_detail(ctx, result, arguments)
            assert "Research plan" in after["remark"]
            assert detail.data.content and "Research plan" in detail.data.content
            assert "private service body" not in detail.data.content
            assert "Model output" not in detail.data.content
            assert "{{" not in after["remark"]
    finally:
        i18n.reset_language()


def test_display_covers_the_actual_registered_tools():
    assert len(TOOLS) == 43
    assert set(TOOL_SUBJECTS) == {cls.name for cls in TOOLS}


def test_details_show_records_messages_pagination_and_pending_state():
    i18n.set_language("en_US")
    try:
        detail = product_detail("list_topics", ToolResult(content="", data={"items": [{"topic_name": "Pricing", "task_status": "running", "updated_at": "2026-10-08 09:30:00"}], "page": 2, "has_more": True})).data.content
        assert "Pricing" in detail and "Running" in detail and "09:30:00 UTC+08:00" in detail
        assert "More records" in detail and "2" in detail
        messages = product_detail("read_topic_messages", ToolResult(content="", data={"messages": [{"role": "user", "text": "Report <script> | sample", "timestamp": 1700000000}]})).data.content
        assert "Report &lt;script&gt;" in messages
        assert "\\| sample" in messages
        pending = product_detail("start_topic_task", ToolResult(content="", data={"status": "queued"})).data.content
        assert "Check the final status" in pending
    finally:
        i18n.reset_language()


@pytest.mark.asyncio
async def test_current_topic_name_is_only_used_for_matching_id():
    tool = CreateTopic()
    ctx = ToolContext(tool_call_id="call", tool_name=tool.name)
    ctx.register_extension("agent_context", SimpleNamespace(get_super_magic_product_context=lambda: SimpleNamespace(topic=SimpleNamespace(id="99", name="Initiating topic"))))
    detail = await tool.get_tool_detail(ctx, ToolResult(content="", data={"id": "20"}), {"topic_id": "20"})
    assert "Initiating topic" not in detail.data.content


@pytest.mark.asyncio
@pytest.mark.parametrize("failed", [False, True])
async def test_v2_factory_keeps_custom_summary_and_nonempty_detail(monkeypatch, failed):
    tool = CreateTopic()
    agent = SimpleNamespace(get_super_magic_product_context=lambda: None)
    ctx = ToolContext(tool_call_id="call", tool_name=tool.name)
    ctx.register_extension("agent_context", agent)
    ctx.register_extension("is_code_mode", True)
    result = ToolResult.error("private body", data={"code": "authorization_failed"}, use_custom_remark=True) if failed else ToolResult(content="Created", data={"topic_name": "Research plan"}, use_custom_remark=True)
    event = SimpleNamespace(event_type="after_tool_call", data=SimpleNamespace(tool_context=ctx, tool_instance=tool, result=result, arguments={"name": "Research plan"}, tool_name=tool.name, execution_time=0, correlation_id="corr", tool_call=SimpleNamespace(id="call")))
    monkeypatch.setattr("app.core.entity.factory.task_message_factory_v2.ToolDetailPersistenceService.persist", AsyncMock())
    monkeypatch.setattr(TaskMessageFactoryV2, "_should_include_debug_tool_result_content", lambda *_: False)
    monkeypatch.setattr(TaskMessageFactoryV2, "_build_inner_message", lambda *_args, **kwargs: kwargs)
    monkeypatch.setattr(TaskMessageFactoryV2, "_build_and_send", lambda *_args, **kwargs: kwargs)
    message = await TaskMessageFactoryV2.create_after_tool_call_message(event)
    card = message["outer_tool"]
    assert "Research plan" in card.remark
    assert card.detail.data.content
    assert "private body" not in card.detail.data.content


@pytest.mark.asyncio
async def test_write_timeout_retains_specific_outcome_and_is_not_retried(monkeypatch):
    tool = CreateTopic()
    ctx = SimpleNamespace(agent=SimpleNamespace(is_interruption_requested=lambda: False))
    monkeypatch.setattr("app.tools.super_magic.display.current_product_context", lambda _: ctx)
    operation = AsyncMock(side_effect=TimeoutError)
    result = await tool.run_product(None, "Topic creation", operation, write=True)
    assert not result.ok and result.data["code"] == "outcome_unknown"
    assert result.use_custom_remark
    operation.assert_awaited_once()


@pytest.mark.asyncio
async def test_unexpected_failure_logs_call_site_without_private_exception_body(monkeypatch):
    tool = CreateTopic()
    ctx = SimpleNamespace(agent=SimpleNamespace(is_interruption_requested=lambda: False))
    monkeypatch.setattr('app.tools.super_magic.display.current_product_context', lambda _: ctx)
    logger = Mock()
    monkeypatch.setattr('app.tools.super_magic.display.logger', logger, raising=False)
    operation = AsyncMock(side_effect=KeyError('private-upstream-body'))
    result = await tool.run_product(SimpleNamespace(tool_call_id='failing-call'), 'Topic creation', operation, write=True)
    assert not result.ok and result.data['code'] == 'unexpected_error'
    logger.error.assert_called_once()
    logged = str(logger.error.call_args)
    assert 'failing-call' in logged and 'KeyError' in logged and 'run_product' in logged
    assert 'private-upstream-body' not in logged
    assert 'private-upstream-body' not in result.content


@pytest.mark.asyncio
async def test_selected_file_count_does_not_disappear_in_pending_batch():
    from app.tools.super_magic.files import CopyProjectFiles
    i18n.set_language("en_US")
    try:
        tool = CopyProjectFiles()
        result = ToolResult(content="Accepted", data={"status": "processing", "files": []})
        card = await tool.get_after_tool_call_friendly_action_and_remark(tool.name, None, result, 0, {"file_ids": ["1", "2"]})
        assert "2 files" in card["remark"]
        detail = await tool.get_tool_detail(None, result, {"file_ids": ["1", "2"]})
        assert "Selected file count: 2" in detail.data.content
        assert "Check the final status" in detail.data.content
    finally:
        i18n.reset_language()


def test_queue_delivery_status_is_distinct_from_task_completion():
    from app.tools.super_magic.tasks import _queue_status
    i18n.set_language("en_US")
    try:
        assert _queue_status(0) == "queued"
        detail = product_detail("list_topic_queued_messages", ToolResult(content="", data={"items": [{"status": _queue_status(1)}]}))
        assert "Delivered (task completion unconfirmed)" in detail.data.content
    finally:
        i18n.reset_language()


@pytest.mark.asyncio
async def test_v2_running_card_contains_name_and_detail():
    tool = CreateTopic()
    ctx = ToolContext(tool_call_id="call", tool_name=tool.name)
    item = await TaskMessageFactoryV2._build_running_tool_call_item(tool, tool.name, ctx, {"name": "Research plan", "project_id": "10"}, "call")
    assert "Research plan" in item["tool"]["remark"]
    assert item["tool"]["detail"]["data"]["content"]


@pytest.mark.asyncio
async def test_delete_retains_topic_name_without_stale_task_status(monkeypatch):
    from app.tools.super_magic.topics import DeleteTopic, GetTopicParams
    sdk = SimpleNamespace(topic=SimpleNamespace(get_async=AsyncMock(return_value={"id": "20", "topic_name": "Research plan", "task_status": "running"}), delete_async=AsyncMock(return_value={"id": "20"})))
    ctx = SimpleNamespace(auth=object(), sdk=sdk)

    async def run(self, tool_context, action, operation, **kwargs):
        return ToolResult(content="Deleted", data=await operation(ctx))

    monkeypatch.setattr(ProductTool, "run_product", run)
    result = await DeleteTopic().execute(None, GetTopicParams(topic_id="20"))
    assert result.data["topic_name"] == "Research plan"
    assert "task_status" not in result.data
    detail = await DeleteTopic().get_tool_detail(None, result)
    assert "Research plan" in detail.data.content
