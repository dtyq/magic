from app.i18n import i18n
from typing import Any, Dict, List, Optional

from pydantic import Field
from agentlang.utils.datetime_formatter import get_current_datetime_str

from app.core.context.agent_context import AgentContext
from agentlang.context.tool_context import ToolContext
from app.core.entity.factory.tool_detail_factory import ToolDetailFactory
from app.core.entity.message.server_message import ToolDetail
from agentlang.tools.tool_result import ToolResult
from agentlang.llms.factory import LLMFactory
from agentlang.logger import get_logger
from app.core.entity.tool.tool_result_types import DeepWriteToolResult
from app.tools.core import BaseTool, BaseToolParams, tool
from app.tools.read_file import ReadFile, ReadFileParams

logger = get_logger(__name__)


class DeepWriteParams(BaseToolParams):
    query: str = Field(
        ...,
        description="""<!--zh: 需要进行深度写作的主题或要求，详细描述清楚写作需求、文章风格、目标受众等-->
Topic or requirements for deep writing, describe writing needs, article style, target audience in detail"""
    )
    reference_files: List[str] = Field(
        ...,
        description="""<!--zh: 参考文件路径列表，至少需要3个文件，这些文件的内容将作为写作素材和依据，确保内容的准确性和深度-->
Reference file path list, requires at least 3 files. Content of these files will serve as writing materials and basis to ensure content accuracy and depth"""
    )


@tool()
class DeepWrite(BaseTool[DeepWriteParams]):
    """<!--zh
    深度写作工具，用于生成高质量、有深度的文章和内容。

    适用于包括但不限于以下场景：
    - 创作专业文章、报告和分析内容
    - 编写营销文案、公众号文章和博客内容
    - 生成多角度、有深度的观点和论证
    - 整合参考资料形成连贯、专业的内容

    要求：
    - 所有内容必须基于参考文件，不要虚构内容，不要编造事实，不要生成没有根据的结论
    - 参考文件数量需不少于3个，以确保内容的可靠性和多元视角

    调用示例：
    ```
    {
        "query": "请根据参考文件，生成一篇关于 AI 的 Markdown 文章，微信公众号风格，内容深刻富有见地",
        "reference_files": ["./webview_report/file1.md", "./webview_report/file2.md", "./webview_report/file3.md"]
    }
    ```

    注意事项：
    - 若参考信息不足以支撑完成任务，该工具会返回相应的提示信息，请根据提示信息调整参考文件或修改写作需求
    -->
    Deep writing tool for generating high-quality, in-depth articles and content.

    Applicable to but not limited to following scenarios:
    - Create professional articles, reports, and analytical content
    - Write marketing copy, social media articles, and blog content
    - Generate multi-perspective, in-depth viewpoints and arguments
    - Integrate reference materials to form coherent, professional content

    Requirements:
    - All content must be based on reference files, don't fabricate content, don't make up facts, don't generate unfounded conclusions
    - Reference files must be no less than 3 to ensure content reliability and diverse perspectives

    Usage example:
    ```
    {
        "query": "Based on reference files, generate a Markdown article about AI with profound insights",
        "reference_files": ["./webview_report/file1.md", "./webview_report/file2.md", "./webview_report/file3.md"]
    }
    ```

    Notes:
    - If reference information is insufficient to support task completion, tool will return corresponding prompt. Adjust reference files or modify writing requirements based on prompt
    """

    async def execute(
        self,
        tool_context: ToolContext,
        params: DeepWriteParams
    ) -> ToolResult:
        """执行深度写作并返回格式化的结果。

        本方法基于参考资料生成高质量的写作内容，通过两轮处理确保内容的质量与准确性：
        1. 第一轮：基于参考资料生成初始内容
        2. 第二轮：事实核查和内容完善

        Args:
            tool_context: 工具上下文
            params: 深度写作参数对象，包含主题需求和参考文件列表

        Returns:
            DeepWriteToolResult: 包含深度写作结果的工具结果，包括最终内容和写作过程
        """
        try:
            # 获取参数
            query = params.query
            reference_files = params.reference_files or []

            # 检查文件数量
            if len(reference_files) < 3:
                error_msg = "为确保深度写作的结果有可靠的来源依据，参考文件的数量不得小于三个，建议使用 list_dir 工具查看工作区，获取足够的信息源后再进行深度写作"
                logger.warning(f"深度写作中止：{error_msg} (提供了 {len(reference_files)} 个文件)")
                return DeepWriteToolResult.error(error_msg)

            # Get configuration from AI ability config
            from app.core.ai_abilities import AIAbility, get_ability_config

            model_id = get_ability_config(
                AIAbility.DEEP_WRITE,
                "model_id",
                default="deepseek-reasoner"
            )
            temperature = get_ability_config(
                AIAbility.DEEP_WRITE,
                "temperature",
                default=0.7
            )

            # 记录深度写作请求
            logger.info(f"执行深度写作: 查询={query}, 文件数量={len(reference_files)}, 模型={model_id}")

            # 处理参考文件
            reference_materials = ""
            if reference_files:
                reference_materials = await self._process_reference_files(tool_context, reference_files)

            # 获取并格式化当前时间上下文
            current_time_str = get_current_datetime_str()

            # context_info 包含第一个分隔符
            context_info = f'当前上下文信息:\n当前时间: {current_time_str} (处理涉及"今年"、"近期"、"当下"、"最近"、"现在"等时间相关表述时，必须以当前时间为准进行推算和理解，例如，当问题是"今年股价表现"时，应理解为从当前时间所在年份的股价表现)\n\n---\n\n'

            # 定义提示语
            prompt_text = "请完全根据参考资料输出内容，严禁杜撰信息、严禁虚构内容、严禁虚假引用，严禁编造内容，严禁编造名人名言，所有内容都需要有来源出处引用标注，且所有引用都要来源于参考资料！！！参考资料中会有元数据信息，写明了网页的标题和来源，因此引用标注可以是一个 Markdown 链接，如：引用自[《网页标题》](网页URL)！"

            # 创建查询部分列表
            query_parts = []

            # 添加开头的提示语
            query_parts.append(prompt_text + "\n\n---\n\n")

            # 添加上下文信息
            query_parts.append(context_info)

            # 如果有参考资料，添加资料和它后面的分隔符
            if reference_materials:
                query_parts.append(f"参考材料（请充分利用）：\n{reference_materials}\n\n---\n\n")

            # 添加用户问题
            query_parts.append(f"用户问题：{query}")

            # 在末尾再次添加提示语
            query_parts.append("\n\n---\n\n再次强调：" + prompt_text + "你需要一步一步思考，是否所有内容都是基于已有的参考资料与事实生成的，再完成你的深度写作。")

            full_query = "".join(query_parts) # 将所有部分连接起来

            # 构建深度写作消息
            # 注意: deepseek-reasoner 模型不支持系统提示词，所有提示内容必须放在用户消息中
            messages = [
                {
                    "role": "user",
                    "content": full_query
                }
            ]

            # 第一轮：请求模型进行深度写作
            logger.info("开始第一轮深度写作...")
            response = await LLMFactory.call_with_tool_support(
                model_id=model_id,
                messages=messages,
                tools=None,  # 不需要工具支持
                stop=None,
                agent_context=tool_context.get_extension_typed("agent_context", AgentContext)
            )

            # 处理响应
            if not response or not response.choices or len(response.choices) == 0:
                return DeepWriteToolResult.error("没有从模型收到有效响应")

            # 获取模型原生的深度写作内容和结论
            message = response.choices[0].message
            first_round_reasoning_content = getattr(message, "reasoning_content", "")
            # 如果模型没有返回推理内容，使用空字符串
            if not first_round_reasoning_content:
                first_round_reasoning_content = ""
            first_round_content = message.content

            # 第二轮：检查内容真实性
            logger.info("开始第二轮反思...")

            # 注意: deepseek-reasoner 模型不支持系统提示词，因此将系统角色描述放在用户提示开头
            system_content = "你是一个严格的事实核查员，你的任务是确保内容完全基于参考资料，不含任何虚构内容。"

            reflection_query = f"""{system_content}

我需要你仔细检查以下内容是否完全基于参考资料，不包含任何虚构、编造或不实信息，并输出最终修正后的内容。

参考材料：
{reference_materials}

第一轮生成内容：
{first_round_content}

请对比参考资料和生成内容，详细检查是否存在不在参考资料中的虚构内容：
1. 如果内容完全基于参考资料，请直接返回原内容
2. 如果有少量虚构内容，请去除这些内容并修正
3. 如果有大量虚构内容，请重写整个内容，确保完全基于参考资料
4. 如果参考资料不足以支撑完成任务，请明确指出信息不足，不要尝试编造内容

直接输出最终修正后的内容或者进行信息不足说明。
注意！第一轮的生成内容不会被返回给用户，用户不知道有第一轮的存在，所以你输出的内容必须是完整的最终内容。
不要只提建议，要输出完整的最终内容。"""

            reflection_messages = [
                {
                    "role": "user",
                    "content": reflection_query
                }
            ]

            reflection_response = await LLMFactory.call_with_tool_support(
                model_id=model_id,
                messages=reflection_messages,
                tools=None,
                stop=None,
                agent_context=tool_context.get_extension_typed("agent_context", AgentContext)
            )

            if not reflection_response or not reflection_response.choices or len(reflection_response.choices) == 0:
                # 如果第二轮失败，返回第一轮结果
                logger.warning("反思过程失败，返回第一轮结果")
                result = DeepWriteToolResult(content=first_round_content)
                if first_round_reasoning_content:
                    result.set_reasoning_content(first_round_reasoning_content)
                return result

            # 处理第二轮结果
            reflection_message = reflection_response.choices[0].message
            reflection_content = reflection_message.content

            # 使用整个反思结果作为最终内容
            final_content = reflection_content

            # 创建结果
            result = DeepWriteToolResult(content=final_content)

            # 将第一轮的深度写作过程和第二轮的反思过程合并为完整的深度写作过程
            combined_reasoning = ""
            if first_round_reasoning_content:
                combined_reasoning += f"【第一轮深度写作】\n{first_round_reasoning_content}\n\n"
            combined_reasoning += f"【反思过程】\n{reflection_content}"

            result.set_reasoning_content(combined_reasoning)

            return result

        except Exception as e:
            logger.exception(f"深度写作操作失败: {e!s}")
            return DeepWriteToolResult.error("Deep write operation failed")

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        """
        生成工具详情，用于前端展示

        Args:
            tool_context: 工具上下文
            result: 工具结果
            arguments: 工具参数

        Returns:
            Optional[ToolDetail]: 工具详情
        """
        if not result.content:
            return None

        try:
            if not isinstance(result, DeepWriteToolResult):
                return None

            if not result.ok:
                return None

            # 返回结构化数据用于前端展示
            return ToolDetailFactory.create_deep_write_detail(
                title="深度写作结果",
                reasoning_content=result.reasoning_content or "无深度写作过程",
                content=result.content
            )
        except Exception as e:
            logger.error(f"生成工具详情失败: {e!s}")
            return None



    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        if not arguments or "query" not in arguments:
            return i18n.translate("deep_write.success", category="tool.messages")

        query = arguments["query"]
        # 截取问题前100个字符作为备注，防止过长
        short_query = query[:100] + "..." if len(query) > 100 else query
        return i18n.translate("deep_write.question", category="tool.messages", question=short_query)

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None) -> Dict:
        """获取工具调用后的友好动作和备注"""
        if not result.ok:
            return {
                "action": i18n.translate("deep_write", category="tool.actions"),
                "remark": i18n.translate("deep_write.error", category="tool.messages", error=result.content)
            }

        return {
            "action": i18n.translate("deep_write", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }

    async def _process_reference_files(self, tool_context: ToolContext, reference_files: List[str]) -> str:
        """处理参考文件，使用 ReadFile 工具读取内容并格式化

        Args:
            tool_context: 工具上下文
            reference_files: 参考文件路径列表

        Returns:
            str: 格式化后的参考材料内容
        """
        reference_content = []
        read_file_tool = ReadFile()

        for i, file_path in enumerate(reference_files, 1):
            try:
                # 使用 ReadFile 工具读取文件内容
                read_file_params = ReadFileParams(
                    file_path=file_path,
                    should_read_entire_file=True
                )

                # @FIXME: 使用不依赖 tool_context 的方法来调用
                result = await read_file_tool.execute(tool_context, read_file_params)

                if result.ok:
                    content = result.content
                    # 提取文件名
                    file_name = file_path.split('/')[-1]
                    reference_content.append(f"[文件{i}: {file_name}]\n{content}")
                else:
                    logger.error(f"读取参考文件 {file_path} 失败: {result.content}")
                    reference_content.append(f"[文件{i}: {file_path}] 读取失败: {result.content}")
            except Exception as e:
                logger.error(f"处理参考文件 {file_path} 时发生异常: {e}")
                reference_content.append(f"[文件{i}: {file_path}] 处理异常: {e!s}")

        # 用分隔线连接所有参考内容
        if reference_content:
            return "\n\n---\n\n".join(reference_content)
        return ""
