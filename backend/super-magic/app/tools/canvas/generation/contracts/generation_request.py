"""生成请求模型。"""

from dataclasses import dataclass, field
from typing import Awaitable, Callable

from app.tools.canvas.application.commands import GenerationParameters

# 外部任务建单成功后的回调：(任务 id, 预期完成时间 ISO 8601, 任务发起时间 ISO 8601)。
#
# 放在请求上而不是端口上：端口是进程内单例，挂 per-request 状态会并发互相覆盖；
# 请求对象本身就是一次提交的载体，回调跟着它走。端口不支持时忽略即可。
TaskCreatedCallback = Callable[[str, str | None, str | None], Awaitable[None]]


@dataclass(frozen=True)
class GenerationRequest:
    """提交一次生成所需的最小请求。"""

    project_path: str
    element_id: str
    content_id: str
    element_type: str
    parameters: GenerationParameters = field(default_factory=GenerationParameters)
    on_task_created: TaskCreatedCallback | None = None
