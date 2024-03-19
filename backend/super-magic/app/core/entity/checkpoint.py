# -*- coding: utf-8 -*-
"""
Checkpoint相关的数据模型定义

这个模块定义了checkpoint功能所需的所有数据模型，包括：
- FileOperation: 文件操作类型枚举
- FileSnapshot: 文件快照信息
- CheckpointInfo: checkpoint元数据
- CheckpointManifest: checkpoint清单
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional
from pathlib import Path
from pydantic import BaseModel, Field


class VirtualCheckpoint:
    """Checkpoint常量定义"""
    INITIAL = "__INITIAL__"  # 初始状态

class FileOperation(str, Enum):
    """文件操作类型枚举"""
    CREATED = "created"
    UPDATED = "updated"
    DELETED = "deleted"


class FileType(str, Enum):
    """文件类型枚举"""
    FILE = "file"           # 普通文件
    DIRECTORY = "directory" # 目录


class FileSnapshot(BaseModel):
    """文件快照信息模型"""

    file_path: str = Field(..., description="文件路径")
    modified_time: datetime = Field(..., description="文件修改时间")
    operation: FileOperation = Field(..., description="文件操作类型")
    file_type: FileType = Field(..., description="文件类型（文件或目录）")
    snapshot_path: Optional[str] = Field(None, description="快照文件路径（删除操作时为None）")

    @staticmethod
    def detect_file_type(file_path: str) -> "FileType":
        """检测文件类型

        Args:
            file_path: 文件路径

        Returns:
            FileType: 文件类型
        """
        path = Path(file_path)
        if path.exists():
            return FileType.DIRECTORY if path.is_dir() else FileType.FILE
        else:
            # 文件不存在时，根据路径特征判断
            # 如果路径没有扩展名，认为是目录
            return FileType.DIRECTORY if not path.suffix else FileType.FILE

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ChatHistorySnapshot(BaseModel):
    """聊天历史快照信息模型"""

    file_path: str = Field(..., description="聊天历史目录路径")
    snapshot_path: str = Field(..., description="快照存储路径")

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class CheckpointInfo(BaseModel):
    """Checkpoint信息模型"""

    checkpoint_id: str = Field(..., description="Checkpoint ID (通常是message_id)")
    created_time: datetime = Field(..., description="创建时间")
    file_snapshots: List[FileSnapshot] = Field(default_factory=list, description="文件快照列表")
    chat_history_snapshot: Optional[ChatHistorySnapshot] = Field(None, description="聊天历史快照信息")

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class CheckpointManifest(BaseModel):
    """Checkpoint清单模型"""

    checkpoints: List[str] = Field(default_factory=list, description="checkpoint ID列表（按时间顺序）")
    current_checkpoint_id: Optional[str] = Field(None, description="当前所处的checkpoint ID")
    created_time: datetime = Field(..., description="创建时间")
    updated_time: datetime = Field(..., description="更新时间")

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
