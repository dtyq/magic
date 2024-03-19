from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class BaseFileSystemInfo(BaseModel):
    """文件系统项的基本信息"""

    name: str = Field(description="文件或目录名")
    path: str = Field(description="相对于工作区的路径")
    is_dir: bool = Field(description="是否是目录")
    last_modified: float = Field(description="最后修改时间戳")

    def format_time(self) -> str:
        """格式化最后修改时间"""
        dt = datetime.fromtimestamp(self.last_modified)
        return dt.strftime("%b %d, %I:%M %p")


class FileInfo(BaseFileSystemInfo):
    """文件信息"""

    size: int = Field(description="文件大小（字节）")
    line_count: Optional[int] = Field(None, description="文件行数（仅适用于文本文件）")


class DirectoryInfo(BaseFileSystemInfo):
    """目录信息"""

    item_count: str = Field(description="目录中的项目数量") 