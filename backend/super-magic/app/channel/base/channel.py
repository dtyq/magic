"""IM 渠道统一抽象。"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, ClassVar

if TYPE_CHECKING:
    from app.channel.config import IMChannelsConfig


class BaseChannel(ABC):
    """定义单个 IM 渠道的最小统一接口。"""

    # 子类提供稳定标识，供 registry 和状态工具复用。
    key: ClassVar[str]
    # 子类提供面向用户的展示名。
    label: ClassVar[str]

    @property
    @abstractmethod
    def is_connected(self) -> bool:
        """返回当前是否已建立连接。"""

    @abstractmethod
    async def disconnect(self) -> None:
        """尽力断开连接并清理渠道持有的资源。"""

    @abstractmethod
    def summarize_config(self, config: IMChannelsConfig) -> str | None:
        """返回脱敏后的配置摘要；当前未配置时返回 None。"""

    @abstractmethod
    async def start_from_config(self, config: IMChannelsConfig) -> bool:
        """按配置触发连接；有可用配置且已提交连接动作时返回 True。"""

    def render_status_lines(self, config: IMChannelsConfig) -> list[str]:
        """返回面向状态面板的展示文案。"""
        credential = getattr(config, self.key, None)
        lines = [self.key]

        if credential is None:
            lines.append("  Status: not configured")
            return lines

        lines.append(f"  Status: {'connected' if self.is_connected else 'disconnected'}")
        summary = self.summarize_config(config)
        if summary:
            lines.append(f"  {summary}")
        lines.append(f"  Auto-connect: {'enabled' if credential.enabled else 'disabled'}")
        return lines
