from app.i18n import i18n
import shutil
import os
from pathlib import Path
from typing import Optional, Dict, Any, List

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.event.event import EventType
from agentlang.logger import get_logger
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool
from app.tools.abstract_file_tool import AbstractFileTool
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail, TerminalContent
from app.utils.async_file_utils import async_copy2

logger = get_logger(__name__)


class BackupDashboardTemplateParams(BaseToolParams):
    target_project: str = Field(
        description="""<!--zh: 要恢复备份的看板项目目录名称，相对于工作区的路径-->
Dashboard project directory name to restore backup, path relative to workspace"""
    )
    restore_dashboard_js: bool = Field(
        default=False,
        description="""<!--zh: 是否恢复 dashboard.js 文件的备份版本-->
Whether to restore backup version of dashboard.js file"""
    )
    restore_index_css: bool = Field(
        default=False,
        description="""<!--zh: 是否恢复 index.css 文件的备份版本-->
Whether to restore backup version of index.css file"""
    )
    restore_index_html: bool = Field(
        default=False,
        description="""<!--zh: 是否恢复 index.html 文件的备份版本-->
Whether to restore backup version of index.html file"""
    )
    restore_config_js: bool = Field(
        default=False,
        description="是否恢复 config.js 文件的备份版本"
    )


@tool()
class BackupDashboardTemplate(AbstractFileTool[BackupDashboardTemplateParams], WorkspaceTool[BackupDashboardTemplateParams]):
    """<!--zh
    恢复数据分析看板模板备份文件工具

    恢复指定项目中的 dashboard.js、index.css、index.html 和 config.js 文件的备份版本。
    备份文件格式为 .{原文件名}.backup，实现当前文件和备份文件的互换。
    -->
    Restore data analysis dashboard template backup files tool

    Restore backup versions of dashboard.js, index.css, index.html, and config.js files in specified project.
    Backup file format is .{original_filename}.backup, implements swap between current file and backup file.
    """

    async def execute(self, tool_context: ToolContext, params: BackupDashboardTemplateParams) -> ToolResult:
        """执行工具并返回结果

        Args:
            tool_context: 工具上下文
            params: 恢复参数

        Returns:
            ToolResult: 包含操作结果或错误信息
        """
        restored_files = []  # 记录已恢复的文件

        try:
            # 获取安全的目标路径
            target_path = self.resolve_path(params.target_project)
            logger.info(f"目标项目路径: {target_path}")

            # 检查目标项目是否存在
            if not target_path.exists():
                error_msg = f"Project does not exist: {params.target_project}"
                logger.error(error_msg)
                return ToolResult(error=error_msg)

            if not target_path.is_dir():
                error_msg = f"Path is not a directory: {params.target_project}"
                logger.error(error_msg)
                return ToolResult(error=error_msg)

            # 定义需要恢复的文件列表
            files_to_restore = []
            if params.restore_dashboard_js:
                files_to_restore.append("dashboard.js")
            if params.restore_index_css:
                files_to_restore.append("index.css")
            if params.restore_index_html:
                files_to_restore.append("index.html")
            if params.restore_config_js:
                files_to_restore.append("config.js")

            if not files_to_restore:
                error_msg = "No files specified for restoration"
                logger.error(error_msg)
                return ToolResult(error=error_msg)

            # 恢复指定的文件
            for file_name in files_to_restore:
                target_file = target_path / file_name
                backup_file = target_path / f".{file_name}.backup"

                # 检查备份文件是否存在
                if not backup_file.exists():
                    logger.warning(f"备份文件不存在，跳过: {file_name}")
                    continue

                # 使用 versioning context 恢复文件（无需更新时间戳，因为是工具操作的文件）
                async with self._file_versioning_context(tool_context, target_file, update_timestamp=False):
                    # 创建临时备份当前文件（如果存在）
                    temp_backup = None
                    if target_file.exists():
                        temp_backup = target_path / f".{file_name}.temp"
                        await async_copy2(target_file, temp_backup)
                        logger.info(f"临时备份当前文件: {file_name}")

                    # 恢复备份文件到目标位置
                    await async_copy2(backup_file, target_file)
                    logger.info(f"恢复文件: {file_name}")

                    # 将临时备份文件替换原备份文件（实现互换）
                    if temp_backup and temp_backup.exists():
                        await async_copy2(temp_backup, backup_file)
                        temp_backup.unlink()  # 删除临时文件
                        logger.info(f"更新备份文件: {file_name}")

                restored_files.append(file_name)

            if not restored_files:
                return ToolResult(content="No backup files found for restoration")

            # 生成结果信息
            result_content = self._generate_restore_result_content(params, restored_files)

            return ToolResult(
                content=result_content,
                extra_info={
                    "target_project": params.target_project,
                    "restored_files": restored_files
                }
            )

        except Exception as e:
            logger.exception(f"恢复数据看板模板备份失败: {e}")
            return ToolResult(error="Backup restoration failed")

    def _generate_restore_result_content(self, params: BackupDashboardTemplateParams, restored_files: List[str]) -> str:
        """
        生成恢复结果内容

        Args:
            params: 参数对象
            restored_files: 已恢复的文件列表

        Returns:
            str: 格式化的结果内容
        """
        files_str = ", ".join(restored_files)
        result = f"Backup restoration successful: {params.target_project}/ restored {files_str}"

        return result

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        """获取工具详情 - 失败时显示错误信息"""
        # 成功时不需要 ToolDetail
        if result.ok:
            return None

        # 获取项目名称
        target_project = arguments.get("target_project", "unknown") if arguments else "unknown"

        # 失败时返回 ToolDetail
        return self._generate_failure_detail(target_project, result)

    def _generate_failure_detail(self, target_project: str, result: ToolResult) -> ToolDetail:
        """生成恢复失败的详细信息"""
        error_message = result.content or "Unknown error"

        command = f"backup_dashboard_template --target_project {target_project}"

        output_lines = []

        # 简化的失败结果
        output_lines.append("Dashboard template backup result: [FAIL] Failed")
        output_lines.append("")
        output_lines.append("Error:")
        output_lines.append(f"{error_message}")

        terminal_content = TerminalContent(
            command=command,
            output="\n".join(output_lines),
            exit_code=1
        )

        return ToolDetail(
            type=DisplayType.TERMINAL,
            data=terminal_content
        )

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        if not arguments or "target_project" not in arguments:
            return i18n.translate("unknown.message", category="tool.messages")

        target_project = arguments["target_project"]
        return i18n.translate("backup_dashboard_template.success", category="tool.messages", project_name=target_project)

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None) -> Dict:
        """
        获取工具调用后的友好动作和备注

        Args:
            tool_name: 工具名称
            tool_context: 工具上下文
            result: 工具执行结果
            execution_time: 执行耗时
            arguments: 执行参数

        Returns:
            Dict: 包含action和remark的字典
        """
        if not result.ok:
            return {
                "action": i18n.translate("backup_dashboard_template", category="tool.actions"),
                "remark": i18n.translate("backup_dashboard_template.error", category="tool.messages", error=result.content)
            }

        return {
            "action": i18n.translate("backup_dashboard_template", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }
