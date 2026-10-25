"""按 AgentContext 隔离 Browser client 和 session 生命周期。"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field

from magic_use import BrowserClient
from magic_use.models import BrowserSession


@dataclass(slots=True)
class BrowserRuntimeEntry:
    client: BrowserClient
    session: BrowserSession
    is_default: bool
    browser_id: str | None = None
    # Agent 选中的页不随弹窗登记或用户桌面焦点变化。
    current_page_id: str | None = None
    tab_ids: dict[str, str] = field(default_factory=dict)
    operation_lock: asyncio.Lock = field(default_factory=asyncio.Lock)


class BrowserRuntimeRegistry:
    """主事件循环内使用的 Browser runtime 注册表。"""

    _instance: "BrowserRuntimeRegistry | None" = None

    def __init__(self) -> None:
        self._entries: dict[str, dict[str, BrowserRuntimeEntry]] = {}
        self._next_browser_number: dict[str, int] = {}
        self._next_tab_number: dict[str, int] = {}

    @classmethod
    def get_instance(cls) -> "BrowserRuntimeRegistry":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def register(self, context_id: str, entry: BrowserRuntimeEntry) -> None:
        sessions = self._entries.setdefault(context_id, {})
        # 短 Browser ID 只标识当前 AgentContext 内登记的具体实例；重连不复用旧编号，避免迟到的模型输出命中新实例。
        if entry.browser_id is None:
            number = self._next_browser_number.get(context_id, 1)
            entry.browser_id = f"b{number}"
            self._next_browser_number[context_id] = number + 1
        if entry.is_default:
            for current in sessions.values():
                current.is_default = False
        sessions[entry.session.id] = entry

    def assign_tab_id(self, context_id: str, entry: BrowserRuntimeEntry, page_id: str) -> str:
        # Tab ID 与真实 Page ID 一一绑定；关闭页面后不复用编号，避免旧模型输出命中新页面。
        existing = entry.tab_ids.get(page_id)
        if existing is not None:
            return existing
        number = self._next_tab_number.get(context_id, 1)
        tab_id = f"t{number}"
        self._next_tab_number[context_id] = number + 1
        entry.tab_ids[page_id] = tab_id
        return tab_id

    @classmethod
    def public_browser_id(cls, session_id: str) -> str:
        for entries in cls.get_instance()._entries.values():
            entry = entries.get(session_id)
            if entry is not None and entry.browser_id is not None:
                return entry.browser_id
        return session_id

    @classmethod
    def public_tab_id(cls, page_id: str) -> str:
        for entries in cls.get_instance()._entries.values():
            for entry in entries.values():
                tab_id = entry.tab_ids.get(page_id)
                if tab_id is not None:
                    return tab_id
        return page_id

    @classmethod
    def public_current_tab_id(cls, session_id: str) -> str | None:
        for entries in cls.get_instance()._entries.values():
            entry = entries.get(session_id)
            if entry is not None and entry.current_page_id is not None:
                return cls.public_tab_id(entry.current_page_id)
        return None

    def tab_id(self, context_id: str, entry: BrowserRuntimeEntry, page_id: str) -> str:
        return self.assign_tab_id(context_id, entry, page_id)

    def page_id(self, context_id: str, entry: BrowserRuntimeEntry, tab_id: str) -> str | None:
        for page_id, current_tab_id in entry.tab_ids.items():
            if current_tab_id == tab_id:
                return page_id
        return None

    def get_by_browser_id(self, context_id: str, browser_id: str) -> BrowserRuntimeEntry | None:
        return next(
            (entry for entry in self._entries.get(context_id, {}).values() if entry.browser_id == browser_id),
            None,
        )

    def get(self, context_id: str, session_id: str) -> BrowserRuntimeEntry | None:
        return self._entries.get(context_id, {}).get(session_id)

    def get_default(self, context_id: str) -> BrowserRuntimeEntry | None:
        for entry in self._entries.get(context_id, {}).values():
            if entry.is_default:
                return entry
        return None

    def set_default(self, context_id: str, entry: BrowserRuntimeEntry) -> None:
        for current in self._entries.get(context_id, {}).values():
            current.is_default = current is entry

    def list(self, context_id: str) -> tuple[BrowserRuntimeEntry, ...]:
        return tuple(self._entries.get(context_id, {}).values())

    def remove(self, context_id: str, session_id: str) -> BrowserRuntimeEntry | None:
        sessions = self._entries.get(context_id)
        if sessions is None:
            return None
        entry = sessions.pop(session_id, None)
        if not sessions:
            self._entries.pop(context_id, None)
        return entry

    def remove_all(self, context_id: str) -> tuple[BrowserRuntimeEntry, ...]:
        return tuple(self._entries.pop(context_id, {}).values())
