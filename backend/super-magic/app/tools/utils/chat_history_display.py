"""Chat history tool display helpers."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from enum import StrEnum
from html import escape
import json

from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.service.chat_history_query_models import (
    HistoryType,
    MessageType,
    TimeRange,
    format_history_time,
)
from app.tools.subagent_runtime_models import SubagentStatus
from app.tools.utils.time_display import format_tool_time
from app.utils.file_utils import format_file_size

MAX_DETAIL_DISPLAY_CHARS = 10_000


class HistoryDisplayError(StrEnum):
    UNAVAILABLE = "unavailable"
    TIMEOUT = "timeout"
    INVALID_RECORD = "invalid_record"
    ACCESS_FAILED = "access_failed"
    INVALID_QUERY = "invalid_query"
    UNKNOWN = "unknown"


@dataclass(frozen=True, slots=True)
class HistoryMessagePreview:
    message_index: int
    message_type: MessageType
    timestamp: float | None
    content: str
    truncated: bool = False


@dataclass(frozen=True, slots=True)
class HistoryReadDisplay:
    matched_count: int
    messages: tuple[HistoryMessagePreview, ...]
    output_truncated: bool


def translate(key: str, **kwargs: object) -> str:
    return i18n.translate(f"chat_history.{key}", category="tool.messages", **kwargs)


def action(tool_name: str) -> str:
    return i18n.translate(tool_name, category="tool.actions")


def timezone_name(tool_context: object | None) -> str:
    getter = getattr(tool_context, "get_user_timezone", None)
    if callable(getter):
        value = getter()
        if isinstance(value, str) and value:
            return value
    return "UTC"


def classify_error(exc: BaseException) -> HistoryDisplayError:
    if isinstance(exc, TimeoutError):
        return HistoryDisplayError.TIMEOUT
    if isinstance(exc, (json.JSONDecodeError, UnicodeDecodeError)):
        return HistoryDisplayError.INVALID_RECORD
    if isinstance(exc, (ValueError, TypeError)):
        return HistoryDisplayError.INVALID_QUERY
    if isinstance(exc, OSError):
        return HistoryDisplayError.ACCESS_FAILED
    return HistoryDisplayError.UNKNOWN


def error_result_info(error: HistoryDisplayError) -> dict[str, object]:
    return {"history_display_error": error}


def build_error_detail(tool_key: str, result: object) -> ToolDetail:
    extra_info = getattr(result, "extra_info", {})
    error = extra_info.get("history_display_error", HistoryDisplayError.UNKNOWN)
    if not isinstance(error, HistoryDisplayError):
        try:
            error = HistoryDisplayError(str(error))
        except ValueError:
            error = HistoryDisplayError.UNKNOWN
    lines = [
        f"# {translate(f'{tool_key}.error_title')}",
        "",
        f"{translate(f'error.{error.value}.description')}",
        "",
        f"{translate('error.suggestion')}",
    ]
    return ToolDetail(
        type=DisplayType.MD,
        data=FileContent(file_name=f"{tool_key}_chat_history.md", content="\n".join(lines)),
    )


def format_time(value: object, timezone_name_value: str) -> str:
    if value is None:
        return translate("time_unavailable")
    return format_tool_time(value, timezone_name_value)


def format_time_range(time_range: TimeRange | None, timezone_name_value: str) -> str:
    if time_range is None:
        return translate("range.unlimited")
    start = format_history_time(time_range.start, timezone_name_value) if time_range.start else translate("range.beginning")
    end = format_history_time(time_range.end, timezone_name_value) if time_range.end else translate("range.now")
    return translate("range.value", start=start, end=end)


def label_history_type(value: object) -> str:
    key = value.value if isinstance(value, HistoryType) else str(value)
    return translate(f"history_type.{key}")


def label_message_type(value: object) -> str:
    key = value.value if isinstance(value, MessageType) else str(value)
    return translate(f"message_type.{key}")


def label_status(value: object) -> str:
    key = value.value if isinstance(value, SubagentStatus) else str(value)
    return translate(f"status.{key}")


def inline_text(value: object) -> str:
    text = str(value or "")
    return escape(text.replace("`", "\\`"), quote=False)


def fenced_text(value: object, *, max_chars: int | None = None) -> tuple[str, bool]:
    text = str(value or "")
    truncated = False
    if max_chars is not None and len(text) > max_chars:
        text = text[:max_chars]
        truncated = True
    longest_run = 0
    current_run = 0
    for character in text:
        if character == "`":
            current_run += 1
            longest_run = max(longest_run, current_run)
        else:
            current_run = 0
    fence = "`" * max(3, longest_run + 1)
    return f"{fence}text\n{text}\n{fence}", truncated


def build_list_detail(result: object, timezone_name_value: str) -> ToolDetail:
    if not getattr(result, "ok", False):
        return build_error_detail("list", result)
    data = getattr(result, "data", {})
    files = data.get("files", []) if isinstance(data, Mapping) else []
    files = files if isinstance(files, Sequence) and not isinstance(files, (str, bytes)) else []
    counts = data.get("counts", {}) if isinstance(data, Mapping) else {}
    lines = [f"# {translate('list.detail_title')}", ""]
    lines.append(translate("list.detail_summary", total=data.get("total", 0), returned=data.get("returned", 0)))
    list_time_range = getattr(result, "extra_info", {}).get("history_display_time_range")
    if isinstance(list_time_range, TimeRange):
        lines.append(f"- {translate('field.range')}: {format_time_range(list_time_range, timezone_name_value)}")
    lines.append(
        translate(
            "list.detail_inventory",
            current=counts.get(HistoryType.CURRENT.value, 0),
            compacted=counts.get(HistoryType.COMPACTED.value, 0),
            subagent=counts.get(HistoryType.SUBAGENT.value, 0),
        )
    )
    if not files:
        lines.extend(["", translate("list.empty")])
    for item in files:
        if not isinstance(item, Mapping):
            continue
        history_type = item.get("history_type", "")
        title = item.get("task_label") or item.get("display_name") or label_history_type(history_type)
        lines.extend(["", f"## {inline_text(title)}"])
        lines.append(f"- {translate('field.type')}: {label_history_type(history_type)}")
        lines.append(f"- {translate('field.history_file')}: `{inline_text(item.get('history_file'))}`")
        lines.append(f"- {translate('field.modified')}: {format_time(item.get('modified_at'), timezone_name_value)}")
        lines.append(f"- {translate('field.size')}: {format_file_size(int(item.get('size_bytes') or 0))}")
        if history_type == HistoryType.SUBAGENT.value:
            lines.append(f"- {translate('field.status')}: {label_status(item.get('status'))}")
            if item.get("finished_at") is not None:
                lines.append(f"- {translate('field.finished')}: {format_time(item.get('finished_at'), timezone_name_value)}")
            if item.get("result_preview"):
                lines.append(f"- {translate('field.result')}: {inline_text(item['result_preview'])}")
    if data.get("truncated"):
        lines.extend(["", translate("list.truncated")])
    return _detail_from_lines("list_chat_history.md", lines)


def build_search_detail(result: object, timezone_name_value: str, time_range: TimeRange | None) -> ToolDetail:
    if not getattr(result, "ok", False):
        return build_error_detail("search", result)
    data = getattr(result, "data", {})
    data = data if isinstance(data, Mapping) else {}
    matches = data.get("matches", [])
    matches = matches if isinstance(matches, Sequence) and not isinstance(matches, (str, bytes)) else []
    lines = [f"# {translate('search.detail_title')}", ""]
    lines.extend([
        f"- {translate('field.range')}: {format_time_range(time_range, timezone_name_value)}",
        f"- {translate('field.candidate_files')}: {data.get('candidate_files', 0)}",
        f"- {translate('field.searched_files')}: {data.get('searched_files', 0)}",
        f"- {translate('field.returned')}: {data.get('returned_matches', len(matches))}",
    ])
    if not matches:
        lines.extend(["", translate("search.empty")])
    for item in matches:
        if not isinstance(item, Mapping):
            continue
        lines.extend([
            "",
            f"## {translate('search.message_heading', index=item.get('message_index', '?'))}",
            f"- {translate('field.history_file')}: `{inline_text(item.get('history_file'))}`",
            f"- {translate('field.type')}: {label_message_type(item.get('message_type'))}",
            f"- {translate('field.time')}: {format_time(item.get('timestamp'), timezone_name_value)}",
        ])
        excerpt, _ = fenced_text(item.get("excerpt") or translate("empty_message"))
        lines.append(excerpt)
    if data.get("skipped_files"):
        lines.extend(["", translate("search.skipped", count=data["skipped_files"])])
    if data.get("truncated"):
        lines.extend(["", translate("search.truncated")])
    return _detail_from_lines("search_chat_history.md", lines)


def build_read_detail(result: object, timezone_name_value: str, time_range: TimeRange | None) -> ToolDetail:
    if not getattr(result, "ok", False):
        return build_error_detail("read", result)
    data = getattr(result, "data", {})
    data = data if isinstance(data, Mapping) else {}
    read_display = getattr(result, "extra_info", {}).get("history_read_display")
    lines = [f"# {translate('read.detail_title')}", ""]
    start = data.get("start", 0)
    end = data.get("end", start)
    lines.extend([
        f"- {translate('field.history_file')}: `{inline_text(data.get('history_file'))}`",
        f"- {translate('field.range')}: {translate('read.range', start=start, end=max(start, end - 1) if end > start else start)}",
        f"- {translate('field.time_filter')}: {format_time_range(time_range, timezone_name_value)}",
    ])
    if not isinstance(read_display, HistoryReadDisplay):
        lines.extend(["", translate("read.detail_unavailable")])
        return _detail_from_lines("read_chat_history.md", lines)
    lines.append(f"- {translate('field.matched')}: {read_display.matched_count}")
    lines.append(f"- {translate('field.returned')}: {len(read_display.messages)}")
    if not read_display.messages:
        lines.extend(["", translate("read.empty")])
    for message in read_display.messages:
        lines.extend([
            "",
            f"## {translate('read.message_heading', index=message.message_index)}",
            f"- {translate('field.type')}: {label_message_type(message.message_type)}",
            f"- {translate('field.time')}: {format_time(message.timestamp, timezone_name_value)}",
        ])
        body, detail_message_truncated = fenced_text(message.content, max_chars=1200)
        lines.append(body)
        if message.truncated or detail_message_truncated:
            lines.append(translate("read.message_truncated"))
    if read_display.output_truncated:
        lines.extend(["", translate("read.output_truncated")])
    return _detail_from_lines("read_chat_history.md", lines)


def _detail_from_lines(file_name: str, lines: list[str]) -> ToolDetail:
    content = "\n".join(lines)
    if len(content) <= MAX_DETAIL_DISPLAY_CHARS:
        return ToolDetail(type=DisplayType.MD, data=FileContent(file_name=file_name, content=content))
    marker = "\n\n" + translate("detail_truncated")
    content = content[: max(0, MAX_DETAIL_DISPLAY_CHARS - len(marker))]
    if content.count("```") % 2:
        content += "\n```"
    content += marker
    return ToolDetail(type=DisplayType.MD, data=FileContent(file_name=file_name, content=content))


__all__ = [
    "HistoryDisplayError",
    "HistoryMessagePreview",
    "HistoryReadDisplay",
    "MAX_DETAIL_DISPLAY_CHARS",
    "action",
    "build_error_detail",
    "build_list_detail",
    "build_read_detail",
    "build_search_detail",
    "classify_error",
    "error_result_info",
    "format_time_range",
    "label_history_type",
    "label_message_type",
    "label_status",
    "timezone_name",
    "translate",
]
