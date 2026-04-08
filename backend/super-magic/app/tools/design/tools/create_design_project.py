"""创建设计项目工具

此工具用于创建完整的设计项目结构和画布配置。
"""

from app.i18n import i18n
from pathlib import Path
from typing import Any, Dict, List, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.event.event import EventType
from agentlang.logger import get_logger
from agentlang.path_manager import PathManager
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail, DisplayType, FileContent
from app.tools.core import BaseToolParams, tool
from app.tools.design.tools.base_design_tool import BaseDesignTool
from app.utils.async_file_utils import (
    async_read_text,
    async_write_text_with_retry,
    async_mkdir,
    async_exists,
)

logger = get_logger(__name__)


class CreateDesignProjectParams(BaseToolParams):
    project_path: str = Field(
        ...,
        description="""<!--zh: 要创建的设计项目的相对路径，项目名称将从路径中自动提取（如 'xx/yy' 提取 'yy'），项目名称应反映设计主题，避免使用文件系统不支持的字符，示例：'产品海报设计'、'ブランドデザイン'、'brand-design-2024'-->
Relative path for design project to create. Project name will be automatically extracted from path (e.g., 'xx/yy' extracts 'yy'). Project name should reflect design theme, avoid filesystem-unsupported characters. Examples: 'brand-design-2024', '产品海报设计', 'ブランドデザイン'"""
    )


