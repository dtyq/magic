"""Browser 实例与 Tab 管理 Code Mode 工具。"""

from __future__ import annotations

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail
from app.service.browser import BrowserService
from app.service.browser.browser_runtime_registry import BrowserRuntimeEntry
from app.service.browser.browser_tool_result_builder import BrowserToolResultBuilder
from app.tools.browser.base import BrowserToolBase, BrowserToolParams
from app.tools.browser.presentation.session import (
    activate_page_detail,
    close_page_detail,
    list_pages_detail,
    list_sessions_detail,
    open_page_detail,
    select_tab_detail,
)
from app.tools.core import tool
from magic_use.errors import BrowserErrorCode, BrowserSDKError


class BrowserListInstancesParams(BrowserToolParams):
    pass


class BrowserListTabsParams(BrowserToolParams):
    browser_id: str | None = Field(None, description="Browser instance ID. Omit to use the default Browser.")


class BrowserNewTabParams(BrowserToolParams):
    url: str = Field("about:blank", description="Initial URL. Defaults to a blank page.")
    browser_id: str | None = Field(None, description="Browser instance ID. Omit to use the default Browser.")


class BrowserSelectInstanceParams(BrowserToolParams):
    browser_id: str = Field(..., min_length=1, description="Browser instance ID returned by browser_list_instances.")


class BrowserTabTargetParams(BrowserToolParams):
    tab_id: str = Field(..., min_length=1, description="Tab ID returned by a Browser tool.")


class BrowserCloseTabParams(BrowserToolParams):
    tab_id: str | None = Field(None, min_length=1, description="Tab ID to close. Omit to close the default tab.")


class BrowserActivateTabParams(BrowserToolParams):
    tab_id: str | None = Field(None, min_length=1, description="Tab ID to activate. Omit to activate the default tab.")


@tool(name="browser_list_instances", code_mode_only=True)
class BrowserListInstances(BrowserToolBase[BrowserListInstancesParams]):
    """List Browser instances available to the current Agent context."""

    name = "browser_list_instances"
    operation_key = "browser.list_instances"

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
        return self.create_browser_tool_detail(result, list_sessions_detail(result))

    async def execute(self, tool_context: ToolContext, params: BrowserListInstancesParams) -> ToolResult:
        async def operation() -> ToolResult:
            entries = await BrowserService(tool_context).list_instances()
            sessions = tuple(entry.session for entry in entries)
            return BrowserToolResultBuilder.sessions(sessions)

        return await self.execute_safely(operation())


@tool(name="browser_list_tabs", code_mode_only=True)
class BrowserListTabs(BrowserToolBase[BrowserListTabsParams]):
    """List tabs in the default or explicitly selected Browser instance."""

    name = "browser_list_tabs"
    operation_key = "browser.list_pages"

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
        return self.create_browser_tool_detail(result, list_pages_detail(result))

    async def execute(self, tool_context: ToolContext, params: BrowserListTabsParams) -> ToolResult:
        async def operation(service: BrowserService, entry: BrowserRuntimeEntry | None) -> ToolResult:
            if entry is None:
                return ToolResult(content="No Browser tabs are available. Use browser_navigate to visit a URL.", data={"tabs": []})
            pages = await service.list_pages(entry.session.id)
            return BrowserToolResultBuilder.pages(pages, entry.session.id)

        return await self.execute_tab_operation(tool_context, operation, browser_id=params.browser_id)


@tool(name="browser_new_tab", code_mode_only=True)
class BrowserNewTab(BrowserToolBase[BrowserNewTabParams]):
    """Create and select a new tab in a Browser instance."""

    name = "browser_new_tab"
    operation_key = "browser.goto"

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
        return self.create_browser_tool_detail(result, open_page_detail(result))

    async def execute(self, tool_context: ToolContext, params: BrowserNewTabParams) -> ToolResult:
        async def operation(service: BrowserService, entry: BrowserRuntimeEntry | None) -> ToolResult:
            if entry is None:
                raise BrowserSDKError(BrowserErrorCode.SESSION_CLOSED, "Browser instance is unavailable.")
            page = await service.open_page(params.url, entry.session.id, browser_id=params.browser_id)
            return BrowserToolResultBuilder.page(page, "New Browser tab created and selected.")

        return await self.execute_tab_operation(
            tool_context,
            operation,
            browser_id=params.browser_id,
            create=True,
            screenshot=True,
        )


@tool(name="browser_select_instance", code_mode_only=True)
class BrowserSelectInstance(BrowserToolBase[BrowserSelectInstanceParams]):
    """Make a Browser instance the default target for later operations."""

    name = "browser_select_instance"
    operation_key = "browser.select_instance"

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
        return self.create_browser_tool_detail(result, list_sessions_detail(result))

    async def execute(self, tool_context: ToolContext, params: BrowserSelectInstanceParams) -> ToolResult:
        async def operation() -> ToolResult:
            entry = await BrowserService(tool_context).select_instance(params.browser_id)
            current_tab_id = BrowserToolResultBuilder.public_tab_id(entry.current_page_id) if entry.current_page_id else None
            return ToolResult(
                content=(
                    f"Default Browser instance is now {entry.browser_id}."
                    + (f" Current tab: {current_tab_id}." if current_tab_id else " No current tab is selected.")
                ),
                data={"browser_id": entry.browser_id, "current_browser": entry.browser_id, "current_tab_id": current_tab_id},
            )

        return await self.execute_safely(operation())


@tool(name="browser_select_tab", code_mode_only=True)
class BrowserSelectTab(BrowserToolBase[BrowserTabTargetParams]):
    """Select an existing tab for subsequent Browser operations without activating the user foreground."""

    name = "browser_select_tab"
    operation_key = "browser.select_tab"

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
        return self.create_browser_tool_detail(result, select_tab_detail(result))

    async def execute(self, tool_context: ToolContext, params: BrowserTabTargetParams) -> ToolResult:
        async def operation(service: BrowserService, entry: BrowserRuntimeEntry | None) -> ToolResult:
            if entry is None:
                raise BrowserSDKError(BrowserErrorCode.PAGE_NOT_FOUND, "No Browser tab is available to select.")
            target_entry, page = await service.resolve_tab(params.tab_id)
            selected = await service.select_page(page.id, target_entry.session.id)
            return BrowserToolResultBuilder.page(selected, "Browser tab selected as the default tab.")

        return await self.execute_tab_operation(tool_context, operation, tab_id=params.tab_id, screenshot=True)


@tool(name="browser_activate_tab", code_mode_only=True)
class BrowserActivateTab(BrowserToolBase[BrowserActivateTabParams]):
    """Activate a tab in the user foreground without changing the Agent default target."""

    name = "browser_activate_tab"
    operation_key = "browser.activate_tab"

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
        return self.create_browser_tool_detail(result, activate_page_detail(result))

    async def execute(self, tool_context: ToolContext, params: BrowserActivateTabParams) -> ToolResult:
        async def operation(service: BrowserService, entry: BrowserRuntimeEntry | None) -> ToolResult:
            if entry is None:
                raise BrowserSDKError(BrowserErrorCode.PAGE_NOT_FOUND, "No Browser tab is available to activate.")
            target_entry = entry
            target_page_id = entry.current_page_id
            if params.tab_id is not None:
                target_entry, target_page = await service.resolve_tab(params.tab_id)
                target_page_id = target_page.id
            if target_page_id is None:
                raise BrowserSDKError(BrowserErrorCode.PAGE_NOT_FOUND, "No current tab is selected.")
            page = await service.activate_page(target_page_id, target_entry.session.id)
            return BrowserToolResultBuilder.page(page, "Browser tab activation completed.")

        return await self.execute_tab_operation(
            tool_context,
            operation,
            tab_id=params.tab_id,
            screenshot=True,
        )


@tool(name="browser_close_tab", code_mode_only=True)
class BrowserCloseTab(BrowserToolBase[BrowserCloseTabParams]):
    """Close the default tab or one explicitly selected tab."""

    name = "browser_close_tab"
    operation_key = "browser.close_page"

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
        return self.create_browser_tool_detail(result, close_page_detail(result, arguments or {}))

    async def execute(self, tool_context: ToolContext, params: BrowserCloseTabParams) -> ToolResult:
        async def operation(service: BrowserService, entry: BrowserRuntimeEntry | None) -> ToolResult:
            if entry is None:
                raise BrowserSDKError(BrowserErrorCode.PAGE_NOT_FOUND, "No Browser tab is available to close.")
            pages = await service.list_pages(entry.session.id)
            target_page_id = entry.current_page_id
            if params.tab_id is not None:
                target_entry, target_page = await service.resolve_tab(params.tab_id)
                if target_entry is not entry:
                    raise BrowserSDKError(BrowserErrorCode.PAGE_NOT_FOUND, "The requested tab belongs to another Browser instance.")
                target_page_id = target_page.id
            page = next((page for page in pages if page.id == target_page_id), None)
            if page is None:
                raise BrowserSDKError(BrowserErrorCode.PAGE_NOT_FOUND, "The requested tab is unavailable.")
            await service.close_page(page.id, entry.session.id)
            return BrowserToolResultBuilder.closed_page(page, entry.current_page_id)

        return await self.execute_tab_operation(
            tool_context,
            operation,
            tab_id=params.tab_id,
        )
