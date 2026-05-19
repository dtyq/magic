"""
测试 ChatHistory 工具调用序列修复逻辑。

覆盖 _reorder_displaced_tool_results（运行时 dict 路径）和
_is_tool_call_sequence_complete（Horizon 注入门控）两个关键方法。
"""
import pytest

from agentlang.chat_history.chat_history import ChatHistory
from agentlang.chat_history.chat_history_models import (
    AssistantMessage,
    FunctionCall,
    ToolCall,
    ToolMessage,
    UserMessage,
)


# ---------------------------------------------------------------------------
# 工厂函数
# ---------------------------------------------------------------------------

def _tc(id: str) -> dict:
    return {"id": id, "type": "function", "function": {"name": "f", "arguments": "{}"}}


def _asst(*ids: str) -> dict:
    return {"role": "assistant", "content": "", "tool_calls": [_tc(i) for i in ids]}


def _tool(id: str) -> dict:
    return {"role": "tool", "content": f"r{id}", "tool_call_id": id}


def _user(c: str = "u") -> dict:
    return {"role": "user", "content": c}


def _tag(m: dict) -> str:
    """将消息转成易读的标签，方便断言。"""
    tcs = m.get("tool_calls", [])
    tcid = m.get("tool_call_id", "")
    t = m["role"]
    if tcs:
        t += "(" + ",".join(x["id"] for x in tcs) + ")"
    if tcid:
        t += "(" + tcid + ")"
    return t


def _reorder(messages: list) -> list:
    ch = ChatHistory.__new__(ChatHistory)
    return ch._reorder_displaced_tool_results(messages)


def _tags(messages: list) -> list[str]:
    return [_tag(m) for m in messages]


# ---------------------------------------------------------------------------
# _reorder_displaced_tool_results：重排场景
# ---------------------------------------------------------------------------

def test_reorder_consecutive_assistants_with_displaced_tool_results():
    """连续两条独立 assistant(tool_call)，tool_result 全堆在后面 + 夹缝 user——线上真实场景。"""
    msgs = [_user(), _asst("A"), _asst("B"), _tool("A"), _user("sys"), _tool("B")]
    result = _reorder(msgs)
    assert _tags(result) == ["user", "assistant(A)", "tool(A)", "assistant(B)", "tool(B)", "user"]
    assert len(result) == len(msgs)


def test_reorder_single_assistant_multi_tool_calls_with_interleaved_user():
    """单条 assistant 带多个 tool_calls，中间夹了一条 user（Horizon 误注入）。"""
    msgs = [_user(), _asst("A", "B"), _user("sys"), _tool("A"), _tool("B")]
    result = _reorder(msgs)
    assert _tags(result) == ["user", "assistant(A,B)", "tool(A)", "tool(B)", "user"]
    assert len(result) == len(msgs)


def test_reorder_three_consecutive_assistants():
    """三条独立 assistant，tool_result 全堆后面，中间还有夹缝 user。"""
    msgs = [
        _user(), _asst("A"), _asst("B"), _asst("C"),
        _tool("A"), _tool("B"), _user("sys"), _tool("C"),
    ]
    result = _reorder(msgs)
    assert _tags(result) == [
        "user",
        "assistant(A)", "tool(A)",
        "assistant(B)", "tool(B)",
        "assistant(C)", "tool(C)",
        "user",
    ]
    assert len(result) == len(msgs)


def test_reorder_mixed_multi_and_single_tool_calls():
    """混合场景：第一条 assistant 带两个 tool_calls，第二条带一个。"""
    msgs = [
        _user(), _asst("A", "B"), _asst("C"),
        _tool("A"), _user("sys"), _tool("B"), _tool("C"),
    ]
    result = _reorder(msgs)
    assert _tags(result) == [
        "user",
        "assistant(A,B)", "tool(A)", "tool(B)",
        "assistant(C)", "tool(C)",
        "user",
    ]
    assert len(result) == len(msgs)


def test_reorder_multiple_interleaved_user_messages():
    """多个 user 消息夹在 assistant 和 tool_result 之间。"""
    msgs = [_user(), _asst("A"), _user("h1"), _user("h2"), _tool("A")]
    result = _reorder(msgs)
    assert _tags(result) == ["user", "assistant(A)", "tool(A)", "user", "user"]
    assert len(result) == len(msgs)


# ---------------------------------------------------------------------------
# _reorder_displaced_tool_results：不应修改的场景
# ---------------------------------------------------------------------------

def test_reorder_preserves_already_correct_sequence():
    """已经正确的序列不应被修改。"""
    msgs = [_user(), _asst("A"), _tool("A"), _user("n")]
    result = _reorder(msgs)
    assert result is msgs  # 无需修复时直接返回原对象


def test_reorder_preserves_correct_multi_assistant_sequence():
    """多条 assistant 各自配对正确，不应修改。"""
    msgs = [_user(), _asst("A"), _tool("A"), _asst("B"), _tool("B"), _user("end")]
    result = _reorder(msgs)
    assert result is msgs


def test_reorder_preserves_orphan_tool_result_in_place():
    """孤立 tool_result（无对应 assistant）应保持原位，不抛出异常。"""
    msgs = [_user(), _tool("X"), _asst("A"), _tool("A")]
    result = _reorder(msgs)
    assert _tags(result) == ["user", "tool(X)", "assistant(A)", "tool(A)"]
    assert len(result) == len(msgs)


def test_reorder_plain_assistant_not_affected():
    """纯文本 assistant（无 tool_calls）不影响重排逻辑。"""
    msgs = [_user(), {"role": "assistant", "content": "text"}, _asst("A"), _tool("A")]
    result = _reorder(msgs)
    assert _tags(result) == ["user", "assistant", "assistant(A)", "tool(A)"]
    assert len(result) == len(msgs)


def test_reorder_empty_list():
    """空列表直接返回。"""
    assert _reorder([]) == []


# ---------------------------------------------------------------------------
# _is_tool_call_sequence_complete：Horizon 注入门控
# ---------------------------------------------------------------------------

def _typed_tc(id: str) -> ToolCall:
    return ToolCall(id=id, type="function", function=FunctionCall(name="f", arguments="{}"))


def _complete(messages) -> bool:
    ch = ChatHistory.__new__(ChatHistory)
    ch.messages = messages
    return ch._is_tool_call_sequence_complete()


def test_complete_single_matched_pair():
    """配对完整的单个 assistant → True。"""
    assert _complete([
        UserMessage(content="h"),
        AssistantMessage(content="", tool_calls=[_typed_tc("A")]),
        ToolMessage(content="rA", tool_call_id="A"),
    ]) is True


def test_complete_last_message_is_unresolved_assistant():
    """最后一条是未结算的 assistant(tool_calls) → False。"""
    assert _complete([
        UserMessage(content="h"),
        AssistantMessage(content="", tool_calls=[_typed_tc("A")]),
    ]) is False


def test_complete_first_of_two_assistants_missing_result():
    """两条连续 assistant，第一条缺 tool_result——旧逻辑只看最近一条会误判为 True。"""
    assert _complete([
        UserMessage(content="h"),
        AssistantMessage(content="", tool_calls=[_typed_tc("A")]),
        AssistantMessage(content="", tool_calls=[_typed_tc("B")]),
        ToolMessage(content="rB", tool_call_id="B"),
    ]) is False


def test_complete_two_fully_matched_pairs():
    """两条 assistant 各自配对完整 → True。"""
    assert _complete([
        UserMessage(content="h"),
        AssistantMessage(content="", tool_calls=[_typed_tc("A")]),
        ToolMessage(content="rA", tool_call_id="A"),
        AssistantMessage(content="", tool_calls=[_typed_tc("B")]),
        ToolMessage(content="rB", tool_call_id="B"),
    ]) is True


def test_complete_multi_tool_calls_partial_missing():
    """单条 assistant 带两个 tool_calls，只有一个 tool_result → False。"""
    assert _complete([
        UserMessage(content="h"),
        AssistantMessage(content="", tool_calls=[_typed_tc("A"), _typed_tc("B")]),
        ToolMessage(content="rA", tool_call_id="A"),
    ]) is False


def test_complete_empty_history():
    """空历史 → True（无未完成序列）。"""
    assert _complete([]) is True
