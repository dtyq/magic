"""Code Mode tool for saving persistent environment variables."""

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
from .service import SCOPE_PERSONAL, EnvManagerError, EnvManagerService


class SetEnvParams(BaseToolParams):
    key: Optional[str] = Field(
        None,
        description="""<!--zh: 环境变量名-->
Environment variable name""",
    )
    value: Optional[str] = Field(
        None,
        description="""<!--zh: 环境变量值。工具结果和详情不会回显该值。-->
Environment variable value. The tool result and detail never echo this value.""",
    )
    scope: str = Field(
        SCOPE_PERSONAL,
        description="""<!--zh: 保存范围，personal 或 workspace，默认 personal-->
Save scope: personal or workspace. Defaults to personal.""",
    )


@tool(name="set_env")
class SetEnv(BaseTool[SetEnvParams]):
    """<!--zh: 保存持久化环境变量。默认写入个人 env。-->
    Save a persistent environment variable. Defaults to personal env."""

    code_mode_only = True

    async def execute(self, tool_context: ToolContext, params: SetEnvParams) -> ToolResult:
        try:
            info = EnvManagerService().set_env(params.key, params.value, params.scope)
        except EnvManagerError as exc:
            key = (params.key or "").strip()
            payload = {
                "operation": "set",
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

        key = info["key"]
        scope = info["scope"]
        content = f"Environment variable saved: {key} (scope: {scope})."
        payload = {"operation": "set", "key": key, "scope": scope, "target": info["target"]}
        return ToolResult(content=content, extra_info=payload, data=payload)

    async def get_before_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        arguments: Dict[str, Any] | None = None,
    ) -> Dict:
        args = arguments or {}
        scope = get_argument_scope(args)
        return {
            "tool_name": tool_name,
            "action": translate_action(tool_name),
            "remark": translate_message(
                "set.before",
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
        args = arguments or {}
        key = info.get("key") or (arguments or {}).get("key", "")
        scope = info.get("scope") or (arguments or {}).get("scope", SCOPE_PERSONAL)
        target = translate_scope(scope)
        value = args.get("value")
        masked_value = EnvManagerService.mask_value(str(value)) if value is not None else ""
        lines = [
            f"# {translate_message('detail.set_success_title' if result.ok else 'detail.set_failed_title')}",
            "",
            f"- {translate_message('detail.key')}: `{key}`",
            f"- {translate_message('detail.scope')}: {translate_scope(scope)}",
            f"- {translate_message('detail.target')}: {target}",
            f"- {translate_message('detail.value')}: `{masked_value}`",
        ]
        if not result.ok:
            lines.append(f"- {translate_message('detail.error')}: {translate_error(info)}")
        return ToolDetail(type=DisplayType.MD, data=FileContent(file_name="set_env.md", content="\n".join(lines)))

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
        key = info.get("key") or (arguments or {}).get("key", "")
        if result.ok:
            remark = translate_message("set.after_success", key=key, scope_label=translate_scope(scope))
        else:
            remark = translate_message("set.after_failed", key=key, error=translate_error(info))
        return {"tool_name": tool_name, "action": translate_action(tool_name), "remark": remark}


__all__ = ["SetEnv", "SetEnvParams"]
