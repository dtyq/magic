"""Browser 导航与等待 Code Mode 工具。"""

from __future__ import annotations

from enum import StrEnum

from pydantic import Field, model_validator

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail
from app.service.browser import BrowserService
from app.service.browser.browser_tool_result_builder import BrowserToolResultBuilder
from app.tools.browser.base import BrowserToolBase, BrowserToolParams
from app.tools.browser.presentation.navigation import (
    keep_alive_detail,
    navigate_detail,
    wait_detail,
)
from app.tools.core import tool
from magic_use import WaitConditionKind, WaitRequest
from magic_use.models import BrowserPage


class NavigationWaitUntil(StrEnum):
    COMMIT = "commit"
    DOMCONTENTLOADED = "domcontentloaded"
    LOAD = "load"
    NETWORKIDLE = "networkidle"


class BrowserNavigateParams(BrowserToolParams):
    url: str = Field(..., description="Destination URL.")
    wait_until: NavigationWaitUntil = Field(
        NavigationWaitUntil.DOMCONTENTLOADED,
        description="Navigation readiness state.",
    )
    browser_id: str | None = Field(None, description="Browser instance ID for initial tab creation.")
    tab_id: str | None = Field(None, description="Tab ID returned by a Browser tool. Omit to use the default tab.")


class BrowserWaitParams(BrowserToolParams):
    condition: WaitConditionKind = Field(
        ...,
        description="Wait condition: time, url, load_state, text, ref, or download.",
    )
    timeout_ms: float = Field(30_000, gt=0, description="Maximum wait time in milliseconds.")
    value: str | None = Field(None, description="Required URL pattern, text, or ref for url, text, or ref waits.")
    duration_ms: float | None = Field(None, gt=0, description="Duration in milliseconds for a time wait.")
    state: str | None = Field(None, description="Required load state, or optional text/ref state.")
    tab_id: str | None = Field(None, description="Tab ID returned by a Browser tool. Omit to use the default tab.")

    @model_validator(mode="after")
    def validate_condition_arguments(self) -> "BrowserWaitParams":
        if self.condition is WaitConditionKind.TIME and self.duration_ms is None:
            raise ValueError("a time wait requires duration_ms")
        if self.condition in {WaitConditionKind.URL, WaitConditionKind.TEXT, WaitConditionKind.REF} and not self.value:
            raise ValueError(f"a {self.condition.value} wait requires value")
        if self.condition is WaitConditionKind.LOAD_STATE and not self.state:
            raise ValueError("a load_state wait requires state")
        return self


class BrowserKeepAliveParams(BrowserToolParams):
    seconds: float = Field(..., gt=0, description="Requested idle lease duration in seconds.")
    tab_id: str | None = Field(None, description="Tab ID returned by a Browser tool. Omit to use the default tab.")


# Agent-facing usage is documented in agents/skills/browser/.
@tool(name="browser_navigate", code_mode_only=True)
class BrowserNavigate(BrowserToolBase[BrowserNavigateParams]):
    """Navigate one Browser page to a URL."""

    name = "browser_navigate"
    operation_key = "browser.goto"

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
        return self.create_browser_tool_detail(result, navigate_detail(result))

    async def execute(self, tool_context: ToolContext, params: BrowserNavigateParams) -> ToolResult:
        async def operation(service: BrowserService, current_page: BrowserPage) -> ToolResult:
            return BrowserToolResultBuilder.page(current_page, "Browser navigation completed.")

        return await self.execute_current_page(
            tool_context,
            operation,
            browser_id=params.browser_id,
            tab_id=params.tab_id,
            screenshot=True,
            navigate_url=params.url,
            wait_until=params.wait_until.value,
        )


# Agent-facing usage is documented in agents/skills/browser/.
@tool(name="browser_wait", code_mode_only=True)
class BrowserWait(BrowserToolBase[BrowserWaitParams]):
    """Wait for one explicit Browser condition."""

    name = "browser_wait"
    operation_key = "browser.wait"

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
        return self.create_browser_tool_detail(result, wait_detail(result, arguments or {}))

    async def execute(self, tool_context: ToolContext, params: BrowserWaitParams) -> ToolResult:
        async def operation(service: BrowserService, current_page: BrowserPage) -> ToolResult:
            request = WaitRequest(
                condition=params.condition,
                timeout_ms=params.timeout_ms,
                value=params.value,
                duration_ms=params.duration_ms,
                state=params.state,
            )
            page = await service.wait(
                current_page.id,
                request,
                current_page.session_id,
            )
            result = BrowserToolResultBuilder.page(
                page,
                f"Browser wait completed: {params.condition.value}",
            )
            result.data["condition"] = params.condition.value
            return result

        return await self.execute_current_page(tool_context, operation, tab_id=params.tab_id)


# Agent-facing usage is documented in agents/skills/browser/.
@tool(name="browser_keep_alive", code_mode_only=True)
class BrowserKeepAlive(BrowserToolBase[BrowserKeepAliveParams]):
    """Extend the idle lease of one Browser page for a long-running task."""

    name = "browser_keep_alive"
    operation_key = "browser.keep_alive"

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
        return self.create_browser_tool_detail(result, keep_alive_detail(result, arguments or {}))

    async def execute(self, tool_context: ToolContext, params: BrowserKeepAliveParams) -> ToolResult:
        async def operation(service: BrowserService, current_page: BrowserPage) -> ToolResult:
            page = await service.keep_page_alive(
                current_page.id,
                params.seconds,
                current_page.session_id,
            )
            return BrowserToolResultBuilder.page(page, "Browser page lease extended.")

        return await self.execute_current_page(tool_context, operation, tab_id=params.tab_id)
