"""IM 入站媒体的跨渠道上下文。"""
from enum import StrEnum

from pydantic import BaseModel


class ChannelMediaType(StrEnum):
    IMAGE = "image"
    VIDEO = "video"
    FILE = "file"
    VOICE = "voice"


class ChannelMediaContext(BaseModel):
    """只描述当次已落盘、可交给 Agent 读取的附件。"""

    relative_path: str
    media_type: ChannelMediaType
    mime_type: str
    file_name: str = ""
    size_bytes: int = 0
    from_quote: bool = False
