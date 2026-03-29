from typing import Optional

from app.channel.base.registry import build_default_channel_registry
from app.core.entity.message.client_message import Metadata


class ChannelContextService:
    """构建渠道专属的模型上下文"""

    @classmethod
    def append_channel_context(cls, query: str, metadata: Optional[Metadata]) -> str:
        if metadata is None or not metadata.channel_name:
            return query

        channel = build_default_channel_registry().get(metadata.channel_name)
        if channel is None:
            return query

        fragment = channel.build_agent_context_fragment(metadata)
        if not fragment:
            return query

        return f"{query}\n\n{fragment}"
