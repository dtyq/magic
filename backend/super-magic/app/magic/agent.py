from app.i18n import i18n
from app.utils.context_usage import ContextUsageEstimator, ToolSchemaEstimate
import asyncio
import ctypes
import gc
import html
import json
import platform
import random
import string
import subprocess
import sys
import time
import traceback
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

from agentlang.agent.base import BaseAgent
from agentlang.agent.loader import AgentLoader
from agentlang.agent.models import AgentRunRequest
from agentlang.agent.state import AgentState
from app.core.horizon.models import HorizonInjectionPoint
from app.service.user_context_service import UserContextService
from agentlang.chat_history import AssistantMessage, CompactionConfig, SystemMessage, ToolCall
from agentlang.chat_history.chat_history import ChatHistory
from agentlang.chat_history.chat_history_models import UserMessage, ToolMessage, ContextSource
from agentlang.context.tool_context import ToolContext
from agentlang.event.data import (
    AfterAgentLoopEventData,
    AfterAgentReplyEventData,
    AfterLlmRequestSucceededEventData,
    AfterMainAgentRunEventData,
    AgentLoopOutcome,
    BeforeLlmRetryEventData,
    BeforeMainAgentRunEventData,
    ErrorEventData,
    resolve_completed_loop_outcome,
)
from agentlang.event.event import EventType
from agentlang.config.config import config
from agentlang.llms.error_classifier import LLMErrorClassifier, LLMErrorSnapshot
from agentlang.llms.factory import LLMFactory
from agentlang.llms.processors.processor_config import ProcessorConfig
from agentlang.llms.retry_policy import is_non_retryable_model_config_error
from app.streaming.config_generator import StreamingConfigGenerator
from agentlang.llms.token_usage.models import TokenUsage, TokenUsageCollection
from agentlang.llms.token_usage.report import TokenUsageReport
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from agentlang.utils.token_estimator import num_tokens_from_string
from agentlang.utils.datetime_formatter import get_current_datetime_str
from agentlang.exceptions import UserFriendlyException, ResourceLimitExceededException, StreamChunkTimeoutError, StreamInterruptedError, iter_exception_chain
from agentlang.utils.tool_param_utils import preprocess_tool_calls_batch
from app.service.tool_argument_json_repair_validation_service import (
    tool_argument_json_repair_validation_service,
)
from openai.types.chat import ChatCompletion, ChatCompletionMessage, ChatCompletionMessageToolCall

from app.core.ai_abilities import get_compact_model_id
from app.core.agent_definition_normalizer import normalize_agent_definition
from app.core.context.agent_context import AgentContext
from app.core.horizon.memory_directory import scan_memory_directory
from app.core.horizon.models import MemoryDirectorySnapshot
from app.core.horizon.workspace_entry_index import (
    BaselineMaintenance,
    WorkspaceEntryIndex,
)
from app.magic.background_compact import (
    BackgroundCompactState,
    start_background_compact,
    BACKGROUND_COMPACT_WAIT_TIMEOUT,
    build_messages_digest,
)
from app.magic.compact_user_input_references import (
    format_user_input_reference_block,
)
from app.magic.compact_result import CompactResult
from app.magic.compact_request_tracker import CompactRequestTracker
from app.magic.security_guardrails import build_security_guardrails_prompt
from app.core.entity.final_task_state import (
    FinalTaskState,
    FinalTaskStateCode,
    ModelError,
    ModelErrorCode,
    build_final_task_state,
)
from app.core.entity.message.server_message import TaskStatus
from app.core.entity.todo import TodoItem, TodoStatus

# 多语言支持
from app.magic.user_command_handler import Commands
from app.path_manager import PathManager
from app.service.auto_read_file_service import AutoReadFileService
from app.service.agent_event.native_visual_disable_listener_service import NativeVisualDisableListenerService
from app.service.browser.browser_screenshot_artifact import BrowserScreenshotArtifactStore
from app.service.native_visual_message_builder import NativeVisualMessageBuilder
from app.service.todo_service import TodoService
from app.tools.core import AutoMount
from app.tools.core.app_tool_validator import AppToolValidator
from app.tools.core.tool_factory import tool_factory
from app.tools.subagent_session_manager import SubagentRunRef, subagent_session_manager
from app.utils.file_utils import (
    WorkspaceSnapshot,
    calculate_file_hash,
    get_fresh_file_stat,
)
from app.infrastructure.changefeed.change_ledger_client import (
    ChangeLedgerClient,
    ChangeLedgerUnavailable,
    LedgerPage,
)
from app.infrastructure.changefeed.workspace_path_changes import (
    WorkspaceChangeSet,
    map_ledger_changes_to_workspace_paths,
)
from app.utils.agfs_mount_path import get_agfs_fuse_mount_root
from agentlang.environment import Environment
from app.core.skill_manager import generate_skills_prompt
from app.core.skill_utils.prompt import PreloadedSkillFile
from app.core.skill_utils.runtime_policy import resolve_runtime_skills
from app.service.memory.policies.memory_skill_policy import is_auto_memory_enabled, is_memory_skill_available
from app.service.memory.policies.memory_scope import MemoryScopeKind, build_memory_runtime_context, resolve_memory_scopes
from app.core.skill_utils.skill_sources import get_system_skills_dir, get_workspace_skills_dir
from agentlang.agent.define import AgentDefine, SkillsConfig
from app.core.models.agent_model_context import TextModelState
from app.core.models.agent_runtime import AgentProviderType
from app.service.multimodal_message_renderer import LLMMessageRenderer, LLMMessageRenderResult
from app.service.native_visual_overflow_hint_builder import (
    NativeVisualOverflowHintBuilder,
)

logger = get_logger(__name__)


class _WorkspaceChangeSkip(str, Enum):
    """这一轮账本为什么没能提供变更清单。每一种处置不同，日志里必须分开。"""

    PRIMING = "priming"          # 第一次读取：只对齐起点，历史不属于"刚发生的变化"
    EXPIRED = "expired"          # 窗口挤掉了游标，这段时间的变更读不到了
    REGRESSION = "regression"    # revision 回退：agfs 重启过或文件树被重置
    UNRESOLVED = "unresolved"    # 有变更说不出是哪个路径，条目集合必然缺项
    NO_FEED = "no_feed"          # 账本在，但这个挂载没在听（版本同步被关掉了）
    UNAVAILABLE = "unavailable"  # 账本读不到：没配、没起来、或者令牌过期


# 账本自报缺口的那几种跳过：变更清单已经不可信，模型的工作区认知要整份重新对齐。
_WORKSPACE_GAP_SKIPS = frozenset(
    {
        _WorkspaceChangeSkip.EXPIRED,
        _WorkspaceChangeSkip.REGRESSION,
        _WorkspaceChangeSkip.UNRESOLVED,
    }
)


@dataclass(frozen=True)
class _WorkspaceChangeDelivery:
    """一次账本读取的结论：游标推进到哪、报出哪些变化、条目集合靠什么维护。"""

    cursor: int
    changes: WorkspaceChangeSet
    maintenance: BaselineMaintenance
    skipped: Optional[_WorkspaceChangeSkip] = None

    @property
    def is_gap(self) -> bool:
        """账本是否自报缺口。缺口意味着模型的工作区认知需要整份重新对齐。"""
        return self.skipped in _WORKSPACE_GAP_SKIPS


def _unmaintained_delivery(cursor: int, skip: _WorkspaceChangeSkip) -> _WorkspaceChangeDelivery:
    """账本不参与时的投递计划。

    游标原地不动是刻意的：账本恢复后要从同一个位置接着读，跳过一段就等于把那段时间
    里的远端变更永久丢掉。集合改由重新观测保持新鲜——那是**目录索引**的新鲜度，不是
    变更的兜底来源，两者对模型的含义完全不同。
    """
    return _WorkspaceChangeDelivery(
        cursor=cursor,
        changes=WorkspaceChangeSet(),
        maintenance=BaselineMaintenance.OBSERVATION,
        skipped=skip,
    )


def _plan_workspace_change_delivery(
    page: LedgerPage,
    cursor: int,
    *,
    primed: bool,
) -> _WorkspaceChangeDelivery:
    """决定一次账本读取该怎么处理：游标推进到哪、报什么、集合靠什么维护。

    纯函数——取数和上报留给调用方——因为这里几个判断都不需要网络或运行时就能测，
    而它们一旦错了，模型会拿到一个可以被证伪的工作区事实：

    1. **首次读取只对齐起点。** 账本里可能存着这个沙箱更早的历史（会话恢复、Claw 长
       生命周期、agent 进程重启）。把这些历史当成"刚发生的变化"报出去，模型会把一条
       早已过期、文件甚至已被重建的 `delete` 读成"这个文件刚被删了"。起点之前的状态
       由 `<workspace_files>` 全量注入负责，账本只负责之后发生的增量。
    2. **没在听就不算数。** `feed_attached=false` 的挂载照样有账本、照样回 200、
       revision 永远是 0，和"什么都没变"长得一模一样。这种部署下变更清单是空的，
       但集合仍要有人维护，所以退回重新观测。
    3. **连续性判断。** 窗口挤掉了游标、或者 revision 回退，都说明这段时间的变更读不到
       了：此时既不能报变更，也不能相信现有的集合，只能重新观测一次。
    4. **缺口判断。** 有变更解析不出路径时，条目集合必然缺项；已经解析出来的那部分
       仍然是事实，照常上报，同时把集合标记为需要重新观测。
    5. **路径换算。** 见 `map_ledger_changes_to_workspace_paths` 的规则表。

    例：首次读取 revision=900 → 对齐到 900、不报、此后由事件负责；
        cursor=900、page.revision=937 → 报出该页变化、游标推进到 937；
        cursor=900、page.revision=40 → 回落到 40、改为重新观测。
    """
    if not primed:
        return _WorkspaceChangeDelivery(
            cursor=page.revision,
            changes=WorkspaceChangeSet(),
            maintenance=BaselineMaintenance.EVENTS,
            skipped=_WorkspaceChangeSkip.PRIMING,
        )
    if page.cursor_expired:
        return _WorkspaceChangeDelivery(
            cursor=page.revision,
            changes=WorkspaceChangeSet(),
            maintenance=BaselineMaintenance.STALE,
            skipped=_WorkspaceChangeSkip.EXPIRED,
        )
    if page.revision < cursor:
        return _WorkspaceChangeDelivery(
            cursor=page.revision,
            changes=WorkspaceChangeSet(),
            maintenance=BaselineMaintenance.STALE,
            skipped=_WorkspaceChangeSkip.REGRESSION,
        )
    if not page.feed_attached:
        return _WorkspaceChangeDelivery(
            cursor=page.revision,
            changes=WorkspaceChangeSet(),
            maintenance=BaselineMaintenance.OBSERVATION,
            skipped=_WorkspaceChangeSkip.NO_FEED,
        )

    changes = map_ledger_changes_to_workspace_paths(page.changes)
    if changes.unresolved:
        return _WorkspaceChangeDelivery(
            cursor=page.revision,
            changes=changes,
            maintenance=BaselineMaintenance.STALE,
            skipped=_WorkspaceChangeSkip.UNRESOLVED,
        )
    return _WorkspaceChangeDelivery(
        cursor=page.revision,
        changes=changes,
        maintenance=BaselineMaintenance.EVENTS,
    )


class LLMRetryState:
    """LLM 两阶梯重试状态"""
    # 当前是否已降级到非流式模式（第一阶梯失败后置 True，后续调用不再尝试流式）
    streaming_disabled: bool = False
    # 第二阶梯退避重试计数
    backoff_retry_count: int = 0
    # 总退避等待时间（用于日志）
    total_backoff_wait_time: float = 0.0
    # 当前失败链中可能丢失的生成输出状态
    consecutive_generation_failures: int = 0
    max_lost_output_chars_in_streak: int = 0
    split_recovery_hint_injected: bool = False


@dataclass
class AgentLoopState:
    """Agent loop state management with simple direct property access"""
    no_tool_call_count: int = 0
    agent_loop_retry_count: int = 0  # Agent loop 级别的重试计数（跨所有LLM请求）
    final_response: Optional[str] = None
    last_llm_message: Optional[ChatCompletionMessage] = None
    should_continue: bool = True
    output_recovery_count: int = 0
    # Todo 与子 Agent 共用本次运行的提醒次数；工具调用、重试和压缩都不重置。
    completion_reminder_count: int = 0
    # reactive compact：context_window_exceeded 时自动压缩一次后重试
    reactive_compact_attempted: bool = False
    # LLM 两阶梯重试状态
    retry_state: LLMRetryState = field(default_factory=LLMRetryState)
    # 当前 run 内的循环序号和正常有效轮数，只用于轮次事件
    loop_index: int = 0
    effective_loop_count: int = 0


@dataclass
class LLMResponseContext:
    """LLM response context containing all related data"""
    message: Optional[ChatCompletionMessage] = None
    tool_calls: List[ToolCall] = None
    token_usage: Optional[TokenUsage] = None
    duration_ms: float = 0.0
    request_id: Optional[str] = None
    is_streaming: bool = False  # 标识是否来自流式调用
    finish_reason: Optional[str] = None  # LLM 返回的完成原因（stop/length/tool_calls 等）

    def __post_init__(self):
        if self.tool_calls is None:
            self.tool_calls = []

    @property
    def has_tool_calls(self) -> bool:
        """Check if response contains tool calls"""
        return bool(self.tool_calls)


@dataclass
class HorizonLlmModelInfo:
    """注入给 horizon 的展示态模型信息。"""
    model_id: str
    model_name: str
    description: str = ""


class SessionRestoreAction(Enum):
    """Session restore action types"""
    SKIP_LLM = "skip_llm"
    CALL_LLM = "call_llm"
    ERROR = "error"


@dataclass
class SessionRestoreContext:
    """Session restore context with action and related data"""
    action: SessionRestoreAction
    tool_calls: List[ToolCall] = None
    llm_response: Optional[ChatCompletionMessage] = None
    assistant_message: Optional[AssistantMessage] = None
    error_message: Optional[str] = None

    def __post_init__(self):
        if self.tool_calls is None:
            self.tool_calls = []


@dataclass
class ToolExecutionResult:
    """Tool execution result with exit detection"""
    should_exit: bool = False
    final_response: Optional[str] = None
    inject_horizon_after_tools: bool = True
    # 检测到某个工具因超长参数导致校验失败（参数有效但缺字段，通常是模型输出过长导致）
    has_long_args_failure: bool = False
    # 本轮执行了历史压缩，不计入正常有效轮
    has_compact_history: bool = False


@dataclass
class ExceptionHandlingResult:
    """Exception handling result with continuation decision"""
    should_continue: bool = True
    final_response: Optional[str] = None


class LLMCallRequestException(Exception):
    """Wrap an exception raised by the actual provider-facing `_call_llm()` call."""

    def __init__(self, original_exception: Exception):
        super().__init__(str(original_exception))
        self.original_exception = original_exception


@dataclass(frozen=True)
class ModelCallFailure:
    """保留真实调用的错误与模型身份，终态不能借用之后的模型选择。"""
    exception: Exception
    error: ModelError


@dataclass
class SessionPrepResult:
    """Session preparation result after handling pending tool calls and user query"""
    pending_assistant_message: Optional[AssistantMessage] = None
    user_message_added: bool = True
    direct_response: Optional[str] = None


class Agent(BaseAgent):
    """
    绑定 Context、ChatHistory 与 Horizon 的可运行 Agent 实例。

    Agent 管理自身运行状态；定义来源、编译准备、缓存和动态初始化时机由
    AgentRuntime 统一决定。

    被动压缩仍使用原专用正文缓存；默认挂载规则由应用 YAML 声明。
    """

    def _setup_agent_context(self, agent_context: Optional[AgentContext] = None) -> AgentContext:
        """
        设置和初始化Agent上下文

        Args:
            agent_context: 可选的Agent上下文实例，如果为None则创建新实例

        Returns:
            AgentContext: 设置好的Agent上下文实例
        """
        # 如果没有传入agent_context，则创建一个新的实例
        if agent_context is None:
            agent_context = AgentContext()
            logger.info("未提供agent_context，自动创建新的AgentContext实例")

        # 更新 agent 上下文的基本设置
        agent_context.agent_name = self.agent_name  # 设置agent_name
        agent_context.stream_mode = self.stream_mode
        agent_context.use_dynamic_prompt = False
        agent_context._workspace_dir = str(PathManager.get_workspace_dir())

        # 确保 context 中有 chat_history_dir
        if not hasattr(agent_context, 'chat_history_dir') or not agent_context.chat_history_dir:
            agent_context.chat_history_dir = PathManager.get_chat_history_dir()
            logger.warning(f"AgentContext 中未设置 chat_history_dir，使用默认值: {PathManager.get_chat_history_dir()}")

        NativeVisualDisableListenerService.register_standard_listeners(agent_context)
        return agent_context

    def _initialize_configured_text_model(self) -> None:
        """从全局配置初始化 Agent 默认文本模型。"""
        model_context = self.agent_context.model_context
        if model_context.configured_text_model_id:
            return
        default_model_id = config.get("default_model")
        if not default_model_id:
            raise ValueError("default_model is not configured")
        model_context.set_configured_text_model(default_model_id)
        logger.info(f"Agent 默认文本模型已初始化: {model_context.configured_text_model_id}")

    def __init__(self, agent_name: str, agent_context: AgentContext = None, agent_id: str = None):
        self.agent_name = agent_name
        self._context_usage_estimator = ContextUsageEstimator()
        self._closed = False
        self._context_registered = False
        self._active_run_task: asyncio.Task[object] | None = None
        self._tool_preflight_failures: Dict[str, str] = {}
        # 最近一次观测到的工作区快照。条目集合本身由索引持有（见 _workspace_entry_index），
        # 这里保留一份是为了让同一轮里的其它使用方（如嵌套规则文件的发现）拿到同一份事实，
        # 而不是各自再问一次。
        self._workspace_snapshot: WorkspaceSnapshot | None = None
        self._workspace_entry_index_instance: WorkspaceEntryIndex | None = None

        # 工作区变更账本：游标属于本进程（只有我们知道模型的视图从哪一刻开始），
        # 客户端懒建，`_change_ledger_disabled` 表示这个部署根本没开这个能力。
        self._change_ledger_client: ChangeLedgerClient | None = None
        self._change_ledger_cursor: int = 0
        self._change_ledger_disabled: bool = False
        # 首次读取只对齐起点：账本里的历史不属于"刚发生的变化"，见投递计划的说明。
        self._change_ledger_primed: bool = False
        # 当前最近一次真实 LLM 请求是否包含原生图片输入。
        self._last_llm_request_contains_native_images = False
        self._last_model_call_failure: ModelCallFailure | None = None
        # 同一轮只注入一次相同的原生视觉 Horizon 状态，避免工具循环重复提示。
        self._native_visual_horizon_context_signature: tuple[str, ...] | None = None
        self._native_visual_horizon_render_hint: str | None = None

        # 设置Agent上下文
        self.agent_context = self._setup_agent_context(agent_context)
        self._message_renderer = LLMMessageRenderer(
            workspace_dir=self.agent_context.get_workspace_dir(),
            browser_artifact_store=BrowserScreenshotArtifactStore(self.agent_context),
        )
        self._native_visual_message_builder = NativeVisualMessageBuilder(
            self.agent_context.get_workspace_dir()
        )
        self._initialize_configured_text_model()
        agents_dir = Path(PathManager.get_project_root() / "agents")
        agent_target = self.agent_context.get_agent_target()
        is_user_agent = bool(
            agent_target
            and agent_target.provider_type != AgentProviderType.BUILTIN
        )

        self._agent_loader = AgentLoader(
            agents_dir=agents_dir,
            definition_normalizer=(
                normalize_agent_definition if is_user_agent else None
            ),
        )

        # 设置工具验证器，用于过滤无效工具
        self._tool_validator = AppToolValidator(
            ignore_invalid_declarations=True,
            agent_name=self.agent_name,
        )

        # 存储加载的 skills 列表（必须在 _initialize_agent 之前初始化）
        self.loaded_skills: List[str] = []

        logger.info(f"初始化 agent: {self.agent_name}")
        self._initialize_agent()

        # agent id 处理
        if self.agent_context.is_main_agent:
            if agent_id:
                logger.info(f"主 Agent 使用提供的 Agent ID: {agent_id}")
            else:
                agent_id = "main"
                logger.info(f"主 Agent 使用默认 Agent ID: {agent_id}")

        if agent_id:
            # 不校验，大模型容易出错
            self.id = agent_id
            logger.info(f"使用提供的 Agent ID: {self.id}")
        else:
            # 如果未提供 agent_id，则生成一个新的
            self.id = self._generate_agent_id()

        self.agent_context.set_agent_id(self.id)


        # 初始化压缩配置（Agent 用于判断何时触发压缩）
        self.compaction_config = CompactionConfig.from_config(
            agent_name=self.agent_name,
            agent_id=self.id,
            # 压缩阈值运行时按当前文本模型解析，避免 .agent 历史默认模型影响当前任务。
            agent_model_id="",
        )
        self._compact_request_tracker = CompactRequestTracker()

        # 后台压缩状态（双阈值机制：early_compact_threshold 触发后台，compaction_threshold_tokens 硬限制）
        self._bg_compact_state = BackgroundCompactState()
        self.capture_compact_history_result: bool = False
        self.captured_compact_result: CompactResult | None = None

        # 初始化 ChatHistory 实例
        self.chat_history = ChatHistory(
            self.agent_name,
            self.id,
            self.agent_context.chat_history_dir,
            self.agent_context.get_event_dispatcher(),  # 传递事件分发器
        )
        # 轮次监听器从上下文读取当前历史，避免再查全局消息。
        self.agent_context.chat_history = self.chat_history

        # Token usage 文件必须跟随当前 Agent 的聊天历史目录，不能复用全局 mutable prefix。
        token_usage_report_manager = TokenUsageReport.for_session(
            file_prefix=f"{self.agent_name}<{self.id}>",
            token_tracker=LLMFactory.token_tracker,
            pricing=LLMFactory.pricing,
            sandbox_id=self.agent_context.get_sandbox_id() or LLMFactory.sandbox_id,
            report_dir=str(self.agent_context.chat_history_dir),
        )
        self.agent_context.set_token_usage_report_manager(token_usage_report_manager)

        # 将 chat_history 设置到 agent_context 中，确保工具可以访问
        self.agent_context.chat_history = self.chat_history
        logger.debug("已将 chat_history 设置到 agent_context 中，以便工具访问")
        logger.debug("Agent MCP 支持已初始化")

        from app.core.context.agent_context_registry import AgentContextRegistry
        AgentContextRegistry.get_instance().register(self.agent_context)
        self._context_registered = True
        logger.info(f"Agent context 已注册: {self.agent_context.get_agent_session_label()}")

    def enable_compact_history_capture(self) -> None:
        """让当前 Agent 只捕获压缩摘要与 Skill 建议，不重写自身历史。"""
        self.capture_compact_history_result = True
        self.captured_compact_result = None

    def get_captured_compact_result(self) -> CompactResult | None:
        return self.captured_compact_result

    def print_token_usage(self) -> None:
        """
        打印当前 Agent 会话的 token 使用报告。

        报告管理器从 AgentContext 读取，避免并发 subagent 共用全局 report prefix。
        """
        try:
            report_manager = self.agent_context.get_token_usage_report_manager()
            formatted_report = LLMFactory.token_tracker.get_formatted_report(
                report_manager=report_manager
            )
            logger.info(f"===== Token 使用报告 ({self.agent_name}) =====")
            logger.info(formatted_report)
        except Exception as e:
            logger.error(f"打印Token使用报告时出错: {e!s}")

    def get_token_usage_report(self) -> TokenUsageCollection:
        """获取当前 Agent 会话的 Token 使用报告。"""
        try:
            report_manager = self.agent_context.get_token_usage_report_manager()
            return LLMFactory.token_tracker.get_usage_report(report_manager=report_manager)
        except Exception as e:
            logger.error(f"获取token使用报告时出错: {e!s}")
            return TokenUsageCollection.create_summary_report([])

    def close(self) -> None:
        """关闭 Agent 并释放当前已注册的运行时资源。"""
        if self._closed:
            return
        self._closed = True
        self._clear_stream_fallback_correlation()
        self._context_usage_estimator.clear()
        self._bg_compact_state.reset()

        if self._context_registered:
            from app.core.context.agent_context_registry import AgentContextRegistry
            AgentContextRegistry.get_instance().unregister(self.agent_context)
            self._context_registered = False
            logger.info(f"Agent context 已注销: {self.agent_context.get_agent_session_label()}")

    def _clear_stream_fallback_correlation(self) -> None:
        """清理当前上下文未消费的流式降级标记。"""
        from agentlang.event import get_correlation_manager

        get_correlation_manager().set_stream_fallback_cid(None, self.agent_context.context_id)

    def has_active_run(self) -> bool:
        """返回当前 Agent 是否仍有尚未退出的 run 协程。"""
        task = self._active_run_task
        return task is not None and not task.done()

    def _claim_run(self) -> asyncio.Task[object]:
        """登记当前 run 的 Task 身份，阻止同一 Agent 被并发执行。"""
        from app.service.sandbox_restart_coordinator import sandbox_restart_coordinator

        sandbox_restart_coordinator.ensure_accepting_runs()
        current_task = asyncio.current_task()
        if current_task is None:
            raise RuntimeError("Agent.run() must execute inside an asyncio Task")

        active_task = self._active_run_task
        if active_task is not None and not active_task.done():
            raise RuntimeError(f"Agent {self.agent_name} is already running")

        self._active_run_task = current_task
        self.agent_context.horizon.begin_im_progress()
        return current_task

    def _set_run_terminal_state(
        self,
        run_task: asyncio.Task[object],
        terminal_state: AgentState,
    ) -> None:
        """仅在当前 run 尚无明确终态时写入默认终态。"""
        if self._active_run_task is run_task and self.is_agent_running():
            self.set_agent_state(terminal_state)

    def _release_run(self, run_task: asyncio.Task[object]) -> None:
        """只允许持有当前 Task 身份的 run 释放活动标记。"""
        if self._active_run_task is not run_task:
            return
        # 取消或终态错误可能跳过非流式 fallback，不能把标记留给后续 run。
        self._clear_stream_fallback_correlation()
        self._active_run_task = None
        self.agent_context.horizon.end_im_progress()

    def dispose(self) -> None:
        """兼容性别名，语义等同于 close()。"""
        self.close()

    def _log_compaction_event(self, event: str, message: str) -> None:
        """输出上下文压缩诊断日志；只记录元数据，不记录上下文正文。"""
        context = " ".join(
            part
            for part in (
                f"Agent={self.agent_name}",
                f"AgentID={self.id}",
                f"任务ID={self.agent_context.get_task_id()}" if self.agent_context else "",
                f"沙盒ID={self.agent_context.get_sandbox_id()}" if self.agent_context else "",
            )
            if part
        )
        logger.info(f"compaction.{event}: {message} | {context}")

    def _require_current_text_model_id(self) -> str:
        """返回当前运行时文本模型；模型选择必须已在入口层完成。"""
        model_id = self.agent_context.model_context.current_text_model_id
        if not model_id:
            raise ValueError("Text model id is not configured")
        return model_id

    _COMPACT_SKILL_NAME = "compact-chat-history"

    def _initialize_agent(self):
        """初始化 agent"""
        # 从 .agent 文件中加载 agent 配置
        agent_define = self.load_agent_config(self.agent_name)
        """
        先合并应用默认 Skill，再选择对应运行工具；否则 .agent 未列 memory 时会漏掉预加载底座。
        这里只决定需要加载哪些能力，真正可用的 Skill 要等下方正文生成完成后登记。
        """
        runtime_skills = resolve_runtime_skills(self._agent_loader.get_skills_config(self.agent_name))
        skills_config = runtime_skills.skills_config
        self._mount_runtime_tools(agent_define, skills_config)

        # 缓存 compact skill 内容，供被动触发时直接注入（避免运行时读文件）
        self._compact_skill_content = self._load_compact_skill_content()

        """
        声明合并不等于正文已加载。只有实际生成的 Skill 进入 loaded_skills；
        必需预加载失败写入原有 excluded_skills，使日常入口和 after-run 使用同一状态。
        """
        skill_result = generate_skills_prompt(
            skills_config,
            agent_name=self.agent_name,
            required_preloads=runtime_skills.required_preloads,
        )
        skills_prompt_content = skill_result.content
        self.loaded_skills = skill_result.loaded_names
        self.agent_context.set_loaded_skills(skill_result.loaded_names)
        self.agent_context.set_excluded_skills(list(dict.fromkeys([*skills_config.excluded_skills, *skill_result.disabled_names])))
        self._preloaded_file_contents: tuple[PreloadedSkillFile, ...] = skill_result.preloaded_file_contents
        if skills_prompt_content:
            logger.info(f"为 agent {self.agent_name} 生成了 skills prompt，包含 {len(skill_result.loaded_names)} 个 skills")
        else:
            logger.warning(f"尝试生成 skills prompt 失败，skills_config: {skills_config}")

        # 收集工具提示
        # 使用轻量级方法，避免在初始化时加载所有工具类
        tool_hints = []
        for tool_name in self.tools.keys():
            hint = tool_factory.get_tool_prompt_hint_light(tool_name)
            if hint:  # 只有非空提示才添加
                tool_hints.append((tool_name, hint))

        # 将 skills prompt 追加到 system prompt（在工具提示之前）
        if skills_prompt_content:
            self.system_prompt += "\n\n---\n\n" + skills_prompt_content
            logger.info("已将 skills prompt 追加到 system prompt")

        # 将工具提示追加到 system prompt
        if tool_hints:
            formatted_hints = [f"### {name}\n{hint}" for name, hint in tool_hints]
            for name, _ in tool_hints:
                logger.info(f"已追加{name}工具的提示到 system prompt")
            self.system_prompt += "\n\n---\n\n## Advanced Tool Usage Instructions:\n> You should strictly follow the examples to use the tools.\n\n" + "\n\n".join(formatted_hints)

        if not self.system_prompt:
            raise ValueError("Prompt is not set")

        # 准备静态变量并应用到 system_prompt
        static_vars = self._prepare_prompt_static_variables()
        self._context_usage_estimator.set_skill_blocks((
            self._agent_loader.set_variables(skills_prompt_content, static_vars) if skills_prompt_content else "",
            skill_result.preloaded_content,
        ))
        self.system_prompt = self._agent_loader.set_variables(self.system_prompt, static_vars)

        # Skill 是文件原文，须避开模板处理，保留注释及其中的模板示例。
        if skill_result.preloaded_content:
            self.system_prompt += "\n\n---\n\n" + skill_result.preloaded_content

        # 在安全规则之前追加平台级全局系统提示词。
        global_system_prompt = self.agent_context.get_global_system_prompt()
        if global_system_prompt.strip():
            self.system_prompt += (
                "\n\n---\n\n<global_system_prompt>\n"
                + global_system_prompt
                + "\n</global_system_prompt>"
            )

        # 在完整 system prompt 末尾统一注入安全规则；大陆环境额外追加内容合规规则
        self.system_prompt += "\n\n---\n\n" + build_security_guardrails_prompt(
            is_mainland=Environment.is_mainland(),
        )

    def _mount_runtime_tools(self, agent_define: AgentDefine, skills_config: SkillsConfig) -> None:
        """根据工具声明和 Agent 能力配置挂载运行时基础工具。"""
        mount_types = [AutoMount.ALWAYS]
        if agent_define.code_execution:
            mount_types.append(AutoMount.CODE_EXECUTION)
        if not skills_config.is_empty():
            mount_types.append(AutoMount.SKILLS)

        candidates = {
            tool_name: {}
            for mount_type in mount_types
            for tool_name in tool_factory.get_auto_mount_tool_names(mount_type)
            if tool_name not in self.tools
        }
        if not candidates:
            return

        mounted_tools = {
            tool_name: tool_config
            for tool_name, tool_config in candidates.items()
            if tool_factory.check_tool_availability_light(tool_name)
        }
        self.tools.update(mounted_tools)
        logger.debug(f"自动挂载运行时工具: {', '.join(mounted_tools)}")

    def _load_compact_skill_content(self) -> str:
        """同步读取 compact-chat-history SKILL.md 内容（去除 frontmatter），缓存供被动触发时直接注入。"""
        import concurrent.futures
        from app.utils.async_file_utils import async_read_text

        skill_file = get_system_skills_dir() / self._COMPACT_SKILL_NAME / "SKILL.md"

        async def _read():
            return await async_read_text(skill_file)

        def _run():
            return asyncio.run(_read())

        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                raw = executor.submit(_run).result()
        except Exception as e:
            logger.error(f"读取 compact skill 内容失败: {e}")
            return ""

        # 去除 YAML frontmatter（--- ... ---）
        if raw.startswith("---"):
            end = raw.find("---", 3)
            if end != -1:
                raw = raw[end + 3:].lstrip("\n")
        return raw

    def _prepare_prompt_static_variables(self) -> Dict[str, str]:
        """
        准备静态变量（初始化时确定，不会改变的变量）

        Returns:
            Dict[str, str]: 包含静态变量名和对应值的字典
        """
        # 初始化阶段不解析运行时模型；真正调用前才根据请求、会话或父 Agent 解析。
        recommended_max_output_tokens = 4096

        # 读取幻灯片模板文件内容
        slide_template_html = ""
        try:
            template_path = PathManager.get_project_root() / "app" / "tools" / "magic_slide" / "template.html"
            if template_path.exists():
                slide_template_html = template_path.read_text(encoding='utf-8')
                logger.debug(f"成功读取幻灯片模板文件: {template_path}")
            else:
                logger.warning(f"幻灯片模板文件不存在: {template_path}")
        except Exception as e:
            logger.error(f"读取幻灯片模板文件时出错: {e}")

        # 获取当前用户偏好语言
        # 检查用户是否手动设置过语言
        if not i18n.is_language_manually_set():
            user_preferred_language = "<Please determine the language used by the user based on the following user messages.>"
        else:
            user_preferred_language = i18n.get_language_display_name()

        # 获取 Agent Profile
        agent_profile = self.agent_context.get_agent_profile()
        agent_name = agent_profile.name
        agent_profile_text = agent_profile.get_profile_desc()

        # Get managed agent code (used by agent-manager, empty for other agents)
        managed_agent_code = self.agent_context.get_agent_code() or ""

        # 构建静态变量字典
        variables = {
            "agent_name": agent_name,
            "agent_profile": agent_profile_text,
            "workspace_dir": self.agent_context._workspace_dir,
            "workspace_skills_dir": str(get_workspace_skills_dir().relative_to(PathManager.get_workspace_dir())),
            "project_root": str(PathManager.get_project_root()),
            "memory_root": str(PathManager.get_memory_root_dir()),
            "agfs_fuse_mount_path": str(get_agfs_fuse_mount_root()),
            "cwd": self.agent_context._workspace_dir,
            "python_version": sys.version,
            "nodejs_version": subprocess.check_output(["node", "--version"]).decode("utf-8").strip(),
            "typescript_version": subprocess.check_output(["tsc", "--version"]).decode("utf-8").strip(),
            "slide_template_html": slide_template_html,
            "managed_agent_code": managed_agent_code,
        }

        # 提示词语法没有条件分支，按当前运行环境选择 sandbox / local 之一的说明，
        # 用同一套变量预先渲染成正文；static_context 用 @variable 引用它，变量值不会被二次解析。
        runtime_environment = PathManager.get_runtime_environment()
        variables["runtime_environment"] = runtime_environment.value
        variables["runtime_environment_prompt"] = self._agent_loader.set_variables(
            f'{{{{ @include(path="./prompts/runtime_environment/{runtime_environment.value}.prompt") }}}}',
            variables,
        ).strip()

        return variables

    def _workspace_entry_index(self) -> WorkspaceEntryIndex:
        """惰性创建条目集合。

        工作区根在会话内固定，所以可以按 Agent 实例缓存；惰性创建是为了让不碰工作区的
        路径（例如只跑一个纯文本任务）完全不付这份开销。
        """
        if self._workspace_entry_index_instance is None:
            self._workspace_entry_index_instance = WorkspaceEntryIndex(
                Path(self.agent_context._workspace_dir)
            )
        return self._workspace_entry_index_instance

    async def _get_memory_directory_snapshot(self) -> MemoryDirectorySnapshot | None:
        """
        获取当前普通项目的记忆目录快照，不读取笔记正文。

        只自动观察本次普通项目的记忆根；全局 notes 和其它项目不会因为本轮对话被顺带扫描。
        Claw 自有记忆已属于它的工作区，由原工作区入口处理，不再追加普通项目目录。
        """
        if not (is_auto_memory_enabled(self.agent_context) and is_memory_skill_available(self.agent_context)):
            return None
        scope = next(
            (scope for scope in resolve_memory_scopes(self.agent_context) if scope.kind == MemoryScopeKind.PROJECT),
            None,
        )
        if scope is None:
            return None
        return await scan_memory_directory(scope.root, self.agent_context)

    async def _refresh_directory_snapshots(self) -> None:
        """
        每轮上下文准备时统一刷新目录；单个目录失败不阻止另一目录更新。

        例：第一轮工具创建了文件，第二轮即使没有新用户消息，也应能看到它。
        Workspace 与项目记忆各自扫描，在同一个上下文准备时机交给 Horizon 比较变化。
        不把目录发现误作全文读取，模型仍按当前任务判断是否打开新笔记。

        顺序是刻意的：**先问账本这一轮谁在维护条目集合，再按那个状态刷新**。反过来的话，
        事件模式下会先付一次不必要的遍历。
        """
        horizon = self.agent_context.horizon

        delivery = await self._poll_workspace_changes()
        try:
            snapshot = await self._workspace_entry_index().observe(
                maintenance=delivery.maintenance, events=delivery.changes
            )
            await horizon.set_workspace_snapshot(snapshot)
            self._workspace_snapshot = snapshot
        except Exception as error:
            # 刷新失败不阻止另一目录更新，也不阻止已经拿到的事件交付：事件是已经发生
            # 的事实，不该因为一次遍历失败而一起丢掉。
            logger.warning(f"刷新工作区文件树失败: {error}")
        if not delivery.changes.empty:
            horizon.add_workspace_changes(delivery.changes)
        if delivery.is_gap:
            # 账本自己说这段时间的变更读不到了：逐条列举无从谈起，只能把当前这份
            # 观测整份交给模型。此时集合刚被重新观测过，所以列表是新的。
            horizon.request_workspace_files_refresh()

        await horizon.set_memory_directory_snapshot(await self._get_memory_directory_snapshot())

    async def _poll_workspace_changes(self) -> _WorkspaceChangeDelivery:
        """读一次变更账本，得出游标推进到哪、报出哪些变化、条目集合靠什么维护。

        这条链路存在的理由：目录遍历是有预算的，而"有预算的观测"证明不了删除——大
        项目上它要么什么都不说，要么说错。账本里的变更不依赖观测完整性：一条
        create/delete 本身就是结论，而且它覆盖不是本沙箱写的东西（浏览器上传、
        别的会话改动）。

        它**不产生 magic-service 请求**：账本的权威数据是 agfs-server 用一条进程级订阅
        拉进沙箱的，这里只是把它读出来。

        读不到时返回"集合改由重新观测维护"——它不会把"读不到"当成"没有变化"（那种
        错误完全无声），也不会拿目录遍历当变更来源（那会给出一个可以被证伪的清单）。
        """
        if self._change_ledger_disabled:
            return _unmaintained_delivery(
                self._change_ledger_cursor, _WorkspaceChangeSkip.UNAVAILABLE
            )
        if self._change_ledger_client is None:
            self._change_ledger_client = ChangeLedgerClient()

        try:
            page = await self._change_ledger_client.fetch(self._change_ledger_cursor)
        except ChangeLedgerUnavailable as error:
            if error.permanent and not self._change_ledger_disabled:
                # 这个部署没给挂载配账本，重试一辈子也不会有结果；记一次就停。
                logger.warning(
                    f"工作区变更账本不可用，本会话不再尝试（变更通知将缺席）: {error}"
                )
                self._change_ledger_disabled = True
            else:
                logger.debug(f"读取工作区变更账本失败（下一轮重试）: {error}")
            return _unmaintained_delivery(
                self._change_ledger_cursor, _WorkspaceChangeSkip.UNAVAILABLE
            )
        except Exception as error:
            logger.warning(f"读取工作区变更账本时发生未预期错误（下一轮重试）: {error}")
            return _unmaintained_delivery(
                self._change_ledger_cursor, _WorkspaceChangeSkip.UNAVAILABLE
            )

        plan = _plan_workspace_change_delivery(
            page, self._change_ledger_cursor, primed=self._change_ledger_primed
        )
        self._change_ledger_cursor = plan.cursor
        self._change_ledger_primed = True
        self._log_workspace_change_delivery(plan)
        return plan

    @staticmethod
    def _log_workspace_change_delivery(plan: _WorkspaceChangeDelivery) -> None:
        """把投递结论写进日志。

        `priming` 是正常冷启动，用 info；其余跳过都是"账本这一轮没给出清单"，用
        warning——它们出现得频繁就说明变更链路在退化，而这个退化除了这里没有别的地方
        会表现出来（模型那边只会安静地收不到通知）。
        """
        if plan.skipped is _WorkspaceChangeSkip.PRIMING:
            logger.info(f"[ChangeLedger] 对齐工作区变更起点: revision={plan.cursor}")
        elif plan.skipped is not None:
            logger.warning(
                f"[ChangeLedger] 账本本轮未提供变更清单（{plan.skipped.value}），"
                f"条目集合改用重新观测维护: revision={plan.cursor}"
            )

        changes = plan.changes
        if changes.empty and not changes.unresolved:
            return
        logger.info(
            f"[ChangeLedger] 工作区变化: +{len(changes.added)} -{len(changes.removed)} "
            f"unresolved={changes.unresolved} revision={plan.cursor}"
        )

    async def async_complete_dynamic_init(self) -> None:
        """初始化用户语言与 Claw 读取状态，目录在每轮上下文准备时统一刷新。

        此方法由 AgentRuntime 在 Agent 构造完成后、首次运行前按策略调用。
        Horizon 首次 build_context_update 时会将这些内容注入 LLM 的 initial_context。
        """
        horizon = self.agent_context.horizon

        # ── 用户偏好语言 ─────────────────────────────────────────────────────
        if not i18n.is_language_manually_set():
            language = "<Please determine the language used by the user based on the following user messages.>"
        else:
            language = i18n.get_language_display_name()
        await horizon.set_user_preferred_language(language)

        # magiclaw 实例恢复：从持久化 file_records 反推已读状态，不清空已读集合
        # 只有 /new、/compact 才走硬重置（on_context_reset → reset_magiclaw_startup）
        if self.agent_context.is_magiclaw():
            from app.path_manager import PathManager
            await self.agent_context.horizon.restore_magiclaw_startup(PathManager.get_magic_dir())

        logger.info("async_complete_dynamic_init 完成：language 已同步到 horizon")

    def _generate_agent_id(self) -> str:
        """生成符合规范的 Agent ID"""
        first_char = random.choice(string.ascii_letters)
        remaining_chars = ''.join(random.choices(string.ascii_letters + string.digits, k=5))
        new_id = first_char + remaining_chars
        # 移除不必要的校验逻辑，生成逻辑已保证格式正确
        logger.info(f"自动生成新的 Agent ID: {new_id}")
        return new_id

    def _apply_final_task_state(self, final_task_state: FinalTaskState) -> None:
        """应用最终任务终态并同步 Agent 状态。"""
        self.agent_context.set_final_task_state(final_task_state)
        self._last_model_call_failure = None
        self.agent_context.set_final_response(None)
        if final_task_state.task_status == TaskStatus.SUSPENDED:
            self.set_agent_state(AgentState.SUSPENDED)
        else:
            self.set_agent_state(AgentState.ERROR)

    async def _append_agent_run_exception_context(self, exception: Exception) -> None:
        """在异常终止当下写入隐藏上下文，供后续用户追问时给模型补齐背景。"""
        tz = self.agent_context.get_user_timezone() if self.agent_context else None
        now_str = get_current_datetime_str(tz)
        error_summary = str(exception).strip() or exception.__class__.__name__
        escaped_time = html.escape(now_str, quote=True)
        escaped_summary = html.escape(error_summary, quote=False)
        injected_context = (
            "<system_injected_context>\n"
            f'<notification source="agent_run_exception" time="{escaped_time}">\n'
            "The previous run terminated with an exception.\n"
            f"Error summary: {escaped_summary}\n"
            "This error has already been shown to the user in the UI.\n"
            "</notification>\n"
            "</system_injected_context>"
        )
        await self.chat_history.append_user_message(
            injected_context,
            show_in_ui=False,
            source="agent_run_exception",
        )

    async def _append_agent_run_exception_context_safely(self, exception: Exception) -> None:
        """写异常隐藏上下文时兜底日志，避免终态处理再被二次打断。"""
        try:
            await self._append_agent_run_exception_context(exception)
        except Exception as append_err:
            logger.error(f"添加异常终止上下文到历史记录时失败: {append_err}")

    async def _dispatch_direct_command_response(self, content: str) -> None:
        """把本地命令结果作为 assistant 消息发给前端，不触发 LLM。"""
        from agentlang.utils.snowflake import Snowflake
        from app.core.entity.event.event_context import EventContext

        tool_context = ToolContext(metadata=self.agent_context.get_metadata())
        tool_context.register_extension("agent_context", self.agent_context)
        tool_context.register_extension("event_context", EventContext())

        request_id = f"command_{Snowflake.create_default().get_id()}"
        now = datetime.now().isoformat()
        await self.agent_context.dispatch_event(
            EventType.AFTER_AGENT_REPLY,
            AfterAgentReplyEventData(
                agent_context=self.agent_context,
                model_id="command",
                model_name="Command",
                request_id=request_id,
                request_timestamp=now,
                response_timestamp=now,
                tool_context=tool_context,
                llm_response_message=ChatCompletionMessage(role="assistant", content=content),
                response=None,
                token_usage=None,
                execution_time=0.0,
                use_stream_mode=False,
                success=True,
            ),
        )

    def _iter_exception_chain(self, exception: Exception) -> List[Exception]:
        """委托给统一的 iter_exception_chain，遍历完整异常图（含侧链）。"""
        return iter_exception_chain(exception)

    def _build_final_task_state_from_exception(self, exception: Exception) -> Optional[FinalTaskState]:
        """把已知终态异常直接归一成 FinalTaskState。"""
        for current in self._iter_exception_chain(exception):
            if isinstance(current, ResourceLimitExceededException):
                if current.is_insufficient_points_error():
                    code = FinalTaskStateCode.INSUFFICIENT_POINTS
                elif current.is_consumption_rounds_limit_error():
                    code = FinalTaskStateCode.CONSUMPTION_ROUNDS_LIMIT_EXCEEDED
                elif current.is_concurrency_limit_error():
                    code = FinalTaskStateCode.TASK_CONCURRENCY_LIMIT_EXCEEDED
                else:
                    continue

                return build_final_task_state(
                    code,
                    vendor_message=current.message,
                )

        snapshot = self._find_context_window_error(exception)
        if snapshot:
            return build_final_task_state(
                FinalTaskStateCode.CONTEXT_WINDOW_EXCEEDED,
                vendor_message=snapshot.primary_message,
                status_code=snapshot.status_code,
            )

        if is_non_retryable_model_config_error(exception):
            return build_final_task_state(
                FinalTaskStateCode.MESSAGE_PROCESSING_FAILED,
                vendor_message=str(exception),
                model_error=self._resolve_model_error(exception),
            )

        return None

    def _classify_llm_exception_for_user(self, exception: Exception) -> ModelErrorCode | None:
        """仅分类已确认的模型调用异常；文案与动作由终态定义统一维护。"""
        from openai import APITimeoutError, APIConnectionError, APIStatusError

        if is_non_retryable_model_config_error(exception):
            return ModelErrorCode.CONFIG_ERROR

        for current in self._iter_exception_chain(exception):
            if isinstance(current, (StreamChunkTimeoutError, StreamInterruptedError, asyncio.TimeoutError, APITimeoutError)):
                return ModelErrorCode.TIMEOUT
            if isinstance(current, APIConnectionError):
                return ModelErrorCode.CONNECTION_FAILED
            if isinstance(current, APIStatusError):
                if current.status_code in self._PROVIDER_RATE_LIMIT_STATUS_CODES:
                    return ModelErrorCode.RATE_LIMITED
                if current.status_code in self._NON_RETRYABLE_STATUS_CODES:
                    # 400/401/403/404/405：配置错误、权限问题或消息序列损坏，重试无意义，需要人工介入
                    return (
                        ModelErrorCode.REQUEST_REJECTED
                        if current.status_code in (400, 405)
                        else ModelErrorCode.CONFIG_ERROR
                    )
                return ModelErrorCode.SERVICE_ERROR
            if isinstance(current, (ConnectionError, OSError)):
                return ModelErrorCode.CONNECTION_FAILED

        return None

    def _create_model_error(self, code: ModelErrorCode, model_name: str | None = None) -> ModelError:
        model_context = self.agent_context.model_context
        can_switch = (
            self.agent_context.is_interactive_main_agent_context()
            and not model_context.has_active_compact_text_model()
        )
        return ModelError(
            code,
            model_context.current_text_model_id if can_switch else None,
            model_name if can_switch else None,
        )

    def _resolve_model_error(self, exception: Exception) -> ModelError | None:
        failure = self._last_model_call_failure
        if failure and any(current is failure.exception for current in self._iter_exception_chain(exception)):
            return failure.error
        if is_non_retryable_model_config_error(exception):
            return ModelError(ModelErrorCode.CONFIG_ERROR)
        return None

    async def run_main_agent(self, request: AgentRunRequest):
        """运行主 agent。"""
        query = request.query
        try:
            # 触发主 agent 运行前事件
            await self.agent_context.dispatch_event(EventType.BEFORE_MAIN_AGENT_RUN, BeforeMainAgentRunEventData(
                agent_context=self.agent_context,
                agent_name=self.agent_name,
                query=query
            ))

            await self.run(request)

            # 触发主 agent 运行后事件
            logger.info(f"run_main_agent: 准备发送 AFTER_MAIN_AGENT_RUN 事件，agent_state = {self.agent_state.value}")
            await self.agent_context.dispatch_event(EventType.AFTER_MAIN_AGENT_RUN, AfterMainAgentRunEventData(
                agent_context=self.agent_context,
                agent_name=self.agent_name,
                agent_state=self.agent_state.value,
                query=query
            ))
        except Exception as e:
            logger.error(f"主 agent 运行异常: {e!s}")
            if isinstance(e, UserFriendlyException):
                final_task_state = self._build_final_task_state_from_exception(e) or build_final_task_state(
                    FinalTaskStateCode.MESSAGE_PROCESSING_FAILED,
                    vendor_message=str(e),
                    custom_message=e.get_user_friendly_message(),
                )
                self.agent_context.set_final_task_state(final_task_state)
                await self.agent_context.dispatch_event(EventType.ERROR, ErrorEventData(
                    agent_context=self.agent_context,
                    final_task_state=final_task_state,
                ))
        finally:
            # 每次请求结束后回收内存碎片：强制 GC 并归还空闲 arena 给 OS
            self._reclaim_memory()

    @staticmethod
    def _reclaim_memory() -> None:
        """回收 Python 堆碎片，尝试将空闲内存归还给操作系统。

        长会话中大量 JSON 序列化/反序列化会产生 pymalloc arena 碎片，
        导致 RSS 只增不减。在每个请求间隙（用户不感知延迟）执行：
        1. gc.collect() — 回收循环引用
        2. malloc_trim(0) — 通知 glibc 归还空闲 arena（仅 Linux）
        """
        try:
            gc.collect()
            if platform.system() == "Linux":
                libc = ctypes.CDLL("libc.so.6")
                libc.malloc_trim(0)
        except Exception:
            pass

    async def run(self, request: AgentRunRequest):
        """运行 agent。"""
        run_task = self._claim_run()
        try:
            result = await self._run_once(request)
        except asyncio.CancelledError:
            self._set_run_terminal_state(run_task, AgentState.SUSPENDED)
            raise
        except Exception:
            self._set_run_terminal_state(run_task, AgentState.ERROR)
            raise
        else:
            self._set_run_terminal_state(run_task, AgentState.FINISHED)
            return result
        finally:
            resumption_id = self.agent_context.get_resumption_id()
            if resumption_id:
                try:
                    # MOCK DEMO：如果 run 在 Horizon 注入前被取消，
                    # 这条 assigned 事项仍未被消费，必须释放回 pending。
                    await self.agent_context.horizon.release_resumption(
                        resumption_id,
                        "Agent run ended before the resumption was injected",
                    )
                except Exception as release_error:
                    logger.warning(
                        "释放未完成 Agent resumption 失败: resumption_id=%s error=%s",
                        resumption_id,
                        release_error,
                    )
            self.agent_context.set_resumption_context(None, None)
            self._release_run(run_task)

    def _push_web_search_runtime_context(self) -> None:
        """每次运行及压缩后提供当前搜索偏好；旧协议未声明时不生成相反的默认提示。"""
        enabled = self.agent_context.get_web_search_enabled()
        if enabled is None:
            return
        content = (
            "Web search is enabled for this run. Use internet search tools when needed; searching is not required."
            if enabled else
            "Web search is disabled for this run. Use workspace content and do not call internet search tools."
        )
        self.agent_context.horizon.push_notification("web_search", content)

    async def _run_once(self, request: AgentRunRequest):
        """执行单轮 Agent 业务逻辑；run() 统一管理执行身份。"""
        query = request.query
        self.agent_context.set_final_task_state(None)
        self.agent_context.set_final_response(None)

        # 异步加载聊天记录（幂等：首次加载从磁盘读取并修复序列，后续调用跳过）
        await self.chat_history.load()

        session_prep_result = await self._prepare_run_session(request)

        if session_prep_result.direct_response is not None:
            await self._dispatch_direct_command_response(session_prep_result.direct_response)
            self.agent_context.set_final_response(session_prep_result.direct_response)
            self.set_agent_state(AgentState.FINISHED)
            return session_prep_result.direct_response

        """
        同一 Agent 会跨 CHAT 复用：每个 run 提供当前设置，避免模型沿用初始化时的旧开关。
        关闭自动记忆仍保留 Skill 与目录知识；不在每次工具调用后重复发送。
        例：上一条 CHAT 自动开启，这条关闭；重新发当前事实即可，不必重建 Agent 或删 Skill。
        """
        self.agent_context.horizon.push_notification("memory", build_memory_runtime_context(self.agent_context))
        self._push_web_search_runtime_context()

        # 注入点1：用户消息入库后、第一次 LLM 调用前，注入 system_injected_context
        # 若历史末尾存在未完成的 tool call 序列，跳过注入避免破坏序列完整性
        # MOCK DEMO：/resume 不会追加可见用户消息；这里只把 Horizon 的恢复事项
        # 作为隐藏上下文写入 ChatHistory，供 LLM 继续调用 get_sandbox_info。
        resumption_id = self.agent_context.get_resumption_id()
        resumption_injected = False
        try:
            await UserContextService.refresh(self.agent_context, first_only=True)
        except Exception as error:
            logger.warning(f"Initial user profile preparation failed: {type(error).__name__}")
        try:
            if self.chat_history._is_tool_call_sequence_complete():
                ctx_update = await self._build_horizon_context_update_safely(
                    injection_point=HorizonInjectionPoint.BEFORE_FIRST_LLM,
                    log_context="注入点1",
                )
                if ctx_update:
                    await self.chat_history.append_user_message(ctx_update, show_in_ui=False, source="horizon")
                    resumption_injected = bool(resumption_id)
                    if resumption_id:
                        # 上下文已经送进 Agent 后立即消费事项，不等待最终回答，
                        # 避免工具失败或模型中断造成重复自动恢复。
                        await self.agent_context.horizon.complete_resumption(resumption_id)
                    logger.debug("[AgentHorizon] 已注入 user query 后 system_injected_context")
            else:
                logger.warning("[AgentHorizon] 注入点1 跳过：历史末尾存在未完成的 tool call 序列，避免消息序列错误")
        except Exception as _horizon_err:
            if resumption_id and not resumption_injected:
                await self.agent_context.horizon.release_resumption(
                    resumption_id,
                    f"Horizon resumption injection failed: {_horizon_err}",
                )
            logger.warning(f"[AgentHorizon] 注入点1 注入失败: {_horizon_err}")

        self.set_agent_state(AgentState.RUNNING)
        # 后台任务可能携带完整 Skill；日志只保留单行预览，模型与历史仍使用完整 query。
        query_preview_limit: int = 100
        query_preview: str = repr(query[:query_preview_limit])
        if len(query) > query_preview_limit:
            query_preview += "..."
        logger.info(
            f"开始运行 agent: {self.agent_name}, id: {self.id}, "
            f"query_length: {len(query)}, query_preview: {query_preview}"
        )

        # 根据 stream_mode 选择不同的 Agent Loop 方式
        try:
            if self.stream_mode:
                return await self._handle_agent_loop_stream()
            else:
                result = await self._handle_agent_loop(session_prep_result)
                await self._refresh_user_context_after_main_run()
                return result
        finally:
            # 任务被用户终止时，agent 协程会被 cancel 异常强制挂掉，需要在这里关闭所有资源
            await self.agent_context.close_all_resources()

    async def _prepare_run_session(
        self,
        request: AgentRunRequest,
    ) -> SessionPrepResult:
        """准备本轮运行需要的会话状态，并保证 prepare 段完整收尾。"""
        prepare_blocker_acquired = False
        try:
            # prepare 阶段要确保能完整写入会话，再进入可取消的主循环。
            self.agent_context.increment_cancel_blocker()
            prepare_blocker_acquired = True

            # 构造 chat_history
            # ChatHistory 在 run() 入口已 await load()
            # 检查是否需要添加 System Prompt (仅在历史为空时)
            if not self.chat_history.messages:
                logger.info("聊天记录为空，添加主 System Prompt")
                await self.chat_history.append_system_message(self.system_prompt)
            else:
                # 聊天记录存在时，更新第一条 system message 为最新的 system_prompt
                # 因为代码会更新，聊天记录不会更新，需要在 agent 每次运行时更新最新的 system prompt
                await self.chat_history.update_first_system_prompt(self.system_prompt)

            return await self._prepare_session_for_new_query(request)
        finally:
            if prepare_blocker_acquired:
                self.agent_context.decrement_cancel_blocker()

    async def _prepare_session_for_new_query(
        self,
        request: AgentRunRequest,
    ) -> SessionPrepResult:
        """
        准备会话：处理pending工具调用和用户查询

        Args:
            request: Agent 运行请求

        Returns:
            SessionPrepResult: 会话准备结果
        """
        query = request.query

        # 检测用户命令（/compact、/new 等），命令处理后 query 替换为命令执行结果
        command_match = Commands.get(query)
        is_continue_request = command_match and command_match.command.name == "continue"
        is_resume_request = command_match and command_match.command.name == "resume"

        if command_match:
            command_result = await Commands.process(query, self)
            if command_result.skip_llm:
                return SessionPrepResult(
                    user_message_added=False,
                    direct_response=command_result.direct_response or "",
                )
            request = request.with_query(command_result.query or "")

        # 如果没有聊天历史，直接添加用户消息
        if not self.chat_history.messages:
            await self._append_user_query(request)
            return SessionPrepResult(user_message_added=True)

        # 查找pending工具调用
        assistant_with_pending_tools = self._find_pending_tool_calls()

        if assistant_with_pending_tools:
            if is_continue_request and not self._is_response_interrupted(assistant_with_pending_tools):
                # 工具调用参数完整（response 未在流式输出期间被中断），安全恢复执行
                logger.info("检测到'继续'请求且工具调用参数完整，将直接恢复工具调用")
                return SessionPrepResult(
                    pending_assistant_message=assistant_with_pending_tools,
                    user_message_added=False
                )
            else:
                # response 被中断（参数可能不完整）或用户提出新请求，合成中断 tool results 让 LLM 重新决策
                reason = "原始响应被中断，工具调用参数可能不完整" if is_continue_request else "用户提出新请求"
                logger.info(f"检测到pending工具调用，{reason}，将合成中断 tool results 让 LLM 重新决策")
                await self._synthesize_interruption_tool_results(
                    assistant_with_pending_tools,
                    reason=self._build_pending_tool_interruption_message(assistant_with_pending_tools),
                )
                await self._append_user_query(request)
                return SessionPrepResult(user_message_added=True)
        else:
            # /resume 是系统内部信号（由 ask_user 等工具的 resume 流程发出）：
            # ToolResult 已写入历史，LLM 直接响应即可，不追加任何用户消息。
            if is_resume_request:
                logger.info("检测到 /resume 信号，跳过追加用户消息，直接让 LLM 响应工具结果")
                return SessionPrepResult(user_message_added=False)

            # 没有pending工具调用，正常添加用户消息
            await self._append_user_query(request)
            return SessionPrepResult(user_message_added=True)

    async def _append_user_query(self, request: AgentRunRequest) -> None:
        """写入用户消息，并重置本轮原生视觉 Horizon 去重状态。"""
        self._native_visual_horizon_context_signature = None
        self._native_visual_horizon_render_hint = None
        if not request.image_refs:
            await self.chat_history.append_user_query(request)
            return

        image_refs = list(dict.fromkeys(request.image_refs))
        native_image_refs = self._message_renderer.limit_chat_native_image_refs(image_refs)
        message = await self._native_visual_message_builder.build_user_message(
            request.query,
            native_image_refs,
        )
        await self.chat_history.add_message(message)
        overflow_hint = NativeVisualOverflowHintBuilder.build(
            image_refs,
            self._message_renderer.max_native_image_refs,
            supports_multimodal=(
                self._resolve_current_text_model().config.supports_multimodal
            ),
        )
        if overflow_hint:
            self.agent_context.horizon.push_notification(
                "native_visual_overflow",
                overflow_hint,
            )

    async def _handle_agent_loop(self, session_prep_result: SessionPrepResult) -> None:
        """处理 agent 循环 - 使用Context对象简化参数传递和状态管理"""
        loop_state = AgentLoopState()

        while loop_state.should_continue:
            loop_state.loop_index += 1
            round_outcome = AgentLoopOutcome.ERROR
            round_restored = False
            # 更新活动时间，用于活动追踪
            self.agent_context.update_activity_time()

            # 若上一轮 LLM 未调用 compact_chat_history 工具（调用了其他工具），
            # compact 临时模型仍存在，在新一轮 LLM 调用前还原模型
            self._restore_stale_compact_model_before_loop()

            try:
                # 如果预检测到pending工具调用，直接使用它
                if session_prep_result.pending_assistant_message:
                    logger.info("使用预检测的pending工具调用，直接恢复执行")
                    restore_context = SessionRestoreContext(
                        action=SessionRestoreAction.SKIP_LLM,
                        assistant_message=session_prep_result.pending_assistant_message
                    )
                    # 清除pending状态，避免重复使用
                    session_prep_result.pending_assistant_message = None
                else:
                    # 检查是否需要恢复会话
                    restore_context = await self._check_and_restore_session()

                # 判断是否跳过LLM调用
                if restore_context.action == SessionRestoreAction.SKIP_LLM:
                    # 使用恢复的会话
                    restored_context = await self._restore_session_state(restore_context.assistant_message)
                    if restored_context.action == SessionRestoreAction.ERROR:
                        loop_state.last_llm_message = None
                        self._apply_final_task_state(build_final_task_state(
                            FinalTaskStateCode.SESSION_RESTORE_FAILED,
                            vendor_message=restored_context.error_message or "",
                        ))
                        break

                    loop_state.last_llm_message = restored_context.llm_response  # 也更新last_llm_message
                    round_restored = True

                    # 创建LLM上下文用于后续处理
                    llm_context = LLMResponseContext(
                        message=restored_context.llm_response,
                        tool_calls=restored_context.tool_calls,
                        request_id=None  # 会话恢复的情况下没有 request_id
                    )
                elif restore_context.action == SessionRestoreAction.ERROR:
                    loop_state.last_llm_message = None
                    self._apply_final_task_state(build_final_task_state(
                        FinalTaskStateCode.SESSION_RESTORE_FAILED,
                        vendor_message=restore_context.error_message or "",
                    ))
                    break
                else:
                    # 调用LLM获取响应（两阶梯重试在 _call_llm_with_retry 内闭环）
                    try:
                        llm_context = await self._call_llm_with_retry(loop_state)
                    except LLMCallRequestException as e:
                        # 前后置准备/解析异常（非 provider 调用失败），按普通异常处理
                        exception_result = await self._handle_agent_loop_exception(
                            e.original_exception,
                            loop_state,
                        )
                        if exception_result.final_response:
                            loop_state.final_response = exception_result.final_response
                        if not exception_result.should_continue:
                            break
                        continue
                    except Exception as e:
                        # LLM 两阶梯重试全部耗尽后抛出的异常
                        exception_result = await self._handle_agent_loop_exception(
                            e,
                            loop_state,
                        )
                        if exception_result.final_response:
                            loop_state.final_response = exception_result.final_response
                        if not exception_result.should_continue:
                            break
                        continue
                    loop_state.last_llm_message = llm_context.message  # 保存用于循环结束时的最终响应

                    # finish_reason 截断恢复：输出真正撞到了模型 max_tokens 上限
                    # max_tokens 已直接使用配置最大值，无扩容空间，直接注入恢复消息
                    if llm_context.finish_reason in self._OUTPUT_TRUNCATED_FINISH_REASONS:
                        if llm_context.has_tool_calls:
                            logger.warning(
                                f"finish_reason={llm_context.finish_reason} 且有 tool_calls，"
                                "合成 error tool_result 占位，跳过工具执行"
                            )
                        await self._add_tool_calls_to_history(llm_context)
                        if llm_context.has_tool_calls:
                            await self._synthesize_error_tool_results(
                                llm_context.tool_calls,
                                "Tool call was not executed because the response ended with "
                                f"finish_reason='{llm_context.finish_reason}' and may be incomplete.",
                            )
                        await self._try_inject_output_recovery_message(
                            loop_state,
                            f"The response ended with finish_reason='{llm_context.finish_reason}'. "
                            "The output may be incomplete. Any tool calls in that response were not executed.",
                            source="max_output_tokens_recovery",
                        )
                        round_outcome = AgentLoopOutcome.MAINTENANCE
                        continue

                    # 预处理工具参数：修复畸形 JSON、检测截断
                    # 部分模型（如千问）截断工具参数时仍返回 finish_reason=tool_calls，
                    # 上面的 finish_reason 检测无法覆盖，通过检测畸形 JSON 来发现截断。
                    if llm_context.has_tool_calls:
                        self._tool_preflight_failures = {}
                        preprocess_result = preprocess_tool_calls_batch(llm_context.tool_calls)
                        if preprocess_result.processed_count > 0:
                            logger.debug(f"工具调用参数预处理完成，处理了 {preprocess_result.processed_count} 个工具调用")
                        if preprocess_result.has_truncation:
                            logger.warning(
                                f"检测到工具参数截断: "
                                f"{', '.join(preprocess_result.truncated_tool_names)}，"
                                f"合成 error tool_result，跳过工具执行"
                            )
                            await self._add_tool_calls_to_history(llm_context)
                            await self._synthesize_error_tool_results(
                                llm_context.tool_calls,
                                "Tool calls were not executed because one or more argument payloads "
                                "could not be parsed as a JSON object.",
                            )
                            await self._try_inject_output_recovery_message(
                                loop_state,
                                "Tool argument preprocessing failed for: "
                                f"{', '.join(preprocess_result.truncated_tool_names)}. "
                                "Their arguments could not be parsed as JSON objects. "
                                "No tool calls from that response were executed.",
                                source="tool_args_truncation_recovery",
                            )
                            round_outcome = AgentLoopOutcome.MAINTENANCE
                            continue
                        for candidate in preprocess_result.json_repair_candidates:
                            validation = await tool_argument_json_repair_validation_service.validate(
                                tool_name=candidate.tool_name,
                                original_arguments=candidate.original_arguments,
                                repaired_arguments=candidate.repaired_arguments,
                                tool_schema=candidate.tool_schema,
                                interruption_event=self.agent_context.get_interruption_event(),
                            )
                            if validation.valid:
                                matching_call = next(
                                    (
                                        tc
                                        for tc in llm_context.tool_calls
                                        if tc.id == candidate.tool_call_id
                                    ),
                                    None,
                                )
                                if matching_call is not None:
                                    matching_call.function.arguments = candidate.repaired_arguments
                            else:
                                self._tool_preflight_failures[candidate.tool_call_id] = validation.advice

                    # 添加工具调用响应到历史（现在包含修复后的参数）
                    # 中断时 stop_run 会在 cancel_blocker 归零后调用 task.cancel()，
                    # 下一个 await 即会抛出 CancelledError，导致历史无法落盘。
                    # 用 asyncio.shield 保护写入：即使 task 被 cancel，shielded task
                    # 仍会在事件循环内完成文件写入，CancelledError 自然向上传播。
                    is_interrupted = self.agent_context.is_interruption_requested()
                    if is_interrupted:
                        await asyncio.shield(self._add_tool_calls_to_history(llm_context, interrupted=True))
                    else:
                        await self._add_tool_calls_to_history(llm_context)

                    # State recovery checkpoint: runs immediately after a successful LLM call,
                    # regardless of whether the response contains tool calls or not.
                    # If the state is ERROR, it means a previous call failed but this retry succeeded.
                    # Must be placed here (before break/continue branches) so it is never skipped.
                    if self.is_agent_error():
                        retry_info = (
                            f"（agent loop 重试 {loop_state.agent_loop_retry_count} 次）"
                            if loop_state.agent_loop_retry_count > 0 else ""
                        )
                        logger.info(f"从 ERROR 状态恢复为 RUNNING{retry_info}")
                        self.set_agent_state(AgentState.RUNNING)
                        loop_state.agent_loop_retry_count = 0
                        # 重置 LLM 重试状态（成功恢复后重新开始）
                        split_hint_injected = loop_state.retry_state.split_recovery_hint_injected
                        loop_state.retry_state = LLMRetryState(
                            split_recovery_hint_injected=split_hint_injected,
                        )

                    # 处理无工具调用的情况
                    if not llm_context.has_tool_calls and llm_context.message.role == "assistant":
                        await self._handle_no_tool_calls(llm_context, loop_state)
                        if not loop_state.should_continue:
                            # todo都完成了，退出循环
                            round_outcome = AgentLoopOutcome.NORMAL
                            # 没有追加提醒，按模型本次结束意图退出，不代表所有事项都已完成。
                            break
                        else:
                            # 还有未完成的todo，继续循环让大模型继续处理
                            round_outcome = AgentLoopOutcome.NORMAL
                            # 提醒已进入上下文，继续调用模型，由模型处理未完成事项。
                            continue

                    # Reset no_tool_call_count when tools are called successfully
                    loop_state.no_tool_call_count = 0

                # Unified state recovery for the session-restore branch (SKIP_LLM path).
                # The LLM-call branch now handles recovery earlier (above), but for the
                # session-restore path we still need this guard before executing tool calls.
                if self.is_agent_error():
                    retry_info = (
                        f"（agent loop 重试 {loop_state.agent_loop_retry_count} 次）"
                        if loop_state.agent_loop_retry_count > 0 else ""
                    )
                    logger.info(f"从 ERROR 状态恢复为 RUNNING（会话恢复路径）{retry_info}")
                    self.set_agent_state(AgentState.RUNNING)
                    loop_state.agent_loop_retry_count = 0
                    split_hint_injected = loop_state.retry_state.split_recovery_hint_injected
                    loop_state.retry_state = LLMRetryState(
                        split_recovery_hint_injected=split_hint_injected,
                    )

                # 执行工具调用并处理结果
                tool_result = await self._execute_and_process_tool_calls(llm_context)

                # 注入点 2：tool result 返回后，注入 system_injected_context
                # 无论是否 should_exit 都注入，因为 hidden message 会留在 chat history 供后续 LLM call 读取
                try:
                    if tool_result.inject_horizon_after_tools:
                        ctx_update = await self._build_horizon_context_update_safely(
                            injection_point=HorizonInjectionPoint.AFTER_TOOL_RESULT,
                            log_context="tool result 后",
                        )
                        if ctx_update:
                            await self.chat_history.append_user_message(ctx_update, show_in_ui=False, source="horizon")
                            logger.debug("[AgentHorizon] 已注入 tool result 后 system_injected_context")
                except Exception as _horizon_err:
                    logger.warning(f"[AgentHorizon] tool result 后注入失败: {_horizon_err}")

                # 工具执行后检测到参数超长导致校验失败（has_long_args_failure）：
                # 参数 JSON 语法正确但缺少必填字段，preprocess 阶段不会检测到，
                # 执行报错后在此注入恢复消息
                if tool_result.has_long_args_failure:
                    await self._try_inject_output_recovery_message(
                        loop_state,
                        "One or more failed tool calls had arguments longer than "
                        f"{self._LONG_ARGS_THRESHOLD} characters. "
                        "Their tool results contain the reported errors; "
                        "argument length alone does not establish why the calls failed.",
                        source="tool_args_truncation_recovery",
                    )

                round_outcome = resolve_completed_loop_outcome(
                    restored=round_restored,
                    waiting_for_user=self.agent_state == AgentState.WAITING_FOR_USER,
                    maintenance=tool_result.has_long_args_failure or tool_result.has_compact_history,
                )
                if tool_result.should_exit:
                    loop_state.final_response = tool_result.final_response
                    break

            except Exception as e:
                round_outcome = AgentLoopOutcome.ERROR
                # 处理非 LLM 异常（工具执行失败等）
                exception_result = await self._handle_agent_loop_exception(
                    e,
                    loop_state,
                )
                if exception_result.final_response:
                    loop_state.final_response = exception_result.final_response
                if not exception_result.should_continue:
                    break
            finally:
                await self._emit_after_agent_loop(loop_state, round_outcome)

        # 完成循环后的清理工作
        return await self._finalize_agent_loop(loop_state)

    async def _emit_after_agent_loop(self, loop_state: AgentLoopState, outcome: AgentLoopOutcome) -> None:
        """发出本轮结束事件。取消时不投递，避免拖延退出；投递失败不回到主循环重试。"""
        if isinstance(sys.exc_info()[1], asyncio.CancelledError):
            return
        if outcome == AgentLoopOutcome.NORMAL:
            loop_state.effective_loop_count += 1
        try:
            await self.agent_context.dispatch_event(
                EventType.AFTER_AGENT_LOOP,
                AfterAgentLoopEventData(
                    agent_context=self.agent_context,
                    agent_name=self.agent_name,
                    loop_index=loop_state.loop_index,
                    effective_loop_count=loop_state.effective_loop_count,
                    outcome=outcome,
                ),
            )
        except Exception as error:
            logger.warning(f"派发循环结束事件失败: {error.__class__.__name__}")

    async def _check_and_restore_session(self) -> SessionRestoreContext:
        """
        检查是否需要恢复上一次会话状态，并返回相应的执行配置

        注意：这个方法现在主要处理传统的会话恢复逻辑，
        新的pending工具调用检测已移到 _prepare_session_for_new_query 中

        Returns:
            SessionRestoreContext: 会话恢复上下文，包含动作和相关数据
        """
        # 获取最后和倒数第二条非内部消息
        last_message = self.chat_history.get_last_message()
        second_last_message = self.chat_history.get_second_last_message()

        # 检查是否满足恢复的基本条件
        if last_message and last_message.role == "user":
            last_user_query_content = last_message.content

            # 检查是否是"继续"指令
            last_command_match = Commands.get(last_user_query_content)
            is_continue_request = last_command_match and last_command_match.command.name == "continue"

            # 情况1：倒数第二条是带工具调用的assistant消息（传统模式）
            if second_last_message and second_last_message.role == "assistant" and \
            isinstance(second_last_message, AssistantMessage) and second_last_message.tool_calls:
                logger.info("进行恢复会话状态检查")
                # 处理工具调用到一半被中断，用户又希望继续的情况
                if is_continue_request:
                    return await self._handle_continue_request(second_last_message)
                else:
                    # 用户提出了新请求
                    return await self._handle_new_request(second_last_message)

        # 不满足恢复条件
        logger.debug("最后消息非用户消息，或没有找到需要恢复的会话状态，跳过恢复会话状态检查")
        return SessionRestoreContext(action=SessionRestoreAction.CALL_LLM)

    def _find_pending_tool_calls(self) -> Optional[AssistantMessage]:
        """
        查找最近的带工具调用但没有对应工具消息的AssistantMessage

        Returns:
            Optional[AssistantMessage]: 找到的pending工具调用消息，如果没有则返回None
        """
        messages = self.chat_history.messages

        # 从后往前查找最近的一条AssistantMessage with tool_calls
        for i in range(len(messages) - 1, -1, -1):
            message = messages[i]

            # 跳过用户消息，只关注assistant消息
            if message.role != "assistant":
                continue

            # 检查是否是带工具调用的AssistantMessage
            if isinstance(message, AssistantMessage) and message.tool_calls:
                # 检查这些tool_calls是否有对应的tool消息
                tool_call_ids = {tc.id for tc in message.tool_calls}

                # 在此消息之后查找对应的tool消息
                found_tool_responses = set()
                for j in range(i + 1, len(messages)):
                    next_msg = messages[j]
                    if hasattr(next_msg, 'tool_call_id') and next_msg.tool_call_id in tool_call_ids:
                        found_tool_responses.add(next_msg.tool_call_id)

                # 如果有工具调用没有对应的响应，说明是pending状态
                if len(found_tool_responses) < len(tool_call_ids):
                    missing_tool_calls = tool_call_ids - found_tool_responses
                    logger.info(f"找到pending工具调用: message index {i}, missing responses for {missing_tool_calls}")
                    logger.info(f"将恢复工具调用: {[tc.function.name for tc in message.tool_calls if tc.id in missing_tool_calls]}")
                    return message
                else:
                    # 如果最近的AssistantMessage的工具调用都已完成，则没有pending状态
                    logger.debug("最近的AssistantMessage工具调用已完成，无pending状态")
                    return None

        return None

    @staticmethod
    def _is_response_interrupted(assistant_message: AssistantMessage) -> bool:
        """检测 assistant 响应是否在 LLM 流式输出期间被用户中断。
        被中断意味着 tool call 参数可能不完整，不应直接重放。
        """
        return assistant_message.interrupted

    def _get_missing_tool_calls(self, assistant_message: AssistantMessage) -> List[ToolCall]:
        """从 assistant 消息中提取缺失 tool result 的 tool calls。"""
        if not assistant_message.tool_calls:
            return []

        messages = self.chat_history.messages
        # 找到该 assistant 消息在历史中的位置
        msg_index = -1
        for i, msg in enumerate(messages):
            if msg is assistant_message:
                msg_index = i
                break

        if msg_index < 0:
            return list(assistant_message.tool_calls)

        # 收集该消息之后已有的 tool result ids
        found_ids: set[str] = set()
        for j in range(msg_index + 1, len(messages)):
            if hasattr(messages[j], 'tool_call_id') and messages[j].tool_call_id:
                found_ids.add(messages[j].tool_call_id)

        return [tc for tc in assistant_message.tool_calls if tc.id not in found_ids]

    @staticmethod
    def _build_stream_interrupted_tool_call_message() -> str:
        """给模型的说明：tool call 在参数流式输出期间被打断，不能信任残缺参数。"""
        return (
            "This tool call was interrupted by the user before it finished streaming. "
            "The tool was not executed. The arguments above may be incomplete because "
            "only part of the tool call had streamed before the interruption."
        )

    def _build_execution_interrupted_tool_message(self, error: Exception) -> str:
        """给模型的说明：tool call 参数已定稿，但执行过程未完成。"""
        from openai import APITimeoutError, APIConnectionError, APIStatusError

        for current in self._iter_exception_chain(error):
            if isinstance(current, (asyncio.TimeoutError, TimeoutError, StreamChunkTimeoutError, APITimeoutError)):
                return (
                    "This tool execution stopped before completion because it timed out. "
                    "The arguments above are complete, but the tool did not finish running."
                )

            if isinstance(current, (ConnectionError, OSError, APIConnectionError)):
                return (
                    "This tool execution stopped before completion because of a connection "
                    "or environment issue. The arguments above are complete, but the tool "
                    "did not finish running."
                )

            if isinstance(current, PermissionError):
                return (
                    "This tool execution stopped before completion because access to a "
                    "required resource was denied. The arguments above are complete, but "
                    "the tool did not finish running."
                )

            if isinstance(current, FileNotFoundError):
                return (
                    "This tool execution stopped before completion because a required "
                    "resource was not found. The arguments above are complete, but the "
                    "tool did not finish running."
                )

            if isinstance(current, APIStatusError) and current.status_code in self._NON_RETRYABLE_STATUS_CODES:
                return (
                    "This tool execution stopped before completion because of a "
                    "configuration or permission issue. The arguments above are complete, "
                    "but the tool did not finish running."
                )

        return (
            "This tool execution stopped before completion because of a runtime failure. "
            "The arguments above are complete, but the tool did not finish running."
        )

    @staticmethod
    def _build_pending_running_tool_interrupted_message() -> str:
        """给模型的说明：tool call 参数完整，但工具执行中被新的用户消息打断。"""
        return (
            "This tool call was interrupted by the user while the tool was running. "
            "The arguments above are complete, but the tool did not finish running."
        )

    def _build_pending_tool_interruption_message(self, assistant_message: AssistantMessage) -> str:
        """根据 pending tool 的阶段选择正确的中断提示文案。"""
        if self._is_response_interrupted(assistant_message):
            return self._build_stream_interrupted_tool_call_message()
        return self._build_pending_running_tool_interrupted_message()

    async def _synthesize_interruption_tool_results(
        self,
        assistant_message: AssistantMessage,
        reason: Optional[str] = None,
    ) -> None:
        """为被中断的 pending tool calls 合成 tool result，让 LLM 知道中断原因。
        只为缺失 result 的 tool call 补充，不影响已有结果。
        """
        missing_tcs = self._get_missing_tool_calls(assistant_message)
        if not missing_tcs:
            return
        if reason is None:
            reason = self._build_pending_tool_interruption_message(assistant_message)
        notices = self.agent_context.drain_interruption_notices()
        if notices:
            reason = "\n\n".join([
                reason,
                "Runtime interruption details:",
                *notices,
            ])
        await self._synthesize_error_tool_results(missing_tcs, reason)

    async def _handle_continue_request(self, second_last_message: AssistantMessage) -> SessionRestoreContext:
        """处理用户请求继续：仅当原始响应未被中断（工具参数完整）时才恢复执行。"""
        if self._is_response_interrupted(second_last_message):
            logger.info("检测到用户请求继续但原始响应被中断，工具调用参数可能不完整，走中断路径让 LLM 重新决策")
            return await self._handle_new_request(second_last_message)
        logger.info("检测到用户请求继续且工具调用参数完整，恢复上一次工具调用")
        await self.chat_history.remove_last_message()
        return SessionRestoreContext(
            action=SessionRestoreAction.SKIP_LLM,
            assistant_message=second_last_message
        )

    async def _handle_new_request(self, second_last_message: AssistantMessage) -> SessionRestoreContext:
        """处理用户提出新请求或被中断的续作：合成中断 tool results 后让 LLM 处理。"""
        logger.info("检测到未完成的工具调用，将合成中断 tool results 后让 LLM 处理")
        await self._synthesize_interruption_tool_results(second_last_message)
        return SessionRestoreContext(action=SessionRestoreAction.CALL_LLM)

    async def _restore_session_state(self, assistant_message_to_restore: AssistantMessage) -> SessionRestoreContext:
        """
        从保存的助手消息中恢复会话状态

        Args:
            assistant_message_to_restore: 需要恢复的助手消息

        Returns:
            SessionRestoreContext: 恢复的会话上下文
        """
        logger.info("跳过LLM调用，直接使用上次会话的工具调用")

        # 确保消息和工具调用有效
        if assistant_message_to_restore and assistant_message_to_restore.tool_calls:
            tool_calls_to_execute = assistant_message_to_restore.tool_calls

            try:
                # 模拟LLM响应消息用于事件传递
                openai_tool_calls_for_sim = []
                for i, tc in enumerate(tool_calls_to_execute):
                    function_name = tc.function.name
                    function_arguments = tc.function.arguments
                    openai_tool_call = ChatCompletionMessageToolCall(
                        id=tc.id,
                        type=tc.type,
                        function={"name": function_name, "arguments": function_arguments}
                    )
                    openai_tool_calls_for_sim.append(openai_tool_call)

                llm_response_message = ChatCompletionMessage(
                    role="assistant",
                    content=assistant_message_to_restore.content,
                    tool_calls=openai_tool_calls_for_sim
                )

                logger.info(f"恢复的tool_calls: {tool_calls_to_execute}")
                return SessionRestoreContext(
                    action=SessionRestoreAction.SKIP_LLM,
                    tool_calls=tool_calls_to_execute,
                    llm_response=llm_response_message,
                    assistant_message=assistant_message_to_restore
                )
            except Exception as e:
                logger.error(f"模拟恢复会话的 llm_response_message 时出错: {e}", exc_info=True)
                return SessionRestoreContext(
                    action=SessionRestoreAction.ERROR,
                    error_message="恢复会话状态时发生内部错误。"
                )
        else:
            logger.error("尝试恢复会话，但 assistant_message_to_restore 无效或无工具调用。")
            return SessionRestoreContext(
                action=SessionRestoreAction.ERROR,
                error_message="恢复会话状态时发生内部错误。"
            )

    async def _try_compact_chat_history(
        self,
        *,
        threshold_model_id: Optional[str] = None,
    ) -> bool:
        """检查并触发上下文压缩（三段式）

        1. 后台压缩已完成 → 立即应用
        2. 到达硬阈值但后台未完成 → 等待后台结果（带超时）或回退前台压缩
        3. 到达预压缩阈值 → fork 子 Agent 启动后台压缩

        Returns:
            bool: True if compaction was triggered, False otherwise
        """
        if not self.compaction_config.enable_compaction:
            self.agent_context.set_compaction_threshold_tokens(0)
            return False

        token_count = await self.chat_history.tokens_count()
        message_count = len(self.chat_history.messages)

        if not threshold_model_id:
            threshold_model_id = self._require_current_text_model_id()

        auto_threshold = getattr(
            self.compaction_config,
            "_auto_compaction_threshold",
            self.compaction_config.compaction_threshold_tokens == 0,
        )
        if auto_threshold:
            text_model_state = self._resolve_current_text_model()
            current_max_context_tokens = self._resolve_current_max_context_tokens(text_model_state)
            threshold_result = self.compaction_config.resolve_threshold_for_model(
                threshold_model_id,
                current_max_context_tokens=current_max_context_tokens,
            )
            compaction_threshold_tokens = threshold_result.compaction_threshold_tokens
            self.compaction_config.agent_model_id = threshold_model_id
            self.compaction_config.compaction_threshold_tokens = compaction_threshold_tokens
            self.compaction_config._resolved_compaction_threshold_model_id = threshold_model_id
            threshold_model_for_log = threshold_result.model_id
            threshold_max_context_tokens = threshold_result.max_context_tokens
            threshold_matched_rule = threshold_result.matched_rule_name
            threshold_used_default = threshold_result.used_default
        else:
            compaction_threshold_tokens = self.compaction_config.resolve_compaction_threshold_tokens(threshold_model_id)
            threshold_model_for_log = threshold_model_id or ""
            threshold_max_context_tokens = 0
            threshold_matched_rule = None
            threshold_used_default = False

        # 展示自动整理的硬阈值；后台提前准备仍沿用原逻辑，不另算前端比例。
        self.agent_context.set_compaction_threshold_tokens(compaction_threshold_tokens)
        early_threshold = self.compaction_config.early_compact_threshold
        message_threshold = self.compaction_config.max_conversation_rounds
        background_failed_this_snapshot = False
        logger.info(
            "压缩阈值已解析: "
            f"阈值模型={threshold_model_for_log}, "
            f"压缩阈值={compaction_threshold_tokens}, "
            f"最大上下文Token={threshold_max_context_tokens}, "
            f"命中规则={threshold_matched_rule}, "
            f"使用默认阈值={threshold_used_default}"
        )
        self._log_compaction_event(
            "check",
            "压缩检查："
            f"当前Token={token_count}，压缩阈值={compaction_threshold_tokens}，"
            f"当前消息数={message_count}，消息阈值={message_threshold}，"
            f"阈值模型={threshold_model_for_log}，"
            f"最大上下文Token={threshold_max_context_tokens}，"
            f"命中规则={threshold_matched_rule or '无'}，"
            f"使用默认阈值={threshold_used_default}",
        )

        # ── 阶段 1：后台压缩已完成，立即应用 ──
        if self._bg_compact_state.is_completed:
            compact_result = self._bg_compact_state.get_result()
            if compact_result is not None:
                logger.info(
                    f"后台压缩已完成 (耗时 {self._bg_compact_state.elapsed_seconds:.1f}s)，应用结果"
                )
                if await self._apply_background_compact(compact_result):
                    return True
                logger.warning("后台压缩结果未应用，继续执行阈值判断")
            else:
                logger.warning("后台压缩结果为空或异常，重置状态")
                self._bg_compact_state.mark_failed()
                self._bg_compact_state.reset()
                background_failed_this_snapshot = True

        # ── 阶段 2：到达硬阈值 ──
        if token_count > compaction_threshold_tokens or message_count > message_threshold:
            if self._has_pending_compact_request():
                logger.info("已存在待处理的 compact 请求，跳过重复注入")
                self._log_compaction_event(
                    "skip",
                    "跳过压缩：已有待处理压缩请求，"
                    f"当前Token={token_count}，压缩阈值={compaction_threshold_tokens}，"
                    f"当前消息数={message_count}，消息阈值={message_threshold}",
                )
                return False

            if self._bg_compact_state.is_running:
                logger.info(
                    f"到达硬阈值 (tokens={token_count}/{compaction_threshold_tokens})，"
                    f"等待后台压缩完成 (已运行 {self._bg_compact_state.elapsed_seconds:.1f}s)"
                )
                compact_result = await self._wait_for_background_compact()
                if compact_result is not None:
                    if await self._apply_background_compact(compact_result):
                        return True
                    logger.warning("后台压缩结果未应用，回退到前台压缩")
                else:
                    logger.warning("后台压缩等待超时/失败，回退到前台压缩")
                self._bg_compact_state.reset()

            logger.info(
                "触发上下文压缩: "
                f"Token={token_count}/{compaction_threshold_tokens}, "
                f"消息数={message_count}/{message_threshold}, "
                f"阈值模型={threshold_model_for_log}, "
                f"最大上下文Token={threshold_max_context_tokens}, "
                f"使用默认阈值={threshold_used_default}"
            )
            self._log_compaction_event(
                "trigger",
                "触发压缩：触发方式=阈值，"
                f"当前Token={token_count}，压缩阈值={compaction_threshold_tokens}，"
                f"当前消息数={message_count}，消息阈值={message_threshold}，"
                f"阈值模型={threshold_model_for_log}，"
                f"最大上下文Token={threshold_max_context_tokens}，"
                f"使用默认阈值={threshold_used_default}",
            )

            # 前台阻塞压缩（现有逻辑提取）
            return await self._trigger_foreground_compact(token_count, compaction_threshold_tokens, message_count)

        # ── 阶段 3：到达预压缩阈值，fork 后台压缩 ──
        if (
            token_count > early_threshold
            and self._bg_compact_state.is_idle
            and not background_failed_this_snapshot
            and not self._bg_compact_state.is_failed_snapshot(
                len(self.chat_history.messages),
                build_messages_digest(self.chat_history.messages),
            )
        ):
            logger.info(
                f"到达预压缩阈值 (tokens={token_count}/{early_threshold})，启动后台压缩"
            )
            await self._start_background_compact()
            self._log_compaction_event(
                "background_start",
                "启动后台预压缩："
                f"当前Token={token_count}，预压缩阈值={early_threshold}，"
                f"硬阈值={compaction_threshold_tokens}，阈值模型={threshold_model_for_log}",
            )
            return False

        self._log_compaction_event(
            "skip",
            "跳过压缩：未达到阈值，"
            f"当前Token={token_count}，压缩阈值={compaction_threshold_tokens}，"
            f"当前消息数={message_count}，消息阈值={message_threshold}，"
            f"阈值模型={threshold_model_for_log}",
        )
        return False

    async def _trigger_foreground_compact(
        self, token_count: int, compaction_threshold_tokens: int, message_count: int,
    ) -> bool:
        """前台阻塞压缩（现有逻辑提取，保持行为不变）"""
        if self._has_pending_compact_request():
            logger.info("已存在待处理的 compact 请求，跳过重复注入")
            return False

        logger.info(
            f"前台压缩触发: tokens={token_count}/{compaction_threshold_tokens}, "
            f"messages={message_count}/{self.compaction_config.max_conversation_rounds}"
        )
        self._log_compaction_event(
            "foreground_trigger",
            "触发前台压缩："
            f"当前Token={token_count}，压缩阈值={compaction_threshold_tokens}，"
            f"当前消息数={message_count}，消息阈值={self.compaction_config.max_conversation_rounds}",
        )
        compact_request = self._build_compact_request()
        compact_message = UserMessage(
            content=compact_request,
            show_in_ui=False,
            source="compact_request",
        )
        await self.chat_history.add_message(compact_message)
        return True

    def _has_pending_compact_request(self) -> bool:
        """判断是否已有 compact 请求被注入但尚未结束。"""
        return self._compact_request_tracker.has_pending_request

    def _begin_compact_request(self, reason: str) -> None:
        """开始一轮主 Agent 直接注入的 compact 请求。

        这里必须同时做两件事：

        1. 调用 `_activate_compact_model()`，让下一次 LLM 调用优先使用 compact 模型。
        2. 标记 compact 请求 pending，阻止后续阈值检查重复注入 compact 请求。

        不能把这两件事散落在调用方里。否则未来新增任意一个入口时，容易只切了模型
        但没标记 pending，或只标记 pending 但没切模型。

        ```text
        Mock：正常触发硬阈值

        当前默认配置下，main model 和 compact model 都是 deepseek-v4-flash。
        所以这个 Mock 里模型名看起来没有变化，但语义上仍然进入了 compact
        model 通道：model_context 会记录「当前 LLM 调用属于 compact 请求」。
        未来如果通过 COMPACT_MODEL_ID 单独指定其它模型，这里无需改状态管理代码。

        before:
          model = deepseek-v4-flash
          tracker.state = NO_REQUEST
          chat_history = [...old messages...]

        _build_compact_request()
          -> _begin_compact_request()
          -> _activate_compact_model()
          -> tracker.start()

        after:
          model = deepseek-v4-flash
          tracker.state = COMPACT_MODEL
          chat_history 即将追加隐藏 user 消息：
            "You must call compact_chat_history immediately."
        ```
        """
        self._activate_compact_model()
        self._compact_request_tracker.start(reason=reason)
        self._log_compaction_event(
            "compact_request_started",
            "压缩请求已开始："
            f"原因={reason}，"
            f"状态={self._compact_request_tracker.state.value}，"
            f"generation={self._compact_request_tracker.generation}",
        )

    def _fallback_compact_request_to_main_model(self, reason: str) -> None:
        """compact 模型失败后，改由主模型继续处理同一条 compact 请求。

        这个状态最容易误清理：

        ```text
        before:
          tracker.state = COMPACT_MODEL
          model = deepseek-v4-flash
          chat_history 最后一条 = compact 请求

        compact 模型请求失败：
          -> 先把 tracker.state 改成 MAIN_MODEL_FALLBACK
          -> 再恢复主模型 deepseek-v4-flash

        after:
          tracker.has_pending_request = True
            因为 compact 请求还在 chat_history 里，不能重复注入第二条。
          tracker.should_keep_compact_model = False
            因为后续重试已经改由主模型处理。
        ```

        也就是说，fallback 不是 finish。finish 必须等这次主模型重试结束后再做。
        """
        self._compact_request_tracker.fallback_to_main_model(reason=reason)
        self._log_compaction_event(
            "compact_request_main_model_fallback",
            "压缩请求已回退到主模型："
            f"原因={reason}，"
            f"状态={self._compact_request_tracker.state.value}，"
            f"generation={self._compact_request_tracker.generation}",
        )

    def _finish_compact_request(self, reason: str, *, restore_model: bool = True) -> None:
        """结束当前 compact 请求，必要时恢复 compact 前模型。

        统一出口覆盖所有终态：

        ```text
        compact_chat_history 返回有效 summary
          -> _execute_history_compact(...).finally
          -> finish + restore model

        compact_chat_history 返回空 summary
          -> finish + restore model

        compact 模型失败，主模型 fallback 重试结束
          -> finish only
          -> restore_model=False，因为 fallback 前已经恢复过主模型

        Agent 结束兜底发现模型或请求还没清干净
          -> finish + restore model
        ```

        维护规则：
        - 除了「fallback 主模型重试期间」之外，不要直接手动清 tracker。
        - 如果这个方法被重复调用，它也应该安全；tracker.finish() 是幂等的。
        - `restore_model=False` 只用于「已经恢复主模型，但同一条 compact 请求刚处理完」的路径。
        """
        had_pending_request = self._compact_request_tracker.has_pending_request
        generation = self._compact_request_tracker.generation
        state = self._compact_request_tracker.state.value
        self._compact_request_tracker.finish()

        if restore_model:
            self._restore_pre_compact_model(reason=reason)

        if had_pending_request:
            self._log_compaction_event(
                "compact_request_finished",
                "压缩请求已结束："
                f"原因={reason}，"
                f"结束前状态={state}，"
                f"generation={generation or '无'}，"
                f"是否尝试恢复模型={restore_model}",
            )

    async def _try_compact_chat_history_force(self, reason: str = "手动或被动压缩") -> bool:
        """强制触发上下文压缩（不检查阈值），用于 reactive compact 场景。

        优先复用后台压缩结果（已完成则直接应用，运行中则等待），
        仅在后台不可用时回退到前台注入。

        Returns:
            bool: True 表示压缩已应用或请求已注入，False 表示消息太少无法压缩
        """
        # 后台压缩已完成 → 直接应用（比重新走前台快）
        if self._bg_compact_state.is_completed:
            compact_result = self._bg_compact_state.get_result()
            if compact_result is not None:
                if await self._apply_background_compact(compact_result):
                    return True
                logger.warning("Force compact: 后台压缩结果未应用，回退到前台注入")
            else:
                self._bg_compact_state.mark_failed()
            self._bg_compact_state.reset()

        # 后台压缩运行中 → 等待完成（后台进度不应浪费）
        if self._bg_compact_state.is_running:
            logger.info(
                f"Force compact: 后台压缩运行中 "
                f"(已运行 {self._bg_compact_state.elapsed_seconds:.1f}s)，等待完成"
            )
            compact_result = await self._wait_for_background_compact()
            if compact_result is not None:
                if await self._apply_background_compact(compact_result):
                    return True
                logger.warning("Force compact: 后台压缩结果未应用，回退到前台注入")
            # 超时仍未完成 → 取消后台，走前台注入
            self._bg_compact_state.reset()

        message_count = len(self.chat_history.messages)
        if message_count < 4:
            logger.warning(f"消息数过少 ({message_count})，无法执行被动压缩")
            self._log_compaction_event(
                "skip",
                f"跳过强制压缩：消息数过少，当前消息数={message_count}",
            )
            return False
        if self._has_pending_compact_request():
            logger.info("已存在待处理的 compact 请求，跳过 reactive compact 重复注入")
            return False

        logger.info(f"强制触发上下文压缩: 消息数={message_count}，原因={reason}")
        self._log_compaction_event(
            "force_trigger",
            f"强制触发压缩：原因={reason}，当前消息数={message_count}",
        )
        compact_request = self._build_compact_request()
        compact_message = UserMessage(
            content=compact_request,
            show_in_ui=False,
            source="compact_request",
        )
        await self.chat_history.add_message(compact_message)
        self._log_compaction_event(
            "request_injected",
            "压缩请求已注入：触发方式=强制，"
            f"原因={reason}，"
            f"压缩Skill字符数={len(self._compact_skill_content or '')}，"
            f"注入后消息数={len(self.chat_history.messages)}",
        )
        return True

    async def _start_background_compact(self) -> None:
        """fork 一个同类型子 Agent 执行后台压缩"""
        compact_model_id = get_compact_model_id()
        if not compact_model_id:
            compact_model_id = self._require_current_text_model_id()

        await start_background_compact(
            state=self._bg_compact_state,
            agent_context=self.agent_context,
            compact_instruction=self._compact_skill_content,
            model_id=compact_model_id,
        )

    async def _wait_for_background_compact(self) -> CompactResult | None:
        """等待后台压缩完成（带超时），返回摘要与建议或 None。"""
        task = self._bg_compact_state._task
        if task is None or task.done():
            return self._bg_compact_state.get_result()

        try:
            await asyncio.wait_for(
                asyncio.shield(task),
                timeout=BACKGROUND_COMPACT_WAIT_TIMEOUT,
            )
            return self._bg_compact_state.get_result()
        except asyncio.TimeoutError:
            logger.warning(
                f"后台压缩等待超时 ({BACKGROUND_COMPACT_WAIT_TIMEOUT}s)，"
                f"总耗时 {self._bg_compact_state.elapsed_seconds:.1f}s"
            )
            return None
        except Exception as e:
            logger.warning(f"后台压缩等待异常: {e}")
            return None

    def _build_compacted_summary_message(self, summary: str) -> str:
        return f"""\
<summary>
{summary}
</summary>

---
You were interrupted by context compaction. The above contains a summary of your previous thinking and work. Resume in this order:
1. Read the files listed in the key files section as needed for the next action — do not reread every file by default
2. Review external references and reference files as needed for background context
3. Follow the task status and next action in the summary: continue only if the task is incomplete; if it is complete, do not invent follow-up work
Since your subsequent output will be merged with pre-interruption content and displayed together in the frontend, maintain conversational continuity."""

    async def _apply_background_compact(self, result: CompactResult) -> bool:
        """应用后台压缩结果，保留快照后新增的消息。

        后台压缩只处理启动时的历史前缀，不处理它运行期间产生的新消息：

            [快照前缀 A] + [后台运行期间新增的消息 B]
                    │
                    └─ 压缩 Agent 只总结 A

            应用结果后: [系统提示] + [A 的 summary] + [B]

        在替换前重新计算 A 的 digest。如果 A 已经被别的流程改写，summary 就不再对应
        当前历史，必须丢弃并回退到前台压缩，不能把旧结果写回新上下文。
        """
        blocker_acquired = False
        applied = False
        try:
            snapshot_count = self._bg_compact_state.snapshot_message_count
            snapshot_digest = self._bg_compact_state.snapshot_digest
            current_messages = self.chat_history.messages
            original_count = len(current_messages)
            original_tokens = await self.chat_history.tokens_count()

            if snapshot_count <= 0 or snapshot_count > original_count:
                logger.warning("后台压缩快照数量无效，丢弃结果")
                return False

            current_digest = build_messages_digest(current_messages[:snapshot_count])
            if current_digest != snapshot_digest:
                logger.warning("后台压缩快照前缀已变化，丢弃结果")
                return False

            new_messages = list(current_messages[snapshot_count:])
            compressed_content = self._build_compacted_summary_message(result.summary)
            replacement_messages = [
                SystemMessage(content=self.system_prompt, show_in_ui=False),
                UserMessage(content=compressed_content, show_in_ui=True, source="compact_summary"),
                *new_messages,
            ]

            self.agent_context.increment_cancel_blocker()
            blocker_acquired = True
            await self._backup_before_compact()
            await self.chat_history.replace_messages(replacement_messages)
            applied = True

            compacted_tokens = await self.chat_history.tokens_count()
            logger.info(
                f"后台压缩结果已应用: "
                f"{original_count} msgs/{original_tokens} tokens → "
                f"{len(self.chat_history.messages)} msgs/{compacted_tokens} tokens, "
                f"catch_up={len(new_messages)} msgs"
            )

            await self.agent_context.horizon.on_context_reset()
            await self._rehydrate_media_models_after_context_reset()
            # 后台压缩替换了旧窗口中的通知，按当前状态重新提供记忆模式和准确路径。
            self.agent_context.horizon.push_notification("memory", build_memory_runtime_context(self.agent_context))
            self._push_web_search_runtime_context()
            await self.agent_context.horizon.suggest_skills(
                result.skill_suggestions,
                source="context_compaction",
            )
            return True

        except Exception as e:
            logger.error(f"应用后台压缩结果失败: {e}", exc_info=True)
            if not applied:
                self._bg_compact_state.mark_failed()
            return applied
        finally:
            if blocker_acquired:
                self.agent_context.decrement_cancel_blocker()
            self._bg_compact_state.reset()

    def _activate_compact_model(self) -> None:
        """切换到 compact 专属模型（如果配置了的话），并保存压缩前的模型状态

        若已存在临时 compact 模型，说明上次压缩请求 LLM 未响应工具调用，
        模型已处于 compact 状态，跳过重复切换以避免覆盖原始模型记录。
        还原操作由 _restore_pre_compact_model 负责。
        """
        compact_model = get_compact_model_id()
        model_context = self.agent_context.model_context
        if compact_model:
            if model_context.has_active_compact_text_model():
                # 上次压缩请求尚未完成（LLM 未调用 compact_chat_history 工具），不重复切换
                logger.info(f"执行压缩，compact 专属模型已处于激活状态: {compact_model}")
                self._log_compaction_event(
                    "compact_model_reuse",
                    f"复用压缩模型：压缩模型={compact_model}",
                )
            else:
                self._pre_compact_model_id = self._require_current_text_model_id()
                model_context.activate_compact_text_model(compact_model)
                logger.info(f"执行压缩，使用 compact 专属模型: {compact_model}")
                self._log_compaction_event(
                    "compact_model_activated",
                    f"已切换到压缩模型：压缩前运行时模型={self._pre_compact_model_id or '无'}，"
                    f"压缩模型={compact_model}",
                )
        else:
            current_model_id = self._require_current_text_model_id()
            logger.info(f"执行压缩，使用主 Agent 当前模型: {current_model_id}")
            self._log_compaction_event(
                "compact_model_not_configured",
                f"未配置压缩专属模型，使用当前模型执行压缩：当前模型={current_model_id}",
            )

    def _restore_pre_compact_model(self, reason: str = "压缩完成") -> None:
        """还原 compact 前保存的模型状态

        若不存在临时 compact 模型，说明未切换过模型，直接跳过。

        Args:
            reason: 还原原因，用于日志说明
        """
        model_context = self.agent_context.model_context
        if not model_context.has_active_compact_text_model():
            return
        pre_compact_model_id = getattr(self, "_pre_compact_model_id", None)
        restored = model_context.restore_pre_compact_text_model()
        current_model_id = (
            pre_compact_model_id
            if isinstance(pre_compact_model_id, str) and pre_compact_model_id
            else self._require_current_text_model_id()
        )
        if hasattr(self, "_pre_compact_model_id"):
            del self._pre_compact_model_id
        if restored:
            logger.info(f"{reason}，已恢复压缩前文本模型: {current_model_id}")
        else:
            logger.info(f"{reason}，未检测到需要恢复的 compact 文本模型")
        self._log_compaction_event(
            "model_restored",
            f"压缩模型状态已恢复：原因={reason}，恢复后的运行时模型={current_model_id or '无'}",
        )

    def _restore_stale_compact_model_before_loop(self) -> None:
        """新一轮 LLM 调用前，恢复不再被 compact 请求占用的临时模型。

        这个方法只在 Agent 主循环每次 LLM 调用前执行。它处理的是「上一轮 LLM
        没有按要求调用 compact_chat_history」这类脏状态。

        ```text
        A. 正常等待 compact 模型处理
           active compact model = True
           tracker.state = COMPACT_MODEL
           -> 保留 compact 模型，继续等 LLM 处理那条 compact 请求。

        B. LLM 已经偏离 compact 请求，compact 模型还挂着
           active compact model = True
           tracker.state = NO_REQUEST 或 MAIN_MODEL_FALLBACK
           -> 结束请求并恢复模型，避免下一轮普通对话继续使用 compact 模型。

        C. 没有配置 compact 专属模型
           active compact model = False
           tracker.state = COMPACT_MODEL
           -> 不在这里清理。此时 compact 请求会由主模型处理，pending 仍然用于防重复注入。
        ```
        """
        model_context = self.agent_context.model_context
        if not model_context.has_active_compact_text_model():
            return
        if self._compact_request_tracker.should_keep_compact_model:
            logger.debug("检测到 compact 请求仍由 compact 模型处理，保留 compact 临时模型")
            return
        self._finish_compact_request(reason="LLM 未继续处理压缩请求，新一轮调用前还原")

    def _build_compact_request(self, user_instruction: str = "") -> str:
        """构建压缩请求内容，同时切换到 compact 专属模型（如果配置了的话）

        Args:
            user_instruction: 用户在 /compact 命令后附带的额外要求（可选）

        切换后的模型和请求状态必须通过 compact request 生命周期统一管理，
        不能由调用方分别手动 mark/clear。
        """
        self._begin_compact_request(reason="构建 compact 请求")

        # 被动触发：直接注入 SKILL.md 内容，无需 Agent 额外调用 read_skills
        reference_block = format_user_input_reference_block(self.chat_history.messages)
        prompt = (
            "The conversation is too long and must be compacted now. "
            "You must call the `compact_chat_history` tool immediately.\n\n"
            f"{reference_block}\n\n"
            f"{self._compact_skill_content}"
        )

        if user_instruction:
            prompt += f"\n\n## Additional User Instruction for This Compaction\n\n{user_instruction}"

        return prompt

    # 供应商限流/过载的状态码
    _PROVIDER_RATE_LIMIT_STATUS_CODES = {429, 529}

    # 确定性错误状态码：这些错误与请求内容或配置相关，换非流式/等待/重试都不会改变结果，
    # 唯一的出路是修复配置或聊天记录，继续重试只是浪费预算和用户时间。
    #
    # 各状态码含义：
    #   400 = 请求格式/消息序列错误（如 assistant 后面少了 tool_result）
    #         ⚠️ 特例：上下文超长也是 400，但已被 _find_context_window_error 在此之前拦截并
    #         走 compact 路径，所以走到这里的 400 必然是不可恢复的消息序列/格式问题。
    #   401 = 未授权（API Key 无效）
    #   403 = 禁止访问（权限不足）
    #   404 = 模型不存在（模型 ID 配置错误，或该账号无访问权限）
    #   405 = 方法不允许
    _NON_RETRYABLE_STATUS_CODES = {400, 401, 403, 404, 405}

    # 兼容各家不同的 finish_reason 值（"输出被截断"）
    _OUTPUT_TRUNCATED_FINISH_REASONS = {"length", "max_tokens"}

    _GENERATION_SPLIT_RECOVERY_PROMPT = (
        "A substantial model response was lost after repeated generation failures. "
        "That response is unavailable in the current context."
    )

    def _extract_chunk_count(self, exception: Exception) -> int:
        """从异常链中提取已收到的 chunk 数量（仅用于日志）"""
        for exc in self._iter_exception_chain(exception):
            if isinstance(exc, (StreamInterruptedError, StreamChunkTimeoutError)):
                return exc.chunk_count
        return 0

    def _extract_emitted_text_chars(self, exception: Exception) -> int:
        """从异常链提取流式失败前已经输出的 reasoning 和 content 字符数。"""
        for exc in self._iter_exception_chain(exception):
            if isinstance(exc, (StreamInterruptedError, StreamChunkTimeoutError)):
                return exc.emitted_text_chars
        return 0

    def _record_generation_failure(self, loop_state: AgentLoopState, exception: Exception) -> bool:
        """记录一次可能丢失生成内容的失败，并判断是否达到拆分提示门槛。"""
        retry_state = loop_state.retry_state
        retry_state.consecutive_generation_failures += 1
        retry_state.max_lost_output_chars_in_streak = max(
            retry_state.max_lost_output_chars_in_streak,
            self._extract_emitted_text_chars(exception),
        )
        return (
            retry_state.consecutive_generation_failures >= 2
            and retry_state.max_lost_output_chars_in_streak >= 5000
            and not retry_state.split_recovery_hint_injected
        )

    @staticmethod
    def _reset_generation_failure_streak(loop_state: AgentLoopState) -> None:
        retry_state = loop_state.retry_state
        retry_state.consecutive_generation_failures = 0
        retry_state.max_lost_output_chars_in_streak = 0

    def _extract_api_status_code(self, exception: Exception) -> Optional[int]:
        """从异常链中提取 HTTP 状态码。"""
        from openai import APIStatusError

        for exc in self._iter_exception_chain(exception):
            if isinstance(exc, APIStatusError):
                return exc.status_code
        return None

    async def _dispatch_before_llm_retry_event(
        self,
        *,
        exception: Exception,
        loop_state: AgentLoopState,
        use_stream: bool,
    ) -> BeforeLlmRetryEventData:
        """请求失败后、进入重试决策前抛出重试前事件。"""
        model_id = ""
        supports_multimodal = False
        try:
            model_state = self.agent_context.model_context.resolve_text_model()
            model_id = model_state.model_id
            supports_multimodal = bool(model_state.config.supports_multimodal)
        except Exception:
            model_id = self.agent_context.model_context.current_text_model_id or ""

        event_data = BeforeLlmRetryEventData(
            agent_context=self.agent_context,
            exception=exception,
            status_code=self._extract_api_status_code(exception),
            model_id=model_id,
            use_stream=use_stream,
            backoff_retry_count=loop_state.retry_state.backoff_retry_count,
            streaming_disabled=loop_state.retry_state.streaming_disabled,
            request_contains_native_images=bool(
                getattr(self, "_last_llm_request_contains_native_images", False)
            ),
            supports_multimodal=supports_multimodal,
            is_context_window_exceeded=bool(self._find_context_window_error(exception)),
        )
        event = await self.agent_context.dispatch_event(EventType.BEFORE_LLM_RETRY, event_data)
        return event.data

    async def _dispatch_llm_request_succeeded_event(self, *, use_stream: bool) -> None:
        """请求成功后抛出成功事件，供监听器清理失败计数。"""
        await self.agent_context.dispatch_event(
            EventType.AFTER_LLM_REQUEST_SUCCEEDED,
            AfterLlmRequestSucceededEventData(
                agent_context=self.agent_context,
                model_id=self.agent_context.model_context.current_text_model_id or "",
                use_stream=use_stream,
            ),
        )

    def _find_context_window_error(self, exception: Exception) -> Optional[LLMErrorSnapshot]:
        """在异常链中查找上下文超长错误，返回对应的 snapshot 或 None"""
        from openai import APIError
        for exc in self._iter_exception_chain(exception):
            if isinstance(exc, APIError):
                snapshot = LLMErrorClassifier.extract_snapshot(exc)
                if snapshot and LLMErrorClassifier.is_context_window_exceeded(snapshot):
                    return snapshot
        return None

    async def _try_fallback_compact_model_once(
        self,
        exception: Exception,
        *,
        non_stream_timeout: Optional[int] = None,
    ) -> Optional[LLMResponseContext]:
        """compact 临时模型失败时，恢复压缩前模型并非流式重试一次。"""
        model_context = self.agent_context.model_context
        if not model_context.consume_compact_text_model_fallback():
            return None

        failed_model_id = self._require_current_text_model_id()
        logger.warning(
            f"compact 临时模型请求失败，回退压缩前模型重试一次: "
            f"failed_model={failed_model_id}, error={exception!r}"
        )
        self._fallback_compact_request_to_main_model(reason="compact 临时模型请求失败")
        self._restore_pre_compact_model(reason="compact 临时模型请求失败，回退当前模型重试")

        retry_model_id = self._require_current_text_model_id()
        logger.info(f"compact fallback 使用文本模型重试: {retry_model_id}")
        try:
            return await self._prepare_and_call_llm(
                use_stream=False,
                non_stream_timeout=non_stream_timeout or config.get("llm.non_stream_timeout_seconds", 600),
            )
        finally:
            self._finish_compact_request(reason="compact fallback 重试结束", restore_model=False)

    def _log_agent_loop_exception(self, exception: Exception) -> None:
        """记录 agent loop 异常，已分类的模型配置错误不打印完整堆栈。"""
        if is_non_retryable_model_config_error(exception):
            logger.warning(f"Agent循环遇到模型配置错误，进入终态处理: {exception}")
            return

        logger.error(f"Agent循环执行过程中发生错误: {exception!r}")
        logger.error(f"错误堆栈: {traceback.format_exc()}")

    async def _interruptible_sleep(self, seconds: float) -> None:
        """可中断的等待，监听 interruption_event 以快速响应用户取消"""
        interrupt_event = self.agent_context.get_interruption_event()
        sleep_task = asyncio.ensure_future(asyncio.sleep(seconds))
        interrupt_task = asyncio.ensure_future(interrupt_event.wait())
        done, pending = await asyncio.wait(
            [sleep_task, interrupt_task], return_when=asyncio.FIRST_COMPLETED
        )
        for t in pending:
            t.cancel()
        if interrupt_task in done:
            raise asyncio.CancelledError()

    async def _call_llm_with_retry(self, loop_state: AgentLoopState) -> LLMResponseContext:
        """两阶梯重试：先流式快速失败，再非流式退避重试

        第一阶梯：流式请求，首包 60s + chunk 间隔 60s 的短超时快速检测。
        部分供应商流式实现存在 bug，且缓存亲和性导致同一请求反复命中同一个
        有问题的节点，流式重试无意义，首次失败即降级非流式。

        第二阶梯：非流式退避重试，600s 超时，指数退避 + jitter。
        降级到非流式可绕过供应商流式 bug，以成功率为最高优先级。

        retry_state 的生命周期覆盖整个 run（非单次请求）：
        - streaming_disabled 一旦设置，整个 run 内不再尝试流式（临时性流式故障
          在下一轮 run 自然恢复）
        - backoff_retry_count 跨请求累积，避免持续失败时消耗过多预算
        - 仅在 agent 从 ERROR 状态成功恢复时重置（见 agent loop checkpoint）
        """
        from openai import APIStatusError
        from agentlang.utils.retry import extract_retry_delay_from_error

        # 第一阶梯：流式尝试（仅在未降级时）
        if not loop_state.retry_state.streaming_disabled:
            try:
                response = await self._prepare_and_call_llm(
                    use_stream=True,
                    first_chunk_timeout=config.get("llm.stream_first_chunk_timeout_seconds", 60),
                    chunk_timeout=config.get("llm.stream_chunk_timeout_seconds", 60),
                )
                self._reset_generation_failure_streak(loop_state)
                await self._dispatch_llm_request_succeeded_event(use_stream=True)
                return response
            except ResourceLimitExceededException:
                raise  # 平台业务限制（积分/并发），直接终止
            except Exception as e:
                compact_fallback = await self._try_fallback_compact_model_once(e)
                if compact_fallback is not None:
                    self._reset_generation_failure_streak(loop_state)
                    await self._dispatch_llm_request_succeeded_event(use_stream=False)
                    return compact_fallback
                if self._find_context_window_error(e):
                    raise  # 上下文超长走 compact 路径
                retry_decision = await self._dispatch_before_llm_retry_event(
                    exception=e,
                    loop_state=loop_state,
                    use_stream=True,
                )
                if retry_decision.allow_retry:
                    if retry_decision.disable_streaming:
                        loop_state.retry_state.streaming_disabled = True
                    logger.warning(
                        f"流式请求失败，监听器要求重试: reason={retry_decision.reason}, error={e}"
                    )
                elif is_non_retryable_model_config_error(e):
                    logger.warning(f"流式请求遇到模型配置错误，不降级不重试，直接抛出: {e}")
                    raise
                # 确定性错误：不降级非流式，也不重试。
                # 这类错误换成非流式请求同样会失败（模型不存在、API Key 无效、消息序列损坏等），
                # 必须先检查此条件再走降级分支，否则会白白浪费一轮非流式请求。
                # 注意：上下文超长（同样是 400）已在前面被 _find_context_window_error 拦截并 raise，
                # 走到这里的 400 一定是消息序列/格式问题，无法通过重试自愈。
                elif (
                    isinstance(e, APIStatusError)
                    and e.status_code in self._NON_RETRYABLE_STATUS_CODES
                ):
                    logger.warning(
                        f"流式请求遇到确定性错误 HTTP {e.status_code}，不降级不重试，直接抛出: {e}"
                    )
                    raise
                elif isinstance(e, APIStatusError) and e.status_code in self._PROVIDER_RATE_LIMIT_STATUS_CODES:
                    # 供应商限流/过载，等待后降级到非流式。
                    # 不计入 backoff_retry_count — 流式阶段的 429 等待仅用于降级过渡，
                    # 进入第二阶梯后应拥有完整的重试预算。
                    retry_delay = extract_retry_delay_from_error(str(e)) or 30
                    logger.warning(f"供应商 {e.status_code}（流式阶段），等待 {retry_delay}s 后降级非流式")
                    await self._interruptible_sleep(retry_delay)
                    loop_state.retry_state.streaming_disabled = True
                else:
                    # 流式失败 → 降级非流式
                    loop_state.retry_state.streaming_disabled = True
                    received_chunks = self._extract_chunk_count(e)
                    should_inject_split_hint = self._record_generation_failure(loop_state, e)
                    if should_inject_split_hint:
                        injected = await self._try_inject_output_recovery_message(
                            loop_state,
                            self._GENERATION_SPLIT_RECOVERY_PROMPT,
                            source="generation_split_recovery",
                        )
                        if injected:
                            loop_state.retry_state.split_recovery_hint_injected = True
                    logger.warning(f"流式请求失败（chunks={received_chunks}），降级非流式: {e}")
                # 落入第二阶梯

        # 第二阶梯：非流式退避重试
        max_retries = config.get("llm.backoff_max_retries", 5)
        timeout = config.get("llm.non_stream_timeout_seconds", 600)

        while True:
            try:
                response = await self._prepare_and_call_llm(
                    use_stream=False,
                    non_stream_timeout=timeout,
                )
                self._reset_generation_failure_streak(loop_state)
                await self._dispatch_llm_request_succeeded_event(use_stream=False)
                return response
            except ResourceLimitExceededException:
                raise  # 平台业务限制，直接终止
            except Exception as e:
                compact_fallback = await self._try_fallback_compact_model_once(
                    e,
                    non_stream_timeout=timeout,
                )
                if compact_fallback is not None:
                    self._reset_generation_failure_streak(loop_state)
                    await self._dispatch_llm_request_succeeded_event(use_stream=False)
                    return compact_fallback
                if self._find_context_window_error(e):
                    if not loop_state.reactive_compact_attempted:
                        loop_state.reactive_compact_attempted = True
                        if await self._try_compact_chat_history_force(reason="上下文超窗退避重试"):
                            # compact 后 messages 已变，重置退避计数
                            loop_state.retry_state.backoff_retry_count = 0
                            continue
                    raise

                retry_decision = await self._dispatch_before_llm_retry_event(
                    exception=e,
                    loop_state=loop_state,
                    use_stream=False,
                )
                if retry_decision.allow_retry and retry_decision.skip_backoff:
                    continue

                # 确定性错误：重试必然失败，直接抛出由上层走终态逻辑。
                # 400 消息序列损坏时，每次重试还会额外注入 recovery user 消息，
                # 反而让序列更乱，形成死亡螺旋，必须在退避重试逻辑之前先拦截。
                if not retry_decision.allow_retry:
                    if is_non_retryable_model_config_error(e):
                        logger.warning(f"非流式请求遇到模型配置错误，不重试，直接抛出: {e}")
                        raise
                    if isinstance(e, APIStatusError) and e.status_code in self._NON_RETRYABLE_STATUS_CODES:
                        raise

                # 供应商 429/529：等待后重试，不注入恢复提示词，纳入重试计数
                if isinstance(e, APIStatusError) and e.status_code in self._PROVIDER_RATE_LIMIT_STATUS_CODES:
                    retry_delay = extract_retry_delay_from_error(str(e)) or 30
                    loop_state.retry_state.backoff_retry_count += 1
                    if loop_state.retry_state.backoff_retry_count >= max_retries:
                        raise
                    logger.warning(f"供应商 {e.status_code}，等待 {retry_delay}s 后重试")
                    await self._interruptible_sleep(retry_delay)
                    continue

                loop_state.retry_state.backoff_retry_count += 1
                if loop_state.retry_state.backoff_retry_count >= max_retries:
                    raise  # 重试预算耗尽

                should_inject_split_hint = self._record_generation_failure(loop_state, e)
                if should_inject_split_hint:
                    injected = await self._try_inject_output_recovery_message(
                        loop_state,
                        self._GENERATION_SPLIT_RECOVERY_PROMPT,
                        source="generation_split_recovery",
                    )
                    if injected:
                        loop_state.retry_state.split_recovery_hint_injected = True

                # 指数退避 + jitter（base=10s, max=60s）
                base_wait = min(10 * (2 ** (loop_state.retry_state.backoff_retry_count - 1)), 60)
                wait_time = base_wait * (0.5 + random.random())  # jitter: 50%~150%
                wait_time = min(wait_time, 60.0)  # cap at 60s
                loop_state.retry_state.total_backoff_wait_time += wait_time

                logger.warning(
                    f"非流式请求失败，退避重试 "
                    f"(retry={loop_state.retry_state.backoff_retry_count}/{max_retries}, "
                    f"wait={wait_time:.1f}s): {e}"
                )
                await self._interruptible_sleep(wait_time)

    async def _push_native_visual_horizon_notifications(
        self,
        render_result: LLMMessageRenderResult,
    ) -> bool:
        """把本轮新增的原生视觉状态登记到 Horizon，并避免重复提示。"""
        notification_pushed = False
        context_signature = render_result.native_image_paths or None
        if (
            context_signature is not None
            and context_signature != self._native_visual_horizon_context_signature
        ):
            native_visual_hint = await self._native_visual_message_builder.build_horizon_hint(
                list(context_signature)
            )
            self.agent_context.horizon.push_notification(
                "native_visual_context",
                native_visual_hint,
            )
            self._native_visual_horizon_context_signature = context_signature
            notification_pushed = True

        if (
            render_result.horizon_hint is not None
            and render_result.horizon_hint != self._native_visual_horizon_render_hint
        ):
            self.agent_context.horizon.push_notification(
                "native_visual_render",
                render_result.horizon_hint,
            )
            self._native_visual_horizon_render_hint = render_result.horizon_hint
            notification_pushed = True

        return notification_pushed

    async def _prepare_and_call_llm(
        self,
        use_stream: bool = True,
        first_chunk_timeout: Optional[int] = None,
        chunk_timeout: Optional[int] = None,
        non_stream_timeout: Optional[int] = None,
    ) -> LLMResponseContext:
        """
        准备与LLM的对话，处理消息，调用LLM并解析响应

        Args:
            use_stream: 是否使用流式模式
            first_chunk_timeout: 流式首包超时（秒）
            chunk_timeout: 流式 chunk 间隔超时（秒）
            non_stream_timeout: 非流式请求超时（秒）

        Returns:
            LLMResponseContext: 包含LLM响应的所有相关数据
        """
        self._last_model_call_failure = None
        # 压缩判断必须使用压缩前的业务模型；若触发压缩，后续会切换到 compact 专属模型。
        threshold_model_id = self._require_current_text_model_id()
        await self._try_compact_chat_history(threshold_model_id=threshold_model_id)

        # 压缩会清空文件跟踪；preload 仍在 system prompt，沿原登记和通知入口恢复。
        await self._ensure_preloaded_files_tracked()
        # 先处理已读文件的变化，再决定 AutoRead；完整 diff 已交付时无需重复全文。
        if self.chat_history._is_tool_call_sequence_complete():
            preload_context = await self._build_horizon_context_update_safely(
                injection_point=HorizonInjectionPoint.BEFORE_LLM_PRELOADED_SKILLS,
                log_context="AutoRead 前刷新文件版本",
            )
            if preload_context:
                await self.chat_history.append_user_message(preload_context, show_in_ui=False, source="horizon")

        # 自动规则文件统一在真实模型调用前发现和读取；压缩或 /new 后会根据当前 ChatHistory 自动重建交付状态。
        await AutoReadFileService.prepare_before_llm(
            self.agent_context,
            self.chat_history,
            workspace_entries=(
                self._workspace_snapshot.entries
                if self._workspace_snapshot is not None
                else None
            ),
        )

        # 压缩可能切换到专属模型，调用前重新解析一次当前文本模型。
        text_model_state = self._resolve_current_text_model()

        # 历史加当前合计超过上限时，先关掉历史原生视觉消息，再基于快照渲染请求。
        await self.chat_history.disable_historical_native_visual_if_over_limit(
            self._message_renderer.max_history_image_refs,
        )
        message_snapshot = self.chat_history.get_message_snapshot()
        render_result = await self._message_renderer.render_messages_with_horizon_hint(
            message_snapshot,
            supports_multimodal=text_model_state.config.supports_multimodal,
        )
        rendered_messages = render_result.messages
        has_native_visual_notification = await self._push_native_visual_horizon_notifications(
            render_result
        )
        if has_native_visual_notification:
            native_visual_context = await self._build_horizon_context_update_safely(
                injection_point=HorizonInjectionPoint.BEFORE_LLM_NATIVE_VISUAL,
                log_context="原生视觉请求前注入",
            )
            if native_visual_context:
                await self.chat_history.append_user_message(
                    native_visual_context,
                    show_in_ui=False,
                    source="horizon",
                )
                rendered_messages.append(
                    {"role": "user", "content": native_visual_context}
                )
        messages_for_llm = self.chat_history.normalize_messages_for_llm(rendered_messages)
        image_ref_count = sum(
            1
            for message in message_snapshot
            if isinstance(message, UserMessage)
            for part in (message.content_parts or [])
            if part.type == "image_ref"
        )
        native_image_count = sum(
            1
            for message in messages_for_llm
            if isinstance(message, dict) and isinstance(message.get("content"), list)
            for part in message["content"]
            if part.get("type") == "image_url"
        )
        self._last_llm_request_contains_native_images = native_image_count > 0
        logger.info(
            "LLM 请求多模态渲染状态: "
            f"model_id={text_model_state.display_model_id} "
            f"model_name={text_model_state.model_name} "
            f"supports_multimodal={text_model_state.config.supports_multimodal} "
            f"history_image_ref_count={image_ref_count} "
            f"request_native_image_count={native_image_count}"
        )
        if not messages_for_llm:
            logger.error("无法获取用于LLM调用的消息列表(可能历史记录为空或只有内部消息)")
            self.set_agent_state(AgentState.ERROR)
            raise ValueError("无法准备与LLM的对话。")

        # _call_llm 的异常全部透传给 _call_llm_with_retry 做分类处理
        llm_start_time = time.time()
        chat_response = await self._call_llm(
            messages_for_llm,
            use_stream=use_stream,
            first_chunk_timeout=first_chunk_timeout,
            chunk_timeout=chunk_timeout,
            non_stream_timeout=non_stream_timeout,
        )
        llm_duration_ms = (time.time() - llm_start_time) * 1000

        # 响应解析阶段：异常包装为 LLMCallRequestException 以区分 provider 异常
        try:
            token_usage = LLMFactory.token_tracker.extract_chat_history_usage_data(chat_response)
            token_usage.model_id = text_model_state.model_id
            token_usage.model_name = text_model_state.model_name
            token_usage.resolved_model_id = text_model_state.resolved_model_id

            # 更新 horizon：运行时 LM 模型 + 当前上下文窗口使用量
            try:
                horizon_model_info = self._build_horizon_llm_model_info(text_model_state)
                current_max_context_tokens = self._resolve_current_max_context_tokens(text_model_state)
                self.agent_context.horizon.update_llm_model(
                    horizon_model_info.model_id,
                    horizon_model_info.model_name,
                    horizon_model_info.description,
                )
                self.agent_context.horizon.update_context_usage(
                    token_usage.total_tokens,
                    current_max_context_tokens,
                )
                # 记录当前采用的上下文上限，供前端实时展示。
                token_usage.max_context_tokens = current_max_context_tokens or None
            except Exception as _horizon_err:
                logger.warning(f"[AgentHorizon] 更新模型/上下文用量失败: {_horizon_err}")

            llm_response_message = chat_response.choices[0].message

            if llm_response_message.content is None or llm_response_message.content.strip() == "":
                if llm_response_message.tool_calls:
                    logger.debug("LLM响应content为空，但包含tool_calls。")
                    if llm_response_message.content is None:
                        llm_response_message.content = ""
                else:
                    logger.warning("LLM响应消息内容为空且无tool_calls，使用默认值'Continue'")
                    try:
                        message_dict = llm_response_message.model_dump()
                        formatted_json = json.dumps(message_dict, ensure_ascii=False, indent=2)
                        logger.warning(f"详细信息:\n{formatted_json}")
                    except Exception as e:
                        logger.warning(f"尝试打印LLM响应消息失败: {e!s}")
                    llm_response_message.content = "Continue"

            openai_tool_calls = self._parse_tool_calls(chat_response)
            logger.debug(f"来自chat_response的OpenAI tool_calls: {openai_tool_calls}")

            from app.utils.tool_call_utils import parse_and_convert_tool_calls
            tool_calls_to_execute = parse_and_convert_tool_calls(openai_tool_calls)

            current_request_id = self.agent_context.get_current_llm_request_id()
            actual_entered_stream_phase = self.agent_context.get_metadata().get("_llm_call_entered_stream_phase", False)

            return LLMResponseContext(
                message=llm_response_message,
                tool_calls=tool_calls_to_execute,
                token_usage=token_usage,
                duration_ms=llm_duration_ms,
                request_id=current_request_id,
                is_streaming=actual_entered_stream_phase,
                finish_reason=chat_response.choices[0].finish_reason if chat_response.choices else None,
            )
        except (ResourceLimitExceededException, asyncio.CancelledError):
            raise
        except Exception as e:
            raise LLMCallRequestException(e) from e

    def _resolve_current_text_model(self) -> TextModelState:
        """解析当前运行时文本模型。"""
        try:
            return self.agent_context.model_context.resolve_text_model()
        except ValueError as exception:
            if is_non_retryable_model_config_error(exception):
                self._last_model_call_failure = ModelCallFailure(
                    exception, self._create_model_error(ModelErrorCode.CONFIG_ERROR),
                )
            raise

    def _resolve_current_max_context_tokens(self, text_model_state: TextModelState) -> int:
        """返回当前用于展示、压缩判断和 Horizon 入参的上下文上限。"""
        from agentlang.chat_history.chat_history_models import (
            resolve_manual_context_window_limits,
            resolve_user_facing_max_context_tokens,
        )

        # Hard 是模型配置允许的物理最大上下文，可能达到 1M；Soft 是 Super Magic 当前
        # 实际采用的产品上下文，默认是 300K，也可以来自用户手动设置、旧型号或成本例外。
        # 例如 Hard=1,048,576 且使用默认 Soft 时，这里返回 300,000，主动压缩阈值为
        # 270,000（300K × 90%），而不是等到接近 1M 时才压缩；自动窗口不超过 Hard。
        # 同一个 current_max_context_tokens 会用于前端、Horizon 和压缩判断，避免三处口径不同。
        model_key = (text_model_state.resolved_model_id or text_model_state.model_id).strip()
        user_manual_max_context_tokens = self.agent_context.horizon.get_user_manual_max_context_tokens(
            model_key=model_key,
        )
        if user_manual_max_context_tokens is not None:
            limits = resolve_manual_context_window_limits(
                max_context_tokens=text_model_state.max_context_tokens,
                max_output_tokens=text_model_state.max_output_tokens,
            )
            if limits.contains(user_manual_max_context_tokens):
                return user_manual_max_context_tokens

        user_facing_max_context_tokens = resolve_user_facing_max_context_tokens(
            text_model_state.model_id,
            resolved_model_id=text_model_state.resolved_model_id,
            model_name=text_model_state.model_name,
            max_context_tokens=text_model_state.max_context_tokens,
        )
        return user_facing_max_context_tokens or text_model_state.max_context_tokens

    def _build_horizon_llm_model_info(
        self,
        text_model_state: Optional[TextModelState] = None,
    ) -> HorizonLlmModelInfo:
        """把当前生效模型标准化为注入给 horizon 的展示态信息。"""
        if text_model_state is None:
            text_model_state = self._resolve_current_text_model()

        display_model_id = text_model_state.display_model_id
        display_model_name = text_model_state.model_name

        # 聚合模型要额外保留选择语义，否则只看到落地模型，看不出背后调度策略。
        special_model_descriptions = {
            "auto": "automatically selects the most efficient AI model for the current task",
            "max": "automatically selects the most capable AI model for the current scenario",
        }
        description = special_model_descriptions.get(text_model_state.model_id.lower(), "")
        return HorizonLlmModelInfo(
            model_id=display_model_id,
            model_name=display_model_name,
            description=description,
        )

    async def _refresh_user_context_after_main_run(self) -> None:
        """完整主 Loop 正常结束后刷新一次；仍持有 run，且尚未关闭资源。"""
        if (
            not self.agent_context.is_main_agent
            or self.agent_state != AgentState.FINISHED
            or self.agent_context.is_interruption_requested()
        ):
            return
        try:
            await UserContextService.refresh(self.agent_context)
            if not self.chat_history._is_tool_call_sequence_complete():
                return
            update = await self._build_horizon_context_update_safely(
                HorizonInjectionPoint.AFTER_MAIN_AGENT_RUN, "主 Loop 结束",
            )
            if update:
                await self.chat_history.append_user_message(update, show_in_ui=False, source="horizon")
        except Exception as error:
            # 资料失败不改写已经完成的回答；CancelledError 保持向上传播。
            logger.warning(f"User context end-of-run refresh failed: {type(error).__name__}")

    async def _ensure_preloaded_files_tracked(self) -> bool:
        """仅为缺失的 preload 路径登记文件，不覆盖已有记录或维护另一套恢复状态。"""
        registered = False
        horizon = self.agent_context.horizon
        for preloaded_file in self._preloaded_file_contents:
            file_path = preloaded_file.path
            try:
                if await horizon.is_file_tracked(file_path):
                    continue
                stat = await get_fresh_file_stat(file_path)
                await horizon.record_file_read(
                    path=file_path,
                    file_hash=await calculate_file_hash(file_path),
                    mtime_ms=stat.mtime * 1000,
                    size=stat.size,
                    truncated=False,
                    tool_name="skill_preload",
                    ranges=[(0, -1)],
                    source_content=preloaded_file.source_content,
                )
                registered = await horizon.is_file_tracked(file_path) or registered
            except Exception as error:
                logger.warning(f"[AgentHorizon] preload 文件登记失败 {file_path}: {error}")
        return registered

    async def _build_horizon_context_update_safely(
        self,
        injection_point: HorizonInjectionPoint,
        log_context: str,
    ) -> str | None:
        """构建 Horizon 注入内容，模型配置错误时静默跳过。"""
        try:
            if injection_point == HorizonInjectionPoint.AFTER_MAIN_AGENT_RUN:
                return await self.agent_context.horizon.build_context_update(injection_point)
            await self._ensure_preloaded_files_tracked()
            await self.agent_context.horizon.flush_pending_user_messages()
            self._sync_horizon_llm_model_info()
            """
            每轮先刷新再生成通知：首轮、工具后的下一轮、未完成 TODO 驱动的续轮都经过这里。
            模型传输重试复用已准备的消息，不因为重试重新触发一轮目录扫描。
            """
            await self._refresh_directory_snapshots()
            return await self.agent_context.horizon.build_context_update(injection_point)
        except Exception as horizon_err:
            if is_non_retryable_model_config_error(horizon_err):
                logger.debug(f"[AgentHorizon] {log_context} 跳过：模型配置错误: {horizon_err}")
                return None
            logger.warning(f"[AgentHorizon] {log_context} 注入失败: {horizon_err}")
            return None

    def _sync_horizon_llm_model_info(self) -> None:
        """在注入 system_injected_context 前预同步模型信息，确保首包可见。"""
        horizon_model_info = self._build_horizon_llm_model_info()
        self.agent_context.horizon.update_llm_model(
            horizon_model_info.model_id,
            horizon_model_info.model_name,
            horizon_model_info.description,
        )


    async def _add_tool_calls_to_history(self, llm_context: LLMResponseContext, interrupted: bool = False) -> None:
        """将工具调用响应添加到聊天历史。interrupted=True 表示此响应在流式输出期间被用户中断。"""
        try:
            reasoning_content = getattr(llm_context.message, 'reasoning_content', None)

            await self.chat_history.append_assistant_message(
                content=llm_context.message.content,
                tool_calls_data=llm_context.tool_calls,
                duration_ms=llm_context.duration_ms,
                token_usage=llm_context.token_usage,
                request_id=llm_context.request_id,
                reasoning_content=reasoning_content,
                interrupted=interrupted,
            )
        except ValueError as e:
            logger.error(f"添加带工具调用的助手消息失败: {e}")
            self.set_agent_state(AgentState.ERROR)
            raise ValueError(f"无法记录助手响应 ({e})")
                    # 不重新抛出异常，避免影响主流程

    async def _synthesize_error_tool_results(
        self,
        tool_calls: List[ToolCall],
        error_message: str,
    ) -> None:
        """为截断的 tool_calls 合成 error tool_result 占位，不执行工具。
        让模型知道调用失败并调整策略（而不是收到"参数没传"的困惑报错）。
        """
        for tc in tool_calls:
            tool_call_id = tc.id if tc.id else f"synthetic_{id(tc)}"
            tool_name = tc.function.name if tc.function else "unknown"
            try:
                await self.chat_history.append_tool_message(
                    content=error_message,
                    tool_call_id=tool_call_id,
                )
                logger.info(
                    f"合成 error tool_result: tool={tool_name}, tool_call_id={tool_call_id}"
                )
            except Exception as e:
                logger.warning(f"合成 error tool_result 失败: tool={tool_name}, error={e}")

    _MAX_COMPLETION_REMINDERS = 2

    async def _handle_no_tool_calls(self, llm_context: LLMResponseContext, loop_state: AgentLoopState) -> None:
        """结束前提供有限提醒，不代替模型等待、停止子 Agent 或更新 Todo。

        例：第一次只提醒 Todo，第二次同时提醒 Todo 和子 Agent，共用两次机会。
        模型再次选择结束时不再提醒；次数用完也不终止它主动继续调用工具的工作。
        """
        loop_state.should_continue = False
        if loop_state.completion_reminder_count >= self._MAX_COMPLETION_REMINDERS:
            return

        incomplete_todos = await self._check_incomplete_todos()
        running_subagents: list[SubagentRunRef] = []
        try:
            running_subagents = await subagent_session_manager.list_running_child_runs(
                self.agent_context.context_id,
            )
        except Exception as error:
            logger.warning(f"读取运行中子 Agent 失败: {error}")

        if not incomplete_todos and not running_subagents:
            return

        reminder = self._build_completion_reminder(incomplete_todos, running_subagents)
        # 先占用机会，写入失败不无限重试；次数和容忍结束的边界不发送给模型。
        loop_state.completion_reminder_count += 1
        try:
            # 本轮没有工具结果，不会经过通常的注入点；继续推理前仍需要最新目录。
            ctx_update = await self._build_horizon_context_update_safely(
                injection_point=HorizonInjectionPoint.BEFORE_CONTINUATION_LLM, log_context="继续未完成任务",
            )
            if ctx_update:
                await self.chat_history.append_user_message(ctx_update, show_in_ui=False, source="horizon")
            # 直接写入当前上下文，不放入可能因预算超限而延期消费的 Horizon 通知队列。
            await self.chat_history.append_user_message(
                reminder, show_in_ui=False, source="completion_reminder",
            )
            loop_state.should_continue = True
            logger.info(
                f"已追加结束提醒 #{loop_state.completion_reminder_count}/{self._MAX_COMPLETION_REMINDERS}，"
                f"未完成 Todo={len(incomplete_todos)}，运行中子 Agent={len(running_subagents)}"
            )
        except Exception as error:
            logger.warning(f"结束提醒写入失败，沿用正常结束流程: {error}")

    @staticmethod
    def _build_completion_reminder(
        incomplete_todos: list[TodoItem],
        running_subagents: list[SubagentRunRef],
    ) -> str:
        """按实际存在的事项生成提醒；运行上限不是模型可选择的工作方式。"""
        lines = [
            "Runtime reminder, not a new user instruction.",
            "There is unfinished work to resolve before completing this task.",
        ]
        if running_subagents:
            lines.extend(["", "Sub-agents still running:"])
            lines.extend(f"- {ref.agent_name} / {ref.agent_id}" for ref in running_subagents)
            lines.extend([
                "",
                "Before finishing, wait for the running sub-agents to complete and collect their results.",
                "Call wait_for_subagents with these exact final session IDs:",
                json.dumps([ref.agent_id for ref in running_subagents], ensure_ascii=False),
                "A timeout or progress message does not mean the sub-agent has completed. "
                "Keep waiting and process the final results before completing this task.",
                "If a delegated task is no longer needed, explicitly stop that sub-agent "
                "instead of leaving it running.",
            ])
        if incomplete_todos:
            lines.extend(["", "Todo items still incomplete:"])
            lines.extend(
                f"- [{todo.status.value}] {todo.id}: {todo.content}"
                for todo in incomplete_todos
            )
            lines.extend([
                "",
                "Resolve the incomplete Todo items. Use todo_update to mark an item completed "
                "only when its work is done, or cancelled only when it is no longer needed.",
            ])
        content = html.escape("\n".join(lines), quote=False)
        return (
            '<system_injected_context>\n<notifications>\n'
            f'<notification source="completion_reminder">\n{content}\n</notification>\n'
            '</notifications>\n</system_injected_context>'
        )

    async def _execute_and_process_tool_calls(self, llm_context: LLMResponseContext) -> ToolExecutionResult:
        """
        执行工具调用并处理结果

        Args:
            llm_context: LLM响应上下文，包含工具调用和响应消息

        Returns:
            ToolExecutionResult: 工具执行结果
        """
        # 确保llm_response_message不为空
        if not llm_context.message:
            logger.error("llm_response_message在工具执行前未设置！")
            llm_context.message = ChatCompletionMessage(
                role="assistant",
                content="[Internal Error: Missing LLM Response]"
            )

        # 执行工具调用
        tool_call_results = await self._execute_tool_calls(llm_context.tool_calls, llm_context.message)

        # 处理工具调用结果
        should_exit, final_response, inject_horizon_after_tools = await self._process_tool_call_results(
            tool_call_results
        )

        # 检测"工具校验失败 + 参数超长"模式：模型输出过长时可能生成有效 JSON 但缺少必填字段，
        # 这种情况 preprocess 阶段不会标记 tool_args_truncated，需要在执行后补充检测
        has_long_args_failure = self._detect_long_args_failure(
            llm_context.tool_calls, tool_call_results
        )

        return ToolExecutionResult(
            should_exit=should_exit,
            final_response=final_response,
            inject_horizon_after_tools=inject_horizon_after_tools,
            has_long_args_failure=has_long_args_failure,
            has_compact_history=any(
                result is not None and result.system == "COMPACT_HISTORY"
                for result in tool_call_results
            ),
        )

    # 工具参数长度阈值：超过此值的失败工具调用被视为"超长参数导致的校验失败"
    _LONG_ARGS_THRESHOLD = 2000

    def _detect_long_args_failure(
        self,
        tool_calls: List[ToolCall],
        tool_call_results: List[ToolResult],
    ) -> bool:
        """检测是否有工具因超长参数导致校验失败。

        场景：模型输出过长时生成的 JSON 语法正确但缺少必填字段，preprocess 阶段
        无法识别（参数非空 {}），但工具执行时 Pydantic 校验会报 missing field。
        """
        for tc, result in zip(tool_calls, tool_call_results):
            if not result or result.ok:
                continue
            args_str = tc.function.arguments if tc.function else ""
            if len(args_str) > self._LONG_ARGS_THRESHOLD:
                logger.warning(
                    f"检测到工具 '{tc.function.name}' 校验失败且参数超长 "
                    f"({len(args_str)} chars > {self._LONG_ARGS_THRESHOLD})，"
                    f"可能是模型输出过长导致参数不完整"
                )
                return True
        return False

    async def _process_tool_call_results(
        self, tool_call_results: List[ToolResult]
    ) -> tuple[bool, Optional[str], bool]:
        """
        处理工具调用结果

        Args:
            tool_call_results: 工具调用结果列表

        Returns:
            Tuple: (是否应该退出循环, 最终响应, 是否执行主循环注入点 2 horizon)
        """
        should_exit = False
        final_response = None
        inject_horizon_after_tools = True

        for result in tool_call_results:
            if not result:  # 跳过空结果
                continue

            try:
                # 计算工具执行耗时
                tool_duration_ms = None
                if hasattr(result, 'execution_time') and result.execution_time is not None:
                    try:
                        tool_duration_ms = float(result.execution_time) * 1000
                    except (ValueError, TypeError):
                        logger.warning(f"无法将工具执行时间 {result.execution_time} 转换为毫秒。")

                # USER_TOOL_CALL：前端工具调用，不写入占位 ToolResult，直接退出循环等待前端回传。
                # 前端回传（或超时）后，由 UserToolCallService.resume_after_user_tool_call
                # 将真实结果追加到历史，上下文此时才完整，再重启 Agent。
                if result.system == "USER_TOOL_CALL":
                    inject_horizon_after_tools = False
                    logger.info("检测到 USER_TOOL_CALL 工具调用，退出主循环等待前端回传（不写入占位 ToolResult）")
                    final_response = result.content
                    self.set_agent_state(AgentState.WAITING_FOR_USER)
                    should_exit = True
                    break

                # 追加工具调用结果到聊天历史
                await self.chat_history.append_tool_message(
                    content=result.content,
                    tool_call_id=result.tool_call_id,
                    system=result.system,
                    duration_ms=tool_duration_ms,
                    context_source=(
                        ContextSource.SKILLS if result.name == "read_skills"
                        else ContextSource.MCP if bool(result.name and result.name.startswith("mcp_"))
                        else ContextSource.from_value(result.extra_info.get("context_source"))
                    ),
                )

                # 检查其他特殊工具调用
                if result.system == "COMPACT_HISTORY":
                    raw_compact_result: object = (result.extra_info or {}).get("compact_result")
                    compact_result = (
                        raw_compact_result
                        if isinstance(raw_compact_result, CompactResult) and raw_compact_result.summary.strip()
                        else None
                    )
                    logger.info("检测到 COMPACT_HISTORY 工具调用，执行聊天历史压缩")
                    self._log_compaction_event(
                        "tool_result_received",
                        "收到压缩工具结果："
                        f"是否有有效压缩结果={compact_result is not None}，"
                        f"工具调用ID={result.tool_call_id}",
                    )

                    if self.capture_compact_history_result:
                        if compact_result is not None:
                            self.captured_compact_result = compact_result
                            should_exit = True
                            final_response = None
                            inject_horizon_after_tools = False
                            logger.info("已捕获 compact_chat_history 摘要与 Skill 建议，结束压缩子 Agent")
                        else:
                            logger.error("compact capture 模式下缺少有效压缩结果")
                            should_exit = True
                            final_response = None
                            inject_horizon_after_tools = False
                        break

                    if compact_result is not None:
                        await self._execute_history_compact(compact_result)
                    else:
                        logger.error("COMPACT_HISTORY tool result missing valid compact_result in extra_info")
                        self._finish_compact_request(reason="压缩工具返回空摘要")
                    # Continue the agent loop after compact
                    continue
            except ValueError as ve:
                logger.error(f"处理或追加工具调用结果时发生错误: {ve!s}")
            except Exception as e:
                logger.error(f"处理工具结果 '{getattr(result, 'name', 'unknown')}' 时发生未知错误: {e!r}", exc_info=True)

        # 检查是否需要退出
        if should_exit:
            logger.info("特殊工具调用已处理，跳出主循环")

        return should_exit, final_response, inject_horizon_after_tools

    async def _check_incomplete_todos(self) -> list[TodoItem]:
        """读取未完成 Todo；保留原有读取失败不阻止结束的行为。"""
        try:
            # 加载待办任务列表
            todos = await TodoService.load_todos()
            # 过滤出未完成的任务(状态为pending或in_progress)
            return [
                todo for todo in todos
                if todo.status in (TodoStatus.PENDING, TodoStatus.IN_PROGRESS)
            ]
        except Exception as e:
            logger.error(f"检查未完成任务时发生错误: {e}", exc_info=True)
            return []

    async def _execute_history_compact(self, result: CompactResult) -> None:
        """
        应用前台压缩结果，历史替换成功后再提供 Skill 建议。

        Args:
            result: 已恢复所选用户原文的摘要，以及压缩模型选出的 Skill 建议。
        """
        summary = result.summary
        # 前台压缩已就绪（summary 已生成），取消正在进行的后台压缩以避免冲突
        self._bg_compact_state.reset()

        blocker_acquired = False
        try:
            self.agent_context.increment_cancel_blocker()
            blocker_acquired = True
            original_message_count = len(self.chat_history.messages)
            original_tokens = await self.chat_history.tokens_count()
            self._log_compaction_event(
                "execute_start",
                "开始执行聊天历史压缩："
                f"压缩前消息数={original_message_count}，"
                f"压缩前Token={original_tokens}，"
                f"摘要字符数={len(summary or '')}",
            )

            await self._backup_before_compact()

            compressed_content = self._build_compacted_summary_message(summary)
            compacted_tokens = num_tokens_from_string(compressed_content)
            replacement_messages = [
                SystemMessage(content=self.system_prompt, show_in_ui=False),
                UserMessage(content=compressed_content, show_in_ui=True, source="compact_summary"),
            ]
            await self.chat_history.replace_messages(replacement_messages)
            compressed_message_count = len(self.chat_history.messages)
            compact_ratio = (
                f"{(original_tokens - compacted_tokens) / original_tokens:.1%}"
                if original_tokens > 0
                else "0.0%"
            )

            logger.info(
                f"Chat history compressed successfully: "
                f"original_messages={original_message_count}, "
                f"compressed_messages={compressed_message_count}, "
                f"original_tokens={original_tokens}, "
                f"compacted_tokens={compacted_tokens}, "
                f"压缩比例={compact_ratio}"
            )
            self._log_compaction_event(
                "execute_success",
                "聊天历史压缩成功："
                f"压缩前消息数={original_message_count}，"
                f"压缩后消息数={compressed_message_count}，"
                f"压缩前Token={original_tokens}，"
                f"压缩后Token={compacted_tokens}，"
                f"压缩比例={compact_ratio}",
            )

            await self.agent_context.horizon.on_context_reset()
            await self._rehydrate_media_models_after_context_reset()
            # 主动压缩同样需要恢复当前记忆事实，不能指望摘要完整保留旧开关通知。
            self.agent_context.horizon.push_notification("memory", build_memory_runtime_context(self.agent_context))
            self._push_web_search_runtime_context()
            await self.agent_context.horizon.suggest_skills(
                result.skill_suggestions,
                source="context_compaction",
            )

        except Exception as e:
            self._log_compaction_event(
                "execute_failed",
                f"聊天历史压缩失败：错误类型={type(e).__name__}，错误={e}",
            )
            logger.error("compaction.execute_failed_detail: 上下文压缩异常详情", exc_info=True)
            logger.error(f"执行聊天历史压缩失败: {e}", exc_info=True)
            # Don't raise - allow agent to continue even if compaction fails

        finally:
            if blocker_acquired:
                self.agent_context.decrement_cancel_blocker()
            self._finish_compact_request(reason="压缩完成")

    async def _reset_for_new_session(self) -> None:
        """
        Reset chat history for a new session triggered by /new command.

        Backs up the current history, clears it, then re-adds the system prompt
        and refreshed dynamic context so the next user message starts from a clean slate.
        """
        try:
            # 取消后台压缩任务（如有）
            self._bg_compact_state.reset()

            # 备份当前历史，与 compact 保持一致，避免数据丢失
            await self._backup_before_compact()

            from app.service.agent_runtime_reset_service import (
                AgentRuntimeResetService,
                ResetReason,
            )

            await AgentRuntimeResetService.reset_session_context(
                self.agent_context,
                reason=ResetReason.NEW_SESSION,
                stop_run=False,
                clear_chat_history=True,
                reset_horizon=True,
            )

            # 重新写入 system prompt（始终排第一）
            await self.chat_history.append_system_message(self.system_prompt)

            await self._rehydrate_media_models_after_context_reset()

            self._context_usage_estimator.clear()
            logger.info("Chat history reset for new session via /new")

        except Exception as e:
            logger.error(f"Failed to reset chat history for new session: {e}", exc_info=True)

    async def _rehydrate_media_models_after_context_reset(self) -> None:
        """在 reset 清空 horizon 后，用当前请求的 dynamic_config 重新回填图片/视频模型信息。"""
        chat_message = self.agent_context.get_chat_client_message()
        if not chat_message:
            return

        dynamic_config = getattr(chat_message, "dynamic_config", None)
        if not dynamic_config:
            return

        # /new 和 /compact 都会先清空 horizon 中的媒体模型状态。
        # 这里立刻用当前请求重新同步，确保紧随其后的 initial_context 看到的是最新配置，而不是空状态。
        from app.service.image_model_sizes_service import ImageModelSizesService
        from app.service.video_model_config_service import VideoModelConfigService

        await ImageModelSizesService.sync_to_horizon(dynamic_config, self.agent_context.horizon)
        await VideoModelConfigService.sync_to_horizon(dynamic_config, self.agent_context.horizon)

    async def _backup_before_compact(self) -> None:
        """压缩前完整保存当前聊天记录；写入失败时中止本次压缩。"""
        from app.utils.async_file_utils import async_write_json

        backup_dir = Path(self.chat_history.chat_history_dir) / "compacted"
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        backup_file_path = backup_dir / f"{self.agent_name}<{self.id}>_{timestamp}.json"
        history_document = [
            self.chat_history._message_to_storage_dict(message)
            for message in self.chat_history.messages
        ]
        await async_write_json(
            backup_file_path,
            history_document,
            ensure_ascii=False,
            indent=4,
        )
        logger.info(f"Chat history backed up to: {backup_file_path}")
        from app.service.chat_history_cleanup_service import ChatHistoryCleanupService
        ChatHistoryCleanupService.trigger()

    # 输出过长恢复消息的共享上限（覆盖流式降级 + 退避重试 + finish_reason 截断等场景）
    _MAX_OUTPUT_RECOVERY_LIMIT = 6

    async def _try_inject_output_recovery_message(
        self,
        loop_state: AgentLoopState,
        message: str,
        source: str,
    ) -> bool:
        """尝试注入"输出过长"恢复消息到聊天历史。
        共享计数器，超过上限时不再注入。覆盖 finish_reason=length 和流中断两种场景。

        Returns:
            是否成功注入
        """
        if loop_state.output_recovery_count >= self._MAX_OUTPUT_RECOVERY_LIMIT:
            logger.info(
                f"[{source}] 输出恢复消息已达上限 {self._MAX_OUTPUT_RECOVERY_LIMIT} 次，跳过注入"
            )
            return False
        loop_state.output_recovery_count += 1
        try:
            await self.chat_history.append_user_message(
                message, show_in_ui=False, source=source,
            )
            logger.warning(
                f"[{source}] 注入恢复消息 (#{loop_state.output_recovery_count}/{self._MAX_OUTPUT_RECOVERY_LIMIT})"
            )
            return True
        except Exception as e:
            logger.warning(f"[{source}] 注入恢复消息失败: {e}")
            return False

    async def _handle_agent_loop_exception(
        self,
        exception: Exception,
        loop_state: AgentLoopState,
    ) -> ExceptionHandlingResult:
        """
        处理Agent循环中的异常（LLM 重试已在 _call_llm_with_retry 内闭环，
        到这里的异常是：前后置准备/解析失败、LLM 重试全部耗尽、或非 LLM 异常）

        Args:
            exception: 捕获的异常
            loop_state: 循环状态，会被直接修改

        Returns:
            ExceptionHandlingResult: 异常处理结果
        """
        self._log_agent_loop_exception(exception)

        # 处理中断的工具调用
        await self._handle_interrupted_tool_calls(exception)

        # Reactive compact：context_window_exceeded 时先压缩上下文再重试
        if not loop_state.reactive_compact_attempted:
            cw_snapshot = self._find_context_window_error(exception)
            if cw_snapshot:
                loop_state.reactive_compact_attempted = True
                logger.warning(
                    f"检测到上下文超窗，尝试被动压缩: "
                    f"{cw_snapshot.primary_message}"
                )
                compacted = await self._try_compact_chat_history_force(reason="上下文超窗")
                if compacted:
                    logger.info("被动压缩请求已注入，重试 LLM 调用")
                    return ExceptionHandlingResult(should_continue=True, final_response=None)
                else:
                    logger.warning("被动压缩无法执行（消息太少），继续走终态逻辑")

        final_task_state = self._build_final_task_state_from_exception(exception)
        if final_task_state is not None:
            logger.warning(f"检测到终态异常 {final_task_state.code.value}，停止当前任务的自动重试")
            await self._append_agent_run_exception_context_safely(exception)
            loop_state.last_llm_message = None
            self._apply_final_task_state(final_task_state)
            return ExceptionHandlingResult(
                should_continue=False,
                final_response=None
            )

        self.set_agent_state(AgentState.ERROR)

        # 更新计数器
        loop_state.agent_loop_retry_count += 1

        # 非 LLM 异常的通用退避重试
        max_retries = 10
        max_total_retry_wait_time = 900.0
        enable_agent_loop_retry = config.get("agent.enable_agent_loop_retry", False)
        stop_reason = ""

        if enable_agent_loop_retry:
            wait_time, total_retry_wait_time = self._apply_exponential_backoff(loop_state.agent_loop_retry_count)
            retry_count_exhausted = loop_state.agent_loop_retry_count >= max_retries
            retry_wait_limit_exceeded = total_retry_wait_time >= max_total_retry_wait_time
            can_continue = not retry_count_exhausted and not retry_wait_limit_exceeded
            if not can_continue:
                if retry_count_exhausted:
                    stop_reason = (
                        "agent loop retry budget exhausted "
                        f"(agent_loop_retry_count={loop_state.agent_loop_retry_count}, "
                        f"max_retries={max_retries})"
                    )
                else:
                    stop_reason = (
                        "agent loop total wait limit exceeded "
                        f"(agent_loop_retry_count={loop_state.agent_loop_retry_count}, "
                        f"total_retry_wait_time={total_retry_wait_time:.1f}s, "
                        f"max_total_retry_wait_time={max_total_retry_wait_time:.1f}s)"
                    )
        else:
            wait_time = 0.0
            can_continue = False
            stop_reason = (
                "agent loop retry disabled "
                f"(agent_loop_retry_count={loop_state.agent_loop_retry_count})"
            )

        if not can_continue:
            await self._append_agent_run_exception_context_safely(exception)

        if can_continue:
            logger.warning(
                f"非 LLM 异常，当前 agent loop 重试次数为{loop_state.agent_loop_retry_count}，"
                f"等待{wait_time:.1f}秒后继续下一次循环"
            )
            await self._interruptible_sleep(wait_time)
            return ExceptionHandlingResult(should_continue=True, final_response=None)
        else:
            logger.warning(
                "停止 agent loop: "
                f"{stop_reason} "
                f"(exception_type={exception.__class__.__name__}, exception={exception})"
            )
            self._apply_final_task_state(build_final_task_state(
                FinalTaskStateCode.MESSAGE_PROCESSING_FAILED,
                vendor_message=str(exception),
                model_error=self._resolve_model_error(exception),
            ))
            loop_state.last_llm_message = None
            return ExceptionHandlingResult(should_continue=False, final_response=None)

    async def _handle_interrupted_tool_calls(self, exception: Exception) -> None:
        """
        处理因异常而中断的工具调用

        Args:
            exception: 捕获的异常
        """
        # 如果最后一条消息是带有工具调用的助手消息，为每个调用添加错误信息
        last_message = self.chat_history.get_last_message()
        if isinstance(last_message, AssistantMessage) and last_message.tool_calls:
            general_error_message = self._build_execution_interrupted_tool_message(exception)

            for tool_call in last_message.tool_calls:
                try:
                    await self.chat_history.append_tool_message(
                        content=general_error_message,
                        tool_call_id=tool_call.id,
                    )
                    logger.info(f"为中断的工具调用 {tool_call.id} ({tool_call.function.name}) 添加了错误消息。")
                except Exception as insert_err:
                    logger.error(f"插入工具调用 {tool_call.id} 的错误消息时失败: {insert_err!s}")

    def _apply_exponential_backoff(self, agent_loop_retry_count: int) -> tuple[float, float]:
        """
        应用指数退避策略计算重试等待时间

        Args:
            agent_loop_retry_count: agent loop 重试次数

        Returns:
            Tuple: (本次等待时间, 总计等待时间)
        """
        # 基础等待时间为2秒，每次失败后翻倍，最多等待5分钟
        base_wait_time = 2
        max_wait_time = 300

        # 计算当前等待时间
        wait_time = min(base_wait_time * (2 ** (agent_loop_retry_count - 1)), max_wait_time)

        # 计算总等待时间
        if not hasattr(self, '_total_retry_wait_time'):
            self._total_retry_wait_time = 0

        self._total_retry_wait_time += wait_time

        return wait_time, self._total_retry_wait_time

    async def _finalize_agent_loop(self, loop_state: AgentLoopState) -> Optional[str]:
        """
        完成Agent循环后的清理和结果处理

        Args:
            loop_state: 循环状态，包含最终响应和最后的LLM消息

        Returns:
            str: 最终响应
        """
        # 处理循环正常结束但最终响应未设置的情况
        if not loop_state.final_response and loop_state.last_llm_message:
            # 获取最后添加的消息
            last_added_msg = self.chat_history.get_last_message()

            # 检查last_added_msg是否包含预期内容
            if last_added_msg and isinstance(last_added_msg, AssistantMessage) and last_added_msg.content == loop_state.last_llm_message.content:
                loop_state.final_response = loop_state.last_llm_message.content
            else:
                # 如果最后消息不是预期的内容
                if loop_state.last_llm_message.content:
                    loop_state.final_response = loop_state.last_llm_message.content
                    # 确保最终响应被记录（如果循环内没有添加）
                    if not (last_added_msg and isinstance(last_added_msg, AssistantMessage) and last_added_msg.content == loop_state.final_response):
                        await self.chat_history.append_assistant_message(
                            content=loop_state.final_response,
                            request_id=None  # 最终响应记录不需要 request_id
                        )
                else:
                    # 如果最后LLM响应内容为空（理论上不应发生，除非只有tool_calls）
                    logger.info("循环结束，但最后的LLM响应内容为空。")
                    loop_state.final_response = None  # 明确设为None

        # 记录最终响应
        if loop_state.final_response:
            logger.info(f"最终响应: {loop_state.final_response}")
            self.agent_context.set_final_response(loop_state.final_response)
        else:
            logger.info("最终响应为空")
            self.agent_context.set_final_response(None)

        # 兜底还原 compact 请求状态（防止 LLM 未调用 compact_chat_history 工具导致模型或 pending 状态卡住）
        if (
            self.agent_context.model_context.has_active_compact_text_model()
            or self._has_pending_compact_request()
        ):
            logger.warning("Agent 结束时检测到 compact 请求未结束，执行兜底恢复")
            self._finish_compact_request(reason="Agent 结束兜底")

        # 更新Agent状态 - 使用is_agent_running替代直接比较
        logger.info(f"_finalize_agent_loop: 检查最终状态，当前 agent_state = {self.agent_state.value}")
        if self.is_agent_running():
            self.set_agent_state(AgentState.FINISHED)

        # 记录token使用情况 - 只在非流模式下记录和打印
        if not self.stream_mode:
            # 获取token使用报告
            token_report = self.get_token_usage_report()
            # 保存token使用报告到context中
            self.agent_context.set_token_usage_report(token_report)
            # 打印token使用报告
            self.print_token_usage()

        return loop_state.final_response

    async def _handle_agent_loop_stream(self) -> None:
        """处理 agent 循环流"""
        # 目前未实现流式处理，返回空值
        return None

    def _is_tool_visible_in_current_context(self, tool_name: str) -> bool:
        """检查工具是否应暴露给当前 Agent 上下文的 LLM。"""
        try:
            tool_instance = tool_factory.get_tool_instance(tool_name)
        except Exception:
            logger.opt(exception=True).warning(f"工具 {tool_name} 实例化失败，跳过添加。")
            return False
        return tool_instance.is_visible_in_context(self.agent_context)

    @staticmethod
    def _validate_llm_response(response: ChatCompletion) -> None:
        """错误 envelope 不包含 choices，先保留上游错误语义，再读取消息。"""
        extra = response.model_extra or {}
        code = extra.get("code")
        if code is not None and code != 1000:
            message = extra.get("message") or "Model service returned an error"
            raise RuntimeError(f"Model request failed: code={code}, message={message}")
        if not response.choices or response.choices[0].message is None:
            raise RuntimeError("Model service returned no response choices/message.")

    async def _call_llm(
        self,
        messages: List[Dict[str, Any]],
        use_stream: bool = True,
        first_chunk_timeout: Optional[int] = None,
        chunk_timeout: Optional[int] = None,
        non_stream_timeout: Optional[int] = None,
    ) -> ChatCompletion:
        """调用 LLM

        Args:
            messages: 聊天消息历史
            use_stream: 是否使用流式模式
            first_chunk_timeout: 流式首包超时（秒）
            chunk_timeout: 流式 chunk 间隔超时（秒）
            non_stream_timeout: 非流式请求超时（秒）
        """

        # 构建工具列表：基础工具 + 授权的 MCP 工具
        tools_list = []

        # 1. 添加 .agent 文件中定义的基础工具
        if self.tools:
            for tool_name in self.tools.keys():
                if not self._is_tool_visible_in_current_context(tool_name):
                    continue
                # 只通过预构建定义获取工具参数
                tool_param = tool_factory.get_llm_direct_tool_param_from_definition(tool_name)

                if tool_param:
                    # 成功从预构建定义生成参数
                    tools_list.append(tool_param)
                    logger.debug(f"从预构建定义获取工具参数: {tool_name}")
                else:
                    # 预定义参数不存在，跳过该工具并警告
                    logger.warning(f"工具 {tool_name} 的预定义参数不存在，跳过添加。请运行工具定义生成命令来创建预定义文件。")

        # MCP 工具不再直接挂载：chat 维度的 MCP 配置由 using-mcp skill
        # 按需查看并调用，不再通过 tool_factory 暴露给模型。

        # 保存工具列表到与聊天记录同名的.tools.json文件
        if self.chat_history and tools_list and not self.agent_context.is_subagent_context():
            self.chat_history.save_tools_list(tools_list)

        # 创建 ToolContext 实例
        tool_context = ToolContext(metadata=self.agent_context.get_metadata())
        # 将 AgentContext 作为扩展注册
        tool_context.register_extension("agent_context", self.agent_context)

        text_model_state = self._resolve_current_text_model()

        # ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ 调用 LLM ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ #
        start_time = time.time()
        # logger.debug(f"发送给 LLM 的 messages: {messages}")

        # 创建调用配置：根据 use_stream 决定流式/非流式
        # 子 Agent (is_main_agent=False) 静默运行，不向前端推送 LLM token 流。
        # 多个子 Agent 并行时共享同一 SocketIO topic_id，推流会导致前端收到交织输出。
        if use_stream and self.agent_context.is_main_agent:
            message_version = self.agent_context.get_message_version()
            from app.streaming.builder_registry import get_builder_by_version
            message_builder = get_builder_by_version(message_version)
            await message_builder.prepare_for_streaming(self.agent_context)
            socketio_driver_config = StreamingConfigGenerator.create_for_agent()
            processor_config = ProcessorConfig.create_with_socketio_push(
                message_builder=message_builder,
                socketio_driver_config=socketio_driver_config
            )
        elif use_stream:
            processor_config = ProcessorConfig.create_streaming_only()
        else:
            processor_config = ProcessorConfig.create_default()

        # 设置超时参数（由业务层 _call_llm_with_retry 传入）
        if first_chunk_timeout is not None:
            processor_config.stream_first_chunk_timeout_seconds = first_chunk_timeout
        if chunk_timeout is not None:
            processor_config.stream_chunk_timeout_seconds = chunk_timeout
        if non_stream_timeout is not None:
            processor_config.non_stream_timeout_seconds = non_stream_timeout

        if self.agent_context.is_main_agent and self.agent_context.get_message_version() == "v2":
            sources: dict[str, ContextSource | None] = {}
            for message in self.chat_history.messages:
                if isinstance(message, AssistantMessage):
                    for call in message.tool_calls or []:
                        if call.function is None:
                            continue
                        name = call.function.name
                        sources[call.id] = (
                            ContextSource.SKILLS if name == "read_skills"
                            else ContextSource.MCP if name.startswith("mcp_")
                            else ContextSource.MIXED if name == "run_sdk_snippet"
                            else None
                        )
                elif isinstance(message, ToolMessage) and message.context_source is not None:
                    sources[message.tool_call_id] = message.context_source
            schema_estimates: dict[int, ToolSchemaEstimate] = {}
            for tool_param in tools_list:
                estimate = tool_factory.get_context_usage_schema_estimate(tool_param["function"]["name"])
                if estimate is not None:
                    schema_estimates[id(estimate.schema)] = estimate
            processor_config.context_usage_estimator = lambda request: self._context_usage_estimator.estimate(
                request, sources, schema_estimates,
            )

        processor_config.model_id = text_model_state.model_id
        processor_config.model_name = text_model_state.model_name

        try:
            llm_response: ChatCompletion = await LLMFactory.call_with_tool_support(
                text_model_state.model_id,
                messages,
                tools=tools_list if tools_list else None,
                stop=self.agent_context.stop_sequences if hasattr(self.agent_context, 'stop_sequences') else None,
                agent_context=self.agent_context,
                processor_config=processor_config,
                enable_llm_response_events=True,
                llm_config=text_model_state.config,
                extra_body=self.agent_context.get_reasoning_extra_body(),
            )
        except ResourceLimitExceededException:
            raise
        except Exception as exception:
            # 在真实调用边界记住身份并原样抛出；不改变重试分类、时机或取消行为。
            code = self._classify_llm_exception_for_user(exception)
            if code is not None:
                # 保存失败请求的名称；之后切换模型或恢复压缩模型不改变历史错误身份。
                self._last_model_call_failure = ModelCallFailure(
                    exception, self._create_model_error(code, text_model_state.model_name),
                )
            raise

        self._validate_llm_response(llm_response)
        llm_response_message = llm_response.choices[0].message
        request_time = time.time() - start_time
        # ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ 调用 LLM 结束 ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ #
        # 从 TokenUsageTracker 获取最近一次记录的、结构化的 TokenUsage 对象
        current_token_usage = LLMFactory.token_tracker.get_last_recorded_usage()

        # --- 处理 LLM 响应内容为空的情况 ---
        # ChatHistory 标准化应该已经处理了大部分情况，这里作为最后防线
        # 特别是处理 API 返回的 content 为 None 但有 tool_calls 的情况
        if llm_response_message.content is None or llm_response_message.content.strip() == "":
            if llm_response_message.tool_calls:
                 # 如果有 tool_calls，content 为 None 是合法的，不需要修改
                 # 但为了日志和后续处理，可以给一个内部标记或默认值
                 logger.debug("LLM 响应 content 为空，但包含 tool_calls。")
                 # 保持 llm_response_message.content 为 None 或空字符串
                 # 如果后续逻辑需要非空 content，可以在那里处理
                 # 曾经我们使用 explanation 参数作为兜底，现在出于费用+影响流式实现的原因不再使用，让前端直接显示大模型输出
                 # 如果仍为空，保持原样 (None 或空)
                 if llm_response_message.content is None:
                     llm_response_message.content = "" # 设为空字符串而不是None，简化后续处理

            else:
                 # 没有 tool_calls，内容不应为空
                 logger.warning("LLM 响应消息内容为空且无 tool_calls，使用默认值 'Continue'")
                 # 使用漂亮的 JSON 格式打印有问题的消息
                 try:
                     message_dict = llm_response_message.model_dump() # pydantic v2
                     formatted_json = json.dumps(message_dict, ensure_ascii=False, indent=2)
                     logger.warning(f"详细信息:\n{formatted_json}")
                 except Exception as e:
                     logger.warning(f"尝试打印 LLM 响应消息失败: {e!s}")
                 llm_response_message.content = "Continue" # 强制设为 Continue


        logger.info(f"LLM 响应: role={llm_response_message.role}, content='{llm_response_message.content[:100]}...', tool_calls={llm_response_message.tool_calls is not None}")

        return llm_response

    async def _execute_tool_calls(self, tool_calls: List[ToolCall], llm_response_message: ChatCompletionMessage) -> List[ToolResult]:
        """Execute tool calls, supports both sequential and parallel execution"""
        from app.tools.core.tool_call_executor import tool_call_executor

        return await tool_call_executor.execute(
            tool_calls,
            self.agent_context,
            preflight_failures=self._tool_preflight_failures,
        )

    async def _execute_tool_calls_sequential(self, tool_calls: List[ToolCall], llm_response_message: ChatCompletionMessage) -> List[ToolResult]:
        """使用顺序模式执行 Tools 调用（委托给全局执行器）"""
        from app.tools.core.tool_call_executor import tool_call_executor

        return await tool_call_executor.execute_sequential(
            tool_calls,
            self.agent_context
        )

    async def _execute_tool_calls_parallel(self, tool_calls: List[ToolCall], llm_response_message: ChatCompletionMessage) -> List[ToolResult]:
        """使用并行模式执行 Tools 调用（委托给全局执行器）"""
        from app.tools.core.tool_call_executor import tool_call_executor

        return await tool_call_executor.execute_parallel(
            tool_calls,
            self.agent_context,
            None  # 使用执行器的默认超时配置
        )

    def _process_user_input_with_mentions(self, query: str, mentions: List[Dict[str, Any]] = None) -> str:
        """处理用户输入中的特殊格式和mentions信息

        Args:
            query: 原始的用户查询
            mentions: mentions字段中的信息

        Returns:
            str: 处理后的查询内容，包含mentions上下文信息
        """
        # 注意：mentions信息现在由agent_service.py在系统上下文中处理
        # 外部输入已经是完整的格式，不需要再进行转换
        if mentions:
            logger.info(f"注意：收到{len(mentions)}个mentions，但这些应该已在系统上下文中处理")

        return query

    def get_system_skills_list(self) -> List[str]:
        """获取当前 agent 配置的系统 skills 名称列表（对应 YAML frontmatter system_skills）"""
        cfg = self._agent_loader.get_skills_config(self.agent_name)
        return cfg.get_system_skill_names() if cfg else []

    def get_loaded_skills(self) -> List[str]:
        """
        获取当前 agent 已加载的 skills 列表

        Returns:
            List[str]: 已加载的 skills 名称列表
        """
        return self.loaded_skills

    def has_skill(self, skill_name: str) -> bool:
        """
        检查 agent 是否具有指定的 skill

        Args:
            skill_name: skill 名称

        Returns:
            bool: 是否具有该 skill
        """
        return skill_name in self.loaded_skills
