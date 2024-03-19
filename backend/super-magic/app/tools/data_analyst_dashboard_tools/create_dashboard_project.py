from app.i18n import i18n
import asyncio
import json
import shutil
import os
import re
from pathlib import Path
from typing import Optional, Dict, Any, List

import aiofiles
from pydantic import BaseModel, Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.event.event import EventType
from agentlang.logger import get_logger
from agentlang.utils.file import safe_delete, is_text_file, format_file_size
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_guard_tool import WorkspaceGuardTool
from app.tools.abstract_file_tool import AbstractFileTool
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail, FileTreeContent, FileTreeNode, FileTreeNodeType, TerminalContent
from app.utils.async_file_utils import async_copy2

logger = get_logger(__name__)


class DataSourceConfig(BaseModel):
    """数据源配置模型"""
    type: str = Field(
        default="file",
        description="""<!--zh: 数据源类型，默认为 "file"-->
Data source type, default is "file" """
    )
    name: str = Field(
        ...,
        description="""<!--zh: 数据源名称-->
Data source name"""
    )
    url: str = Field(
        ...,
        description="""<!--zh: 数据源URL路径-->
Data source URL path"""
    )


class CreateDashboardProjectParams(BaseToolParams):
    name: str = Field(
        default="dashboard",
        description="""<!--zh: 项目名称，数据看板项目将以此名称创建到工作区目录下-->
Project name, data dashboard project will be created in workspace directory with this name"""
    )
    sources: Optional[List[DataSourceConfig]] = Field(
        default=None,
        description="""<!--zh: 原始数据源配置列表，将自动写入 magic.project.js 的 sources 数组。每项需含 type、name、url，示例：[{"type": "file", "name": "sales.csv", "url": "../sales.csv"}]-->
Original data source config list, auto-written to magic.project.js sources array. Each item needs type, name, url, e.g.: [{"type": "file", "name": "sales.csv", "url": "../sales.csv"}]"""
    )

    @field_validator('sources', mode='before')
    @classmethod
    def parse_sources(cls, value: Any) -> Any:
        """解析字符串化的 JSON 数组，兼容 LLM 误传的格式"""
        if value is None:
            return None
        if isinstance(value, str):
            value = value.strip()
            if not value:
                return None
            try:
                parsed = json.loads(value)
                return parsed if isinstance(parsed, list) else value
            except json.JSONDecodeError:
                return value
        return value


