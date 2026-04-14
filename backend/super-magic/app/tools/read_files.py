from app.i18n import i18n
import math
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from agentlang.utils.token_estimator import num_tokens_from_string
from app.core.entity.message.server_message import (DisplayType, FileContent,
                                                    ToolDetail)
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.read_file import ReadFile, ReadFileParams, TruncationInfo, _compute_max_tokens, _get_context_remaining
from app.tools.workspace_tool import WorkspaceTool

logger = get_logger(__name__)

# 批量读取的 token 总量上限（高于单文件，允许一次性读多个文件）
DEFAULT_BATCH_MAX_TOKENS = 60000
# 动态上限：占剩余上下文窗口的比例（与单文件工具共用同一比例）
BATCH_MAX_TOKENS_RATIO = 0.40
# 保底：上下文极度紧张时仍保留最小可用量
BATCH_MIN_MAX_TOKENS = 5000


def _compute_batch_max_tokens(tool_context) -> int:
    """根据剩余上下文窗口动态计算批量读取的总 token 上限。"""
    remaining = _get_context_remaining(tool_context)
    if remaining <= 0:
        return DEFAULT_BATCH_MAX_TOKENS
    dynamic = int(remaining * BATCH_MAX_TOKENS_RATIO)
    return max(BATCH_MIN_MAX_TOKENS, min(DEFAULT_BATCH_MAX_TOKENS, dynamic))


class FileReadOperation(BaseModel):
    """<!--zh: 单个文件的读取操作-->
Single file read operation"""
    file_path: str = Field(
        ...,
        description="""<!--zh: 文件路径，相对于工作目录或绝对路径-->
File path, relative to working directory or absolute path"""
    )
    offset: int = Field(
        default=0,
        description="""<!--zh: 开始读取的行号（从0开始），支持负数表示从文件末尾开始计算（例如 -10 表示最后10行的起始位置）-->
Starting line number to read from (0-based), supports negative numbers to count from file end (e.g., -10 for last 10 lines starting position)"""
    )
    limit: int = Field(
        default=200,
        description="""<!--zh: 要读取的行数，默认200行，设置为-1读取整个文件-->
Number of lines to read, default 200 lines, set to -1 to read entire file"""
    )

class ReadFilesParams(BaseToolParams):
    operations: List[FileReadOperation] = Field(
        ...,
        description="""<!--zh: 文件读取操作列表-->
File read operations list""",
        min_items=1
    )

class FileReadingResult(BaseModel):
    """单个文件的读取结果"""
    file_path: str
    content: str  # 完整内容（包含元信息）
    is_success: bool
    error_message: Optional[str] = None
    error_type: Optional[str] = None  # 错误类型 code，来自 tool_context metadata
    tokens: int = 0  # token数量，用于计算截断
    # 截断信息（如果被截断）
    was_truncated: bool = False  # 是否被截断
    truncation_info: Optional[Union[TruncationInfo, Dict[str, Any]]] = None  # 截断详情（用于生成提示）


