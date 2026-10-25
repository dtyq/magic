import asyncio
import json
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from agentlang.context.tool_context import ToolContext
from app.tools import persona_chat as persona_chat_module
from app.tools.persona_chat import PersonaChat, PersonaChatParams
from app.tools.persona_research import semantic_checks


def _write_persona(root, persona_id, name, demographics=None):
    path = root / "personas" / f"{persona_id}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    profile = {"schema_version": 1, "id": persona_id, "name": name, "tier": "generated"}
    if demographics:
        profile["dimensions"] = {"demographics": demographics}
    path.write_text(json.dumps(profile), encoding="utf-8")
    return f"personas/{persona_id}.json"


def _response(text):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=text))])


class _FakeLLM:
    """记录每次调用的消息，并按人设名决定成功或失败。"""

    def __init__(self, failing_names=(), block=None):
        self.failing_names = set(failing_names)
        self.block = block
        self.calls = []
        self.configs = []

    def get_model_config(self, model_id):
        config = SimpleNamespace(model_id=model_id, max_output_tokens=4096)
        config.model_copy = lambda deep=True: SimpleNamespace(model_id=model_id, max_output_tokens=4096)
        return config

    async def call_with_tool_support(self, *, model_id, messages, llm_config, **kwargs):
        self.calls.append({"model_id": model_id, "messages": messages})
        self.configs.append(llm_config)
        if self.block is not None:
            await self.block.wait()
        user_prompt = messages[-1]["content"]
        name = user_prompt.rsplit("Now answer as ", 1)[-1].rstrip(".")
        if name in self.failing_names:
            raise RuntimeError(f"upstream provider 500 at internal-host for {name}")
        return _response(f"{name} answer")


@pytest.fixture
def fake_llm(monkeypatch):
    fake = _FakeLLM()
    monkeypatch.setattr(persona_chat_module, "LLMFactory", fake)
    monkeypatch.setattr(semantic_checks, "LLMFactory", fake)
    monkeypatch.setattr(semantic_checks, "get_ability_config", lambda *args, **kwargs: None)
    return fake


@pytest.fixture
def tool(tmp_path):
    return PersonaChat(base_dir=tmp_path)


def test_max_tokens_is_clamped_to_cost_limits():
    assert PersonaChatParams(persona_paths=["a.json"], question="q").max_tokens == 400
    assert PersonaChatParams(persona_paths=["a.json"], question="q", max_tokens=5000).max_tokens == 800
    assert PersonaChatParams(persona_paths=["a.json"], question="q", max_tokens=1).max_tokens == 100


def test_persona_count_must_be_between_one_and_six():
    with pytest.raises(ValidationError):
        PersonaChatParams(persona_paths=[], question="q")
    with pytest.raises(ValidationError):
        PersonaChatParams(persona_paths=[f"p{i}.json" for i in range(7)], question="q")


async def test_interview_answer_falls_back_to_auto_model_and_token_limit(tool, tmp_path, fake_llm):
    path = _write_persona(tmp_path, "p_zhang_1a2b", "Zhang")

    result = await tool.execute(
        ToolContext(), PersonaChatParams(persona_paths=[path], question="Why?", max_tokens=600)
    )

    assert result.ok is True
    assert result.data == {
        "answers": [{"persona_id": "p_zhang_1a2b", "name": "Zhang", "text": "Zhang answer", "gender": "", "age": ""}],
        "failed": [],
    }
    assert "1 of 1 succeeded" in result.content
    assert "Zhang answer" in result.content
    assert fake_llm.calls[0]["model_id"] == "auto"
    assert fake_llm.configs[0].max_output_tokens == 600
    assert "one-on-one interview" in fake_llm.calls[0]["messages"][0]["content"]


async def test_interview_follows_current_text_model_when_unconfigured(tool, tmp_path, fake_llm):
    """未配置专属模型时用当前对话模型，避免 auto 不在用户套餐内导致访谈全部失败。"""
    path = _write_persona(tmp_path, "p_zhang_1a2b", "Zhang")
    tool_context = ToolContext()
    tool_context.register_extension(
        "agent_context",
        SimpleNamespace(
            model_context=SimpleNamespace(current_text_model_id="user-chosen-model"),
            get_interruption_event=lambda: None,
        ),
    )

    result = await tool.execute(tool_context, PersonaChatParams(persona_paths=[path], question="Why?"))

    assert result.ok is True
    assert fake_llm.calls[0]["model_id"] == "user-chosen-model"


async def test_configured_model_wins_over_current_text_model(tool, tmp_path, fake_llm, monkeypatch):
    monkeypatch.setattr(semantic_checks, "get_ability_config", lambda *args, **kwargs: "persona-model")
    path = _write_persona(tmp_path, "p_zhang_1a2b", "Zhang")
    tool_context = ToolContext()
    tool_context.register_extension(
        "agent_context",
        SimpleNamespace(
            model_context=SimpleNamespace(current_text_model_id="user-chosen-model"),
            get_interruption_event=lambda: None,
        ),
    )

    await tool.execute(tool_context, PersonaChatParams(persona_paths=[path], question="Why?"))

    assert fake_llm.calls[0]["model_id"] == "persona-model"


async def test_persona_prompt_sets_cautious_baseline(tool, tmp_path, fake_llm):
    """受访者默认对新产品谨慎，不买、不换、不关心都是正常回答，避免讨好式夸赞。"""
    path = _write_persona(tmp_path, "p_zhang_1a2b", "Zhang")

    await tool.execute(ToolContext(), PersonaChatParams(persona_paths=[path], question="Would you buy it?"))

    system_prompt = fake_llm.calls[0]["messages"][0]["content"]
    assert "skeptical by default" in system_prompt
    assert "Not buying, not switching, or not caring is a normal answer" in system_prompt
    assert "Do not praise an idea to be polite" in system_prompt


@pytest.mark.parametrize("bad_path", ["../outside.json", "/etc/passwd"])
async def test_paths_outside_workspace_are_rejected(tool, tmp_path, fake_llm, bad_path):
    result = await tool.execute(ToolContext(), PersonaChatParams(persona_paths=[bad_path], question="q"))

    assert result.ok is False
    assert "outside the workspace" in result.content
    assert fake_llm.calls == []
    detail = await tool.get_tool_detail(ToolContext(), result, {"question": "q"})
    assert detail is not None
    assert detail.data.question == "q"
    assert detail.data.error and "outside" not in detail.data.error
    assert detail.data.error_reason == "invalid_request"


async def test_transcript_path_outside_workspace_is_rejected(tool, tmp_path, fake_llm):
    path = _write_persona(tmp_path, "p_zhang_1a2b", "Zhang")

    result = await tool.execute(
        ToolContext(),
        PersonaChatParams(persona_paths=[path], question="q", transcript_path="../../transcript.json"),
    )

    assert result.ok is False
    assert fake_llm.calls == []


async def test_focus_group_partial_failure_keeps_successful_answers(tool, tmp_path, fake_llm):
    fake_llm.failing_names = {"Li"}
    paths = [
        _write_persona(tmp_path, "p_zhang_1a2b", "Zhang", {"gender": "女", "age": 32}),
        _write_persona(tmp_path, "p_li_3c4d", "Li"),
        _write_persona(tmp_path, "p_wang_5e6f", "Wang"),
    ]

    result = await tool.execute(ToolContext(), PersonaChatParams(persona_paths=paths, question="Price?"))

    assert result.ok is False
    assert [answer["persona_id"] for answer in result.data["answers"]] == ["p_zhang_1a2b", "p_wang_5e6f"]
    assert result.data["failed"] == [{
        "persona_id": "p_li_3c4d", "name": "Li", "path": "personas/p_li_3c4d.json", "reason": "model_error",
        "gender": "", "age": "",
    }]
    assert "2 of 3 succeeded" in result.content
    assert "p_li_3c4d" in result.content and "upstream provider 500" in result.content
    # 焦点小组按顺序回答：后发言者能看到本轮前面的回答。
    wang_prompt = fake_llm.calls[2]["messages"][-1]["content"]
    assert "Zhang: Zhang answer" in wang_prompt
    assert "focus group" in fake_llm.calls[2]["messages"][0]["content"]

    detail = await tool.get_tool_detail(ToolContext(), result, {"question": "Price?"})
    assert detail.type == "persona_chat"
    assert detail.data.error == "" and detail.data.error_reason == ""
    assert detail.data.question == "Price?"
    assert [(a.name, a.text, a.gender, a.age) for a in detail.data.answers] == [
        ("Zhang", "Zhang answer", "女", "32"),
        ("Wang", "Wang answer", "", ""),
    ]
    # 失败原因展示给用户：已翻译、脱敏，不带上游报错原文。
    assert [f.name for f in detail.data.failed] == ["Li"]
    assert "upstream" not in detail.data.failed[0].reason
    assert detail.data.round_number is None and not detail.data.error
    remark = await tool.get_after_tool_call_friendly_action_and_remark("persona_chat", ToolContext(), result, 0)
    assert remark["remark"]
    assert "upstream" not in remark["remark"]


