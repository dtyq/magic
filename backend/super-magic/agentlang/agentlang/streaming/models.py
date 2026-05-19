# agentlang/agentlang/streaming/models.py
from enum import IntEnum
from typing import Any, Dict, Optional
from dataclasses import dataclass
from datetime import datetime


class ChunkStatus(IntEnum):
    START = 0    # phase 开始，累计内容清零
    STREAMING = 1  # 增量 token，追加到累计内容
    END = 2      # phase 结束，携带权威全文用于对齐


@dataclass
class ChunkMetadata:
    """数据块元数据"""
    correlation_id: Optional[str] = None
    model_id: Optional[str] = None
    parent_correlation_id: Optional[str] = None  # Agent 循环周期分组标识
    content_type: str = "content"  # 内容类型："reasoning" | "content" | "raw_chunk"
    extra_data: Optional[Dict[str, Any]] = None
    message_id: Optional[str] = None  # v2 预生成的 Snowflake ID，用于关联流式 chunk 和非流式消息


@dataclass
class ChunkDelta:
    """数据块增量信息"""
    status: Optional[ChunkStatus] = None
    finish_reason: Optional[str] = None
    extra_fields: Optional[Dict[str, Any]] = None


@dataclass
class ChunkData:
    """数据块模型"""
    request_id: str
    chunk_id: int
    content: Optional[str]
    delta: ChunkDelta
    timestamp: datetime
    is_final: bool = False
    metadata: Optional[ChunkMetadata] = None


@dataclass
class StreamingResult:
    """推送结果模型"""
    success: bool
    message: Optional[str] = None
    error_code: Optional[str] = None
