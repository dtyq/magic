"""Separate model results, localized user details, and transport error mapping."""

from __future__ import annotations

import asyncio
import html
import re
import traceback
from collections.abc import Awaitable, Callable
from datetime import datetime
from typing import Any, TypeVar
from zoneinfo import ZoneInfo

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult

from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.infrastructure.sdk.base.exceptions import HttpRequestError
from app.infrastructure.sdk.magic_service.kernel.magic_service_exception import (
    MagicServiceApiError,
    MagicServiceUnauthorizedException,
)
from app.service.prepared_operation_confirmation import PreparedOperationError
from app.tools.core import BaseTool, BaseToolParams
from app.tools.utils.time_display import format_tool_time

from .context import ProductConfigurationError, ProductContext, ProductContextError, current_product_context

T = TypeVar("T", bound=BaseToolParams)
logger = get_logger(__name__)


def _label(key: str, **kwargs: object) -> str:
    return i18n.translate(key, category="tool.product", **kwargs)


def _visible_text(value: object, limit: int = 2000) -> str:
    """Render resource text literally, without interpreting HTML or Markdown."""
    text = str(value) if isinstance(value, (str, int, float)) else ""
    text = text[:limit] + ("…" if len(text) > limit else "")
    return re.sub(r"([\\`*_{}\[\]()#+.!|>\-])", r"\\\1", html.escape(text))


# 每个注册工具都声明展示对象；只读取已知业务字段，不把模型正文或 ID 当摘要。
TOOL_SUBJECTS = {
    **dict.fromkeys(('list_skills', 'get_skill', 'create_skill', 'prepare_skill_publish', 'publish_skill', 'get_skill_publish_result'), "skill"),
    **dict.fromkeys(("list_workspaces", "get_workspace", "create_workspace", "update_workspace", "archive_workspace", "delete_workspace"), "workspace"),
    **dict.fromkeys(("list_projects", "get_project", "create_project", "update_project", "move_project", "delete_project"), "project"),
    **dict.fromkeys(("list_topics", "get_topic", "create_topic", "update_topic", "archive_topic", "delete_topic", "read_topic_messages", "start_topic_task", "send_topic_message", "list_topic_queued_messages"), "topic"),
    **dict.fromkeys(("list_project_files", "search_project_files", "get_project_file", "create_project_directory", "rename_project_file", "copy_project_files", "move_project_files", "delete_project_files", "prepare_project_files"), "file"),
    "get_file_batch_status": "batch",
    "get_topic_task": "task", "cancel_topic_task": "task",
    "delete_topic_queued_message": "queue",
    "search_users": "person",
    "search_departments": "department",
}


def _plain(value: object, limit: int = 120) -> str:
    return " ".join(str(value).split())[:limit] if isinstance(value, (str, int, float)) else ""


def _error_label(result: ToolResult) -> str:
    key = f"error.{result.data.get('code')}"
    value = _label(key)
    return value if value != key else _label("error.default")


def _display_data(tool_name: str, result: ToolResult, arguments: dict | None, tool_context: ToolContext | None) -> dict:
    data = dict(result.data)
    args = arguments or {}
    subject = TOOL_SUBJECTS[tool_name]
    if args.get("name") and not any(data.get(k) for k in ("name", "project_name", "topic_name", "file_name")):
        data["name"] = args["name"]
    # 当前资源名仅在 ID 匹配时使用，跨项目操作不能误显示发起会话的名称。
    agent = tool_context.get_extension("agent_context") if tool_context else None
    product = agent.get_super_magic_product_context() if agent else None
    for kind in ("workspace", "project", "topic"):
        resource = getattr(product, kind, None) if product else None
        identifier = data.get(f"{kind}_id", args.get(f"{kind}_id"))
        if kind == subject and identifier is None:
            identifier = data.get("id")
        if resource and str(identifier) == resource.id:
            data.setdefault(f"{kind}_name", resource.name)
    if isinstance(args.get("file_ids"), list):
        data.setdefault("selected_count", len(args["file_ids"]))
    for key in ("keyword", "page", "force_interrupt", "content", "purpose", "archived"):
        if key in args:
            data.setdefault(key, args[key])
    if tool_name == "search_project_files":
        if isinstance(args.get("keywords"), list):
            data.setdefault("keyword", " | ".join(str(word) for word in args["keywords"]))
        if isinstance(args.get("projects"), list):
            data.setdefault("search_scopes", args["projects"])
    return data


