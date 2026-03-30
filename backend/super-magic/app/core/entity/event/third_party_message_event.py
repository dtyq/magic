"""第三方 IM 入站事件数据模型。"""
from __future__ import annotations

from typing import Any, Optional

from agentlang.event.common import BaseEventData


class ThirdPartyMessageReceivedEventData(BaseEventData):
    """第三方 IM 消息入站事件数据。"""

    agent_context: Any
    channel: str
    source_message_id: str
    source_conversation_id: Optional[str] = None
    source_sender_id: Optional[str] = None
    local_message_id: str
    plain_text: str
    rich_text_content: str
    project_id: str
    topic_id: str
    topic_pattern: str
    model_id: str
    enable_web_search: bool = True
    image_model_id: str
    authorization: str
