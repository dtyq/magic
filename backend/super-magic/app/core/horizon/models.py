"""AgentHorizon 数据模型。"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class FileReadRecord:
    """文件读取记录，用于后续变化检测、Diff 生成和编辑校验。"""
    path: str                           # 绝对路径
    file_hash: str                      # 文件级变化探测信号（小文件真 hash，大文件 __mtime__ 伪 hash）
    file_mtime_ms: float                # 读取时的 mtime（毫秒）
    file_size_bytes: int                # 读取时的文件大小（bytes）
    file_content: str                   # 整文件文本快照（小文件存全文，大文件置空）
    tool_name: str                      # 触发读取的工具名
    truncated: bool                     # 是否因 token 限制被截断
    metadata: dict = field(default_factory=dict)
    # 留档字段：不参与主链路判断，但保留用于排查
    read_at: str = ""                   # ISO 8601 datetime
    read_ranges: list[tuple[int, int]] = field(default_factory=list)  # 当时读取的行号区间


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
class VideoModelState:
    """持久化的视频生成模型状态，用于跨对话检测配置是否变化。"""
    model_id: str = ""
    config: dict = field(default_factory=dict)  # video_generation_config 原始 dict


@dataclass
class ContextUsage:
    """当前 LLM 上下文窗口使用情况，由 AgentHorizon.get_context_usage() 返回。"""
    used: int    # 已使用的 token 数
    total: int   # 总上下文窗口大小（0 表示未知）

    @property
    def remaining(self) -> int:
        return max(0, self.total - self.used) if self.total > 0 else 0

    @property
    def is_known(self) -> bool:
        return self.total > 0


@dataclass
class HorizonState:
    """AgentHorizon 的持久化状态。"""
    agent_id: str
    file_records: dict[str, FileReadRecord] = field(default_factory=dict)        # abs_path -> record
    pending_notifications: list[PendingNotification] = field(default_factory=list)
    loaded_skills: list[str] = field(default_factory=list)
    image_model: ImageModelState = field(default_factory=ImageModelState)
    video_model: VideoModelState = field(default_factory=VideoModelState)
    # LLM 模型 baseline：与 image_model/video_model 对齐，持久化避免重启后误判为"模型变更"
    llm_model_id: str = ""
    llm_model_name: str = ""
    # 以下字段表示模型上次已经看到的 baseline，而不是"本轮刚采集到的最新值"
    user_preferred_language: str = ""
    workspace_files: str = ""      # 上次注入给 LLM 的工作区树形字符串
    workspace_entries: list = field(default_factory=list)  # 上次注入给 LLM 的结构化工作区条目
    memory: str = ""               # 上次注入给 LLM 的 memory
    context_usage_baseline_used: int = 0       # 上次注入给 LLM 的 used tokens
    context_usage_baseline_total: int = 0      # 上次注入给 LLM 的 context window total
    context_usage_baseline_used_pct: int = 0   # 上次注入给 LLM 的 used_pct 整数百分比
    # 当前上下文窗口是否已经完成过 initial_context 注入
    initial_context_injected: bool = False
    # 上次注入时间的日期部分（YYYY-MM-DD），同一天增量注入时省略周几/周数/时区
    last_injected_date: str = ""
