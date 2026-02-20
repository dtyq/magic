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
    删除多个文件工具，用于批量删除指定的文件或目录。

    注意：
    - 删除前请确认所有文件路径正确
    - 如果任何文件不存在将返回错误
    - 只能删除工作目录中的文件
    - 请不要在未经用户确认的情况下删除任何文件或目录
    - 支持同时删除多个文件，提高操作效率
    -->
    Tool for deleting multiple files, for batch deletion of specified files or directories.

    Notes:
    - Confirm all file paths are correct before deleting
    - Will return error if any file doesn't exist
    - Can only delete files in workspace
    - Do not delete any files or directories without user confirmation
    - Supports deleting multiple files simultaneously for efficiency
    """

    def __init__(self, **data):
        super().__init__(**data)

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
                return ToolResult(error=f"批量删除失败:\n" + "\n".join(errors))
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
            return ToolResult(error="Failed to delete files")



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
