"""Browser JavaScript 与诊断工具的定制详情。"""

from __future__ import annotations

import json
from collections.abc import Mapping

from agentlang.tools.tool_result import ToolResult
from app.tools.browser.presentation.common import (
    MAX_DIAGNOSTIC_ENTRY_CHARS,
    MAX_DIAGNOSTIC_PREVIEW_ITEMS,
    MAX_SCRIPT_DETAIL_CHARS,
    MAX_VALUE_PREVIEW_CHARS,
    code_block,
    diagnostic_scope,
    display_time,
    escape_markdown,
    field,
    join_sections,
    message,
    page_data,
    page_section,
    script_text,
    section,
    string,
    user_error,
)


def evaluate_detail(result: ToolResult, arguments: Mapping[str, object] | None = None) -> str:
    normalized_arguments = arguments or {}
    result_summary = (
        message("browser.detail.result.evaluated")
        if result.ok
        else message(
            "browser.detail.failed",
            action=message("browser.evaluate"),
            error=user_error(result),
        )
    )
    sections = [
        section("browser.detail.heading.result", result_summary),
        page_section(page_data(result)),
    ]

    script = script_text(normalized_arguments, "expression")
    if script:
        script_preview = script[:MAX_SCRIPT_DETAIL_CHARS].rstrip()
        sections.append(
            section(
                "browser.detail.heading.script",
                code_block("javascript", script_preview),
            )
        )
        if len(script) > MAX_SCRIPT_DETAIL_CHARS:
            sections.append(
                section(
                    "browser.detail.heading.limits",
                    message(
                        "browser.detail.script_truncated",
                        limit=f"{MAX_SCRIPT_DETAIL_CHARS:,}",
                    ),
                )
            )

    if "value" not in result.data:
        return join_sections(sections)

    rendered = json.dumps(result.data["value"], ensure_ascii=False, indent=2)
    value_preview = rendered[:MAX_VALUE_PREVIEW_CHARS].rstrip()
    sections.append(section("browser.detail.heading.value", code_block("json", value_preview)))
    if len(rendered) > MAX_VALUE_PREVIEW_CHARS:
        sections.append(
            section(
                "browser.detail.heading.limits",
                message("browser.detail.value_truncated", limit=f"{MAX_VALUE_PREVIEW_CHARS:,}"),
            )
        )
    return join_sections(sections)


def add_init_script_detail(result: ToolResult, arguments: Mapping[str, object]) -> str:
    page = page_data(result)
    if result.ok:
        lines = [message("browser.detail.result.init_script_registered")]
        lines.append(message("browser.detail.init_script_next_navigation"))
    else:
        lines = [
            message(
                "browser.detail.failed",
                action=message("browser.add_init_script"),
                error=user_error(result),
            )
        ]
    tab_id = string(result.data.get("tab_id")) or string(arguments.get("tab_id"))
    if tab_id:
        lines.append(field("browser.detail.label.page_id", escape_markdown(tab_id)))
    script = script_text(arguments, "source")
    script_detail = script[:MAX_SCRIPT_DETAIL_CHARS].rstrip()
    script_sections = [
        section(
            "browser.detail.heading.script",
            code_block("javascript", script_detail),
        )
        if script
        else "",
        section(
            "browser.detail.heading.limits",
            message(
                "browser.detail.script_truncated",
                limit=f"{MAX_SCRIPT_DETAIL_CHARS:,}",
            ),
        )
        if len(script) > MAX_SCRIPT_DETAIL_CHARS
        else "",
    ]
    return join_sections(
        [
            section("browser.detail.heading.result", "\n".join(lines)),
            page_section(page),
            *script_sections,
        ]
    )


