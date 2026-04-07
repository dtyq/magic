from typing import Optional

from app.channel.base.registry import build_default_channel_registry
from app.core.entity.message.client_message import ChatClientMessage


class ChannelContextService:
    """构建渠道专属的模型上下文"""

    @classmethod
    def append_channel_context(cls, query: str, message: Optional[ChatClientMessage]) -> str:
        channel_name = message.metadata.channel_name if (message and message.metadata) else None
        if not channel_name:
            return query

        channel = build_default_channel_registry().get(channel_name)
        if channel is None:
            return query

        fragment = channel.build_agent_context_fragment(message)
        if not fragment:
            return query

        return f"{query}\n\n{fragment}"
