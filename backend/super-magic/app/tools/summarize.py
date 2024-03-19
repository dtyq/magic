from app.i18n import i18n
from typing import Any, Dict, Optional

from pydantic import Field
from agentlang.utils.datetime_formatter import get_current_datetime_str

from agentlang.utils.token_estimator import truncate_text_by_token
from agentlang.context.tool_context import ToolContext
from app.core.entity.message.server_message import ToolDetail, DisplayType, FileContent
from agentlang.tools.tool_result import ToolResult
from agentlang.llms.factory import LLMFactory
from agentlang.logger import get_logger
from app.tools.core import BaseTool, BaseToolParams, tool
from app.tools.read_file import ReadFile, ReadFileParams

logger = get_logger(__name__)

# 默认最大 Token 数
DEFAULT_MAX_TOKENS = 10000


class SummarizeParams(BaseToolParams):
    file_path: str = Field(
        ...,
        description="""<!--zh: 需要进行信息精炼的文件路径-->
File path requiring information refinement"""
    )
    requirements: str = Field(
        default="无",
        description="""<!--zh: 指导如何进行信息精炼的要求-->
Requirements guiding how to refine information"""
    )
    target_length: int = Field(
        default=200,
        description="""<!--zh: 精炼后的目标长度（xxx 字左右）-->
Target length after refinement (approximately xxx characters)"""
    )

@tool()
class Summarize(BaseTool[SummarizeParams]):
    """<!--zh
    信息精炼工具，用于提升文本的信息密度，剔除冗余内容，使其更结构化。

    适用于包括但不限于以下场景：
    - 长篇文章的信息密度提升
    - 研究论文的结构化整理
    - 会议记录的信息精炼
    - 新闻文章的冗余剔除
    - 技术文档的精准表达

    核心理念：
    - 保留原文所有重要信息、数据、细节
    - 通过优化表达方式提升信息密度
    - 剔除无用的冗余内容和重复表述
    - 保持原文风格，增强结构化程度
    - 用更短的篇幅传达更多的信息

    调用示例：
    ```
    {
    -->
    Information refinement tool for enhancing text information density, eliminating redundant content, making it more structured.

    Applicable to but not limited to following scenarios:
    - Enhance information density of long articles
    - Structured organization of research papers
    - Information refinement of meeting minutes
    - Redundancy elimination of news articles
    - Precise expression of technical documentation

    Core concepts:
    - Retain all important information, data, details from original text
    - Enhance information density by optimizing expression methods
    - Eliminate useless redundant content and repetitive statements
    - Maintain original text style, enhance structuredness
    - Convey more information in shorter length

    Usage example:
    ```
    {
        "file_path": "./webview_report/article.md",
        "target_length": 300
    }
    ```
    """

    async def execute(
        self,
        tool_context: ToolContext,
        params: SummarizeParams
    ) -> ToolResult:
        return await self.execute_purely(params, tool_context)

    async def execute_purely(
        self,
        params: SummarizeParams,
        tool_context: Optional[ToolContext] = None
    ) -> ToolResult:
        """执行信息精炼并返回结果。

        Args:
            tool_context: 工具上下文
            params: 信息精炼参数对象

        Returns:
            ToolResult: 包含精炼结果的工具结果
        """
        try:
            # 获取参数
            file_path = params.file_path
            target_length = params.target_length

            # 记录信息精炼请求
            logger.info(f"执行信息精炼: 文件路径={file_path}, 要求={params.requirements or '无'}, 目标长度={target_length}")

            # 读取文件内容
            file_content = await self._read_file(file_path)
            if not file_content:
                return ToolResult(error=f"无法读取文件: {file_path}")

            # 提取文件名用于显示
            file_name = file_path.split('/')[-1]

            # 调用内部方法处理信息精炼
            summary_content = await self.summarize_content(
                content=file_content,
                title=file_name,
                requirements=params.requirements,
                target_length=target_length,
            )

            if not summary_content:
                return ToolResult(error="信息精炼失败")

            # 创建结果
            result = ToolResult(
                content=f"## 信息精炼: {file_name}\n\n{summary_content}",
                extra_info={"file_path": file_path, "file_name": file_name}
            )

            return result

        except Exception as e:
            logger.exception(f"信息精炼操作失败: {e!s}")
            return ToolResult(error="Summarization failed")

    async def summarize_content(
        self,
        content: str,
        title: str = "文档",
        requirements: str = "",
        target_length: int = 200,
        model_id: Optional[str] = None
    ) -> Optional[str]:
        """直接对文本内容进行信息精炼，无需文件读取

        Args:
            content: 需要进行信息精炼的文本内容
            title: 内容标题
            requirements: 精炼要求
            target_length: 精炼后目标长度
            model_id: 使用的模型ID，如果未指定则从配置获取

        Returns:
            Optional[str]: 精炼后的内容，失败则返回None

        Note:
            - 精炼过程会自动遵循用户偏好语言设置
            - 如果用户手动设置了语言，将使用该语言进行精炼
            - 如果未设置语言，将根据原文的主要语言进行精炼
            - 内容长度小于目标长度时，直接返回原文内容
        """
        try:
            # Get model_id from configuration if not provided
            if model_id is None:
                from app.core.ai_abilities import AIAbility, get_ability_config
                model_id = get_ability_config(
                    AIAbility.SUMMARIZE,
                    "model_id",
                    default="qwen-flash"
                )

            # 在这里进行截断
            truncated_content, is_truncated = truncate_text_by_token(content, DEFAULT_MAX_TOKENS)
            if is_truncated:
                logger.warning(f"待精炼内容被截断: title='{title}', original_length={len(content)}, truncated_length={len(truncated_content)}")

            # 检查内容长度，如果小于等于目标长度则直接返回原文
            if len(truncated_content) <= target_length:
                logger.info(f"原文长度({len(truncated_content)})小于等于目标长度({target_length})，直接返回原文内容")
                return f"原文内容已足够简洁，未进行精炼，以下为原文内容：\n\n```\n{truncated_content}\n```\n"

            # 获取并格式化当前时间上下文
            current_time_str = get_current_datetime_str()

            # 获取语言要求
            if i18n.is_language_manually_set():
                user_language = i18n.get_language_display_name()
                language_requirement = f"请使用{user_language}进行精炼，确保精炼后的内容语言与用户设置保持一致。"
            else:
                language_requirement = "请根据原文的主要语言进行精炼，保持与原文相同的语言。"

            extra_requirements_block = ""
            if requirements:
                extra_requirements_block = f"""

额外要求:
```
{requirements}
```"""

            # 构建提示语
            prompt = f"""请对原文进行信息精炼，目标长度控制在 {target_length} 字左右。

当前时间: {current_time_str} (处理涉及"今年"、"近期"、"当下"、"最近"、"现在"等时间相关表述时，必须以当前时间为准进行推算和理解)

核心任务：
1. 保留原文所有重要信息、具体数据、关键细节、人名地名、时间节点等
2. 剔除无意义的冗余表述、重复内容、客套话、过度修饰
3. 使用更精准的词汇和更紧凑的句式结构
4. 保持原文的风格、语气和立场
5. 增强内容的结构化程度，让信息层次更清晰

输出要求：
- 使用Github风格的Markdown和CommonMark规范
- 标题一般代表了核心内容，以此来辨别哪些内容是正文，哪些是无关内容
- 保留正文中的链接、图片、表格等元素，但请剔除与正文无关或在正文之前和之后的图片和链接
- 剔除与正文无关的任何内容，如广告、导航栏、页脚、推荐阅读、拓展专题
- 目标是用最少的字传达最多的信息，而非简单删减
- 不要输出多余的解释性内容，如「以下是精炼后的内容」、「以上为精炼后的内容」等
- 禁止超出 {target_length} 字的长度限制
- 禁止虚构、编造内容，所有精炼后的内容必须来源于原文内容
- 若原文内容过短，则不要进行精炼，请直接返回原文内容
- 若原文内容为空或异常，请放弃精炼并解释原文的异常情况

语言要求：
{language_requirement}
{extra_requirements_block}

原文标题：
```
{title}
```

原文内容：
```
{truncated_content}
```

请提供信息精炼后的内容:"""

            # 构建消息
            messages = [
                {
                    "role": "system",
                    "content": "你是专业的信息精炼助手，请严格遵循用户给出的要求与约束完成输出。"
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ]

            # 请求模型
            response = await LLMFactory.call_with_tool_support(
                model_id=model_id,
                messages=messages,
                tools=None,  # 不需要工具支持
                stop=None,
            )

            # 处理响应
            if not response or not response.choices or len(response.choices) == 0:
                logger.error("没有从模型收到有效响应")
                return None

            # 获取精炼后的内容
            summary_content = response.choices[0].message.content

            # 如果内容被截断，添加提示
            if is_truncated:
                summary_content += "\n\n(注：此信息精炼基于截断内容生成)"

            return summary_content if summary_content else None

        except Exception as e:
            logger.exception(f"处理内容信息精炼失败: {e!s}")
            return None

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
            file_name = result.extra_info.get("file_name", "文件") if result.extra_info else "文件"

            # 返回Markdown格式的精炼内容
            return ToolDetail(
                type=DisplayType.MD,
                data=FileContent(
                    file_name=f"{file_name}_精炼.md",
                    content=result.content
                )
            )
        except Exception as e:
            logger.error(f"生成工具详情失败: {e!s}")
            return None



    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        if not arguments or "file_path" not in arguments:
            return i18n.translate("summarize.success_general", category="tool.messages")

        file_path = arguments["file_path"]
        # 提取文件名
        file_name = file_path.split('/')[-1]
        return file_name

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None) -> Dict:
        """获取工具调用后的友好动作和备注"""
        if not result.ok:
            return {
                "action": i18n.translate("summarize", category="tool.actions"),
                "remark": i18n.translate("summarize.error", category="tool.messages", error=result.content)
            }

        return {
            "action": i18n.translate("summarize", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }

    async def _read_file(self, file_path: str) -> Optional[str]:
        """读取文件内容

        Args:
            tool_context: 工具上下文
            file_path: 文件路径

        Returns:
            Optional[str]: 文件内容，如果读取失败则返回None
        """
        try:
            read_file_tool = ReadFile()
            read_file_params = ReadFileParams(
                file_path=file_path,
                should_read_entire_file=True
            )

            result = await read_file_tool.execute_purely(read_file_params)

            if result.ok:
                return result.content
            else:
                logger.error(f"读取文件 {file_path} 失败: {result.content}")
                return None
        except Exception as e:
            logger.error(f"读取文件 {file_path} 时发生异常: {e}")
            return None
