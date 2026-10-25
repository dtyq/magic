import asyncio
from typing import Any, Dict, List, Optional

import pytest

from agentlang.llms.processors.streaming_chunk_aggregator import (
    V2ChunkAggregateConfig,
    V2ChunkAggregator,
    V2ChunkTransport,
)


def _choice(
    *,
    content: Optional[str] = None,
    reasoning: Optional[str] = None,
    role: Optional[str] = None,
    tool_calls: Optional[List[Dict[str, Any]]] = None,
    finish_reason: Optional[str] = None,
    index: int = 0,
) -> Dict[str, Any]:
    delta: Dict[str, Any] = {}
    if role is not None:
        delta["role"] = role
    if content is not None:
        delta["content"] = content
    if reasoning is not None:
        delta["reasoning_content"] = reasoning
    if tool_calls is not None:
        delta["tool_calls"] = tool_calls
    return {
        "finish_reason": finish_reason,
        "index": index,
        "logprobs": None,
        "delta": delta,
    }


def _chunk(
    *choices: Dict[str, Any],
    correlation_id: str = "corr-1",
    chunk_id: str = "chatcmpl-1",
    created: int = 100,
    model: str = "test-model",
) -> Dict[str, Any]:
    return {
        "choices": list(choices),
        "created": created,
        "id": chunk_id,
        "model": model,
        "object": "chat.completion.chunk",
        "usage": None,
        "correlation_id": correlation_id,
        "i": 0,
    }


def _tool(
    index: int,
    *,
    tool_id: Optional[str] = None,
    name: Optional[str] = None,
    arguments: Optional[str] = None,
    label: Optional[str] = None,
    tool_type: Optional[str] = "function",
) -> Dict[str, Any]:
    item: Dict[str, Any] = {"index": index}
    if tool_id is not None:
        item["id"] = tool_id
    if tool_type is not None:
        item["type"] = tool_type
    function: Dict[str, Any] = {}
    if name is not None:
        function["name"] = name
    if label is not None:
        function["label"] = label
    if arguments is not None:
        function["arguments"] = arguments
    if function:
        item["function"] = function
    return item


def _aggregate_config(**overrides: Any) -> V2ChunkAggregateConfig:
    values = {
        "enabled": True,
        "direct_send_count": 0,
        "direct_send_window_ms": 0,
        "flush_window_ms": 30,
        "max_source_chunks": 12,
        "max_payload_bytes": 6 * 1024,
    }
    values.update(overrides)
    return V2ChunkAggregateConfig(**values)


def _indices(packets: List[Dict[str, Any]]) -> List[int]:
    return [packet["i"] for packet in packets]


def _delta(packet: Dict[str, Any]) -> Dict[str, Any]:
    return packet["choices"][0]["delta"]


def test_first_eight_output_packets_are_sent_individually():
    clock = {"now": 10.0}
    aggregator = V2ChunkAggregator(
        config=_aggregate_config(direct_send_count=8, max_source_chunks=100),
        clock=lambda: clock["now"],
    )

    packets: List[Dict[str, Any]] = []
    for index in range(8):
        packets.extend(aggregator.accept(_chunk(_choice(content=str(index))), now=clock["now"]))
        clock["now"] += 0.001

    assert _indices(packets) == list(range(8))
    assert [ _delta(packet)["content"] for packet in packets ] == [str(index) for index in range(8)]
    assert aggregator.has_pending is False


def test_direct_send_window_keeps_early_chunks_individual():
    clock = {"now": 1.0}
    aggregator = V2ChunkAggregator(
        config=_aggregate_config(direct_send_count=0, direct_send_window_ms=150, max_source_chunks=100),
        clock=lambda: clock["now"],
    )

    packets: List[Dict[str, Any]] = []
    for index in range(5):
        packets.extend(aggregator.accept(_chunk(_choice(content=f"c{index}")), now=clock["now"]))
        clock["now"] += 0.02

    assert len(packets) == 5
    assert aggregator.has_pending is False


def test_time_threshold_flushes_on_next_chunk():
    clock = {"now": 5.0}
    aggregator = V2ChunkAggregator(
        config=_aggregate_config(max_source_chunks=100, max_payload_bytes=10_000),
        clock=lambda: clock["now"],
    )

    first = aggregator.accept(_chunk(_choice(content="你")), now=clock["now"])
    assert first == []
    assert aggregator.has_pending is True

    clock["now"] += 0.04
    second = aggregator.accept(_chunk(_choice(content="好")), now=clock["now"])
    # 下一包到达时还没超过数量/大小阈值，先继续合并；时间窗口由 transport 负责。
    assert second == []
    flushed = aggregator.flush(now=clock["now"])
    assert [ _delta(packet)["content"] for packet in flushed ] == ["你好"]
    assert _indices(flushed) == [0]


