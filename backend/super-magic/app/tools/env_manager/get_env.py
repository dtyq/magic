"""Code Mode tool for querying one persistent environment variable."""

from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.tools.core import BaseTool, BaseToolParams, tool

from .display import (
    get_argument_key,
    get_argument_scope,
    translate_action,
    translate_error,
    translate_message,
    translate_scope,
)
from .service import SCOPE_ALL, EnvManagerError, EnvManagerService


class GetEnvParams(BaseToolParams):
    key: Optional[str] = Field(
        None,
        description="""<!--zh: 要查询的环境变量名。-->
Environment variable name to query.""",
    )
    scope: str = Field(
        SCOPE_ALL,
        description="""<!--zh: 查询范围，personal、workspace 或 all，默认 all。-->
Query scope: personal, workspace, or all. Defaults to all.""",
    )


@tool(name="get_env")
class GetEnv(BaseTool[GetEnvParams]):
    """<!--zh: 查询单个持久化环境变量，值会脱敏。-->
    Query one persisted environment variable with its masked value."""

    code_mode_only = True

    async def execute(self, tool_context: ToolContext, params: GetEnvParams) -> ToolResult:
        try:
            metadata = tool_context.to_dict() if tool_context else None
            info = await EnvManagerService(metadata=metadata).get_env(params.key, params.scope)
        except EnvManagerError as exc:
            key = (params.key or "").strip()
            payload = {
                "operation": "get",
                "key": key,
                "scope": params.scope,
                "error_code": exc.code,
                "error_context": exc.context,
            }
            return ToolResult.error(
                str(exc),
                extra_info=payload,
                data=payload,
                use_custom_remark=True,
            )

        content = self._build_model_content(info)
        payload = {
            "operation": "get",
            "key": info["key"],
            "scope": info["scope"],
            "target": info["target"],
            "value": info["value"],
            "available": info["available"],
        }
        return ToolResult(content=content, extra_info=payload, data=payload)

    @staticmethod
    def _build_model_content(info: dict[str, Any]) -> str:
        key = info["key"]
        value = info["value"]
        scope = info["scope"]
        if info.get("available", True):
            return f"Environment variable found: {key}: {value} (scope: {scope})."
        return f"Environment variable found but unavailable: {key}: {value} (scope: {scope})."

    async def get_before_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        arguments: Dict[str, Any] | None = None,
    ) -> Dict:
        args = arguments or {}
        scope = get_argument_scope(args, SCOPE_ALL)
        return {
            "tool_name": tool_name,
            "action": translate_action(tool_name),
            "remark": translate_message(
                "get.before",
                key=get_argument_key(args),
                scope_label=translate_scope(scope),
            ),
        }

    async def get_tool_detail(
        self,
        tool_context: ToolContext,
        result: ToolResult,
        arguments: Dict[str, Any] | None = None,
    ) -> Optional[ToolDetail]:
        info = result.extra_info or {}
        key = info.get("key") or (arguments or {}).get("key", "")
        scope = info.get("scope") or (arguments or {}).get("scope", SCOPE_ALL)
        value = info.get("value", "")
        available = info.get("available", result.ok)
        lines = [
            f"# {translate_message('detail.get_success_title' if result.ok else 'detail.get_failed_title')}",
            "",
            f"- {translate_message('detail.key')}: `{key}`",
            f"- {translate_message('detail.scope')}: {translate_scope(scope)}",
            f"- {translate_message('detail.target')}: {translate_scope(scope)}",
        ]
        if result.ok:
            lines.append(f"- {translate_message('detail.value')}: `{value}`")
            if not available:
                lines.append(f"- {translate_message('detail.available')}: {translate_message('detail.unavailable')}")
        else:
            lines.append(f"- {translate_message('detail.error')}: {translate_error(info)}")
        return ToolDetail(type=DisplayType.MD, data=FileContent(file_name="get_env.md", content="\n".join(lines)))

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] | None = None,
    ) -> Dict:
        info = result.extra_info or {}
        scope = info.get("scope") or (arguments or {}).get("scope", SCOPE_ALL)
        key = info.get("key") or (arguments or {}).get("key", "")
        if result.ok:
            remark = translate_message("get.after_success", key=key, scope_label=translate_scope(scope))
        else:
            remark = translate_message("get.after_failed", key=key, error=translate_error(info))
        return {"tool_name": tool_name, "action": translate_action(tool_name), "remark": remark}


__all__ = ["GetEnv", "GetEnvParams"]
