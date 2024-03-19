"""
反思工具模块

提供深度自我反思和问题识别功能，帮助代理发现并纠正执行过程中的问题和偏差。
"""

from app.i18n import i18n
from typing import Any, Dict

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.tools.core import BaseTool, BaseToolParams, tool


class ReflectionParams(BaseToolParams):
    task_review: str = Field(
        ...,
        description="""<!--zh: 回顾任务要求，我遗漏了什么-->
Review task requirements, what did I miss"""
    )
    system_prompt_review: str = Field(
        ...,
        description="""<!--zh: 回顾系统提示词，我忘记遵循了什么-->
Review system prompts, what did I forget to follow"""
    )
    mistakes_identified: str = Field(
        ...,
        description="""<!--zh: 我一定做错了，我做错了什么-->
I must have made mistakes, what did I do wrong"""
    )
    loop_detection: str = Field(
        ...,
        description="""<!--zh: 我是否反复陷入死循环，需要换个思路-->
Am I repeatedly stuck in a loop, need to change approach"""
    )
    time_management: str = Field(
        ...,
        description="""<!--zh: 我是否在这个任务花费了太长时间，我该如何在保证质量的前提下用更少的工具调用来尽快完成-->
Am I spending too long on this task, how can I complete it faster with fewer tool calls while maintaining quality"""
    )
    remedial_measures: str = Field(
        ...,
        description="""<!--zh: 综上我可以做哪些简单有效的补救措施-->
What simple and effective remedial measures can I take based on the above"""
    )


@tool()
class Reflection(BaseTool[ReflectionParams]):
    """<!--zh
    反思工具，用于深度自我反思和问题识别

    通过系统性的自我审视来发现执行过程中的问题、偏差和改进机会。

    使用此工具进行深度反思时，请诚实地:
    1. 检查是否完全理解并执行了任务要求
    2. 审视是否严格遵循了系统提示词的指导
    3. 识别可能存在的错误和偏差
    4. 评估是否陷入了重复性的思维循环
    5. 评估时间使用效率和紧迫性
    6. 制定具体可行的补救措施

    适用场景：任务执行偏差纠正、问题诊断、效率优化、质量改进等。
    -->
    Reflection tool for deep self-reflection and problem identification

    Discover problems, deviations, and improvement opportunities in execution process through systematic self-examination.

    When using this tool for deep reflection, honestly:
    1. Check if fully understood and executed task requirements
    2. Review if strictly followed system prompt guidance
    3. Identify potential errors and deviations
    4. Evaluate if trapped in repetitive thinking loops
    5. Evaluate time usage efficiency and urgency
    6. Formulate specific feasible remedial measures

    Applicable scenarios: Task execution deviation correction, problem diagnosis, efficiency optimization, quality improvement, etc.
    """

    async def execute(self, tool_context: ToolContext, params: ReflectionParams) -> ToolResult:
        """
        执行反思过程并返回结果

        Args:
            tool_context: 工具上下文
            params: 反思工具参数

        Returns:
            ToolResult: 包含反思过程和补救建议的工具结果
        """
        # 构建格式化输出
        output = []

        # 添加最终指导
        output.append("**请按照你所总结的补救措施，以最小代价完成补救**")

        # 返回结果
        return ToolResult(
            name=self.name,
            content="\n".join(output),
        )

    async def get_before_tool_call_friendly_content(self, tool_context: ToolContext, arguments: Dict[str, Any] = None) -> str:
        """
        获取工具调用前的友好内容
        """
        return "开始进行深度反思分析，识别问题并提升执行效率与质量"



    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        return i18n.translate("reflection.success", category="tool.messages")

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
                "action": i18n.translate("reflection", category="tool.actions"),
                "remark": i18n.translate("reflection.error", category="tool.messages", error=result.content)
            }

        return {
            "action": i18n.translate("reflection", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }
