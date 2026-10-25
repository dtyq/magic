"""微信历史上下文兼容；新增渠道复用公共媒体模型。"""
from app.channel.base.models import ChannelMediaContext, ChannelMediaType
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

WechatMediaType = ChannelMediaType


class WechatMediaContext(ChannelMediaContext):
    """保留微信旧调用方使用的绝对路径。"""

    absolute_path: str


class TextFormat(StrEnum):
    PLAIN = "plain"
    MARKDOWN = "markdown"
    HTML = "html"


class TextMessageItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["text"]
    text: str = Field(min_length=1)
    format: TextFormat = TextFormat.PLAIN


class FileMessageItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["file"]
    path: str = Field(min_length=1)
    filename: str = ""


class TextFileMessageItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["text_file"]
    path: str = Field(min_length=1)
    format: TextFormat = TextFormat.PLAIN


WechatMessageItem = Annotated[
    TextMessageItem | FileMessageItem | TextFileMessageItem, Field(discriminator="kind"),
]


class WechatDeliveryResult(BaseModel):
    index: int
    kind: Literal["text", "file", "text_file"]
    delivery_id: str
    status: Literal["sent", "failed", "unknown", "not_sent"]
    error_code: str = ""
    message: str = ""
