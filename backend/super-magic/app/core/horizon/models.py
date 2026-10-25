"""AgentHorizon 数据模型。"""
from __future__ import annotations

import copy
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Optional
from app.core.entity.user_context import UserContextSnapshot
from app.core.horizon.profile_context import AgentIdentityState


class HorizonInjectionPoint(StrEnum):
    UNKNOWN = "unknown"
    BEFORE_FIRST_LLM = "before_first_llm"
    AFTER_TOOL_RESULT = "after_tool_result"
    AFTER_MAIN_AGENT_RUN = "after_main_agent_run"
    BEFORE_LLM_NATIVE_VISUAL = "before_llm_native_visual"
    AFTER_USER_TOOL_CALL_CANCEL = "after_user_tool_call_cancel"
    BEFORE_CONTINUATION_LLM = "before_continuation_llm"
    BEFORE_LLM_PRELOADED_SKILLS = "before_llm_preloaded_skills"


@dataclass(frozen=True)
class HorizonDisplayBudget:
    """
    上下文展示预算；不改变文件扫描、哈希或编辑校验的性能边界。

    额度由小到大：单个普通文件 <= 单个重要文件 <= 所有文件变化 <= 整条 Horizon 通知。
    例：一个规则文件允许 16K，但本轮所有文件只剩 3K，仍只能使用剩余的 3K。
    file_snapshot_max_tokens 管缓存多少正文；它不保证这些正文会一次性全部展示给模型。
    """


    file_change_max_tokens: int
    important_file_change_max_tokens: int
    file_changes_max_tokens: int
    context_max_tokens: int
    file_snapshot_max_tokens: int
    full_read_ratio: float

    @classmethod
    def from_config(cls) -> "HorizonDisplayBudget":
        from agentlang.config.config import config

        values: dict[str, int] = {}
        for key in ("file_change_max_tokens", "important_file_change_max_tokens", "file_changes_max_tokens", "context_max_tokens", "file_snapshot_max_tokens"):
            raw = config.get(f"horizon.{key}")
            if isinstance(raw, bool) or not isinstance(raw, (str, int)) or not str(raw).isdecimal() or int(raw) <= 0:
                raise ValueError(f"horizon.{key} must be a positive integer")
            values[key] = int(raw)
        ratio = config.get("horizon.full_read_ratio")
        if isinstance(ratio, bool) or not isinstance(ratio, (int, float, str)) or not 0 < float(ratio) <= 1:
            raise ValueError("horizon.full_read_ratio must be in (0, 1]")
        budget = cls(**values, full_read_ratio=float(ratio))
        if not budget.file_change_max_tokens <= budget.important_file_change_max_tokens <= budget.file_changes_max_tokens <= budget.context_max_tokens:
            raise ValueError("Horizon display limits must satisfy ordinary <= important <= files <= context")
        return budget


@dataclass
class FileContextRecord:
    """
    Horizon 已记录的文件版本，用于后续变化检测、Diff 生成和编辑校验。

    read_ranges 留作观察记录，不作为编辑权限，也不跨版本平移或拼成完整读取的证明。
    MOCK DEMO：模型读过 1～10 行后用脚本插入数行，仍可能知道第 11 行的新位置。
    编辑条件继续由文件级校验和工具目标匹配决定，不能因工程记录跟不上而阻止正确编辑。
    file_content 服务于「如何展示下一次变化」，read_ranges 记录「当时请求过哪些行」。
    二者都不能推导新的行级权限；是否允许本次编辑仍由原文件版本和目标匹配检查负责。
    """
    path: str                           # 绝对路径
    file_hash: str                      # 文件级变化探测信号（小文件真 hash，大文件 __mtime__ 伪 hash）
    file_mtime_ms: float                # 读取时的 mtime（毫秒）
    file_size_bytes: int                # 读取时的文件大小（bytes）
    file_content: str                   # 整文件文本快照（小文件存全文，大文件置空）
    tool_name: str                      # 产生这份已知版本的工具名
    truncated: bool                     # 是否因 token 限制被截断
    metadata: dict = field(default_factory=dict)
    # 留档字段：不参与主链路判断，但保留用于排查
    # 设计取舍：Horizon 用整文件快照比较变化，不维护模型逐行已读状态。
    # 例如只读第 100～150 行，小文件仍可保存全文；范围不影响快照、Diff 或编辑校验。
    # 精细追踪需要贯穿读取、截断、写入和恢复，维护成本高于收益，因此不做范围合并、
    # 已读覆盖率或部分读取状态机。接入新工具时复用此边界，不把它扩展成前置改造。
    read_at: str = ""                   # ISO 8601 datetime
    read_ranges: list[tuple[int, int]] = field(default_factory=list)  # 当时读取的行号区间


@dataclass(frozen=True)
class MemoryDirectoryDisplayPolicy:
    """展示偏好，不是磁盘目录模板；未知布局仍正常扫描。"""

    preferred_paths: tuple[str, ...] = ()
    timeline_paths: tuple[str, ...] = ()


@dataclass
class MemoryDirectorySnapshot:
    """
    有限深度内的目录条目，用于比较增删；不表示模型读过笔记正文。

    展示可以折叠，条目仍完整保留到扫描深度。扫描失败不生成新快照，避免把未读到
    的成员误报为删除；调整扫描深度时重新展示，不能把缩小范围当成文件消失。

    entries 保存观察范围内的真实相对路径和类型，不保存压缩后的展示文本。
    例：界面只显示「2025/ 共 20 项」，状态里仍保留那 20 项；换掉其中一个文件也能发现。
    本状态随 Horizon codec 重启／fork；上下文重置后重新发现，不另建话题专属持久化文件。
    """

    root: str
    scan_depth: int
    entries: dict[str, str] = field(default_factory=dict)
    exists: bool = True


@dataclass
class PendingNotification:
    """待注入给 LLM 的系统通知，消费后清除。"""
    pushed_at: str   # ISO 8601 datetime
    source: str      # 推送方标识，如 "asr_service"、"im_channel"
    content: str     # 通知正文


class ResumptionTrigger(StrEnum):
    """触发 Agent 主动继续运行的时机。"""

    RUNTIME_READY = "runtime_ready"


class ResumptionStatus(StrEnum):
    """
    resumption 的生命周期状态。

    MOCK DEMO：
    - pending：事项已登记，还没有 Agent run 接手。
    - assigned：事项已分配给一个 Agent run，但还没有完成。
    - 删除：事项已经成功注入 Agent 上下文，不再保留。

    `assigned` 不是“已完成”，而是为了防止多个 run 重复处理同一事项。
    """

    PENDING = "pending"
    ASSIGNED = "assigned"


@dataclass
class PendingResumption:
    """等待 Agent 在运行时恢复后主动处理的事项。"""

    id: str
    source: str
    content: str
    created_at: str
    trigger: ResumptionTrigger
    status: ResumptionStatus = ResumptionStatus.PENDING
    assigned_at: str = ""
    assigned_to_run_id: str = ""
    last_error: str = ""


@dataclass(frozen=True)
class BrowserPageObservation:
    """模型最后一次观察 Browser 页面时的状态。"""

    page_id: str
    url: str
    title: str
    observed_at: str


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


@dataclass(frozen=True)
class SuperMagicWorkspaceContextState:
    """模型上次看到的 Super Magic 工作区信息。"""

    id: str
    name: str

    def to_dict(self) -> dict[str, str]:
        return {"id": self.id, "name": self.name}


@dataclass(frozen=True)
class SuperMagicProjectContextState:
    """模型上次看到的 Super Magic 项目信息。"""

    id: str
    name: str

    def to_dict(self) -> dict[str, str]:
        return {"id": self.id, "name": self.name}


@dataclass(frozen=True)
class SuperMagicTopicContextState:
    """模型上次看到的 Super Magic 话题信息。"""

    id: str
    name: str

    def to_dict(self) -> dict[str, str]:
        return {"id": self.id, "name": self.name}


@dataclass(frozen=True)
class SuperMagicSandboxContextState:
    """模型上次看到的 Super Magic 逻辑沙盒信息。"""

    id: str

    def to_dict(self) -> dict[str, str]:
        return {"id": self.id}


@dataclass(frozen=True)
class SuperMagicProductContextState:
    """模型上次看到的 Super Magic 产品上下文。"""

    workspace: Optional[SuperMagicWorkspaceContextState]
    project: SuperMagicProjectContextState
    topic: SuperMagicTopicContextState
    sandbox: SuperMagicSandboxContextState

    def to_dict(self) -> dict[str, object]:
        return {
            "workspace": self.workspace.to_dict() if self.workspace is not None else None,
            "project": self.project.to_dict(),
            "topic": self.topic.to_dict(),
            "sandbox": self.sandbox.to_dict(),
        }

    @classmethod
    def from_dict(cls, data: object) -> Optional["SuperMagicProductContextState"]:
        if not isinstance(data, dict):
            return None
        project = data.get("project")
        topic = data.get("topic")
        sandbox = data.get("sandbox")
        if not isinstance(project, dict) or not isinstance(topic, dict) or not isinstance(sandbox, dict):
            return None

        project_id = project.get("id")
        project_name = project.get("name")
        topic_id = topic.get("id")
        topic_name = topic.get("name")
        sandbox_id = sandbox.get("id")
        if not all(
            isinstance(value, str)
            for value in (project_id, project_name, topic_id, topic_name, sandbox_id)
        ):
            return None

        workspace_data = data.get("workspace")
        workspace = None
        if workspace_data is not None:
            if not isinstance(workspace_data, dict):
                return None
            workspace_id = workspace_data.get("id")
            workspace_name = workspace_data.get("name")
            if not isinstance(workspace_id, str) or not isinstance(workspace_name, str):
                return None
            workspace = SuperMagicWorkspaceContextState(
                id=workspace_id,
                name=workspace_name,
            )
        return cls(
            workspace=workspace,
            project=SuperMagicProjectContextState(
                id=project_id,
                name=project_name,
            ),
            topic=SuperMagicTopicContextState(
                id=topic_id,
                name=topic_name,
            ),
            sandbox=SuperMagicSandboxContextState(id=sandbox_id),
        )


@dataclass
class ManualContextWindowState:
    """用户对单个真实模型手动设置的上下文上限。"""

    user_manual_max_context_tokens: int = 0


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
    user_context: UserContextSnapshot | None = None
    user_context_baseline: UserContextSnapshot | None = None
    user_context_auto_fetch_attempted: bool = False
    agent_identity: AgentIdentityState | None = None
    file_records: dict[str, FileContextRecord] = field(default_factory=dict)     # abs_path -> record
    pending_notifications: list[PendingNotification] = field(default_factory=list)
    pending_resumptions: list[PendingResumption] = field(default_factory=list)
    browser_pages: dict[str, BrowserPageObservation] = field(default_factory=dict)
    loaded_skills: list[str] = field(default_factory=list)
    # 记录本上下文已入队的建议，不表示已经阅读；模型忽略后也不重复提醒。fork 随上下文继承。
    suggested_skill_names: list[str] = field(default_factory=list)
    image_model: ImageModelState = field(default_factory=ImageModelState)
    video_model: VideoModelState = field(default_factory=VideoModelState)
    manual_context_windows: dict[str, ManualContextWindowState] = field(default_factory=dict)
    # LLM 模型 baseline：与 image_model/video_model 对齐，持久化避免重启后误判为"模型变更"
    llm_model_id: str = ""
    llm_model_name: str = ""
    # 以下字段表示模型上次已经看到的 baseline，而不是"本轮刚采集到的最新值"
    process_started_at_ns: int = 0  # 上次注入给 LLM 的 Python 进程启动时间（纳秒）
    super_magic_product_context: Optional[SuperMagicProductContextState] = None
    user_preferred_language: str = ""
    # 上次注入给 LLM 的工作区树形字符串。变更检测已经不由它推导（变更只有一个来源：
    # 变更账本），它保留下来是因为整份列表会在首包和压缩后重新注入，需要一个可持久化
    # 的兜底值——进程重启后、本轮目录刷新之前，模型仍然要能看到工作区。
    workspace_files: str = ""
    memory_directory: MemoryDirectorySnapshot | None = None  # 当前项目记忆的目录条目，展示可折叠
    client_context: str = ""          # 上次注入给 LLM 的客户端页面上下文
    cli_status: str = ""              # 上次注入给 LLM 的本地已登录 CLI 状态片段
    context_usage_baseline_used: int = 0       # 上次注入给 LLM 的 used tokens
    context_usage_baseline_total: int = 0      # 上次注入给 LLM 的 context window total
    context_usage_baseline_used_pct: int = 0   # 上次注入给 LLM 的 used_pct 整数百分比
    # 当前上下文窗口是否已经完成过 initial_context 注入
    initial_context_injected: bool = False
    # 上次注入时间的日期部分（YYYY-MM-DD），同一天增量注入时省略周几/周数/时区
    last_injected_date: str = ""

    def copy_for_fork(self, target_agent_id: str) -> "HorizonState":
        """
        复制可由子 Agent 继承的 Horizon 状态，并清理不能重复执行的外部动作。

        MOCK DEMO：

        父 Agent：
        {
          "agent_id": "parent-001",
          "pending_notifications": [{"source": "system", "content": "..."}],
          "pending_resumptions": [{"id": "r-001", "status": "pending"}]
        }

        fork 子 Agent：
        {
          "agent_id": "child-001",
          "pending_notifications": [{"source": "system", "content": "..."}],
          "pending_resumptions": []
        }

        ChatHistory 和模型已见的 Horizon baseline 可以复制；resumption 代表父会话尚未
        完成的外部动作，不能复制，否则父子会话可能重复处理同一事项。以后新增具有
        副作用的 Horizon 字段时，应继续在本方法中直接写清楚复制后的清理逻辑。
        """
        fork_state = copy.deepcopy(self)
        fork_state.agent_id = target_agent_id
        fork_state.pending_resumptions.clear()
        return fork_state
