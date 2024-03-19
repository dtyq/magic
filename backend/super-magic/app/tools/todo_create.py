"""
Todo Create 工具 - 创建新的todo项
"""
from app.i18n import i18n
from typing import Any, Dict, List, Optional
from datetime import datetime
from pydantic import Field, field_validator
from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.tools.core import BaseTool, BaseToolParams, tool
from app.core.entity.todo import TodoItem, TodoStatus
from app.service.todo_service import TodoService
from app.core.entity.message.server_message import ToolDetail, DisplayType, TodoContent, TodoOperationType
from app.core.entity.event.event_context import EventContext

logger = get_logger(__name__)


class TodoCreateParams(BaseToolParams):
    todos: List[TodoItem] = Field(
        ...,
        description="""<!--zh: 要创建的todo项数组-->
Array of todo items to create""",
        min_length=1
    )

    @field_validator('todos')
    @classmethod
    def validate_todos(cls, v: List[TodoItem]) -> List[TodoItem]:
        """验证todos列表"""
        if len(v) < 1:
            raise ValueError("至少需要1个任务项")

        # 检查ID唯一性（只在传入的列表内检查）
        ids = [todo.id for todo in v]
        if len(ids) != len(set(ids)):
            raise ValueError("todo项的ID必须唯一")

        # 检查是否只有一个in_progress状态
        in_progress_count = sum(1 for todo in v if todo.status == TodoStatus.IN_PROGRESS)
        if in_progress_count > 1:
            raise ValueError("同时只能有一个任务处于进行中状态")

        return v


@tool()
class TodoCreate(BaseTool[TodoCreateParams]):
    """<!--zh
    创建新的todo任务项

    用于创建新的任务列表。该工具会将新任务追加到现有任务列表中。

    **使用场景**:
    - 开始新的任务规划时
    - 用户提出新的任务需求时
    - 需要添加新的待办事项时

    **任务状态**:
    - pending: 未开始
    - in_progress: 进行中(同时只能有一个)
    - completed: 已完成
    - cancelled: 已取消

    **ID格式**:
    - 创建新任务时,使用从最大ID+1开始的连续数字作为id
    - 如果当前没有任务,从"1"开始
    - ID必须在当前任务列表中唯一
    -->
    Create new todo task items

    Used to create new task list. This tool appends new tasks to existing task list.

    **Use scenarios**:
    - Starting new task planning
    - User proposes new task requirements
    - Need to add new todo items

    **Task status**:
    - pending: Not started
    - in_progress: In progress (only one at a time)
    - completed: Completed
    - cancelled: Cancelled

    **ID format**:
    - When creating new tasks, use consecutive numbers starting from max ID + 1
    - If no tasks exist, start from "1"
    - ID must be unique within current task list
    """

    async def execute(self, tool_context: ToolContext, params: TodoCreateParams) -> ToolResult:
        """执行创建操作

        Args:
            tool_context: 工具上下文
            params: 包含todos列表的参数

        Returns:
            ToolResult: 操作结果
        """
        # 从文件加载现有todos
        existing_todos = await TodoService.load_todos()

        # 检查新todo的ID是否与现有ID冲突
        existing_ids = {todo.id for todo in existing_todos}
        for new_todo in params.todos:
            if new_todo.id in existing_ids:
                return ToolResult.error(f"ID '{new_todo.id}' 已存在，无法创建")

        # 检查是否存在多个in_progress状态（包括现有的）
        existing_in_progress = sum(1 for t in existing_todos if t.status == TodoStatus.IN_PROGRESS)
        new_in_progress = sum(1 for t in params.todos if t.status == TodoStatus.IN_PROGRESS)
        if existing_in_progress + new_in_progress > 1:
            return ToolResult.error("同时只能有一个任务处于进行中状态")

        # 追加新todos
        final_todos = existing_todos + params.todos

        # 更新时间戳
        for todo in params.todos:
            todo.created_at = datetime.now()
            todo.updated_at = datetime.now()

        # 保存到文件
        save_success = await TodoService.save_todos(final_todos)
        if not save_success:
            return ToolResult.error("保存todo到文件失败")

        # 标记 todos 已变化
        event_context = tool_context.get_extension_typed("event_context", EventContext)
        if event_context:
            event_context.todos_changed = True

        # 统计各状态数量
        status_counts = {
            TodoStatus.PENDING: sum(1 for t in final_todos if t.status == TodoStatus.PENDING),
            TodoStatus.IN_PROGRESS: sum(1 for t in final_todos if t.status == TodoStatus.IN_PROGRESS),
            TodoStatus.COMPLETED: sum(1 for t in final_todos if t.status == TodoStatus.COMPLETED),
            TodoStatus.CANCELLED: sum(1 for t in final_todos if t.status == TodoStatus.CANCELLED),
        }

        # 格式化返回消息
        total = len(final_todos)
        status_summary = ", ".join([
            f"{count}个{status}"
            for status, count in [
                ("进行中", status_counts[TodoStatus.IN_PROGRESS]),
                ("待处理", status_counts[TodoStatus.PENDING]),
                ("已完成", status_counts[TodoStatus.COMPLETED]),
                ("已取消", status_counts[TodoStatus.CANCELLED])
            ] if count > 0
        ])

        content = f"已创建{len(params.todos)}个新任务: 共{total}个任务 ({status_summary})"

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

        todos = arguments.get("todos", [])

        # 转换 todo 项为字典格式
        items = []
        for todo in todos:
            if isinstance(todo, dict):
                items.append(todo)
            elif hasattr(todo, "model_dump"):
                items.append(todo.model_dump())

        return ToolDetail(
            type=DisplayType.TODO,
            data=TodoContent(
                type=TodoOperationType.CREATE,
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
                "action": i18n.translate("todo_create", category="tool.actions"),
                "remark": i18n.translate("tool.error", category="tool.messages", error=result.content)
            }

        # 从参数中获取创建的任务数量
        todos_count = 0
        if arguments and "todos" in arguments:
            todos = arguments["todos"]
            todos_count = len(todos) if isinstance(todos, list) else 1

        remark = f"创建{todos_count}个任务" if todos_count > 0 else "创建任务列表"

        return {
            "action": i18n.translate("todo_create", category="tool.actions"),
            "remark": remark
        }
