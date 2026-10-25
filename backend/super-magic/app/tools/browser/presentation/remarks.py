"""Browser 工具调用前后 remark 构建。"""

from __future__ import annotations

from collections.abc import Mapping

from agentlang.tools.tool_result import ToolResult
from app.i18n import i18n
from app.tools.browser.presentation.common import (
    script_preview,
    script_text,
    snapshot_counts,
    string,
    target_text,
    user_error,
)
from magic_use.errors import BrowserErrorCode
from magic_use.models import ActionTarget

_SCRIPT_ARGUMENT_KEYS: Mapping[str, str] = {
    "browser_evaluate": "expression",
    "browser_add_init_script": "source",
}


class BrowserRemarkBuilder:
    @classmethod
    def before(
        cls,
        *,
        tool_name: str,
        action: str,
        arguments: Mapping[str, object],
        target: ActionTarget | None,
    ) -> dict[str, str]:
        subject = cls._argument_subject(tool_name, arguments, target)
        if subject and tool_name in _SCRIPT_ARGUMENT_KEYS:
            remark_key = (
                "browser.remark.running_init_script"
                if tool_name == "browser_add_init_script"
                else "browser.remark.running_script"
            )
            return {
                "tool_name": tool_name,
                "action": action,
                "remark": cls._message(remark_key, action=action, script=subject),
            }
        remark = (
            cls._message("browser.remark.running_target", action=action, target=subject)
            if subject
            else cls._message("browser.remark.running", action=action)
        )
        return {"tool_name": tool_name, "action": action, "remark": remark}

    @classmethod
    def after(
        cls,
        *,
        tool_name: str,
        action: str,
        result: ToolResult,
        arguments: Mapping[str, object],
    ) -> dict[str, str]:
        if not result.ok and result.data.get("error_code") == BrowserErrorCode.NAVIGATION_FAILED.value:
            return {
                "tool_name": tool_name,
                "action": action,
                "remark": cls._message("browser.remark.recovering_navigation"),
            }
        script = cls._script_preview(tool_name, arguments)
        if result.ok and script:
            remark_key = (
                "browser.remark.completed_init_script"
                if tool_name == "browser_add_init_script"
                else "browser.remark.completed_script"
            )
            return {
                "tool_name": tool_name,
                "action": action,
                "remark": cls._message(remark_key, script=script),
            }
        return {
            "tool_name": tool_name,
            "action": action,
            "remark": cls._summary(action, result),
        }

    @classmethod
    def _summary(cls, action: str, result: ToolResult) -> str:
        target = target_text(result)
        if not result.ok:
            if target:
                return cls._message(
                    "browser.detail.failed_target",
                    action=action,
                    target=target,
                    error=user_error(result),
                )
            return cls._message("browser.detail.failed", action=action, error=user_error(result))
        pages = result.data.get("pages")
        if isinstance(pages, list):
            return cls._message("browser.detail.pages", count=len(pages))
        snapshot = result.data.get("snapshot")
        if isinstance(snapshot, Mapping):
            _, interactive_count = snapshot_counts(snapshot.get("root_nodes"))
            suffix = cls._message("browser.detail.truncated") if snapshot.get("truncated") is True else ""
            return cls._message("browser.detail.snapshot", count=interactive_count, suffix=suffix)
        console_entries = result.data.get("console_entries")
        if isinstance(console_entries, list):
            levels = [
                string(entry.get("level")).lower()
                for entry in console_entries
                if isinstance(entry, Mapping)
            ]
            return cls._message(
                "browser.detail.console",
                count=len(console_entries),
                errors=sum(level in {"error", "fatal"} for level in levels),
                warnings=sum(level in {"warning", "warn"} for level in levels),
            )
        network_entries = result.data.get("network_entries")
        if isinstance(network_entries, list):
            failed = sum(
                isinstance(entry, Mapping)
                and (
                    entry.get("error")
                    or (isinstance(entry.get("status"), int) and entry["status"] >= 400)
                )
                for entry in network_entries
            )
            pending = sum(
                isinstance(entry, Mapping)
                and entry.get("status") is None
                and not entry.get("error")
                for entry in network_entries
            )
            return cls._message(
                "browser.detail.network",
                count=len(network_entries),
                failed=failed,
                pending=pending,
            )
        if target:
            return cls._message("browser.detail.succeeded_target", action=action, target=target)
        page = result.data.get("page")
        page_title = string(page.get("title")).strip() if isinstance(page, Mapping) else ""
        if page_title:
            return cls._message("browser.detail.succeeded_page", action=action, page=page_title)
        return cls._message("browser.detail.succeeded", action=action)

    @classmethod
    def _argument_subject(
        cls,
        tool_name: str,
        arguments: Mapping[str, object],
        target: ActionTarget | None,
    ) -> str:
        if tool_name == "browser_fill":
            if target is None:
                return ""
            if target is not None and target.is_sensitive:
                return cls._message("browser.detail.sensitive_value")
            value = arguments.get("value")
            return value.strip() if isinstance(value, str) else ""
        key_by_tool = {
            "browser_evaluate": "expression",
            "browser_add_init_script": "source",
            "browser_press": "key",
            "browser_select": "value",
            "browser_screenshot": "output_path",
            "browser_visual_query": "query",
            "browser_find_visual": "target",
        }
        argument_key = key_by_tool.get(tool_name)
        if argument_key:
            argument_value = script_text(arguments, argument_key)
            if argument_value:
                return (
                    cls._script_preview(tool_name, arguments)
                    if tool_name in _SCRIPT_ARGUMENT_KEYS
                    else argument_value
                )
        if target is not None:
            for value in (target.name, target.text, target.role):
                if value.strip():
                    return value.strip()
        for key in ("url", "query", "scope", "condition"):
            value = arguments.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return ""

    @staticmethod
    def _script_preview(tool_name: str, arguments: Mapping[str, object]) -> str:
        argument_key = _SCRIPT_ARGUMENT_KEYS.get(tool_name)
        if argument_key is None:
            return ""
        return script_preview(script_text(arguments, argument_key))

    @staticmethod
    def _message(key: str, **kwargs: object) -> str:
        return i18n.translate(key, category="tool.messages", **kwargs)