async def test_missing_persona_file_is_reported_without_model_call(tool, tmp_path, fake_llm):
    (tmp_path / "personas").mkdir()

    result = await tool.execute(
        ToolContext(), PersonaChatParams(persona_paths=["personas/p_none_0000.json"], question="q")
    )

    assert result.ok is False
    assert result.data["answers"] == []
    assert result.data["failed"][0]["reason"] == "profile_unavailable"
    assert fake_llm.calls == []
    detail = await tool.get_tool_detail(ToolContext(), result, {"question": "q"})
    assert [(f.persona_id, f.name) for f in detail.data.failed] == [("p_none_0000", "p_none_0000")]
    assert detail.data.failed[0].reason


INTERVIEW = "studies/s-1a2b/interviews/p_zhang_1a2b.json"
DISCUSSION = "studies/s-1a2b/discussions/fg_price_9d20.json"


def _read(root, rel):
    return json.loads((root / rel).read_text(encoding="utf-8"))


def _ask(path, question, round_number, transcript=INTERVIEW):
    paths = path if isinstance(path, list) else [path]
    return PersonaChatParams(persona_paths=paths, question=question, transcript_path=transcript, round_number=round_number)


async def test_first_round_creates_transcript_and_reports_round_indexes(tool, tmp_path, fake_llm):
    path = _write_persona(tmp_path, "p_zhang_1a2b", "Zhang")

    result = await tool.execute(ToolContext(), _ask(path, "q1", 1))

    assert result.ok is True
    assert result.data["round_indexes"] == [0, 1]
    assert "Recorded round 1" in result.content
    detail = await tool.get_tool_detail(ToolContext(), result, {"question": "q1"})
    assert (detail.data.round_number, detail.data.round_limit) == (1, 20)
    assert _read(tmp_path, INTERVIEW) == {
        "schema_version": 1, "persona_id": "p_zhang_1a2b", "status": "running", "error": "",
        "rounds": [{"role": "moderator", "text": "q1"}, {"role": "persona", "text": "Zhang answer"}],
        "summary": "", "key_findings": [], "quotes": [],
    }


async def test_user_chat_can_continue_after_automatic_budget_and_retries_are_idempotent(tool, tmp_path, fake_llm):
    path = _write_persona(tmp_path, "p_zhang_1a2b", "Zhang")
    for number in range(1, 21):
        assert (await tool.execute(ToolContext(), _ask(path, f"question {number}", number))).ok
    # 自动访谈仍被限制；用户的一条消息获得一条回答，不重跑整项研究。
    assert not (await tool.execute(ToolContext(), _ask(path, "automatic extra", 21))).ok
    request = _ask(path, "Would it help? Why?", 21)
    request.follow_up_request_id = "user-chat-1"
    first = await tool.execute(ToolContext(), request)
    assert first.ok
    data = _read(tmp_path, INTERVIEW)
    assert data["status"] == "done"
    assert data["insights_outdated"] is True
    assert data["rounds"][-2] == {
        "role": "moderator", "text": "Would it help? Why?", "source": "user", "request_id": "user-chat-1"
    }
    assert data["rounds"][-1]["request_id"] == "user-chat-1"
    calls = len(fake_llm.calls)
    # Agent 即便在重试时算出了下一轮，也不能再次执行同一个请求。
    request.round_number = 22
    retry = await tool.execute(ToolContext(), request)
    assert retry.ok
    assert "already recorded" in retry.content
    assert len(fake_llm.calls) == calls
    assert _read(tmp_path, INTERVIEW) == data
    request.question = "different message"
    assert not (await tool.execute(ToolContext(), request)).ok
    assert len(fake_llm.calls) == calls


async def test_user_chat_requires_an_existing_matching_interview(tool, tmp_path, fake_llm):
    path = _write_persona(tmp_path, "p_zhang_1a2b", "Zhang")
    request = _ask(path, "follow up", 1)
    request.follow_up_request_id = "user-chat-1"
    assert not (await tool.execute(ToolContext(), request)).ok
    assert not fake_llm.calls
    await tool.execute(ToolContext(), _ask(path, "first question", 1))
    other = _write_persona(tmp_path, "p_other_1a2b", "Other")
    request.persona_paths = [other]
    request.round_number = 2
    assert not (await tool.execute(ToolContext(), request)).ok
    assert len(fake_llm.calls) == 1


async def test_failed_user_chat_does_not_write_or_consume_request_id(tool, tmp_path, fake_llm):
    path = _write_persona(tmp_path, "p_zhang_1a2b", "Zhang")
    await tool.execute(ToolContext(), _ask(path, "first question", 1))
    before = _read(tmp_path, INTERVIEW)
    fake_llm.failing_names.add("Zhang")
    request = _ask(path, "follow up", 2)
    request.follow_up_request_id = "user-chat-1"
    assert not (await tool.execute(ToolContext(), request)).ok
    assert _read(tmp_path, INTERVIEW) == before
    fake_llm.failing_names.clear()
    assert (await tool.execute(ToolContext(), request)).ok
    assert len(_read(tmp_path, INTERVIEW)["rounds"]) == 4


async def test_next_round_uses_transcript_as_context_and_appends(tool, tmp_path, fake_llm):
    path = _write_persona(tmp_path, "p_zhang_1a2b", "Zhang")
    await tool.execute(ToolContext(), _ask(path, "Earlier question", 1))

    result = await tool.execute(ToolContext(), _ask(path, "q2", 2))

    prompt = fake_llm.calls[-1]["messages"][-1]["content"]
    assert "Moderator: Earlier question" in prompt
    assert "Zhang: Zhang answer" in prompt
    assert result.data["round_indexes"] == [2, 3]
    assert len(_read(tmp_path, INTERVIEW)["rounds"]) == 4


@pytest.mark.parametrize("round_number", [0, 1, 3])
async def test_wrong_round_number_is_rejected_before_any_model_call(tool, tmp_path, fake_llm, round_number):
    """例：记录已有 1 轮时只接受 round_number=2；重试时重复传 1 不会重复写入。"""
    path = _write_persona(tmp_path, "p_zhang_1a2b", "Zhang")
    await tool.execute(ToolContext(), _ask(path, "q1", 1))
    calls = len(fake_llm.calls)

    result = await tool.execute(ToolContext(), _ask(path, "again", round_number))

    assert result.ok is False
    assert len(fake_llm.calls) == calls
    assert len(_read(tmp_path, INTERVIEW)["rounds"]) == 2


async def test_interview_file_must_be_named_after_the_persona(tool, tmp_path, fake_llm):
    path = _write_persona(tmp_path, "p_li_3c4d", "Li")

    result = await tool.execute(ToolContext(), _ask(path, "q1", 1))

    assert result.ok is False
    assert "interviews/p_li_3c4d.json" in result.content
    assert fake_llm.calls == []


async def test_round_limit_comes_from_study(tool, tmp_path, fake_llm):
    path = _write_persona(tmp_path, "p_zhang_1a2b", "Zhang")
    study = tmp_path / "studies" / "s-1a2b" / "study.json"
    study.parent.mkdir(parents=True)
    study.write_text(json.dumps({
        "schema_version": 1, "topic_id": "1", "title": "t", "question": "q", "phase": "interview",
        "phases": [{"key": k, "status": "pending"} for k in
                   ["clarify", "plan", "desk_research", "interview", "report", "validation"]],
        "limits": {"personas": 1, "interview_rounds": 1},
    }), encoding="utf-8")
    await tool.execute(ToolContext(), _ask(path, "q1", 1))

    result = await tool.execute(ToolContext(), _ask(path, "q2", 2))

    assert result.ok is False
    assert "round limit for this study is 1" in result.content
    # 上限用完后必须让调用方收尾，而不是换 round_number 重试。
    assert "Do not call persona_chat for this transcript again" in result.content
    assert "finish_persona_transcript" in result.content


