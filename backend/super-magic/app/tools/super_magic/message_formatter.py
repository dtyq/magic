"""Project V2 topic messages into a bounded, attributed reading result."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from agentlang.tools.tool_result import ToolResult

HIDDEN_TYPES = {"reasoning", "tool_call", "tool_result", "tool", "status"}
MAX_MESSAGE_CHARS = 6000
MAX_PAGE_CHARS = 24000


def _text(value: Any) -> str:
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except (ValueError, TypeError):
            return value
        if not isinstance(parsed, (dict, list)):
            return value
        value = parsed
    if isinstance(value, list):
        return "".join(_text(part) for part in value)
    if isinstance(value, dict):
        if value.get("type") == "text" and isinstance(value.get("text"), str):
            return value["text"]
        content = value.get("content")
        if isinstance(content, (list, dict)):
            return _text(content)
        return ""
    return ""


def _timestamp(value: Any) -> str:
    try:
        seconds = int(value)
    except (TypeError, ValueError):
        return "Time unavailable"
    if seconds > 10**11:
        seconds /= 1000
    try:
        return datetime.fromtimestamp(seconds, timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    except (OverflowError, OSError, ValueError):
        return "Time unavailable"


def format_topic_messages(topic_id: str, raw: dict[str, Any]) -> ToolResult:
    records = raw.get("list")
    if not isinstance(records, list) or any(not isinstance(item, dict) for item in records):
        raise ValueError("The service returned an invalid message page")
    has_more = raw.get("has_more")
    next_cursor = raw.get("next_cursor")
    if not isinstance(has_more, bool) or (has_more and not next_cursor):
        raise ValueError("The service returned an invalid message cursor")

    remaining = MAX_PAGE_CHARS
    messages: list[dict[str, Any]] = []
    omitted = 0
    for record in records:
        if record.get("im_status") == "revoked" or record.get("content_type") in HIDDEN_TYPES or record.get("type") in HIDDEN_TYPES:
            omitted += 1
            continue
        body = _text(record.get("content"))
        if not body:
            omitted += 1
            continue
        if remaining <= 0:
            omitted += 1
            continue
        excerpt = body[: min(MAX_MESSAGE_CHARS, remaining)]
        remaining -= len(excerpt)
        role = record.get("role")
        attachments = []
        for attachment in record.get("attachments") or []:
            if isinstance(attachment, dict):
                attachments.append({k: str(attachment[k]) for k in ("id", "file_id", "name", "file_name", "file_type") if attachment.get(k) is not None})
        messages.append({
            "record_id": str(record.get("id", "")),
            "message_id": str(record.get("message_id", "")),
            "task_id": str(record["task_id"]) if record.get("task_id") else None,
            "role": role if role in {"user", "assistant"} else "unknown",
            "type": str(record.get("type", "")),
            "text": excerpt,
            "timestamp": record.get("send_timestamp"),
            "attachments": attachments,
            "truncated": len(excerpt) < len(body),
        })

    data = {
        "topic_id": topic_id,
        "project_id": str(raw["project_id"]) if raw.get("project_id") else None,
        "project_name": raw.get("project_name"),
        "messages": messages,
        "has_more": has_more,
        "next_cursor": str(next_cursor) if next_cursor is not None else None,
        "page_first_record_id": str(records[0].get("id")) if records else None,
        "page_last_record_id": str(records[-1].get("id")) if records else None,
        "scanned_count": len(records),
        "returned_count": len(messages),
        "omitted_count": omitted,
        "order": "oldest_first",
    }
    header = f"Topic {topic_id}"
    if data["project_name"]:
        header += f" in project {data['project_name']}"
    lines = [f"{header}: scanned {len(records)} oldest-first record(s), showing {len(messages)}. {omitted} omitted."]
    for item in messages:
        lines.append(f"[record_id={item['record_id']}; message_id={item['message_id']}; {item['role']}; {_timestamp(item['timestamp'])}]\n{item['text']}")
        if item["truncated"]:
            lines.append("[This message was truncated.]")
    if has_more:
        lines.append(f"More messages exist. Continue with after_id={data['next_cursor']}. This page is not the latest history.")
    else:
        lines.append("The service reports no later messages at this time.")
    return ToolResult(content="\n\n".join(lines), data=data)