def read_console_detail(result: ToolResult, arguments: Mapping[str, object]) -> str:
    entries = result.data.get("console_entries")
    if not isinstance(entries, list):
        return ""
    important = [
        entry
        for entry in entries
        if isinstance(entry, Mapping)
        and string(entry.get("level")).lower() in {"error", "fatal", "assert", "warning", "warn"}
    ][-MAX_DIAGNOSTIC_PREVIEW_ITEMS:]
    error_count = result.data.get("error_count")
    warning_count = result.data.get("warning_count")
    result_text = (
        message(
            "browser.detail.result.console_summary",
            errors=error_count if isinstance(error_count, int) else 0,
            warnings=warning_count if isinstance(warning_count, int) else 0,
        )
    )
    sections = [section("browser.detail.heading.result", result_text), page_section(page_data(result))]
    if important:
        errors = [
            entry for entry in important
            if string(entry.get("level")).lower() in {"error", "fatal", "assert"}
        ]
        warnings = [
            entry for entry in important
            if string(entry.get("level")).lower() in {"warning", "warn"}
        ]

        def render_entries(items: list[Mapping[str, object]]) -> str:
            lines: list[str] = []
            for entry in reversed(items):
                level = string(entry.get("level")).upper() or "LOG"
                occurred_at = display_time(string(entry.get("occurred_at")))
                prefix = f"{occurred_at} · " if occurred_at else ""
                text = string(entry.get("text"))
                lines.append(
                    f"- {prefix}**{escape_markdown(level)}** — "
                    f"{escape_markdown(' '.join(text.split())[:MAX_DIAGNOSTIC_ENTRY_CHARS])}"
                )
            return "\n".join(lines)

        if errors:
            sections.append(section("browser.detail.heading.console_errors", render_entries(errors)))
        if warnings:
            sections.append(section("browser.detail.heading.console_warnings", render_entries(warnings)))
    sections.append(diagnostic_scope(arguments, result))
    return join_sections(sections)


def read_network_detail(result: ToolResult, arguments: Mapping[str, object]) -> str:
    entries = result.data.get("network_entries")
    if not isinstance(entries, list):
        return ""
    request_failed = [
        entry
        for entry in entries
        if isinstance(entry, Mapping)
        and (
            entry.get("error")
            or string(entry.get("phase")) == "failed"
        )
    ][-MAX_DIAGNOSTIC_PREVIEW_ITEMS:]
    http_errors = [
        entry
        for entry in entries
        if isinstance(entry, Mapping)
        and isinstance(entry.get("status"), int)
        and entry["status"] >= 400
    ][-MAX_DIAGNOSTIC_PREVIEW_ITEMS:]
    pending_count = result.data.get("pending_count")
    request_failed_count = result.data.get("request_failed_count", result.data.get("error_count"))
    http_error_count = result.data.get("http_error_count")
    request_failed_count = request_failed_count if isinstance(request_failed_count, int) else len(request_failed)
    http_error_count = http_error_count if isinstance(http_error_count, int) else len(http_errors)
    result_text = (
        message(
            "browser.detail.result.network_summary",
            request_failures=request_failed_count,
            http_errors=http_error_count,
            pending=pending_count if isinstance(pending_count, int) else 0,
        )
    )
    sections = [section("browser.detail.heading.result", result_text), page_section(page_data(result))]
    lines: list[str] = []
    for entry in reversed(request_failed):
        method = string(entry.get("method")) or "GET"
        url = string(entry.get("url"))
        status = entry.get("status")
        status_text = str(status) if isinstance(status, int) else message("browser.detail.network_failed")
        occurred_at = display_time(string(entry.get("occurred_at")))
        prefix = f"{occurred_at} · " if occurred_at else ""
        lines.append(f"- {prefix}**{method}** {url} — {status_text}")
    if lines:
        sections.append(section("browser.detail.heading.failed_requests", "\n".join(lines)))
    http_lines: list[str] = []
    for entry in reversed(http_errors):
        method = string(entry.get("method")) or "GET"
        url = string(entry.get("url"))
        status = entry.get("status")
        occurred_at = display_time(string(entry.get("occurred_at")))
        prefix = f"{occurred_at} · " if occurred_at else ""
        http_lines.append(f"- {prefix}**{method}** {url} — HTTP {status}")
    if http_lines:
        sections.append(section("browser.detail.heading.http_errors", "\n".join(http_lines)))
    sections.append(diagnostic_scope(arguments, result))
    return join_sections(sections)
