from app.i18n import i18n
import json
import re
import hashlib
from typing import Any, Dict, List, Optional, Set, TypeVar, Union
from urllib.parse import urlparse
import aiofiles

from pydantic import Field

from agentlang.utils.token_estimator import truncate_text_by_token
from agentlang.context.tool_context import ToolContext
from app.core.entity.message.server_message import ToolDetail, DisplayType, FileContent
from agentlang.tools.tool_result import ToolResult
from agentlang.llms.factory import LLMFactory
from agentlang.logger import get_logger
from app.tools.core import BaseTool, BaseToolParams, tool

logger = get_logger(__name__)

# 参考 summarize.py，设置默认最大 Token 数
DEFAULT_MAX_TOKENS = 24_000

class PurifyParams(BaseToolParams):
    file_path: str = Field(
        ...,
        description="""<!--zh: 需要净化的文件路径-->
File path requiring purification"""
    )
    criteria: Optional[str] = Field(
        default=None,
        description="""<!--zh: 可选的用户自定义净化标准描述，例如 "移除所有包含'广告'的行" 或 "只保留正文内容"-->
Optional user-defined purification criteria description, e.g., "remove all lines containing 'ads'" or "keep only main content" """
    )


@tool()
class Purify(BaseTool[PurifyParams]):
    """<!--zh
    净化工具，用于清理文本文件，移除无关行（如广告、导航、页眉/页脚、版权声明、非必要的注释、过多空行等）。
    用户可以提供可选的自定义净化标准。

    调用示例：
    ```
    {
        "file_path": "./path/to/your/document.txt",
        "criteria": "只保留主要段落，移除所有列表项和代码块"
    }
    ```
    或者，不提供 criteria 则使用通用标准：
    ```
    {
        "file_path": "./path/to/another/document.md"
    }
    ```
    -->
    Purify tool for cleaning text files, removing irrelevant lines (e.g., ads, navigation, headers/footers, copyright notices, unnecessary comments, excessive blank lines, etc.).
    User can provide optional custom purification criteria.

    Usage example:
    ```
    {
        "file_path": "./path/to/your/document.txt",
        "criteria": "Keep only main paragraphs, remove all list items and code blocks"
    }
    ```
    Or, don't provide criteria to use general standards:
    ```
    {
        "file_path": "./path/to/another/document.md"
    }
    ```
    """

    async def execute(
        self,
        tool_context: ToolContext,
        params: PurifyParams
    ) -> ToolResult:
        """工具执行入口"""
        return await self.execute_purely(params)

    async def execute_purely(
        self,
        params: PurifyParams
    ) -> ToolResult:
        """执行净化核心逻辑"""
        file_path = params.file_path
        criteria = params.criteria
        file_name = file_path.split('/')[-1]

        try:
            logger.info(f"开始净化文件: {file_path}, 自定义标准: {'有' if criteria else '无'}")

            # 1. 读取文件内容
            original_content: str
            try:
                async with aiofiles.open(file_path, mode='r', encoding='utf-8') as f:
                    original_content = await f.read()
            except FileNotFoundError:
                logger.error(f"净化失败: 文件未找到 {file_path}")
                return ToolResult.error(f"文件未找到: {file_path}")
            except Exception as e:
                logger.exception(f"净化失败: 读取文件 {file_path} 时出错")
                return ToolResult.error("Failed to read file")

            if not original_content.strip():
                logger.warning(f"文件 {file_path} 为空或只包含空白字符，无需净化。")
                return ToolResult(
                    content=f"文件 '{file_name}' 为空或只包含空白，无需净化。",
                    extra_info={"file_path": file_path, "file_name": file_name, "purified": False}
                )

            # 2. 调用内部方法获取净化后的内容
            purified_content = await self.purify_content(
                original_content=original_content,
                criteria=criteria,
            )

            if purified_content is None:
                # purify_content 内部已记录错误
                return ToolResult.error("净化处理失败，请检查日志获取详情")

            # 3. 返回结果
            logger.info(f"文件 {file_path} 净化完成")
            return ToolResult(
                content=purified_content,
                extra_info={"file_path": file_path, "file_name": file_name, "purified": True}
            )

        except Exception as e:
            logger.exception(f"执行净化操作时发生未预料的错误: {e!s}")
            return ToolResult.error("Purification failed")


    async def purify_content(
        self,
        original_content: str,
        criteria: Optional[str],
    ) -> Optional[str]:
        """核心净化逻辑：添加行号、调用LLM、解析结果、过滤内容"""
        try:
            # 预处理：按行分割原始内容
            original_lines = original_content.splitlines() # splitlines() 会自动处理各种换行符
            if not original_lines:
                return original_content # 如果分割后为空列表，说明原文可能是空的或只有换行符

            # 添加行号 (1-based)
            lines_with_numbers = [f"{i+1}: {line}" for i, line in enumerate(original_lines)]
            content_with_line_numbers = "\n".join(lines_with_numbers)

            # （可选）截断处理
            truncated_content, is_truncated = truncate_text_by_token(content_with_line_numbers, DEFAULT_MAX_TOKENS)
            if is_truncated:
                logger.warning(f"净化内容被截断: original_lines={len(original_lines)}, truncated_length={len(truncated_content)}")
                # 注意：如果截断，LLM只能看到部分行，返回的行号也是基于这部分的，可能导致净化不完整

            # 构建 Prompt
            system_prompt = (
                "你是文本净化助手，通常被用于网页内容净化。\n"
                "你的任务是分析以下带行号的文本内容，识别出需要删除的行。\n"
                "你需要谨慎地删除以下内容：广告、网页中的噪音（如：每个网页都会出现的导航栏或页脚内容，而非当前页面独有的信息）、多次重复出现的信息（保留最主要的那一条）、连续的多个空行等代表格式而非内容的行。\n"
                "你要谨慎地进行删除，极力避免删除有价值的信息，只删除那些非常明显的垃圾信息，不要为了净化而净化。\n"
                "你要确保删除后的文本是连贯的，不要破坏原有的结构和逻辑。\n"
                "重要：请严格按照格式要求，仅输出需要删除的行的行号列表，以英文逗号分隔，确保只包含数字和逗号，不要包含任何其他文字、解释、空格或换行符。例如：3,5,10,11,25\n"
                "如果所有行都需要保留，请返回空字符串。"
            )

            user_prompt_parts = []
            if criteria:
                user_prompt_parts.append(f"请特别注意以下用户要求：```\n{criteria}\n```")

            user_prompt_parts.append(f"\n需要分析的文本内容如下:\n---\n{truncated_content}\n---")
            user_prompt = "\n".join(user_prompt_parts)

            # 构建消息
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]

            # Get model_id from configuration
            from app.core.ai_abilities import AIAbility, get_ability_config
            model_id = get_ability_config(
                AIAbility.PURIFY,
                "model_id",
                default="deepseek-chat"
            )

            # 调用 LLM
            logger.debug(f"向 LLM 发送净化请求: 模型={model_id}")
            response = await LLMFactory.call_with_tool_support(
                model_id=model_id,
                messages=messages,
                tools=None,
                stop=None,
            )

            # 检查响应是否有效，content 可能是 None 或空字符串
            if not response or not response.choices or len(response.choices) == 0 or response.choices[0].message is None:
                logger.error("LLM 返回了无效的响应结构")
                return None

            # content 可能为 None 或 字符串
            llm_output_content = response.choices[0].message.content
            llm_output = llm_output_content.strip() if llm_output_content is not None else ""

            logger.debug(f"LLM 返回的待删除行号原始输出: '{llm_output}'")

            # 解析响应，提取行号
            lines_to_remove_set: Set[int] = set()
            if llm_output: # 只有在LLM返回非空字符串时才尝试解析
                # 使用正则表达式提取所有数字
                line_numbers_str = re.findall(r'\d+', llm_output)
                # 检查是否只包含数字和逗号（以及可能的空格，已被strip移除）
                # 如果提取出的数字拼接后和原始输出（去除非数字逗号后）不一致，说明含有非法字符
                if not all(c.isdigit() or c == ',' for c in llm_output.replace(" ", "")):
                   logger.warning(f"LLM 返回的内容包含除数字和逗号外的字符: '{llm_output}'. 尝试仅提取数字。")

                if not line_numbers_str and llm_output: # 返回了非空但无法提取数字的内容
                     logger.error(f"LLM 返回了无法解析为行号列表的非空内容: '{llm_output}'. 净化失败。")
                     return None

                for num_str in line_numbers_str:
                    try:
                        line_num = int(num_str)
                        if line_num > 0: # 行号是从1开始的
                             lines_to_remove_set.add(line_num)
                    except ValueError:
                        # 这理论上不应该发生，因为 re.findall(r'\d+') 只会返回数字字符串
                        logger.warning(f"尝试将 '{num_str}' 转换为整数时出错，已忽略。LLM原始输出: '{llm_output}'")

            logger.info(f"解析得到待删除行号 ({len(lines_to_remove_set)}个): {sorted(list(lines_to_remove_set))}")

            # 调试日志：使用 opt(lazy=True) 实现惰性求值，打印完整的被删除行内容
            logger.opt(lazy=True).debug(
                "将要删除的行内容 ({} 行):\n{}",
                lambda: len(lines_to_remove_set), # 参数1: 行数
                lambda: "\n".join( # 参数2: 拼接后的内容
                    f"  - Line {line_num}: {original_lines[line_num - 1]}"
                    if 0 < line_num <= len(original_lines) else f"  - Line {line_num}: (无效行号)"
                    for line_num in sorted(list(lines_to_remove_set))
                )
            )

            # 过滤内容
            purified_lines = []
            for i, line in enumerate(original_lines):
                # 当前行号是 i + 1
                if (i + 1) not in lines_to_remove_set:
                    purified_lines.append(line)

            # 重组内容
            final_content = "\n".join(purified_lines)

            # 如果截断了，添加提示
            if is_truncated:
                final_content += "\n\n(注：由于原文过长，此净化结果基于部分内容生成)"

            return final_content

        except Exception as e:
            logger.exception(f"处理内容净化失败: {e!s}")
            return None

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        """生成工具详情，用于前端展示"""
        if not result.ok or not result.content or not result.extra_info:
            return None

        file_name = result.extra_info.get("file_name", "文件")
        purified = result.extra_info.get("purified", False)

        if not purified: # 文件为空或处理失败时，不展示特殊详情
             # 可以返回一个简单的文本提示，或者None
             return ToolDetail(type=DisplayType.TEXT, data=result.content)

        # 对于成功净化的结果，以Markdown文件形式展示
        try:
            # 尝试保留原始文件扩展名，如果无法确定则用 .txt
            base_name, _, extension = file_name.rpartition('.')
            if not extension or len(extension) > 5: # 简单判断是否是有效扩展名
                extension = "txt"
            purified_file_name = f"{base_name or file_name}_purified.{extension}"

            return ToolDetail(
                type=DisplayType.MD, # 或者根据文件类型决定？这里简化为MD
                data=FileContent(
                    file_name=purified_file_name,
                    content=result.content # result.content 已经是净化后的文本
                )
            )
        except Exception as e:
            logger.error(f"生成净化工具详情失败: {e!s}")
            return None # 出错则不显示详情



    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        if not arguments or "file_path" not in arguments:
            return i18n.translate("purify.success_general", category="tool.messages")

        file_path = arguments["file_path"]
        file_name = file_path.split('/')[-1]

        if result.ok and result.extra_info and result.extra_info.get("purified", False):
            return i18n.translate("purify.success_with_file", category="tool.messages", file_name=file_name)
        elif result.ok and result.extra_info and not result.extra_info.get("purified", False):
            return i18n.translate("purify.no_need", category="tool.messages", file_name=file_name)
        elif not result.ok:
            return i18n.translate("purify.failed", category="tool.messages", file_name=file_name)
        else:
            return i18n.translate("purify.attempted", category="tool.messages", file_name=file_name)

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None) -> Dict:
        """获取工具调用后的友好动作和备注"""
        if not result.ok:
            return {
                "action": i18n.translate("purify", category="tool.actions"),
                "remark": i18n.translate("purify.error", category="tool.messages", error=result.content)
            }

        return {
            "action": i18n.translate("purify", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }

# 注意：确认 aiofiles 是否已在 requirements.txt 中
# pip install aiofiles