def product_remark(tool_name: str, data: dict) -> str:
    subject = TOOL_SUBJECTS[tool_name]
    name = next((_plain(data[k]) for k in ("name", f"{subject}_name") if data.get(k)), "")
    parts = [name] if name else []
    if isinstance(data.get("items"), list):
        key = "search.matches" if tool_name == "search_project_files" else "summary.records"
        parts.append(_label(key, count=len(data["items"])))
    elif isinstance(data.get("messages"), list):
        parts.append(_label("summary.messages", count=len(data["messages"])))
    elif isinstance(data.get("files"), list) or data.get("count") is not None or data.get("selected_count") is not None:
        count = data.get("selected_count", data.get("count", len(data.get("files", []))))
        parts.append(_label("summary.files", count=count))
    if data.get("keyword"):
        parts.append(_label("summary.keyword", keyword=_plain(data["keyword"])))
    if tool_name == "search_project_files" and isinstance(data.get("search_scopes"), list):
        parts.append(_label("search.scopes", count=len(data["search_scopes"])))
        if data.get("search_complete") is False:
            parts.append(_label("search.incomplete_short"))
    state = _state(data)
    if state:
        parts.append(state)
    if not parts:
        parts.append(_label(f"subject.{subject}"))
    return " · ".join(parts)


def _state(data: dict[str, Any]) -> str:
    state = data.get("task_status", data.get("status"))
    if state is None and "success" in data:
        state = "success" if data["success"] is True else "failed" if data["success"] is False else None
    if state is None:
        return ""
    key = f"status.{state}"
    label = _label(key)
    return label if label != key else _label("status.unknown")


def _time(value: object) -> str:
    try:
        # Magic Service serializes database times without an offset in its
        # Asia/Shanghai process timezone. Numeric timestamps remain UTC instants.
        if isinstance(value, str) and "-" in value:
            parsed = datetime.fromisoformat(value)
            if parsed.tzinfo is None:
                return format_tool_time(parsed.replace(tzinfo=ZoneInfo("Asia/Shanghai")), "Asia/Shanghai")
        return format_tool_time(value)
    except (ValueError, OverflowError, OSError):
        return "-"


def _resource_lines(data: dict[str, Any]) -> list[str]:
    lines = []
    for key in ("name", "project_name", "topic_name", "file_name", "project_description", "workspace_name",
                "relative_file_path", "project_count", "topic_count", "file_size", "version", "count", "current", "total", "keyword", "progress", "bytes", "selected_count"):
        if data.get(key) is not None:
            value = _visible_text(data[key]).replace("\n", " ")
            if value:
                lines.append(f"- {_label(f'field.{key}')}: {value}")
    state = _state(data)
    if state:
        lines.append(f"- {_label('field.status')}: {state}")
    for key in ("archived", "is_archived", "is_directory", "force_interrupt"):
        if isinstance(data.get(key), (bool, int)):
            lines.append(f"- {_label(f'field.{key}')}: {_label('yes' if data[key] else 'no')}")
    for key in ("created_at", "updated_at", "last_active_at", "expires_at"):
        if data.get(key) is not None:
            lines.append(f"- {_label(f'field.{key}')}: {_time(data[key])}")
    return lines


