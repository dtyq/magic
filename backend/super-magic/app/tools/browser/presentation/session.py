"""Browser 会话与页面管理工具的定制详情。"""

from __future__ import annotations

from collections.abc import Mapping

from agentlang.tools.tool_result import ToolResult
from app.service.browser.browser_tool_result_builder import BrowserToolResultBuilder
from app.tools.browser.presentation.common import (
    MAX_LIST_PREVIEW_ITEMS,
    escape_markdown,
    field,
    join_sections,
    message,
    page_data,
    page_display_title,
    page_section,
    page_state,
    readiness,
    section,
    string,
)


def list_sessions_detail(result: ToolResult) -> str:
    sessions = result.data.get("browsers")
    if sessions is None:
        sessions = result.data.get("sessions")
    if not isinstance(sessions, list):
        return ""
    result_text = (
        message("browser.detail.result.sessions", count=len(sessions))
        if sessions
        else message("browser.detail.result.no_sessions")
    )
    cards: list[str] = []
    for index, session in enumerate(sessions[:MAX_LIST_PREVIEW_ITEMS], start=1):
        if not isinstance(session, Mapping):
            continue
        identity = session.get("browser_identity")
        browser_name = ""
        browser_version = ""
        if isinstance(identity, Mapping):
            browser_name = _browser_name(string(identity.get("name")))
            browser_version = string(identity.get("version"))
        heading = " ".join(part for part in (browser_name, browser_version) if part).strip()
        browser_id = string(session.get("browser_id"))
        heading = " — ".join(part for part in (browser_id, heading) if part).strip()
        heading = heading or message("browser.detail.session", index=index)
        page_ids = session.get("tab_ids") or session.get("page_ids")
        lines = [
            f"#### {escape_markdown(heading)}",
            field("browser.detail.label.status", _session_state(string(session.get("state")))),
            field("browser.detail.label.pages", str(len(page_ids) if isinstance(page_ids, list) else 0)),
        ]
        backend = string(session.get("backend"))
        if backend:
            lines.insert(1, field("browser.detail.label.backend", escape_markdown(backend)))
        capability_names = _capability_names(session.get("capabilities"))
        if capability_names:
            lines.append(field("browser.detail.label.capabilities", ", ".join(capability_names)))
        cards.append("\n".join(lines))
    sections = [section("browser.detail.heading.result", result_text)]
    if cards:
        sections.append(section("browser.detail.heading.content", "\n\n".join(cards)))
    if len(sessions) > MAX_LIST_PREVIEW_ITEMS:
        sections.append(
            section(
                "browser.detail.heading.limits",
                message("browser.detail.list_truncated", limit=MAX_LIST_PREVIEW_ITEMS),
            )
        )
    return join_sections(sections)


def list_pages_detail(result: ToolResult) -> str:
    pages = result.data.get("tabs")
    if pages is None:
        pages = result.data.get("pages")
    if not isinstance(pages, list):
        return ""
    result_text = (
        message("browser.detail.result.pages", count=len(pages))
        if pages
        else message("browser.detail.result.no_pages")
    )
    cards: list[str] = []
    for index, page in enumerate(pages[:MAX_LIST_PREVIEW_ITEMS], start=1):
        if not isinstance(page, Mapping):
            continue
        current = f" · {message('browser.detail.current_page')}" if page.get("selected", page.get("active")) is True else ""
        lines = [
            f"#### {index}. {escape_markdown(page_display_title(page))}{current}",
            field(
                "browser.detail.label.url",
                BrowserToolResultBuilder.safe_url(string(page.get("url"))),
            ),
            field("browser.detail.label.status", page_state(string(page.get("state")))),
        ]
        page_readiness = string(page.get("readiness"))
        if page_readiness:
            lines.append(field("browser.detail.label.readiness", readiness(page_readiness)))
        warning = string(page.get("resource_warning")).strip()
        if warning:
            lines.append(field("browser.detail.label.warning", escape_markdown(warning)))
        cards.append("\n".join(lines))
    sections = [section("browser.detail.heading.result", result_text)]
    if cards:
        sections.append(section("browser.detail.heading.pages", "\n\n".join(cards)))
    if len(pages) > MAX_LIST_PREVIEW_ITEMS:
        sections.append(
            section(
                "browser.detail.heading.limits",
                message("browser.detail.list_truncated", limit=MAX_LIST_PREVIEW_ITEMS),
            )
        )
    return join_sections(sections)


def open_page_detail(result: ToolResult) -> str:
    return _page_result_detail(result, "browser.detail.result.page_opened")


def activate_page_detail(result: ToolResult) -> str:
    return _page_result_detail(result, "browser.detail.result.page_activated")


def select_tab_detail(result: ToolResult) -> str:
    return _page_result_detail(result, "browser.detail.result.page_selected")


def close_page_detail(result: ToolResult, arguments: Mapping[str, object]) -> str:
    if not result.ok:
        return ""
    page_id = string(result.data.get("tab_id")) or string(arguments.get("tab_id"))
    lines = [message("browser.detail.result.page_closed")]
    if page_id:
        lines.append(field("browser.detail.label.page_id", escape_markdown(page_id)))
    return join_sections(
        [
            section("browser.detail.heading.result", "\n".join(lines)),
            section("browser.detail.heading.limits", message("browser.detail.page_closed_note")),
        ]
    )


def _page_result_detail(result: ToolResult, result_key: str) -> str:
    page = page_data(result)
    if not page:
        return ""
    sections = [section("browser.detail.heading.result", message(result_key)), page_section(page)]
    redirect_chain = page.get("redirect_chain")
    if isinstance(redirect_chain, list) and len(redirect_chain) > 1:
        safe_chain = " → ".join(
            BrowserToolResultBuilder.safe_url(item)
            for item in redirect_chain
            if isinstance(item, str)
        )
        if safe_chain:
            sections.append(
                section(
                    "browser.detail.heading.changes",
                    message("browser.detail.redirect_chain", chain=safe_chain),
                )
            )
    return join_sections(sections)


def _session_state(value: str) -> str:
    key = {
        "starting": "browser.detail.session_state.starting",
        "connected": "browser.detail.session_state.connected",
        "disconnected": "browser.detail.session_state.disconnected",
        "failed": "browser.detail.session_state.failed",
        "closed": "browser.detail.session_state.closed",
    }.get(value, "browser.detail.state_unknown")
    return message(key)


def _browser_name(value: str) -> str:
    return {"chromium": "Chromium", "firefox": "Firefox", "webkit": "WebKit"}.get(value, value)


def _capability_names(capabilities: object) -> list[str]:
    if not isinstance(capabilities, Mapping):
        return []
    keys = (
        ("accessibility_tree", "browser.detail.capability.accessibility"),
        ("dom_snapshot", "browser.detail.capability.elements"),
        ("page_script", "browser.detail.capability.script"),
        ("screenshots", "browser.detail.capability.screenshot"),
        ("labeled_screenshots", "browser.detail.capability.labels"),
        ("console", "browser.detail.capability.console"),
        ("network", "browser.detail.capability.network"),
        ("file_upload", "browser.detail.capability.upload"),
        ("downloads", "browser.detail.capability.download"),
    )
    return [message(message_key) for key, message_key in keys if capabilities.get(key) is True]
