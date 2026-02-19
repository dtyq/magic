from app.i18n import i18n
import asyncio
import os
from pathlib import Path
from typing import Any, Dict, NamedTuple, Optional

import aiofiles
from pydantic import Field

from agentlang.context.tool_context import ToolContext
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_guard_tool import WorkspaceGuardTool
from agentlang.utils.syntax_checker import SyntaxChecker

logger = get_logger(__name__)


class AppendToFileParams(BaseToolParams):
    file_path: str = Field(
        ...,
        description="""<!--zh: 要追加内容的文件路径：相对路径解析到 .workspace（如传入 todo.md 即追加到 .workspace/todo.md）；.workspace 外的文件使用绝对路径-->
File path to append content to, relative to workspace or absolute, exclude workspace path. E.g., to append to .workspace/todo.md, just pass todo.md"""
    )
    content: str = Field(
        ...,
        description="""<!--zh: 要追加到文件的内容-->
Content to append to file"""
    )

    @classmethod
    def get_custom_error_message(cls, field_name: str, error_type: str) -> Optional[str]:
        """获取自定义参数错误信息"""
        if field_name == "content":
            error_message = """<!--zh
缺少必要参数'content'。这可能是因为您提供的内容过长，超出了token限制。
建议：
1. 减少输出内容的量，分批次追加文件内容
2. 将大内容拆分为多次追加操作
3. 确保在调用时明确提供content参数
-->
Missing required parameter 'content'. This may be because content provided is too long, exceeding token limit.
Suggestions:
1. Reduce output content amount, append file content in batches
2. Split large content into multiple append operations
3. Ensure content parameter is explicitly provided when calling"""
            return error_message
        return None


class AppendResult(NamedTuple):
    """追加结果详情"""
    content: str  # 追加的内容
    is_new_file: bool  # 是否是新文件
    added_lines: int  # 新增行数
    original_size: int  # 原始文件大小（字节）
    new_size: int  # 新文件大小（字节）
    size_change: int  # 文件大小变化（字节）
    original_lines: int  # 原始文件行数
    new_lines: int  # 新文件行数


@tool()
class AppendToFile(AbstractFileTool[AppendToFileParams], WorkspaceGuardTool[AppendToFileParams]):
    """<!--zh
    追加文件工具，可以将内容追加到指定路径的文件中，如果文件不存在会创建文件。

    - 减少单次输出内容的量，建议分批次追加文件内容
    - 如果文件不存在，将自动创建文件和必要的目录
    - 如果文件已存在，将在文件末尾追加内容
    -->
    Append to file tool that can append content to file at specified path. Creates file if it doesn't exist.

    - Reduce single output content amount, recommend appending file content in batches
    - If file doesn't exist, will auto-create file and necessary directories
    - If file exists, will append content at end of file
    """

    async def execute(self, tool_context: ToolContext, params: AppendToFileParams) -> ToolResult:
        """
        执行文件追加操作

        Args:
            tool_context: 工具上下文
            params: 参数对象，包含文件路径和内容

        Returns:
            ToolResult: 包含操作结果
        """
        try:
            # 使用父类方法获取安全的文件路径
            file_path, error = self.get_safe_path(params.file_path)
            if error:
                return ToolResult(error=error)

            # 保存原始文件内容（用于统计）
            file_exists = file_path.exists()
            original_content = ""
            if file_exists:
                async with aiofiles.open(file_path, "r", encoding="utf-8") as f:
                    original_content = await f.read()

            # 创建目录（如果需要）
            await self._create_directories(file_path)

            # 使用 versioning context 处理事件和时间戳更新
            async with self._file_versioning_context(tool_context, file_path):
                # 追加文件内容
                await self._append_file(file_path, params.content)

            # 在写入成功后读取文件的完整内容
            final_content = ""
            async with aiofiles.open(file_path, "r", encoding="utf-8") as f:
                final_content = await f.read()

            # 执行语法检查（对最新的完整内容进行检查）
            syntax_result = await SyntaxChecker.check_syntax(str(file_path), final_content)

            # AI 警告列表
            ai_warnings = []
            if not syntax_result.is_valid:
                # Add syntax errors to AI warnings instead of rolling back
                errors_str = "\n".join(syntax_result.errors)
                ai_warnings.append(f"WARNING: Syntax errors detected in the modified file:\n{errors_str}")

            # 计算文件变化统计信息
            append_result = self._calculate_append_stats(
                params.content,
                original_content,
                final_content,
                file_exists
            )

            # 生成格式化的输出
            file_name = os.path.basename(file_path)
            action = "追加内容到" if file_exists else "创建并写入"

            output = (
                f"文件{action.replace('追加内容到', '更新').replace('创建并写入', '创建')}: {file_path} | "
                f"+{append_result.added_lines}新增行 | "
                f"大小:{'+' if append_result.size_change > 0 else ''}{append_result.size_change}字节"
                f"({append_result.original_size}→{append_result.new_size}) | "
                f"行数:{append_result.original_lines}→{append_result.new_lines}"
            )

            # 添加 AI 警告（如果有）
            if ai_warnings:
                output += "\n\n" + "\n\n".join(ai_warnings)

            # 返回操作结果
            return ToolResult(content=output)

        except Exception as e:
            logger.exception(f"追加文件失败: {e!s}")
            return ToolResult(error="Failed to append to file")

    async def _create_directories(self, file_path: Path) -> None:
        """创建文件所需的目录结构"""
        directory = file_path.parent

        if not directory.exists():
            await asyncio.to_thread(os.makedirs, directory, exist_ok=True)
            logger.info(f"创建目录: {directory}")

    async def _append_file(self, file_path: Path, content: str) -> None:
        """追加文件内容"""
        # 处理内容末尾可能的空行
        if not content.endswith("\n"):
            content += "\n"

        async with aiofiles.open(file_path, "a", encoding="utf-8") as f:
            await f.write(content)

        logger.info(f"文件追加完成: {file_path}")

    def _calculate_append_stats(self, append_content: str, original_content: str, final_content: str, file_exists: bool) -> AppendResult:
        """
        计算追加操作的统计信息

        Args:
            append_content: 追加的内容
            original_content: 原始文件内容
            final_content: 最终文件内容
            file_exists: 文件是否原本存在

        Returns:
            AppendResult: 包含追加统计信息的结果对象
        """
        # 确保内容以换行符结束
        normalized_append = append_content
        if not normalized_append.endswith("\n"):
            normalized_append += "\n"

        # 计算行数
        original_lines = original_content.count('\n') + (0 if original_content.endswith('\n') or not original_content else 1)
        new_lines = final_content.count('\n') + (0 if final_content.endswith('\n') or not final_content else 1)
        added_lines = normalized_append.count('\n') + (0 if normalized_append.endswith('\n') or not normalized_append else 1)

        # 计算文件大小
        original_size = len(original_content.encode('utf-8'))
        new_size = len(final_content.encode('utf-8'))
        size_change = new_size - original_size

        return AppendResult(
            content=append_content,
            is_new_file=not file_exists,
            added_lines=added_lines,
            original_size=original_size,
            new_size=new_size,
            size_change=size_change,
            original_lines=original_lines,
            new_lines=new_lines
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

        file_path = arguments["file_path"]
        return os.path.basename(file_path)

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None) -> Dict:
        """
        获取工具调用后的友好动作和备注
        """
        if not result.ok:
            file_path_str = arguments.get("file_path", "未知文件") if arguments else "未知文件"
            return {
                "action": i18n.translate("append_to_file", category="tool.actions"),
                "remark": i18n.translate("edit_file.error", category="tool.messages", file_path=file_path_str)
            }

        return {
            "action": i18n.translate("append_to_file", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }
