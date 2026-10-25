"""Browser 工具详情的公共展示原语。"""

from __future__ import annotations

from collections.abc import Mapping
from datetime import UTC, datetime
from pathlib import Path

from agentlang.tools.tool_result import ToolResult
from app.i18n import i18n
from app.service.browser.browser_tool_result_builder import BrowserToolResultBuilder

MAX_MARKDOWN_PREVIEW_CHARS = 3_000
MAX_HTML_PREVIEW_CHARS = 5_000
MAX_VALUE_PREVIEW_CHARS = 3_000
MAX_SCRIPT_PREVIEW_CHARS = 180
MAX_SCRIPT_DETAIL_CHARS = 12_000
MAX_SNAPSHOT_PREVIEW_ITEMS = 12
MAX_LIST_PREVIEW_ITEMS = 10
MAX_DIAGNOSTIC_PREVIEW_ITEMS = 5
MAX_DIAGNOSTIC_ENTRY_CHARS = 300


def message(key: str, **kwargs: object) -> str:
    return i18n.translate(key, category="tool.messages", **kwargs)


def string(value: object) -> str:
    return value if isinstance(value, str) else ""


def page_data(result: ToolResult) -> Mapping[str, object]:
    page = result.data.get("page")
    if isinstance(page, Mapping):
        return page
    action = result.data.get("action")
    if isinstance(action, Mapping):
        navigation = action.get("navigation")
        if isinstance(navigation, Mapping):
            navigation_page = navigation.get("page")
            if isinstance(navigation_page, Mapping):
                return navigation_page
    snapshot = result.data.get("snapshot")
    if isinstance(snapshot, Mapping):
        return snapshot
    return {}


def safe_page_url(page: Mapping[str, object]) -> str:
    return BrowserToolResultBuilder.safe_url(string(page.get("url")))


def page_display_title(page: Mapping[str, object]) -> str:
    title = string(page.get("title")).strip()
    if title:
        return title
    return safe_page_url(page) or message("browser.detail.untitled_page")


def target_text(result: ToolResult) -> str:
    direct_target = result.data.get("target")
    if isinstance(direct_target, str) and direct_target.strip():
        return direct_target.strip()
    action = result.data.get("action")
    if not isinstance(action, Mapping):
        return ""
    target = action.get("target")
    if not isinstance(target, Mapping):
        return ""
    return next(
        (
            value.strip()
            for value in (
                string(target.get("name")),
                string(target.get("text")),
                string(target.get("role")),
            )
            if value.strip()
        ),
        "",
    )


def is_sensitive_target(result: ToolResult) -> bool:
    action = result.data.get("action")
    if not isinstance(action, Mapping):
        return False
    target = action.get("target")
    return isinstance(target, Mapping) and target.get("is_sensitive") is True


def user_error(result: ToolResult) -> str:
    value = result.extra_info.get("user_error")
    if isinstance(value, str) and value.strip():
        return value
    return message("tool.call_failed_remark")


def section(heading_key: str, content: str) -> str:
    normalized = content.strip()
    if not normalized:
        return ""
    return f"### {message(heading_key)}\n\n{normalized}"


def join_sections(sections: list[str]) -> str:
    return "\n\n".join(item for item in sections if item)


def field(label_key: str, value: str) -> str:
    return message("browser.detail.field", label=message(label_key), value=value)


def code_block(language: str, content: str) -> str:
    fence = "````" if "```" in content else "```"
    return f"{fence}{language}\n{content}\n{fence}"


def escape_markdown(value: str) -> str:
    escaped = value.replace("\\", "\\\\")
    for char in ("`", "*", "_", "[", "]", "<", ">"):
        escaped = escaped.replace(char, f"\\{char}")
    return escaped.replace("\n", " ").replace("\r", " ")


def bounded_text(value: str, limit: int) -> str:
    normalized = " ".join(value.split())
    return normalized if len(normalized) <= limit else normalized[:limit].rstrip() + "…"


def script_text(arguments: Mapping[str, object], key: str) -> str:
    value = arguments.get(key)
    return value.strip() if isinstance(value, str) else ""


def script_preview(value: str) -> str:
    return bounded_text(value, MAX_SCRIPT_PREVIEW_CHARS)


def display_time(value: str) -> str:
    if not value:
        return ""
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return ""
    normalized = parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)
    offset = normalized.utcoffset()
    if offset is None or offset.total_seconds() == 0:
        timezone_label = "UTC"
    else:
        total_minutes = int(offset.total_seconds() // 60)
        sign = "+" if total_minutes >= 0 else "-"
        hours, minutes = divmod(abs(total_minutes), 60)
        timezone_label = f"UTC{sign}{hours:02d}:{minutes:02d}"
    return normalized.strftime("%Y-%m-%d %H:%M:%S") + f" {timezone_label}"


def page_state(value: str) -> str:
    key = {
        "open": "browser.detail.page_state.open",
        "closed": "browser.detail.page_state.closed",
        "failed": "browser.detail.page_state.failed",
    }.get(value, "browser.detail.state_unknown")
    return message(key)


def readiness(value: str) -> str:
    key = {
        "stable": "browser.detail.readiness.stable",
        "loading": "browser.detail.readiness.loading",
        "unknown": "browser.detail.readiness.unknown",
    }.get(value, "browser.detail.readiness.unknown")
    return message(key)


def page_section(page: Mapping[str, object]) -> str:
    if not page:
        return ""
    lines = [
        field("browser.detail.label.title", escape_markdown(page_display_title(page))),
        field("browser.detail.label.url", safe_page_url(page)),
    ]
    state = string(page.get("state"))
    if state:
        lines.append(field("browser.detail.label.status", page_state(state)))
    page_readiness = string(page.get("readiness"))
    if page_readiness:
        lines.append(field("browser.detail.label.readiness", readiness(page_readiness)))
    return section("browser.detail.heading.page", "\n".join(lines))


def scope_label(value: str) -> str:
    key = {
        "interactive": "browser.detail.scope_interactive",
        "viewport": "browser.detail.scope_viewport",
        "subtree": "browser.detail.scope_subtree",
        "full": "browser.detail.scope_full",
        "changes": "browser.detail.scope_changes",
    }.get(value, "browser.detail.scope_interactive")
    return message(key)


def action_label(value: str) -> str:
    key = {
        "click": "browser.detail.action.click",
        "fill": "browser.detail.action.fill",
        "press": "browser.detail.action.press",
        "hover": "browser.detail.action.hover",
        "scroll": "browser.detail.action.scroll",
        "select": "browser.detail.action.select",
        "check": "browser.detail.action.check",
        "upload": "browser.detail.action.upload",
    }.get(value)
    return message(key) if key else value


def diff_lines(diff: object) -> list[str]:
    if not isinstance(diff, Mapping):
        return []
    lines: list[str] = []
    for key, message_key in (
        ("added", "browser.detail.change.added"),
        ("removed", "browser.detail.change.removed"),
        ("changed", "browser.detail.change.changed"),
    ):
        values = diff.get(key)
        if not isinstance(values, list):
            continue
        for value in values[:MAX_DIAGNOSTIC_PREVIEW_ITEMS]:
            if isinstance(value, str):
                lines.append(
                    message(
                        message_key,
                        item=escape_markdown(bounded_text(value, MAX_DIAGNOSTIC_ENTRY_CHARS)),
                    )
                )
    return lines


def action_change_lines(action: Mapping[str, object], result: ToolResult) -> list[str]:
    lines: list[str] = []
    navigation = action.get("navigation")
    if isinstance(navigation, Mapping):
        page = navigation.get("page")
        if isinstance(page, Mapping):
            lines.append(
                message(
                    "browser.detail.change.navigation",
                    title=escape_markdown(page_display_title(page)),
                    url=safe_page_url(page),
                )
            )
    opened_pages = action.get("opened_pages")
    if isinstance(opened_pages, list):
        for page in opened_pages[:MAX_LIST_PREVIEW_ITEMS]:
            if isinstance(page, Mapping):
                lines.append(
                    message(
                        "browser.detail.change.opened_page",
                        title=escape_markdown(page_display_title(page)),
                        url=safe_page_url(page),
                    )
                )
    downloads = action.get("downloads")
    if isinstance(downloads, list):
        for item in downloads[:MAX_LIST_PREVIEW_ITEMS]:
            if isinstance(item, str):
                name = Path(item).name or item.rsplit("/", 1)[-1]
                lines.append(message("browser.detail.change.download", file=escape_markdown(name)))
    dialogs = action.get("dialogs")
    if isinstance(dialogs, list):
        for item in dialogs[:MAX_DIAGNOSTIC_PREVIEW_ITEMS]:
            if isinstance(item, str):
                lines.append(
                    message(
                        "browser.detail.change.dialog",
                        text=escape_markdown(bounded_text(item, MAX_DIAGNOSTIC_ENTRY_CHARS)),
                    )
                )
    post_state = action.get("post_action_state")
    if isinstance(post_state, Mapping):
        label = string(post_state.get("label")).strip()
        value = string(post_state.get("value")).strip()
        if label:
            lines.append(message("browser.detail.change.selected_label", value=escape_markdown(label)))
        elif value:
            display_value = message("browser.detail.sensitive_value") if is_sensitive_target(result) else escape_markdown(value)
            lines.append(message("browser.detail.change.selected_value", value=display_value))
    lines.extend(diff_lines(action.get("snapshot_diff")))
    return [f"- {line}" for line in lines if line]


def diagnostic_scope(arguments: Mapping[str, object], result: ToolResult) -> str:
    lines: list[str] = []
    total = result.data.get("total_count")
    returned = result.data.get("returned_count")
    if isinstance(total, int):
        lines.append(field("browser.detail.label.total", str(total)))
    if isinstance(returned, int):
        lines.append(field("browser.detail.label.returned", str(returned)))
    lines.append(
        field(
            "browser.detail.label.buffer",
            message("browser.detail.buffer_cleared")
            if arguments.get("clear") is not False
            else message("browser.detail.buffer_kept"),
        )
    )
    return section("browser.detail.heading.scope", "\n".join(lines))


def snapshot_counts(nodes: object) -> tuple[int, int]:
    if not isinstance(nodes, list):
        return 0, 0
    total = 0
    refs = 0
    pending = list(nodes)
    while pending:
        node = pending.pop()
        if not isinstance(node, Mapping):
            continue
        total += 1
        if string(node.get("ref")):
            refs += 1
        children = node.get("children")
        if isinstance(children, list):
            pending.extend(children)
    return total, refs