def test_source_count_threshold_merges_then_flushes():
    aggregator = V2ChunkAggregator(
        config=_aggregate_config(max_source_chunks=3, max_payload_bytes=10_000),
        clock=lambda: 1.0,
    )

    packets: List[Dict[str, Any]] = []
    packets.extend(aggregator.accept(_chunk(_choice(content="a"))))
    packets.extend(aggregator.accept(_chunk(_choice(content="b"))))
    assert packets == []
    packets.extend(aggregator.accept(_chunk(_choice(content="c"))))

    assert [ _delta(packet)["content"] for packet in packets ] == ["abc"]
    assert _indices(packets) == [0]
    assert aggregator.has_pending is False


def test_payload_threshold_flushes():
    aggregator = V2ChunkAggregator(
        config=_aggregate_config(max_source_chunks=100, max_payload_bytes=4),
        clock=lambda: 1.0,
    )

    packets: List[Dict[str, Any]] = []
    packets.extend(aggregator.accept(_chunk(_choice(content="ab"))))
    packets.extend(aggregator.accept(_chunk(_choice(content="cd"))))

    assert [ _delta(packet)["content"] for packet in packets ] == ["abcd"]


def test_reasoning_chunks_merge_and_phase_switch_flushes():
    aggregator = V2ChunkAggregator(
        config=_aggregate_config(max_source_chunks=100, max_payload_bytes=10_000),
        clock=lambda: 1.0,
    )

    packets: List[Dict[str, Any]] = []
    packets.extend(aggregator.accept(_chunk(_choice(reasoning="想"))))
    packets.extend(aggregator.accept(_chunk(_choice(reasoning="一下"))))
    packets.extend(aggregator.accept(_chunk(_choice(content="结论"))))
    packets.extend(aggregator.flush())

    assert [ _delta(packet).get("reasoning_content") for packet in packets ] == ["想一下", None]
    assert [ _delta(packet).get("content") for packet in packets ] == [None, "结论"]
    assert _indices(packets) == [0, 1]


def test_content_chunks_merge():
    aggregator = V2ChunkAggregator(
        config=_aggregate_config(max_source_chunks=4, max_payload_bytes=10_000),
        clock=lambda: 1.0,
    )

    packets: List[Dict[str, Any]] = []
    for text in ("你", "好", "，", "世界"):
        packets.extend(aggregator.accept(_chunk(_choice(content=text))))

    assert [ _delta(packet)["content"] for packet in packets ] == ["你好，世界"]


def test_empty_placeholder_fields_do_not_block_tool_argument_merge():
    """DeepSeek 工具参数片常带 content='' / id='' / name=''，不能当成 MIXED 或新工具头。"""
    aggregator = V2ChunkAggregator(
        config=_aggregate_config(max_source_chunks=4, max_payload_bytes=10_000),
        clock=lambda: 1.0,
    )

    packets: List[Dict[str, Any]] = []
    packets.extend(
        aggregator.accept(
            _chunk(
                _choice(
                    content="",
                    tool_calls=[_tool(0, tool_id="call-1", name="write_file", arguments='{"c":"')],
                )
            )
        )
    )
    for fragment in ("龙", "与", "骑士"):
        packets.extend(
            aggregator.accept(
                _chunk(
                    _choice(
                        content="",
                        tool_calls=[_tool(0, tool_id="", name="", arguments=fragment)],
                    )
                )
            )
        )

    assert len(packets) == 1
    tool_call = _delta(packets[0])["tool_calls"][0]
    assert tool_call["id"] == "call-1"
    assert tool_call["function"]["name"] == "write_file"
    assert tool_call["function"]["arguments"] == '{"c":"龙与骑士'
    assert "content" not in _delta(packets[0])
    assert aggregator.source_chunk_count == 4
    assert aggregator.emitted_count == 1


