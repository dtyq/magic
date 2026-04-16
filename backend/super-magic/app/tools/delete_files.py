from app.i18n import i18n
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.event.event import EventType
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from agentlang.utils.file import safe_delete
from app.core.entity.message.server_message import ToolDetail
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool

logger = get_logger(__name__)


class DeleteFilesParams(BaseToolParams):
    file_paths: List[str] = Field(
        ...,
        description="""<!--zh: 要删除的文件路径列表-->
List of file paths to delete""",
        min_items=1
    )


@tool()
class DeleteFiles(AbstractFileTool[DeleteFilesParams], WorkspaceTool[DeleteFilesParams]):
    """<!--zh
    批量删除文件或目录。需要删除文件时始终优先使用此工具，不要用 shell rm/del 命令。
    只能删除工作目录内的文件。
    -->
    Delete files or directories in batch. Always prefer this tool over shell rm/del commands for file deletion.
    Only works within the workspace.
    """

    def __init__(self, **data):
        super().__init__(**data)

    def get_prompt_hint(self) -> str:
        return """\
<!--zh
使用 delete_files 前：
- 必须先用 ask_user 向用户确认删除范围——按照 ask_user 的高危操作确认规则撰写确认问题（列出文件清单及说明、用日常语言概括影响等）
- 用户确认后才可调用
- 路径不存在会报错
- 支持一次传入多个路径批量执行
-->
Before using delete_files:
- You MUST first use ask_user to confirm the deletion scope — follow the destructive-op confirmation rules in ask_user (list files with descriptions, summarize impact in plain language, etc.)
- Only proceed after user confirmation
- Returns an error if any path does not exist
- Accepts multiple paths in one call for efficiency
"""

    async def execute(self, tool_context: ToolContext, params: DeleteFilesParams) -> ToolResult:
        """
        执行批量文件删除操作

        Args:
            tool_context: 工具上下文
            params: 参数对象，包含文件路径列表

        Returns:
            ToolResult: 包含操作结果
        """
        try:
            deleted_files = []
            errors = []

            for file_path_str in params.file_paths:
                # 初始化显示路径，默认使用输入路径
                display_path = file_path_str

                try:
                    # 使用基类方法获取安全文件路径
                    file_path = self.resolve_path(file_path_str)
                    # 计算相对于workspace的路径用于显示
                    try:
                        relative_path = file_path.relative_to(self.base_dir)
                        display_path = str(relative_path)
                        # 去掉 .workspace/ 前缀
                        if display_path.startswith('.workspace/'):
                            display_path = display_path[len('.workspace/'):]
                    except ValueError:
                        # 如果无法计算相对路径，使用原输入路径
                        display_path = file_path_str

                    # 检查文件是否存在
                    if not file_path.exists():
                        errors.append(f"文件不存在: {display_path}")
                        continue

                    # 判断是文件还是目录
                    is_directory = file_path.is_dir()
                    file_type = "目录" if is_directory else "文件"

                    # 记录文件路径用于后续触发事件
                    file_path_str_full = str(file_path)

                    # 触发文件删除前事件（保存删除前的内容）
                    await self._dispatch_file_event(tool_context, file_path_str_full, EventType.BEFORE_FILE_DELETED)

                    # 使用 safe_delete 函数处理删除逻辑
                    await safe_delete(file_path)
                    logger.info(f"已成功请求删除路径: {file_path}") # safe_delete 内部会记录具体方式

                    # 触发文件删除事件
                    await self._dispatch_file_event(tool_context, file_path_str_full, EventType.FILE_DELETED)

                    deleted_files.append(f"{display_path} ({file_type})")

                except Exception as e:
                    logger.exception(f"删除文件失败: {file_path_str}: {e!s}")
                    errors.append(f"{display_path}: {e!s}")

            # 构建结果信息
            if errors and not deleted_files:
                # 全部失败
                return ToolResult.error(f"批量删除失败:\n" + "\n".join(errors))
            elif errors and deleted_files:
                # 部分成功
                success_info = f"成功删除 {len(deleted_files)} 个文件:\n" + "\n".join(deleted_files)
                error_info = f"失败 {len(errors)} 个文件:\n" + "\n".join(errors)
                return ToolResult(content=f"{success_info}\n\n{error_info}")
            else:
                # 全部成功
                return ToolResult(content=f"成功删除 {len(deleted_files)} 个文件:\n" + "\n".join(deleted_files))

        except Exception as e:
            logger.exception(f"批量删除文件失败: {e!s}")
            return ToolResult.error("Failed to delete files")



    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        if not arguments or "file_paths" not in arguments:
            return i18n.translate("read_file.not_found", category="tool.messages")

        file_paths = arguments["file_paths"]
        if not file_paths:
            return i18n.translate("read_file.not_found", category="tool.messages")

        if len(file_paths) == 1:
            return os.path.basename(file_paths[0])
        else:
            return f"{len(file_paths)}个文件"

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None) -> Dict:
        """
        获取工具调用后的友好动作和备注
        """
        if not result.ok:
            file_paths = arguments.get("file_paths", []) if arguments else []
            if file_paths:
                if len(file_paths) == 1:
                    file_desc = file_paths[0]
                else:
                    file_desc = f"{len(file_paths)}个文件"
            else:
                file_desc = "未知文件"
            return {
                "action": i18n.translate("delete_files", category="tool.actions"),
                "remark": i18n.translate("delete_file.error", category="tool.messages", file_path=file_desc)
            }

        return {
            "action": i18n.translate("delete_files", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }
