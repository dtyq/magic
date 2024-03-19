from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class AttachmentTag(str, Enum):
    """附件类型枚举"""

    USER_UPLOAD = "user_upload"  # 用户上传
    PROCESS = "process"  # 中间产物
    BROWSER = "browser"  # 浏览器截图
    FINAL = "final"  # 最终产物


class Attachment(BaseModel):
    """附件模型

    用于表示在系统中传递的各种附件，包括文件、图片等资源。
    该模型可以被事件系统、消息系统等多个模块共用。
    """

    file_key: str  # 对象存储的object_key
    file_tag: AttachmentTag  # 附件标签
    file_extension: str  # 文件后缀
    filepath: str = Field(exclude=True)  # 文件在工作区中的完整路径，不序列化到输出
    filename: str  # 文件名（basename）
    display_filename: str  # 显示的文件名
    file_size: int = Field(description="文件大小,单位 字节")
    file_url: Optional[str] = None  # 文件访问URL，可选
    source: int = Field(default=3, description="文件来源: 3=容器生成, 5=AI图片生成")
    timestamp: int = Field(description="时间戳")
