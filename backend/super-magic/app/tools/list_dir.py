from app.i18n import i18n
import asyncio
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.core.entity.message.server_message import DisplayType, ToolDetail, FileTreeContent, FileTreeNode, FileTreeNodeType
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool
from agentlang.utils.file import (
    is_text_file, format_file_size
)

logger = get_logger(__name__)


class ListDirParams(BaseToolParams):
    relative_workspace_path: str = Field(
        ".",
        description="""<!--zh: 相对于工作区根目录要列出内容的路径-->
Path to list relative to workspace root"""
    )
    level: int = Field(
        3,
        description="""<!--zh: 要列出的目录层级深度，默认为3-->
Directory depth level to list, default is 3"""
    )
    filter_binary: bool = Field(
        False,
        description="""<!--zh: 是否过滤二进制文件，如图片、视频等，只显示文本/代码文件-->
Whether to filter binary files (images, videos, etc.), showing only text/code files"""
    )


@tool()
class ListDir(WorkspaceTool[ListDirParams]):
    """<!--zh
    查看目录内容的工具，建议使用 level=3 来获取足够多的文件信息。

    查看目录的内容，支持指定递归层级。在使用更有针对性的工具（如语义搜索或文件读取）之前，
    这是用于发现的快速工具。在深入研究特定文件之前，尝试了解文件结构非常有用。可用于探索工作区、项目结构、文件分布等。

    对于文本文件，会显示文件大小、行数和token数量，便于评估内容量。
    -->
    Tool for viewing directory contents. Recommended to use level=3 for sufficient file information.

    View directory contents with recursive levels. This is a quick discovery tool before using more targeted tools (semantic search or file reading).
    Useful for understanding file structure before diving into specific files. Can be used to explore workspace, project structure, file distribution, etc.

    For text files, displays file size, line count, and token count for content assessment.
    """

    async def execute(self, tool_context: ToolContext, params: ListDirParams) -> ToolResult:
        """执行工具并返回结果

        Args:
            tool_context: 工具上下文
            params: 目录列表参数

        Returns:
            ToolResult: 包含目录内容或错误信息
        """
        # 验证 level 的合理性，例如限制最大深度
        max_level = 10  # 设定一个最大递归深度防止滥用
        level = params.level
        if level > max_level:
            logger.warning(f"Requested level {level} exceeds maximum {max_level}, limiting to {max_level}.")
            level = max_level
        elif level < 1:
             logger.warning(f"Requested level {level} is less than 1, setting to 1.")
             level = 1

        # 获取结构化数据（只扫描一次）
        file_tree_content = self._scan_directory_tree(
            relative_workspace_path=params.relative_workspace_path,
            level=level,
            filter_binary=params.filter_binary,
        )

        # 转换为字符串结果（避免重复扫描）
        string_result = self._get_string_result(params.relative_workspace_path, file_tree_content)

        # 将结构化数据存储到工具上下文中，供 get_tool_detail 使用
        if file_tree_content:
            if not hasattr(tool_context, '_list_dir_cache'):
                tool_context._list_dir_cache = {}
            tool_context._list_dir_cache[id(self)] = file_tree_content

        # 返回ToolResult
        return ToolResult(content=string_result)

    def get_file_tree_string(self, relative_workspace_path: str, level: int, filter_binary: bool) -> str:
        """获取文件树的字符串表示

        这是推荐的公共接口，用于替换直接调用_run方法

        Args:
            relative_workspace_path: 相对工作区的路径
            level: 目录递归层级
            filter_binary: 是否过滤二进制文件

        Returns:
            str: 格式化的文件树字符串
        """
        # 获取结构化数据
        file_tree_content = self._scan_directory_tree(relative_workspace_path, level, filter_binary)

        # 转换为字符串结果
        return self._get_string_result(relative_workspace_path, file_tree_content)

    async def get_file_tree_string_async(self, relative_workspace_path: str, level: int, filter_binary: bool) -> str:
        """异步获取文件树的字符串表示

        将同步的目录扫描操作放到线程池中执行，避免阻塞 asyncio 事件循环。
        在工作区文件较多时，可以显著提升系统响应性。

        Args:
            relative_workspace_path: 相对工作区的路径
            level: 目录递归层级
            filter_binary: 是否过滤二进制文件

        Returns:
            str: 格式化的文件树字符串
        """
        # 使用 asyncio.to_thread 将同步 IO 操作放到线程池执行
        return await asyncio.to_thread(
            self.get_file_tree_string,
            relative_workspace_path,
            level,
            filter_binary
        )

    def _scan_directory_tree(self, relative_workspace_path: str, level: int, filter_binary: bool) -> FileTreeContent:
        """扫描目录并返回结构化的FileTreeContent数据"""
        # 路径验证
        target_path = self.resolve_path(relative_workspace_path)

        if not target_path.exists() or not target_path.is_dir():
            logger.warning(f"Path invalid or does not exist: {relative_workspace_path}")
            # 返回空的FileTreeContent
            return FileTreeContent(
                root_path=relative_workspace_path,
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

            # 递归构建文件树
            tree = self._build_file_tree(target_path, relative_workspace_path, 1, level, filter_binary, stats)

            return FileTreeContent(
                root_path=relative_workspace_path,
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
                root_path=relative_workspace_path,
                level=level,
                filter_binary=filter_binary,
                total_files=0,
                total_dirs=0,
                total_size=0,
                tree=[]
            )

    def _get_string_result(self, relative_workspace_path: str, file_tree_content: FileTreeContent) -> str:
        """根据FileTreeContent获取字符串结果，处理错误情况"""
        # 处理错误情况
        if not file_tree_content.tree and file_tree_content.total_files == 0 and file_tree_content.total_dirs == 0:
            target_path = self.resolve_path(relative_workspace_path)
            if not target_path.exists():
                return f"错误：路径不存在: {target_path}"
            if not target_path.is_dir():
                return f"错误：路径不是目录: {target_path}"

                # 从结构化数据生成字符串表示
        return self._convert_file_tree_to_string(file_tree_content)

    def _is_text_file(self, file_path: Path) -> bool:
        """判断文件是否为文本/代码文件"""
        return is_text_file(file_path)

    def _format_size(self, size: int) -> str:
        """格式化文件大小"""
        return format_file_size(size)

    def _format_timestamp(self, timestamp: float) -> str:
        """格式化时间戳为字符串格式"""
        return datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M:%S")

    def _is_root_dir(self, path: str) -> bool:
        """判断路径是否为根目录

        Args:
            path: 要判断的路径

        Returns:
            bool: 如果是根目录返回True，否则返回False
        """
        if not path:
            return True
        normalized_path = path.strip()
        return normalized_path == "." or normalized_path == ""

    def _get_display_path(self, path: str) -> str:
        """获取用于显示的路径名称

        如果是根目录，返回多语言的「根目录」；否则返回原路径

        Args:
            path: 原始路径

        Returns:
            str: 用于显示的路径名称
        """
        if self._is_root_dir(path):
            return i18n.translate("list_dir.display", category="tool.messages")
        return path

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

        # 获取目录路径和执行参数
        path = arguments.get("relative_workspace_path", ".") if arguments else "."
        level = arguments.get("level", 3) if arguments else 3
        filter_binary = arguments.get("filter_binary", False) if arguments else False

        # 尝试从工具上下文缓存中获取已扫描的数据
        file_tree_content = None
        if hasattr(tool_context, '_list_dir_cache') and id(self) in tool_context._list_dir_cache:
            file_tree_content = tool_context._list_dir_cache[id(self)]
            # 使用完后清理缓存
            del tool_context._list_dir_cache[id(self)]

        # 如果缓存中没有数据，重新扫描（fallback）
        if not file_tree_content:
            logger.warning("No cached tree data found, re-scanning directory")
            file_tree_content = self._scan_directory_tree(path, level, filter_binary)

        # 返回工具详情
        return ToolDetail(
            type=DisplayType.FILE_TREE,
            data=file_tree_content
        )

    def _build_file_tree(self, current_path: Path, relative_path: str, current_level: int,
                        max_level: int, filter_binary: bool, stats: Dict[str, int]) -> List[FileTreeNode]:
        """递归构建文件树结构"""
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

    def _convert_file_tree_to_string(self, file_tree_content: FileTreeContent) -> str:
        """将FileTreeContent转换为字符串格式"""
        if not file_tree_content.tree:
            return "No files found"

        # 构建输出行，使用多语言显示路径
        display_path = self._get_display_path(file_tree_content.root_path)
        output_lines = [f"[DIR] {display_path}/\n"]

        # 递归生成字符串表示
        self._append_tree_nodes_to_string(file_tree_content.tree, output_lines, "", True)

        # 字符串连接
        return "".join(output_lines)

    def _append_tree_nodes_to_string(self, nodes: List[FileTreeNode], output_lines: List[str], indent: str, is_root: bool = False):
        """递归将树节点追加到字符串输出中"""
        for idx, node in enumerate(nodes):
            is_last_item = (idx == len(nodes) - 1)

            # 创建前缀
            if is_root:
                prefix = "└─" if is_last_item else "├─"
                next_indent = "   " if is_last_item else "│  "
            else:
                prefix = f"{indent}{'└─' if is_last_item else '├─'}"
                next_indent = f"{indent}{'   ' if is_last_item else '│  '}"

            if node.error:
                # 错误节点
                error_line = f"{prefix}[ERROR] {node.file_name}\n"
                output_lines.append(error_line)
            elif node.is_directory:
                # 目录
                child_count = len(node.children) if node.children else 0
                count_str = f"{child_count} items"
                dir_line = f"{prefix}[DIR] {node.file_name}/ ({count_str})\n"
                output_lines.append(dir_line)

                # 递归处理子节点
                if node.children:
                    self._append_tree_nodes_to_string(node.children, output_lines, next_indent, False)
            else:
                # 文件
                size_str = self._format_size(node.file_size) if node.file_size is not None else "0B"
                file_line = f"{prefix}[FILE] {node.file_name} ({size_str})\n"
                output_lines.append(file_line)

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        path = "."
        if arguments and "relative_workspace_path" in arguments:
            path = arguments["relative_workspace_path"]
        return self._get_display_path(path)

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
            dir_path_str = arguments.get("relative_workspace_path", "未知目录") if arguments else "未知目录"
            return {
                "action": i18n.translate("list_dir", category="tool.actions"),
                "remark": i18n.translate("list_dir.error", category="tool.messages", dir_path=dir_path_str)
            }

        return {
            "action": i18n.translate("list_dir", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }
