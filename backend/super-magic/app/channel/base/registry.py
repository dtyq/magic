"""IM 渠道注册表。"""

from __future__ import annotations

from app.channel.base.channel import BaseChannel


class ChannelRegistry:
    """集中管理当前进程内的渠道实例。"""

    def __init__(self) -> None:
        self._channels: dict[str, BaseChannel] = {}

    def register(self, channel: BaseChannel) -> None:
        """注册单个渠道实例。"""
        key = channel.key
        if not key:
            raise ValueError("channel key must not be empty")
        if key != key.strip():
            raise ValueError("channel key must not contain leading or trailing whitespace")
        if key in self._channels:
            raise RuntimeError(f"channel {key!r} is already registered")
        self._channels[key] = channel

    def get(self, key: str) -> BaseChannel | None:
        """按稳定标识获取渠道实例。"""
        return self._channels.get(key)

    def get_all(self) -> tuple[BaseChannel, ...]:
        """返回全部已注册渠道的只读快照。"""
        return tuple(self._channels.values())

    def clear(self) -> None:
        """清空注册表，便于重新初始化。"""
        self._channels.clear()


def build_default_channel_registry() -> ChannelRegistry:
    """构造包含当前内置 IM 渠道的默认注册表。"""
    from app.channel.dingtalk.channel import DingTalkChannel
    from app.channel.lark.channel import LarkChannel
    from app.channel.wecom.channel import WeComChannel

    registry = ChannelRegistry()
    # 这里注册的是各渠道单例，保证状态查询与自动连接看到的是同一份运行态。
    for channel in (
        WeComChannel.get_instance(),
        DingTalkChannel.get_instance(),
        LarkChannel.get_instance(),
    ):
        registry.register(channel)
    return registry
