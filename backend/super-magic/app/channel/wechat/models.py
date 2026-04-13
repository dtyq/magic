"""微信渠道私有数据模型。"""
from enum import Enum

from pydantic import BaseModel


class WechatMediaType(str, Enum):
    IMAGE = "image"
    VIDEO = "video"
    FILE = "file"
    VOICE = "voice"


class WechatMediaContext(BaseModel):
    """微信入站媒体的本次请求上下文，仅在 ChatClientMessage.channel_context 中流转，不进入 Metadata。"""

    relative_path: str
    absolute_path: str
    media_type: WechatMediaType
    mime_type: str
    from_quote: bool = False
