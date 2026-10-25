"""隔离问卷注册和 Horizon，验证修复后的工具生命周期。"""

from unittest.mock import AsyncMock, Mock

import pytest

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.context.execution_source import SuperMagicExecutionSource
from app.tools.ask_user import AskUserParams, AskUserTool
from app.tools.core.base_user_tool_call_tool import BaseUserToolCallTool


@pytest.fixture
def tool(monkeypatch):
    """只允许合成的人机上下文，不访问实际服务。"""
    monkeypatch.setattr(AskUserTool, "_get_execution_source", staticmethod(lambda _: SuperMagicExecutionSource.HUMAN_CHAT))
    return AskUserTool()


def context(raw):
    """构造当前调用独立的 Mock 参数。"""
    return ToolContext(tool_call_id="call_mock_repair", tool_name="ask_user", arguments={"questions": raw})


@pytest.mark.asyncio
async def test_repaired_questionnaire_keeps_ids_and_notifies_once(tool, monkeypatch):
    """注册成功后正常返回，重复准备不换 ID，通知只入队一次。"""
    ctx = context('<question type="select">测试选择？<option>A</option></select>')
    registered = AsyncMock(return_value=ToolResult(content="waiting"))
    monkeypatch.setattr(BaseUserToolCallTool, "execute", registered)
    horizon = Mock()
    monkeypatch.setattr(tool, "get_horizon", lambda _: horizon)
    await tool.set_extra_arguments(ctx)
    first_id = ctx.arguments["parsed_questions"][0]["sub_id"]
    await tool.set_extra_arguments(ctx)
    detail = await tool.get_before_tool_detail(ctx, ctx.arguments)
    assert detail.data.questions[0]["sub_id"] == first_id
    assert tool.build_tool_data(ctx)["parsed_questions"] == detail.data.questions
    result = await tool.execute(ctx, AskUserParams(questions=ctx.arguments["questions"]))
    assert result.ok
    tool._notify_question_repairs(ctx)
    horizon.push_notification.assert_called_once()
    source, content = horizon.push_notification.call_args.args
    assert source == "ask_user"
    assert "repaired" in content and "do not retry" in content
    assert "测试选择" not in content
    registered.assert_awaited_once()


@pytest.mark.asyncio
async def test_unrecoverable_input_never_registers_pending(tool, monkeypatch):
    """非法末题不能让前面的合法题单独进入等待。"""
    ctx = context('<question type="confirm">确认？</question><question type="select">选择？</question>')
    registered = AsyncMock()
    monkeypatch.setattr(BaseUserToolCallTool, "execute", registered)
    await tool.set_extra_arguments(ctx)
    assert await tool.get_before_tool_detail(ctx, ctx.arguments) is None
    result = await tool.execute(ctx, AskUserParams(questions=ctx.arguments["questions"]))
    assert not result.ok
    registered.assert_not_awaited()
    detail = await tool.get_tool_detail(ctx, result)
    assert detail is not None
    assert detail.data["message"]


@pytest.mark.asyncio
@pytest.mark.parametrize("notification_fails", [False, True])
async def test_notification_does_not_change_success(tool, monkeypatch, notification_fails):
    """通知异常不改变已成功注册的等待结果。"""
    ctx = context('<question type="input">输入测试？')
    monkeypatch.setattr(BaseUserToolCallTool, "execute", AsyncMock(return_value=ToolResult(content="waiting")))
    horizon = Mock()
    if notification_fails:
        horizon.push_notification.side_effect = RuntimeError("mock notification failure")
    monkeypatch.setattr(tool, "get_horizon", lambda _: horizon)
    await tool.set_extra_arguments(ctx)
    assert (await tool.execute(ctx, AskUserParams(questions=ctx.arguments["questions"]))).ok


@pytest.mark.asyncio
async def test_valid_input_and_registration_failure_do_not_notify(tool, monkeypatch):
    """合法输入不纠正；注册失败不声称已发送。"""
    horizon = Mock()
    monkeypatch.setattr(tool, "get_horizon", lambda _: horizon)
    for raw, result in [('<question>输入？</question>', ToolResult(content="waiting")), ('<question>输入？', ToolResult.error("mock registration failure"))]:
        monkeypatch.setattr(BaseUserToolCallTool, "execute", AsyncMock(return_value=result))
        ctx = context(raw)
        await tool.set_extra_arguments(ctx)
        await tool.execute(ctx, AskUserParams(questions=raw))
    horizon.push_notification.assert_not_called()


