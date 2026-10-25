"""Super Magic Browser 工具使用的统一宿主服务。"""

from __future__ import annotations

import asyncio
import os
import stat
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass, replace
from pathlib import Path
from typing import ClassVar
from weakref import WeakValueDictionary

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from app.service.browser.browser_config_adapter import BrowserConfigAdapter
from app.service.browser.browser_file_adapter import BrowserFileAdapter
from app.service.browser.browser_interruption import await_browser_operation, require_agent_context
from app.service.browser.browser_runtime_registry import BrowserRuntimeEntry, BrowserRuntimeRegistry
from app.service.browser.chrome_extension_connection_registry import ChromeExtensionConnectionRegistry
from app.utils.async_file_utils import async_realpath, async_stat
from magic_use import BrowserClient, create_browser
from magic_use.backends.chrome_extension import ChromeExtensionBackend
from magic_use.errors import BrowserErrorCode, BrowserSDKError
from magic_use.extension import ChromeExtensionConfig, PairingDetails, TunnelProvider
from magic_use.models import (
    ActionRequest,
    ActionResult,
    ActionTarget,
    BrowserBackendKind,
    BrowserEvent,
    BrowserPage,
    BrowserSession,
    ConsoleEntry,
    DiagnosticBatch,
    NetworkEntry,
    PageElements,
    FindQuery,
    FindResult,
    ScreenshotResult,
    ElementQuery,
    WaitRequest,
)
from magic_use.models.common import JsonValue, SessionState

logger = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class ChromeBrowserSession:
    session: BrowserSession
    pairing: PairingDetails


class BrowserService:
    """隔离 AgentContext 生命周期与独立 Browser SDK。"""

    _creation_locks: ClassVar[WeakValueDictionary[str, asyncio.Lock]] = WeakValueDictionary()

    def __init__(self, tool_context: ToolContext) -> None:
        self._tool_context = tool_context
        self._agent_context = require_agent_context(tool_context)
        self._registry = BrowserRuntimeRegistry.get_instance()

    async def list_sessions(self) -> tuple[BrowserSession, ...]:
        entries = self._registry.list(self._agent_context.context_id)
        return tuple([await self._refresh(entry) for entry in entries])

    async def list_instances(self) -> tuple[BrowserRuntimeEntry, ...]:
        entries = self._registry.list(self._agent_context.context_id)
        for entry in entries:
            await self._refresh(entry)
            pages = await await_browser_operation(self._tool_context, entry.client.list_pages())
            self._sync_tab_ids(entry, pages)
        return entries

    async def create_chrome_session(
        self,
        tunnel_provider: TunnelProvider,
        *,
        extension_config: ChromeExtensionConfig | None = None,
        make_default: bool = True,
    ) -> ChromeBrowserSession:
        """由受保护的产品配对流程创建用户 Chrome session，不经过 Agent 工具。"""
        runtime_config = await BrowserConfigAdapter.build(
            self._agent_context.get_workspace_dir(),
            backend_override=BrowserBackendKind.CHROME_EXTENSION,
        )
        resolved_extension_config = extension_config or ChromeExtensionConfig()
        sandbox_id = self._agent_context.get_sandbox_id() or self._agent_context.get_workspace_dir()
        connection = await ChromeExtensionConnectionRegistry.get_instance().get_or_create(
            sandbox_id,
            extension_config=resolved_extension_config,
            tunnel_provider=tunnel_provider,
        )
        backend = ChromeExtensionBackend(
            runtime_config,
            extension_config=resolved_extension_config,
            connection=connection,
            session_label=self._agent_context.get_agent_session_label(),
        )
        client = await await_browser_operation(
            self._tool_context,
            BrowserClient.create_with_backend(backend),
        )
        try:
            session = await await_browser_operation(self._tool_context, client.get_session())
            pairing = backend.pairing_details
            if pairing is None:
                raise BrowserSDKError(
                    BrowserErrorCode.CONNECTION_FAILED,
                    "Chrome extension pairing did not start.",
                )
        except BaseException:
            await client.close()
            raise
        entry = BrowserRuntimeEntry(client=client, session=session, is_default=make_default)
        context_id = self._agent_context.context_id
        self._registry.register(context_id, entry)
        return ChromeBrowserSession(session=session, pairing=pairing)

    async def list_pages(
        self,
        session_id: str | None = None,
        *,
        browser_id: str | None = None,
    ) -> tuple[BrowserPage, ...]:
        entry = await self._resolve_entry(session_id, browser_id=browser_id)
        pages = await await_browser_operation(self._tool_context, entry.client.list_pages())
        self._sync_tab_ids(entry, pages)
        self._select_current_page(entry, pages, require_selection=False)
        return tuple(replace(page, active=page.id == entry.current_page_id) for page in pages)

    async def resolve_tab(self, tab_id: str) -> tuple[BrowserRuntimeEntry, BrowserPage]:
        """Resolve a short Tab ID to its owning runtime entry and SDK page."""
        context_id = self._agent_context.context_id
        for entry in self._registry.list(context_id):
            pages = await await_browser_operation(self._tool_context, entry.client.list_pages())
            self._sync_tab_ids(entry, pages)
            page_id = self._registry.page_id(context_id, entry, tab_id)
            if page_id is None:
                continue
            page = next((page for page in pages if page.id == page_id), None)
            if page is not None:
                return entry, page
        raise BrowserSDKError(
            BrowserErrorCode.PAGE_NOT_FOUND,
            f"Browser tab is not available: {tab_id}",
        )

    async def select_instance(self, browser_id: str) -> BrowserRuntimeEntry:
        entry = await self._resolve_entry(None, browser_id=browser_id)
        self._registry.set_default(self._agent_context.context_id, entry)
        return entry

    async def short_tab_id(self, page_id: str, session_id: str) -> str:
        entry = await self._resolve_entry(session_id)
        return self._registry.tab_id(self._agent_context.context_id, entry, page_id)

    @asynccontextmanager
    async def session_operation(
        self,
        session_id: str | None = None,
        *,
        browser_id: str | None = None,
        create: bool = False,
    ) -> AsyncIterator[BrowserRuntimeEntry | None]:
        """同一会话从动作到截图串行执行；查询空会话不会分配浏览器。"""
        entry = None
        if session_id is None and browser_id is None:
            entry = self._registry.get_default(self._agent_context.context_id)
        elif browser_id is not None:
            entry = self._registry.get_by_browser_id(self._agent_context.context_id, browser_id)
        if session_id is None and browser_id is None and entry is None and not create:
            yield None
            return
        resolved_session_id = entry.session.id if entry is not None and not create else session_id
        entry = await self._resolve_entry(resolved_session_id, browser_id=browser_id)
        acquired = False

        async def acquire() -> None:
            nonlocal acquired
            await entry.operation_lock.acquire()
            acquired = True

        try:
            await await_browser_operation(self._tool_context, acquire(), keep_alive=True)
            yield entry
        finally:
            # 获取锁与中断可同时完成，仍须释放本次已经取得的锁。
            if acquired:
                entry.operation_lock.release()

    @asynccontextmanager
    async def current_page(
        self,
        session_id: str | None = None,
        *,
        browser_id: str | None = None,
        tab_id: str | None = None,
        navigate_url: str | None = None,
        wait_until: str = "domcontentloaded",
    ) -> AsyncIterator[BrowserPage]:
        """只解析一次操作页，锁由调用方持有到结果、Horizon 和截图完成。"""
        target_page_id: str | None = None
        if tab_id is not None:
            resolved_entry, target_page = await self.resolve_tab(tab_id)
            if browser_id is not None and resolved_entry.browser_id != browser_id:
                raise BrowserSDKError(
                    BrowserErrorCode.PAGE_NOT_FOUND,
                    f"Tab {tab_id} does not belong to Browser instance {browser_id}.",
                )
            target_page_id = target_page.id
            session_id = resolved_entry.session.id
        async with self.session_operation(
            session_id,
            browser_id=browser_id,
            create=navigate_url is not None and tab_id is None,
        ) as entry:
            if entry is None:
                raise BrowserSDKError(BrowserErrorCode.PAGE_NOT_FOUND, "No current tab. Use browser_navigate to visit a URL.")
            pages = await await_browser_operation(self._tool_context, entry.client.list_pages())
            self._sync_tab_ids(entry, pages)
            page = (
                next((item for item in pages if item.id == target_page_id), None)
                if target_page_id is not None
                else self._select_current_page(entry, pages)
            )
            if target_page_id is not None and page is None:
                raise BrowserSDKError(BrowserErrorCode.PAGE_NOT_FOUND, "The requested Browser tab is no longer available.")
            if navigate_url is not None:
                if page is None:
                    page = await self.open_page(navigate_url, entry.session.id, wait_until=wait_until)
                else:
                    page = await self.navigate(page.id, navigate_url, wait_until, entry.session.id)
            if page is None:
                raise BrowserSDKError(BrowserErrorCode.PAGE_NOT_FOUND, "No current tab. Use browser_navigate to visit a URL.")
            yield replace(page, active=page.id == entry.current_page_id)

    @staticmethod
    def _select_current_page(
        entry: BrowserRuntimeEntry,
        pages: tuple[BrowserPage, ...],
        *,
        require_selection: bool = True,
    ) -> BrowserPage | None:
        previous_id = entry.current_page_id
        for page in pages:
            if page.id == previous_id:
                return replace(page, active=True)
        if not pages:
            entry.current_page_id = None
            return None
        # 首次使用用户 Chrome 只接受明确的授权目标；已失效的选定页按列表顺序选择后继。
        if previous_id is None and entry.session.backend is BrowserBackendKind.CHROME_EXTENSION:
            active_pages = [page for page in pages if page.active]
            if len(active_pages) == 1:
                selected = active_pages[0]
            elif len(pages) == 1:
                selected = pages[0]
            elif require_selection:
                raise BrowserSDKError(
                    BrowserErrorCode.PAGE_NOT_FOUND,
                    "Several authorized tabs are available. Use browser_list_tabs and browser_select_tab to choose one.",
                )
            else:
                return None
        else:
            selected = pages[0]
        entry.current_page_id = selected.id
        return replace(selected, active=True)

    async def get_session(self, session_id: str | None = None) -> BrowserSession:
        entry = await self._resolve_entry(session_id)
        return await self._refresh(entry)

    async def open_page(
        self,
        url: str,
        session_id: str | None = None,
        *,
        browser_id: str | None = None,
        wait_until: str = "domcontentloaded",
    ) -> BrowserPage:
        entry = await self._resolve_entry(session_id, browser_id=browser_id)

        async def create_page() -> BrowserPage:
            page = await entry.client.open_page()
            try:
                if url != "about:blank":
                    page = await entry.client.navigate(page.id, url, wait_until)
            except BaseException:
                # 无当前页的 navigate 同样遵守 wait_until；新页失败不能留作下一次隐式目标。
                try:
                    await entry.client.close_page(page.id)
                except Exception:
                    logger.warning("Failed to close a new Browser tab after navigation failure", exc_info=True)
                raise
            entry.current_page_id = page.id
            self._sync_tab_ids(entry, (page,))
            if browser_id is not None:
                self._registry.set_default(self._agent_context.context_id, entry)
            return replace(page, active=True)

        return await await_browser_operation(self._tool_context, create_page())

    async def close_page(self, page_id: str, session_id: str | None = None) -> None:
        entry = await self._resolve_entry(session_id)
        await await_browser_operation(self._tool_context, entry.client.close_page(page_id))
        await self._refresh(entry)
        pages = await await_browser_operation(self._tool_context, entry.client.list_pages())
        self._select_current_page(entry, pages, require_selection=False)

    async def activate_page(self, page_id: str, session_id: str | None = None) -> BrowserPage:
        entry = await self._resolve_entry(session_id)
        page = await await_browser_operation(self._tool_context, entry.client.activate_page(page_id))
        self._sync_tab_ids(entry, (page,))
        return replace(page, active=page.id == entry.current_page_id)

    async def select_page(self, page_id: str, session_id: str | None = None) -> BrowserPage:
        entry = await self._resolve_entry(session_id)
        page = await self._find_page(entry, page_id)
        entry.current_page_id = page.id
        return replace(page, active=True)

    async def keep_page_alive(
        self,
        page_id: str,
        extension_seconds: float,
        session_id: str | None = None,
    ) -> BrowserPage:
        entry = await self._resolve_entry(session_id)
        page = await await_browser_operation(
            self._tool_context,
            entry.client.keep_page_alive(page_id, extension_seconds),
        )
        return replace(page, active=page.id == entry.current_page_id)

    async def navigate(
        self,
        page_id: str,
        url: str,
        wait_until: str,
        session_id: str | None = None,
    ) -> BrowserPage:
        entry = await self._resolve_entry(session_id)
        page = await await_browser_operation(
            self._tool_context,
            entry.client.navigate(page_id, url, wait_until),
        )
        return replace(page, active=page.id == entry.current_page_id)

    async def wait(
        self,
        page_id: str,
        request: WaitRequest,
        session_id: str | None = None,
    ) -> BrowserPage:
        entry = await self._resolve_entry(session_id)
        keep_alive = request.timeout_ms > 60_000 or (request.duration_ms or 0) > 60_000
        try:
            await await_browser_operation(
                self._tool_context,
                entry.client.wait(page_id, request),
                keep_alive=keep_alive,
            )
        except asyncio.CancelledError:
            raise
        except BrowserSDKError as error:
            if error.code in {
                BrowserErrorCode.SESSION_CLOSED,
                BrowserErrorCode.PAGE_NOT_FOUND,
                BrowserErrorCode.PAGE_CLOSED,
                BrowserErrorCode.PAGE_EXPIRED,
            }:
                raise
            raise await self._build_wait_error(entry, page_id, request, error) from error
        except Exception as error:
            raise await self._build_wait_error(entry, page_id, request, error) from error
        return await self._find_page(entry, page_id)

    async def read_page(
        self,
        page_id: str,
        scope: str,
        session_id: str | None = None,
    ) -> tuple[BrowserPage, str]:
        entry = await self._resolve_entry(session_id)
        sdk_scope = "all" if scope == "full" else scope
        content = await await_browser_operation(
            self._tool_context,
            entry.client.read_page(page_id, sdk_scope),
        )
        return await self._find_page(entry, page_id), content

    async def read_html(
        self,
        page_id: str,
        *,
        ref: str | None,
        detail: str,
        max_chars: int,
        session_id: str | None = None,
    ) -> tuple[BrowserPage, str, bool]:
        entry = await self._resolve_entry(session_id)
        content, truncated = await await_browser_operation(
            self._tool_context,
            entry.client.read_html(
                page_id,
                ref=ref,
                detail=detail,
                max_chars=max_chars,
            ),
        )
        return await self._find_page(entry, page_id), content, truncated

    async def add_init_script(self, page_id: str, source: str, session_id: str | None = None) -> None:
        entry = await self._resolve_entry(session_id)
        await await_browser_operation(self._tool_context, entry.client.add_init_script(page_id, source))

    async def snapshot(
        self,
        page_id: str,
        options: ElementQuery,
        session_id: str | None = None,
    ) -> PageElements:
        entry = await self._resolve_entry(session_id)
        return await await_browser_operation(
            self._tool_context,
            entry.client.snapshot(page_id, options),
        )

    async def find(
        self,
        page_id: str,
        query: FindQuery,
        session_id: str | None = None,
    ) -> FindResult:
        entry = await self._resolve_entry(session_id)
        return await await_browser_operation(self._tool_context, entry.client.find(page_id, query))

    async def describe_current_ref(
        self,
        ref: str,
        session_id: str | None = None,
        *,
        tab_id: str | None = None,
    ) -> ActionTarget | None:
        """调用前文案只查看已选定目标，不创建会话或替用户选择页面。"""
        context_id = self._agent_context.context_id
        if tab_id is not None:
            entry, page = await self.resolve_tab(tab_id)
            page_id = page.id
        else:
            entry = self._registry.get_default(context_id) if session_id is None else self._registry.get(context_id, session_id)
            page_id = entry.current_page_id if entry is not None else None
        if entry is None or page_id is None:
            return None
        return await await_browser_operation(
            self._tool_context,
            entry.client.describe_ref(page_id, ref),
        )

    async def dispatch_action(
        self,
        page_id: str,
        request: ActionRequest,
        session_id: str | None = None,
    ) -> ActionResult:
        entry = await self._resolve_entry(session_id)
        result = await await_browser_operation(
            self._tool_context,
            entry.client.dispatch_action(page_id, request),
        )
        await self._refresh(entry)
        self._sync_tab_ids(entry, result.opened_pages)
        navigation = result.navigation
        if navigation is not None:
            navigation = replace(navigation, page=replace(navigation.page, active=navigation.page.id == entry.current_page_id))
        return replace(
            result,
            navigation=navigation,
            opened_pages=tuple(replace(page, active=page.id == entry.current_page_id) for page in result.opened_pages),
        )

    async def screenshot(
        self,
        page_id: str,
        *,
        full_page: bool,
        labels: bool,
        session_id: str | None = None,
    ) -> tuple[BrowserPage, ScreenshotResult]:
        entry = await self._resolve_entry(session_id)
        result = await await_browser_operation(
            self._tool_context,
            entry.client.screenshot(page_id, full_page=full_page, labels=labels),
        )
        return await self._find_page(entry, page_id), result

    async def visual_query(
        self,
        page_id: str,
        query: str,
        *,
        labels: bool,
        full_page: bool,
        session_id: str | None = None,
    ) -> tuple[BrowserPage, ScreenshotResult, str]:
        page, screenshot = await self.screenshot(
            page_id,
            full_page=full_page,
            labels=labels,
            session_id=session_id,
        )
        analysis = await self.analyze_screenshot(screenshot.image, query)
        return page, screenshot, analysis

    async def analyze_screenshot(self, image: bytes, query: str) -> str:
        from app.tools.visual_understanding import VisualUnderstanding, VisualUnderstandingParams

        async with BrowserFileAdapter.temporary_image(image) as file_path:
            analysis_result = await await_browser_operation(
                self._tool_context,
                VisualUnderstanding().execute_purely(
                    VisualUnderstandingParams(images=[file_path], query=query),
                    include_download_info_in_content=False,
                    include_dimensions_info_in_content=False,
                    skip_format_validation=True,
                ),
                keep_alive=True,
            )
        if not analysis_result.ok:
            raise BrowserSDKError(
                BrowserErrorCode.ACTION_FAILED,
                f"Visual analysis is unavailable: {analysis_result.content}",
            )
        return analysis_result.content

    async def evaluate(
        self,
        page_id: str,
        expression: str,
        argument: JsonValue = None,
        session_id: str | None = None,
    ) -> JsonValue:
        entry = await self._resolve_entry(session_id)
        return await await_browser_operation(
            self._tool_context,
            entry.client.evaluate(page_id, expression, argument),
        )

    async def read_console(
        self,
        page_id: str,
        *,
        clear: bool,
        limit: int,
        session_id: str | None = None,
    ) -> DiagnosticBatch[ConsoleEntry]:
        entry = await self._resolve_entry(session_id)
        return await await_browser_operation(
            self._tool_context,
            entry.client.read_console(page_id, clear=clear, limit=limit),
        )

    async def read_network(
        self,
        page_id: str,
        *,
        clear: bool,
        limit: int,
        session_id: str | None = None,
    ) -> DiagnosticBatch[NetworkEntry]:
        entry = await self._resolve_entry(session_id)
        return await await_browser_operation(
            self._tool_context,
            entry.client.read_network(page_id, clear=clear, limit=limit),
        )

    async def drain_events(self, session_id: str | None = None) -> tuple[BrowserEvent, ...]:
        entry = await self._resolve_entry(session_id)
        return await await_browser_operation(self._tool_context, entry.client.drain_events())

    async def resolve_upload_paths(self, file_paths: tuple[str, ...]) -> tuple[str, ...]:
        workspace = await async_realpath(self._agent_context.get_workspace_dir(), strict=True)
        resolved: list[str] = []
        for file_path in file_paths:
            candidate = Path(file_path)
            if not candidate.is_absolute():
                candidate = workspace / candidate
            try:
                candidate = await async_realpath(candidate, strict=True)
            except FileNotFoundError as error:
                raise ValueError(
                    f"Upload file does not exist in the workspace shared with the browser: {file_path}"
                ) from error
            if os.path.commonpath((workspace, candidate)) != str(workspace):
                raise ValueError(
                    "Upload files must be inside the current workspace. "
                    f"Use a workspace-relative path or an absolute path within the workspace: {file_path}"
                )
            try:
                file_stat = await async_stat(candidate)
            except FileNotFoundError as error:
                raise ValueError(
                    f"Upload file does not exist in the workspace shared with the browser: {file_path}"
                ) from error
            if not stat.S_ISREG(file_stat.st_mode):
                raise ValueError(f"Upload path must identify a regular workspace file: {file_path}")
            resolved.append(str(candidate))
        return tuple(resolved)

    async def _resolve_entry(
        self,
        session_id: str | None,
        *,
        browser_id: str | None = None,
    ) -> BrowserRuntimeEntry:
        if browser_id is not None:
            entry = self._registry.get_by_browser_id(self._agent_context.context_id, browser_id)
            if entry is None:
                raise BrowserSDKError(
                    BrowserErrorCode.SESSION_CLOSED,
                    f"Browser instance is not available in the current Agent context: {browser_id}",
                )
            session_id = entry.session.id
        if session_id is None:
            return await self._get_or_create_default()
        entry = self._registry.get(self._agent_context.context_id, session_id)
        display_id = browser_id or self._registry.public_browser_id(session_id)
        if entry is None:
            raise BrowserSDKError(
                BrowserErrorCode.SESSION_CLOSED,
                f"Browser instance is not available in the current Agent context: {display_id}",
            )
        session = await self._refresh(entry)
        if session.state is not SessionState.CONNECTED:
            self._registry.remove(self._agent_context.context_id, session.id)
            await entry.client.close()
            raise BrowserSDKError(
                BrowserErrorCode.SESSION_CLOSED,
                f"Browser instance is no longer active: {display_id}",
            )
        return entry

    async def _get_or_create_default(self) -> BrowserRuntimeEntry:
        context_id = self._agent_context.context_id
        current = self._registry.get_default(context_id)
        if current is not None:
            session = await self._refresh(current)
            if session.state is SessionState.CONNECTED:
                return current
            self._registry.remove(context_id, session.id)
            await current.client.close()

        lock = self._creation_locks.setdefault(context_id, asyncio.Lock())
        async with lock:
            current = self._registry.get_default(context_id)
            if current is not None:
                session = await self._refresh(current)
                if session.state is SessionState.CONNECTED:
                    return current
                self._registry.remove(context_id, session.id)
                await current.client.close()

            runtime_config = await BrowserConfigAdapter.build(self._agent_context.get_workspace_dir())
            if runtime_config.backend is BrowserBackendKind.CHROME_EXTENSION:
                raise BrowserSDKError(
                    BrowserErrorCode.INVALID_CONFIG,
                    "The default Chrome extension session must be created by the protected product pairing flow.",
                )
            client = await await_browser_operation(
                self._tool_context,
                create_browser(runtime_config),
                keep_alive=runtime_config.backend is BrowserBackendKind.REMOTE_PLAYWRIGHT,
            )
            try:
                session = await await_browser_operation(self._tool_context, client.get_session())
            except BaseException:
                await client.close()
                raise
            entry = BrowserRuntimeEntry(client=client, session=session, is_default=True)
            self._registry.register(context_id, entry)
            return entry

    async def _refresh(self, entry: BrowserRuntimeEntry) -> BrowserSession:
        entry.session = await await_browser_operation(self._tool_context, entry.client.get_session())
        return entry.session

    def _sync_tab_ids(self, entry: BrowserRuntimeEntry, pages: tuple[BrowserPage, ...]) -> None:
        context_id = self._agent_context.context_id
        for page in pages:
            self._registry.assign_tab_id(context_id, entry, page.id)

    async def _find_page(self, entry: BrowserRuntimeEntry, page_id: str) -> BrowserPage:
        pages = await await_browser_operation(self._tool_context, entry.client.list_pages())
        self._sync_tab_ids(entry, pages)
        for page in pages:
            if page.id == page_id:
                return replace(page, active=page.id == entry.current_page_id)
        raise BrowserSDKError(BrowserErrorCode.PAGE_NOT_FOUND, f"Browser page is not available: {page_id}")

    async def _build_wait_error(
        self,
        entry: BrowserRuntimeEntry,
        page_id: str,
        request: WaitRequest,
        error: Exception,
    ) -> BrowserSDKError:
        expected = request.value or request.state or request.duration_ms
        condition = request.condition.value
        try:
            page = await self._find_page(entry, page_id)
            current_page = f"Current page title: {page.title!r}. Current URL: {page.url}."
        except asyncio.CancelledError:
            raise
        except Exception:
            current_page = "The current page state could not be read."
        return BrowserSDKError(
            BrowserErrorCode.ACTION_FAILED,
            f"Wait condition was not satisfied: {condition}={expected!r}. {current_page} "
            "Read the current page before retrying; navigation may have stopped on an intermediate "
            f"page such as human verification. Original wait error: {error}",
        )
