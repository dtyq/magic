"""Fetch the raw DESIGN.md source of one bundled HTML design style.

Model-facing usage lives in agents/skills/html-design-style/SKILL.md. This tool is
Code Mode only: it is reached through `sdk.tool.call` and never mounted directly.

Why a tool instead of a skill script: the packaged runtime keeps `app.*` inside the
main process, so a script started as an external `python` subprocess cannot import
`app.infrastructure.sdk`. A tool runs in the main process and does not depend on how
the caller launches code.
"""

from __future__ import annotations

import asyncio
import re
from typing import Any

from pydantic import Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, TerminalContent, ToolDetail
from app.i18n import i18n
from app.infrastructure.sdk.magic_service.factory import get_magic_service_sdk
from app.infrastructure.sdk.magic_service.parameter.get_html_design_style_source_parameter import (
    STYLE_CODE_PATTERN,
    GetHtmlDesignStyleSourceParameter,
)
from app.tools.core import BaseToolParams, tool
from app.tools.core.base_tool import BaseTool

logger = get_logger(__name__)


class GetHtmlDesignStyleSourceParams(BaseToolParams):
    style_code: str = Field(
        ...,
        description="""<!--zh: 内置设计风格的标识，例如 apple。-->
Bundled design style identifier, for example "apple".""",
    )

    @field_validator("style_code")
    @classmethod
    def validate_style_code(cls, value: str) -> str:
        # 例：" apple " -> "apple"；"../x"、"Apple"、"" 都在调用服务前被拒绝。
        style_code = value.strip()
        if not re.fullmatch(STYLE_CODE_PATTERN, style_code):
            raise ValueError(
                "style_code must be a single identifier of lowercase ASCII letters, digits, dots, "
                "and hyphens, beginning with a letter or digit."
            )
        return style_code


# Full model-facing usage guidance: agents/skills/html-design-style/SKILL.md
@tool(name="get_html_design_style_source", code_mode_only=True)
class GetHtmlDesignStyleSource(BaseTool[GetHtmlDesignStyleSourceParams]):
    """<!--zh: 获取一个内置 HTML 设计风格的 DESIGN.md 源文。-->
    Fetch the raw DESIGN.md source of one bundled HTML design style."""

    name = "get_html_design_style_source"

    async def execute(self, tool_context: ToolContext, params: GetHtmlDesignStyleSourceParams) -> ToolResult:
        try:
            result = await get_magic_service_sdk().html_design_style.get_source_async(
                GetHtmlDesignStyleSourceParameter(params.style_code)
            )
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.exception("Failed to fetch HTML design style source")
            # 只返回异常类型：SDK/HTTP 异常的 message 可能带内部地址，不能进入模型上下文，详情见上面的日志。
            return ToolResult.error(
                f"Unable to fetch the DESIGN.md source for style_code '{params.style_code}'. "
                f"Error: {type(exc).__name__}",
                extra_info={
                    "user_error": i18n.translate("get_html_design_style_source.error", category="tool.messages")
                },
            )

        if not result.content.strip():
            return ToolResult.error(
                f"The DESIGN.md source for style_code '{params.style_code}' is empty.",
                extra_info={
                    "user_error": i18n.translate("get_html_design_style_source.error", category="tool.messages")
                },
            )

        # content 是模型要读的全文；data 只留校验用的摘要，避免同一份全文重复进入上下文。
        return ToolResult(
            content=(
                f"DESIGN.md source for style_code '{result.style_code}' (sha256 {result.sha256}):\n\n{result.content}"
            ),
            data={"style_code": result.style_code, "sha256": result.sha256, "length": len(result.content)},
        )

    async def get_before_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        arguments: dict[str, Any] | None = None,
    ) -> dict[str, str]:
        style_code = str((arguments or {}).get("style_code") or "").strip()
        return {
            "action": i18n.translate("get_html_design_style_source", category="tool.actions"),
            "remark": i18n.translate(
                "get_html_design_style_source.fetching",
                category="tool.messages",
                style_code=style_code,
            ),
            "tool_name": tool_name,
        }

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: dict[str, Any] | None = None,
    ) -> dict[str, str]:
        key = "get_html_design_style_source.done" if result.ok else "get_html_design_style_source.error"
        return {
            "action": i18n.translate("get_html_design_style_source", category="tool.actions"),
            "remark": i18n.translate(key, category="tool.messages"),
        }

    async def get_tool_detail(
        self,
        tool_context: ToolContext,
        result: ToolResult,
        arguments: dict[str, Any] | None = None,
    ) -> ToolDetail | None:
        # 成功时全文已由模型读取，不向用户展示几万字的源文；失败时给出可读的错误摘要。
        if result.ok:
            return None
        extra = result.extra_info or {}
        output = extra.get("user_error")
        if not isinstance(output, str) or not output.strip():
            output = i18n.translate("get_html_design_style_source.error", category="tool.messages")
        return ToolDetail(
            type=DisplayType.TERMINAL,
            data=TerminalContent(command="get_html_design_style_source", output=output, exit_code=1),
        )