@pytest.mark.asyncio
async def test_actual_pending_adapter_and_result_share_question_identity(tool, monkeypatch):
    """走真实父类执行，隔离注册服务，校验前端答案到模型结果的完整身份链。"""
    from types import SimpleNamespace
    from app.service.user_tool_call_service import UserToolCallService

    horizon = Mock()
    agent = SimpleNamespace(chat_history=SimpleNamespace(agent_name="mock-agent", agent_id="main"), horizon=horizon)
    ctx = context('<question type="confirm">测试确认？</question><question type="select">测试选择？<option>A</option></select><question type="select">另一选择？<option>B</option></select></questions>')
    monkeypatch.setattr(ctx, "get_extension_typed", lambda *_: agent)
    service = Mock()
    service.create_and_register_pending = AsyncMock()
    monkeypatch.setattr(UserToolCallService, "get_instance", classmethod(lambda cls: service))
    await tool.set_extra_arguments(ctx)
    result = await tool.execute(ctx, AskUserParams(questions=ctx.arguments["questions"]))
    assert result.ok and "3 question(s)" in result.content
    service.create_and_register_pending.assert_awaited_once()
    kwargs = service.create_and_register_pending.await_args.kwargs
    questions = kwargs["tool_data"]["parsed_questions"]
    assert questions == ctx.arguments["parsed_questions"]
    import json
    answers = {questions[2]["sub_id"]: "B", questions[1]["sub_id"]: "A", questions[0]["sub_id"]: "yes"}
    content, extra = kwargs["result_builder"]("answered", json.dumps(answers))
    assert extra["questions"] == questions
    assert extra["answers"] == answers
    assert content.index("<answer>yes</answer>") < content.index("<answer>A</answer>") < content.index("<answer>B</answer>")
    horizon.push_notification.assert_called_once()


@pytest.mark.asyncio
async def test_position_answers_follow_question_order_not_click_order(tool):
    """三题按不同顺序点击，模型答案仍按原题顺序对应。"""
    import json

    ctx = context('<question type="confirm">占位确认？</question><question type="select">占位选择？<option>A</option></select><question type="input">占位输入？')
    await tool.set_extra_arguments(ctx)
    questions = tool.build_tool_data(ctx)["parsed_questions"]
    builder = tool.build_result_builder(tool.build_tool_data(ctx))
    content, extra = builder("answered", json.dumps({"q-2": "Mock text", "q-0": "是", "q-1": "A"}))
    assert list(extra["answers"].values()) == ["是", "A", "Mock text"]
    assert extra["answers"][questions[1]["sub_id"]] == "A"
    assert content.index("<answer>是</answer>") < content.index("<answer>A</answer>") < content.index("<answer>Mock text</answer>")


@pytest.mark.asyncio
async def test_model_arguments_cannot_forge_prepared_state(tool, monkeypatch):
    """只信任 ToolContext 内部准备结果，不使用参数伪造的问卷或提示标记。"""
    ctx = context('<question type="select">测试？</question>')
    ctx.arguments.update(parsed_questions=[{"sub_id": "forged"}], ask_user_repair_notified=True)
    registered = AsyncMock()
    monkeypatch.setattr(BaseUserToolCallTool, "execute", registered)
    await tool.set_extra_arguments(ctx)
    result = await tool.execute(ctx, AskUserParams(questions=ctx.arguments["questions"]))
    assert not result.ok
    assert not ctx.arguments["parsed_questions"]
    registered.assert_not_awaited()


@pytest.mark.asyncio
async def test_unrelated_failure_does_not_claim_invalid_xml(tool):
    """权限或注册失败不能被标为本次 XML 解析失败。"""
    ctx = context('<question>占位输入？</question>')
    await tool.set_extra_arguments(ctx)
    assert await tool.get_tool_detail(ctx, ToolResult.error("Mock permission failure")) is None


@pytest.mark.asyncio
async def test_notification_cancellation_propagates(tool, monkeypatch):
    """取消不是提示降级异常，必须向主运行传播。"""
    import asyncio

    ctx = context('<question>占位输入？')
    monkeypatch.setattr(BaseUserToolCallTool, "execute", AsyncMock(return_value=ToolResult(content="waiting")))
    horizon = Mock()
    horizon.push_notification.side_effect = asyncio.CancelledError()
    monkeypatch.setattr(tool, "get_horizon", lambda _: horizon)
    await tool.set_extra_arguments(ctx)
    with pytest.raises(asyncio.CancelledError):
        await tool.execute(ctx, AskUserParams(questions=ctx.arguments["questions"]))


@pytest.mark.asyncio
async def test_preparation_failure_cannot_reuse_ready_questionnaire(tool, monkeypatch):
    """准备操作读取或绑定失败时，不能继续使用此前可答列表。"""
    from types import SimpleNamespace
    from app.service.prepared_operation_confirmation import PreparedOperationConfirmation

    confirmation = Mock()
    confirmation.read = AsyncMock(return_value=SimpleNamespace(question="Mock confirmation?"))
    confirmation.bind = AsyncMock()
    monkeypatch.setattr(PreparedOperationConfirmation, "from_tool", classmethod(lambda cls, _: confirmation))
    registered = AsyncMock(return_value=ToolResult(content="waiting"))
    monkeypatch.setattr(BaseUserToolCallTool, "execute", registered)
    ctx = context("")
    ctx.arguments["prepared_tool_call_id"] = "mock-prepare"
    await tool.set_extra_arguments(ctx)
    confirmation.read.side_effect = RuntimeError("Mock unavailable snapshot")
    with pytest.raises(RuntimeError):
        await tool.set_extra_arguments(ctx)
    assert await tool.get_before_tool_detail(ctx, ctx.arguments) is None
    result = await tool.execute(ctx, AskUserParams(prepared_tool_call_id="mock-prepare"))
    assert not result.ok and "execution permissions" in result.content
    registered.assert_not_awaited()
