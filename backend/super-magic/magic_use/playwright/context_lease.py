from __future__ import annotations

from collections.abc import Callable
from typing import TYPE_CHECKING

from playwright.async_api import Browser, BrowserContext
from magic_use.playwright.fingerprint import UserAgentOverride

if TYPE_CHECKING:
    from magic_use.playwright.host import PlaywrightHost


class PlaywrightContextLease:
    """一个 BrowserContext 的独占租约，关闭时只释放自身 context。"""

    def __init__(
        self,
        *,
        host: "PlaywrightHost",
        lease_id: str,
        context: BrowserContext,
        resource_warning: str | None,
    ) -> None:
        self._host = host
        self.lease_id = lease_id
        self.context = context
        self.resource_warning = resource_warning
        self._released = False

    @property
    def browser(self) -> Browser:
        return self._host.browser

    @property
    def user_agent_override(self) -> UserAgentOverride | None:
        return self._host.user_agent_override

    def set_disconnect_handler(self, handler: Callable[[], None]) -> None:
        self._host.set_disconnect_handler(self.lease_id, handler)

    def reserve_page(self) -> str | None:
        return self._host.reserve_page(self.lease_id)

    def ensure_page_capacity(self) -> None:
        self._host.ensure_page_capacity(self.lease_id)

    def release_page(self) -> None:
        self._host.release_page(self.lease_id)

    async def release(self) -> None:
        if self._released:
            return
        self._released = True
        await self._host.release_context(self.lease_id)
