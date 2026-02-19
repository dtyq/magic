"""Skill Read References Tool - 读取 skill 的 reference 文档内容"""
from app.i18n import i18n
from typing import Any, Dict, List, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.tools.core import BaseTool, BaseToolParams, tool
from app.core.skill_manager import get_global_skill_manager, find_skill
from agentlang.skills.exceptions import SkillNotFoundError, SkillResourceError

logger = get_logger(__name__)


class SkillReadReferencesParams(BaseToolParams):
    """Skill Read References 工具参数"""
    skill_name: str = Field(
        ...,
        description="""<!--zh: 要读取 reference 的 skill 名称，例如：designing-canvas-images-->
The name of the skill to read references from, e.g., designing-canvas-images"""
    )
    references: List[str] = Field(
        ...,
        description="""<!--zh: 要读取的 reference 文件列表（相对于 skill 目录下的 reference 目录），例如：["image-generation.md", "image-search.md"]-->
The list of reference files to read (relative to the skill's reference directory), e.g., ["image-generation.md", "image-search.md"]""",
        min_length=1
    )


@tool()
class SkillReadReferences(BaseTool[SkillReadReferencesParams]):
    """<!--zh
    读取 skill 的 reference 文档内容工具
    用于批量加载 skill 的参考文档，这些文档通常包含详细的使用指南、示例和最佳实践

    强烈建议在需要读取多个 reference 文档时使用此工具一次性读取，而非多次调用工具逐个读取，这将会极大提升任务效率
    -->
    Tool for reading skill reference documentation content
    Used to batch load skill reference documents, which typically contain detailed usage guides, examples, and best practices

    Strongly recommended to use this tool for batch reading multiple reference documents at once, rather than calling tools multiple times individually, which will greatly improve task efficiency
    """

    async def execute(self, tool_context: ToolContext, params: SkillReadReferencesParams) -> ToolResult:
        """执行批量读取 reference 文档逻辑

        Args:
            tool_context: 工具上下文
            params: 参数对象，包含 skill_name 和 references 列表

        Returns:
            ToolResult: 工具执行结果
        """
        if not params.references:
            error_msg = "references 列表不能为空"
            return ToolResult(
                ok=False,
                content=error_msg
            )

        try:
            skill = await find_skill(params.skill_name)

            if not skill:
                error_msg = f"未找到名为 '{params.skill_name}' 的 skill。\n\n可用的 skills 请查看 system prompt 中的 <available_skills> 列表。"
                return ToolResult(
                    ok=False,
                    content=error_msg
                )

            # 获取全局 SkillManager（后续 get_reference_content 需要）
            skill_manager = get_global_skill_manager()

            # 检查 skill 是否有 reference 目录
            ref_dir = await skill.get_reference_dir()
            if not ref_dir:
                error_msg = f"Skill '{params.skill_name}' 没有 reference 目录"
                return ToolResult(
                    ok=False,
                    content=error_msg
                )

            # 批量读取所有 reference 文件
            results = []
            success_count = 0
            failure_count = 0
            failed_references = []

            for ref_file in params.references:
                try:
                    # 处理路径：如果包含 reference/ 前缀，则去掉
                    # 兼容两种情况：
                    # 1. 直接文件名：image-generation.md
                    # 2. 完整路径：reference/image-generation.md
                    normalized_ref_file = ref_file
                    if ref_file.startswith("reference/"):
                        normalized_ref_file = ref_file[len("reference/"):]
                    elif ref_file.startswith("./reference/"):
                        normalized_ref_file = ref_file[len("./reference/"):]

                    # 使用 SkillManager 的 get_reference_content 方法读取文件
                    content = await skill_manager.get_reference_content(params.skill_name, normalized_ref_file)

                    # 构建单个 reference 的输出
                    # 显示原始传入的路径，但实际读取的是标准化后的文件名
                    ref_output_parts = [f"Loading: {ref_file}", f"From skill: {params.skill_name}", "", content]

                    ref_content = "\n".join(ref_output_parts)

                    results.append({
                        "reference": ref_file,
                        "success": True,
                        "content": ref_content
                    })
                    success_count += 1
                    logger.info(f"成功读取 reference: {params.skill_name}/{ref_file}")

                except SkillResourceError as e:
                    error_msg = f"未找到 reference 文件: {ref_file}"
                    results.append({
                        "reference": ref_file,
                        "success": False,
                        "error": error_msg
                    })
                    failure_count += 1
                    failed_references.append(ref_file)
                    logger.warning(f"Reference 文件不存在: {params.skill_name}/{ref_file}")

                except Exception as e:
                    logger.error(f"读取 reference '{ref_file}' 时出错: {e}")
                    import traceback
                    logger.error(traceback.format_exc())

                    error_msg = f"读取 reference '{ref_file}' 失败: {str(e)}"
                    results.append({
                        "reference": ref_file,
                        "success": False,
                        "error": error_msg
                    })
                    failure_count += 1
                    failed_references.append(ref_file)

            # 构建最终输出
            output_parts = []

            # 添加摘要信息
            total_count = len(params.references)
            summary_parts = [f"批量读取 skill '{params.skill_name}' 的 {total_count} 个 reference 文档"]
            if success_count > 0:
                summary_parts.append(f"成功: {success_count}")
            if failure_count > 0:
                summary_parts.append(f"失败: {failure_count}")
            output_parts.append(" | ".join(summary_parts))
            output_parts.append("")  # 空行

            # 如果有失败的 references，先列出失败信息
            if failed_references:
                output_parts.append("失败的 reference 文档:")
                for result in results:
                    if not result["success"]:
                        output_parts.append(f"  - {result['reference']}: {result['error']}")
                output_parts.append("")  # 空行

            # 添加成功的 reference 内容
            first_success = True
            for result in results:
                if result["success"]:
                    # 如果不是第一个成功的 reference，添加分隔符
                    if not first_success:
                        output_parts.append("")
                        output_parts.append("=" * 80)
                        output_parts.append("")
                    first_success = False

                    output_parts.append(result["content"])

            content = "\n".join(output_parts)

            # 如果全部失败，返回错误
            if success_count == 0:
                return ToolResult(
                    ok=False,
                    content=content
                )

            return ToolResult(
                ok=True,
                content=content
            )

        except SkillNotFoundError:
            error_msg = f"未找到名为 '{params.skill_name}' 的 skill。\n\n可用的 skills 请查看 system prompt 中的 <available_skills> 列表。"
            return ToolResult(
                ok=False,
                content=error_msg
            )

        except Exception as e:
            logger.error(f"批量读取 skill '{params.skill_name}' 的 references 时出错: {e}")
            import traceback
            logger.error(traceback.format_exc())

            error_msg = f"批量读取 skill '{params.skill_name}' 的 references 失败: {str(e)}"
            return ToolResult(
                ok=False,
                content=error_msg
            )

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        if not arguments:
            return i18n.translate("skill_read_references.success", category="tool.messages")

        skill_name = arguments.get("skill_name", "")
        references = arguments.get("references", [])
        ref_count = len(references)

        if ref_count == 1:
            ref_name = references[0] if references else ""
            if skill_name and ref_name:
                return i18n.translate("skill_read_references.success_single", category="tool.messages", skill_name=f"{skill_name}/{ref_name}")
            elif skill_name:
                return i18n.translate("skill_read_references.success_single", category="tool.messages", skill_name=skill_name)
        else:
            if skill_name:
                return i18n.translate("skill_read_references.success_multiple", category="tool.messages", skill_name=skill_name, count=ref_count)

        return i18n.translate("skill_read_references.success", category="tool.messages")

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None
    ) -> Dict:
        """获取工具调用后的友好动作和备注"""
        if not result.ok:
            # 获取 skill 名称和 reference 用于错误消息
            skill_name = arguments.get("skill_name", "") if arguments else ""
            references = arguments.get("references", []) if arguments else []
            ref_name = references[0] if references else ""

            if skill_name and ref_name:
                remark = i18n.translate("skill_read_references.error_with_name", category="tool.messages", skill_name=f"{skill_name}/{ref_name}")
            elif skill_name:
                remark = i18n.translate("skill_read_references.error_with_name", category="tool.messages", skill_name=skill_name)
            else:
                remark = i18n.translate("skill_read_references.error", category="tool.messages")

            return {
                "action": i18n.translate(tool_name, category="tool.actions"),
                "remark": remark
            }

        return {
            "action": i18n.translate(tool_name, category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }
