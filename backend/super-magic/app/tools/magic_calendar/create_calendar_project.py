"""create_calendar_project: 创建日历项目

在已有文件夹中生成 magic.project.js + 复制 index.html，
搭建可视化日历项目骨架。
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from pydantic import Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.i18n import i18n
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool
from app.tools.magic_calendar.calendar_utils import ensure_events_dir
from app.utils.async_file_utils import async_copy2, async_exists

logger = get_logger(__name__)


class CreateCalendarProjectParams(BaseToolParams):
    """创建日历项目参数"""

    project_path: str = Field(
        ...,
        description="""<!--zh: 已有日历项目文件夹路径（必须已存在，本工具不创建文件夹）。使用用户语言命名。示例：'内容发布日历', 'Content_Calendar', 'コンテンツカレンダー'-->
Existing calendar project folder path (must already exist, this tool does not create folders). Must name according to the user's language. Examples: 'Content_Calendar', '内容发布日历', 'コンテンツカレンダー'"""
    )

    calendar_name: str = Field(
        ...,
        description="""<!--zh: 日历名称。示例：'抖音内容发布日历', 'TikTok Content Calendar'-->
Calendar name. Examples: 'TikTok Content Calendar', '抖音内容发布日历'"""
    )

    description: Optional[str] = Field(
        None,
        description="""<!--zh: 日历描述（可选）-->
Calendar description (optional)"""
    )

    timezone: str = Field(
        default="Asia/Shanghai",
        description="""<!--zh: IANA 时区标识，默认 Asia/Shanghai-->
IANA timezone identifier, default Asia/Shanghai"""
    )

    initial_categories: Optional[str] = Field(
        None,
        description="""<!--zh: 初始分类 JSON 数组。示例：[{"id":"meeting","name":"会议","color":"#4CAF50"},{"id":"publish","name":"发布","color":"#FF9800"}]-->
Initial categories as JSON array. Example: [{"id":"meeting","name":"Meeting","color":"#4CAF50"},{"id":"publish","name":"Publish","color":"#FF9800"}]"""
    )

    @field_validator("initial_categories", mode="before")
    @classmethod
    def validate_categories(cls, v):
        """校验 initial_categories 为合法 JSON 数组"""
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if not isinstance(parsed, list):
                    raise ValueError("initial_categories must be a JSON array")
                return v
            except json.JSONDecodeError as e:
                raise ValueError(f"initial_categories is not valid JSON: {e}") from e
        return v


@tool()
class CreateCalendarProject(AbstractFileTool[CreateCalendarProjectParams], WorkspaceTool[CreateCalendarProjectParams]):
    """<!--zh
    搭建日历项目基础架构。在已有文件夹中生成项目骨架：
    - 复制 index.html 可视化页面
    - 生成 magic.project.js 配置文件（含日历元数据和空事件列表）

    注意：本工具不创建文件夹。调用前必须确保项目文件夹已存在。

    项目结构：
    ```
    内容发布日历/
    ├── magic.project.js    # 项目配置（日历数据）
    └── index.html          # 可视化日历页面
    ```
    -->
    Setup calendar project infrastructure. Generates project skeleton in existing folder:
    - Copy index.html visualization page
    - Generate magic.project.js configuration file (with calendar metadata and empty event list)

    Note: This tool does not create folders. Before calling, must ensure project folder already exists.

    Project structure:
    ```
    Content_Calendar/
    ├── magic.project.js    # Project config (calendar data)
    └── index.html          # Calendar visualization page
    ```
    """

    async def execute(self, tool_context: ToolContext, params: CreateCalendarProjectParams) -> ToolResult:
        created_files: List[Path] = []

        try:
            project_path = self.resolve_path(params.project_path)

            if not await asyncio.to_thread(project_path.exists):
                return ToolResult.error(
                    f"Project folder does not exist: {project_path}. Create the folder first."
                )
            if not await asyncio.to_thread(project_path.is_dir):
                return ToolResult.error(f"Path is not a directory: {project_path}")

            target_index_path = project_path / "index.html"
            project_js_path = project_path / "magic.project.js"

            # 复制 index.html 模板
            source_index_path = Path(__file__).parent / "index.html"
            if await async_exists(source_index_path):
                try:
                    async with self._file_versioning_context(tool_context, target_index_path, update_timestamp=False):
                        await async_copy2(source_index_path, target_index_path)
                    created_files.append(target_index_path)
                    logger.info(f"复制日历入口文件: {target_index_path}")
                except Exception as e:
                    logger.error(f"复制 index.html 失败: {e}")
                    return ToolResult.error(f"Failed to copy index.html: {e}")
            else:
                logger.warning(f"index.html template not found at {source_index_path}, skipping copy")

            # 解析初始分类
            categories: List[Dict[str, Any]] = []
            if params.initial_categories:
                categories = json.loads(params.initial_categories)

            # 生成 magic.project.js
            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            config_data = {
                "version": "1.0.0",
                "type": "calendar",
                "name": params.calendar_name,
                "description": params.description or "",
                "created_at": now,
                "updated_at": now,
                "timezone": params.timezone,
                "views": ["month", "week", "list"],
                "default_view": "month",
                "categories": categories,
                "event_files": [],
            }

            config_json = json.dumps(config_data, indent=2, ensure_ascii=False)
            project_js_content = f"""\
window.magicProjectConfig = {config_json};
window.magicProjectConfigure(window.magicProjectConfig);
"""

            try:
                async with self._file_versioning_context(tool_context, project_js_path, update_timestamp=False):
                    await asyncio.to_thread(project_js_path.write_text, project_js_content, encoding="utf-8")
                created_files.append(project_js_path)
                logger.info(f"创建日历项目配置: {project_js_path}")
            except Exception as e:
                logger.error(f"创建 magic.project.js 失败: {e}")
                await self._rollback(created_files)
                return ToolResult.error(f"Failed to create magic.project.js: {e}")

            # 创建 events/ 目录
            await ensure_events_dir(project_path)

            return ToolResult(
                content=(
                    f"Calendar project created at {project_path}\n"
                    f"- magic.project.js: calendar config with {len(categories)} categories\n"
                    f"- index.html: calendar visualization page\n"
                    f"- events/: event storage directory\n"
                    f"Use manage_calendar tool to add events."
                )
            )

        except Exception as e:
            logger.exception(f"日历项目搭建失败: {e!s}")
            await self._rollback(created_files)
            return ToolResult.error(f"Calendar project setup failed: {e!s}")

    async def _rollback(self, created_files: List[Path]) -> None:
        """回滚已创建的文件"""
        for fp in reversed(created_files):
            try:
                if await asyncio.to_thread(fp.exists):
                    await asyncio.to_thread(fp.unlink)
                    logger.info(f"回滚删除: {fp}")
            except Exception as e:
                logger.warning(f"回滚失败: {fp} - {e}")

    # ── 展示层 ────────────────────────────────────────────────────────────────

    async def get_before_tool_call_friendly_content(
        self, tool_context: ToolContext, arguments: Dict[str, Any] = None
    ) -> str:
        return i18n.translate("create_calendar_project", category="tool.messages")

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        base_action = i18n.translate("create_calendar_project", category="tool.actions")
        name = (arguments or {}).get("calendar_name", "")

        if not result.ok:
            return {
                "action": base_action,
                "remark": i18n.translate(
                    "create_calendar_project.error", category="tool.messages", error=result.content
                ),
            }

        return {
            "action": base_action,
            "remark": i18n.translate(
                "create_calendar_project.created", category="tool.messages", name=name
            ),
        }