@tool()
class ReadFiles(AbstractFileTool[ReadFilesParams], WorkspaceTool[ReadFilesParams]):
    """<!--zh
    批量读取文件内容工具

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

    强烈建议在需要批量读取多个参考文件时使用此工具一次性读取，而非多次调用工具逐个读取，这将会极大提升任务效率
    -->
    Batch read files content tool

    Supported file types:
    - Text files (.txt, .md, .py, .js, .html, .css, .json, .xml, .yaml, etc.)
    - PDF files (.pdf)
    - Word documents (.doc, .docx)
    - Excel files (.xls, .xlsx, .csv)
    - PowerPoint (.ppt, .pptx)
    - Jupyter notebooks (.ipynb)

    Notes:
    - Relative paths resolve to .workspace; use absolute paths for files outside .workspace
    - Cannot read files other than supported types, especially binary files
    - For Excel/CSV files, use this tool to read first 10 lines to understand structure, then use Python scripts for data analysis
    - Large files may be auto-truncated to avoid exceeding context window; read in multiple operations if full content needed

    Strongly recommended to use this tool for batch reading multiple reference files at once, rather than calling tools multiple times individually, which will greatly improve task efficiency
    """

    async def execute(self, tool_context: ToolContext, params: ReadFilesParams) -> ToolResult:
        """
        执行批量文件读取操作

        Args:
            tool_context: 工具上下文
            params: 批量文件读取参数

        Returns:
            ToolResult: 包含批量文件内容或错误信息
        """
        if not params.operations:
            tool_context.set_metadata("error_type", "read_file.failed")
            return ToolResult.error(i18n.translate("read_file.failed", category="tool.messages"))

        results = []
        files_without_line_numbers = []  # 直接在这里收集不带行号的内容
        read_file_tool = ReadFile()
        read_file_tool.base_dir = self.base_dir
        read_failure_count = 0
        has_truncation = False

        # 批量处理每个文件操作，收集结果
        for operation in params.operations:
            try:
                # 构造单文件读取参数
                file_params = ReadFileParams(
                    file_path=operation.file_path,
                    offset=operation.offset,
                    limit=operation.limit,
                    explanation=params.explanation if hasattr(params, 'explanation') else ""
                )

                # 调用 ReadFile 工具读取单个文件
                # 使用 raw_mode=True 获取纯粹的结构化数据，截断提示由read_files统一管理
                result = await read_file_tool.execute(tool_context, file_params, raw_mode=True)

                if result.ok:
                    # 直接使用content（已经不包含截断提示了）
                    content = result.content
                    tokens = num_tokens_from_string(content)

                    # 从extra_info中获取截断信息（通过数据结构传递，而非字符串解析）
                    was_truncated_by_read_file = result.extra_info.get("was_truncated", False)
                    truncation_info_from_read_file = result.extra_info.get("truncation_info")

                    # 同时收集不带行号的内容（如果可用）
                    if result.extra_info and "raw_content_without_line_numbers" in result.extra_info:
                        raw_content_without_line_numbers = result.extra_info["raw_content_without_line_numbers"]
                        # 确保原始内容不为 None，如果为 None 则使用带行号的原始内容作为备用
                        safe_raw_content = raw_content_without_line_numbers if raw_content_without_line_numbers is not None else result.extra_info.get("raw_content", "")
                        read_method = result.extra_info.get("read_method", "unknown")  # 获取读取方式
                        is_converted = result.extra_info.get("is_converted", False)  # 是否转换
                        conversion_strategy = result.extra_info.get("conversion_strategy")  # 转换策略
                        files_without_line_numbers.append({
                            "file_path": operation.file_path,
                            "content": safe_raw_content,
                            "read_method": read_method,
                            "is_converted": is_converted,
                            "conversion_strategy": conversion_strategy
                        })

                    # ReadFile 工具已经设置了时间戳，这里不需要重复设置
                    # 但为了确保一致性，我们记录一下日志
                    logger.debug(f"文件读取成功，时间戳已由 ReadFile 工具设置: {operation.file_path}")

                    # 创建文件读取结果对象
                    # 截断信息通过extra_info获取，不再需要字符串解析
                    file_result = FileReadingResult(
                        file_path=operation.file_path,
                        content=content,
                        is_success=True,
                        tokens=tokens,
                        was_truncated=was_truncated_by_read_file,
                        truncation_info=truncation_info_from_read_file  # 直接使用从read_file获取的TruncationInfo对象
                    )

                    results.append(file_result)
                else:
                    results.append(FileReadingResult(
                        file_path=operation.file_path,
                        content="",
                        is_success=False,
                        error_message=result.content,  # 失败时，content 实际是错误信息
                        error_type=tool_context.get_metadata("error_type"),
                        tokens=0
                    ))
                    read_failure_count += 1
            except Exception as e:
                logger.exception(f"读取文件失败: {str(e)}")
                results.append(FileReadingResult(
                    file_path=operation.file_path,
                    content="",
                    is_success=False,
                    error_message=f"读取文件异常: {e!s}",
                    tokens=0
                ))
                read_failure_count += 1

        # 检查是否需要截断内容以符合token限制
        total_content_tokens = sum(result.tokens for result in results if result.is_success)

        # 根据剩余上下文动态计算批量上限，预留 500 token 给摘要头部
        batch_max = _compute_batch_max_tokens(tool_context)
        available_tokens = max(0, batch_max - 500)

        # 如果内容token数超出限制，进行截断
        if total_content_tokens > available_tokens:
            has_truncation = True
            logger.info(f"内容总token数({total_content_tokens})超出限制({available_tokens})，进行截断")
            results = self._truncate_contents(results, available_tokens)

        # 生成摘要信息
        total_files = len(params.operations)
        success_count = total_files - read_failure_count
        truncation_info = "，内容已截断" if has_truncation else ""

        # 如果有失败文件，添加提示信息
        failure_hint = ""
        if read_failure_count > 0:
            failure_hint = "。请检查失败文件的具体错误信息，可能需要修正文件名或路径"

        summary = i18n.translate("read_file.summary", category="tool.messages", total=total_files,
                                         success=success_count,
                                         failed=read_failure_count,
                                         truncation=truncation_info) + failure_hint

        # 格式化最终结果
        formatted_result = self._format_results(results, summary, has_truncation)

        # 记录实际token数
        actual_tokens = num_tokens_from_string(formatted_result)
        logger.info(f"最终输出token数: {actual_tokens}")

        return ToolResult(
            content=formatted_result,
            system=summary,
            extra_info={
                "files_without_line_numbers": files_without_line_numbers,
                "file_results": [
                    {
                        "file_path": item.file_path,
                        "is_success": item.is_success,
                        "error_type": item.error_type,
                    }
                    for item in results
                ],
                "success_count": success_count,
                "failure_count": read_failure_count,
            }
        )

    def _truncate_contents(self, results: List[FileReadingResult], available_tokens: int) -> List[FileReadingResult]:
        """
        采用顺序保留策略截断内容

        策略说明：
        - 优先保证前面的文件完整读取
        - 只有当前面所有文件都完整保留后，剩余token不足时，才截断当前文件
        - 这样做的好处：大模型至少能看到一些完整的文件，而不是所有文件都不完整

        Args:
            results: 文件读取结果列表
            available_tokens: 可用的token数

        Returns:
            截断后的结果列表
        """
        successful_files = [r for r in results if r.is_success]

        if not successful_files:
            return results

        remaining_tokens = available_tokens

        # 顺序处理每个文件
        for result in successful_files:
            if result.tokens <= remaining_tokens:
                # Token足够，完整保留这个文件
                remaining_tokens -= result.tokens
            else:
                # Token不足，需要截断这个文件
                allocated_tokens = remaining_tokens

                if allocated_tokens < 300:
                    # 剩余token太少，无法保留有意义的内容，直接标记为截断
                    result.was_truncated = True
                    result.content = "[File content cannot be shown: token budget exhausted. Read this file separately.]"
                    result.tokens = 0
                else:
                    # 截断到剩余token数
                    content = result.content

                    # 通过二分查找找到合适的截断点
                    left, right = 0, len(content)
                    best_content = ""
                    best_tokens = 0

                    while left <= right:
                        mid = (left + right) // 2
                        truncated = content[:mid]
                        tokens = num_tokens_from_string(truncated)

                        if tokens <= allocated_tokens:
                            best_content = truncated
                            best_tokens = tokens
                            left = mid + 1
                        else:
                            right = mid - 1

                    # 判断最后一行是否完整
                    is_last_line_complete = best_content.endswith('\n')
                    if not is_last_line_complete and best_content.strip():
                        # 最后一行不完整，添加省略号标记
                        best_content += "..."

                    # 更新结果
                    result.content = best_content
                    result.tokens = best_tokens
                    result.was_truncated = True

                    # 解析行号信息，用于生成指导（通过辅助函数）
                    line_info = _parse_line_info_from_content(best_content)

                    # 如果没有从read_file获取到truncation_info，创建一个简化的
                    if result.truncation_info is None:
                        # 构建简化的截断信息对象（用于生成指导）
                        if line_info:
                            result.truncation_info = {
                                "last_line": line_info["last_line"],
                                "is_last_line_complete": line_info["is_complete"],
                                "from_read_files": True
                            }

                # 后续文件都没有token了
                remaining_tokens = 0

        return results

    def _format_results(self, results: List[FileReadingResult], summary: str, has_truncation: bool) -> str:
        """
        格式化多个文件的读取结果

        重要：截断提示会在最后统一添加，不参与token限制计算，确保大模型一定能看到

        Args:
            results: 文件读取结果列表
            summary: 摘要信息
            has_truncation: 是否有内容被截断

        Returns:
            格式化后的结果文本
        """
        formatted_parts = []

        # 添加摘要信息
        formatted_parts.append(f"# 读取文件结果\n\n{summary}\n")

        if has_truncation:
            formatted_parts.append("> [Some file content was truncated. See end of output for how to continue reading.]\n")

        # 添加分隔线
        formatted_parts.append("-" * 80 + "\n")

        # 添加每个文件的内容
        truncated_files = []  # 收集所有被截断的文件，用于最后生成详细指导
        has_skill_reference_path_not_found = False  # 仅当像 skill reference 路径时才输出 Skill Hint

        for idx, result in enumerate(results):
            # 添加文件分隔符（除了第一个文件）
            if idx > 0:
                formatted_parts.append("\n\n" + "-" * 3 + "\n\n")

            if result.is_success:
                # 添加文件内容（不包含截断提示）
                formatted_parts.append(result.content)

                # 如果这个文件被截断了，收集信息
                if result.was_truncated:
                    truncated_files.append(result)
            else:
                # 对失败的文件只输出错误信息，不在每个文件下重复 Skill Hint
                if result.error_message:
                    formatted_parts.append(f"## 文件: {result.file_path}\n\n**读取失败**: {result.error_message}\n")
                    # 标记：只有相对路径且路径段里包含 reference 时，才认为像 skill reference 路径
                    if (
                        result.error_type == "read_file.error_file_not_exist"
                        and not result.file_path.startswith("/")
                        and "reference" in Path(result.file_path).parts
                    ):
                        has_skill_reference_path_not_found = True
                else:
                    error_detail = i18n.translate("read_file.error_detail", category="tool.messages")
                    formatted_parts.append(f"## 文件: {result.file_path}\n\n{error_detail}\n")

        # Skill 相对路径 Hint：整批只输出一次，位于所有文件内容之后
        if has_skill_reference_path_not_found:
            formatted_parts.append(
                "\n\n[Hint] One or more file paths are relative and were not found. "
                "If you are reading skill-related files, you MUST construct absolute paths. "
                "Prefer the `<skill_dir>` tag for the absolute skill directory; "
                "if unavailable, strip the filename from the `<location>` tag to get the skill directory, "
                "then append the relative path from the skill content.\n"
                "Example: `read_files(operations=[{'file_path': '/absolute/path/to/skill-dir/reference/doc.md'}])`"
            )

        # Truncation guidance appended after all file content — not counted against the token budget,
        # so the model always sees the instructions even when budget is tight.
        if truncated_files:
            formatted_parts.append("\n\n" + "=" * 80 + "\n")
            formatted_parts.append("# [Truncated files — how to continue reading]\n")
            formatted_parts.append("\nThe following files were truncated. Use the parameters below to read the rest:\n")

            for result in truncated_files:
                if result.truncation_info:
                    if isinstance(result.truncation_info, TruncationInfo):
                        guidance = _build_truncation_guidance_from_truncation_info(
                            result.file_path,
                            result.truncation_info
                        )
                        formatted_parts.append(guidance)
                    elif isinstance(result.truncation_info, dict):
                        last_line = result.truncation_info.get("last_line")
                        is_complete = result.truncation_info.get("is_last_line_complete", True)
                        if last_line:
                            guidance = _build_simple_truncation_guidance(
                                result.file_path,
                                last_line,
                                is_complete
                            )
                            formatted_parts.append(guidance)
                        else:
                            formatted_parts.append(f"\n## File: `{result.file_path}`\n")
                            formatted_parts.append("Content truncated. Read this file separately to get the full content.\n")
                    else:
                        formatted_parts.append(f"\n## File: `{result.file_path}`\n")
                        formatted_parts.append("Content truncated. Read this file separately to get the full content.\n")
                else:
                    formatted_parts.append(f"\n## File: `{result.file_path}`\n")
                    formatted_parts.append("Content truncated. Read this file separately to get the full content.\n")

            formatted_parts.append("\n" + "-" * 80 + "\n")
            formatted_parts.append("\nTip: use grep_search to locate specific content (keywords, function names, class names) instead of reading large files in full.\n")

        return "\n".join(formatted_parts)

    def _get_failure_reason_label(self, error_type: Optional[str]) -> str:
        if error_type == "read_file.error_file_not_exist":
            key = "read_file.detail_reason_not_exist"
        elif error_type == "read_file.error_is_directory":
            key = "read_file.detail_reason_is_directory"
        elif error_type == "read_file.error_conversion_failed":
            key = "read_file.detail_reason_conversion_failed"
        elif error_type == "read_file.error_unexpected":
            key = "read_file.detail_reason_unexpected"
        else:
            key = "read_file.detail_reason_unknown"
        return i18n.translate(key, category="tool.messages")

    def _build_failure_detail_markdown(
        self,
        file_results: list[dict[str, Any]],
        success_count: int,
        failure_count: int,
    ) -> Optional[str]:
        """构造给前端展示的人类可读失败摘要（不含给 AI 的诊断信息）。"""
        file_count = len(file_results)
        if file_count == 0:
            return None

        title = i18n.translate("read_file.detail_failed_title", category="tool.messages")
        summary = i18n.translate(
            "read_file.detail_failed_summary",
            category="tool.messages",
            total=file_count,
            success=success_count,
            failed=failure_count,
        )
        list_header = i18n.translate("read_file.detail_failed_list_header", category="tool.messages")

        lines = [f"## {title}", "", summary, "", list_header]
        for item in file_results:
            if item.get("is_success"):
                continue
            reason = self._get_failure_reason_label(item.get("error_type"))
            lines.append(f"- `{os.path.basename(item.get('file_path', ''))}` — {reason}")

        return "\n".join(lines)

    def _build_failure_tool_detail(
        self,
        file_results: list[dict[str, Any]],
        success_count: int,
        failure_count: int,
    ) -> Optional[ToolDetail]:
        """构造失败时给前端展示的人类可读摘要（不含给 AI 的诊断信息）。"""
        markdown = self._build_failure_detail_markdown(
            file_results=file_results,
            success_count=success_count,
            failure_count=failure_count,
        )
        if markdown is None:
            return None

        title = i18n.translate("read_file.detail_failed_title", category="tool.messages")
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(
                file_name=title,
                content=markdown,
            )
        )

    def _escape_code_blocks_for_display(self, content: str) -> str:
        """
        转义内容中的代码块标记以避免前端 Markdown 渲染问题

        Args:
            content: 需要转义的内容

        Returns:
            转义后的内容
        """
        # 将```替换为\`\`\`避免渲染问题
        return content.replace('```', '\\`\\`\\`')

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
        if not arguments or "operations" not in arguments:
            logger.warning("没有提供operations参数")
            return None

        operations = arguments["operations"]
        file_count = len(operations)
        file_paths = [op["file_path"] if isinstance(op, dict) else op.file_path for op in operations]
        files_data = (result.extra_info or {}).get("files_without_line_numbers") or []
        file_results = (result.extra_info or {}).get("file_results") or []
        success_count = int((result.extra_info or {}).get("success_count", len(files_data)))
        failure_count = int((result.extra_info or {}).get("failure_count", 0))

        # 失败时：展示给人看的简洁失败摘要（走 i18n，不含给 AI 的诊断信息）
        # read_files 在“全部子项失败”时也可能保持 result.ok=True，因此不能只看 result.ok
        if (not result.ok) or (failure_count > 0 and success_count == 0):
            return self._build_failure_tool_detail(file_results=file_results, success_count=success_count, failure_count=failure_count)

        # 单个文件：像 read_file.py 一样处理
        if file_count == 1:
            # 从 extra_info 获取第一个文件的原始内容
            if result.extra_info and "files_without_line_numbers" in result.extra_info:
                files_data = result.extra_info["files_without_line_numbers"]
                if files_data and len(files_data) > 0:
                    file_data = files_data[0]
                    file_path = file_data["file_path"]
                    file_name = os.path.basename(file_path)

                    # 根据读取方式确定显示类型，与 read_file.py 保持一致
                    read_method = file_data.get("read_method", "unknown")

                    if read_method == "markitdown":
                        # markitdown 处理的文件使用 MD 显示类型
                        display_type = DisplayType.MD
                    else:
                        # 纯文本文件根据文件扩展名确定显示类型
                        display_type = self.get_display_type_by_extension(file_path)

                    return ToolDetail(
                        type=display_type,
                        data=FileContent(
                            file_name=file_name,
                            content=file_data["content"]
                        )
                    )

        # 多个文件：使用格式化显示
        display_title = i18n.translate("read_file.multiple_title", category="tool.messages", main_file=os.path.basename(file_paths[0]),
                                   count=file_count)

        # 构建多文件显示内容
        if files_data:
            display_parts = []
            for idx, file_data in enumerate(files_data):
                # 添加文件分隔符（除了第一个文件）
                if idx > 0:
                    display_parts.append("\n\n---\n\n")

                display_parts.append(f"## {file_data['file_path']}\n\n")

                # 根据读取方式决定是否需要转义和包围代码块
                content = file_data["content"]
                read_method = file_data.get("read_method", "unknown")

                # markitdown 处理的文件已经有完整格式，不需要额外处理和转义
                if read_method == "markitdown":
                    display_parts.append(content)
                else:
                    # 纯文本文件需要转义代码块并用代码块包围
                    escaped_content = self._escape_code_blocks_for_display(content)
                    display_parts.append(f"```\n{escaped_content}\n```")

            content_for_display = "".join(display_parts)
            if failure_count > 0:
                failure_markdown = self._build_failure_detail_markdown(
                    file_results=file_results,
                    success_count=success_count,
                    failure_count=failure_count,
                )
                if failure_markdown:
                    content_for_display = failure_markdown + "\n\n---\n\n" + content_for_display
        else:
            content_for_display = ""

        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(
                file_name=display_title,
                content=content_for_display
            )
        )

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        if not arguments or "operations" not in arguments:
            return i18n.translate("read_file.failed", category="tool.messages")

        operations = arguments["operations"]
        file_count = len(operations)
        # 从 operations 中提取文件路径
        file_paths = [op["file_path"] if isinstance(op, dict) else op.file_path for op in operations]

        if file_count == 1:
            file_name = os.path.basename(file_paths[0])
            if not result.ok:
                return i18n.translate("read_file.single_failed", category="tool.messages", file_name=file_name)
            else:
                return i18n.translate("read_file.single_success", category="tool.messages", file_name=file_name)
        else:
            main_file = os.path.basename(file_paths[0])
            if not result.ok:
                return i18n.translate("read_file.multiple_failed", category="tool.messages", main_file=main_file, count=file_count)
            else:
                return i18n.translate("read_file.multiple_success", category="tool.messages", main_file=main_file, count=file_count)

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None) -> Dict:
        """
        获取工具调用后的友好动作和备注
        """
        if not result.ok:
            # 设置使用自定义 remark
            result.use_custom_remark = True

            # 从 ToolContext 中获取错误类型
            error_type = tool_context.get_metadata("error_type")

            # 获取文件名（对于批量读取，显示第一个文件名）
            file_name = ""
            if arguments and "operations" in arguments:
                operations = arguments["operations"]
                if operations and len(operations) > 0:
                    first_file_path = operations[0].get("file_path", "") if isinstance(operations[0], dict) else getattr(operations[0], "file_path", "")
                    if first_file_path:
                        file_name = os.path.basename(first_file_path)
                        if len(operations) > 1:
                            file_name = f"{file_name}等{len(operations)}个文件"

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
                if not file_name:
                    file_name = i18n.translate("read_file.unknown_file", category="tool.messages")
                remark = i18n.translate("read_file.error", category="tool.messages", file_path=file_name)

            # 只有 AI 可以尝试修复的错误才添加后缀
            # READ_ERROR_UNEXPECTED 建议换工具，不是修复同一操作
            if error_type and error_type != "read_file.error_unexpected" and file_name:
                suffix = i18n.translate("tool.ai_retry_suffix", category="tool.messages")
                remark = remark + suffix

            return {
                "action": i18n.translate("read_files", category="tool.actions"),
                "remark": remark
            }

        remark = self._get_remark_content(result, arguments)

        # 检查是否有转换的文件，并在 remark 中体现
        if result.extra_info and "files_without_line_numbers" in result.extra_info:
            files_data = result.extra_info["files_without_line_numbers"]

            # 统计转换信息
            converted_files = [f for f in files_data if f.get("is_converted")]

            if converted_files:
                # 如果只有一个文件且被转换了，显示转换信息和策略
                if len(files_data) == 1 and len(converted_files) == 1:
                    conversion_strategy = converted_files[0].get("conversion_strategy")
                    if conversion_strategy and isinstance(conversion_strategy, str) and conversion_strategy != "balanced":
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
            "action": i18n.translate("read_files", category="tool.actions"),
            "remark": remark
        }


# ============================================================================
# 辅助函数 - 放在文件末尾，不影响主逻辑阅读
# ============================================================================

def _parse_line_info_from_content(content: str) -> Optional[Dict[str, Any]]:
    """
    从文件内容中解析行号信息

    文件内容格式为：行号\t内容\n
    用于分析截断位置，生成准确的继续读取指导

    Args:
        content: 带行号的文件内容

    Returns:
        dict: 包含 last_line, is_complete 等信息，解析失败返回None
    """
    if not content.strip():
        return None

    lines = content.split('\n')

    # 查找最后一个非空行
    last_line_number = 0
    for line in reversed(lines):
        if line.strip():
            try:
                # 提取行号（格式：行号\t内容）
                line_number = int(line.split('\t')[0])
                last_line_number = line_number
                break
            except (ValueError, IndexError):
                continue

    if last_line_number == 0:
        return None

    # 判断最后一行是否完整（是否以换行符结尾）
    is_complete = content.endswith('\n')

    return {
        "last_line": last_line_number,
        "is_complete": is_complete
    }


def _build_truncation_guidance_from_truncation_info(file_path: str, info: TruncationInfo) -> str:
    """
    根据read_file返回的TruncationInfo对象生成详细的继续读取指导

    这会生成与read_file单独截断时相同格式的提示，确保用户体验一致

    Args:
        file_path: 文件路径
        info: TruncationInfo对象（来自read_file）

    Returns:
        str: 格式化的截断指导信息
    """
    from app.tools.read_file import _build_truncation_message
    return "\n## 📄 文件: `" + file_path + "`\n" + _build_truncation_message(info, file_path)


def _build_simple_truncation_guidance(file_path: str, last_line: int, is_complete: bool) -> str:
    """
    为read_files二次截断的文件生成简化的继续读取指导

    由于是二次截断，我们没有文件总行数等完整信息，
    所以提示会比read_file的更简洁

    Args:
        file_path: 文件路径
        last_line: 截断位置的最后一行行号
        is_complete: 最后一行是否完整

    Returns:
        str: 格式化的截断指导信息
    """
    lines = []
    lines.append(f"\n### File: `{file_path}`\n")

    if is_complete:
        next_offset = last_line
        lines.append(f"Read up to line {last_line} (complete).")
        lines.append(f"To continue, use offset: {next_offset} (starts at line {next_offset + 1})\n")
    else:
        next_offset = last_line - 1
        lines.append(f"Read up to line {last_line} (incomplete, marked with ... at end).")
        lines.append(f"To continue, use offset: {next_offset} (re-reads line {next_offset + 1} to get complete content)\n")

    lines.append("```")
    lines.append(f'file_path: "{file_path}"')
    lines.append(f"offset: {next_offset}")
    lines.append("limit: -1")
    lines.append("```")

    return "\n".join(lines)