@tool()
class CreateDesignProject(BaseDesignTool[CreateDesignProjectParams]):
    """<!--zh
    创建设计项目工具

    此工具用于在工作区自动创建设计项目的完整结构：
    - 自动创建项目文件夹
    - 生成 magic.project.js（画布项目标识文件）

    项目创建后，可以使用其他工具操作画布元素（创建、更新、删除、查询等）。

    重要说明：
    - 包含 magic.project.js 的文件夹即为画布项目
    - 所有画布工具都需要 project_path 参数指向包含此文件的文件夹
    - 如果文件夹中没有 magic.project.js，工具将报错

    项目结构：
    ```
    产品海报设计/
    └── magic.project.js  # 画布项目标识文件（工具自动管理）
    ```
    -->
    Create design project tool

    This tool auto-creates complete design project structure in workspace:
    - Auto-create project folder
    - Generate magic.project.js (canvas project identifier file)

    After project creation, you can use other tools to operate canvas elements (create, update, delete, query, etc.).

    Important notes:
    - A folder containing magic.project.js is a canvas project
    - All canvas tools require project_path parameter pointing to the folder containing this file
    - If folder doesn't have magic.project.js, tools will report error

    Project structure:
    ```
    brand-design-2024/
    └── magic.project.js  # Canvas project identifier file (auto-managed by tools)
    ```
    """

    async def execute(self, tool_context: ToolContext, params: CreateDesignProjectParams) -> ToolResult:
        """执行设计项目创建操作

        Args:
            tool_context: 工具上下文
            params: 包含项目路径和配置信息的参数对象

        Returns:
            ToolResult: 包含创建结果详细信息
        """
        try:
            # 使用基类方法获取安全的项目路径
            project_path, error = await self._get_project_path(params.project_path)
            if error:
                return ToolResult.error(
                    error,
                    extra_info={"error_type": "design.error_project_not_found"}
                )

            # 检查项目文件夹是否已存在
            folder_already_exists = await async_exists(project_path)

            # 如果项目文件夹不存在则创建
            if not folder_already_exists:
                try:
                    await async_mkdir(project_path, parents=True, exist_ok=False)
                    logger.info(f"Created new project folder: {project_path}")
                except Exception as e:
                    logger.error(f"Failed to create project folder: {e}")
                    return ToolResult.error(
                        f"Failed to create project folder: {e}",
                        extra_info={"error_type": "design.error_unexpected"}
                    )
            else:
                logger.info(f"Using existing project folder: {project_path}")

            # 定义所有文件路径，使用基类方法
            project_js_path = self._get_magic_project_js_path(project_path)
            # 从路径中提取项目名称，使用基类方法
            project_name = self._get_project_name(project_path)

            # 检查 magic.project.js 是否已存在
            config_file_exists = await async_exists(project_js_path)

            # 从模板生成 magic.project.js 配置文件
            # 使用 PathManager 获取项目根目录，确保在任何环境下都能正确找到模板文件
            project_root = PathManager.get_project_root()
            template_path = project_root / "app" / "tools" / "magic_design" / "magic.project.template.js"

            if not await async_exists(template_path):
                raise FileNotFoundError(f"找不到模板文件: {template_path}")

            # 读取模板内容
            template_content = await async_read_text(template_path)

            # 替换模板占位符
            project_js_content = template_content.replace("{{PROJECT_NAME}}", project_name)

            # 写入 magic.project.js 配置文件（异步）
            try:
                # 触发文件事件（创建或更新）前事件
                before_event_type = EventType.BEFORE_FILE_UPDATED if config_file_exists else EventType.BEFORE_FILE_CREATED
                await self._dispatch_file_event(tool_context, str(project_js_path), before_event_type)

                # 写入文件并验证（带重试，适应 TOS 同步延迟）
                await async_write_text_with_retry(
                    project_js_path,
                    project_js_content,
                    content_validator=lambda c: "magicProjectConfig" in c,
                )

                # 触发文件事件（创建或更新）后事件
                after_event_type = EventType.FILE_UPDATED if config_file_exists else EventType.FILE_CREATED
                await self._dispatch_file_event(tool_context, str(project_js_path), after_event_type)

                if config_file_exists:
                    logger.info(f"Updated project config file: {project_js_path}")
                else:
                    logger.info(f"Created project config file: {project_js_path}")
            except Exception as e:
                logger.error(f"Failed to create magic.project.js file: {e}")
                return ToolResult.error(
                    f"Failed to create magic.project.js file: {e}",
                    extra_info={"error_type": "design.error_unexpected"}
                )

            # 生成结果信息
            result_content = self._generate_result_content(project_path, params, project_name)

            return ToolResult(
                content=result_content,
                data={
                    "project_path": params.project_path,
                    "project_name": project_name
                },
                extra_info={
                    "project_path": params.project_path,
                    "project_name": project_name
                }
            )

        except Exception as e:
            logger.exception(f"Failed to create design project: {e!s}")
            return ToolResult.error(
                f"Failed to create design project: {e!s}",
                extra_info={"error_type": "design.error_unexpected"}
            )

    # noinspection PyMethodMayBeStatic
    def _generate_result_content(self, project_path: Path, params: CreateDesignProjectParams, project_name: str) -> str:
        """生成结构化的结果内容

        Args:
            project_path: 项目文件夹路径
            params: 项目参数
            project_name: 项目名称

        Returns:
            str: 格式化的结果内容
        """
        result = f"""Project structure:
{params.project_path}/
└── magic.project.js  # Canvas project identifier (auto-managed)

Project: {project_name} (canvas project)"""

        return result

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        if not arguments or "project_path" not in arguments:
            return i18n.translate("create_design_project.exception", category="tool.messages")

        project_path = arguments["project_path"]
        project_name = Path(project_path).name

        return i18n.translate("create_design_project.success", category="tool.messages", project_name=project_name)

    async def get_after_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, result: ToolResult,
        execution_time: float, arguments: Dict[str, Any] = None
    ) -> Dict:
        """获取工具调用后的友好操作和备注

        Args:
            tool_name: 工具名称
            tool_context: 工具上下文
            result: 工具执行结果
            execution_time: 执行时间
            arguments: 执行参数

        Returns:
            Dict: 包含 action 和 remark 的字典
        """
        # create_design_project 不涉及文件修改检测，但仍使用统一处理以保持一致性
        return self._handle_design_tool_error(
            result,
            default_action_code="create_design_project",
            default_success_message_code="create_design_project.success"
        ) if not result.ok else {
            "action": i18n.translate("create_design_project", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        """生成工具详情，用于前端展示

        Args:
            tool_context: 工具上下文
            result: 工具结果
            arguments: 工具参数

        Returns:
            Optional[ToolDetail]: 工具详情
        """
        if not result.ok or not arguments:
            return None

        try:
            from app.core.entity.message.server_message import DesignCanvasContent

            # 优先从 extra_info 获取数据，fallback 到 arguments
            extra_info = result.extra_info or {}
            project_path = extra_info.get("project_path") or (arguments.get("project_path", "") if arguments else "")

            return ToolDetail(
                type=DisplayType.DESIGN,
                data=DesignCanvasContent(
                    type="canvas",
                    project_path=project_path
                )
            )
        except Exception as e:
            logger.error(f"生成工具详情失败: {e!s}")
            return None