async def test_focus_group_records_only_successful_answers(tool, tmp_path, fake_llm):
    fake_llm.failing_names = {"Li"}
    paths = [
        _write_persona(tmp_path, "p_zhang_1a2b", "Zhang"),
        _write_persona(tmp_path, "p_li_3c4d", "Li"),
        _write_persona(tmp_path, "p_wang_5e6f", "Wang"),
    ]

    result = await tool.execute(ToolContext(), _ask(paths, "Price?", 1, DISCUSSION))

    assert result.ok is False
    saved = _read(tmp_path, DISCUSSION)
    assert saved["participants"] == ["p_zhang_1a2b", "p_li_3c4d", "p_wang_5e6f"]
    assert saved["rounds"] == [
        {"speaker": "moderator", "text": "Price?"},
        {"speaker": "p_zhang_1a2b", "text": "Zhang answer"},
        {"speaker": "p_wang_5e6f", "text": "Wang answer"},
    ]


async def test_focus_group_saves_its_topic_once(tool, tmp_path, fake_llm):
    paths = [_write_persona(tmp_path, "p_zhang_1a2b", "Zhang"), _write_persona(tmp_path, "p_li_3c4d", "Li")]
    first = PersonaChatParams(
        persona_paths=paths, question="Price?", transcript_path=DISCUSSION, round_number=1, topic="按月付费的小家电会员"
    )
    await tool.execute(ToolContext(), first)
    # 后续轮次传别的主题也不覆盖首轮写下的主题。
    second = PersonaChatParams(
        persona_paths=paths, question="Why?", transcript_path=DISCUSSION, round_number=2, topic="另一个主题"
    )
    await tool.execute(ToolContext(), second)

    assert _read(tmp_path, DISCUSSION)["topic"] == "按月付费的小家电会员"


async def test_new_focus_group_stops_at_the_study_cap(tool, tmp_path, fake_llm, monkeypatch):
    monkeypatch.setattr(persona_chat_module, "MAX_DISCUSSIONS", 1)
    paths = [_write_persona(tmp_path, "p_zhang_1a2b", "Zhang"), _write_persona(tmp_path, "p_li_3c4d", "Li")]
    await tool.execute(ToolContext(), _ask(paths, "Price?", 1, DISCUSSION))
    second = DISCUSSION.replace(".json", "_b.json")

    result = await tool.execute(ToolContext(), _ask(paths, "Price?", 1, second))

    assert result.ok is False
    assert "the maximum is 1" in result.content
    assert not (tmp_path / second).exists()


async def test_nothing_is_recorded_when_every_answer_fails(tool, tmp_path, fake_llm):
    fake_llm.failing_names = {"Zhang"}
    path = _write_persona(tmp_path, "p_zhang_1a2b", "Zhang")

    result = await tool.execute(ToolContext(), _ask(path, "q1", 1))

    assert result.ok is False
    assert "Nothing was recorded for round 1" in result.content
    assert not (tmp_path / INTERVIEW).exists()
    # 没写进记录的一轮不显示「第 N 轮」。
    detail = await tool.get_tool_detail(ToolContext(), result, {"question": "q1"})
    assert detail.data.round_number is None and detail.data.answers == []


async def test_follow_up_reopens_a_finished_transcript(tool, tmp_path, fake_llm):
    path = _write_persona(tmp_path, "p_zhang_1a2b", "Zhang")
    await tool.execute(ToolContext(), _ask(path, "q1", 1))
    data = _read(tmp_path, INTERVIEW)
    data["status"] = "done"
    (tmp_path / INTERVIEW).write_text(json.dumps(data), encoding="utf-8")

    await tool.execute(ToolContext(), _ask(path, "follow-up", 2))

    assert _read(tmp_path, INTERVIEW)["status"] == "running"


async def test_interruption_raises_cancelled_error(tool, tmp_path, fake_llm, monkeypatch):
    path = _write_persona(tmp_path, "p_zhang_1a2b", "Zhang")
    interrupt = asyncio.Event()
    fake_llm.block = asyncio.Event()  # 模型调用一直不返回，直到被中断
    keepalive = asyncio.create_task(asyncio.sleep(30))
    monkeypatch.setattr(persona_chat_module, "start_tool_keep_alive", lambda ctx: keepalive)
    context = ToolContext()
    context.register_extension(
        "agent_context",
        SimpleNamespace(get_interruption_event=lambda: interrupt, update_activity_time=lambda: None),
    )

    pending = asyncio.create_task(tool.execute(context, PersonaChatParams(persona_paths=[path], question="q")))
    while not fake_llm.calls:
        await asyncio.sleep(0.01)
    interrupt.set()

    with pytest.raises(asyncio.CancelledError):
        await asyncio.wait_for(pending, 1)
    await asyncio.sleep(0)
    assert keepalive.cancelled()


@pytest.mark.parametrize("question", [
    "你最想先弄清楚什么？哪条规则会让你觉得亏？",
    "第一，你多久买一次；第二，花多少钱",
    "What do you buy first, and second what do you skip",
])
async def test_several_questions_in_one_round_are_rejected_without_model_call(tool, tmp_path, fake_llm, question):
    path = _write_persona(tmp_path, "p_zhang_1a2b", "Zhang")

    result = await tool.execute(ToolContext(), PersonaChatParams(persona_paths=[path], question=question))

    assert result.ok is False and "more than one thing" in result.content
    assert fake_llm.calls == []


async def test_one_question_with_a_restatement_is_allowed(tool, tmp_path, fake_llm):
    path = _write_persona(tmp_path, "p_zhang_1a2b", "Zhang")

    result = await tool.execute(ToolContext(), PersonaChatParams(
        persona_paths=[path], question="你说上次觉得有风险。具体是哪种风险？",
    ))

    assert result.ok is True


async def test_joined_question_judged_as_two_is_rejected_without_answer(tool, tmp_path, fake_llm, monkeypatch):
    path = _write_persona(tmp_path, "p_zhang_1a2b", "Zhang")
    judged = []

    async def judge(tool_context, question):
        judged.append(question)
        return "asks what they would not buy and whether a fix changes it"

    monkeypatch.setattr(persona_chat_module, "judge_joined_question", judge)

    result = await tool.execute(ToolContext(), PersonaChatParams(
        persona_paths=[path], question="什么样的会员你会明确不买，如果这条解决了你会买吗？",
    ))

    assert result.ok is False and "two different things" in result.content
    assert len(judged) == 1 and fake_llm.calls == []


async def test_joined_question_judged_as_one_or_unavailable_is_answered(tool, tmp_path, fake_llm, monkeypatch):
    path = _write_persona(tmp_path, "p_zhang_1a2b", "Zhang")
    question = "那次是谁先提的，第一步做了什么？"

    async def one(tool_context, text):
        return ""

    async def broken(tool_context, text):
        raise semantic_checks.JudgeUnavailable("model offline")

    monkeypatch.setattr(persona_chat_module, "judge_joined_question", one)
    first = await tool.execute(ToolContext(), PersonaChatParams(persona_paths=[path], question=question))
    monkeypatch.setattr(persona_chat_module, "judge_joined_question", broken)
    second = await tool.execute(ToolContext(), PersonaChatParams(persona_paths=[path], question=question))

    assert first.ok is True and second.ok is True


async def test_simple_question_skips_the_judge(tool, tmp_path, fake_llm, monkeypatch):
    path = _write_persona(tmp_path, "p_zhang_1a2b", "Zhang")

    async def judge(tool_context, question):
        raise AssertionError("the judge must not run for a single question")

    monkeypatch.setattr(persona_chat_module, "judge_joined_question", judge)

    result = await tool.execute(ToolContext(), PersonaChatParams(persona_paths=[path], question="上周末孩子是怎么过的？"))

    assert result.ok is True


def test_judge_output_parsing_accepts_fenced_json_and_rejects_prose():
    assert semantic_checks._parse_json_object('```json\n{"two_questions": true}\n```') == {"two_questions": True}
    with pytest.raises(semantic_checks.JudgeUnavailable):
        semantic_checks._parse_json_object("Yes, two questions.")



async def test_joined_question_ending_with_a_period_is_still_judged(tool, tmp_path, fake_llm, monkeypatch):
    path = _write_persona(tmp_path, "p_zhou_1a2b", "Zhou")
    judged = []

    async def judge(tool_context, question):
        judged.append(question)
        return "asks when it is not worth it and which clothes stay home"

    monkeypatch.setattr(persona_chat_module, "judge_joined_question", judge)

    result = await tool.execute(ToolContext(), PersonaChatParams(
        persona_paths=[path],
        question="那在什么情况下你会觉得这张卡不值、干脆不办，那种时候你最不敢把哪件衣服放进去、宁可自己在家洗。",
    ))

    assert result.ok is False and len(judged) == 1 and fake_llm.calls == []
