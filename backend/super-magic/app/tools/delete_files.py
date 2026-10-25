import re
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import List

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.event.event import EventType
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from agentlang.utils.file import safe_delete
from app.core.entity.message.server_message import (
    DisplayType,
    FileContent,
    OperationResultListContent,
    OperationResultItem,
    OperationResultKind,
    OperationResultStatus,
    ToolDetail,
)
from app.i18n import i18n
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool
from app.utils.async_file_utils import async_exists, async_is_dir

logger = get_logger(__name__)

# 最多 8 项原位展开；长清单使用既有 Markdown 详情，避免撑长聊天。
MAX_INLINE_DELETE_ITEMS = 8


class DeleteFileError(str, Enum):
    NOT_FOUND = "delete_file.reason_not_found"
    PERMISSION_DENIED = "delete_file.reason_permission_denied"
    INVALID_PATH = "delete_file.reason_invalid_path"
    DELETE_FAILED = "delete_file.reason_failed"


@dataclass(frozen=True)
class DeleteFileResult:
    """删除时保存的事实；详情不再查询已删除对象，诊断原文只提供给模型。"""

    path: str
    kind: OperationResultKind
    error: DeleteFileError | None = None
    error_detail: str = ""


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
            file_results: list[DeleteFileResult] = []

            for file_path_str in params.file_paths:
                # 初始化显示路径，默认使用输入路径
                display_path = file_path_str
                kind = OperationResultKind.TEXT

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
                    if not await async_exists(file_path):
                        file_results.append(DeleteFileResult(
                            path=display_path,
                            kind=kind,
                            error=DeleteFileError.NOT_FOUND,
                            error_detail="Path does not exist",
                        ))
                        continue

                    # 判断是文件还是目录
                    is_directory = await async_is_dir(file_path)
                    kind = OperationResultKind.DIRECTORY if is_directory else OperationResultKind.FILE

                    # 记录文件路径用于后续触发事件
                    file_path_str_full = str(file_path)

                    # 触发文件删除前事件（保存删除前的内容）
                    await self._dispatch_file_event(tool_context, file_path_str_full, EventType.BEFORE_FILE_DELETED)

                    # 使用 safe_delete 函数处理删除逻辑
                    await safe_delete(file_path)
                    logger.info(f"已成功请求删除路径: {file_path}") # safe_delete 内部会记录具体方式

                    # 触发文件删除事件
                    await self._dispatch_file_event(tool_context, file_path_str_full, EventType.FILE_DELETED)

                    file_results.append(DeleteFileResult(path=display_path, kind=kind))

                except Exception as e:
                    logger.exception(f"删除文件失败: {file_path_str}: {e!s}")
                    if isinstance(e, FileNotFoundError):
                        error = DeleteFileError.NOT_FOUND
                    elif isinstance(e, PermissionError):
                        error = DeleteFileError.PERMISSION_DENIED
                    elif isinstance(e, ValueError):
                        error = DeleteFileError.INVALID_PATH
                    else:
                        error = DeleteFileError.DELETE_FAILED
                    file_results.append(DeleteFileResult(
                        path=display_path, kind=kind, error=error, error_detail=str(e),
                    ))

            # 构建结果信息
            deleted_files = [
                f"{item.path} ({item.kind.value})" for item in file_results if item.error is None
            ]
            errors = [
                f"{item.path}: {item.error_detail}" for item in file_results if item.error is not None
            ]
            extra_info = {"delete_results": file_results}
            if errors and not deleted_files:
                # 全部失败
                return ToolResult.error(
                    "No files or directories were deleted:\n" + "\n".join(errors),
                    extra_info=extra_info,
                    use_custom_remark=True,
                )
            elif errors and deleted_files:
                # 部分成功
                success_info = f"Deleted {len(deleted_files)} files or directories:\n" + "\n".join(deleted_files)
                error_info = f"Failed to delete {len(errors)} files or directories:\n" + "\n".join(errors)
                return ToolResult(content=f"{success_info}\n\n{error_info}", extra_info=extra_info)
            else:
                # 全部成功
                return ToolResult(
                    content=f"Deleted {len(deleted_files)} files or directories:\n" + "\n".join(deleted_files),
                    extra_info=extra_info,
                )

        except Exception as e:
            logger.exception(f"批量删除文件失败: {e!s}")
            return ToolResult.error("Failed to delete files")

    @staticmethod
    def _get_file_results(result: ToolResult) -> list[DeleteFileResult]:
        # 执行器在工具开始前失败时可能没有逐项结果，不能拿输入清单补造成功。
        items = result.extra_info.get("delete_results")
        if not isinstance(items, list) or not all(isinstance(item, DeleteFileResult) for item in items):
            return []
        return items

    def _get_remark_content(self, result: ToolResult, arguments: dict[str, object] | None = None) -> str:
        """获取备注内容"""
        items = self._get_file_results(result)
        if not items:
            return i18n.translate("delete_file.detail_unavailable", category="tool.messages")
        if len(items) == 1:
            status = self._get_item_message(items[0])
            return i18n.translate(
                "delete_file.single_result", category="tool.messages",
                file_name=Path(items[0].path).name, status=status,
            )
        failed = sum(item.error is not None for item in items)
        if failed == 0:
            return i18n.translate("delete_file.deleted_count", category="tool.messages", count=len(items))
        if failed == len(items):
            return i18n.translate("delete_file.failed_count", category="tool.messages", count=failed)
        return i18n.translate(
            "delete_file.partial_result", category="tool.messages", deleted=len(items) - failed, failed=failed,
        )

    @staticmethod
    def _get_item_message(item: DeleteFileResult) -> str:
        key = "delete_file.deleted" if item.error is None else "delete_file.not_deleted"
        return i18n.translate(key, category="tool.messages")

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None,
    ) -> ToolDetail:
        items = self._get_file_results(result)
        title = i18n.translate("delete_file.detail_title", category="tool.messages")
        if not items:
            return ToolDetail(
                type=DisplayType.MD,
                data=FileContent(
                    file_name=f"{title}.md",
                    content=i18n.translate("delete_file.detail_unavailable", category="tool.messages"),
                ),
            )

        display_items = [OperationResultItem(
            label=item.path,
            kind=item.kind,
            status=OperationResultStatus.SUCCESS if item.error is None else OperationResultStatus.ERROR,
            message=self._get_item_message(item),
            description=i18n.translate(item.error.value, category="tool.messages") if item.error else "",
        ) for item in items]
        if len(display_items) <= MAX_INLINE_DELETE_ITEMS:
            return ToolDetail(type=DisplayType.OPERATION_RESULT_LIST, data=OperationResultListContent(items=display_items))

        # 报告与卡片共用同一份结果，完整保留顺序、失败项和脱敏原因。
        lines = [f"## {title}", "", self._get_remark_content(result), ""]
        for item in display_items:
            # 动态代码分隔符使文件名中的反引号、链接和 HTML 都保持普通文本。
            fence = "`" * (max((len(match.group()) for match in re.finditer(r"`+", item.label)), default=0) + 1)
            label = item.label.replace("\n", " ").replace("\r", " ")
            lines.append(f"- {fence} {label} {fence} — {item.message}")
            if item.description:
                lines.append(f"  {item.description}")
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(file_name=f"{title}.md", content="\n".join(lines)),
        )

    async def get_after_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float,
        arguments: dict[str, object] | None = None,
    ) -> dict[str, str]:
        """
        获取工具调用后的友好动作和备注
        """
        return {
            "action": i18n.translate("delete_files", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }
