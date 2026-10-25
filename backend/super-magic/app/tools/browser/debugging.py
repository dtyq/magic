"""Browser JavaScript 与诊断 Code Mode 工具。"""

from __future__ import annotations

from pydantic import Field, JsonValue

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail
from app.service.browser import BrowserService
from app.service.browser.browser_tool_result_builder import BrowserToolResultBuilder
from app.tools.browser.base import BrowserToolBase, BrowserToolParams
from app.tools.browser.presentation.debugging import (
    add_init_script_detail,
    evaluate_detail,
    read_console_detail,
    read_network_detail,
)
from app.tools.core import tool
from magic_use.models import BrowserPage


class BrowserEvaluateParams(BrowserToolParams):
    expression: str = Field(..., min_length=1, description="Focused JavaScript expression or function executed in the page.")
    argument: JsonValue = Field(None, description="Optional JSON-serializable argument passed to the expression.")
    tab_id: str | None = Field(None, description="Tab ID returned by a Browser tool. Omit to use the default tab.")


class BrowserAddInitScriptParams(BrowserToolParams):
    source: str = Field(
        ...,
        min_length=1,
        description="""<!--zh: 在每个新文档创建时、任何站点脚本运行前执行的 JavaScript。对当前已加载的文档无效。-->
JavaScript that runs on every new document before any page script. Has no effect on the currently loaded document.""",
    )
    tab_id: str | None = Field(None, description="Tab ID returned by a Browser tool. Omit to use the default tab.")


class BrowserDiagnosticParams(BrowserToolParams):
    clear: bool = Field(True, description="Clear this page's current diagnostic buffer after reading.")
    limit: int = Field(100, ge=1, le=500, description="Maximum number of newest entries to return.")
    tab_id: str | None = Field(None, description="Tab ID returned by a Browser tool. Omit to use the default tab.")


# Agent-facing usage is documented in agents/skills/browser/.
@tool(name="browser_evaluate", code_mode_only=True)
class BrowserEvaluate(BrowserToolBase[BrowserEvaluateParams]):
    """Evaluate focused JavaScript in one Browser page."""

    name = "browser_evaluate"
    operation_key = "browser.evaluate"

    async def get_tool_detail(
        self,
        tool_context: ToolContext,
        result: ToolResult,
        arguments: dict[str, object] | None = None,
    ) -> ToolDetail:
        return self.create_browser_tool_detail(result, evaluate_detail(result, arguments or {}))

    async def execute(self, tool_context: ToolContext, params: BrowserEvaluateParams) -> ToolResult:
        async def operation(service: BrowserService, current_page: BrowserPage) -> ToolResult:
            value = await service.evaluate(
                current_page.id,
                params.expression,
                params.argument,
                current_page.session_id,
            )
            return BrowserToolResultBuilder.value(value, "Browser JavaScript evaluation completed.")

        return await self.execute_current_page(tool_context, operation, tab_id=params.tab_id)


# Agent-facing usage is documented in agents/skills/browser/.
@tool(name="browser_add_init_script", code_mode_only=True)
class BrowserAddInitScript(BrowserToolBase[BrowserAddInitScriptParams]):
    """Register JavaScript that runs before page scripts on future navigations."""

    name = "browser_add_init_script"
    operation_key = "browser.add_init_script"

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
        return self.create_browser_tool_detail(result, add_init_script_detail(result, arguments or {}))

    async def execute(self, tool_context: ToolContext, params: BrowserAddInitScriptParams) -> ToolResult:
        async def operation(service: BrowserService, current_page: BrowserPage) -> ToolResult:
            await service.add_init_script(current_page.id, params.source, current_page.session_id)
            return ToolResult(
                content=(
                    "Init script registered. It will run before any page script on the next navigation "
                    "of this page, and on every navigation after that. It did not run on the current document; "
                    "navigate or reload to apply it."
                ),
                data={"tab_id": current_page.id},
            )

        return await self.execute_current_page(tool_context, operation, tab_id=params.tab_id)


# Agent-facing usage is documented in agents/skills/browser/.
@tool(name="browser_read_console", code_mode_only=True)
class BrowserReadConsole(BrowserToolBase[BrowserDiagnosticParams]):
    """Read buffered console entries for one Browser page."""

    name = "browser_read_console"
    operation_key = "browser.read_console"

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
        return self.create_browser_tool_detail(result, read_console_detail(result, arguments or {}))

    async def execute(self, tool_context: ToolContext, params: BrowserDiagnosticParams) -> ToolResult:
        async def operation(service: BrowserService, current_page: BrowserPage) -> ToolResult:
            batch = await service.read_console(
                current_page.id,
                clear=params.clear,
                limit=params.limit,
                session_id=current_page.session_id,
            )
            return BrowserToolResultBuilder.console(batch, current_page.id)

        return await self.execute_current_page(tool_context, operation, tab_id=params.tab_id)


# Agent-facing usage is documented in agents/skills/browser/.
@tool(name="browser_read_network", code_mode_only=True)
class BrowserReadNetwork(BrowserToolBase[BrowserDiagnosticParams]):
    """Read buffered network entries for one Browser page."""

    name = "browser_read_network"
    operation_key = "browser.read_network"

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
        return self.create_browser_tool_detail(result, read_network_detail(result, arguments or {}))

    async def execute(self, tool_context: ToolContext, params: BrowserDiagnosticParams) -> ToolResult:
        async def operation(service: BrowserService, current_page: BrowserPage) -> ToolResult:
            batch = await service.read_network(
                current_page.id,
                clear=params.clear,
                limit=params.limit,
                session_id=current_page.session_id,
            )
            return BrowserToolResultBuilder.network(batch, current_page.id)

        return await self.execute_current_page(tool_context, operation, tab_id=params.tab_id)
