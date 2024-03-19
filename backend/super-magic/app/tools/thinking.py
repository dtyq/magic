"""
思考工具模块

提供基于Chain-of-Thought(CoT)的深度思考和规划功能，帮助代理进行推理和决策。
"""

from app.i18n import i18n
import json
from typing import Any, Dict, List, Optional

from pydantic import Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.tools.core import BaseTool, BaseToolParams, tool


class ThinkingParams(BaseToolParams):
    problem: str = Field(
        ...,
        description="""<!--zh: 需要思考的问题或挑战，应明确表述核心疑问-->
Problem or challenge to think about, should clearly state core question"""
    )
    thinking: str = Field(
        ...,
        description="""<!--zh: 对问题的思考过程和分析，包括背景、上下文、观察以及思考的推理过程-->
Thinking process and analysis of problem, including background, context, observations, and reasoning process"""
    )
    steps: str = Field(
        ...,
        description="""<!--zh: 思考的步骤列表，JSON格式字符串，每个步骤包含title和content字段，例如：[{\"title\": \"步骤1\", \"content\": \"详细分析\"}]-->
Thinking steps list, JSON format string, each step contains title and content fields. Example: [{"title": "Step 1", "content": "Detailed analysis"}]"""
    )
    target: str = Field(
        ...,
        description="""<!--zh: 思考的目标结果，如结论、解决方案、行动计划或决策建议-->
Thinking target result, such as conclusion, solution, action plan, or decision recommendation"""
    )

    @field_validator('steps', mode='before')
    @classmethod
    def validate_steps(cls, v):
        """验证并转换steps参数，支持JSON字符串格式"""
        if isinstance(v, str):
            try:
                # 尝试解析JSON字符串
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    # 验证每个步骤都有title和content字段
                    for i, step in enumerate(parsed):
                        if not isinstance(step, dict):
                            raise ValueError(f"步骤{i+1}必须是对象格式")
                        if 'title' not in step or 'content' not in step:
                            raise ValueError(f"步骤{i+1}必须包含title和content字段")
                    return v  # 返回原始字符串，保持简单
                else:
                    raise ValueError("steps参数解析后不是列表格式")
            except json.JSONDecodeError as e:
                raise ValueError(f"steps参数不是有效的JSON格式: {e}")
        elif isinstance(v, list):
            # 如果是Python列表，转换为JSON字符串
            try:
                # 验证列表格式
                for i, step in enumerate(v):
                    if not isinstance(step, dict):
                        raise ValueError(f"步骤{i+1}必须是对象格式")
                    if 'title' not in step or 'content' not in step:
                        raise ValueError(f"步骤{i+1}必须包含title和content字段")
                return json.dumps(v, ensure_ascii=False)
            except Exception as e:
                raise ValueError(f"steps列表格式错误: {e}")
        else:
            raise ValueError(f"steps参数必须是字符串或列表，当前类型: {type(v)}")

    @classmethod
    def get_custom_error_message(cls, field_name: str, error_type: str) -> Optional[str]:
        """提供自定义错误消息"""
        if field_name == "steps" and "type" in error_type:
            return "参数 'steps' 应为JSON字符串格式，例如：[{\"title\": \"步骤1\", \"content\": \"详细分析\"}]"
        return None


