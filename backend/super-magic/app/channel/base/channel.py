"""IM 渠道统一抽象。"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, ClassVar

if TYPE_CHECKING:
    from app.channel.config import IMChannelsConfig
    from app.core.context.agent_context import AgentContext
    from app.core.entity.message.client_message import ChatClientMessage


class BaseChannel(ABC):
    """定义单个 IM 渠道的最小统一接口。"""

    # 子类提供稳定标识，供 registry 和状态工具复用。
    key: ClassVar[str]
    # 子类提供面向用户的展示名。
    label: ClassVar[str]
    # 子类提供给 LLM 读的英文来源名，用于 <im> 块注入。
    source_name: ClassVar[str]

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

    async def create_proactive_streams(self, ctx: "AgentContext", cleanup_key: str) -> bool:
        """用缓存的上下文创建主动推送 stream/sink，注入到 ctx。

        供 cron 通知等没有 incoming message 的场景调用，让 agent 的回复能流出到 IM。
        子类若支持主动推送，需在收到用户消息时缓存必要上下文，并在此方法中重建 stream/sink。
        无缓存或创建失败时返回 False。
        """
        return False

    def build_agent_context_fragment(self, message: "ChatClientMessage | None") -> str:
        """把渠道专属的请求上下文转成给模型读的 prompt 片段，追加在用户消息后。"""
        return f'<im source="{self.source_name}" />'

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
