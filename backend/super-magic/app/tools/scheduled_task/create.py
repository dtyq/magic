"""创建定时任务的 Code Mode 工具。"""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.infrastructure.sdk.magic_service.parameter.message_schedule_parameter import (
    MessageScheduleParameter,
)
from app.tools.core import BaseToolParams, tool
from app.tools.scheduled_task._base import BaseScheduledTaskTool


class ScheduledTaskCreateParams(BaseToolParams):
    """创建定时任务的参数。"""

    task_name: str = Field(..., description="""<!--zh: 任务名称。-->Scheduled task name.""")
    message_content: Any = Field(
        ...,
        description="""<!--zh: 任务指令内容。可传纯文本字符串，或 Tiptap JSONContent 对象。-->
Task instruction content. Pass plain text or a Tiptap JSONContent object.""",
    )
    schedule_type: Literal["no_repeat", "daily_repeat", "weekly_repeat", "monthly_repeat"] = Field(
        ...,
        description="""<!--zh: 调度类型。no_repeat 需要 day=YYYY-MM-DD；weekly_repeat 需要 day=0-6（0=周一…6=周日，见 day 字段说明）；monthly_repeat 需要 day=1-31。-->
Schedule type. no_repeat requires day=YYYY-MM-DD; weekly_repeat requires day=0-6 (0=Monday ... 6=Sunday, see the day field); monthly_repeat requires day=1-31.""",
    )
    time: str = Field(..., description="""<!--zh: 执行时间，格式 HH:MM。-->Execution time in HH:MM format.""")
    day: Optional[str | int] = Field(
        None,
        description="""<!--zh: 日期/星期/日号，含义随 schedule_type 不同。请传字符串，如 "2"（传整数也会被自动转为字符串）。daily_repeat 不需要。
weekly_repeat 的星期映射：0=周一，1=周二，2=周三，3=周四，4=周五，5=周六，6=周日。-->
Date, weekday, or day-of-month depending on schedule_type. Pass it as a quoted string such as "2" (integers are coerced to string). Not needed for daily_repeat.
weekly_repeat weekday mapping: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday.""",
    )
    deadline: Optional[str] = Field(
        None,
        description="""<!--zh: 重复任务截止时间，格式 YYYY-MM-DD HH:MM:SS；仅日期会补为 00:00:00。-->
Optional expiry datetime for recurring tasks. YYYY-MM-DD is normalized to 00:00:00.""",
    )
    specify_topic: Literal[0, 1] = Field(
        0,
        description="""<!--zh: 是否绑定当前话题。仅周期任务且后续执行依赖前次结果时传 1，其他情况保持 0。-->
Whether to bind the current topic. Use 1 only for recurring tasks whose later runs depend on previous results.""",
    )
    agent_mode: Optional[str] = Field(
        None,
        description="""<!--zh: 运行定时任务的员工模式。默认使用当前运行模式。仅当用户主动指定时传入；内置值包括 magic、slider、data-analyst、design、audio。非内置值会作为自定义员工 identifier/code 处理。-->
Agent mode for the scheduled run. Defaults to the current running mode. Pass only when the user explicitly asks for a mode. Built-ins: magic, slider, data-analyst, design, audio. Other values are treated as custom employee identifiers/codes.""",
    )


@tool(name="scheduled_task_create")
class ScheduledTaskCreate(BaseScheduledTaskTool[ScheduledTaskCreateParams]):
    """<!--zh: 创建 magic-service 定时任务。-->
    Create a magic-service scheduled task."""

    name = "scheduled_task_create"

    async def execute(self, tool_context: ToolContext, params: ScheduledTaskCreateParams) -> ToolResult:
        """创建定时任务。"""
        try:
            message_content, message_type = self.parse_message_content(params.message_content)
            default_agent_mode = self.resolve_current_agent_mode(tool_context)
            topic_pattern, agent_code, resolved_agent_mode = self.resolve_agent_mode(
                params.agent_mode,
                default_agent_mode,
            )
            parameter = MessageScheduleParameter(
                task_name=params.task_name,
                message_content=message_content,
                time_config=self.build_time_config(params.schedule_type, params.time, params.day),
                topic_id=self.resolve_topic_id(tool_context),
                model_id=self.resolve_model_id(tool_context),
                deadline=self.normalize_deadline(params.deadline),
                specify_topic=params.specify_topic,
                topic_pattern=topic_pattern,
                agent_code=agent_code,
                message_type=message_type,
            )
            result = await self.magic_service_sdk().message_schedule.create_message_schedule_async(parameter)
            return self.success_result({"id": result.get_schedule_id(), "agent_mode": resolved_agent_mode})
        except Exception as exc:
            return ToolResult.error(
                f"scheduled_task_create failed: {exc}",
                extra_info={"user_error": str(exc)},
            )
