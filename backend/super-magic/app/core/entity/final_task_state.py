"""任务终态的单一事实来源。"""

from dataclasses import dataclass, field
from enum import Enum, StrEnum
from typing import Mapping

from app.core.entity.message.server_message import TaskStatus
from app.i18n import i18n

_COMMON_MESSAGES_CATEGORY = "common.messages"


class ModelErrorCode(StrEnum):
    TIMEOUT = "llm_timeout"
    CONNECTION_FAILED = "llm_connection_failed"
    RATE_LIMITED = "llm_rate_limited"
    SERVICE_ERROR = "llm_service_error"
    CONFIG_ERROR = "llm_config_error"
    REQUEST_REJECTED = "llm_request_rejected"


class ModelRecoveryAction(StrEnum):
    SWITCH_MODEL_AND_RETRY = "switch_model_and_retry"
    RETRY = "retry"


@dataclass(frozen=True)
class ModelErrorDefinition:
    i18n_key: str
    actions: tuple[ModelRecoveryAction, ...]


_SWITCH_MODEL = (ModelRecoveryAction.SWITCH_MODEL_AND_RETRY,)
_RETRY_MODEL = (*_SWITCH_MODEL, ModelRecoveryAction.RETRY)
MODEL_ERROR_DEFINITIONS: Mapping[ModelErrorCode, ModelErrorDefinition] = {
    ModelErrorCode.TIMEOUT: ModelErrorDefinition("messages.llm_provider_timeout", _RETRY_MODEL),
    ModelErrorCode.CONNECTION_FAILED: ModelErrorDefinition("messages.llm_provider_connection_failed", _RETRY_MODEL),
    ModelErrorCode.RATE_LIMITED: ModelErrorDefinition("messages.llm_provider_rate_limited", _RETRY_MODEL),
    ModelErrorCode.SERVICE_ERROR: ModelErrorDefinition("messages.llm_provider_error", _RETRY_MODEL),
    ModelErrorCode.CONFIG_ERROR: ModelErrorDefinition("messages.llm_provider_config_error", _SWITCH_MODEL),
    ModelErrorCode.REQUEST_REJECTED: ModelErrorDefinition("messages.llm_provider_request_rejected", _SWITCH_MODEL),
}


@dataclass(frozen=True)
class ModelError:
    """模型错误的公开语义；诊断异常和渠道信息不进入此对象。"""

    code: ModelErrorCode
    model_id: str | None = None
    model_name: str | None = None

    def to_payload(self) -> dict[str, object]:
        # 例：专属压缩模型失败只有原因；主会话模型失败才提供切换、重试动作。
        payload: dict[str, object] = {"code": self.code.value, "actions": []}
        if self.model_id:
            subject: dict[str, str] = {"type": "text_model", "model_id": self.model_id}
            if self.model_name:
                subject["model_name"] = self.model_name
            payload["subject"] = subject
            payload["actions"] = [
                {"type": action.value} for action in MODEL_ERROR_DEFINITIONS[self.code].actions
            ]
        return payload

    def render_message(self) -> str:
        return i18n.translate(
            MODEL_ERROR_DEFINITIONS[self.code].i18n_key,
            category=_COMMON_MESSAGES_CATEGORY,
        )


class FinalTaskStateCode(str, Enum):
    """终态码枚举。"""

    _task_status: TaskStatus
    _i18n_key: str

    def __new__(cls, value: str, task_status: TaskStatus, i18n_key: str) -> "FinalTaskStateCode":
        obj = str.__new__(cls, value)
        obj._value_ = value
        obj._task_status = task_status
        obj._i18n_key = i18n_key
        return obj

    @property
    def task_status(self) -> TaskStatus:
        return self._task_status

    @property
    def i18n_key(self) -> str:
        return self._i18n_key

    CONTEXT_WINDOW_EXCEEDED = (
        "context_window_exceeded",
        TaskStatus.ERROR,
        "messages.context_window_exceeded",
    )
    INSUFFICIENT_POINTS = (
        "insufficient_points",
        TaskStatus.SUSPENDED,
        "messages.insufficient_points",
    )
    CONSUMPTION_ROUNDS_LIMIT_EXCEEDED = (
        "consumption_rounds_limit_exceeded",
        TaskStatus.SUSPENDED,
        "messages.consumption_rounds_limit_exceeded",
    )
    TASK_CONCURRENCY_LIMIT_EXCEEDED = (
        "task_concurrency_limit_exceeded",
        TaskStatus.SUSPENDED,
        "messages.task_concurrency_limit_exceeded",
    )
    USER_INTERRUPTED = (
        "user_interrupted",
        TaskStatus.SUSPENDED,
        "messages.user_interrupted",
    )
    SESSION_RESTORE_FAILED = (
        "session_restore_failed",
        TaskStatus.ERROR,
        "messages.session_restore_failed",
    )
    AGENT_NOT_INITIALIZED = (
        "agent_not_initialized",
        TaskStatus.ERROR,
        "messages.agent_not_initialized",
    )
    AGENT_LOAD_FAILED = (
        "agent_load_failed",
        TaskStatus.ERROR,
        "messages.agent_load_failed",
    )
    INTERNAL_DISPATCH_FAILED = (
        "internal_dispatch_failed",
        TaskStatus.ERROR,
        "messages.internal_dispatch_failed",
    )
    MESSAGE_PROCESSING_FAILED = (
        "message_processing_failed",
        TaskStatus.ERROR,
        "messages.message_processing_failed",
    )


@dataclass
class FinalTaskState:
    """任务终态数据。"""

    code: FinalTaskStateCode
    vendor_message: str = ""
    status_code: int | None = None
    custom_message: str | None = None
    i18n_params: dict[str, object] = field(default_factory=dict)
    model_error: ModelError | None = None

    @property
    def task_status(self) -> TaskStatus:
        return self.code.task_status


def build_final_task_state(
    code: FinalTaskStateCode,
    *,
    vendor_message: str = "",
    status_code: int | None = None,
    custom_message: str | None = None,
    i18n_params: Mapping[str, object] | None = None,
    model_error: ModelError | None = None,
) -> FinalTaskState:
    """构建终态对象。"""
    return FinalTaskState(
        code=code,
        vendor_message=vendor_message,
        status_code=status_code,
        custom_message=custom_message,
        i18n_params=dict(i18n_params or {}),
        model_error=model_error,
    )


def render_final_task_state_message(final_task_state: FinalTaskState | None) -> str | None:
    """渲染终态展示文案。"""
    if final_task_state is None:
        return None

    if final_task_state.model_error is not None:
        return final_task_state.model_error.render_message()

    if final_task_state.custom_message:
        return final_task_state.custom_message

    if final_task_state.vendor_message:
        return final_task_state.vendor_message

    return i18n.translate(
        final_task_state.code.i18n_key,
        category=_COMMON_MESSAGES_CATEGORY,
        **final_task_state.i18n_params,
    )


__all__ = [
    "ModelError",
    "ModelErrorCode",
    "FinalTaskStateCode",
    "FinalTaskState",
    "build_final_task_state",
    "render_final_task_state_message",
]
