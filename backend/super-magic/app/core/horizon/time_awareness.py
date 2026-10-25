"""从已有聊天记录提取近期耗时，只生成 Horizon 展示属性。"""
from __future__ import annotations

import html
import math
from collections import Counter
from dataclasses import dataclass

from agentlang.chat_history.chat_history_models import (
    AssistantMessage,
    ChatMessage,
    ToolMessage,
)


@dataclass(frozen=True)
class ToolDuration:
    tool_name: str
    tool_call_id: str
    duration_ms: float | None


@dataclass(frozen=True)
class TimeAwareness:
    previous_response_duration_ms: float | None = None
    tools: tuple[ToolDuration, ...] = ()


def _valid_duration(duration_ms: float | None) -> float | None:
    # 既有零值可能来自未执行或未计时的结果，不能据此宣称工具瞬间完成。
    if duration_ms is None or not math.isfinite(duration_ms) or duration_ms <= 0:
        return None
    return duration_ms


def collect_time_awareness(
    messages: tuple[ChatMessage, ...],
    *,
    after_message: ChatMessage | None,
) -> TimeAwareness:
    """按上次采样时的真实消息位置取结果，不解析展示文本。"""
    if after_message is None:
        return TimeAwareness()
    boundary = next(
        (index for index in range(len(messages) - 1, -1, -1) if messages[index] is after_message),
        None,
    )
    if boundary is None:
        # 历史被替换后不能把整段旧记录算成新执行；等待本次重新建立边界。
        return TimeAwareness()

    previous_response: AssistantMessage | None = None
    tools: list[ToolDuration] = []
    pending: dict[str, list[int]] = {}
    # 先遇到结果，再向前找最近声明；不能用结果之后的新声明解释旧结果。
    # 恢复执行的声明可以早于采样边界，但只有边界之后的结果进入摘要。
    for index in range(len(messages) - 1, -1, -1):
        if index <= boundary and not pending:
            break
        message = messages[index]
        if isinstance(message, ToolMessage) and index > boundary:
            pending.setdefault(message.tool_call_id, []).append(len(tools))
            tools.append(ToolDuration(
                tool_name=message.tool_call_id,
                tool_call_id=message.tool_call_id,
                duration_ms=_valid_duration(message.duration_ms),
            ))
            continue
        if not isinstance(message, AssistantMessage):
            continue
        if index > boundary and previous_response is None:
            previous_response = message
        for tool_call in message.tool_calls or ():
            if tool_call.function is None or not tool_call.function.name:
                continue
            for tool_index in pending.pop(tool_call.id, ()):
                tool = tools[tool_index]
                tools[tool_index] = ToolDuration(
                    tool_name=tool_call.function.name,
                    tool_call_id=tool.tool_call_id,
                    duration_ms=tool.duration_ms,
                )

    return TimeAwareness(
        previous_response_duration_ms=(
            _valid_duration(previous_response.duration_ms) if previous_response is not None else None
        ),
        tools=tuple(reversed(tools)),
    )


def _format_duration(duration_ms: float) -> str:
    seconds = duration_ms / 1000
    if seconds < 0.1:
        return "<0.1s"
    hours, remainder = divmod(round(seconds, 1), 3600)
    minutes, seconds = divmod(remainder, 60)
    parts: list[str] = []
    if hours:
        parts.append(f"{int(hours)}h")
    if minutes:
        parts.append(f"{int(minutes)}m")
    parts.append(f"{seconds:.1f}s")
    return "".join(parts)


def render_current_time(
    time_text: str,
    *,
    elapsed_seconds: float | None,
    awareness: TimeAwareness,
) -> str:
    """保留明确字段和工具名称；缺失记录不伪造为零耗时。"""
    attributes: dict[str, str] = {}
    elapsed_ms = _valid_duration(elapsed_seconds * 1000 if elapsed_seconds is not None else None)
    if elapsed_ms is not None:
        attributes["elapsed"] = _format_duration(elapsed_ms)
    if awareness.previous_response_duration_ms is not None:
        duration = _format_duration(awareness.previous_response_duration_ms)
        attributes["previous_response_duration"] = duration
    if awareness.tools:
        name_counts = Counter(tool.tool_name for tool in awareness.tools)
        tool_durations: list[str] = []
        for tool in awareness.tools:
            name = tool.tool_name
            if name_counts[tool.tool_name] > 1 and name != tool.tool_call_id:
                name = f"{name} ({tool.tool_call_id})"
            duration = _format_duration(tool.duration_ms) if tool.duration_ms is not None else "unavailable"
            tool_durations.append(f"{name}:{duration}")
        attributes["tools"] = "; ".join(tool_durations)
    attribute_text = "".join(
        f' {name}="{html.escape(value, quote=True)}"' for name, value in attributes.items()
    )
    return f"<current_time{attribute_text}>{html.escape(time_text)}</current_time>"