def product_detail(tool_name: str, result: ToolResult) -> ToolDetail:
    """Build bounded user-facing summaries from public fields, never raw payloads."""
    data = result.data if isinstance(result.data, dict) else {}
    lines = [f"# {i18n.translate(tool_name, category='tool.actions')}", ""]
    if not result.ok:
        lines.extend([_error_label(result), ""])
    lines.extend(_resource_lines(data))
    for field in ("default_topic", "target_workspace", "target_project"):
        nested = data.get(field)
        if isinstance(nested, dict):
            lines.extend(["", f"## {_label(f'field.{field}')}", "", *_resource_lines(nested)])
    for field in ("content", "purpose"):
        if isinstance(data.get(field), str) and data[field]:
            lines.extend(["", f"## {_label(f'field.{field}')}", "", _visible_text(data[field], 2000)])
    state = data.get("task_status", data.get("status"))
    if state in {"accepted", "queued", "waiting", "processing", "cancel_requested", "delete_requested"}:
        lines.extend(["", _label("pending")])

    if tool_name == "search_project_files":
        scopes = data.get("search_scopes", [])
        if scopes:
            lines.extend(["", _label("search.scopes", count=len(scopes)), ""])
        for index, scope in enumerate(scopes, 1):
            name = _visible_text(scope.get("project_name") or _label("search.project", number=index), 200).replace("\n", " ")
            status = scope.get("status", "pending")
            status = status if status in {"pending", "complete", "failed"} else "pending"
            line = f"- {name}: {_label(f'search.scope.{status}')}"
            if scope.get("error_code"):
                line += " · " + _error_label(ToolResult.error("", data={"code": scope["error_code"]}))
            lines.append(line)
        if data.get("search_complete") is False:
            lines.extend(["", _label("search.incomplete")])
        if data.get("results_truncated"):
            lines.extend(["", _label("search.truncated")])
        lines.extend(["", _label("search.names_only")])

    for collection in ("items", "files"):
        records = data.get(collection)
        if not isinstance(records, list):
            continue
        key = "search.matches" if tool_name == "search_project_files" else "records"
        lines.extend(["", _label(key, count=len(records)), ""])
        if not records:
            lines.append(_label("empty"))
        elif tool_name in {"search_users", "search_departments"}:
            for item in records[:20]:
                if not isinstance(item, dict):
                    continue
                name = (item.get("nickname") or item.get("real_name")) if tool_name == "search_users" else item.get("name")
                visible_name = _visible_text(name or "-", 200).replace("\n", " ")
                details = []
                if tool_name == "search_users":
                    if item.get("job_title"):
                        details.append(f"{_label('field.job_title')}: {_visible_text(item['job_title'], 120)}")
                    departments = item.get("departments")
                    if isinstance(departments, list):
                        paths = []
                        for department in departments[:3]:
                            if isinstance(department, dict):
                                names = department.get("path_names") or [department.get("name", "")]
                                if isinstance(names, list):
                                    paths.append("/".join(_visible_text(part, 120) for part in names))
                        if paths:
                            details.append(f"{_label('field.departments')}: {', '.join(paths)}")
                else:
                    names = item.get("path_names")
                    if isinstance(names, list) and names:
                        details.append(f"{_label('field.department_path')}: {'/'.join(_visible_text(part, 120) for part in names)}")
                lines.append(f"- {visible_name}" + (f" · {' · '.join(details)}" if details else ""))
            if len(records) > 20:
                lines.extend(["", _label("truncated")])
        else:
            lines.extend([f"| {_label('field.name')} | {_label('field.status')} | {_label('field.location')} | {_label('field.updated_at')} |", "| --- | --- | --- | --- |"])
            for index, item in enumerate(records[:100], 1):
                if not isinstance(item, dict):
                    continue
                name_fields = ("file_name", "name") if tool_name == "search_project_files" else ("name", "project_name", "topic_name", "file_name")
                name = next((item[key] for key in name_fields if item.get(key)), None)
                name = _visible_text(name, 200).replace("\n", " ") if name else _label("record", number=index)
                timestamp = item.get("updated_at", item.get("created_at"))
                location = _visible_text(item.get("relative_file_path") or item.get("workspace_name") or "-", 300).replace("\n", " ")
                if tool_name == "search_project_files" and item.get("project_name"):
                    location = _visible_text(item["project_name"], 200).replace("\n", " ") + " / " + location
                lines.append(f"| {name} | {_state(item) or '-'} | {location} | {_time(timestamp) if timestamp is not None else '-'} |")
            if len(records) > 100:
                lines.extend(["", _label("truncated")])

    messages = data.get("messages")
    if isinstance(messages, list):
        lines.extend(["", _label("messages", count=len(messages)), ""])
        if not messages:
            lines.append(_label("empty_messages"))
        remaining = 12000
        for message in messages:
            if not isinstance(message, dict):
                continue
            if remaining <= 0:
                lines.append(_label("truncated"))
                break
            body = message.get("text", "")
            limit = min(remaining, 2000)
            text = _visible_text(body, limit)
            remaining -= min(len(body), limit) if isinstance(body, str) else 0
            role = message.get("role")
            role_key = role if role in {"user", "assistant"} else "unknown"
            lines.extend([f"### {_label(f'role.{role_key}')}", "", _time(message.get("timestamp")), "", text, ""])
            if message.get("truncated") or (isinstance(body, str) and len(body) > limit):
                lines.extend([_label("truncated"), ""])
        if data.get("omitted_count"):
            lines.append(_label("omitted", count=data["omitted_count"]))

    task_result = data.get("result")
    if state == "finished" and isinstance(task_result, dict) and isinstance(task_result.get("content"), str):
        lines.extend(["", f"## {_label('task_result')}", "", _visible_text(task_result["content"], 6000)])
        if task_result.get("truncated") or len(task_result["content"]) > 6000:
            lines.extend(["", _label("truncated")])
    if state in {"failed", "suspended"} and data.get("error_message"):
        lines.extend(["", _label("task_failed")])
    if data.get("partial_success") and tool_name != "search_project_files":
        lines.extend(["", _label("partial_success")])
    if data.get("coverage_limit") is not None:
        lines.extend(["", _label("coverage_limit", count=data["coverage_limit"])])
    if data.get("page") is not None:
        lines.extend(["", _label("page", page=data["page"])])
    if data.get("has_more") is True:
        lines.extend(["", _label("more")])
    elif data.get("has_more") is False:
        lines.extend(["", _label("no_more")])
    if tool_name == "search_departments" and data.get("coverage") == "bounded":
        lines.extend(["", _label("contact.bounded")])
    if len(lines) == 2:
        lines.append(_label(f"subject.{TOOL_SUBJECTS[tool_name]}"))
        lines.append(_label("completed"))
    return ToolDetail(type=DisplayType.MD, data=FileContent(file_name=f"{tool_name}.md", content="\n".join(lines)))


def success(action: str, data: dict[str, Any]) -> ToolResult:
    state = data.get("status")
    if data.get("success") is False or state in {"failed", "not_found"}:
        return ToolResult.error(f"{action} failed or was not found.", data=data)
    if state in {"processing", "waiting", "queued"}:
        key = data.get("batch_key", data.get("queue_id", data.get("task_id")))
        reference = f" Reference: {key}." if key else ""
        return ToolResult(content=f"{action} is {state}.{reference} Check its status before reporting completion.", data=data)
    if "items" in data:
        items = data["items"]
        page = data.get("page")
        more = data.get("has_more")
        suffix = f" Page {page}." if page is not None else ""
        if more is not None:
            suffix += " More records are available." if more else " No further records are reported."
        lines = [f"{action}: {len(items)} item(s).{suffix}"]
        if data.get("total") is not None:
            lines[0] += f" Reported total: {data['total']}."
        if data.get("coverage_limit"):
            lines[0] += f" The service caps this search at {data['coverage_limit']} records; more may exist."
        for item in items:
            name = next((item[key] for key in ("name", "project_name", "topic_name", "file_name") if item.get(key)), "Unnamed")
            identifier = item.get("id", item.get("file_id", item.get("queue_id", "unknown")))
            state_text = f", status: {item['status']}" if item.get("status") is not None else ""
            details = [f"id: {identifier}{state_text}"]
            if item.get("workspace_name"):
                details.append(f"workspace: {item['workspace_name']}")
            if item.get("relative_file_path"):
                details.append(f"project file path: {item['relative_file_path']}")
            for key, label in (("last_active_at", "last active"), ("updated_at", "updated"), ("created_at", "created")):
                if item.get(key):
                    timestamp = _time(item[key])
                    if timestamp != "-":
                        details.append(f"{label}: {timestamp}")
            lines.append(f"- {name} ({'; '.join(details)})")
        return ToolResult(content="\n".join(lines), data=data)
    name = next((data[key] for key in ("name", "project_name", "topic_name", "file_name") if data.get(key)), None)
    identifier = data.get("id", data.get("project_id", data.get("topic_id")))
    details = f" {name}" if name else ""
    details += f" (id: {identifier})" if identifier else ""
    return ToolResult(content=f"{action} completed.{details}", data=data)


class ProductTool(BaseTool[T]):
    """Run a product operation with the current chat identity."""

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, Any] | None = None,
    ) -> ToolDetail:
        data = _display_data(self.name, result, arguments, tool_context)
        return product_detail(self.name, result.model_copy(update={"data": data}))

    async def get_before_tool_call_friendly_action_and_remark(self, tool_name, tool_context, arguments=None):
        data = _display_data(self.name, ToolResult(content="Pending"), arguments, tool_context)
        return {"tool_name": self.name, "action": i18n.translate(self.name, category="tool.actions"),
                "remark": product_remark(self.name, data)}

    async def get_before_tool_detail(self, tool_context, arguments=None):
        data = _display_data(self.name, ToolResult(content="Pending"), arguments, tool_context)
        data["status"] = "running"
        return product_detail(self.name, ToolResult(content="Pending", data=data))

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name, tool_context, result, execution_time, arguments=None):
        data = _display_data(self.name, result, arguments, tool_context)
        remark = product_remark(self.name, data)
        if not result.ok:
            remark += " · " + _error_label(result)
        return {"action": i18n.translate(self.name, category="tool.actions"), "remark": remark}

    async def run_product(
        self,
        tool_context: ToolContext,
        action: str,
        operation: Callable[[ProductContext], Awaitable[dict[str, Any]]],
        *,
        write: bool = False,
        format_result: Callable[[dict[str, Any]], ToolResult] | None = None,
    ) -> ToolResult:
        try:
            context = current_product_context(tool_context)
            if context.agent.is_interruption_requested():
                raise asyncio.CancelledError
            data = await operation(context)
            result = format_result(data) if format_result else success(action, data)
            return result.model_copy(update={"use_custom_remark": True})
        except asyncio.CancelledError:
            raise
        except ProductContextError as exc:
            return ToolResult.error(str(exc), use_custom_remark=True, data={"code": "authorization_required"})
        except MagicServiceUnauthorizedException:
            return ToolResult.error("The current user is not authorized for this resource.", use_custom_remark=True, data={"code": "authorization_failed"})
        except MagicServiceApiError as exc:
            return ToolResult.error("The service rejected this resource operation.", use_custom_remark=True, data={"code": "service_rejected", "api_code": exc.api_code})
        except (HttpRequestError, TimeoutError):
            code = "outcome_unknown" if write else "network_error"
            message = "The write may have been accepted; check the resource before retrying." if write else "The service request failed."
            return ToolResult.error(message, use_custom_remark=True, data={"code": code})
        except ProductConfigurationError as exc:
            return ToolResult.error(str(exc), use_custom_remark=True, data={"code": "execution_config_unavailable"})
        except PreparedOperationError as exc:
            return ToolResult.error(str(exc), use_custom_remark=True, data={"code": exc.code.lower()})
        except ValueError as exc:
            return ToolResult.error(str(exc), use_custom_remark=True, data={"code": "invalid_input_or_response"})
        except (FileNotFoundError, PermissionError):
            return ToolResult.error(
                "The required project files are unavailable. Check the configured project mount and access permissions before retrying.",
                use_custom_remark=True, data={"code": "resource_files_unavailable"},
            )
        except Exception as exc:
            # 保留异常类型和调用位置，避免记录可能含凭据的上游正文或函数局部变量。
            frames = "; ".join(f"{frame.filename}:{frame.lineno} in {frame.name}" for frame in traceback.extract_tb(exc.__traceback__))
            logger.error(
                f"Product operation failed: tool={self.name}, action={action}, "
                f"tool_call_id={tool_context.tool_call_id if tool_context else 'unknown'}, "
                f"exception_type={type(exc).__name__}, stack={frames}"
            )
            return ToolResult.error("The product operation failed unexpectedly.", use_custom_remark=True, data={"code": "unexpected_error"})