@tool()
class Thinking(BaseTool[ThinkingParams]):
    """<!--zh
    思考工具，用于基于提供的上下文进行深度推理和规划

    通过Chain-of-Thought(CoT)方法进行深度思考和分析。

    使用此工具可以系统地分析复杂问题、制定计划或评估方案。工具接收您的深度思考过程，并将其结构化呈现。

    当面对复杂问题时，请:
    1. 明确定义问题和思考目标
    2. 拆分为多个子问题或思考步骤
    3. 逐步推理，每步都展示详细的推理过程和清晰的中间结论
    4. 考虑多个视角、假设和约束条件
    5. 评估各种可能性和潜在影响
    6. 整合所有步骤的结论，形成最终建议

    适用场景：复杂决策分析、项目规划、问题根因分析、风险评估、方案比较等。
    -->
    Thinking tool for deep reasoning and planning based on provided context

    Perform deep thinking and analysis through Chain-of-Thought (CoT) method.

    Use this tool to systematically analyze complex problems, formulate plans, or evaluate solutions. Tool receives your deep thinking process and presents it in structured form.

    When facing complex problems:
    1. Clearly define problem and thinking objectives
    2. Break down into multiple sub-problems or thinking steps
    3. Reason step by step, each step shows detailed reasoning process and clear intermediate conclusions
    4. Consider multiple perspectives, assumptions, and constraints
    5. Evaluate various possibilities and potential impacts
    6. Integrate conclusions from all steps to form final recommendations

    Applicable scenarios: Complex decision analysis, project planning, problem root cause analysis, risk assessment, solution comparison, etc.
    """

    async def execute(self, tool_context: ToolContext, params: ThinkingParams) -> ToolResult:
        """
        执行思考过程并返回结果

        Args:
            tool_context: 工具上下文
            params: 思考工具参数

        Returns:
            ToolResult: 包含思考过程和结论的工具结果
        """

        # 返回结果
        return ToolResult(
            name=self.name,
            content="请基于你的思考结果继续执行你的任务"
        )

    async def get_before_tool_call_friendly_content(self, tool_context: ToolContext, arguments: Dict[str, Any] = None) -> str:
        """
        获取工具调用前的友好内容
        """
        problem = arguments.get("problem", "") if arguments else ""
        thinking = arguments.get("thinking", "") if arguments else ""

        if problem and thinking:
            return i18n.translate("thinking.start_deep_thinking", category="tool.messages", problem=f"{problem}，{thinking}")
        elif problem:
            return i18n.translate("thinking.start_deep_thinking", category="tool.messages", problem=problem)
        else:
            return arguments["explanation"]



    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        if not arguments or "problem" not in arguments:
            return i18n.translate("thinking.unknown_problem", category="tool.messages")

        problem = arguments["problem"]
        # 截断过长的问题描述
        if len(problem) > 100:
            problem = problem[:100] + "..."

        return problem

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
                "action": i18n.translate("thinking", category="tool.actions"),
                "remark": i18n.translate("thinking.error", category="tool.messages", error=result.content)
            }

        return {
            "action": i18n.translate("thinking", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        """
        根据工具执行结果获取对应的ToolDetail

        Args:
            tool_context: 工具上下文
            result: 工具执行的结果
            arguments: 工具执行的参数字典

        Returns:
            Optional[ToolDetail]: 工具详情对象，可能为None
        """
        if not result.ok:
            return None

        if not arguments or "problem" not in arguments:
            return None

        # 构建 Markdown 格式的思考内容
        markdown_content = self._build_markdown_content(arguments)

        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(
                file_name="思考分析.md",
                content=markdown_content
            )
        )

    def _build_markdown_content(self, arguments: Dict[str, Any]) -> str:
        """
        构建 Markdown 格式的思考内容

        Args:
            arguments: 工具执行参数

        Returns:
            str: Markdown 格式的内容
        """
        problem = arguments["problem"]
        thinking = arguments["thinking"]
        steps_str = arguments["steps"]
        target = arguments["target"]

        # 解析steps字符串为列表
        try:
            steps = json.loads(steps_str)
        except (json.JSONDecodeError, TypeError):
            steps = []

        content = []

        # 标题
        content.append("# 思考分析")
        content.append("")

        # 问题部分
        content.append("## 问题")
        content.append(problem)
        content.append("")

        # 思考过程
        content.append("## 思考过程")
        content.append(thinking)
        content.append("")

        # 分析步骤
        content.append("## 分析步骤")
        content.append("")
        for i, step in enumerate(steps, 1):
            title = step.get("title", f"步骤 {i}")
            step_content = step.get("content", "")
            content.append(f"### 第{i}步: {title}")
            if step_content:
                content.append(step_content)
            content.append("")

        # 结论
        content.append("## 结论")
        content.append(target)
        content.append("")

        return "\n".join(content)
