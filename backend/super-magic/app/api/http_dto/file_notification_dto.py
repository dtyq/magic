"""
File Notification DTO Module

Provides data transfer objects for file change notification requests.
"""
from pydantic import BaseModel, Field


class FileNotificationRequest(BaseModel):
    """Request model for file change notifications"""

    timestamp: int = Field(..., description="事件发生的时间戳")
    operation: str = Field(..., description="文件操作类型 (e.g., 'CREATE', 'DELETE', 'UPDATE')")
    file_path: str = Field(..., description="文件的相对路径")
    file_size: int = Field(..., description="文件大小（字节）")
    is_directory: int = Field(default=0, description="是否为目录 (1: 目录, 0: 文件)"),
    source: int = Field(default=3, description="文件来源: 3=容器生成, 5=AI图片生成")

    class Config:
        json_schema_extra = {
            "example": {
                "timestamp": 1757041481,
                "operation": "CREATE",
                "file_path": ".visual",
                "file_size": 0,
                "is_directory": 1,
                "source": 3
            }
        }
