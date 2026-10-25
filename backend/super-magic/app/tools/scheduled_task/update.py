"""更新定时任务的 Code Mode 工具。"""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.infrastructure.sdk.magic_service.parameter.message_schedule_parameter import (
    UpdateMessageScheduleParameter,
)
from app.tools.core import BaseToolParams, tool
from app.tools.scheduled_task._base import BaseScheduledTaskTool


class ScheduledTaskUpdateParams(BaseToolParams):
    """更新定时任务的参数。"""

    id: str = Field(..., description="""<!--zh: 定时任务 ID。-->Scheduled task ID.""")
    task_name: Optional[str] = Field(None, description="""<!--zh: 新任务名称。-->New task name.""")
    message_content: Optional[Any] = Field(
        None,
        description="""<!--zh: 新任务指令内容。可传纯文本字符串，或 Tiptap JSONContent 对象。-->
New task instruction content. Pass plain text or a Tiptap JSONContent object.""",
    )
    schedule_type: Optional[Literal["no_repeat", "daily_repeat", "weekly_repeat", "monthly_repeat"]] = Field(
        None,
        description="""<!--zh: 新调度类型。修改时间配置时必须和 time 同时传。-->
New schedule type. Must be passed together with time when updating time_config.""",
    )
    time: Optional[str] = Field(None, description="""<!--zh: 新执行时间，格式 HH:MM。-->New execution time in HH:MM format.""")
    day: Optional[str | int] = Field(
        None,
        description="""<!--zh: 新日期/星期/日号。请传字符串，如 "2"（传整数也会被自动转为字符串）。weekly_repeat 的星期映射：0=周一，1=周二，2=周三，3=周四，4=周五，5=周六，6=周日。-->
New date, weekday, or day-of-month. Pass it as a quoted string such as "2" (integers are coerced to string). weekly_repeat weekday mapping: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday.""",
    )
    deadline: Optional[str] = Field(
        None,
        description="""<!--zh: 新截止时间，格式 YYYY-MM-DD HH:MM:SS；仅日期会补为 00:00:00。-->
New expiry datetime. YYYY-MM-DD is normalized to 00:00:00.""",
    )
    enabled: Optional[Literal[0, 1]] = Field(None, description="""<!--zh: 1=启用，0=禁用。-->1=enable, 0=disable.""")


@tool(name="scheduled_task_update")
class ScheduledTaskUpdate(BaseScheduledTaskTool[ScheduledTaskUpdateParams]):
    """<!--zh: 更新 magic-service 定时任务。-->
    Update one magic-service scheduled task."""

    name = "scheduled_task_update"

    async def execute(self, tool_context: ToolContext, params: ScheduledTaskUpdateParams) -> ToolResult:
        """更新定时任务。"""
        try:
            has_type = params.schedule_type is not None
            has_time = params.time is not None
            if has_type != has_time:
                raise ValueError("schedule_type and time must be provided together")
            if params.day is not None and not has_type:
                raise ValueError("day can only be updated together with schedule_type and time")

            time_config = None
            if has_type and params.schedule_type is not None and params.time is not None:
                time_config = self.build_time_config(params.schedule_type, params.time, params.day)

            message_content = None
            message_type = None
            if params.message_content is not None:
                message_content, message_type = self.parse_message_content(params.message_content)

            normalized_deadline = self.normalize_deadline(params.deadline) if params.deadline is not None else None
            if (
                params.task_name is None
                and message_content is None
                and time_config is None
                and params.deadline is None
                and params.enabled is None
            ):
                raise ValueError("at least one update field is required")

            parameter = UpdateMessageScheduleParameter(
                schedule_id=params.id,
                task_name=params.task_name,
                message_content=message_content,
                time_config=time_config,
                deadline=normalized_deadline,
                enabled=params.enabled,
                message_type=message_type,
            )
            result = await self.magic_service_sdk().message_schedule.update_message_schedule_async(parameter)
            return self.success_result({"id": result.get_schedule_id()})
        except Exception as exc:
            return ToolResult.error(
                f"scheduled_task_update failed: {exc}",
                extra_info={"user_error": str(exc)},
            )
