from app.i18n import i18n
import asyncio
import math
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

import aiofiles
import aiofiles.os  # Keep this for os.path.exists etc.
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
from app.tools.workspace_guard_tool import WorkspaceGuardTool
from app.utils.file_timestamp_manager import get_global_timestamp_manager
from app.utils.file_constants import CONVERSION_RECOMMENDED_TYPES
from app.utils.file_utils import is_binary_file
from app.utils.file_parse.utils.libreoffice_util import LibreOfficeUtil

logger = get_logger(__name__) # noqa: F811

# 设置最大Token限制
MAX_TOTAL_TOKENS = 20000

# 超大文件阈值：超过这个Token数的文件，强烈建议使用 grep_search
LARGE_FILE_TOKEN_THRESHOLD = 100000

async def get_or_create_converted_dir(original_file_path: Path) -> Path:
    """获取或创建转换文件目录，目录跟随原文件位置

    Args:
        original_file_path: 原始文件的路径

    Returns:
        Path: 转换文件的输出目录
    """
    # 返回转换文件的输出目录
    return original_file_path.parent

def _get_converted_filename(file_path: Path) -> str:
    """根据文件路径生成转换后的文件名：原文件名.md"""
    return f"{file_path.name}.md"


@dataclass
class TruncationInfo:
    """
    截断信息数据类
    用于存储文件内容被截断时的详细信息，帮助生成对大模型友好的提示
    """
    # 文件总行数
    total_lines: int
    # 截断位置的最后一个完整行的行号（从1开始）
    last_complete_line: int
    # 最后一行是否完整（是否以换行符结尾）
    is_last_line_complete: bool
    # 下次读取应该使用的 offset 值（从0开始）
    next_offset: int
    # 已读取的行数
    lines_read: int
    # 剩余未读的行数
    lines_remaining: int
    # 原始文件的总Token数（截断前）
    original_tokens: int
    # 当前已读取的Token数（截断后）
    current_tokens: int
    # 预计还需要读取的次数
    times_needed: int


def _parse_truncation_info(original_content: str, truncated_content: str, original_tokens: int, current_tokens: int) -> TruncationInfo:
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

    # 6. 计算预计还需要读取的次数
    # 基于剩余Token数和每次最大可读取的Token数（MAX_TOTAL_TOKENS）来估算
    remaining_tokens = original_tokens - current_tokens
    times_needed = math.ceil(remaining_tokens / MAX_TOTAL_TOKENS) if remaining_tokens > 0 else 0

    return TruncationInfo(
        total_lines=total_lines,
        last_complete_line=last_complete_line,
        is_last_line_complete=is_last_line_complete,
        next_offset=next_offset,
        lines_read=lines_read,
        lines_remaining=lines_remaining,
        original_tokens=original_tokens,
        current_tokens=current_tokens,
        times_needed=times_needed
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
    lines.append("\n\n⚠️ 文件内容已截断（内容超出单次读取上限）\n")

    # 1. 文件基本信息
    lines.append("【文件信息】")
    lines.append(f"文件总行数：{info.total_lines} 行\n")

    # 2. 本次读取情况
    lines.append("【本次读取】")
    lines.append(f"已读取：第 1 行到第 {info.last_complete_line} 行（共 {info.lines_read} 行）")

    # 如果最后一行不完整，特别提示
    if not info.is_last_line_complete:
        lines.append(f"⚠️ 注意：第 {info.last_complete_line} 行内容不完整，已在末尾标记 ...")

    lines.append(f"剩余未读：第 {info.last_complete_line + 1} 行到第 {info.total_lines} 行（共 {info.lines_remaining} 行）\n")

    # 3. 截断位置说明
    lines.append("【截断位置】")
    if info.is_last_line_complete:
        lines.append(f"当前截断在第 {info.last_complete_line} 行末尾")
        lines.append(f"如需继续读取，请使用 offset: {info.next_offset}（offset={info.next_offset} 表示从第 {info.next_offset + 1} 行开始）\n")
    else:
        lines.append(f"当前截断在第 {info.last_complete_line} 行中间")
        lines.append(f"如需继续读取，请使用 offset: {info.next_offset}（offset={info.next_offset} 表示从第 {info.next_offset + 1} 行开始，重新读取完整内容）\n")

    # 4. 根据文件大小和预计读取次数给出建议
    lines.append("【继续读取方法】")

    # 判断是否为超大文件
    is_very_large = info.original_tokens > LARGE_FILE_TOKEN_THRESHOLD

    if is_very_large:
        # 超大文件：强烈不建议继续读取
        lines.append(f"🚫 该文件内容非常大，预计需要读取 {info.times_needed}+ 次才能读完")
        lines.append("🚫 非常不建议分次读取完整文件，会消耗大量上下文\n")
        lines.append("强烈建议：")
        lines.append("✓ 使用 grep_search 工具搜索具体内容")
        lines.append("✓ 明确需要查看的函数、类或代码段，然后精准读取")
        lines.append("✓ 询问用户具体需要了解文件的哪部分内容\n")
        lines.append("仅在万不得已时才继续读取：")
    elif info.times_needed >= 4:
        # 需要读取4次以上：强烈建议grep
        lines.append(f"⚠️ 预计还需读取 {info.times_needed} 次才能读完整个文件")
        lines.append("⚠️ 强烈建议使用 grep_search 工具精准搜索所需内容，避免浪费大量上下文\n")
        lines.append("仅在用户明确要求完整阅读时，才使用以下方法继续：")
    elif info.times_needed >= 2:
        # 需要读取2-3次：建议grep但可以继续
        lines.append(f"预计还需读取 {info.times_needed} 次才能读完整个文件")
        lines.append("建议优先使用 grep_search 搜索关键内容，如必须阅读可继续：")
    else:
        # 只需要读取1次：可以继续
        lines.append(f"预计还需读取 {info.times_needed} 次即可完成")

    # 5. 给出具体的继续读取指令
    lines.append("```")
    lines.append(f'file_path: "{file_path}"')
    lines.append(f"offset: {info.next_offset}  # 从第 {info.next_offset + 1} 行开始读取")
    lines.append("limit: -1     # 读取到文件末尾")
    lines.append("```")

    # 6. 如果建议使用 grep_search，给出推荐做法
    if is_very_large or info.times_needed >= 2:
        lines.append("\n推荐做法：")
        lines.append("• 使用 grep_search 搜索关键词、函数名、类名等")
        lines.append("• 定位到具体位置后，再用读文件工具读取局部内容")

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
class ReadFile(AbstractFileTool[ReadFileParams], WorkspaceGuardTool[ReadFileParams]):
    """<!--zh
    读取文件内容工具

    支持的文件类型：
    - 文本文件（.txt、.md、.py、.js、.html、.css、.json、.xml、.yaml等）
    - PDF文件（.pdf）
    - Word文档（.doc、.docx）
    - Excel文件（.xls、.xlsx、.csv）
    - PowerPoint（.ppt、.pptx）
    - Jupyter笔记本（.ipynb）

    注意：
    - 相对路径解析到 .workspace；访问 .workspace 外的文件请使用绝对路径
    - 无法读取支持的文件类型以外的文件，尤其是二进制文件
    - 对于Excel和CSV文件，你可以使用本工具读取文件的前10行了解结构，然后使用Python脚本进行数据分析处理
    - 为避免内容过长超过上下文窗口，读取大文件时可能会被自动截断，若必须阅读完整的情况下，你可以分多次读取

    建议：
    - 当你需要读取多个文件时，强烈建议使用 read_files 工具，而非多次调用本工具，这将会极大提升任务效率
    -->
    Tool for reading file content

    Supported file types:
    - Text files (.txt, .md, .py, .js, .html, .css, .json, .xml, .yaml, etc.)
    - PDF files (.pdf)
    - Word documents (.doc, .docx)
    - Excel files (.xls, .xlsx, .csv)
    - PowerPoint (.ppt, .pptx)
    - Jupyter notebooks (.ipynb)

    Notes:
    - Relative paths resolve to .workspace; use absolute paths for files outside .workspace
    - Cannot read unsupported file types, especially binary files
    - For Excel/CSV files, use this tool to read first 10 lines to understand structure, then use Python script for data analysis
    - To avoid excessive context length, large files may be auto-truncated; if complete reading necessary, you can read in multiple passes

    Suggestions:
    - When reading multiple files, strongly recommend using read_files tool instead of calling this tool multiple times, greatly improves efficiency
    """

    # Initialize MarkItDown with converters
    md = MarkItDown()
    md.register_converter(ExcelConverter())
    md.register_converter(CSVConverter())
    md.register_converter(DocxConverter())

    def get_prompt_hint(self) -> str:
        return """<!--zh: PDF、PowerPoint 等文档会自动转换为 Markdown（如 `report.pdf` -> `report.pdf.md`）-->
Documents like PDF, PowerPoint will be auto-converted to Markdown (e.g., `report.pdf` -> `report.pdf.md`)
"""


    async def _convert_legacy_format(self, file_path: Path) -> Optional[Path]:
        """
        转换旧格式文件到新格式（.xls -> .xlsx, .doc -> .docx）

        Args:
            file_path: 原始文件路径

        Returns:
            Optional[Path]: 转换后的文件路径，失败返回 None
        """
        file_extension = file_path.suffix.lower()

        # 定义需要转换的格式映射
        conversion_map = {
            '.xls': 'xlsx',
            '.doc': 'docx'
        }

        if file_extension not in conversion_map:
            return None

        try:
            import hashlib
            import tempfile

            # 使用系统临时目录
            temp_base = Path(tempfile.gettempdir())
            conversion_dir = temp_base / 'super-magic' / 'libreoffice_conversions'
            conversion_dir.mkdir(parents=True, exist_ok=True)

            # 生成转换后的文件路径（使用文件路径哈希避免冲突）
            target_format = conversion_map[file_extension]
            file_hash = hashlib.md5(str(file_path).encode()).hexdigest()[:8]
            converted_filename = f"{file_path.stem}_{file_hash}.{target_format}"
            converted_path = conversion_dir / converted_filename

            # 检查是否已有转换结果且文件未修改
            if await aiofiles.os.path.exists(converted_path):
                # 检查原文件是否有修改
                is_valid, _ = await get_global_timestamp_manager().validate_file_not_modified(file_path)
                if is_valid:
                    logger.info(f"使用已存在的转换文件: {converted_filename}")
                    return converted_path
                else:
                    logger.info(f"原文件已修改，需要重新转换: {file_path.name}")

            # 执行转换
            logger.info(f"使用 LibreOffice 转换 {file_extension} -> {target_format}: {file_path.name}")
            temp_converted_path = await LibreOfficeUtil.convert_document(
                file_path,
                target_format,
                output_filename_prefix="converted"
            )

            # 将临时文件移动到转换目录
            import shutil
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, shutil.move, str(temp_converted_path), str(converted_path))

            logger.info(f"转换完成: {file_path.name} -> {converted_filename}")
            return converted_path

        except Exception as e:
            logger.error(f"使用 LibreOffice 转换文件失败: {file_path.name}, error={e}")
            return None

    async def _try_read_with_plugin(self, file_path: Path, params: ReadFileParams) -> Optional[ToolResult]:
        """
        尝试使用 MarkItDown plugin 读取文件

        判断逻辑：
        1. 文件扩展名在 plugin 列表中
        2. 或者是二进制文件且不是已知的文本类型（兜底处理）

        注意：建议转换的文件类型（如 PDF、PPT 等）不会使用 plugin 读取，而是走转换逻辑

        对于旧格式（.xls, .doc）：
        1. 先使用 LibreOffice 转换为新格式
        2. 然后使用 MarkItDown 读取转换后的文件

        Args:
            file_path: 文件路径
            params: 读取参数

        Returns:
            Optional[ToolResult]: 如果适合用 plugin 读取则返回 ToolResult，否则返回 None
        """
        file_extension = file_path.suffix.lower()

        # 如果文件类型在建议转换列表中，不使用 plugin 读取，而是走转换逻辑
        if file_extension in CONVERSION_RECOMMENDED_TYPES:
            return None

        # 检查是否是二进制文件
        is_binary = await is_binary_file(file_path)

        # 定义需要用 plugin 处理的扩展名
        plugin_extensions = {'.xlsx', '.xls', '.csv', '.docx', '.doc', '.ipynb'}

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

        # 对于旧格式，先转换（隐式转换，不告知用户）
        actual_read_path = file_path

        if file_extension in ['.xls', '.doc']:
            logger.info(f"检测到旧格式文件，尝试转换: {file_path.name}")
            converted_path = await self._convert_legacy_format(file_path)

            # 使用 LibreOffice 转换旧格式文件失败，提示大模型让用户手动进行转换
            if not converted_path:
                return ToolResult.error(
                    f"该文件是旧格式（{file_extension}），无法直接读取: {file_path.name}\n"
                    f"请建议用户使用 Office 软件将文件转换为新格式（.xls -> .xlsx, .doc -> .docx）后重新上传"
                )

            actual_read_path = converted_path
            logger.info(f"使用转换后的文件: {converted_path.name}")

        # 使用 plugin 读取
        logger.info(f"使用 plugin 读取文件: {actual_read_path.name} (原文件: {file_path.name}, 扩展名: {file_extension}, 二进制: {is_binary})")

        markdown_content = await self._read_using_plugin(actual_read_path, params.offset, params.limit)

        if not markdown_content:
            return ToolResult.error(
                f"读取文件工具不支持该文件格式（{file_extension}）: {file_path.name}\n"
                f"请尝试使用其它合适的工具或其它方式来处理该文件"
            )

        # 构建返回结果
        content_tokens = num_tokens_from_string(markdown_content)

        # 添加文件元信息
        # 注意：不显示Token数，避免大模型混淆（Token数对大模型无实际意义）
        meta_info = f"# 文件: {file_path.name}\n\n"
        meta_info += f"**文件信息**: 通过插件读取，内容已转换为 Markdown 格式\n\n---\n\n"

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
            "is_converted": False,  # 旧格式隐式转换，不标记为已转换（不告知用户）
            "conversion_strategy": None
        }

        # 读取文件后更新时间戳
        await get_global_timestamp_manager().update_timestamp(file_path)

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
            Optional[str]: 转换后的 Markdown 内容，如果失败返回 None
        """
        try:
            file_extension = file_path.suffix.lower()

            # 定义同步转换函数（在线程池中执行）
            def convert_sync():
                with open(file_path, 'rb') as f:
                    result = self.md.convert(
                        f,
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

    async def _check_and_get_converted_path(self, file_path: Path) -> tuple[Optional[Path], Optional[str], Optional[str]]:
        """
        检查和获取转换后的文件路径

        逻辑：
        1. 检查是否已有转换结果
        2. 如果没有则调用 convert_to_markdown 工具自动转换
        3. 返回转换后的文件路径和转换策略

        转换文件命名规则：
        - 文件名：原文件名.md（例如：report.pdf -> report.pdf.md）

        Args:
            file_path: 原始文件路径

        Returns:
            tuple[Optional[Path], Optional[str], Optional[str]]: (转换后文件路径, 错误信息, 转换策略)
            - 如果返回 (None, None, None)，表示不需要转换，继续原始逻辑
            - 如果返回 (None, error_msg, None)，表示转换失败
            - 如果返回 (converted_path, None, strategy)，表示找到了转换后的文件路径
        """
        try:
            file_extension = file_path.suffix.lower()

            # 如果不是需要转换的文件类型，直接继续原始逻辑
            if file_extension not in CONVERSION_RECOMMENDED_TYPES:
                return None, None, None

            # 1. 检查是否已有转换结果
            converted_path = await self._check_converted_file(file_path)
            if converted_path:
                logger.info(f"使用已存在的转换结果: {file_path.name} -> {converted_path.name}")
                return converted_path, None, None

            # 2. 执行自动转换
            converted_file_path, conversion_strategy = await self._perform_auto_conversion(file_path)
            if converted_file_path:
                logger.info(f"执行自动转换成功: {file_path.name} -> {converted_file_path.name}, 策略: {conversion_strategy}")
                return converted_file_path, None, conversion_strategy

            # 3. 转换失败，返回错误
            error_msg = f"""自动转换失败，请使用 `convert_to_markdown` 工具手动转换。

**文件**: `{file_path.name}` ({file_extension})

**说明**: PDF、Word、PowerPoint 等文档格式需要转换为 Markdown 格式才能更好地阅读和理解。
转换后的文件命名为 `{file_path.name}.md`。"""
            return None, error_msg, None

        except Exception as e:
            logger.error(f"检查转换文件时出错: '{file_path}', error={e}")
            error_msg = f"处理文件转换时出错，请使用 `convert_to_markdown` 工具手动转换文件 `{file_path.name}`。"
            return None, error_msg, None

    async def _check_converted_file(self, file_path: Path) -> Optional[Path]:
        """
        检查是否已有转换文件

        逻辑：
        1. 检查文件是否未被修改
        2. 如果没有修改，检查转换后的 原文件名.md 是否存在

        Args:
            file_path: 原始文件路径

        Returns:
            Optional[Path]: 转换文件路径，如果不存在则返回 None
        """
        try:
            # 检查文件是否未被修改
            is_file_valid, _ = await get_global_timestamp_manager().validate_file_not_modified(file_path)
            if not is_file_valid:
                logger.debug(f"文件已修改，缓存失效: {file_path.name}")
                return None

            # 生成转换文件名
            converted_filename = _get_converted_filename(file_path)
            converted_dir = await get_or_create_converted_dir(file_path)
            converted_file_path = converted_dir / converted_filename

            # 检查转换文件是否存在
            if await aiofiles.os.path.exists(converted_file_path):
                return converted_file_path
            else:
                logger.debug(f"转换文件不存在: {converted_filename}")
                return None

        except Exception as e:
            logger.debug(f"检查转换文件时出错: {file_path}, error={e}")
            return None

    async def _validate_converted_file(self, converted_file_path: str) -> bool:
        """验证转换后文件是否有效"""
        try:
            workspace_root = self.base_dir
            full_converted_path = workspace_root / converted_file_path
            return await aiofiles.os.path.exists(full_converted_path)
        except Exception as e:
            logger.debug(f"验证转换后文件失败: {converted_file_path}, error={e}")
            return False

    async def _perform_auto_conversion(self, file_path: Path) -> tuple[Optional[Path], Optional[str]]:
        """
        执行自动转换并保存，带缓存检查

        步骤：
        1. 检查文件是否有变动，如果没有变动且转换文件存在，直接返回缓存
        2. 如果需要转换，使用 原文件名.md 作为转换文件名
        3. 调用 convert_to_markdown 工具进行文件转换
        4. 更新文件时间戳记录
        5. 返回转换后文件路径和转换策略

        Returns:
            tuple[Optional[Path], Optional[str]]: (转换后文件路径, 转换策略)
        """
        try:
            from app.paths import PathManager
            workspace_root = PathManager.get_workspace_dir()

            # 1. 检查缓存：文件是否有变动
            try:
                is_file_valid, _ = await get_global_timestamp_manager().validate_file_not_modified(file_path)
                if is_file_valid:
                    # 文件没有变动，检查转换文件是否存在
                    converted_filename = _get_converted_filename(file_path)
                    converted_dir = await get_or_create_converted_dir(file_path)
                    converted_file_path = converted_dir / converted_filename

                    if await aiofiles.os.path.exists(converted_file_path):
                        logger.info(f"使用缓存的转换结果: {file_path.name} -> {converted_filename}")
                        return converted_file_path, None

                logger.debug(f"需要重新转换文件: {file_path.name}")
            except Exception:
                # 如果时间戳检查失败（比如第一次访问文件），继续转换流程
                logger.debug(f"时间戳检查失败，继续转换流程: {file_path.name}")

            # 2. 执行新的转换
            # 延迟导入以避免循环依赖
            from app.tools.convert_to_markdown import ConvertToMarkdown, ConvertToMarkdownParams

            # 创建转换目录
            converted_dir = await get_or_create_converted_dir(file_path)

            # 生成转换文件名
            converted_filename = _get_converted_filename(file_path)

            # 计算相对路径（相对于工作区根目录）
            input_file_relative_path = str(file_path.relative_to(workspace_root))
            output_file_relative_path = str((converted_dir / converted_filename).relative_to(workspace_root))

            # 创建 convert_to_markdown 工具参数
            convert_params = ConvertToMarkdownParams(
                input_path=input_file_relative_path,
                output_path=output_file_relative_path,
                override=True,  # 允许覆盖
                force_refresh=True,  # 强制转换，因为缓存检查已经在上面完成
                extract_images=True  # 提取图片
            )

            # 创建并执行转换工具
            converter = ConvertToMarkdown()
            # 设置 base_dir 以确保路径解析正确
            converter.base_dir = workspace_root

            # 执行转换
            convert_result = await converter.execute_purely(convert_params)

            if not convert_result.ok:
                logger.warning(f"自动转换失败: {file_path.name}, error={convert_result.content}")
                return None, None

            # 获取转换策略
            conversion_strategy = None
            if convert_result.extra_info:
                conversion_strategy = convert_result.extra_info.get("conversion_strategy")

            # 获取转换后的文件路径
            output_file_path = converted_dir / converted_filename

            if not await aiofiles.os.path.exists(output_file_path):
                logger.warning(f"转换后文件不存在: {output_file_path}")
                return None, None

            logger.info(f"自动转换完成: {file_path.name} -> {converted_filename}, 策略: {conversion_strategy}")
            return output_file_path, conversion_strategy

        except Exception as e:
            logger.error(f"执行自动转换时出错: {file_path.name}, error={e}")
            return None, None

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
        1. 对于建议转换的文件类型，检查是否有转换结果，没有则自动转换
        2. 对于其他文件类型，直接进行文件读取

        Args:
            params: 文件读取参数

        Returns:
            ToolResult: 包含文件内容或错误信息
        """
        try:
            # 使用父类方法获取安全的文件路径（包含模糊匹配）
            file_path, error, fuzzy_warning = self.get_safe_path_with_fuzzy_match(params.file_path)
            if error:
                return ToolResult.error(error)

            # 检查文件是否存在
            if not await aiofiles.os.path.exists(file_path):
                if tool_context:
                    tool_context.set_metadata("error_type", "read_file.error_file_not_exist")
                    tool_context.set_metadata("error_file_path", params.file_path)
                return ToolResult.error(f"无法找到要读取的文件: {params.file_path}")
            if await aiofiles.os.path.isdir(file_path):
                if tool_context:
                    tool_context.set_metadata("error_type", "read_file.error_is_directory")
                    tool_context.set_metadata("error_file_path", params.file_path)
                return ToolResult.error(f"指定路径是个文件夹: {params.file_path}，请使用 list_dir 工具获取文件夹内容")

            # === 第一步：尝试使用 plugin 直接读取 ===
            plugin_result = await self._try_read_with_plugin(file_path, params)
            if plugin_result is not None:
                # 如果有模糊匹配警告，添加到 plugin 读取结果的末尾
                if fuzzy_warning and plugin_result.ok:
                    plugin_result.content = f"{plugin_result.content}\n\n---\n\n{fuzzy_warning}"
                return plugin_result

            # === 第二步：对于其他文件类型，继续原有的转换逻辑 ===
            original_file_name = file_path.name
            read_path = file_path  # 默认读取原始文件路径
            conversion_strategy = None  # 记录转换策略

            # 检查是否有转换后的文件可以读取
            converted_path, error_msg, strategy = await self._check_and_get_converted_path(file_path)
            if error_msg:
                # 转换失败，直接返回错误
                if tool_context:
                    tool_context.set_metadata("error_type", "read_file.error_conversion_failed")
                    tool_context.set_metadata("error_file_path", str(file_path))
                return ToolResult.error(error_msg)
            elif converted_path:
                # 找到了转换后的文件，修改读取路径
                read_path = converted_path
                conversion_strategy = strategy
                logger.info(f"使用转换后的文件进行读取: '{original_file_name}' -> '{read_path.name}'")

            # === 第三步：执行实际的文件读取逻辑 ===

            # 检查要读取的文件是否存在（可能是转换后的文件）
            if not await aiofiles.os.path.exists(read_path):
                if str(read_path) != str(file_path):
                    # 转换后的文件不存在
                    if tool_context:
                        tool_context.set_metadata("error_type", "read_file.error_conversion_failed")
                        tool_context.set_metadata("error_file_path", str(file_path))
                    return ToolResult.error(f"转换后的文件不存在: {read_path.name}，请尝试重新转换或直接读取原文件")
                else:
                    if tool_context:
                        tool_context.set_metadata("error_type", "read_file.error_file_not_exist")
                        tool_context.set_metadata("error_file_path", params.file_path)
                    return ToolResult.error(f"无法找到要读取的文件: {params.file_path}")
            if await aiofiles.os.path.isdir(read_path):
                if tool_context:
                    tool_context.set_metadata("error_type", "read_file.error_is_directory")
                    tool_context.set_metadata("error_file_path", params.file_path)
                return ToolResult.error(f"指定路径是个文件夹: {params.file_path}，请使用 list_dir 工具获取文件夹内容")

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

            # 计算token数量并处理截断
            original_content = content  # 保存原始完整内容，用于解析截断信息
            original_tokens = num_tokens_from_string(content)
            content_tokens = original_tokens
            total_chars = len(content)
            content_truncated = False

            if content_tokens > MAX_TOTAL_TOKENS:
                logger.info(f"文件 {read_path.name} (原始: {original_file_name}) 内容token数 ({content_tokens}) 超出限制 ({MAX_TOTAL_TOKENS})，进行截断")
                content_truncated = True

                # 使用二分查找确定最佳截断点
                # 目标：找到最大的内容长度，使得Token数不超过 MAX_TOTAL_TOKENS
                left, right = 0, len(content)
                best_content = ""
                best_tokens = 0

                while left <= right:
                    mid = (left + right) // 2
                    truncated = content[:mid]
                    tokens = num_tokens_from_string(truncated)

                    if tokens <= MAX_TOTAL_TOKENS:
                        best_content = truncated
                        best_tokens = tokens
                        left = mid + 1
                    else:
                        right = mid - 1

                # 更新为截断后的内容
                truncated_content = best_content
                content_tokens = best_tokens

                # 解析截断信息：计算行号、offset等
                truncation_info = _parse_truncation_info(
                    original_content=original_content,
                    truncated_content=truncated_content,
                    original_tokens=original_tokens,
                    current_tokens=content_tokens
                )

                # 如果最后一行不完整，在末尾添加省略号标记
                if not truncation_info.is_last_line_complete:
                    truncated_content += "..."

                # 根据模式决定如何处理截断提示
                if raw_mode:
                    # 原始模式：不在content中添加提示，纯粹的数据通过extra_info传递
                    content = truncated_content
                    # 截断信息会在后面添加到extra_info中，供调用者使用
                else:
                    # 格式化模式：生成并添加面向大模型的详细截断提示
                    truncation_message = _build_truncation_message(truncation_info, original_file_name)
                    content = truncated_content + truncation_message

            # 添加文件元信息 - 使用 original_file_name 作为用户看到的文件名，read_path 用于内部信息
            shown_chars = len(content)
            truncation_status = "（已截断）" if content_truncated else ""

            # 构建元信息
            meta_info = f"# 文件: {original_file_name}\n\n"

            # 如果读取的是转换后的文件，明确告知
            if str(read_path) != str(file_path):
                converted_filename = _get_converted_filename(file_path)
                meta_info += f"**注意**: 该文件已自动转换为 Markdown 格式，读取的是转换后的文件 `{converted_filename}`\n\n"
                meta_info += f"**重要提示**: 后续读取该文档时，请直接使用 `{converted_filename}` 路径，避免重复转换，可大幅减少上下文长度。\n\n"

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
                "is_converted": str(read_path) != str(file_path),  # 是否读取的是转换后的文件
                "conversion_strategy": conversion_strategy,  # 转换策略
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

            # 读取文件后更新时间戳
            await get_global_timestamp_manager().update_timestamp(file_path)

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
        async with aiofiles.open(file_path, "r", encoding="utf-8", errors="replace") as f:
            line_number = 1
            async for line in f:
                # 移除行尾换行符
                line_content = line.rstrip('\n\r')
                # 添加行号前缀，格式: lineNumber\tcontent (cat -n 的输出格式)
                formatted_line = f"{line_number}\t{line_content}\n"
                lines_with_numbers.append(formatted_line)
                # 不带行号的版本，保持原始换行符
                lines_without_numbers.append(line_content + "\n")
                line_number += 1

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

        async with aiofiles.open(file_path, "r", encoding="utf-8", errors="replace") as f:
            line_idx = 0
            async for line in f:
                all_lines.append(line)
                line_idx += 1

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
            # 纯文本文件根据转换后的文件扩展名确定显示类型
            display_type = self.get_display_type_by_extension(read_path_str)

        # 优先使用不带行号的内容版本，如果不存在则回退到带行号的版本
        content_for_display = (
            result.extra_info.get("raw_content_without_line_numbers") or
            result.extra_info["raw_content"]
        )

        return ToolDetail(
            type=display_type,
            data=FileContent(
                # Show the original requested filename to the user
                # 向用户显示原始请求的文件名
                file_name=original_file_name,
                # Content is preferably without line numbers for better display
                # 内容优先使用不带行号的版本以获得更好的显示效果
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

        # 如果是转换后的文件，在 remark 中添加转换标识和策略
        if result.extra_info and result.extra_info.get("is_converted"):
            conversion_strategy = result.extra_info.get("conversion_strategy")
            if conversion_strategy and isinstance(conversion_strategy, str) and conversion_strategy != "balanced":
                # 获取转换策略的翻译
                strategy_code_mapping = {
                    "performance": "read_file.conversion_strategy_performance",
                    "quality": "read_file.conversion_strategy_quality",
                    "balanced": "read_file.conversion_strategy_balanced"
                }
                strategy_code = strategy_code_mapping.get(conversion_strategy, "read_file.conversion_strategy_balanced")
                strategy_display = i18n.translate(strategy_code, category="tool.messages")
                conversion_info = i18n.translate("read_file.converted_and_read_with_strategy", category="tool.messages", strategy=strategy_display)
                remark = f"{conversion_info} {remark}"
            else:
                conversion_info = i18n.translate("read_file.converted_and_read", category="tool.messages")
                remark = f"{conversion_info} {remark}"

        return {
            "action": i18n.translate("read_file", category="tool.actions"),
            "remark": remark
        }
