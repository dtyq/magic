"""Code Mode tool for listing persistent environment variables."""

from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.tools.core import BaseTool, BaseToolParams, tool

from .display import get_argument_scope, translate_action, translate_error, translate_message, translate_scope
from .service import SCOPE_PERSONAL, EnvManagerError, EnvManagerService


class ListEnvParams(BaseToolParams):
    scope: str = Field(
        SCOPE_PERSONAL,
        description="""<!--zh: 查看范围，personal、workspace 或 all，默认 personal-->
List scope: personal, workspace, or all. Defaults to personal.""",
    )


@tool(name="list_env")
class ListEnv(BaseTool[ListEnvParams]):
    """<!--zh: 查看已持久化环境变量，值会脱敏。-->
    List persisted environment variables with masked values."""

    code_mode_only = True

    async def execute(self, tool_context: ToolContext, params: ListEnvParams) -> ToolResult:
        try:
            info = EnvManagerService().list_env(params.scope)
        except EnvManagerError as exc:
            payload = {
                "operation": "list",
                "scope": params.scope,
                "keys": [],
                "count": 0,
                "error_code": exc.code,
                "error_context": exc.context,
            }
            return ToolResult.error(
                str(exc),
                extra_info=payload,
                data=payload,
                use_custom_remark=True,
            )

        scope = info["scope"]
        count = info["count"]
        content = f"Environment variables listed: {count} key(s) (scope: {scope})."
        payload = {
            "operation": "list",
            "scope": scope,
            "target": info["target"],
            "count": count,
            "keys": info["keys"],
        }
        return ToolResult(content=content, extra_info=payload, data=payload)

    async def get_before_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        arguments: Dict[str, Any] | None = None,
    ) -> Dict:
        scope = get_argument_scope(arguments)
        return {
            "tool_name": tool_name,
            "action": translate_action(tool_name),
            "remark": translate_message("list.before", scope_label=translate_scope(scope)),
        }

    async def get_tool_detail(
        self,
        tool_context: ToolContext,
        result: ToolResult,
        arguments: Dict[str, Any] | None = None,
    ) -> Optional[ToolDetail]:
        info = result.extra_info or {}
        scope = info.get("scope") or (arguments or {}).get("scope", SCOPE_PERSONAL)
        target = translate_scope(scope)
        keys = info.get("keys") or []
        lines = [
            f"# {translate_message('detail.list_success_title' if result.ok else 'detail.list_failed_title')}",
            "",
            f"- {translate_message('detail.scope')}: {translate_scope(scope)}",
            f"- {translate_message('detail.target')}: {target}",
            f"- {translate_message('detail.count')}: {len(keys)}",
        ]
        if keys:
            lines.extend(
                [
                    "",
                    f"| {translate_message('detail.key_header')} | {translate_message('detail.value_header')} |",
                    "| --- | --- |",
                ]
            )
            lines.extend(f"| `{item.get('key', '')}` | `{item.get('value', '')}` |" for item in keys)
        if not result.ok:
            lines.append(f"- {translate_message('detail.error')}: {translate_error(info)}")
        return ToolDetail(type=DisplayType.MD, data=FileContent(file_name="list_env.md", content="\n".join(lines)))

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] | None = None,
    ) -> Dict:
        info = result.extra_info or {}
        scope = info.get("scope") or (arguments or {}).get("scope", SCOPE_PERSONAL)
        count = info.get("count", 0)
        if result.ok:
            remark = translate_message("list.after_success", count=count, scope_label=translate_scope(scope))
        else:
            remark = translate_message("list.after_failed", error=translate_error(info), scope_label=translate_scope(scope))
        return {"tool_name": tool_name, "action": translate_action(tool_name), "remark": remark}


__all__ = ["ListEnv", "ListEnvParams"]