def test_empty_content_placeholder_does_not_block_reasoning_merge():
    aggregator = V2ChunkAggregator(
        config=_aggregate_config(max_source_chunks=3, max_payload_bytes=10_000),
        clock=lambda: 1.0,
    )

    packets: List[Dict[str, Any]] = []
    packets.extend(aggregator.accept(_chunk(_choice(content="", reasoning="想"))))
    packets.extend(aggregator.accept(_chunk(_choice(content="", reasoning="一下"))))
    packets.extend(aggregator.accept(_chunk(_choice(content="", reasoning="再写"))))

    assert len(packets) == 1
    assert _delta(packets[0])["reasoning_content"] == "想一下再写"
    assert "content" not in _delta(packets[0])


def test_single_tool_arguments_concatenated_without_json_parse():
    aggregator = V2ChunkAggregator(
        config=_aggregate_config(max_source_chunks=3, max_payload_bytes=10_000),
        clock=lambda: 1.0,
    )

    packets: List[Dict[str, Any]] = []
    packets.extend(aggregator.accept(_chunk(_choice(tool_calls=[_tool(0, tool_id="call-1", name="search", arguments='{"q":"')]))))
    packets.extend(aggregator.accept(_chunk(_choice(tool_calls=[_tool(0, arguments="he")]))))
    packets.extend(aggregator.accept(_chunk(_choice(tool_calls=[_tool(0, arguments='llo"}')]))))

    tool_calls = _delta(packets[0])["tool_calls"]
    assert len(tool_calls) == 1
    assert tool_calls[0]["id"] == "call-1"
    assert tool_calls[0]["function"]["name"] == "search"
    assert tool_calls[0]["function"]["arguments"] == '{"q":"hello"}'


def test_new_tool_header_flushes_old_buffer():
    aggregator = V2ChunkAggregator(
        config=_aggregate_config(max_source_chunks=100, max_payload_bytes=10_000),
        clock=lambda: 1.0,
    )

    packets: List[Dict[str, Any]] = []
    packets.extend(aggregator.accept(_chunk(_choice(tool_calls=[_tool(0, tool_id="call-1", name="search", arguments='{"q":"a')]))))
    packets.extend(aggregator.accept(_chunk(_choice(tool_calls=[_tool(1, tool_id="call-2", name="read", arguments='{"p":"')]))))
    packets.extend(aggregator.flush())

    assert len(packets) == 2
    assert _delta(packets[0])["tool_calls"][0]["id"] == "call-1"
    assert _delta(packets[1])["tool_calls"][0]["id"] == "call-2"


def test_interleaved_tool_arguments_merge_after_headers():
    aggregator = V2ChunkAggregator(
        config=_aggregate_config(max_source_chunks=100, max_payload_bytes=10_000),
        clock=lambda: 1.0,
    )

    packets: List[Dict[str, Any]] = []
    packets.extend(aggregator.accept(_chunk(_choice(tool_calls=[_tool(0, tool_id="call-1", name="search")]))))
    packets.extend(aggregator.accept(_chunk(_choice(tool_calls=[_tool(1, tool_id="call-2", name="read")]))))
    packets.extend(aggregator.accept(_chunk(_choice(tool_calls=[_tool(0, arguments='{"q":"hi"}')]))))
    packets.extend(aggregator.accept(_chunk(_choice(tool_calls=[_tool(1, arguments='{"p":"a.txt"}')]))))
    packets.extend(aggregator.flush())

    # 新工具头会先冲掉旧缓冲；之后交错到达的参数可以进同一个传输包。
    assert len(packets) == 2
    assert _delta(packets[0])["tool_calls"][0]["id"] == "call-1"
    last_tools = {item["index"]: item for item in _delta(packets[1])["tool_calls"]}
    assert last_tools[0]["function"]["arguments"] == '{"q":"hi"}'
    assert last_tools[1]["id"] == "call-2"
    assert last_tools[1]["function"]["arguments"] == '{"p":"a.txt"}'


def test_finish_reason_merges_into_same_phase_buffer():
    aggregator = V2ChunkAggregator(
        config=_aggregate_config(max_source_chunks=100, max_payload_bytes=10_000),
        clock=lambda: 1.0,
    )

    packets: List[Dict[str, Any]] = []
    packets.extend(aggregator.accept(_chunk(_choice(content="hello"))))
    packets.extend(aggregator.accept(_chunk(_choice(content="!", finish_reason="stop"))))

    assert len(packets) == 1
    assert _delta(packets[0])["content"] == "hello!"
    assert packets[0]["choices"][0]["finish_reason"] == "stop"
    assert packets[0]["i"] == 0
    assert aggregator.has_pending is False


