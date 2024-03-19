from app.i18n import i18n
from typing import Any, Dict, Optional

from pydantic import Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.event.event import EventType
from agentlang.logger import get_logger
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_guard_tool import WorkspaceGuardTool
from app.core.entity.message.server_message import DisplayType, ToolDetail, TerminalContent
from app.tools.data_analyst_dashboard_tools.validators import (
    DataJsValidator,
    ConfigJsValidator,
    JavascriptSyntaxValidator,
    CardCompletenessValidator,
    LayoutGridValidator,
    DataCleaningValidator,
    MagicProjectValidator,
    BrowserValidator,
    GeoJsonDownloader,
)
from app.tools.data_analyst_dashboard_tools.dashboard_sync_utils import (
    sync_geo_and_data_sources,
)

logger = get_logger(__name__)



class ValidateDashboardParams(BaseToolParams):
    project_path: str = Field(
        ...,
        description="""<!--zh: 要验证的看板项目目录路径，相对于工作区根目录-->
Dashboard project directory path to validate, relative to workspace root"""
    )

    @field_validator('project_path')
    @classmethod
    def validate_project_path(cls, v):
        if not v or not isinstance(v, str) or not v.strip():
            raise ValueError("project_path cannot be empty, must be a non-empty string")
        return v.strip()

    @classmethod
    def get_custom_error_message(cls, field_name: str, error_type: str) -> Optional[str]:
        """获取自定义参数错误信息"""
        if field_name == "project_path":
            return "Please provide a valid dashboard project directory path, such as: 'sales_dashboard', 'financial_dashboard', etc."
        return None


@tool()
class ValidateDashboard(AbstractFileTool[ValidateDashboardParams], WorkspaceGuardTool[ValidateDashboardParams]):
    """<!--zh
    验证dashboard项目配置工具

    自动化验证dashboard项目的地图和数据源配置：
    1. 校验data.js和config.js文件格式
    2. JavaScript语法检查
    3. 智能检测地图可视化需求并下载GeoJSON文件
    4. 扫描cleaned_data目录并更新数据源配置
    -->
    Validate dashboard project configuration tool

    Automated validation of dashboard project map and data source configuration:
    1. Validate data.js and config.js file formats
    2. JavaScript syntax check
    3. Intelligently detect map visualization needs and download GeoJSON files
    4. Scan cleaned_data directory and update data source configuration
    """

    # GeoJSON.CN API配置
    GEOJSON_VERSION = "1.6.2"
    BASE_URL = "https://file.geojson.cn/china"

    async def execute(self, tool_context: ToolContext, params: ValidateDashboardParams) -> ToolResult:
        """执行地图数据设置"""
        try:
            # 步骤1: 验证项目目录（使用 get_safe_path 限制在工作区内，防止路径穿越）
            project_dir, path_error = self.get_safe_path(params.project_path)
            if path_error:
                return ToolResult(error=path_error)
            if not project_dir or not project_dir.exists():
                return ToolResult(
                    error=f"Project does not exist: {params.project_path}"
                )

            # 准备geo目录配置（但不立即创建）
            target_dir = "geo"
            target_path = project_dir / target_dir
            magic_project_path = project_dir / "magic.project.js"

            if not magic_project_path.exists():
                return ToolResult(
                    error="magic.project.js file does not exist"
                )

            # 步骤2: 校验并尝试修复 magic.project.js 文件
            try:
                magic_project_validator = MagicProjectValidator()
                is_magic_ok = magic_project_validator.validate_and_repair(magic_project_path)
                if not is_magic_ok:
                    return ToolResult(
                        error=(
                            "magic.project.js file validation failed and automatic repair was unsuccessful. "
                        )
                    )
            except Exception as e:
                logger.error(f"magic.project.js 文件校验失败: {e}")
                return ToolResult(
                    error=f"magic.project.js file validation process failed: {str(e)}"
                )

            # 步骤3: 校验data.js文件内容
            try:
                data_js_validator = DataJsValidator()
                await data_js_validator.validate(project_dir)
            except Exception as e:
                logger.error(f"data.js文件校验失败: {e}")
                return ToolResult(
                    error=f"data.js file validation failed: {str(e)}"
                )

            # 步骤4: 校验config.js文件内容
            try:
                config_js_validator = ConfigJsValidator()
                await config_js_validator.validate(project_dir)
            except Exception as e:
                logger.error(f"config.js文件校验失败: {e}")
                # 尝试从模板恢复config.js文件
                try:
                    logger.info("尝试从模板恢复config.js文件")
                    await config_js_validator.restore_from_template(project_dir)
                    # 恢复后重新校验
                    await config_js_validator.validate(project_dir)
                    logger.info("config.js文件已从模板恢复并校验通过")
                except Exception as restore_error:
                    logger.error(f"从模板恢复config.js文件失败: {restore_error}")
                    return ToolResult(
                        error=f"config.js file validation failed and template recovery failed: original_error={str(e)}, recovery_error={str(restore_error)}"
                    )

            # 步骤4.1: 检查JavaScript语法
            try:
                js_syntax_validator = JavascriptSyntaxValidator()
                await js_syntax_validator.validate(project_dir)
                logger.info("JavaScript语法检查通过")
            except Exception as e:
                logger.error(f"JavaScript语法检查失败: {e}")
                return ToolResult(
                    error=f"JavaScript syntax check failed: {str(e)}"
                )

            # 步骤4.2: 验证卡片完成度（对比data.js与cards_todo.md）
            try:
                card_completeness_validator = CardCompletenessValidator()
                await card_completeness_validator.validate(project_dir)
                logger.info("卡片完成度验证通过")
            except Exception as e:
                logger.error(f"卡片完成度验证失败: {e}")
                return ToolResult(
                    error=f"Card completeness validation failed: {str(e)}"
                )

            # 步骤4.3: 验证布局栅格横向铺满
            try:
                layout_grid_validator = LayoutGridValidator()
                await layout_grid_validator.validate(project_dir)
                logger.info("布局栅格验证通过")
            except Exception as e:
                logger.error(f"布局栅格验证失败: {e}")
                return ToolResult(
                    error=f"Layout grid validation failed: {str(e)}"
                )

            # 步骤4.4: 验证data_cleaning.py的必需语句和数据源配置
            try:
                data_cleaning_validator = DataCleaningValidator()
                await data_cleaning_validator.validate(project_dir, magic_project_path)
                logger.info("数据清洗脚本验证通过")
            except Exception as e:
                logger.error(f"数据清洗脚本验证失败: {e}")
                return ToolResult(
                    error=f"Data cleaning script validation failed: {str(e)}"
                )

            # 步骤5 & 8: 自动检测地图卡片并更新地图与数据源配置（复用同步工具）
            sync_extra: Dict[str, Any] = {}
            await sync_geo_and_data_sources(
                tool=self,
                tool_context=tool_context,
                project_path=project_dir,
                phase="验证看板阶段",
                extra_info=sync_extra,
            )

            # 从同步结果中提取统计信息（若不存在则使用默认值）
            total_areas = int(sync_extra.get("geo_total_areas", 0) or 0)
            downloaded_file_paths = sync_extra.get("geo_downloaded_files", []) or []
            skipped_files = []  # 复用工具中已对“已存在文件”静默跳过，此处不再单独统计
            added_geo_config_count = int(sync_extra.get("geo_added", 0) or 0)
            skipped_geo_config_count = int(sync_extra.get("geo_skipped", 0) or 0)

            data_source_count = int(sync_extra.get("data_source_count", 0) or 0)
            data_source_items = sync_extra.get("data_source_items", []) or []
            geo_config_items = sync_extra.get("geo_config_items", []) or []
            target_dir = "geo"

            # 步骤9: 使用无头浏览器校验网页是否正常
            browser_validator = BrowserValidator()
            validation_result = await browser_validator.validate(project_dir)

            # 步骤10: 设置dashboard为就绪状态
            index_html_path = project_dir / "index.html"
            await magic_project_validator.set_dashboard_ready(index_html_path)

            # 步骤11: 检查浏览器校验结果，如果有错误则阻塞执行
            if not validation_result.get('success', True):
                error_details = validation_result.get('error_details', {})

                # 区分两种失败情况
                if error_details:
                    # 情况1: Dashboard渲染问题，有详细的错误统计
                    error_messages = error_details.get('error_messages', [])
                    total_error_count = error_details.get('total_error_count', error_details.get('error_count', 0))

                    if total_error_count > 0:
                        error_summary = f"Validation failed, found {total_error_count} errors:"

                        # 添加具体错误信息
                        for i, msg in enumerate(error_messages, 1):
                            error_summary += f"\n{i}. {msg}"
                    else:
                        # 理论上不应该发生，但为了安全起见
                        error_summary = "Validation failed, but no specific errors detected"
                else:
                    # 情况2: 基础设施问题，直接使用错误描述
                    error_summary = validation_result['error']

                # 添加警告信息
                warning_count = validation_result.get('warningCount', 0)
                if warning_count > 0:
                    warnings = validation_result.get('warnings', [])
                    error_summary += f"\n\nFound {warning_count} warnings:"

                    for i, warning in enumerate(warnings, 1):
                        warning_type = warning.get('type', 'UNKNOWN')
                        warning_message = warning.get('message', 'Unknown warning')
                        warning_details = warning.get('details', {})

                        error_summary += f"\n{i}. [{warning_type}] {warning_message}"

                        # 添加详细信息
                        if warning_details and isinstance(warning_details, dict):
                            detail_parts = []
                            for key, value in warning_details.items():
                                if key == 'availableConfigs' and isinstance(value, list):
                                    # 限制显示的配置数量
                                    configs_display = ', '.join(value[:3])
                                    if len(value) > 3:
                                        configs_display += f" and {len(value)} more configs"
                                    detail_parts.append(f"{key}: {configs_display}")
                                else:
                                    detail_parts.append(f"{key}: {value}")

                            if detail_parts:
                                error_summary += f" (Details: {'; '.join(detail_parts)})"

                return ToolResult(
                    error=error_summary,
                    extra_info={
                        "project_path": params.project_path,
                        "validation_failed": True,
                        "browser_validation": validation_result,
                        "data_js_validation": "passed",
                        "config_js_validation": "passed",
                        "javascript_syntax_validation": "passed",
                        "card_completeness_validation": "passed",
                        "layout_grid_validation": "passed",
                        "data_cleaning_validation": "passed"
                    }
                )

            # 步骤12: 生成结果报告，包含浏览器验证的警告信息
            downloaded_count = len(downloaded_file_paths)
            skipped_count = len(skipped_files)

            # 根据是否有地图生成不同的结果信息
            if total_areas > 0:
                content = f"Validation passed. Maps: downloaded {downloaded_count}, configured {added_geo_config_count}; Data sources: {data_source_count}"
            else:
                content = f"Validation passed. Data sources: {data_source_count}. Dashboard is ready"


            # 添加浏览器验证结果
            warning_count = validation_result.get('warningCount', 0)

            total_warning_count = warning_count

            if total_warning_count > 0:
                warnings = validation_result.get('warnings', [])
                content += f"\n\nBrowser validation: passed, but found {total_warning_count} warnings:"

                for i, warning in enumerate(warnings, 1):
                    warning_type = warning.get('type', 'UNKNOWN')
                    warning_message = warning.get('message', 'Unknown warning')
                    warning_details = warning.get('details', {})

                    content += f"\n{i}. [{warning_type}] {warning_message}"

                    # 添加详细信息
                    if warning_details and isinstance(warning_details, dict):
                        detail_parts = []
                        for key, value in warning_details.items():
                            if key == 'availableConfigs' and isinstance(value, list):
                                # 限制显示的配置数量
                                configs_display = ', '.join(value[:3])
                                if len(value) > 3:
                                    configs_display += f" and {len(value)} more configs"
                                detail_parts.append(f"{key}: {configs_display}")
                            else:
                                detail_parts.append(f"{key}: {value}")

                        if detail_parts:
                            content += f" (Details: {'; '.join(detail_parts)})"

                content += "\n\nThese warnings do not affect basic functionality, but it is recommended to check related configurations for better user experience."
            else:
                content += "\n\nBrowser validation: completely passed, no warnings or errors."

            return ToolResult(
                content=content,
                extra_info={
                    "project_path": params.project_path,
                        "total_areas": total_areas,
                    "downloaded_count": downloaded_count,
                    "skipped_count": skipped_count,
                    "added_geo_config_count": added_geo_config_count,
                    "skipped_geo_config_count": skipped_geo_config_count,
                    "data_source_count": data_source_count,
                    "downloaded_files": downloaded_file_paths,
                    "skipped_files": [str(f) for f in skipped_files],
                    "geo_config_items": geo_config_items,
                    "data_source_items": data_source_items,
                    "target_dir": target_dir,
                    "data_js_validation": "passed",
                    "config_js_validation": "passed",
                    "javascript_syntax_validation": "passed",
                    "card_completeness_validation": "passed",
                    "layout_grid_validation": "passed",
                    "data_cleaning_validation": "passed",
                    "browser_validation": validation_result
                }
            )

        except Exception as e:
            logger.error(f"设置dashboard地图数据时发生错误: {e}", exc_info=True)
            return ToolResult(
                error=f"Failed to setup dashboard map data: {str(e)}"
            )

    def _generate_success_detail(self, project_path: str, extra_info: Dict[str, Any]) -> ToolDetail:
        """生成验证成功的详细信息"""

        command = f"validate_dashboard --project {project_path}"

        output_lines = []

        # 简化的验证结果
        output_lines.append("Validation result: [OK] Passed")

        terminal_content = TerminalContent(
            command=command,
            output="\n".join(output_lines),
            exit_code=0
        )

        return ToolDetail(
            type=DisplayType.TERMINAL,
            data=terminal_content
        )

    def _generate_failure_detail(self, project_path: str, result: ToolResult) -> ToolDetail:
        """生成验证失败的详细信息"""
        error_message = result.content or "Unknown error"

        command = f"validate_dashboard --project {project_path}"

        output_lines = []

        # 简化的失败结果
        output_lines.append("Validation result: [FAIL] Failed")
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
        if not arguments or "project_path" not in arguments:
            return i18n.translate("unknown.message", category="tool.messages")

        project_path = arguments["project_path"]
        return i18n.translate("validate_dashboard.success", category="tool.messages", project_path=project_path)

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
                "action": i18n.translate(self.name, category="tool.actions"),
                "remark": i18n.translate("validate_dashboard.error", category="tool.messages", error=result.content)
            }

        return {
            "action": i18n.translate(self.name, category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }
