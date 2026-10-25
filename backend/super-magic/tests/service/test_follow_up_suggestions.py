"""追加问题生成的触发、解析和单次模型调用。"""

import asyncio
from types import SimpleNamespace

import pytest

from app.path_manager import PathManager
from agentlang.chat_history.chat_history_models import UserMessage

from agentlang.event.data import (
    AfterAgentLoopEventData,
    AfterMainAgentRunEventData,
    AgentLoopOutcome,
    BeforeMainAgentRunEventData,
    resolve_completed_loop_outcome,
)
from agentlang.event.event import Event, EventType
from agentlang.llms.factory import LLMClientConfig, LLMFactory
from app.core.entity.message.personal_preferences import PersonalPreferences
from app.service.follow_up_suggestion.listener import FollowUpSuggestionListener
from app.service.follow_up_suggestion.prompts import (
    FOLLOW_UP_SYSTEM_PROMPT,
    RESULT_TOOL_NAME,
    SUBMIT_FOLLOW_UP_SUGGESTIONS_TOOL,
)
from app.service.follow_up_suggestion.service import (
    STATUS_DONE,
    STATUS_FAILED,
    STATUS_GENERATING,
    FollowUpGenerationError,
    FollowUpGenerationJob,
    FollowUpSuggestionService,
    parse_follow_up_arguments,
)
from app.service.follow_up_suggestion.store import (
    STATUS_DONE as STORE_STATUS_DONE,
    STATUS_FAILED as STORE_STATUS_FAILED,
    STATUS_GENERATING as STORE_STATUS_GENERATING,
    FollowUpSuggestionStore,
)
from app.infrastructure.sdk.magic_service.kernel.magic_service_parameter import MagicServiceAuthConfig
from app.infrastructure.sdk.magic_service.result.follow_up_suggestion_result import FollowUpSuggestionResult


@pytest.fixture(autouse=True)
def isolate_follow_up_runtime(monkeypatch, tmp_path):
    """避免单测把追加问题写进项目自己的 .runtime。"""
    runtime = tmp_path / ".runtime"
    runtime.mkdir()
    monkeypatch.setattr(PathManager, "get_runtime_dir", classmethod(lambda cls: runtime))
    monkeypatch.setattr(
        "app.service.follow_up_suggestion.store.trigger_opportunistic_cleanup",
        lambda *_args, **_kwargs: None,
    )
    return runtime


def test_explicit_false_follow_up_preference_is_preserved():
    preferences = PersonalPreferences(show_follow_up_suggestions=False)

    assert preferences.show_follow_up_suggestions is False


@pytest.mark.parametrize("value", [None, "false", 0])
def test_invalid_follow_up_preference_defaults_enabled(value):
    preferences = PersonalPreferences(show_follow_up_suggestions=value)

    assert preferences.show_follow_up_suggestions is True


def test_completed_loop_outcome_priority():
    assert resolve_completed_loop_outcome(
        restored=True,
        waiting_for_user=True,
        maintenance=True,
    ) == AgentLoopOutcome.WAITING_FOR_USER
    assert resolve_completed_loop_outcome(
        restored=True,
        waiting_for_user=False,
        maintenance=True,
    ) == AgentLoopOutcome.MAINTENANCE
    assert resolve_completed_loop_outcome(
        restored=True,
        waiting_for_user=False,
        maintenance=False,
    ) == AgentLoopOutcome.RESTORED
    assert resolve_completed_loop_outcome(
        restored=False,
        waiting_for_user=False,
        maintenance=False,
    ) == AgentLoopOutcome.NORMAL


def test_parse_follow_up_arguments_cleans_blank_and_duplicate_items():
    assert parse_follow_up_arguments(
        '{"suggestions":[" 继续 ", "", "继续"]}'
    ) == ["继续"]


def test_model_prompt_asks_for_three_items_of_200_characters():
    suggestions = SUBMIT_FOLLOW_UP_SUGGESTIONS_TOOL["function"]["parameters"]["properties"]["suggestions"]

    assert "Prefer three questions." in FOLLOW_UP_SYSTEM_PROMPT
    assert suggestions["maxItems"] == 3
    assert suggestions["items"]["maxLength"] == 200


def test_parse_follow_up_arguments_skips_overlong_items_and_keeps_five():
    long_item = "问" * 201
    assert parse_follow_up_arguments(
        '{"suggestions":["一","' + long_item + '","二","三","四","五","六"]}'
    ) == ["一", "二", "三", "四", "五"]
    assert parse_follow_up_arguments(
        '{"suggestions":["' + long_item + '"]}'
    ) == []


class _RecordingService:
    def __init__(self):
        self.reasons = []

    async def generate(self, job):
        self.reasons.append(job)


def _context(task_id="100", enabled=True, state_holder=None):
    holder = state_holder if state_holder is not None else {}

    class Context:
        def __init__(self):
            self.cleanups = {}
            self.chat_history = SimpleNamespace(get_message_snapshot=lambda: (UserMessage(content="hello"),))

        def is_main_agent_context(self):
            return True

        def is_subagent_context(self):
            return False

        def get_task_id(self):
            return task_id

        def get_personal_preferences(self):
            return PersonalPreferences(show_follow_up_suggestions=enabled)

        def register_run_cleanup(self, key, handler):
            self.cleanups[key] = handler

        def get_chat_client_message(self):
            return SimpleNamespace(metadata=SimpleNamespace(
                user_id="user-1",
                organization_code="org-1",
                authorization="secret-token",
                topic_id="topic-1",
                chat_topic_id="chat-1",
                language="zh_CN",
            ))

    context = Context()
    holder["context"] = context
    return context


def _loop_event(context, index, effective, outcome):
    return Event(
        EventType.AFTER_AGENT_LOOP,
        AfterAgentLoopEventData.model_construct(
            agent_context=context,
            agent_name="main",
            loop_index=index,
            effective_loop_count=effective,
            outcome=outcome,
        ),
    )


def _before_event(context):
    return Event(
        EventType.BEFORE_MAIN_AGENT_RUN,
        BeforeMainAgentRunEventData.model_construct(
            agent_context=context,
            agent_name="main",
            query="q",
        ),
    )


def _after_event(context, agent_state):
    return Event(
        EventType.AFTER_MAIN_AGENT_RUN,
        AfterMainAgentRunEventData.model_construct(
            agent_context=context,
            agent_name="main",
            agent_state=agent_state,
            query="q",
        ),
    )


def test_listener_submits_once_at_threshold_and_ignores_duplicate_finish():
    service = _RecordingService()
    listener = FollowUpSuggestionListener(service)
    listener._min_effective_loops = lambda: 2
    listener._build_job = lambda context, reason: reason
    context = _context()

    async def scenario():
        await listener._handle_before_main_agent_run(_before_event(context))
        await listener._handle_after_agent_loop(_loop_event(context, 1, 1, AgentLoopOutcome.NORMAL))
        assert service.reasons == []
        await listener._handle_after_agent_loop(_loop_event(context, 2, 2, AgentLoopOutcome.NORMAL))
        await listener._background_task
        await listener._handle_after_agent_loop(_loop_event(context, 2, 2, AgentLoopOutcome.NORMAL))
        await listener._handle_after_main_agent_run(_after_event(context, "finished"))

    asyncio.run(scenario())
    assert service.reasons == ["threshold"]


def test_listener_finished_before_threshold_submits_and_waiting_does_not():
    service = _RecordingService()
    listener = FollowUpSuggestionListener(service)
    listener._min_effective_loops = lambda: 5
    listener._build_job = lambda context, reason: reason
    context = _context()

    async def scenario():
        await listener._handle_after_agent_loop(
            _loop_event(context, 1, 0, AgentLoopOutcome.WAITING_FOR_USER)
        )
        await listener._handle_after_main_agent_run(_after_event(context, "waiting_for_user"))
        assert service.reasons == []
        await listener._handle_after_main_agent_run(_after_event(context, "finished"))
        await listener._background_task

    asyncio.run(scenario())
    assert service.reasons == ["finished"]


def test_build_job_fills_missing_chat_identity_from_init_message():
    listener = FollowUpSuggestionListener()
    listener._snapshot_model = lambda: SimpleNamespace()
    context = _context()
    context.get_chat_client_message = lambda: SimpleNamespace(metadata=SimpleNamespace(
        user_id="",
        organization_code=None,
        authorization=None,
    ))
    context.get_init_client_message_metadata = lambda: SimpleNamespace(
        user_id="init-user",
        organization_code="init-org",
        authorization="init-token",
    )

    job = listener._build_job(context, "finished")

    assert job.auth_config.user_id == "init-user"
    assert job.auth_config.organization_code == "init-org"
    assert job.auth_config.user_authorization == "init-token"


def test_build_job_keeps_chat_identity_when_present():
    listener = FollowUpSuggestionListener()
    listener._snapshot_model = lambda: SimpleNamespace()
    context = _context()
    context.get_init_client_message_metadata = lambda: SimpleNamespace(
        user_id="init-user",
        organization_code="init-org",
        authorization="init-token",
    )

    job = listener._build_job(context, "finished")

    assert job.auth_config.user_id == "user-1"
    assert job.auth_config.organization_code == "org-1"
    assert job.auth_config.user_authorization == "secret-token"


def test_build_job_still_fails_when_both_identities_are_missing():
    listener = FollowUpSuggestionListener()
    context = _context()
    context.get_chat_client_message = lambda: SimpleNamespace(metadata=SimpleNamespace(
        user_id="",
        organization_code="",
        authorization="",
    ))
    context.get_init_client_message_metadata = lambda: None

    with pytest.raises(FollowUpGenerationError) as error:
        listener._build_job(context, "finished")

    assert error.value.category == "identity_incomplete"


def test_listener_disabled_preference_does_not_submit():
    service = _RecordingService()
    listener = FollowUpSuggestionListener(service)
    listener._min_effective_loops = lambda: 1
    listener._build_job = lambda context, reason: reason
    context = _context(enabled=False)

    async def scenario():
        await listener._handle_after_agent_loop(_loop_event(context, 1, 1, AgentLoopOutcome.NORMAL))
        await listener._handle_after_main_agent_run(_after_event(context, "finished"))

    asyncio.run(scenario())
    assert service.reasons == []


def _job():
    return FollowUpGenerationJob(
        task_id="100",
        trigger_reason="threshold",
        reference_context='{"current_request": "hello", "task_state": "in_progress"}',
        auth_config=MagicServiceAuthConfig(
            user_id="user-1",
            organization_code="org-1",
            user_authorization="secret-token",
        ),
        llm_config=LLMClientConfig(
            model_id="deepseek-v4-flash",
            api_key="test-key",
            name="deepseek-v4-flash",
            provider="test",
            supports_tool_use=True,
            extra_params={"tool_choice": "required", "n": 3},
        ),
        model_timeout_seconds=60,
        report_timeout_seconds=5,
    )


def _completion(arguments):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(tool_calls=[
        SimpleNamespace(function=SimpleNamespace(name=RESULT_TOOL_NAME, arguments=arguments))
    ]))])


def test_service_calls_model_once_and_keeps_credentials_out_of_prompt(monkeypatch):
    calls = []
    reports = []

    async def fake_call(**kwargs):
        calls.append(kwargs)
        return _completion('{"suggestions":["下一步"]}')

    class FakeApi:
        async def report_async(self, parameter):
            reports.append(parameter.to_body())
            status = STATUS_GENERATING if parameter.status == STATUS_GENERATING else parameter.status
            return FollowUpSuggestionResult({
                "type": 1,
                "relation_id": "100",
                "status": status,
                "suggestions": parameter.suggestions or [],
            })

    monkeypatch.setattr(LLMFactory, "call_with_tool_support", fake_call)
    monkeypatch.setattr(
        "app.service.follow_up_suggestion.service.create_magic_service_sdk",
        lambda **kwargs: SimpleNamespace(follow_up_suggestion=FakeApi()),
    )

    asyncio.run(FollowUpSuggestionService().generate(_job()))

    assert len(calls) == 1
    assert calls[0]["agent_context"] is None
    assert calls[0]["enable_llm_response_events"] is False
    assert calls[0]["processor_config"].use_stream_mode is False
    assert "secret-token" not in calls[0]["messages"][1]["content"]
    assert [item["status"] for item in reports] == [STATUS_GENERATING, STATUS_DONE]


def test_service_does_not_call_model_again_after_invalid_output(monkeypatch):
    calls = []
    reports = []

    async def fake_call(**kwargs):
        calls.append(kwargs)
        return _completion("not-json")

    class FakeApi:
        async def report_async(self, parameter):
            reports.append(parameter.status)
            return FollowUpSuggestionResult({
                "type": 1,
                "relation_id": "100",
                "status": STATUS_GENERATING if parameter.status == STATUS_GENERATING else parameter.status,
                "suggestions": [],
            })

    monkeypatch.setattr(LLMFactory, "call_with_tool_support", fake_call)
    monkeypatch.setattr(
        "app.service.follow_up_suggestion.service.create_magic_service_sdk",
        lambda **kwargs: SimpleNamespace(follow_up_suggestion=FakeApi()),
    )

    asyncio.run(FollowUpSuggestionService().generate(_job()))

    assert len(calls) == 1
    assert reports == [STATUS_GENERATING, STATUS_FAILED]


def test_service_skips_model_when_storage_is_already_terminal(monkeypatch):
    calls = []

    async def fake_call(**kwargs):
        calls.append(kwargs)
        return _completion('{"suggestions":["下一步"]}')

    class FakeApi:
        async def report_async(self, parameter):
            return FollowUpSuggestionResult({
                "type": 1,
                "relation_id": "100",
                "status": STATUS_DONE,
                "suggestions": ["已有"],
            })

    monkeypatch.setattr(LLMFactory, "call_with_tool_support", fake_call)
    monkeypatch.setattr(
        "app.service.follow_up_suggestion.service.create_magic_service_sdk",
        lambda **kwargs: SimpleNamespace(follow_up_suggestion=FakeApi()),
    )

    asyncio.run(FollowUpSuggestionService().generate(_job()))

    record = asyncio.run(FollowUpSuggestionStore().load("100"))
    assert calls == []
    assert record is not None
    assert record.status == STATUS_DONE
    assert record.suggestions == ["已有"]


def test_store_status_matches_report_status():
    assert STORE_STATUS_GENERATING == STATUS_GENERATING
    assert STORE_STATUS_DONE == STATUS_DONE
    assert STORE_STATUS_FAILED == STATUS_FAILED


def test_store_keeps_terminal_file_and_query_waits_when_missing(isolate_follow_up_runtime):
    store = FollowUpSuggestionStore()

    async def scenario():
        missing = await store.query("100")
        assert missing == {"status": STATUS_GENERATING, "suggestions": []}
        assert await store.query("../100") is None
        saved = await store.save("100", STATUS_DONE, ["已有"])
        kept = await store.save("100", STATUS_GENERATING, ["新的"])
        loaded = await store.load("100")
        return saved, kept, loaded

    saved, kept, loaded = asyncio.run(scenario())
    assert saved is not None and saved.suggestions == ["已有"]
    assert kept is not None and kept.status == STATUS_DONE and kept.suggestions == ["已有"]
    assert loaded is not None and loaded.suggestions == ["已有"]
    assert (isolate_follow_up_runtime / "follow_up_suggestions" / "100.json").is_file()


def test_service_writes_local_file_and_still_reports(monkeypatch, isolate_follow_up_runtime):
    reports = []

    async def fake_call(**_kwargs):
        return _completion('{"suggestions":["下一步"]}')

    class FakeApi:
        async def report_async(self, parameter):
            reports.append(parameter.to_body())
            return FollowUpSuggestionResult({
                "type": 1,
                "relation_id": "100",
                "status": STATUS_GENERATING if parameter.status == STATUS_GENERATING else parameter.status,
                "suggestions": parameter.suggestions or [],
            })

    monkeypatch.setattr(LLMFactory, "call_with_tool_support", fake_call)
    monkeypatch.setattr(
        "app.service.follow_up_suggestion.service.create_magic_service_sdk",
        lambda **kwargs: SimpleNamespace(follow_up_suggestion=FakeApi()),
    )
    monkeypatch.setattr(
        "app.service.follow_up_suggestion.service.is_local_debug_mode_enabled",
        lambda: False,
    )

    asyncio.run(FollowUpSuggestionService().generate(_job()))

    record = asyncio.run(FollowUpSuggestionStore().load("100"))
    assert [item["status"] for item in reports] == [STATUS_GENERATING, STATUS_DONE]
    assert record is not None
    assert record.status == STATUS_DONE
    assert record.suggestions == ["下一步"]
    assert isolate_follow_up_runtime == PathManager.get_runtime_dir()


def test_report_done_failure_log_keeps_elapsed_and_count(monkeypatch):
    messages = []

    async def fake_call(**_kwargs):
        return _completion('{"suggestions":["本地问题"]}')

    class FakeApi:
        async def report_async(self, parameter):
            if parameter.status == STATUS_DONE:
                raise RuntimeError("magic-service unavailable")
            return FollowUpSuggestionResult({
                "type": 1,
                "relation_id": "100",
                "status": STATUS_GENERATING,
                "suggestions": [],
            })

    monkeypatch.setattr(LLMFactory, "call_with_tool_support", fake_call)
    monkeypatch.setattr(
        "app.service.follow_up_suggestion.service.create_magic_service_sdk",
        lambda **kwargs: SimpleNamespace(follow_up_suggestion=FakeApi()),
    )
    monkeypatch.setattr(
        "app.service.follow_up_suggestion.service.logger.info",
        lambda message: messages.append(message),
    )

    asyncio.run(FollowUpSuggestionService().generate(_job()))

    done_logs = [message for message in messages if "state=report_done_failed" in message]
    assert len(done_logs) == 1
    assert "status=1" in done_logs[0]
    assert "count=1" in done_logs[0]
    assert "elapsed=" in done_logs[0]
    assert "elapsed=0.000" not in done_logs[0]
    assert "category=RuntimeError" in done_logs[0]


def test_local_debug_still_generates_when_report_fails(monkeypatch):
    calls = []

    async def fake_call(**_kwargs):
        calls.append(1)
        return _completion('{"suggestions":["本地问题"]}')

    class FakeApi:
        async def report_async(self, _parameter):
            raise RuntimeError("magic-service unavailable")

    monkeypatch.setattr(LLMFactory, "call_with_tool_support", fake_call)
    monkeypatch.setattr(
        "app.service.follow_up_suggestion.service.create_magic_service_sdk",
        lambda **kwargs: SimpleNamespace(follow_up_suggestion=FakeApi()),
    )
    monkeypatch.setattr(
        "app.service.follow_up_suggestion.service.is_local_debug_mode_enabled",
        lambda: True,
    )

    asyncio.run(FollowUpSuggestionService().generate(_job()))

    record = asyncio.run(FollowUpSuggestionStore().load("100"))
    assert calls == [1]
    assert record is not None
    assert record.status == STATUS_DONE
    assert record.suggestions == ["本地问题"]


def test_production_report_failure_does_not_call_model(monkeypatch):
    calls = []

    async def fake_call(**_kwargs):
        calls.append(1)
        return _completion('{"suggestions":["不该出现"]}')

    class FakeApi:
        async def report_async(self, _parameter):
            raise RuntimeError("magic-service unavailable")

    monkeypatch.setattr(LLMFactory, "call_with_tool_support", fake_call)
    monkeypatch.setattr(
        "app.service.follow_up_suggestion.service.create_magic_service_sdk",
        lambda **kwargs: SimpleNamespace(follow_up_suggestion=FakeApi()),
    )
    monkeypatch.setattr(
        "app.service.follow_up_suggestion.service.is_local_debug_mode_enabled",
        lambda: False,
    )

    asyncio.run(FollowUpSuggestionService().generate(_job()))

    record = asyncio.run(FollowUpSuggestionStore().load("100"))
    assert calls == []
    assert record is None


def test_job_reference_is_detached_from_history_and_preserves_event_query():
    """快照之后的历史变化不污染后台任务，运行事件保存当前诉求。"""
    import json

    listener = FollowUpSuggestionListener()
    listener._snapshot_model = lambda: SimpleNamespace()
    context = _context()
    message = UserMessage(content="Mock original request")
    context.chat_history = SimpleNamespace(get_message_snapshot=lambda: (message,))
    event = _before_event(context)
    event.data.query = "Mock active request"
    asyncio.run(listener._handle_before_main_agent_run(event))
    job = listener._build_job(context, "threshold")
    message.content = "Changed after snapshot"
    reference = json.loads(job.reference_context)
    assert reference["current_request"] == "Mock active request"
    assert reference["task_state"] == "in_progress"
    assert "Changed after snapshot" not in job.reference_context


def test_model_output_constraint_does_not_mutate_job_config(monkeypatch):
    """指定唯一提交工具，同时保留原快照配置供其他消费者使用。"""
    calls = []

    async def fake_call(**kwargs):
        """记录模型参数并返回合法的虚构推荐问题。"""
        calls.append(kwargs)
        return _completion('{"suggestions":["Mock next question?"]}')

    monkeypatch.setattr(LLMFactory, "call_with_tool_support", fake_call)
    job = _job()
    asyncio.run(FollowUpSuggestionService()._request_model(job))
    assert calls[0]["llm_config"].extra_params["tool_choice"] == {
        "type": "function", "function": {"name": RESULT_TOOL_NAME},
    }
    assert job.llm_config.extra_params["tool_choice"] == "required"
    assert calls[0]["messages"][1]["content"].startswith(job.reference_context)
    assert calls[0]["messages"][1]["content"].endswith("Submit only the result tool call.")


def test_default_threshold_waits_for_ten_effective_iterations(monkeypatch):
    """默认在第十个有效循环触发，第五到第九个循环不会提前提交。"""
    monkeypatch.setattr(
        "app.service.follow_up_suggestion.listener.config.get",
        lambda _key, default=None: default,
    )
    service = _RecordingService()
    listener = FollowUpSuggestionListener(service)
    listener._build_job = lambda _context, reason: reason
    context = _context()

    async def scenario():
        """模拟有效循环计数，不执行真实模型或工具。"""
        await listener._handle_before_main_agent_run(_before_event(context))
        for index in range(1, 10):
            await listener._handle_after_agent_loop(_loop_event(context, index, index, AgentLoopOutcome.NORMAL))
            assert listener._background_task is None
        await listener._handle_after_agent_loop(_loop_event(context, 10, 10, AgentLoopOutcome.NORMAL))
        await listener._background_task

    asyncio.run(scenario())
    assert listener._min_effective_loops() == 10
    assert service.reasons == ["threshold"]


@pytest.mark.parametrize("outcome", ["success", "model_failure", "cancelled", "skip", "report_failure"])
def test_generation_logs_distinguish_lifecycle_model_and_reporting(monkeypatch, outcome):
    """开始与结束成对，模型成功、失败、取消、跳过及上报失败具有独立语义。"""
    from unittest.mock import AsyncMock

    logs = []
    store = SimpleNamespace(load=AsyncMock(return_value=None), save=AsyncMock())
    if outcome == "skip":
        store.load.return_value = SimpleNamespace(status=STATUS_DONE)
    service = FollowUpSuggestionService(store)
    service._report = AsyncMock(return_value=FollowUpSuggestionResult({
        "type": 1, "relation_id": "100", "status": STATUS_GENERATING, "suggestions": [],
    }))
    service._request_model = AsyncMock(return_value=["Mock next question?"])
    if outcome == "model_failure":
        service._request_model.side_effect = FollowUpGenerationError("missing_tool_call")
    elif outcome == "cancelled":
        service._request_model.side_effect = asyncio.CancelledError()
    elif outcome == "report_failure":
        service._report.side_effect = [
            FollowUpSuggestionResult({"type": 1, "relation_id": "100", "status": STATUS_GENERATING}),
            RuntimeError("mock reporting failure"),
        ]
    monkeypatch.setattr("app.service.follow_up_suggestion.service.logger.info", logs.append)

    if outcome == "cancelled":
        with pytest.raises(asyncio.CancelledError):
            asyncio.run(service.generate(_job()))
    else:
        asyncio.run(service.generate(_job()))

    assert logs[0].startswith("追加问题处理开始 ")
    assert logs[-1].startswith("追加问题处理结束 ")
    assert sum("state=started " in entry for entry in logs) == 1
    assert sum("state=finished " in entry for entry in logs) == 1
    assert all("追加问题生成结束" not in entry for entry in logs)
    expected = {
        "success": "追加问题生成成功",
        "model_failure": "追加问题生成失败",
        "cancelled": "追加问题处理已取消",
        "skip": "追加问题跳过生成：本地已有终态",
        "report_failure": "追加问题生成结果上报失败",
    }
    assert any(entry.startswith(expected[outcome]) for entry in logs)
    if outcome == "report_failure":
        success_index = next(index for index, entry in enumerate(logs) if entry.startswith("追加问题生成成功"))
        report_index = next(index for index, entry in enumerate(logs) if entry.startswith("追加问题生成结果上报失败"))
        assert success_index < report_index
        assert not any(entry.startswith("追加问题生成失败") for entry in logs)
    if outcome == "skip":
        service._request_model.assert_not_called()
        assert not any("state=model_started " in entry for entry in logs)