def test_finish_reason_with_phase_switch_flushes_old_buffer_first():
    aggregator = V2ChunkAggregator(
        config=_aggregate_config(max_source_chunks=100, max_payload_bytes=10_000),
        clock=lambda: 1.0,
    )

    packets: List[Dict[str, Any]] = []
    packets.extend(aggregator.accept(_chunk(_choice(content="正文"))))
    packets.extend(aggregator.accept(_chunk(_choice(
        tool_calls=[_tool(0, tool_id="call-1", name="search", arguments="{}")],
        finish_reason="tool_calls",
    ))))

    assert len(packets) == 2
    assert _delta(packets[0])["content"] == "正文"
    assert packets[0]["choices"][0]["finish_reason"] is None
    assert packets[1]["choices"][0]["finish_reason"] == "tool_calls"
    assert _indices(packets) == [0, 1]


def test_usage_only_chunk_does_not_reach_aggregator_contract():
    # handler 会过滤 choices 为空的 usage-only chunk；聚合器遇到空 choice 也必须直出且不破坏序号。
    aggregator = V2ChunkAggregator(config=_aggregate_config(), clock=lambda: 1.0)
    packets = aggregator.accept(_chunk())
    assert packets[0]["choices"] == []
    assert packets[0]["i"] == 0


def test_transport_index_is_continuous_across_correlation_local_stream():
    aggregator = V2ChunkAggregator(
        config=_aggregate_config(direct_send_count=2, max_source_chunks=2, max_payload_bytes=10_000),
        clock=lambda: 1.0,
    )

    packets: List[Dict[str, Any]] = []
    for text in ("a", "b", "c", "d", "e"):
        packets.extend(aggregator.accept(_chunk(_choice(content=text), correlation_id="corr-a")))
    packets.extend(aggregator.flush())

    assert _indices(packets) == list(range(len(packets)))
    assert "".join(_delta(packet)["content"] for packet in packets) == "abcde"


def test_disabled_config_sends_every_chunk():
    aggregator = V2ChunkAggregator(
        config=_aggregate_config(enabled=False, max_source_chunks=100),
        clock=lambda: 1.0,
    )

    packets: List[Dict[str, Any]] = []
    for text in ("a", "b", "c"):
        packets.extend(aggregator.accept(_chunk(_choice(content=text))))

    assert [ _delta(packet)["content"] for packet in packets ] == ["a", "b", "c"]
    assert _indices(packets) == [0, 1, 2]


def test_mixed_reasoning_and_content_flushes_immediately_in_aggregate_mode():
    aggregator = V2ChunkAggregator(
        config=_aggregate_config(max_source_chunks=100, max_payload_bytes=10_000),
        clock=lambda: 1.0,
    )

    packets = aggregator.accept(_chunk(_choice(reasoning="想", content="写")))
    assert len(packets) == 1
    assert _delta(packets[0])["reasoning_content"] == "想"
    assert _delta(packets[0])["content"] == "写"


def test_choice_index_change_flushes():
    aggregator = V2ChunkAggregator(
        config=_aggregate_config(max_source_chunks=100, max_payload_bytes=10_000),
        clock=lambda: 1.0,
    )

    packets: List[Dict[str, Any]] = []
    packets.extend(aggregator.accept(_chunk(_choice(content="a", index=0))))
    packets.extend(aggregator.accept(_chunk(_choice(content="b", index=1))))
    packets.extend(aggregator.flush())

    assert [packet["choices"][0]["index"] for packet in packets] == [0, 1]


@pytest.mark.asyncio
async def test_transport_flushes_after_time_window():
    pushed: List[Dict[str, Any]] = []

    async def push_chunk(packet: Dict[str, Any], chunk_index: int) -> None:
        pushed.append(packet)
        assert packet["i"] == chunk_index

    release = asyncio.Event()

    async def gated_sleep(_seconds: float) -> None:
        await release.wait()

    transport = V2ChunkTransport(
        push_chunk=push_chunk,
        request_id="req-1",
        config=_aggregate_config(max_source_chunks=100, max_payload_bytes=10_000),
        sleep=gated_sleep,
    )

    await transport.accept(_chunk(_choice(content="缓")))
    assert pushed == []

    release.set()
    await asyncio.sleep(0)
    await asyncio.sleep(0)

    assert [ _delta(packet)["content"] for packet in pushed ] == ["缓"]
    await transport.close()
    assert transport.emitted_count == 1


@pytest.mark.asyncio
async def test_transport_close_flushes_pending_and_cancels_timer():
    pushed: List[Dict[str, Any]] = []

    async def push_chunk(packet: Dict[str, Any], chunk_index: int) -> None:
        pushed.append(packet)

    hang = asyncio.Event()

    async def never_wake(_seconds: float) -> None:
        await hang.wait()

    transport = V2ChunkTransport(
        push_chunk=push_chunk,
        request_id="req-2",
        config=_aggregate_config(max_source_chunks=100, max_payload_bytes=10_000),
        sleep=never_wake,
    )

    await transport.accept(_chunk(_choice(content="未发出")))
    assert pushed == []
    await transport.close()

    assert [ _delta(packet)["content"] for packet in pushed ] == ["未发出"]
    assert transport.source_chunk_count == 1
    assert transport.emitted_count == 1


def test_aggregate_summary_log_shows_upstream_and_emitted_counts():
    transport = V2ChunkTransport(
        push_chunk=lambda *_args: None,
        request_id="req-log",
        config=_aggregate_config(),
    )
    transport._aggregator.source_chunk_count = 10577
    transport._aggregator.emitted_count = 680

    summary = transport._format_aggregate_summary()
    assert "上游 10577 个" in summary
    assert "整合后 680 个" in summary
    assert "减少 93.6%" in summary


def _openai_chunk(content: str, finish_reason: Optional[str] = None) -> Any:
    from openai.types.chat import ChatCompletionChunk
    from openai.types.chat.chat_completion_chunk import Choice, ChoiceDelta

    return ChatCompletionChunk(
        id="chatcmpl-test",
        created=1,
        model="test-model",
        object="chat.completion.chunk",
        choices=[
            Choice(
                index=0,
                delta=ChoiceDelta(content=content, role="assistant" if content == "A" else None),
                finish_reason=finish_reason,
            )
        ],
    )


class _CollectingDriver:
    def __init__(self) -> None:
        self.packets: List[Dict[str, Any]] = []

    async def push(self, chunk_data: Any) -> None:
        extra = chunk_data.delta.extra_fields if chunk_data.delta else {}
        self.packets.append(extra["super_magic_chunk"])


@pytest.mark.asyncio
async def test_handler_v2_aggregates_and_keeps_transport_index_continuous(monkeypatch):
    from agentlang.llms.processors.processor_config import ProcessorConfig
    from agentlang.llms.processors.streaming_context import StreamProcessContext
    from agentlang.llms.processors.streaming_handler_v2 import StreamResponseHandlerV2, V2ChunkTransport

    test_config = _aggregate_config(direct_send_count=2, max_source_chunks=4, max_payload_bytes=10_000)

    def fake_transport(push_chunk, request_id, config=None, sleep=asyncio.sleep):
        return V2ChunkTransport(
            push_chunk=push_chunk,
            request_id=request_id,
            config=test_config,
            sleep=sleep,
        )

    monkeypatch.setattr(
        "agentlang.llms.processors.streaming_handler_v2.V2ChunkTransport",
        fake_transport,
    )

    texts = ["A", "B", "C", "D", "E", "F", "G"]

    async def stream():
        from openai.types.chat import ChatCompletionChunk
        from openai.types.completion_usage import CompletionUsage

        for index, text in enumerate(texts):
            finish = "stop" if index == len(texts) - 1 else None
            yield _openai_chunk(text, finish_reason=finish)
        yield ChatCompletionChunk(
            id="chatcmpl-test",
            created=1,
            model="test-model",
            object="chat.completion.chunk",
            choices=[],
            usage=CompletionUsage(prompt_tokens=1, completion_tokens=7, total_tokens=8),
        )

    driver = _CollectingDriver()
    result = await StreamResponseHandlerV2().process_stream_chunks(
        stream=stream(),
        streaming_driver=driver,
        context=StreamProcessContext(
            request_id="req-handler",
            model_id="test-model",
            correlation_id="corr-handler",
            processor_config=ProcessorConfig.create_streaming_only(),
            enable_llm_response_events=False,
        ),
    )

    assert result.completion_text == "".join(texts)
    assert result.finish_reason == "stop"
    assert _indices(driver.packets) == list(range(len(driver.packets)))
    assert "".join(_delta(packet).get("content") or "" for packet in driver.packets) == "".join(texts)
    assert driver.packets[-1]["choices"][0]["finish_reason"] == "stop"
    # 前 2 个直发，后面按 4 个源 chunk 合并，传输包应明显少于上游 chunk。
    assert len(driver.packets) < len(texts)
