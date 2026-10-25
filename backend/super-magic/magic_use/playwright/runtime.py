from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable, Coroutine
from datetime import datetime, timedelta, timezone
from typing import TypeVar
from uuid import uuid4
from weakref import WeakKeyDictionary

from playwright.async_api import (
    Browser,
    BrowserContext,
    Download,
    Error as PlaywrightError,
    Frame,
    Page,
    Request,
    TimeoutError as PlaywrightTimeoutError,
)

from magic_use.config import BrowserRuntimeConfig
from magic_use.errors import BrowserConnectionError, BrowserErrorCode, BrowserPageError, BrowserSDKError
from magic_use.models.common import BrowserEventType, BrowserName, JsonValue, PageReadiness, PageState
from magic_use.models.diagnostics import ConsoleEntry, DiagnosticBatch, NetworkEntry
from magic_use.models.events import BrowserEvent
from magic_use.models.page import BrowserPage
from magic_use.playwright.context_lease import PlaywrightContextLease
from magic_use.playwright.host_pool import PlaywrightHostPool
from magic_use.playwright.state import ClosedPageRecord, PlaywrightPageHandle

logger = logging.getLogger(__name__)
T = TypeVar("T")


class PlaywrightRuntime:
    def __init__(self, config: BrowserRuntimeConfig) -> None:
        self.config = config
        self.session_id = f"session_{uuid4().hex}"
        self.browser: Browser | None = None
        self.context: BrowserContext | None = None
        self.context_lease: PlaywrightContextLease | None = None
        self.pages: dict[str, PlaywrightPageHandle] = {}
        self.closed_pages: dict[str, ClosedPageRecord] = {}
        self.active_page_id: str | None = None
        self.events: list[BrowserEvent] = []
        self.console_entries: list[ConsoleEntry] = []
        self.network_entries: list[NetworkEntry] = []
        self.active_requests: dict[str, set[Request]] = {}
        self.background_tasks: set[asyncio.Task[object]] = set()
        self.page_registration_tasks: set[asyncio.Task[object]] = set()
        self._page_registration_lock = asyncio.Lock()
        self._page_registration_errors: WeakKeyDictionary[Page, BrowserSDKError] = WeakKeyDictionary()
        self.document_ready_handler: Callable[[Page], Awaitable[None]] | None = None
        self.disconnect_handler: Callable[[], None] | None = None
        self.context_idle_handler: Callable[[], Awaitable[None]] | None = None
        self._empty_since: float | None = None
        self._lifecycle_task: asyncio.Task[None] | None = None

    async def start_local(self) -> None:
        await self._acquire_context()

    async def start_remote(self) -> None:
        await self._acquire_context()

    async def close(self) -> None:
        lifecycle_task = self._lifecycle_task
        self._lifecycle_task = None
        if lifecycle_task is not None and lifecycle_task is not asyncio.current_task():
            lifecycle_task.cancel()
            await asyncio.gather(lifecycle_task, return_exceptions=True)
        await self._cancel_background_tasks()
        context = self.context
        lease = self.context_lease
        self.context = None
        self.context_lease = None
        if context is not None:
            try:
                if self.config.context.storage_state_path is not None:
                    await context.storage_state(path=self.config.context.storage_state_path)
            except Exception:
                logger.exception("Failed to persist Playwright storage state")
        for page_id in tuple(self.pages):
            await self._unregister_page(page_id)
        if lease is not None:
            await lease.release()
        self.browser = None
        await self._cancel_background_tasks()
        self.pages.clear()
        self.active_page_id = None

    async def open_page(self, url: str = "about:blank") -> PlaywrightPageHandle:
        context = self._require_context()
        self._require_lease().ensure_page_capacity()
        # new_page 被取消不代表远端没有创建；保留本次 Task，取得确切 Page 后定向清理。
        creation_task = asyncio.create_task(context.new_page())
        page: Page | None = None
        try:
            page = await asyncio.shield(creation_task)
            handle = await self._register_page(page, opener_page_id=None)
            if url != "about:blank":
                await page.goto(url, wait_until="domcontentloaded", timeout=self.config.timeouts.navigation_ms)
            return handle
        except BaseException:
            if page is None:
                try:
                    page = await creation_task
                except (asyncio.CancelledError, Exception):
                    logger.warning("Failed to obtain a newly created Playwright page during cleanup", exc_info=True)
            if page is not None:
                await self.discard_new_page(page)
            raise

    async def discard_new_page(self, page: Page) -> None:
        """只回收本次失败创建的页；关闭失败仍保留已登记句柄供原有 TTL 处理。"""
        try:
            if not page.is_closed():
                await page.close()
        except Exception:
            logger.exception("Failed to close a newly created Playwright page")
            return
        handle = next((item for item in self.pages.values() if item.page == page), None)
        if handle is not None:
            await self._unregister_page(handle.page_id)

    async def close_page(self, page_id: str) -> None:
        handle = self.require_page(page_id)
        await handle.page.close()
        await self._unregister_page(page_id)

    async def activate_page(self, page_id: str) -> PlaywrightPageHandle:
        handle = self.require_page(page_id)
        await handle.page.bring_to_front()
        self.active_page_id = page_id
        self._emit(BrowserEventType.PAGE_ACTIVATED, page_id)
        return handle

    def require_page(self, page_id: str) -> PlaywrightPageHandle:
        handle = self.pages.get(page_id)
        if handle is None:
            closed = self.closed_pages.get(page_id)
            if closed is not None and closed.reason == "idle_timeout":
                raise BrowserPageError(
                    f"Browser page expired after being idle: {page_id}",
                    expired=True,
                )
            raise BrowserPageError(f"Browser page does not exist: {page_id}")
        if handle.page.is_closed():
            raise BrowserPageError(f"Browser page is closed: {page_id}", closed=True)
        self.touch_page(page_id)
        return handle

    def touch_page(self, page_id: str, extension_seconds: float | None = None) -> PlaywrightPageHandle:
        handle = self.pages.get(page_id)
        if handle is None:
            return self.require_page(page_id)
        seconds = self.config.lifecycle.page_idle_seconds
        if extension_seconds is not None:
            seconds = min(extension_seconds, self.config.lifecycle.page_keep_alive_max_seconds)
        handle.expires_at = datetime.now(timezone.utc) + timedelta(seconds=seconds)
        self._empty_since = None
        return handle

    async def keep_page_alive(self, page_id: str, extension_seconds: float) -> BrowserPage:
        if extension_seconds > self.config.lifecycle.page_keep_alive_max_seconds:
            raise ValueError(
                f"Browser page keep-alive cannot exceed {self.config.lifecycle.page_keep_alive_max_seconds:g} seconds"
            )
        handle = self.require_page(page_id)
        self.touch_page(page_id, extension_seconds)
        return await self.describe_page(handle)

    async def describe_page(self, handle: PlaywrightPageHandle) -> BrowserPage:
        page_closed = handle.page.is_closed()
        return BrowserPage(
            id=handle.page_id,
            session_id=self.session_id,
            target_id=f"playwright:{handle.page_id}",
            url=handle.page.url,
            title="" if page_closed else await self._read_page_title(handle),
            state=PageState.CLOSED if page_closed else PageState.OPEN,
            active=handle.page_id == self.active_page_id,
            opener_page_id=handle.opener_page_id,
            document_generation=handle.document_generation,
            expires_at=handle.expires_at,
            resource_warning=handle.resource_warning or (self.context_lease.resource_warning if self.context_lease else None),
            readiness=handle.readiness,
            redirect_chain=tuple(handle.url_history) if len(handle.url_history) > 1 else (),
        )

    async def _read_page_title(self, handle: PlaywrightPageHandle) -> str:
        try:
            return await handle.page.title()
        except PlaywrightError as error:
            if handle.page.is_closed():
                raise BrowserPageError(f"Browser page is closed: {handle.page_id}", closed=True) from error
            if _is_navigation_context_error(error):
                return ""
            raise

    async def list_pages(self) -> tuple[BrowserPage, ...]:
        result = []
        for handle in tuple(self.pages.values()):
            if not handle.page.is_closed() and handle.page not in self._page_registration_errors:
                result.append(await self.describe_page(handle))
        return tuple(result)

    def drain_events(self) -> tuple[BrowserEvent, ...]:
        events = tuple(self.events)
        self.events.clear()
        return events

    def read_console(self, page_id: str, *, clear: bool, limit: int) -> DiagnosticBatch[ConsoleEntry]:
        page_entries = tuple(entry for entry in self.console_entries if entry.page_id == page_id)
        result = page_entries[-limit:]
        if clear:
            self.console_entries = [entry for entry in self.console_entries if entry.page_id != page_id]
        return DiagnosticBatch(entries=result, total_count=len(page_entries))

    def read_network(self, page_id: str, *, clear: bool, limit: int) -> DiagnosticBatch[NetworkEntry]:
        page_entries = tuple(entry for entry in self.network_entries if entry.page_id == page_id)
        result = page_entries[-limit:]
        if clear:
            self.network_entries = [entry for entry in self.network_entries if entry.page_id != page_id]
        return DiagnosticBatch(
            entries=result,
            total_count=len(page_entries),
            pending_count=len(self.active_requests.get(page_id, ())),
        )

    def set_document_ready_handler(self, handler: Callable[[Page], Awaitable[None]]) -> None:
        self.document_ready_handler = handler

    def set_disconnect_handler(self, handler: Callable[[], None]) -> None:
        self.disconnect_handler = handler
        if self.context_lease is not None:
            self.context_lease.set_disconnect_handler(handler)

    def set_context_idle_handler(self, handler: Callable[[], Awaitable[None]]) -> None:
        self.context_idle_handler = handler

    def emit(
        self,
        event_type: BrowserEventType,
        page_id: str | None,
        data: dict[str, JsonValue] | None = None,
    ) -> None:
        self._emit(event_type, page_id, data)

    async def _acquire_context(self) -> None:
        lease = await PlaywrightHostPool.get_instance().acquire(self.config)
        self.context_lease = lease
        self.context = lease.context
        self.browser = lease.browser
        if self.disconnect_handler is not None:
            lease.set_disconnect_handler(self.disconnect_handler)
        self.context.on("page", self._on_context_page)
        self._lifecycle_task = asyncio.create_task(self._run_lifecycle())

    async def _register_page(self, page: Page, opener_page_id: str | None) -> PlaywrightPageHandle:
        async with self._page_registration_lock:
            registration_error = self._page_registration_errors.get(page)
            if registration_error is not None:
                raise BrowserSDKError(registration_error.code, str(registration_error))
            if page.is_closed():
                raise BrowserPageError("Cannot register a closed Browser page", closed=True)
            existing = next((item for item in self.pages.values() if item.page == page), None)
            if existing is not None:
                return existing
            page_id = f"page_{uuid4().hex}"
            lease = self._require_lease()
            reserved = False
            handle: PlaywrightPageHandle | None = None
            try:
                # 创建前预检查不代替最终预占：并发新页和网站 popup 都必须经过这里。
                resource_warning = lease.reserve_page()
                reserved = True
                handle = PlaywrightPageHandle(
                    page_id=page_id,
                    page=page,
                    cdp=None,
                    document_generation=0,
                    opener_page_id=opener_page_id,
                    expires_at=datetime.now(timezone.utc)
                    + timedelta(seconds=self.config.lifecycle.page_idle_seconds),
                    resource_warning=resource_warning,
                    readiness=PageReadiness.STABLE if page.url == "about:blank" else PageReadiness.LOADING,
                    url_history=[page.url] if page.url else [],
                )
                # 在第一个 await 前登记所有权；初始化失败且 close 也失败时，TTL 仍能找到此页。
                self.pages[page_id] = handle
                self.active_requests[page_id] = set()
                self._empty_since = None
                page.on("close", lambda: self._schedule(self._unregister_page(page_id)))
                if self.config.browser_name is BrowserName.CHROMIUM:
                    handle.cdp = await self._require_context().new_cdp_session(page)
                    override = lease.user_agent_override
                    if override is not None:
                        await handle.cdp.send(
                            "Emulation.setUserAgentOverride",
                            override.to_cdp_params(self.config.context.locale),
                        )
                page.on("frameattached", lambda frame: self._on_frame_attached(handle, frame))
                page.on("framedetached", lambda frame: self._on_frame_detached(handle, frame))
                page.on("framenavigated", lambda frame: self._on_frame_navigated(handle, frame))
                page.on("load", lambda: self._on_document_ready(handle))
                page.on("console", lambda message: self._on_console(page_id, message.type, message.text))
                page.on("request", lambda request: self._on_request(handle, request))
                page.on("response", lambda response: self._on_response(page_id, response.request.method, response.url, response.status))
                page.on("requestfinished", lambda request: self._on_request_finished(page_id, request))
                page.on("requestfailed", lambda request: self._on_request_failed(page_id, request))
                page.on(
                    "dialog",
                    lambda dialog: self._emit(
                        BrowserEventType.DIALOG_OPENED,
                        page_id,
                        {"type": dialog.type, "message": dialog.message},
                    ),
                )
                page.on("download", lambda download: self._schedule(self._track_download(page_id, download)))
                if self.document_ready_handler is not None:
                    await self.document_ready_handler(page)
                if page.is_closed():
                    raise BrowserPageError("Browser page closed during registration", closed=True)
                self.active_page_id = page_id
                self._emit(BrowserEventType.PAGE_OPENED, page_id, {"url": page.url})
                return handle
            except BaseException as error:
                # context 的 page 事件可能先登记失败；主动 open 随后必须收到同一失败，
                # 不能把容量拒绝改报为「页面关闭」，或接受 close 失败后仅为清理保留的句柄。
                # 只保存不带 traceback 的错误副本，弱引用不会延长 Page 的生命周期。
                code = error.code if isinstance(error, BrowserSDKError) else BrowserErrorCode.ACTION_FAILED
                self._page_registration_errors[page] = BrowserSDKError(code, str(error) or "Page registration was cancelled.")
                await self.discard_new_page(page)
                if handle is None and reserved:
                    lease.release_page()
                elif handle is not None and page_id not in self.pages and handle.cdp is not None:
                    # close 事件可能先于 CDP 创建返回完成注销，补全该次尚未取得的 CDP 清理。
                    try:
                        await handle.cdp.detach()
                    except Exception:
                        logger.debug("Failed page CDP session was already detached", exc_info=True)
                raise

    async def _unregister_page(self, page_id: str, *, reason: str = "closed") -> None:
        handle = self.pages.pop(page_id, None)
        if handle is None:
            return
        # pop 和名额释放之间不能 await，close 回调与取消清理可同时到达这里。
        self.active_requests.pop(page_id, None)
        if self.active_page_id == page_id:
            self.active_page_id = next(iter(self.pages), None)
        if self.context_lease is not None:
            self.context_lease.release_page()
        if not self.pages:
            self._empty_since = asyncio.get_running_loop().time()
        try:
            title = await handle.page.title() if not handle.page.is_closed() else ""
        except Exception:
            title = ""
        finally:
            if handle.cdp is not None:
                try:
                    await handle.cdp.detach()
                except Exception:
                    logger.debug("Playwright page CDP detach failed", exc_info=True)
        self.closed_pages[page_id] = ClosedPageRecord(
            page_id=page_id,
            url=handle.page.url,
            title=title,
            closed_at=datetime.now(timezone.utc),
            reason=reason,
        )
        if len(self.closed_pages) > 100:
            self.closed_pages.pop(next(iter(self.closed_pages)))
        self._emit(
            BrowserEventType.PAGE_EXPIRED if reason == "idle_timeout" else BrowserEventType.PAGE_CLOSED,
            page_id,
            {"reason": reason},
        )

    def _on_context_page(self, page: Page) -> None:
        task = self._schedule(self._register_context_page(page))
        self.page_registration_tasks.add(task)
        task.add_done_callback(self.page_registration_tasks.discard)

    async def _register_context_page(self, page: Page) -> PlaywrightPageHandle:
        try:
            opener = await page.opener()
            opener_page_id = next(
                (handle.page_id for handle in self.pages.values() if handle.page == opener),
                None,
            )
            return await self._register_page(page, opener_page_id=opener_page_id)
        except BaseException:
            await self.discard_new_page(page)
            raise

    def _on_frame_navigated(self, handle: PlaywrightPageHandle, frame: Frame) -> None:
        main_frame = frame == handle.page.main_frame
        self._emit(
            BrowserEventType.FRAME_NAVIGATED,
            handle.page_id,
            {"url": frame.url, "name": frame.name, "main_frame": main_frame},
        )
        if main_frame:
            if frame.url and (not handle.url_history or handle.url_history[-1] != frame.url):
                handle.url_history.append(frame.url)
                del handle.url_history[:-10]
            handle.document_generation += 1
            handle.readiness = PageReadiness.LOADING
            self._emit(
                BrowserEventType.NAVIGATION_COMMITTED,
                handle.page_id,
                {"url": frame.url},
            )

    def _on_frame_attached(self, handle: PlaywrightPageHandle, frame: Frame) -> None:
        self._emit(
            BrowserEventType.FRAME_ATTACHED,
            handle.page_id,
            {"url": frame.url, "name": frame.name},
        )

    def _on_frame_detached(self, handle: PlaywrightPageHandle, frame: Frame) -> None:
        self._emit(
            BrowserEventType.FRAME_DETACHED,
            handle.page_id,
            {"url": frame.url, "name": frame.name},
        )

    def _schedule(self, coroutine: Coroutine[object, object, object]) -> asyncio.Task[object]:
        task = asyncio.create_task(coroutine)
        self.background_tasks.add(task)
        task.add_done_callback(self._finish_background_task)
        return task

    async def wait_for_pending_pages(self) -> None:
        tasks = tuple(self.page_registration_tasks)
        if tasks:
            await asyncio.gather(*tasks)

    async def wait_for_load(self, page_id: str, *, timeout_ms: float | None = None) -> bool:
        """软等待标准 load；超时表示页面仍可使用，不是导航失败。"""
        handle = self.require_page(page_id)
        try:
            await handle.page.wait_for_load_state(
                "load",
                timeout=timeout_ms or self.config.timeouts.load_timeout_ms,
            )
        except PlaywrightTimeoutError:
            handle.readiness = PageReadiness.LOADING
            return False
        handle.readiness = PageReadiness.STABLE
        return True

    def _finish_background_task(self, task: asyncio.Task[object]) -> None:
        self.background_tasks.discard(task)
        try:
            task.result()
        except asyncio.CancelledError:
            return
        except Exception:
            logger.exception("Playwright background task failed")

    async def _cancel_background_tasks(self) -> None:
        tasks = tuple(self.background_tasks)
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        self.background_tasks.difference_update(tasks)

    def _on_document_ready(self, handle: PlaywrightPageHandle) -> None:
        handle.readiness = PageReadiness.STABLE
        self._emit(
            BrowserEventType.NAVIGATION_COMPLETED,
            handle.page_id,
            {"url": handle.page.url},
        )
        if self.document_ready_handler is not None:
            self._schedule(self.document_ready_handler(handle.page))

    def _on_disconnected(self) -> None:
        self._emit(BrowserEventType.SESSION_DISCONNECTED, None)
        if self.disconnect_handler is not None:
            self.disconnect_handler()

    def _on_console(self, page_id: str, level: str, message: str) -> None:
        occurred_at = datetime.now(timezone.utc)
        self.console_entries.append(
            ConsoleEntry(page_id=page_id, level=level, text=message, occurred_at=occurred_at)
        )
        self._trim_buffer(self.console_entries, self.config.diagnostic_buffer_size)
        self._emit(BrowserEventType.CONSOLE, page_id, {"text": message, "level": level})

    def _on_request(self, handle: PlaywrightPageHandle, request: Request) -> None:
        page_id = handle.page_id
        method = request.method
        url = request.url
        self.active_requests.setdefault(page_id, set()).add(request)
        if request.is_navigation_request() and request.frame == handle.page.main_frame:
            self._emit(BrowserEventType.NAVIGATION_STARTED, page_id, {"url": url})
        self.network_entries.append(
            NetworkEntry(
                page_id=page_id,
                phase="request",
                method=method,
                url=url,
                status=None,
                error=None,
                occurred_at=datetime.now(timezone.utc),
            )
        )
        self._trim_buffer(self.network_entries, self.config.diagnostic_buffer_size)
        self._emit(BrowserEventType.NETWORK_REQUEST, page_id, {"url": url, "method": method})

    def _on_response(self, page_id: str, method: str, url: str, status: int) -> None:
        self.network_entries.append(
            NetworkEntry(
                page_id=page_id,
                phase="response",
                method=method,
                url=url,
                status=status,
                error=None,
                occurred_at=datetime.now(timezone.utc),
            )
        )
        self._trim_buffer(self.network_entries, self.config.diagnostic_buffer_size)
        self._emit(BrowserEventType.NETWORK_RESPONSE, page_id, {"url": url, "status": status})

    def _on_request_failed(self, page_id: str, request: Request) -> None:
        method = request.method
        url = request.url
        error = request.failure
        self.active_requests.get(page_id, set()).discard(request)
        self.network_entries.append(
            NetworkEntry(
                page_id=page_id,
                phase="failed",
                method=method,
                url=url,
                status=None,
                error=error,
                occurred_at=datetime.now(timezone.utc),
            )
        )
        self._trim_buffer(self.network_entries, self.config.diagnostic_buffer_size)
        self._emit(BrowserEventType.NETWORK_FAILED, page_id, {"url": url, "error": error})

    def _on_request_finished(self, page_id: str, request: Request) -> None:
        self.active_requests.get(page_id, set()).discard(request)

    async def _track_download(self, page_id: str, download: Download) -> None:
        data = {"url": download.url, "filename": download.suggested_filename}
        self._emit(BrowserEventType.DOWNLOAD_STARTED, page_id, data)
        failure = await download.failure()
        if failure is None:
            self._emit(BrowserEventType.DOWNLOAD_COMPLETED, page_id, data)
        else:
            self._emit(BrowserEventType.DOWNLOAD_FAILED, page_id, {**data, "error": failure})

    async def _run_lifecycle(self) -> None:
        try:
            while self.context is not None:
                await asyncio.sleep(self.config.lifecycle.sweep_interval_seconds)
                now = datetime.now(timezone.utc)
                expired = tuple(
                    handle
                    for handle in self.pages.values()
                    if not handle.page.is_closed() and handle.expires_at <= now
                )
                for handle in expired:
                    await self._unregister_page(handle.page_id, reason="idle_timeout")
                    try:
                        await handle.page.close()
                    except Exception:
                        logger.exception("Failed to close expired Browser page %s", handle.page_id)
                if self.pages:
                    self._empty_since = None
                    continue
                if self._empty_since is None:
                    self._empty_since = asyncio.get_running_loop().time()
                    continue
                if (
                    asyncio.get_running_loop().time() - self._empty_since
                    >= self.config.lifecycle.context_idle_seconds
                ):
                    if self.context_idle_handler is not None:
                        await self.context_idle_handler()
                    return
        except asyncio.CancelledError:
            return

    def _emit(
        self,
        event_type: BrowserEventType,
        page_id: str | None,
        data: dict[str, JsonValue] | None = None,
    ) -> None:
        self.events.append(
            BrowserEvent(
                type=event_type,
                session_id=self.session_id,
                page_id=page_id,
                occurred_at=datetime.now(timezone.utc),
                data=data or {},
            )
        )
        self._trim_buffer(self.events, self.config.event_buffer_size)

    @staticmethod
    def _trim_buffer(items: list[T], limit: int) -> None:
        overflow = len(items) - limit
        if overflow > 0:
            del items[:overflow]

    def _require_context(self) -> BrowserContext:
        if self.context is None:
            raise BrowserConnectionError("Playwright context is not available")
        return self.context

    def _require_lease(self) -> PlaywrightContextLease:
        if self.context_lease is None:
            raise BrowserConnectionError("Playwright context lease is not available")
        return self.context_lease


def _is_navigation_context_error(error: PlaywrightError) -> bool:
    message = str(error).lower()
    return "execution context was destroyed" in message and "navigation" in message