@tool()
class CreateDashboardProject(AbstractFileTool[CreateDashboardProjectParams], WorkspaceGuardTool[CreateDashboardProjectParams]):
    """<!--zh
    创建数据分析看板项目工具

    将模板目录复制到工作区，创建完整的数据看板项目结构。
    -->
    Create data analysis dashboard project tool

    Copy template directory to workspace, create complete data dashboard project structure.
    """

    async def execute(self, tool_context: ToolContext, params: CreateDashboardProjectParams) -> ToolResult:
        """执行工具并返回结果

        Args:
            tool_context: 工具上下文
            params: 创建参数

        Returns:
            ToolResult: 包含操作结果或错误信息
        """
        created_files = []  # 记录已创建的文件，用于回滚
        target_path = None

        try:
            # 获取模板源目录路径 - 使用tools目录下的模板，确保在任何环境中都能访问
            template_source = Path(__file__).parent.parent / "data_analyst_dashboard_template"
            logger.info(f"模板源目录: {template_source}")

            # 检查模板源目录是否存在
            if not template_source.exists():
                error_msg = "Template source directory does not exist"
                logger.error(error_msg)
                return ToolResult(error=error_msg)

            if not template_source.is_dir():
                error_msg = "Template source path is not a directory"
                logger.error(error_msg)
                return ToolResult(error=error_msg)

            # 获取安全的目标路径
            target_path, error = self.get_safe_path(params.name)
            if error:
                return ToolResult(error=error)

            logger.info(f"目标路径: {target_path}")

            # 检查目标目录是否已存在
            if target_path.exists():
                error_msg = f"Directory already exists: {params.name}"
                logger.error(error_msg)
                return ToolResult(error=error_msg)

            # 创建目标目录
            await asyncio.to_thread(os.makedirs, target_path, exist_ok=False)
            created_files.append(target_path)
            logger.info(f"创建项目目录: {target_path}")

            # 复制模板文件到目标目录
            logger.info(f"开始复制模板文件: {template_source} -> {target_path}")
            for item in template_source.iterdir():
                # 跳过以.开头的文件和目录
                if item.name.startswith('.'):
                    continue

                if item.is_file():
                    await async_copy2(item, target_path / item.name)
                    logger.info(f"复制文件: {item.name}")
                elif item.is_dir():
                    target_subdir = target_path / item.name
                    if target_subdir.exists():
                        shutil.rmtree(target_subdir)
                    shutil.copytree(item, target_subdir)
                    logger.info(f"复制目录: {item.name}")
            logger.info(f"模板复制成功: {template_source} -> {target_path}")

            # 更新 magic.project.js 中的项目名称和数据源
            await self._update_project_config(target_path, params.name, params.sources or [])

            # 触发文件创建事件 - 为主要文件触发事件（无需更新时间戳，因为是工具生成的文件）
            main_files = ['index.html', 'config.js', 'data.js', 'dashboard.js', 'magic.project.js', 'echarts.theme.js', 'data_cleaning.py']
            for file_name in main_files:
                file_path = target_path / file_name
                if file_path.exists():
                    async with self._file_versioning_context(tool_context, file_path, update_timestamp=False):
                        pass  # Files already created, just need to trigger events

            # 统计复制的文件数量
            file_count = self._count_files(target_path)
            logger.info(f"复制完成，共 {file_count} 个文件")

            # 生成结果信息
            result_content = self._generate_result_content(target_path, params, file_count)

            return ToolResult(
                content=result_content,
                extra_info={
                    "project_name": params.name,
                    "file_count": file_count,
                    "target_path": str(target_path)
                }
            )

        except Exception as e:
            logger.exception(f"创建数据看板项目失败: {e}")

            # 回滚：删除已创建的文件和文件夹
            await self._rollback_created_files(created_files)

            return ToolResult(error="Failed to create dashboard project")

    async def _update_project_config(self, target_path: Path, project_name: str, sources: List[DataSourceConfig]):
        """
        更新 magic.project.js 中的项目名称和原始数据源

        Args:
            target_path: 项目目标路径
            project_name: 项目名称
            sources: 原始数据源配置列表，每项需含 type、name、url
        """
        magic_project_file = target_path / "magic.project.js"

        if not magic_project_file.exists():
            logger.warning(f"magic.project.js 文件不存在: {magic_project_file}")
            return

        try:
            # 读取文件内容
            with open(magic_project_file, 'r', encoding='utf-8') as f:
                content = f.read()

            # 使用正则表达式替换 name 字段
            # 匹配多种格式: name: "值", 'name': "值", "name": "值"
            pattern = r'(["\']?)name\1\s*:\s*"[^"]*"'

            def replacement_func(match):
                quote = match.group(1) or ''
                return f'{quote}name{quote}: "{project_name}"'

            updated_content = re.sub(pattern, replacement_func, content)

            # 写入 sources 数组
            # 处理 Pydantic 模型和字典，统一转换为字典格式
            valid_sources = []
            for s in sources:
                if isinstance(s, BaseModel):
                    # Pydantic 模型，转换为字典
                    source_dict = s.model_dump()
                    if source_dict.get("name") and source_dict.get("url"):
                        valid_sources.append(source_dict)
                elif isinstance(s, dict):
                    # 字典格式，直接使用
                    if s.get("name") and s.get("url"):
                        valid_sources.append(s)
            
            if valid_sources:
                source_items = [
                    {
                        "type": s.get("type", "file"),
                        "name": str(s.get("name", "")),
                        "url": str(s.get("url", "")),
                    }
                    for s in valid_sources
                ]
                # 每个 item 一行，保持与顶层 key 一致的缩进层级（4 空格）
                source_lines = [json.dumps(item, ensure_ascii=False) for item in source_items]
                sources_json = "[\n    " + ",\n    ".join(source_lines) + "\n  ]"
                sources_pattern = r'(["\']?)sources\1\s*:\s*\[[\s\S]*?\]'
                sources_replacement = rf'\1sources\1: {sources_json}'
                updated_content = re.sub(sources_pattern, sources_replacement, updated_content)
                logger.info(f"已更新 magic.project.js 中的 sources: {len(valid_sources)} 个数据源")

            # 异步写回文件
            async with aiofiles.open(magic_project_file, 'w', encoding='utf-8') as f:
                await f.write(updated_content)

            logger.info(f"已更新 magic.project.js 中的项目名称为: {project_name}")

        except Exception as e:
            logger.error(f"更新 magic.project.js 失败: {e}")
            # 不抛出异常，避免影响整个项目创建流程

    async def _rollback_created_files(self, created_files: list):
        """
        回滚已创建的文件和文件夹

        Args:
            created_files: 已创建的文件和文件夹路径列表
        """
        # 逆序删除，先删除文件，后删除文件夹
        for path in reversed(created_files):
            try:
                if isinstance(path, Path):
                    await safe_delete(path)
                    logger.info(f"回滚删除路径: {path}")
            except Exception as rollback_error:
                logger.error(f"回滚删除失败 {path}: {rollback_error}")
                # 继续尝试删除其他文件，不中断回滚过程

    def _generate_result_content(self, target_path: Path, params: CreateDashboardProjectParams, file_count: int) -> str:
        """
        生成简洁的结果内容

        Args:
            target_path: 目标路径
            params: 参数对象
            file_count: 文件数量

        Returns:
            str: 格式化的结果内容
        """
        result = f"Dashboard project created successfully: {params.name}/ ({file_count} files)"

        return result

    def _count_files(self, directory: Path) -> int:
        """递归统计目录中的文件数量"""
        count = 0
        try:
            for item in directory.rglob("*"):
                if item.is_file():
                    count += 1
        except Exception as e:
            logger.warning(f"统计文件数量时出错: {e}")
        return count

    def _scan_created_project_tree(self, project_name: str, target_path: Path) -> FileTreeContent:
        """扫描创建的项目目录并生成文件树结构"""
        level = 3  # 默认显示3层结构，与 list_dir 一致
        filter_binary = False

        if not target_path.exists() or not target_path.is_dir():
            logger.warning(f"Path invalid or does not exist: {target_path}")
            # 返回空的FileTreeContent
            return FileTreeContent(
                root_path=project_name,
                level=level,
                filter_binary=filter_binary,
                total_files=0,
                total_dirs=0,
                total_size=0,
                tree=[]
            )

        try:
            # 统计信息
            stats = {"total_files": 0, "total_dirs": 0, "total_size": 0}

            # 递归构建文件树 - 使用与 list_dir 相同的逻辑
            tree = self._build_file_tree(target_path, project_name, 1, level, filter_binary, stats)

            return FileTreeContent(
                root_path=project_name,
                level=level,
                filter_binary=filter_binary,
                total_files=stats["total_files"],
                total_dirs=stats["total_dirs"],
                total_size=stats["total_size"],
                tree=tree
            )

        except Exception as e:
            logger.error(f"Error scanning directory tree: {e}", exc_info=True)
            # 返回空的FileTreeContent
            return FileTreeContent(
                root_path=project_name,
                level=level,
                filter_binary=filter_binary,
                total_files=0,
                total_dirs=0,
                total_size=0,
                tree=[]
            )

    def _build_file_tree(self, current_path: Path, relative_path: str, current_level: int,
                        max_level: int, filter_binary: bool, stats: Dict[str, int]) -> List[FileTreeNode]:
        """递归构建文件树结构 - 与 list_dir.py 完全一致的实现"""
        if current_level > max_level:
            return []

        # 文件系统读取
        try:
            items = sorted(
                list(current_path.iterdir()),
                key=lambda x: (not x.is_dir(), x.name.lower())
            )

        except PermissionError:
            # 创建权限错误节点
            error_node = FileTreeNode(
                file_name="Permission denied",
                relative_file_path=f"{relative_path}/[ERROR]",
                is_directory=False,
                file_size=None,
                updated_at="",
                children=None,
                type=FileTreeNodeType.FILE,
                error="Permission denied"
            )
            return [error_node]
        except Exception as e:
            # 创建访问错误节点
            error_node = FileTreeNode(
                file_name=f"Cannot access: {e!s}",
                relative_file_path=f"{relative_path}/[ERROR]",
                is_directory=False,
                file_size=None,
                updated_at="",
                children=None,
                type=FileTreeNodeType.FILE,
                error=f"Cannot access: {e!s}"
            )
            return [error_node]

        # 过滤隐藏文件
        items = [item for item in items if not item.name.startswith('.')]

        # 过滤二进制文件
        if filter_binary:
            items = [item for item in items if item.is_dir() or self._is_text_file(item)]

        tree_nodes = []

        for item in items:
            try:
                # 计算相对路径
                if relative_path == ".":
                    item_relative_path = item.name
                else:
                    item_relative_path = f"{relative_path}/{item.name}"

                if item.is_dir():
                    # 处理目录
                    stats["total_dirs"] += 1

                    # 递归获取子节点
                    children = []
                    if current_level < max_level:
                        children = self._build_file_tree(
                            item, item_relative_path, current_level + 1,
                            max_level, filter_binary, stats
                        )

                    node = FileTreeNode(
                        file_name=item.name,
                        relative_file_path=item_relative_path,
                        is_directory=True,
                        file_size=None,
                        updated_at=self._format_timestamp(item.stat().st_mtime),
                        children=children if children else None,
                        type=FileTreeNodeType.DIRECTORY
                    )
                    tree_nodes.append(node)

                else:
                    # 处理文件
                    stats["total_files"] += 1
                    stat_result = item.stat()
                    file_size = stat_result.st_size
                    stats["total_size"] += file_size

                    node = FileTreeNode(
                        file_name=item.name,
                        relative_file_path=item_relative_path,
                        is_directory=False,
                        file_size=file_size,
                        updated_at=self._format_timestamp(stat_result.st_mtime),
                        children=None,
                        type=FileTreeNodeType.FILE
                    )
                    tree_nodes.append(node)

            except Exception as e:
                logger.warning(f"Error processing {item}: {e}")
                continue

        return tree_nodes

    def _is_text_file(self, file_path: Path) -> bool:
        """判断文件是否为文本/代码文件"""
        return is_text_file(file_path)

    def _format_size(self, size: int) -> str:
        """格式化文件大小"""
        return format_file_size(size)

    def _format_timestamp(self, timestamp: float) -> str:
        """格式化时间戳为字符串格式"""
        from datetime import datetime
        return datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M:%S")

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        """获取工具详情 - 显示创建的项目文件树结构或错误信息"""
        # 获取项目名称
        project_name = arguments.get("name", "dashboard") if arguments else "dashboard"

        # 创建成功的情况
        if result.ok and result.extra_info:
            target_path = result.extra_info.get("target_path")

            if not target_path:
                return None

            # 扫描创建的项目目录生成文件树
            file_tree_content = self._scan_created_project_tree(project_name, Path(target_path))

            return ToolDetail(
                type=DisplayType.FILE_TREE,
                data=file_tree_content
            )

        # 创建失败的情况
        return self._generate_failure_detail(project_name, result)

    def _generate_failure_detail(self, project_name: str, result: ToolResult) -> ToolDetail:
        """生成创建失败的详细信息"""
        error_message = result.content or "Unknown error"

        command = f"create_dashboard_project --name {project_name}"

        output_lines = []

        # 简化的失败结果
        output_lines.append("Dashboard project creation result: [FAIL] Failed")
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
        if not arguments or "name" not in arguments:
            return i18n.translate("unknown.message", category="tool.messages")

        project_name = arguments["name"]
        return i18n.translate("create_dashboard_project.success", category="tool.messages", project_name=project_name)

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
                "action": i18n.translate("create_dashboard_project", category="tool.actions"),
                "remark": i18n.translate("create_dashboard_project.error", category="tool.messages", error=result.content)
            }

        return {
            "action": i18n.translate("create_dashboard_project", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }
