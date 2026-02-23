from app.i18n import i18n
import shutil
import os
import re
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


class UpdateDashboardTemplateParams(BaseToolParams):
    target_project: str = Field(
        description="""<!--zh: 要更新的看板项目目录名称，相对于工作区的路径-->
Dashboard project directory name to update, path relative to workspace"""
    )
    update_dashboard_js: bool = Field(
        default=False,
        description="""<!--zh: 是否更新 dashboard.js 核心逻辑文件-->
Whether to update dashboard.js core logic file"""
    )
    update_index_css: bool = Field(
        default=False,
        description="""<!--zh: 是否更新 index.css 样式文件-->
Whether to update index.css style file"""
    )
    update_index_html: bool = Field(
        default=False,
        description="""<!--zh: 是否更新 index.html 主页面文件-->
Whether to update index.html main page file"""
    )
    update_config_js: bool = Field(
        default=False,
        description="是否更新 config.js 配置文件"
    )


@tool()
class UpdateDashboardTemplate(AbstractFileTool[UpdateDashboardTemplateParams], WorkspaceTool[UpdateDashboardTemplateParams]):
    """<!--zh
    更新数据分析看板模板文件工具

    从模板目录更新指定项目中的 dashboard.js、index.css、index.html 和 config.js 文件。
    -->
    Update data analysis dashboard template files tool

    Update dashboard.js, index.css, index.html, and config.js files in specified project from template directory.
    """

    async def execute(self, tool_context: ToolContext, params: UpdateDashboardTemplateParams) -> ToolResult:
        """执行工具并返回结果

        Args:
            tool_context: 工具上下文
            params: 更新参数

        Returns:
            ToolResult: 包含操作结果或错误信息
        """
        updated_files = []  # 记录已更新的文件
        backup_files = []   # 记录备份文件，用于回滚

        try:
            # 获取模板源目录路径
            template_source = Path(__file__).parent.parent / "data_analyst_dashboard_template"
            logger.info(f"模板源目录: {template_source}")

            # 检查模板源目录是否存在
            if not template_source.exists():
                error_msg = "Template source directory does not exist"
                logger.error(error_msg)
                return ToolResult.error(error_msg)

            # 获取安全的目标路径
            target_path = self.resolve_path(params.target_project)
            logger.info(f"目标项目路径: {target_path}")

            # 检查目标项目是否存在
            if not target_path.exists():
                error_msg = f"Project does not exist: {params.target_project}"
                logger.error(error_msg)
                return ToolResult.error(error_msg)

            if not target_path.is_dir():
                error_msg = f"Path is not a directory: {params.target_project}"
                logger.error(error_msg)
                return ToolResult.error(error_msg)

            # 定义需要更新的文件列表
            files_to_update = []
            if params.update_dashboard_js:
                files_to_update.append("dashboard.js")
            if params.update_index_css:
                files_to_update.append("index.css")
            if params.update_index_html:
                files_to_update.append("index.html")
            if params.update_config_js:
                files_to_update.append("config.js")

            if not files_to_update:
                error_msg = "No files specified for update"
                logger.error(error_msg)
                return ToolResult.error(error_msg)

            # 更新指定的文件
            for file_name in files_to_update:
                source_file = template_source / file_name
                target_file = target_path / file_name

                # 检查源文件是否存在
                if not source_file.exists():
                    logger.warning(f"源文件不存在，跳过: {file_name}")
                    continue

                # 备份目标文件（如果存在）
                if target_file.exists():
                    backup_file = target_file.parent / f".{target_file.name}.backup"
                    # 检查是否已存在备份文件
                    backup_exists = backup_file.exists()
                    # 直接覆盖已存在的备份文件（只保留一份历史备份）
                    await async_copy2(target_file, backup_file)
                    backup_files.append((target_file, backup_file))
                    if backup_exists:
                        logger.info(f"覆盖备份文件: {file_name} -> {backup_file.name}")
                    else:
                        logger.info(f"创建备份文件: {file_name} -> {backup_file.name}")

                # 使用 versioning context 更新文件（无需更新时间戳，因为是工具生成的文件）
                async with self._file_versioning_context(tool_context, target_file, update_timestamp=False):
                    # 特殊处理 index.html 文件，保留原有的 ready 值
                    if file_name == "index.html" and target_file.exists():
                        # 读取原文件内容，提取 ready 值
                        with open(target_file, 'r', encoding='utf-8') as f:
                            original_content = f.read()
                        original_ready_value = self._extract_ready_value_from_html(original_content)
                        logger.info(f"从原 index.html 中提取到 ready 值: {original_ready_value}")

                        # 读取新模板文件内容
                        with open(source_file, 'r', encoding='utf-8') as f:
                            new_content = f.read()

                        # 将原有的 ready 值应用到新内容中
                        updated_content = self._update_ready_value_in_html(new_content, original_ready_value)

                        # 写入更新后的内容
                        with open(target_file, 'w', encoding='utf-8') as f:
                            f.write(updated_content)

                        logger.info(f"更新文件并保留 ready 值: {file_name}")
                    else:
                        # 对于其他文件，直接复制
                        await async_copy2(source_file, target_file)
                        logger.info(f"更新文件: {file_name}")

                updated_files.append(file_name)

            # 清理备份文件（更新成功后）
            await self._cleanup_backup_files(backup_files)

            if not updated_files:
                return ToolResult(content="No files need to be updated")

            # 生成结果信息
            result_content = self._generate_result_content(params, updated_files)

            return ToolResult(
                content=result_content,
                extra_info={
                    "target_project": params.target_project,
                    "updated_files": updated_files,
                    "backup_files": [str(backup[1]) for backup in backup_files]
                }
            )

        except Exception as e:
            logger.exception(f"更新数据看板模板失败: {e}")

            # 回滚：恢复备份文件
            await self._rollback_from_backup(backup_files)

            return ToolResult.error("Template update failed")

    def _extract_ready_value_from_html(self, html_content: str) -> bool:
        """
        从 HTML 内容中提取 ready 值

        Args:
            html_content: HTML 文件内容

        Returns:
            bool: ready 值，默认为 false
        """
        try:
            # 使用正则表达式匹配 ready: true/false 的模式
            pattern = r'ready:\s*(true|false)'
            match = re.search(pattern, html_content)

            if match:
                ready_str = match.group(1)
                return ready_str.lower() == 'true'
            else:
                logger.warning("未找到 ready 值，使用默认值 false")
                return False

        except Exception as e:
            logger.error(f"提取 ready 值时发生错误: {e}")
            return False

    def _update_ready_value_in_html(self, html_content: str, ready_value: bool) -> str:
        """
        在 HTML 内容中更新 ready 值

        Args:
            html_content: HTML 文件内容
            ready_value: 要设置的 ready 值

        Returns:
            str: 更新后的 HTML 内容
        """
        try:
            # 使用正则表达式替换 ready 值
            pattern = r'(ready:\s*)(true|false)'
            replacement = f'\\g<1>{str(ready_value).lower()}'

            updated_content = re.sub(pattern, replacement, html_content)

            # 检查是否成功替换
            if updated_content == html_content:
                logger.warning("未找到 ready 值进行替换")
            else:
                logger.info(f"成功更新 ready 值为: {ready_value}")

            return updated_content

        except Exception as e:
            logger.error(f"更新 ready 值时发生错误: {e}")
            return html_content

    async def _cleanup_backup_files(self, backup_files: List[tuple]):
        """
        清理备份文件

        Args:
            backup_files: 备份文件列表，每个元素是 (原文件路径, 备份文件路径) 的元组
        """
        for original_file, backup_file in backup_files:
            try:
                if backup_file.exists():
                    backup_file.unlink()
                    logger.info(f"清理备份文件: {backup_file.name}")
            except Exception as e:
                logger.warning(f"清理备份文件失败 {backup_file}: {e}")

    async def _rollback_from_backup(self, backup_files: List[tuple]):
        """
        从备份文件回滚

        Args:
            backup_files: 备份文件列表，每个元素是 (原文件路径, 备份文件路径) 的元组
        """
        for original_file, backup_file in backup_files:
            try:
                if backup_file.exists():
                    await async_copy2(backup_file, original_file)
                    backup_file.unlink()  # 删除备份文件
                    logger.info(f"回滚文件: {original_file.name}")
            except Exception as rollback_error:
                logger.error(f"回滚文件失败 {original_file}: {rollback_error}")

    def _generate_result_content(self, params: UpdateDashboardTemplateParams, updated_files: List[str]) -> str:
        """
        生成简洁的结果内容

        Args:
            params: 参数对象
            updated_files: 已更新的文件列表

        Returns:
            str: 格式化的结果内容
        """
        files_str = ", ".join(updated_files)
        result = f"Template update successful: {params.target_project}/ updated {files_str}"

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
        """生成更新失败的详细信息"""
        error_message = result.content or "Unknown error"

        command = f"update_dashboard_template --target_project {target_project}"

        output_lines = []

        # 简化的失败结果
        output_lines.append("Dashboard template update result: [FAIL] Failed")
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
        return i18n.translate("update_dashboard_template.success", category="tool.messages", project_name=target_project)

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
                "action": i18n.translate("update_dashboard_template", category="tool.actions"),
                "remark": i18n.translate("update_dashboard_template.error", category="tool.messages", error=result.content)
            }

        return {
            "action": i18n.translate("update_dashboard_template", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }
