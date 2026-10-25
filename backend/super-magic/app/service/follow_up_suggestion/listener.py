"""监听主任务轮次，在满足条件时提交一次追加问题生成。"""

import asyncio
from typing import Any, Optional, Set

from agentlang.agent.state import AgentState
from agentlang.config.config import config
from agentlang.event.data import AfterAgentLoopEventData, AfterMainAgentRunEventData
from agentlang.event.event import Event, EventType
from agentlang.llms.factory import LLMFactory
from agentlang.logger import get_logger
from app.core.ai_abilities import AIAbility, get_ability_config
from app.infrastructure.sdk.magic_service.kernel.magic_service_parameter import MagicServiceAuthConfig
from app.service.agent_event.base_listener_service import BaseListenerService
from app.service.follow_up_suggestion.context_builder import FollowUpContextBuilder, FollowUpTaskState
from app.service.follow_up_suggestion.service import (
    FollowUpGenerationError,
    FollowUpGenerationJob,
    FollowUpSuggestionService,
)

logger = get_logger(__name__)

_OUTPUT_PARAM_KEYS = ("tools", "tool_choice", "n", "stream")


class FollowUpSuggestionListener:
    """按 task 去重。同一个 task 最多提交一次，不使用全局锁。"""

    def __init__(self, service: Optional[FollowUpSuggestionService] = None) -> None:
        self._service = service or FollowUpSuggestionService()
        self._current_request = ""
        self._task_id = ""
        self._submitted = False
        self._task_effective = 0
        self._run_effective_cursor = 0
        self._seen_loop_indexes: Set[int] = set()
        self._background_task: Optional[asyncio.Task] = None

    @staticmethod
    def register_standard_listeners(agent_context: Any) -> None:
        """注册到当前主 Agent 上下文。计数和后台任务保存在这次创建的实例上。"""
        listener = FollowUpSuggestionListener()
        BaseListenerService.register_listeners(agent_context, {
            EventType.BEFORE_MAIN_AGENT_RUN: listener._handle_before_main_agent_run,
            EventType.AFTER_AGENT_LOOP: listener._handle_after_agent_loop,
            EventType.AFTER_MAIN_AGENT_RUN: listener._handle_after_main_agent_run,
        })

    async def _handle_before_main_agent_run(self, event: Event) -> None:
        context = event.data.agent_context
        if not self._is_main_agent(context):
            return
        task_id = self._task_id_of(context)
        if task_id == "":
            return
        self._switch_task_if_needed(task_id)
        self._current_request = event.data.query
        self._run_effective_cursor = 0
        self._seen_loop_indexes = set()
        context.register_run_cleanup("follow_up_suggestions", self._cancel_background)

    async def _handle_after_agent_loop(self, event: Event[AfterAgentLoopEventData]) -> None:
        context = event.data.agent_context
        if not self._ready(context):
            return
        self._switch_task_if_needed(self._task_id_of(context))
        if event.data.loop_index in self._seen_loop_indexes:
            return
        self._seen_loop_indexes.add(event.data.loop_index)
        if event.data.outcome.value == "normal":
            delta = event.data.effective_loop_count - self._run_effective_cursor
            if delta > 0:
                self._task_effective += delta
                self._run_effective_cursor = event.data.effective_loop_count
        if self._submitted or event.data.outcome.value != "normal":
            return
        if self._task_effective < self._min_effective_loops():
            return
        self._submit(context, "threshold")

    async def _handle_after_main_agent_run(self, event: Event[AfterMainAgentRunEventData]) -> None:
        context = event.data.agent_context
        if not self._ready(context):
            return
        self._switch_task_if_needed(self._task_id_of(context))
        if self._submitted or event.data.agent_state != AgentState.FINISHED.value:
            return
        self._submit(context, "finished")

    def _submit(self, context: Any, reason: str) -> None:
        """先标记已提交，避免阈值和结束事件各启动一次。准备失败也不再补跑。"""
        self._submitted = True
        try:
            job = self._build_job(context, reason)
        except Exception as error:
            category = error.category if isinstance(error, FollowUpGenerationError) else error.__class__.__name__
            logger.info(
                f"追加问题快照失败 task_id={self._task_id} reason={reason} category={category}"
            )
            return
        self._background_task = asyncio.create_task(self._service.generate(job))
        self._background_task.add_done_callback(self._release_background)

    def _build_job(self, context: Any, reason: str) -> FollowUpGenerationJob:
        """固定运行身份、专用参考资料和模型配置，隔离后台生成。"""
        # 调试客户端的 CHAT 只带任务 ID 和个人偏好，身份在初始化消息里。
        # 聊天消息里的非空值优先；缺哪一项就用初始化消息补哪一项。
        user_id, organization_code, authorization = self._identity(context)
        history = getattr(context, "chat_history", None)
        if history is None or not hasattr(history, "get_message_snapshot"):
            raise FollowUpGenerationError("history_missing")
        # 在主事件循环内同步组装为独立文本，不把可变历史对象传给后台任务。
        reference_context = FollowUpContextBuilder(
            max_context_tokens=self._positive_int(
                config.get("follow_up_suggestions.context_token_budget", 8192), 8192,
            ),
        ).build(
            history.get_message_snapshot(),
            current_request=self._current_request,
            task_state=FollowUpTaskState.COMPLETED if reason == "finished" else FollowUpTaskState.IN_PROGRESS,
        ).render()
        llm_config = self._snapshot_model()
        return FollowUpGenerationJob(
            task_id=self._task_id_of(context),
            trigger_reason=reason,
            reference_context=reference_context,
            auth_config=MagicServiceAuthConfig(
                user_id=user_id,
                organization_code=organization_code,
                user_authorization=authorization,
            ),
            llm_config=llm_config,
            model_timeout_seconds=self._timeout("model_timeout_seconds", 60),
            report_timeout_seconds=self._timeout("report_timeout_seconds", 5),
        )

    def _snapshot_model(self):
        """复制平台模型配置。明确禁用或模型不支持工具时，本次不再请求。"""
        if get_ability_config(AIAbility.FOLLOW_UP_QUESTIONS, "enabled", default=True) is not True:
            raise FollowUpGenerationError("ability_disabled")
        model_id = str(get_ability_config(
            AIAbility.FOLLOW_UP_QUESTIONS,
            "model_id",
            default="deepseek-v4-flash",
        ) or "").strip() or "deepseek-v4-flash"
        temperature = float(get_ability_config(AIAbility.FOLLOW_UP_QUESTIONS, "temperature", default=0.3) or 0.3)
        max_tokens = int(get_ability_config(AIAbility.FOLLOW_UP_QUESTIONS, "max_tokens", default=512) or 512)
        llm_config = LLMFactory.get_model_config(model_id).model_copy(deep=True)
        extra_params = dict(llm_config.extra_params)
        for key in _OUTPUT_PARAM_KEYS:
            extra_params.pop(key, None)
        llm_config.extra_params = extra_params
        llm_config.temperature = temperature
        llm_config.max_output_tokens = max_tokens
        if not llm_config.supports_tool_use:
            raise FollowUpGenerationError("tool_use_unsupported")
        return llm_config

    def _ready(self, context: Any) -> bool:
        if not self._is_main_agent(context) or self._task_id_of(context) == "":
            return False
        try:
            preferences = context.get_personal_preferences()
            enabled = preferences.show_follow_up_suggestions is True
        except Exception:
            return False
        if not enabled:
            return False
        return get_ability_config(AIAbility.FOLLOW_UP_QUESTIONS, "enabled", default=True) is True

    def _switch_task_if_needed(self, task_id: str) -> None:
        if task_id == "" or task_id == self._task_id:
            return
        self._cancel_background_now()
        self._task_id = task_id
        self._current_request = ""
        self._submitted = False
        self._task_effective = 0
        self._run_effective_cursor = 0
        self._seen_loop_indexes = set()

    async def _cancel_background(self) -> None:
        self._cancel_background_now()

    def _cancel_background_now(self) -> None:
        task = self._background_task
        if task is not None and not task.done():
            task.cancel()

    def _release_background(self, task: asyncio.Task) -> None:
        if self._background_task is task:
            self._background_task = None
        try:
            task.exception()
        except asyncio.CancelledError:
            return
        except Exception as error:
            logger.info(f"追加问题后台任务结束 category={error.__class__.__name__}")

    @staticmethod
    def _identity(context: Any) -> tuple[str, str, str]:
        chat_metadata = FollowUpSuggestionListener._chat_metadata(context)
        init_metadata = FollowUpSuggestionListener._init_metadata(context)
        user_id = FollowUpSuggestionListener._metadata_text(chat_metadata, "user_id") or (
            FollowUpSuggestionListener._metadata_text(init_metadata, "user_id")
        )
        organization_code = FollowUpSuggestionListener._metadata_text(chat_metadata, "organization_code") or (
            FollowUpSuggestionListener._metadata_text(init_metadata, "organization_code")
        )
        authorization = FollowUpSuggestionListener._metadata_text(chat_metadata, "authorization") or (
            FollowUpSuggestionListener._metadata_text(init_metadata, "authorization")
        )
        if user_id == "" or organization_code == "" or authorization == "":
            raise FollowUpGenerationError("identity_incomplete")
        return user_id, organization_code, authorization

    @staticmethod
    def _chat_metadata(context: Any):
        message = context.get_chat_client_message()
        return None if message is None else message.metadata

    @staticmethod
    def _init_metadata(context: Any):
        getter = getattr(context, "get_init_client_message_metadata", None)
        if not callable(getter):
            return None
        try:
            return getter()
        except Exception:
            return None

    @staticmethod
    def _metadata_text(metadata: Any, field: str) -> str:
        if metadata is None:
            return ""
        value = getattr(metadata, field, None)
        return "" if value is None else str(value).strip()

    @staticmethod
    def _is_main_agent(context: Any) -> bool:
        return bool(context.is_main_agent_context()) and not bool(context.is_subagent_context())

    @staticmethod
    def _task_id_of(context: Any) -> str:
        task_id = context.get_task_id()
        return "" if task_id is None else str(task_id).strip()

    @staticmethod
    def _min_effective_loops() -> int:
        """延后长任务的提前生成时机，短任务仍由完成事件触发。"""
        return FollowUpSuggestionListener._positive_int(
            config.get("follow_up_suggestions.min_effective_loops", 10),
            10,
        )

    @staticmethod
    def _timeout(key: str, default: float) -> float:
        raw = config.get(f"follow_up_suggestions.{key}", default)
        try:
            value = float(raw)
        except (TypeError, ValueError):
            return default
        return value if value > 0 else default

    @staticmethod
    def _positive_int(raw: Any, default: int) -> int:
        try:
            value = int(raw)
        except (TypeError, ValueError):
            return default
        return value if value >= 1 else 1
