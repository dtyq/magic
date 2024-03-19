"""
Todo Update 工具 - 更新已存在的todo项状态
"""
from app.i18n import i18n
from typing import Any, Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field, field_validator
from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.tools.core import BaseTool, BaseToolParams, tool
from app.core.entity.todo import TodoItem, TodoStatus
from app.service.todo_service import TodoService
from app.core.entity.message.server_message import ToolDetail, DisplayType, TodoContent, TodoOperationType
from app.core.entity.event.event_context import EventContext

logger = get_logger(__name__)


class TodoUpdateItem(BaseModel):
    """Todo更新项模型"""
    id: str = Field(..., description="要更新的todo项ID")
    status: TodoStatus = Field(..., description="新的任务状态")


class TodoUpdateParams(BaseToolParams):
    updates: List[TodoUpdateItem] = Field(
        ...,
        description="""<!--zh: 要更新的todo项列表，每项包含id和新的status-->
List of todo items to update, each contains id and new status""",
        min_length=1
    )

    @field_validator('updates')
    @classmethod
    def validate_updates(cls, v: List[TodoUpdateItem]) -> List[TodoUpdateItem]:
        """验证更新列表"""
        if len(v) < 1:
            raise ValueError("至少需要更新1个任务项")

        # 检查ID唯一性（不允许重复更新同一个ID）
        ids = [item.id for item in v]
        if len(ids) != len(set(ids)):
            raise ValueError("不能重复更新同一个todo项")

        # 检查是否会导致多个in_progress状态
        in_progress_count = sum(1 for item in v if item.status == TodoStatus.IN_PROGRESS)
        if in_progress_count > 1:
            raise ValueError("不能同时将多个任务设置为进行中状态")

        return v


@tool()
class TodoUpdate(BaseTool[TodoUpdateParams]):
    """<!--zh
    更新已存在的todo任务项状态

    用于更新任务状态，跟踪任务进度。只能更新已存在任务的状态。

    **使用场景**:
    - 开始执行某个任务时，将其状态改为 in_progress
    - 完成任务后，将其状态改为 completed
    - 取消不再需要的任务时，将其状态改为 cancelled
    - 需要重置任务状态时

    **任务状态**:
    - pending: 未开始
    - in_progress: 进行中(同时只能有一个)
    - completed: 已完成
    - cancelled: 已取消

    **重要约束**:
    - 只能更新已存在的任务
    - 只能修改任务的status字段
    - 同时只能有一个任务处于in_progress状态
    - 完成任务后应立即标记为completed
    -->
    Update existing todo task item status

    Used to update task status and track progress. Can only update status of existing tasks.

    **Use scenarios**:
    - When starting a task, change status to in_progress
    - After completing task, change status to completed
    - When cancelling no-longer-needed task, change status to cancelled
    - When need to reset task status

    **Task status**:
    - pending: Not started
    - in_progress: In progress (only one at a time)
    - completed: Completed
    - cancelled: Cancelled

    **Important constraints**:
    - Can only update existing tasks
    - Can only modify task's status field
    - Only one task can be in in_progress status at a time
    - Should mark as completed immediately after finishing task
    """

    async def execute(self, tool_context: ToolContext, params: TodoUpdateParams) -> ToolResult:
        """执行更新操作

        Args:
            tool_context: 工具上下文
            params: 包含更新列表的参数

        Returns:
            ToolResult: 操作结果
        """
        # 从文件加载现有todos
        existing_todos = await TodoService.load_todos()

        if not existing_todos:
            return ToolResult.error("当前没有任何todo项，无法更新")

        # 创建id到todo的映射
        todo_map = {todo.id: todo for todo in existing_todos}

        # 检查所有要更新的ID是否存在
        update_ids = {item.id for item in params.updates}
        not_found_ids = update_ids - set(todo_map.keys())
        if not_found_ids:
            return ToolResult.error(f"以下ID不存在: {', '.join(not_found_ids)}")

        # 检查更新后是否会有多个in_progress状态
        # 找出所有不会被更新的in_progress任务
        unchanged_in_progress = [
            todo for todo in existing_todos
            if todo.id not in update_ids and todo.status == TodoStatus.IN_PROGRESS
        ]
        # 找出将要被设置为in_progress的任务
        new_in_progress = [
            item for item in params.updates
            if item.status == TodoStatus.IN_PROGRESS
        ]

        if len(unchanged_in_progress) + len(new_in_progress) > 1:
            return ToolResult.error("同时只能有一个任务处于进行中状态")

        # 执行更新
        updated_count = 0
        for update_item in params.updates:
            todo = todo_map[update_item.id]
            # 只更新status和updated_at
            todo.status = update_item.status
            todo.updated_at = datetime.now()
            updated_count += 1

        # 保存到文件
        save_success = await TodoService.save_todos(existing_todos)
        if not save_success:
            return ToolResult.error("保存todo到文件失败")

        # 标记 todos 已变化
        event_context = tool_context.get_extension_typed("event_context", EventContext)
        if event_context:
            event_context.todos_changed = True

        # 统计各状态数量
        status_counts = {
            TodoStatus.PENDING: sum(1 for t in existing_todos if t.status == TodoStatus.PENDING),
            TodoStatus.IN_PROGRESS: sum(1 for t in existing_todos if t.status == TodoStatus.IN_PROGRESS),
            TodoStatus.COMPLETED: sum(1 for t in existing_todos if t.status == TodoStatus.COMPLETED),
            TodoStatus.CANCELLED: sum(1 for t in existing_todos if t.status == TodoStatus.CANCELLED),
        }

        # 格式化返回消息
        total = len(existing_todos)
        status_summary = ", ".join([
            f"{count}个{status}"
            for status, count in [
                ("进行中", status_counts[TodoStatus.IN_PROGRESS]),
                ("待处理", status_counts[TodoStatus.PENDING]),
                ("已完成", status_counts[TodoStatus.COMPLETED]),
                ("已取消", status_counts[TodoStatus.CANCELLED])
            ] if count > 0
        ])

        content = f"已更新{updated_count}个任务: 共{total}个任务 ({status_summary})"

        return ToolResult(
            content=content,
        )

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        """获取工具详情

        Args:
            tool_context: 工具上下文
            result: 工具执行结果
            arguments: 工具参数

        Returns:
            Optional[ToolDetail]: 工具详情
        """
        if not result.ok or not arguments:
            return None

        updates = arguments.get("updates", [])

        # 转换更新项为字典格式
        items = []
        for update in updates:
            if isinstance(update, dict):
                items.append(update)
            elif hasattr(update, "model_dump"):
                items.append(update.model_dump())

        return ToolDetail(
            type=DisplayType.TODO,
            data=TodoContent(
                type=TodoOperationType.UPDATE,
                items=items
            )
        )

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None) -> Dict:
        """
        获取工具调用后的友好动作和备注

        Args:
            tool_name: 工具名称
            tool_context: 工具上下文
            result: 工具执行结果
            execution_time: 执行耗时
            arguments: 执行参数

        Returns:
            Dict: 包含action和remark的字典
        """
        if not result.ok:
            return {
                "action": i18n.translate("todo_update", category="tool.actions"),
                "remark": i18n.translate("tool.error", category="tool.messages", error=result.content)
            }

        # 从参数中获取更新的任务数量
        updates_count = 0
        if arguments and "updates" in arguments:
            updates = arguments["updates"]
            updates_count = len(updates) if isinstance(updates, list) else 1

        remark = f"更新{updates_count}个任务" if updates_count > 0 else "更新任务列表"

        return {
            "action": i18n.translate("todo_update", category="tool.actions"),
            "remark": remark
        }
