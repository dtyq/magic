"""AgentHorizon 数据模型。"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class FileReadRecord:
    """LLM 读取某个文件时的快照，用于后续 Diff 检测和编辑校验。"""
    path: str                           # 绝对路径
    read_at: str                        # ISO 8601 datetime
    read_ranges: list[tuple[int, int]]  # [(start_line, end_line)], end=-1 表示到文件末尾
    read_content: str                   # LLM 看到的原始文本（无行号前缀），Diff old 基准
    read_content_hash: str              # BLAKE2b of read_content
    full_file_hash: str                 # BLAKE2b of 完整文件（用于快速检测任意变化）
    file_mtime_ms: float                # 读取时的 mtime（毫秒，大文件时间戳校验用）
    file_size_bytes: int                # 读取时的文件大小（bytes）
    truncated: bool                     # 是否因 token 限制被截断
    tool_name: str                      # 触发读取的工具名
    metadata: dict = field(default_factory=dict)  # 透传原 FileTimestampManager.metadatas


@dataclass
class PendingNotification:
    """待注入给 LLM 的系统通知，消费后清除。"""
    pushed_at: str   # ISO 8601 datetime
    source: str      # 推送方标识，如 "asr_service"、"im_channel"
    content: str     # 通知正文


@dataclass
class ImageModelState:
    """持久化的图片生成模型状态，用于跨对话检测 sizes 是否变化。"""
    model_id: str = ""
    sizes: list = field(default_factory=list)  # [{"label": "1:1", "value": "1024x1024", "scale": "1K"}, ...]


@dataclass
class HorizonState:
    """AgentHorizon 的持久化状态。"""
    agent_id: str
    file_records: dict[str, FileReadRecord] = field(default_factory=dict)        # abs_path → record
    pending_notifications: list[PendingNotification] = field(default_factory=list)
    loaded_skills: list[str] = field(default_factory=list)
    image_model: ImageModelState = field(default_factory=ImageModelState)
    # 以下字段用于 Diff 追踪：上次注入给 LLM 的值，变化时才输出 diff
    user_preferred_language: str = ""
    workspace_files: str = ""      # 格式化树形字符串，用于注入 LLM 展示
    workspace_entries: list = field(default_factory=list)  # 结构化条目 [{"path": str, "size": int|None}]，用于 diff
    memory: str = ""
