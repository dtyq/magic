"""
Todo Read 工具 - 读取当前todo列表
"""
from app.i18n import i18n
from typing import Any, Dict, Optional
from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.tools.core import BaseTool, BaseToolParams, tool
from app.core.context.agent_context import AgentContext
from app.service.todo_service import TodoService

logger = get_logger(__name__)


class TodoReadParams(BaseToolParams):
    pass


@tool()
class TodoRead(BaseTool[TodoReadParams]):
    """<!--zh
    读取当前会话的todo列表

    用于查看当前任务列表的状态,跟踪进度。

    使用场景:
    - 会话开始时查看待办事项
    - 开始新任务前检查优先级
    - 用户询问之前的任务或计划时
    - 不确定下一步做什么时
    - 完成任务后了解剩余工作

    该工具无需参数,返回所有todo项及其状态、优先级和内容。
    -->
    Read current session's todo list

    Used to view current task list status and track progress.

    Use scenarios:
    - View todo items at session start
    - Check priorities before starting new task
    - When user asks about previous tasks or plans
    - When unsure what to do next
    - Understand remaining work after completing tasks

    This tool requires no parameters, returns all todo items with their status, priority, and content.
    """

    async def execute(self, tool_context: ToolContext, params: TodoReadParams) -> ToolResult:
        """执行读取操作

        Args:
            tool_context: 工具上下文
            params: 工具参数(空)

        Returns:
            ToolResult: 包含todo列表的结果
        """
        # 从文件读取
        todos = await TodoService.load_todos()
        logger.debug(f"从文件加载了 {len(todos)} 个todo项")

        content = TodoService.format_todos_simple(todos)

        return ToolResult(
            content=content,
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
                "action": i18n.translate("todo_read", category="tool.actions"),
                "remark": i18n.translate("tool.error", category="tool.messages", error=result.content)
            }

        return {
            "action": i18n.translate("todo_read", category="tool.actions"),
            "remark": "查看任务列表"
        }
