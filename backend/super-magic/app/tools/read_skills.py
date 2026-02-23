"""Read Skills Tool - 批量读取项目 skills 的完整内容"""

from pathlib import Path

from app.i18n import i18n
from typing import Any, Dict, List, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.tools.core import BaseTool, BaseToolParams, tool
from app.core.skill_manager import get_global_skill_manager, find_skill

logger = get_logger(__name__)


class ReadSkillsParams(BaseToolParams):
    """Read Skills 工具参数"""

    skill_names: List[str] = Field(
        ...,
        description="""<!--zh: 要读取的 skill 名称列表，例如：["canvas-design", "audio-chat"]-->
The list of skill names to read, e.g., ["canvas-design", "audio-chat"]""",
        min_length=1,
    )


@tool()
class ReadSkills(BaseTool[ReadSkillsParams]):
    """<!--zh
    批量读取项目 skills 的完整内容工具
    用于一次性加载多个 skill 的详细使用说明、示例和参考文档

    强烈建议在需要读取多个 skills 时使用此工具一次性读取，而非多次调用工具逐个读取，这将会极大提升任务效率
    -->
    Tool for batch reading the complete content of project skills
    Used to load detailed skill instructions, examples, and reference documentation for multiple skills at once

    Strongly recommended to use this tool for batch reading multiple skills at once, rather than calling tools multiple times individually, which will greatly improve task efficiency
    """

    async def execute(self, tool_context: ToolContext, params: ReadSkillsParams) -> ToolResult:
        """执行批量读取工具逻辑

        Args:
            tool_context: 工具上下文
            params: 参数对象，包含 skill_names 列表

        Returns:
            ToolResult: 工具执行结果
        """
        if not params.skill_names:
            error_msg = "skill_names 列表不能为空"
            return ToolResult(ok=False, content=error_msg)

        try:
            # 批量读取所有 skills
            results = []
            success_count = 0
            failure_count = 0
            failed_skills = []

            for skill_name in params.skill_names:
                try:
                    skill = await find_skill(skill_name)

                    if not skill:
                        error_msg = f"未找到名为 '{skill_name}' 的 skill"
                        results.append({"skill_name": skill_name, "success": False, "error": error_msg})
                        failure_count += 1
                        failed_skills.append(skill_name)
                        logger.warning(f"Skill 不存在: {skill_name}")
                        continue

                    # 构建单个 skill 的输出，使用 XML 标签包裹
                    skill_output_parts = [
                        f"Loading: {skill.name}",
                        "",
                        f'<skill_content name="{skill.name}">',
                    ]

                    location = skill.skill_file or skill.skill_dir
                    skill_dir = skill.skill_dir or (str(Path(skill.skill_file).parent) if skill.skill_file else None)
                    if location:
                        skill_output_parts.append(f"<location>{location}</location>")
                    if skill_dir:
                        skill_output_parts.append(f"<skill_dir>{skill_dir}</skill_dir>")
                    if location or skill_dir:
                        skill_output_parts.append("")

                    skill_output_parts += [skill.content, "</skill_content>"]

                    skill_content = "\n".join(skill_output_parts)

                    results.append({"skill_name": skill_name, "success": True, "content": skill_content})
                    success_count += 1
                    logger.info(f"成功读取 skill: {skill_name}")

                except Exception as e:
                    logger.error(f"读取 skill '{skill_name}' 时出错: {e}")
                    import traceback

                    logger.error(traceback.format_exc())

                    error_msg = f"读取 skill '{skill_name}' 失败: {str(e)}"
                    results.append({"skill_name": skill_name, "success": False, "error": error_msg})
                    failure_count += 1
                    failed_skills.append(skill_name)

            # 构建最终输出
            output_parts = []

            # 判断是否只有一个 skill
            total_count = len(params.skill_names)
            is_single_skill = total_count == 1 and success_count == 1

            # 只有在多个 skills 时才添加摘要信息
            if not is_single_skill:
                summary_parts = [f"批量读取 {total_count} 个 skills"]
                if success_count > 0:
                    summary_parts.append(f"成功: {success_count}")
                if failure_count > 0:
                    summary_parts.append(f"失败: {failure_count}")
                output_parts.append(" | ".join(summary_parts))
                output_parts.append("")  # 空行

            # 如果有失败的 skills，先列出失败信息
            if failed_skills:
                output_parts.append("失败的 skills:")
                for result in results:
                    if not result["success"]:
                        output_parts.append(f"  - {result['skill_name']}: {result['error']}")
                output_parts.append("")  # 空行

            # 添加成功的 skills 内容
            first_success = True
            for result in results:
                if result["success"]:
                    # 如果不是第一个成功的 skill 且不是单个 skill，添加分隔符
                    if not first_success and not is_single_skill:
                        output_parts.append("")
                        output_parts.append("=" * 80)
                        output_parts.append("")
                    first_success = False

                    output_parts.append(result["content"])

            content = "\n".join(output_parts)

            # 如果全部失败，返回错误
            if success_count == 0:
                result = ToolResult(ok=False, content=content)
                result.use_custom_remark = True
                return result

            return ToolResult(ok=True, content=content)

        except Exception as e:
            logger.error(f"批量读取 skills 时出错: {e}")
            import traceback

            logger.error(traceback.format_exc())

            error_msg = f"批量读取 skills 失败: {str(e)}"
            result = ToolResult(ok=False, content=error_msg)
            result.use_custom_remark = True
            return result

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        if not arguments or "skill_names" not in arguments:
            return i18n.translate("read_skills.success", category="tool.messages")

        skill_names = arguments["skill_names"]
        skill_count = len(skill_names)

        if skill_count == 1:
            skill_name = skill_names[0]
            return i18n.translate("read_skills.success_single", category="tool.messages", skill_name=skill_name)
        else:
            main_skill = skill_names[0]
            return i18n.translate(
                "read_skills.success_multiple", category="tool.messages", skill_name=main_skill, count=skill_count
            )

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        """获取工具调用后的友好动作和备注"""
        if not result.ok:
            # 获取 skill 名称用于错误消息
            skill_names = arguments.get("skill_names", []) if arguments else []
            skill_name = skill_names[0] if skill_names else ""

            if skill_name:
                remark = i18n.translate("read_skills.error_with_name", category="tool.messages", skill_name=skill_name)
            else:
                remark = i18n.translate("read_skills.error", category="tool.messages")

            return {"action": i18n.translate(tool_name, category="tool.actions"), "remark": remark}

        return {
            "action": i18n.translate(tool_name, category="tool.actions"),
            "remark": self._get_remark_content(result, arguments),
        }
