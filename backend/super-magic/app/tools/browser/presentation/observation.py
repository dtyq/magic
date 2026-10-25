"""Browser 页面观察、截图与视觉工具的定制详情。"""

from __future__ import annotations

from collections.abc import Mapping

from agentlang.tools.tool_result import ToolResult
from app.tools.browser.presentation.common import (
    MAX_HTML_PREVIEW_CHARS,
    MAX_LIST_PREVIEW_ITEMS,
    MAX_MARKDOWN_PREVIEW_CHARS,
    MAX_SNAPSHOT_PREVIEW_ITEMS,
    action_label,
    code_block,
    diff_lines,
    escape_markdown,
    field,
    join_sections,
    message,
    page_data,
    page_section,
    scope_label,
    section,
    snapshot_counts,
    string,
)


def read_page_detail(result: ToolResult) -> str:
    markdown = string(result.data.get("markdown")).strip()
    scope = string(result.data.get("scope"))
    scope_key = "browser.detail.scope_full" if scope == "full" else "browser.detail.scope_viewport"
    sections = [
        section("browser.detail.heading.result", message("browser.detail.result.page_read")),
        page_section(page_data(result)),
        section(
            "browser.detail.heading.scope",
            message("browser.detail.read_scope", scope=message(scope_key)),
        ),
    ]
    if not markdown:
        sections.append(section("browser.detail.heading.limits", message("browser.detail.no_readable_content")))
        return join_sections(sections)
    preview = markdown[:MAX_MARKDOWN_PREVIEW_CHARS].rstrip()
    sections.append(section("browser.detail.heading.content", preview))
    if len(markdown) > MAX_MARKDOWN_PREVIEW_CHARS:
        sections.append(
            section(
                "browser.detail.heading.limits",
                message("browser.detail.content_truncated", limit=f"{MAX_MARKDOWN_PREVIEW_CHARS:,}"),
            )
        )
    return join_sections(sections)


def read_html_detail(result: ToolResult) -> str:
    html = string(result.data.get("html")).strip()
    detail = string(result.data.get("detail")) or "outline"
    ref = string(result.data.get("ref"))
    scope_lines = [field("browser.detail.label.detail", escape_markdown(detail))]
    if ref:
        scope_lines.append(field("browser.detail.label.root", escape_markdown(ref)))
    sections = [
        section("browser.detail.heading.result", message("browser.detail.result.html_read")),
        page_section(page_data(result)),
        section("browser.detail.heading.scope", "\n".join(scope_lines)),
    ]
    if html:
        sections.append(
            section(
                "browser.detail.heading.html",
                code_block("html", html[:MAX_HTML_PREVIEW_CHARS].rstrip()),
            )
        )
    else:
        sections.append(section("browser.detail.heading.limits", message("browser.detail.no_html_content")))
    if result.data.get("truncated") is True or len(html) > MAX_HTML_PREVIEW_CHARS:
        sections.append(
            section(
                "browser.detail.heading.limits",
                message("browser.detail.html_truncated", limit=f"{MAX_HTML_PREVIEW_CHARS:,}"),
            )
        )
    return join_sections(sections)


def find_detail(result: ToolResult) -> str:
    matches = result.data.get("matches")
    if not isinstance(matches, list):
        return ""
    result_text = (
        message("browser.detail.result.matches", count=len(matches))
        if matches
        else message("browser.detail.result.no_matches")
    )
    items: list[str] = []
    for match in matches[:MAX_LIST_PREVIEW_ITEMS]:
        if not isinstance(match, Mapping):
            continue
        role = string(match.get("role")) or message("browser.detail.element")
        name = next(
            (
                string(match.get(key)).strip()
                for key in ("name", "text")
                if string(match.get(key)).strip()
            ),
            message("browser.detail.unnamed_element"),
        )
        location = (
            message("browser.detail.in_viewport")
            if match.get("in_viewport") is True
            else message("browser.detail.outside_viewport")
        )
        actions = match.get("actions")
        action_text = (
            ", ".join(action_label(item) for item in actions if isinstance(item, str))
            if isinstance(actions, list)
            else ""
        )
        line = f"- **{escape_markdown(role)} · {escape_markdown(name)}** — {location}"
        if action_text:
            line += f" · {message('browser.detail.available_actions', actions=action_text)}"
        items.append(line)
    sections = [section("browser.detail.heading.result", result_text)]
    if items:
        sections.append(section("browser.detail.heading.matches", "\n".join(items)))
    suggestions = result.data.get("suggestions")
    if isinstance(suggestions, list) and suggestions:
        safe_suggestions = ", ".join(
            escape_markdown(item)
            for item in suggestions[:MAX_LIST_PREVIEW_ITEMS]
            if isinstance(item, str)
        )
        if safe_suggestions:
            sections.append(
                section(
                    "browser.detail.heading.suggestions",
                    message("browser.detail.find_suggestions", suggestions=safe_suggestions),
                )
            )
    if result.data.get("truncated") is True or len(matches) > MAX_LIST_PREVIEW_ITEMS:
        sections.append(
            section(
                "browser.detail.heading.limits",
                message("browser.detail.list_truncated", limit=MAX_LIST_PREVIEW_ITEMS),
            )
        )
    return join_sections(sections)


def list_elements_detail(result: ToolResult) -> str:
    snapshot = result.data.get("snapshot")
    if not isinstance(snapshot, Mapping):
        return ""
    items: list[str] = []
    pending = list(snapshot.get("root_nodes", [])) if isinstance(snapshot.get("root_nodes"), list) else []
    while pending and len(items) < MAX_SNAPSHOT_PREVIEW_ITEMS:
        node = pending.pop(0)
        if not isinstance(node, Mapping):
            continue
        name = next(
            (
                string(node.get(key)).strip()
                for key in ("name", "text", "value", "role")
                if string(node.get(key)).strip()
            ),
            "",
        )
        if string(node.get("ref")) and name:
            role = string(node.get("role")) or message("browser.detail.element")
            actions = node.get("actions")
            action_text = (
                ", ".join(action_label(item) for item in actions if isinstance(item, str))
                if isinstance(actions, list)
                else ""
            )
            item = f"- **{escape_markdown(role)}** — {escape_markdown(name)}"
            if action_text:
                item += f" · {message('browser.detail.available_actions', actions=action_text)}"
            items.append(item)
        children = node.get("children")
        if isinstance(children, list):
            pending.extend(children)
    _, interactive_count = snapshot_counts(snapshot.get("root_nodes"))
    sections = [
        section(
            "browser.detail.heading.result",
            message("browser.detail.result.elements", count=interactive_count),
        ),
        page_section({"title": snapshot.get("title"), "url": snapshot.get("url")}),
        section(
            "browser.detail.heading.scope",
            field("browser.detail.label.scope", scope_label(string(snapshot.get("scope")))),
        ),
        section(
            "browser.detail.heading.elements",
            "\n".join(items) if items else message("browser.detail.no_interactive_preview"),
        ),
    ]
    changes = diff_lines(snapshot.get("diff"))
    if changes:
        sections.append(section("browser.detail.heading.changes", "\n".join(changes)))
    if snapshot.get("truncated") is True:
        sections.append(section("browser.detail.heading.limits", message("browser.detail.elements_truncated")))
    return join_sections(sections)


def screenshot_detail(result: ToolResult) -> str:
    screenshot = result.data.get("screenshot")
    if not isinstance(screenshot, Mapping):
        return ""
    lines: list[str] = []
    width = screenshot.get("width")
    height = screenshot.get("height")
    if isinstance(width, int) and isinstance(height, int):
        lines.append(field("browser.detail.label.dimensions", f"{width} × {height}"))
    labels = result.data.get("label_to_ref")
    if isinstance(labels, Mapping):
        lines.append(field("browser.detail.label.labels", str(len(labels))))
    lines.append(
        field(
            "browser.detail.label.scope",
            message("browser.detail.scope_full")
            if screenshot.get("full_page") is True
            else message("browser.detail.scope_viewport"),
        )
    )
    output_path = string(result.data.get("output_path"))
    if output_path:
        lines.append(field("browser.detail.label.output_path", escape_markdown(output_path)))
    return join_sections(
        [
            section("browser.detail.heading.result", message("browser.detail.result.screenshot")),
            page_section(page_data(result)),
            section("browser.detail.heading.details", "\n".join(lines)),
        ]
    )


def visual_query_detail(result: ToolResult, arguments: Mapping[str, object]) -> str:
    analysis = string(result.data.get("analysis")).strip()
    query = string(arguments.get("query")).strip()
    details = field("browser.detail.label.query", escape_markdown(query)) if query else ""
    visual_status = (
        message("browser.detail.native_visual_attached")
        if result.data.get("native_visual") is True
        else analysis or message("browser.detail.no_visual_analysis")
    )
    return join_sections(
        [
            section(
                "browser.detail.heading.result",
                message("browser.detail.result.visual_analysis"),
            ),
            page_section(page_data(result)),
            section("browser.detail.heading.details", details),
            section(
                "browser.detail.heading.analysis",
                visual_status,
            ),
        ]
    )


def find_visual_detail(result: ToolResult) -> str:
    target = string(result.data.get("target")).strip()
    evidence = string(result.data.get("evidence")).strip()
    label = string(result.data.get("label")).strip()
    ref = string(result.data.get("ref")).strip()
    result_lines: list[str] = []
    if target:
        result_lines.append(field("browser.detail.label.target", escape_markdown(target)))
    if label:
        result_lines.append(field("browser.detail.label.label", escape_markdown(label)))
    if ref:
        result_lines.append(field("browser.detail.label.ref", escape_markdown(ref)))
    return join_sections(
        [
            section("browser.detail.heading.result", message("browser.detail.result.visual_match")),
            page_section(page_data(result)),
            section("browser.detail.heading.details", "\n".join(result_lines)),
            section(
                "browser.detail.heading.evidence",
                evidence or message("browser.detail.no_visual_evidence"),
            ),
        ]
    )
