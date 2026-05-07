"""任务终态的单一事实来源。"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Mapping

from app.core.entity.message.server_message import TaskStatus
from app.i18n import i18n

_COMMON_MESSAGES_CATEGORY = "common.messages"


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
) -> FinalTaskState:
    """构建终态对象。"""
    return FinalTaskState(
        code=code,
        vendor_message=vendor_message,
        status_code=status_code,
        custom_message=custom_message,
        i18n_params=dict(i18n_params or {}),
    )


def render_final_task_state_message(final_task_state: FinalTaskState | None) -> str | None:
    """渲染终态展示文案。"""
    if final_task_state is None:
        return None

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
    "FinalTaskStateCode",
    "FinalTaskState",
    "build_final_task_state",
    "render_final_task_state_message",
]
