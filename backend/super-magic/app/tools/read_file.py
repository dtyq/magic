from app.i18n import i18n
import asyncio
import math
import os
import time
from io import BytesIO
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

from markitdown import MarkItDown, StreamInfo
from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from agentlang.utils.token_estimator import num_tokens_from_string
from app.core.entity.message.server_message import (DisplayType, FileContent,
                                                    ToolDetail)
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.markitdown_plugins.csv_plugin import CSVConverter
from app.tools.markitdown_plugins.docx_plugin import DocxConverter
from app.tools.markitdown_plugins.excel_plugin import ExcelConverter
from app.tools.utils.display_content_utils import truncate_content_for_display
from app.tools.workspace_tool import WorkspaceTool
from app.utils.async_file_utils import async_exists, async_is_dir, async_read_bytes, async_read_text
from app.utils.file_constants import CONVERSION_RECOMMENDED_TYPES
from app.utils.file_utils import is_binary_file

logger = get_logger(__name__) # noqa: F811

# 单文件读取 token 上限
DEFAULT_MAX_TOKENS = 25000
# 动态上限：占剩余上下文窗口的比例，上下文充足时达到 DEFAULT_MAX_TOKENS
MAX_TOKENS_RATIO = 0.40
# 保底：上下文极度紧张时仍保留最小可用量
MIN_MAX_TOKENS = 5000

# 超大文件阈值：超过这个Token数的文件，强烈建议使用 grep_search
LARGE_FILE_TOKEN_THRESHOLD = 100000

def _compute_max_tokens(tool_context: Optional["ToolContext"]) -> int:
    """根据剩余上下文窗口动态计算本次读取上限。

    上下文充足时返回 DEFAULT_MAX_TOKENS，不足时按比例收缩，最低保底 MIN_MAX_TOKENS。
    无法获取上下文信息时直接返回默认值。
    """
    remaining = _get_context_remaining(tool_context)
    if remaining <= 0:
        return DEFAULT_MAX_TOKENS
    dynamic = int(remaining * MAX_TOKENS_RATIO)
    return max(MIN_MAX_TOKENS, min(DEFAULT_MAX_TOKENS, dynamic))


def _get_context_remaining(tool_context: Optional["ToolContext"]) -> int:
    """从 AgentHorizon 获取当前剩余上下文 token 数，获取失败返回 0。"""
    if tool_context is None:
        return 0
    try:
        agent_context = tool_context.get_extension("agent_context")
        if agent_context is None:
            return 0
        return agent_context.horizon.get_context_usage().remaining
    except Exception:
        return 0


@dataclass
class TruncationInfo:
    """文件截断信息，用于生成对大模型友好的提示。"""
    total_lines: int            # 文件总行数
    last_complete_line: int     # 截断处最后一个完整行的行号（1-based）
    is_last_line_complete: bool # 最后一行是否完整
    next_offset: int            # 下次读取的 offset（0-based）
    lines_read: int             # 已读行数
    lines_remaining: int        # 剩余未读行数
    original_tokens: int        # 文件总 token 数（截断前估算）
    current_tokens: int         # 本次已读 token 数
    times_needed: int           # 预计剩余需要读取的次数
    context_remaining: int = 0  # 本次读取前的剩余上下文 token 数（0 = 未知）


def _parse_truncation_info(
    original_content: str,
    truncated_content: str,
    original_tokens: int,
    current_tokens: int,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    context_remaining: int = 0,
) -> TruncationInfo:
    """
    解析截断信息，计算行号、偏移量等关键数据

    这个函数的作用是分析被截断的内容，提取出大模型需要的关键信息：
    - 文件总共有多少行
    - 当前读到了第几行
    - 最后一行是否完整
    - 下次应该从哪里继续读（offset参数）
    - 还需要读几次才能读完

    Args:
        original_content: 原始完整内容（带行号格式：行号\t内容\n）
        truncated_content: 截断后的内容（带行号格式）
        original_tokens: 原始内容的Token数
        current_tokens: 截断后内容的Token数

    Returns:
        TruncationInfo: 包含所有截断相关信息的对象
    """
    # 1. 统计文件总行数
    # 注意：内容格式是 "行号\t内容\n"，所以按换行符分割后，每个非空元素代表一行
    original_lines = [line for line in original_content.split('\n') if line.strip()]
    total_lines = len(original_lines)

    # 2. 分析截断后的内容，找到最后一个完整行
    truncated_lines = truncated_content.split('\n')

    # 判断最后一行是否完整：如果截断内容以换行符结尾，说明最后一行是完整的
    is_last_line_complete = truncated_content.endswith('\n')

    # 3. 解析最后一个完整行的行号
    last_complete_line = 0
    for line in reversed(truncated_lines):
        if line.strip():  # 找到第一个非空行
            # 内容格式是 "行号\t内容"，提取行号
            try:
                line_number = int(line.split('\t')[0])
                last_complete_line = line_number
                break
            except (ValueError, IndexError):
                # 如果解析失败，继续查找上一行
                continue

    # 4. 计算下次读取应该使用的 offset
    # offset 是从 0 开始计数的，表示跳过多少行后开始读取
    if is_last_line_complete:
        # 最后一行完整：下次从下一行开始读
        # 例如：读到第 1200 行，offset=1200 表示跳过前1200行，从第1201行开始
        next_offset = last_complete_line
    else:
        # 最后一行不完整：下次从当前行重新开始读
        # 例如：第 1200 行被截断，offset=1199 表示跳过前1199行，从第1200行重新读
        next_offset = last_complete_line - 1

    # 5. 计算已读行数和剩余行数
    lines_read = last_complete_line
    lines_remaining = total_lines - lines_read

    # 6. 计算预计剩余需要读取的次数（用实际动态上限估算，比固定值更准）
    remaining_tokens = original_tokens - current_tokens
    times_needed = math.ceil(remaining_tokens / max_tokens) if remaining_tokens > 0 else 0

    return TruncationInfo(
        total_lines=total_lines,
        last_complete_line=last_complete_line,
        is_last_line_complete=is_last_line_complete,
        next_offset=next_offset,
        lines_read=lines_read,
        lines_remaining=lines_remaining,
        original_tokens=original_tokens,
        current_tokens=current_tokens,
        times_needed=times_needed,
        context_remaining=context_remaining,
    )


def _build_truncation_message(info: TruncationInfo, file_path: str) -> str:
    """
    根据截断信息构建对大模型友好的提示消息

    这个函数负责生成清晰、结构化的提示信息，帮助大模型理解：
    - 文件被截断在哪里
    - 如何继续读取剩余内容
    - 是否建议使用其他方式（如 grep_search）

    Args:
        info: 截断信息对象
        file_path: 文件路径

    Returns:
        str: 格式化的提示消息
    """
    lines = []
    lines.append("\n\n[File truncated: content exceeded the single-read token limit]\n")

    # 1. Estimated context cost — helps model decide whether continuing is worth it.
    # All token numbers are character-based estimates, not the actual API billing count.
    remaining_file_tokens = info.original_tokens - info.current_tokens
    if info.context_remaining > 0:
        cost_pct = round(info.current_tokens / info.context_remaining * 100, 1)
        rest_pct = round(remaining_file_tokens / info.context_remaining * 100, 1)
        lines.append("[Estimated context cost]")
        lines.append(f"This read: ~{info.current_tokens:,} tokens (est. {cost_pct}% of remaining context before this read)")
        lines.append(f"Rest of file: ~{remaining_file_tokens:,} tokens more (est. {rest_pct}% of remaining context before this read)")
        lines.append(f"Remaining context before this read: ~{info.context_remaining:,} tokens\n")

    # 2. File info
    lines.append("[File info]")
    lines.append(f"Total lines: {info.total_lines}\n")

    # 3. Read summary
    lines.append("[This read]")
    lines.append(f"Read: line 1 to line {info.last_complete_line} ({info.lines_read} lines)")

    if not info.is_last_line_complete:
        lines.append(f"Note: line {info.last_complete_line} is incomplete, marked with ... at end")

    lines.append(f"Remaining: line {info.last_complete_line + 1} to line {info.total_lines} ({info.lines_remaining} lines)\n")

    # 4. How to continue
    lines.append("[How to continue reading]")

    is_very_large = info.original_tokens > LARGE_FILE_TOKEN_THRESHOLD

    if is_very_large:
        lines.append(f"This file is very large — est. {info.times_needed}+ more reads to finish.")
        lines.append("Reading it fully will consume substantial context. Strongly consider alternatives:\n")
        lines.append("- Use grep_search to locate specific content")
        lines.append("- Identify the exact function/class you need, then read that range only")
        lines.append("- Ask the user which part of the file they care about\n")
        lines.append("If you must continue:")
    elif info.times_needed >= 4:
        lines.append(f"Est. {info.times_needed} more reads to finish this file.")
        lines.append("Strongly recommend grep_search for targeted lookup instead of reading the whole file.\n")
        lines.append("Only continue if the user explicitly asked for the full content:")
    elif info.times_needed >= 2:
        lines.append(f"Est. {info.times_needed} more reads to finish this file.")
        lines.append("Consider grep_search for targeted content; or continue reading:")
    else:
        lines.append(f"Est. {info.times_needed} more read(s) to finish.")

    if info.is_last_line_complete:
        lines.append("```")
        lines.append(f'file_path: "{file_path}"')
        lines.append(f"offset: {info.next_offset}  # starts at line {info.next_offset + 1}")
        lines.append("limit: -1")
        lines.append("```")
    else:
        lines.append("```")
        lines.append(f'file_path: "{file_path}"')
        lines.append(f"offset: {info.next_offset}  # re-reads line {info.next_offset + 1} (last line was incomplete)")
        lines.append("limit: -1")
        lines.append("```")

    if is_very_large or info.times_needed >= 2:
        lines.append("\nRecommended approach:")
        lines.append("- grep_search for keywords, function names, class names")
        lines.append("- Then read only the relevant range")

    return "\n".join(lines)


@dataclass
class TextReadResult:
    """文本读取结果，包含带行号和不带行号的两个版本"""
    with_line_numbers: str  # 带行号的内容版本（用于AI展示）
    without_line_numbers: str  # 不带行号的原始内容版本（用于工具详情）


class ReadFileParams(BaseToolParams):
    file_path: str = Field(..., description="""<!--zh: 要读取的文件路径，相对于工作目录或绝对路径-->
File path to read, relative to workspace or absolute path""")
    offset: int = Field(0, description="""<!--zh: 开始读取的行号（从0开始），支持负数表示从文件末尾开始计算（例如 -10 表示最后10行的起始位置）-->
Starting line number to read (0-indexed), supports negative numbers to count from end (e.g., -10 for last 10 lines start position)""")
    limit: int = Field(200, description="""<!--zh: 要读取的行数或页数，默认200行，如果要读取整个文件，请设置为-1-->
Number of lines or pages to read, default 200 lines, set to -1 to read entire file""")


@tool()
class ReadFile(AbstractFileTool[ReadFileParams], WorkspaceTool[ReadFileParams]):
    """<!--zh
    读取文件内容
    -->
    Read file content
    """

    # Initialize MarkItDown with converters
    md = MarkItDown()
    md.register_converter(ExcelConverter())
    md.register_converter(CSVConverter())
    md.register_converter(DocxConverter())

    def get_prompt_hint(self) -> str:
        return """\
<!--zh
支持的文件类型：
- 文本文件（.txt、.md、.py、.js、.html、.css、.json、.xml、.yaml等）
- Word文档（.docx）
- Excel文件（.xlsx、.csv）

注意：
- 相对路径解析到 .workspace；访问 .workspace 外的文件请使用绝对路径
- 无法读取支持的文件类型以外的文件，尤其是二进制文件
- 对于Excel和CSV文件，你可以使用本工具读取文件的前10行了解结构，然后使用Python脚本进行数据分析处理
- 为避免内容过长超过上下文窗口，读取大文件时可能会被自动截断，若必须阅读完整的情况下，你可以分多次读取
- PDF、PowerPoint、Notebook、旧版 Word/Excel 等复杂文档不会自动转换；遇到这类文件时，根据错误提示使用 document-converter skill
- 文本读取结果会用「行号 + 制表符 + 内容」展示行号；复制到任何编辑工具参数时，只复制制表符之后的真实文件内容，不要带行号前缀

建议：
- 当你需要读取多个文件时，强烈建议使用 read_files 工具，而非多次调用本工具，这将会极大提升任务效率
-->
Supported file types:
- Text files (.txt, .md, .py, .js, .html, .css, .json, .xml, .yaml, etc.)
- Word documents (.docx)
- Excel files (.xlsx, .csv)

Notes:
- Relative paths resolve to .workspace; use absolute paths for files outside .workspace
- Cannot read unsupported file types, especially binary files
- For Excel/CSV files, use this tool to read first 10 lines to understand structure, then use Python script for data analysis
- To avoid excessive context length, large files may be auto-truncated; if complete reading necessary, you can read in multiple passes
- For complex or unreadable document formats such as PDF, PowerPoint, notebooks, and legacy Office files, do not auto-convert. Return an error that tells the model to use the `document-converter` skill.
- Text read output displays line numbers as line number + tab + content; when copying into any edit tool parameter, copy only the real file content after the tab and omit the line-number prefix

Suggestions:
- When reading multiple files, strongly recommend using read_files tool instead of calling this tool multiple times, greatly improves efficiency"""


    def _build_document_converter_skill_error(self, file_path: Path) -> str:
        return (
            f"read_file cannot directly read this document format: `{file_path.name}` ({file_path.suffix.lower()}).\n\n"
            "Use the `document-converter` skill to inspect the document first, then extract only the needed pages, "
            "sections, slides, sheets, ranges, images, or notebook cells. Do not try to auto-convert the whole file "
            "inside read_file."
        )

    async def _try_read_with_plugin(self, file_path: Path, params: ReadFileParams, tool_context: Optional[ToolContext] = None) -> Optional[ToolResult]:
        """
        尝试使用 MarkItDown plugin 读取文件

        判断逻辑：
        1. 文件扩展名在 plugin 列表中
        2. 或者是二进制文件且不是已知的文本类型（兜底处理）

        注意：建议使用 document-converter skill 的文件类型（如 PDF、PPT 等）不会使用 plugin 读取。
        旧格式（.xls, .doc）不再隐式转换。

        Args:
            file_path: 文件路径
            params: 读取参数

        Returns:
            Optional[ToolResult]: 如果适合用 plugin 读取则返回 ToolResult，否则返回 None
        """
        file_extension = file_path.suffix.lower()

        # 如果文件类型需要结构化文档流程，不使用 plugin 读取，也不自动转换。
        if file_extension in CONVERSION_RECOMMENDED_TYPES:
            return ToolResult.error(self._build_document_converter_skill_error(file_path))

        if file_extension in {'.xls', '.doc'}:
            return ToolResult.error(self._build_document_converter_skill_error(file_path))

        # 检查是否是二进制文件
        is_binary = await is_binary_file(file_path)

        # 定义需要用 plugin 处理的扩展名
        plugin_extensions = {'.xlsx', '.csv', '.docx'}

        # 定义已知的文本文件扩展名
        text_extensions = {'.md', '.txt', '.py', '.js', '.json', '.yaml', '.yml',
                         '.html', '.css', '.xml', '.toml', '.ini', '.conf',
                         '.log', '.sh', '.bat', '.c', '.cpp', '.h', '.java',
                         '.go', '.rs', '.php', '.rb', '.ts', '.tsx', '.jsx'}

        # 判断是否使用 plugin：
        # 1. 文件扩展名在 plugin 列表中
        # 2. 或者是二进制文件且不是已知的文本类型（兜底处理）
        use_plugin = (
            file_extension in plugin_extensions or
            (is_binary and file_extension not in text_extensions)
        )

        if not use_plugin:
            return None

        actual_read_path = file_path

        # 使用 plugin 读取
        logger.info(f"使用 plugin 读取文件: {actual_read_path.name} (原文件: {file_path.name}, 扩展名: {file_extension}, 二进制: {is_binary})")

        markdown_content = await self._read_using_plugin(actual_read_path, params.offset, params.limit)

        if not markdown_content:
            return ToolResult.error(self._build_document_converter_skill_error(file_path))

        # 构建返回结果
        content_tokens = num_tokens_from_string(markdown_content)

        # 添加文件元信息
        # 注意：不显示Token数，避免大模型混淆（Token数对大模型无实际意义）
        meta_info = f"# 文件: {file_path.name}\n\n"
        meta_info += f"**文件信息**: 通过轻量解析器读取，内容以 Markdown 展示\n\n---\n\n"

        content_with_meta = meta_info + markdown_content

        # 如果是完整读取（从头读取整个文件），添加完整性提示
        is_complete_read = params.offset == 0 and (params.limit is None or params.limit <= 0)
        if is_complete_read:
            content_with_meta += "\n\n---\n\n**[文件已完整读取]**"

        extra_info = {
            "raw_content": markdown_content,
            "raw_content_without_line_numbers": markdown_content,
            "original_file_path": str(file_path),
            "read_path": str(actual_read_path),  # 使用实际读取的路径
            "read_method": "markitdown",
            "is_converted": False,
            "conversion_strategy": None
        }

        # 读取文件后更新时间戳
        if tool_context:
            await self.get_horizon(tool_context).update_timestamp(file_path)

        return ToolResult(
            content=content_with_meta,
            extra_info=extra_info
        )

    async def _read_using_plugin(self, file_path: Path, offset: int, limit: int) -> Optional[str]:
        """
        使用 MarkItDown 的 plugin 读取文件内容

        支持的文件类型：
        - Excel: .xlsx, .xls
        - CSV: .csv
        - Word: .docx

        Args:
            file_path: 文件路径
            offset: 偏移行数
            limit: 限制行数

        Returns:
            Optional[str]: Markdown 内容，如果失败返回 None
        """
        try:
            file_extension = file_path.suffix.lower()
            file_bytes = await async_read_bytes(file_path)

            # 定义同步转换函数（在线程池中执行）
            def convert_sync():
                result = self.md.convert(
                    BytesIO(file_bytes),
                    stream_info=StreamInfo(extension=file_extension),
                    offset=offset,
                    limit=limit
                )
                return result.markdown if result else None

            # 在线程池中执行同步文件操作和转换
            loop = asyncio.get_event_loop()
            markdown_content = await loop.run_in_executor(None, convert_sync)

            if not markdown_content:
                logger.warning(f"MarkItDown conversion returned empty result for: {file_path.name}")

            return markdown_content

        except Exception as e:
            logger.error(f"Error using MarkItDown to read file {file_path.name}: {e}")
            return None

    async def execute(
        self,
        tool_context: ToolContext,
        params: ReadFileParams,
        raw_mode: bool = False
    ) -> ToolResult:
        """
        执行文件读取操作

        Args:
            tool_context: 工具上下文
            params: 文件读取参数
            raw_mode: 原始模式（内部参数）
                     - False（默认）: 格式化模式，返回面向大模型的友好格式（带截断提示、格式化元信息）
                     - True: 原始模式，返回纯粹的结构化数据，供其他工具二次开发使用

        Returns:
            ToolResult: 包含文件内容或错误信息
        """
        return await self.execute_purely(params, tool_context, raw_mode)

    async def execute_purely(
        self,
        params: ReadFileParams,
        tool_context: Optional[ToolContext] = None,
        raw_mode: bool = False
    ) -> ToolResult:
        """
        执行文件读取操作，专注于读取可读文件

        逻辑流程：
        1. 对于可以直接读取的文件类型，直接读取或使用轻量 plugin 读取
        2. 对于复杂或无法直接读取的文档格式，返回错误并提示使用 document-converter skill

        Args:
            params: 文件读取参数

        Returns:
            ToolResult: 包含文件内容或错误信息
        """
        try:
            # 使用父类方法获取安全的文件路径（包含模糊匹配）
            resolved = self.resolve_path_fuzzy(params.file_path)
            file_path = resolved.path
            fuzzy_warning = resolved.warning
            # 检查文件是否存在
            if not await async_exists(file_path):
                if tool_context:
                    tool_context.set_metadata("error_type", "read_file.error_file_not_exist")
                    tool_context.set_metadata("error_file_path", params.file_path)
                return ToolResult.error(f"File does not exist: {params.file_path}")
            if await async_is_dir(file_path):
                if tool_context:
                    tool_context.set_metadata("error_type", "read_file.error_is_directory")
                    tool_context.set_metadata("error_file_path", params.file_path)
                return ToolResult.error(f"The specified path is a directory, not a file: {params.file_path}. Use list_dir to inspect directory contents.")

            # === 第一步：尝试使用 plugin 直接读取 ===
            plugin_result = await self._try_read_with_plugin(file_path, params, tool_context)
            if plugin_result is not None:
                # 如果有模糊匹配警告，添加到 plugin 读取结果的末尾
                if fuzzy_warning and plugin_result.ok:
                    plugin_result.content = f"{plugin_result.content}\n\n---\n\n{fuzzy_warning}"
                return plugin_result

            # === 第二步：对于其他文件类型，继续文本读取逻辑 ===
            original_file_name = file_path.name
            read_path = file_path  # 默认读取原始文件路径

            if file_path.suffix.lower() in CONVERSION_RECOMMENDED_TYPES:
                if tool_context:
                    tool_context.set_metadata("error_type", "read_file.error_unsupported_document")
                    tool_context.set_metadata("error_file_path", str(file_path))
                return ToolResult.error(self._build_document_converter_skill_error(file_path))

            # === 第三步：执行实际的文件读取逻辑 ===

            # 检查要读取的文件是否存在
            if not await async_exists(read_path):
                if tool_context:
                    tool_context.set_metadata("error_type", "read_file.error_file_not_exist")
                    tool_context.set_metadata("error_file_path", params.file_path)
                return ToolResult.error(f"File does not exist: {params.file_path}")
            if await async_is_dir(read_path):
                if tool_context:
                    tool_context.set_metadata("error_type", "read_file.error_is_directory")
                    tool_context.set_metadata("error_file_path", params.file_path)
                return ToolResult.error(f"The specified path is a directory, not a file: {params.file_path}. Use list_dir to inspect directory contents.")

            # --- 内容读取逻辑 ---
            logger.info(f"使用文本读取逻辑读取文件: {read_path}")

            # 统一使用文本读取逻辑
            # 只有当 offset 为 0 且 limit 非正数时，才直接读取整个文件
            if (params.limit is None or params.limit <= 0) and params.offset == 0:
                # 性能优化：没有指定偏移时直接读取整个文件
                text_result = await self._read_text_file(read_path)
            else:
                # 当指定了 offset 或 limit 为正数时，使用范围读取
                # 将 -1 作为 limit 表示读取到文件末尾
                actual_limit = params.limit if params.limit and params.limit > 0 else -1
                text_result = await self._read_text_file_with_range(
                    read_path, params.offset, actual_limit
                )
            # 使用带行号的版本作为主要内容
            content = text_result.with_line_numbers
            # --- 内容读取逻辑结束 ---

            # 根据当前上下文剩余量动态决定本次读取上限
            max_tokens = _compute_max_tokens(tool_context)
            context_remaining = _get_context_remaining(tool_context)

            # 计算token数量并处理截断
            original_content = content  # 保存原始完整内容，用于解析截断信息
            original_tokens = num_tokens_from_string(content)
            content_tokens = original_tokens
            total_chars = len(content)
            content_truncated = False

            if content_tokens > max_tokens:
                logger.info(f"文件 {read_path.name} (原始: {original_file_name}) 内容token数 ({content_tokens}) 超出限制 ({max_tokens})，进行截断")
                content_truncated = True

                # 使用二分查找确定最佳截断点
                left, right = 0, len(content)
                best_content = ""
                best_tokens = 0

                while left <= right:
                    mid = (left + right) // 2
                    truncated = content[:mid]
                    tokens = num_tokens_from_string(truncated)

                    if tokens <= max_tokens:
                        best_content = truncated
                        best_tokens = tokens
                        left = mid + 1
                    else:
                        right = mid - 1

                truncated_content = best_content
                content_tokens = best_tokens

                truncation_info = _parse_truncation_info(
                    original_content=original_content,
                    truncated_content=truncated_content,
                    original_tokens=original_tokens,
                    current_tokens=content_tokens,
                    max_tokens=max_tokens,
                    context_remaining=context_remaining,
                )

                if not truncation_info.is_last_line_complete:
                    truncated_content += "..."

                if raw_mode:
                    content = truncated_content
                else:
                    truncation_message = _build_truncation_message(truncation_info, original_file_name)
                    content = truncated_content + truncation_message

            # 添加文件元信息 - 使用 original_file_name 作为用户看到的文件名，read_path 用于内部信息
            shown_chars = len(content)
            truncation_status = "（已截断）" if content_truncated else ""

            # 构建元信息
            meta_info = f"# 文件: {original_file_name}\n\n"

            # 元信息中不再显示Token数，避免大模型混淆（Token数对大模型无意义）
            meta_info += f"**文件信息**: 总字符数: {total_chars}，本次读取字符数: {shown_chars}{truncation_status}\n\n---\n\n"
            raw_content = content # 存储未加 meta_info 的原始内容

            # 准备不带行号的版本
            raw_content_without_line_numbers = None
            read_method = "text"  # 统一使用文本读取

            if 'text_result' in locals() and isinstance(text_result, TextReadResult):
                raw_content_without_line_numbers = text_result.without_line_numbers

            extra_info = {
                "raw_content": raw_content,
                "raw_content_without_line_numbers": raw_content_without_line_numbers,
                "original_file_path": str(file_path),
                "read_path": str(read_path),
                "read_method": read_method,  # 标识读取方式：统一为 text(纯文本)
                "is_converted": False,
                "conversion_strategy": None,
                # 截断信息（如果被截断）
                "was_truncated": content_truncated,
                "truncation_info": truncation_info if content_truncated else None
            }

            # --- 准备最终内容 ---

            # Construct final content with meta info prepended to the potentially modified raw_content
            content_with_meta = meta_info + content # 使用可能被截断的 content

            # 如果是完整读取（没有截断，且从头读取整个文件），添加完整性提示
            is_complete_read = not content_truncated and params.offset == 0 and (params.limit is None or params.limit <= 0)
            if is_complete_read:
                content_with_meta += "\n\n---\n\n**[文件已完整读取]**"

            # 如果有模糊匹配警告，添加到内容最后面
            if fuzzy_warning:
                content_with_meta = f"{content_with_meta}\n\n---\n\n{fuzzy_warning}"

            # Horizon 自主决定是否保存整文件快照，调用方只传元信息
            if tool_context:
                try:
                    from app.utils.file_utils import calculate_file_hash, get_fresh_file_stat

                    _stat = await get_fresh_file_stat(str(file_path))
                    _file_hash = await calculate_file_hash(str(file_path))

                    _offset = params.offset if params.offset else 0
                    _limit = params.limit if params.limit and params.limit > 0 else -1
                    _end = _offset + _limit if _limit > 0 else -1

                    await self.get_horizon(tool_context).record_file_read(
                        path=file_path,
                        file_hash=_file_hash,
                        mtime_ms=_stat.mtime * 1000,
                        size=_stat.size,
                        truncated=extra_info.get("was_truncated", False),
                        tool_name="read_file",
                        ranges=[(_offset, _end)],
                    )
                except Exception as _horizon_err:
                    logger.warning(f"[read_file] record_file_read 失败: {_horizon_err}")

            return ToolResult(
                content=content_with_meta,
                extra_info=extra_info
            )

        except Exception as e:
            logger.exception(f"读取文件失败 (原始请求: {params.file_path}): {e!s}")
            if tool_context:
                tool_context.set_metadata("error_type", "read_file.error_unexpected")
                tool_context.set_metadata("error_file_path", params.file_path)
            return ToolResult.error("The read_file tool encountered an unexpected error. Try using shell commands (e.g., cat, head, tail) or write a Python script to read this file instead.")

    async def _read_text_file(self, file_path: Path) -> TextReadResult:
        """读取整个文本文件内容，返回带行号和不带行号的两个版本

        Returns:
            TextReadResult: 包含带行号和不带行号的文本内容
        """
        lines_with_numbers = []
        lines_without_numbers = []
        content = await async_read_text(file_path, errors="replace")
        for line_number, line in enumerate(content.splitlines(), start=1):
            line_content = line.rstrip('\n\r')
            formatted_line = f"{line_number}\t{line_content}\n"
            lines_with_numbers.append(formatted_line)
            lines_without_numbers.append(line_content + "\n")

        return TextReadResult(
            with_line_numbers="".join(lines_with_numbers),
            without_line_numbers="".join(lines_without_numbers)
        )

    async def _read_text_file_with_range(self, file_path: Path, offset: int, limit: int) -> TextReadResult:
        """读取指定范围的文本文件内容，返回带行号和不带行号的两个版本

        Args:
            file_path: 文件路径
            offset: 起始行号（从0开始），支持负数表示从文件末尾开始计算
            limit: 要读取的行数，如果为负数则读取到文件末尾

        Returns:
            TextReadResult: 包含带行号和不带行号的文本内容
        """
        # 统计文件总行数并读取指定范围内容
        all_lines = []
        target_lines_with_numbers = []
        target_lines_without_numbers = []

        all_lines = await async_read_text(file_path, errors="replace")
        all_lines = all_lines.splitlines()

        total_lines = len(all_lines)

        # 处理负数 offset：从文件末尾开始计算
        actual_offset = offset
        if offset < 0:
            actual_offset = max(0, total_lines + offset)  # 例如：total=100, offset=-10 -> actual_offset=90

        # 读取指定范围的行
        for line_idx in range(len(all_lines)):
            line = all_lines[line_idx]
            # 根据行索引应用 offset 和 limit
            if limit > 0:  # 如果 limit 是正数，从 actual_offset 开始读取 limit 行
                if actual_offset <= line_idx < actual_offset + limit:
                    # 添加行号前缀，格式: lineNumber\tcontent (cat -n 的输出格式)
                    line_number = line_idx + 1  # 行号从1开始
                    line_content = line.rstrip('\n\r')  # 移除行尾换行符
                    formatted_line = f"{line_number}\t{line_content}\n"
                    target_lines_with_numbers.append(formatted_line)
                    # 不带行号的版本
                    target_lines_without_numbers.append(line_content + "\n")
            elif actual_offset <= line_idx:  # 如果 limit 不是正数（<=0 或 None），从 actual_offset 读取到文件末尾
                # 添加行号前缀
                line_number = line_idx + 1
                line_content = line.rstrip('\n\r')
                formatted_line = f"{line_number}\t{line_content}\n"
                target_lines_with_numbers.append(formatted_line)
                # 不带行号的版本
                target_lines_without_numbers.append(line_content + "\n")

        start_line = actual_offset + 1  # 转为1-indexed便于用户理解

        # 构建结果头部信息（带行号版本用）
        if not target_lines_with_numbers:
            if actual_offset >= total_lines:
                header = f"# 读取内容为空：起始行 {start_line} 超过文件总行数 {total_lines}\n\n"
            else:
                # Calculate the intended end line based on limit
                # 根据 limit 计算预期的结束行号
                end_line_intended = (actual_offset + limit) if limit > 0 else total_lines
                header = f"# 读取内容为空：指定范围第 {start_line} 行到第 {end_line_intended} 行没有内容（文件共 {total_lines} 行）\n\n"
            # 空内容情况下，两个版本都使用相同的头部信息
            return TextReadResult(
                with_line_numbers=header,
                without_line_numbers=header
            )
        else:
            # Actual end line is actual_offset + number of lines read
            # 实际的结束行号是 actual_offset + 读取的行数
            end_line_actual = actual_offset + len(target_lines_with_numbers)
            header = f"# 显示第 {start_line} 行到第 {end_line_actual} 行（文件共 {total_lines} 行）\n\n"

        content_with_numbers = "".join(target_lines_with_numbers)
        content_without_numbers = "".join(target_lines_without_numbers)

        # 添加省略标注
        has_prefix = actual_offset > 0
        has_suffix = end_line_actual < total_lines

        if has_prefix:
            prefix_lines = actual_offset
            prefix = f"# ... 前面有{prefix_lines}行  ...\n\n"
            content_with_numbers = prefix + content_with_numbers
            # 不带行号版本不需要省略标注

        if has_suffix:
            suffix_lines = total_lines - end_line_actual
            suffix = f"\n\n# ... 后面还有{suffix_lines}行  ..."
            content_with_numbers = content_with_numbers + suffix
            # 不带行号版本不需要省略标注

        return TextReadResult(
            with_line_numbers=header + content_with_numbers,
            without_line_numbers=content_without_numbers
        )

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
        if not result.ok or not result.extra_info or "raw_content" not in result.extra_info:
            return None

        # 从 extra_info 获取路径
        original_file_path_str = result.extra_info.get("original_file_path")
        read_path_str = result.extra_info.get("read_path")

        if not original_file_path_str or not read_path_str:
             logger.warning("无法从 extra_info 获取 original_file_path 或 read_path，尝试从 arguments 回退")
             # 可以尝试从 arguments 回退，或者直接返回 None
             if arguments and "file_path" in arguments:
                 original_file_path_str = arguments["file_path"]
                 # 如果没有 read_path, 只能猜测它和 original 一样
                 read_path_str = read_path_str or original_file_path_str
             else:
                  logger.error("无法确定文件路径信息，无法生成 ToolDetail")
                  return None


        original_file_name = os.path.basename(original_file_path_str)

        # 根据读取方式确定显示类型
        read_method = result.extra_info.get("read_method", "unknown")
        if read_method == "markitdown":
            # markitdown 处理的文件（Excel、CSV、Word等）使用 MD 显示类型
            display_type = DisplayType.MD
        else:
            # 纯文本文件根据实际读取路径的扩展名确定显示类型
            display_type = self.get_display_type_by_extension(read_path_str)

        # 优先使用不带行号的内容版本，如果不存在则回退到带行号的版本
        content_for_display = (
            result.extra_info.get("raw_content_without_line_numbers") or
            result.extra_info["raw_content"]
        )

        # 对展示内容做预处理：替换 base64 数据、超长截断（不影响 LLM 已处理的内容）
        # HTML 截断后结构残缺，display_type 会被降级为 TEXT
        content_for_display, display_type = truncate_content_for_display(content_for_display, display_type)

        return ToolDetail(
            type=display_type,
            data=FileContent(
                file_name=original_file_name,
                content=content_for_display
            )
        )

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        file_path_str = arguments.get("file_path", "")
        file_name = os.path.basename(file_path_str) if file_path_str else i18n.translate("read_file.default_file_label", category="tool.messages")
        return file_name

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None) -> Dict:
        """
        获取工具调用后的友好动作和备注
        """
        if not result.ok:
            # 设置使用自定义 remark
            result.use_custom_remark = True

            # 从 ToolContext 中获取错误类型和文件路径
            error_type = tool_context.get_metadata("error_type")
            error_file_path = tool_context.get_metadata("error_file_path")

            # 如果 metadata 中没有文件路径，从 arguments 中获取
            if not error_file_path and arguments:
                error_file_path = arguments.get("file_path", "")

            # 提取文件名
            file_name = os.path.basename(error_file_path) if error_file_path else ""

            # 根据错误类型返回归类后的通用错误消息
            if error_type:
                if file_name:
                    # 有文件名，使用带文件名的消息
                    remark = i18n.translate(error_type, category="tool.messages", file_name=file_name)
                else:
                    # 没有文件名，使用通用的无文件名错误消息
                    remark = i18n.translate("read_file.error_no_file", category="tool.messages")
            else:
                # 如果没有设置错误类型，使用通用错误消息
                if not error_file_path:
                    error_file_path = i18n.translate("read_file.unknown_file", category="tool.messages")
                remark = i18n.translate("read_file.error", category="tool.messages", file_path=error_file_path)

            return {
                "action": i18n.translate("read_file", category="tool.actions"),
                "remark": remark
            }

        remark = self._get_remark_content(result, arguments)

        return {
            "action": i18n.translate("read_file", category="tool.actions"),
            "remark": remark
        }
