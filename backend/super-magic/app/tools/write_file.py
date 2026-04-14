from app.i18n import i18n
import asyncio
import os
from pathlib import Path
from typing import Any, Dict, NamedTuple, Optional

import aiofiles
from pydantic import Field

from agentlang.context.tool_context import ToolContext
from app.core.entity.message.server_message import FileContent, ToolDetail
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool
from agentlang.utils.syntax_checker import SyntaxChecker
from app.utils.async_file_utils import async_exists

logger = get_logger(__name__)


class WriteFileParams(BaseToolParams):
    file_path: str = Field(
        ...,
        description="""<!--zh: 要写入的文件路径：相对路径解析到 .workspace（如 `report.md`）；.workspace 外的文件使用绝对路径-->
File path to write: relative paths resolve to .workspace (e.g., `report.md`); use absolute paths for files outside .workspace"""
    )
    content: str = Field(
        ...,
        description="The content to write to the file"
    )


    @classmethod
    def get_custom_error_message(cls, field_name: str, error_type: str) -> Optional[str]:
        """Get custom parameter error message"""
        if field_name == "content":
            error_message = """Missing required parameter 'content'. Content too long exceeds token limit causing parameter loss.

SOLUTION - Step-by-step strategy:
1. Use write_file to create file skeleton
2. Use edit_file to add content blocks incrementally

SIZE LIMITS:
- Small (<100 lines): Direct write_file
- Medium (100-500 lines): Skeleton + 2-3 edit_file calls
- Large (>500 lines): Skeleton + multiple edit_file calls

EXAMPLES:
HTML: Write <html><head></head><body></body></html> skeleton first
Python: Write imports and function/class definition skeleton first
"""
            return error_message
        return None


class WriteResult(NamedTuple):
    """写入结果详情"""
    content: str  # 写入的内容
    file_exists: bool  # 文件是否已存在
    total_lines: int  # 总行数
    file_size: int  # 文件大小（字节）
    has_syntax_errors: bool  # 是否有语法错误
    syntax_errors: list  # 语法错误列表


@tool()
class WriteFile(AbstractFileTool[WriteFileParams], WorkspaceTool[WriteFileParams]):
    """<!--zh
    将文件写入本地文件系统。
    - 如果提供的路径中存在现有文件，此工具将覆盖该文件。
    - 如果这是一个现有文件，您必须先使用读取工具来读取文件内容。如果您没有先读取文件，此工具将失败。
    - 总是优先编辑代码库中的现有文件。
    重要提醒：注意单次内容长度限制！
    - 内容过长会导致"缺少必要参数'content'"错误
    - 解决方案：使用写入文件 + 编辑文件组合策略
    - 小文件（<100行）：直接写入文件
    - 中等文件（100-500行）：先写框架 + 2-3次编辑文件添加内容
    - 大文件（>500行）：先写框架 + 多次编辑文件逐步添加内容
    策略建议：先创建文件框架，然后逐步增量添加详细内容。
    -->
    Write file to local filesystem.
    - If an existing file exists at the provided path, this tool will overwrite it.
    - If this is an existing file, you must use read tool to read file content first. If you don't read file first, this tool will fail.
    - Always prioritize editing existing files in the codebase.
    Important reminder: Pay attention to single content length limit!
    - Overly long content causes "Missing required parameter 'content'" error
    - Solution: Use write_file + edit_file combination strategy
    - Small files (<100 lines): Direct write_file
    - Medium files (100-500 lines): Write skeleton + 2-3 edit_file calls to add content
    - Large files (>500 lines): Write skeleton + multiple edit_file calls to add content incrementally
    Strategy suggestion: Create file skeleton first, then add detailed content incrementally.
    """

    async def execute(self, tool_context: ToolContext, params: WriteFileParams) -> ToolResult:
        """
        执行文件写入操作

        Args:
            tool_context: 工具上下文
            params: 参数对象，包含文件路径和内容

        Returns:
            ToolResult: 包含操作结果
        """
        try:
            # 使用父类方法获取安全的文件路径
            file_path = self.resolve_path(params.file_path)
            # 创建目录（如果需要）
            await self._create_directories(file_path)

            # 使用版本控制上下文管理器自动处理事件和时间戳
            async with self._file_versioning_context(tool_context, file_path) as file_exists:
                # 写入文件内容
                await self._write_file(file_path, params.content)

            # 执行语法检查
            syntax_result = await SyntaxChecker.check_syntax(str(file_path), params.content)

            # 计算文件统计信息
            write_result = self._calculate_write_stats(
                params.content,
                file_exists, # 传递原始的文件存在状态
                not syntax_result.is_valid,
                syntax_result.errors
            )

            action_verb = "File overwritten" if file_exists else "File created"
            output = (
                f"{action_verb}: {params.file_path} | "
                f"{write_result.total_lines} lines | "
                f"Size: {write_result.file_size} bytes"
            )

            if not syntax_result.is_valid:
                errors_str = "\n".join(syntax_result.errors)
                output += f"\n\nWarning: File has syntax issues:\n{errors_str}"
                logger.warning(f"文件 {file_path} 存在语法问题: {syntax_result.errors}")

            # 返回操作结果，将文件是否已存在的信息保存到 extra_info 中
            return ToolResult(
                content=output,
                extra_info={"file_existed": file_exists}
            )

        except Exception as e:
            logger.exception(f"写入文件失败: {e!s}")
            return ToolResult.error("Failed to write file.\n\n"
                "If the error is content length related, the content is too long and exceeds token limits.\n\n"
                "SOLUTION:\n"
                "1. Use write_file to create basic framework\n"
                "2. Use edit_file to add content blocks incrementally\n"
                "3. Keep each operation within reasonable scope (<200 lines)\n\n"
                "WORKFLOW: write_file(framework) → edit_file(content1) → edit_file(content2)...")

    async def _create_directories(self, file_path: Path) -> None:
        """创建文件所需的目录结构"""
        directory = file_path.parent

        if not await async_exists(directory):
            await asyncio.to_thread(os.makedirs, directory, exist_ok=True)
            logger.info(f"创建目录: {directory}")

    async def _write_file(self, file_path: Path, content: str) -> None:
        """写入文件内容"""
        # 处理内容末尾可能的空行
        if not content.endswith("\n"):
            content += "\n"

        async with aiofiles.open(file_path, "w", encoding="utf-8") as f:
            await f.write(content)

        logger.info(f"文件写入完成: {file_path}")

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

        if not arguments or "file_path" not in arguments or "content" not in arguments:
            logger.warning("没有提供file_path或content参数")
            return None

        file_path = arguments["file_path"]
        content = arguments["content"]
        file_name = os.path.basename(file_path)

        # 使用 AbstractFileTool 的方法获取显示类型
        display_type = self.get_display_type_by_extension(file_path)

        return ToolDetail(
            type=display_type,
            data=FileContent(
                file_name=file_name,
                content=content
            )
        )

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        if not arguments or "file_path" not in arguments:
            return i18n.translate("read_file.not_found", category="tool.messages")
        return os.path.basename(arguments["file_path"])

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None) -> Dict:
        """
        获取工具调用后的友好动作和备注
        """
        if not result.ok:
            if not arguments or "file_path" not in arguments:
                file_path_str = i18n.translate("read_file.unknown_file", category="tool.messages")
            else:
                file_path_str = arguments.get("file_path", i18n.translate("read_file.unknown_file", category="tool.messages"))
            return {
                "action": i18n.translate("write_file", category="tool.actions"),
                "remark": i18n.translate("write_file.error", category="tool.messages", file_path=file_path_str)
            }

        if not arguments or "file_path" not in arguments:
            return {
                "action": i18n.translate("write_file", category="tool.actions"),
                "remark": i18n.translate("write_file.error", category="tool.messages", file_path=i18n.translate("read_file.unknown_file", category="tool.messages"))
            }

        return {
            "action": i18n.translate("write_file", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }

    def _calculate_write_stats(self, content: str, file_exists: bool, has_syntax_errors: bool, syntax_errors: list) -> WriteResult:
        """
        计算写入操作的统计信息

        Args:
            content: 写入的内容
            file_exists: 文件是否已存在
            has_syntax_errors: 是否有语法错误
            syntax_errors: 语法错误列表

        Returns:
            WriteResult: 包含写入统计信息的结果对象
        """
        # 确保内容以换行符结束
        normalized_content = content
        if not normalized_content.endswith("\n"):
            normalized_content += "\n"

        # 计算行数
        total_lines = normalized_content.count('\n') + (0 if normalized_content.endswith('\n') or not normalized_content else 1)

        # 计算文件大小
        file_size = len(normalized_content.encode('utf-8'))

        return WriteResult(
            content=content,
            file_exists=file_exists,
            total_lines=total_lines,
            file_size=file_size,
            has_syntax_errors=has_syntax_errors,
            syntax_errors=syntax_errors
        )
