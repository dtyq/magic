"""启动任务的定义、运行状态与错误类型。"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

ErrorContextValue = str | int | bool | None


class StartupTaskRunStatus(StrEnum):
    """
    本进程内的运行结果，只存在内存里，进程重启后全部回到 NOT_STARTED。
    启动任务只关心「这次沙盒启动有没有装好」，不需要跨进程的历史状态。
    """

    NOT_STARTED = "not_started"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    TIMED_OUT = "timed_out"
    SKIPPED_DISABLED = "skipped_disabled"
    # 任务文件记录的 project_id 与当前项目不一致：可能是复制、导入或分享带进来的别人的脚本
    SKIPPED_UNTRUSTED = "skipped_untrusted"


@dataclass(slots=True)
class StartupTask:
    """`.workspace/.magic/startup/<task_id>.md` 的内容；task_id 即文件名。"""

    task_id: str
    name: str
    enabled: bool
    workdir: str  # 相对 .workspace 的目录，"." 表示工作区根目录
    timeout_seconds: int
    project_id: str  # 用户确认这个任务时所在的项目；空字符串表示当时没有项目身份
    script: str


@dataclass(slots=True)
class StartupTaskRunState:
    status: StartupTaskRunStatus = StartupTaskRunStatus.NOT_STARTED
    background_task_id: str | None = None  # 转入后台后才有，可用 shell_await 查看输出
    exit_code: int | None = None
    output_tail: str = ""  # 在前台观察窗口内就结束时，保存截断后的输出
    started_at: float | None = None
    finished_at: float | None = None


@dataclass(frozen=True, slots=True)
class StartupTaskSettings:
    default_timeout_seconds: int
    max_timeout_seconds: int
    background_after_seconds: int


class StartupTaskError(ValueError):
    """带稳定错误码的服务异常；工具层按 code 生成模型说明和用户文案。"""

    def __init__(self, code: str, message: str, **context: ErrorContextValue) -> None:
        super().__init__(message)
        self.code = code
        self.context = context
