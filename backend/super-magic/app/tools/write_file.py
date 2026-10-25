import json
import os
from pathlib import Path
from typing import Any, Dict, NamedTuple, Optional

import json_repair
from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from agentlang.utils.syntax_checker import SyntaxChecker
from app.core.entity.message.server_message import ToolDetail
from app.i18n import i18n
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool
from app.utils.async_file_utils import async_exists, async_mkdir, async_write_text
from app.tools.utils.file_change_stats import (
    FileChangeMetrics, FileContentMetrics, format_file_change_metrics, measure_text, read_file_metrics,
)
from app.service.html_app_memory_service import is_html_app_memory_path

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
    - 此工具不要求预先读取，但会替换整份内容；需要保留旧内容时应先读取，局部修改优先使用编辑工具。
    - 总是优先编辑代码库中的现有文件。
    -->
    Write file to local filesystem.
    - If an existing file exists at the provided path, this tool will overwrite it.
    - No prior read is required, but this replaces the entire content. Read first when existing content must be preserved; prefer edit tools for partial changes.
    - Always prioritize editing existing files in the codebase.
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
            if is_html_app_memory_path(file_path):
                return ToolResult.error("MICRO-APP.md is managed by update_html_app_memory. Use that tool instead of write_file so MagicBase data model records are not overwritten.")

            initial_file_exists = await async_exists(file_path)
            """
            覆盖前读取旧用量只用于反馈，不增加写入权限或版本校验条件。
            新建文件从 0 开始；旧文件不可读取时保留 unavailable，不能伪装成空文件。
            """
            before_metrics = await read_file_metrics(file_path) if initial_file_exists else FileContentMetrics(0, 0)

            content_to_write, auto_repaired_json, original_syntax_errors = await self._prepare_content_for_write(
                file_path=file_path,
                content=params.content,
                file_exists=initial_file_exists,
            )

            # 创建目录（如果需要）
            await self._create_directories(file_path)

            # 所有写入工具通过同一 Horizon 文件记录更新写入后的变化基线。
            async with self._file_versioning_context(tool_context, file_path) as file_exists:
                """
                写入文件内容
                统计要使用真正写入的版本：JSON 可能已修复，末尾也可能按原规则添加换行。
                例：输入 abc，实际保存 abc 加换行，反馈不能仍按 3 字节计算。
                """
                content_to_write = await self._write_file(file_path, content_to_write)

            # 执行语法检查
            syntax_result = await SyntaxChecker.check_syntax(str(file_path), content_to_write)

            # 计算文件统计信息
            write_result = self._calculate_write_stats(
                content_to_write,
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
            if file_exists != initial_file_exists:
                # 初次观察到的存在状态已经变化，旧统计不能再冒充此次覆盖的可靠起点。
                before_metrics = FileContentMetrics(None, None)
            output += "\n" + format_file_change_metrics(
                FileChangeMetrics(before_metrics, measure_text(content_to_write, write_result.file_size)),
            )

            if auto_repaired_json:
                output += (
                    "\n\nNotice: JSON content was auto-repaired before writing. "
                    "The file on disk now contains the repaired, valid JSON content. "
                    "Do not retry this write only to fix JSON syntax; use the written file for subsequent steps."
                )

            if not syntax_result.is_valid:
                errors_str = "\n".join(syntax_result.errors)
                output += f"\n\nWarning: File has syntax issues:\n{errors_str}"
                logger.warning(f"文件 {file_path} 存在语法问题: {syntax_result.errors}")

            # 返回操作结果，将文件是否已存在的信息保存到 extra_info 中
            return ToolResult(
                content=output,
                extra_info={
                    "file_path": str(file_path),
                    "file_existed": file_exists,
                    "auto_repaired_json": auto_repaired_json,
                    "original_syntax_errors": original_syntax_errors,
                }
            )

        except Exception as e:
            logger.exception(f"写入文件失败: {e!s}")
            return ToolResult.error(f"Failed to write file: {e!s}")

    async def _prepare_content_for_write(
        self,
        file_path: Path,
        content: str,
        file_exists: bool,
    ) -> tuple[str, bool, list]:
        """写入前准备内容；仅新建 .json 文件允许可验证自动修复。"""
        if file_exists or file_path.suffix.lower() != ".json":
            return content, False, []

        try:
            json.loads(content)
            return content, False, []
        except json.JSONDecodeError:
            pass

        original_syntax = await SyntaxChecker.check_syntax(str(file_path), content)
        original_syntax_errors = [] if original_syntax.is_valid else original_syntax.errors

        try:
            repaired_object = json_repair.repair_json(content, return_objects=True)
            repaired_content = json.dumps(repaired_object, ensure_ascii=False, indent=2)
            json.loads(repaired_content)
        except Exception as repair_error:
            logger.info(f"新建 JSON 文件自动修复失败，保持原内容: {file_path}, error={repair_error}")
            return content, False, original_syntax_errors

        logger.info(f"新建 JSON 文件已自动修复: {file_path}")
        return repaired_content, True, original_syntax_errors

    async def _create_directories(self, file_path: Path) -> None:
        """创建文件所需的目录结构"""
        directory = file_path.parent

        if not await async_exists(directory):
            await async_mkdir(directory, parents=True, exist_ok=True)
            logger.info(f"创建目录: {directory}")

    async def _write_file(self, file_path: Path, content: str) -> str:
        """写入文件内容"""
        # 处理内容末尾可能的空行
        if not content.endswith("\n"):
            content += "\n"

        await async_write_text(file_path, content)

        logger.info(f"文件写入完成: {file_path}")
        return content

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
            data=await self._build_file_content(
                file_path=(result.extra_info or {}).get("file_path", ""),
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
