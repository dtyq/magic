from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from uuid import uuid4

from playwright.async_api import Browser, BrowserContext, Playwright, async_playwright

from magic_use.config import BrowserContextConfig, BrowserRuntimeConfig
from magic_use.errors import BrowserConnectionError, BrowserErrorCode, BrowserSDKError
from magic_use.models.common import BrowserBackendKind, BrowserName
from magic_use.playwright.context_lease import PlaywrightContextLease
from magic_use.playwright.fingerprint import UserAgentOverride, resolve_user_agent_override
from magic_use.playwright.health import RemotePlaywrightHealthChecker
from magic_use.scripts import ScriptRegistry
from magic_use.userscripts import UserscriptRegistry

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class PlaywrightHostKey:
    scope: str
    backend: BrowserBackendKind
    browser_name: BrowserName
    remote_endpoint: str | None
    headless: bool
    browser_args: tuple[str, ...]
    downloads_path: str | None
    proxy_server: str | None
    proxy_username: str | None
    proxy_password: str | None
    proxy_bypass: tuple[str, ...]

    @classmethod
    def from_config(cls, config: BrowserRuntimeConfig) -> "PlaywrightHostKey":
        proxy = config.local_playwright.proxy
        remote_endpoint = config.remote_playwright.endpoint if config.remote_playwright is not None else None
        is_local = config.backend is BrowserBackendKind.LOCAL_PLAYWRIGHT
        return cls(
            scope=config.host_scope,
            backend=config.backend,
            browser_name=config.browser_name,
            remote_endpoint=remote_endpoint,
            headless=config.local_playwright.headless if is_local else False,
            browser_args=config.local_playwright.browser_args if is_local else (),
            downloads_path=config.local_playwright.downloads_path if is_local else None,
            proxy_server=proxy.server if is_local and proxy is not None else None,
            proxy_username=proxy.username if is_local and proxy is not None else None,
            proxy_password=proxy.password if is_local and proxy is not None else None,
            proxy_bypass=proxy.bypass if is_local and proxy is not None else (),
        )


@dataclass(slots=True)
class _LeaseState:
    context: BrowserContext
    page_count: int = 0
    disconnect_handler: Callable[[], None] | None = None


class PlaywrightHost:
    """沙盒内共享一个物理 Browser 或远程 Playwright 连接。"""

    def __init__(
        self,
        key: PlaywrightHostKey,
        config: BrowserRuntimeConfig,
        on_idle: Callable[["PlaywrightHost"], None],
    ) -> None:
        self.key = key
        self._config = config
        self._playwright: Playwright | None = None
        self._browser: Browser | None = None
        self._leases: dict[str, _LeaseState] = {}
        self._lock = asyncio.Lock()
        self._on_idle = on_idle
        self._started = False
        self._closed = False
        self._user_agent_override: UserAgentOverride | None = None

    @property
    def browser(self) -> Browser:
        if self._browser is None:
            raise BrowserConnectionError("Playwright host is not connected")
        return self._browser

    @property
    def lease_count(self) -> int:
        return len(self._leases)

    @property
    def page_count(self) -> int:
        return sum(state.page_count for state in self._leases.values())

    @property
    def user_agent_override(self) -> UserAgentOverride | None:
        return self._user_agent_override

    async def acquire_context(
        self,
        config: BrowserRuntimeConfig,
        context_options: Mapping[str, object] | None = None,
    ) -> PlaywrightContextLease:
        async with self._lock:
            if self._browser is None and self._leases:
                raise BrowserConnectionError(
                    "The shared Playwright host disconnected while Browser sessions are still releasing"
                )
            await self._ensure_started()
            limits = self._config.resources
            if self.lease_count >= limits.hard_contexts:
                raise BrowserSDKError(
                    BrowserErrorCode.RESOURCE_LIMIT,
                    f"Browser context hard limit reached ({limits.hard_contexts}). Existing sessions remain available.",
                )
            context_config = config.context
            options = self._context_options(context_config)
            if context_options is not None:
                options.update(context_options)
            context = await self.browser.new_context(**options)
            if config.scripts.mask_enabled:
                mask = await ScriptRegistry().get("mask")
                await context.add_init_script(script=mask.source)
            userscripts = UserscriptRegistry(config.scripts.userscripts)
            for source in userscripts.document_start_sources():
                await context.add_init_script(script=source)
            if context_config.permissions:
                await context.grant_permissions(list(context_config.permissions))
            lease_id = f"context_{uuid4().hex}"
            warning = None
            if self.lease_count + 1 >= limits.soft_contexts:
                warning = (
                    f"Browser context usage is near the sandbox soft limit "
                    f"({self.lease_count + 1}/{limits.soft_contexts}). Reuse existing sessions for ordinary browsing."
                )
            self._leases[lease_id] = _LeaseState(context=context)
            return PlaywrightContextLease(
                host=self,
                lease_id=lease_id,
                context=context,
                resource_warning=warning,
            )

    def set_disconnect_handler(self, lease_id: str, handler: Callable[[], None]) -> None:
        state = self._leases.get(lease_id)
        if state is not None:
            state.disconnect_handler = handler

    def reserve_page(self, lease_id: str) -> str | None:
        self.ensure_page_capacity(lease_id)
        state = self._require_lease(lease_id)
        limits = self._config.resources
        current = self.page_count
        state.page_count += 1
        if current + 1 >= limits.soft_pages:
            return (
                f"Browser page usage is near the sandbox soft limit "
                f"({current + 1}/{limits.soft_pages}). Reuse an existing page for ordinary navigation."
            )
        return None

    def ensure_page_capacity(self, lease_id: str) -> None:
        self._require_lease(lease_id)
        limit = self._config.resources.hard_pages
        if self.page_count >= limit:
            raise BrowserSDKError(
                BrowserErrorCode.RESOURCE_LIMIT,
                f"Browser page hard limit reached ({limit}). Existing pages remain available for navigation.",
            )

    def release_page(self, lease_id: str) -> None:
        state = self._leases.get(lease_id)
        if state is not None and state.page_count > 0:
            state.page_count -= 1

    async def release_context(self, lease_id: str) -> None:
        async with self._lock:
            state = self._leases.pop(lease_id, None)
        if state is None:
            return
        try:
            await state.context.close()
        except Exception:
            logger.exception("Failed to close Playwright context lease")
        if self.lease_count == 0:
            self._on_idle(self)

    async def close(self) -> None:
        async with self._lock:
            if self._closed:
                return
            self._closed = True
            leases = tuple(self._leases.values())
            self._leases.clear()
            browser = self._browser
            playwright = self._playwright
            self._browser = None
            self._playwright = None
        for state in leases:
            try:
                await state.context.close()
            except Exception:
                logger.exception("Failed to close Playwright context during host shutdown")
        if browser is not None and self.key.backend is BrowserBackendKind.LOCAL_PLAYWRIGHT:
            try:
                await browser.close()
            except Exception:
                logger.exception("Failed to close local Playwright browser")
        if playwright is not None:
            try:
                await playwright.stop()
            except Exception:
                logger.exception("Failed to stop Playwright host")

    async def _ensure_started(self) -> None:
        if self._started and not self._closed:
            return
        if self._closed:
            raise BrowserConnectionError("Playwright host is closed")
        if self._playwright is not None:
            try:
                await self._playwright.stop()
            except Exception:
                logger.exception("Failed to stop a disconnected Playwright transport")
            self._playwright = None
        self._playwright = await async_playwright().start()
        browser_type = self._browser_type(self._playwright)
        if self.key.backend is BrowserBackendKind.LOCAL_PLAYWRIGHT:
            launch = self._config.local_playwright
            options: dict[str, object] = {
                "headless": launch.headless,
                "args": list(launch.browser_args),
                "timeout": self._config.timeouts.default_ms,
            }
            if launch.downloads_path is not None:
                options["downloads_path"] = launch.downloads_path
            if launch.proxy is not None:
                options["proxy"] = launch.proxy.to_playwright()
            self._browser = await browser_type.launch(**options)
        else:
            remote = self._config.remote_playwright
            if remote is None:
                raise BrowserConnectionError("Remote Playwright config is missing")
            await RemotePlaywrightHealthChecker(remote).wait_until_ready()
            deadline = asyncio.get_running_loop().time() + remote.retry_timeout_seconds
            while True:
                try:
                    self._browser = await browser_type.connect(
                        remote.endpoint,
                        timeout=remote.connect_timeout_ms,
                    )
                    break
                except asyncio.CancelledError:
                    raise
                except Exception as error:
                    if "playwright version" in str(error).lower():
                        raise BrowserConnectionError(str(error), version_mismatch=True) from error
                    if asyncio.get_running_loop().time() >= deadline:
                        raise BrowserConnectionError(f"Remote Playwright connection failed: {error}") from error
                    await asyncio.sleep(remote.retry_interval_seconds)
        self.browser.on("disconnected", self._on_disconnected)
        if self.key.browser_name is BrowserName.CHROMIUM:
            self._user_agent_override = await resolve_user_agent_override(self.browser)
        self._started = True

    def _on_disconnected(self) -> None:
        self._started = False
        self._browser = None
        self._user_agent_override = None
        for state in tuple(self._leases.values()):
            if state.disconnect_handler is not None:
                state.disconnect_handler()

    def _require_lease(self, lease_id: str) -> _LeaseState:
        state = self._leases.get(lease_id)
        if state is None:
            raise BrowserConnectionError("Playwright context lease is no longer active")
        return state

    def _browser_type(self, playwright: Playwright):
        if self.key.browser_name is BrowserName.CHROMIUM:
            return playwright.chromium
        if self.key.browser_name is BrowserName.FIREFOX:
            return playwright.firefox
        return playwright.webkit

    @staticmethod
    def _context_options(context_config: BrowserContextConfig) -> dict[str, object]:
        options: dict[str, object] = {
            "viewport": {"width": context_config.viewport_width, "height": context_config.viewport_height},
            "device_scale_factor": context_config.device_scale_factor,
            "accept_downloads": context_config.accept_downloads,
            "extra_http_headers": context_config.extra_headers,
            "locale": context_config.locale,
            "timezone_id": context_config.timezone_id,
            "bypass_csp": context_config.bypass_csp,
            "ignore_https_errors": context_config.ignore_https_errors,
        }
        if context_config.user_agent is not None:
            options["user_agent"] = context_config.user_agent
        if context_config.geolocation is not None:
            latitude, longitude = context_config.geolocation
            options["geolocation"] = {"latitude": latitude, "longitude": longitude}
        if context_config.storage_state is not None:
            options["storage_state"] = context_config.storage_state
        return options
