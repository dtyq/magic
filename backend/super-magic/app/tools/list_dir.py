import asyncio
from typing import Any, Dict, List, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from agentlang.utils.file import format_file_size
from app.core.entity.message.server_message import (
    DirectoryScanFailure,
    DisplayType,
    FileTreeContent,
    FileTreeNode,
    ToolDetail,
)
from app.i18n import i18n
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool
from app.utils.directory_scan import (
    DirectoryScanBudget,
    describe_unexpanded,
    scan_directory_tree,
)

logger = get_logger(__name__)

# 工具能展开的最大层级。这是防止提示词被滥用而写死的深度上限，不是成本护栏：
# 模型明确要求 level=N 就应该拿到真实的 N 层列表。
LIST_DIR_MAX_LEVEL = 10

# 工具扫描的时间上限。这是唯一的成本护栏，而且它保护的是"别挂死"而不是"省目录读取"：
# 遍历条目数不设上限，因为模型主动发起的查询必须忠于它要求的 level。输出体积也不在这里
# 设限——超大结果由 ToolResultContentManager 统一落成文件并把路径告诉模型，那条出口比
# 在这里偷偷截断更诚实，也不会让模型误以为"没列出来就是不存在"。
#
# 之所以需要它：扫描跑在 asyncio.to_thread 里，Python 取消不了已经启动的线程，用户点
# 终止也停不下来。截止时间是唯一能在 worker 线程里生效的收敛手段。
LIST_DIR_SCAN_MAX_SECONDS = 120.0

_LIST_DIR_BUDGET = DirectoryScanBudget(max_seconds=LIST_DIR_SCAN_MAX_SECONDS)


def _partial_listing_notice(content: FileTreeContent) -> str:
    """把扫描缺口渲染成模型能据以继续行动的一段话。

    这段文字的唯一职责是阻止一个错误推论："没列出来"等于"不存在"。没有它，模型会把
    预算截断当成删除，或者把未读取的目录当成空目录。
    """
    details = describe_unexpanded(content.unexpanded)
    if not details:
        return ""
    return (
        f"[PARTIAL LISTING] {len(content.unexpanded)} directories in this listing are incomplete.\n"
        f"{details}\n"
        "Their contents are unknown, not empty. "
        "Call list_dir on one of those paths to list it on its own."
    )


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
        level = self._normalize_level(params.level)

        # 结构化数据只扫描一次，之后展示与工具详情共用 - 放进线程避免阻塞事件循环
        file_tree_content = await self._scan_async(
            params.relative_workspace_path,
            level,
            params.filter_binary,
        )

        # 转换为字符串结果（避免重复扫描）
        string_result = self._render_result(params.relative_workspace_path, file_tree_content)

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
        content = self._scan_directory_tree(
            relative_workspace_path,
            self._normalize_level(level),
            filter_binary,
        )
        return self._render_result(relative_workspace_path, content)

    async def get_file_tree_async(self, relative_workspace_path: str, level: int, filter_binary: bool) -> FileTreeContent:
        """异步获取结构化文件树（FileTreeContent），供调用方同时用于展示和路径提取。"""
        return await self._scan_async(
            relative_workspace_path,
            self._normalize_level(level),
            filter_binary,
        )

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
        return await asyncio.to_thread(
            self.get_file_tree_string,
            relative_workspace_path,
            level,
            filter_binary
        )

    @staticmethod
    def _normalize_level(level: int) -> int:
        """把模型给的层级收敛到工具契约允许的范围。"""
        if level > LIST_DIR_MAX_LEVEL:
            logger.warning(
                f"Requested level {level} exceeds maximum {LIST_DIR_MAX_LEVEL}, "
                f"limiting to {LIST_DIR_MAX_LEVEL}."
            )
            return LIST_DIR_MAX_LEVEL
        if level < 1:
            logger.warning(f"Requested level {level} is less than 1, setting to 1.")
            return 1
        return level

    async def _scan_async(
        self, relative_workspace_path: str, level: int, filter_binary: bool
    ) -> FileTreeContent:
        return await asyncio.to_thread(
            self._scan_directory_tree,
            relative_workspace_path,
            level,
            filter_binary,
        )

    def _scan_directory_tree(
        self, relative_workspace_path: str, level: int, filter_binary: bool
    ) -> FileTreeContent:
        """按工具预算扫描目录。

        工具不限制遍历条目数：模型要求 level=N 就返回真实的 N 层。见 `LIST_DIR_SCAN_MAX_SECONDS`
        对唯一那道护栏的说明。
        """
        return scan_directory_tree(
            self.resolve_path(relative_workspace_path),
            relative_path=relative_workspace_path,
            level=level,
            filter_binary=filter_binary,
            budget=_LIST_DIR_BUDGET,
        )

    def _render_result(self, relative_workspace_path: str, content: FileTreeContent) -> str:
        """把扫描结果渲染成模型可读的文本。

        不完整的结果必须显式说明缺了什么（`_partial_listing_notice`）：模型据此刻画工作区，
        没有这段说明时它会从"列表里没有"推断出"文件不存在"。
        """
        resolved_path = self.resolve_path(relative_workspace_path)
        if content.failure is DirectoryScanFailure.NOT_FOUND:
            return f"Path does not exist: {resolved_path}"
        if content.failure is DirectoryScanFailure.NOT_A_DIRECTORY:
            return f"Path is not a directory: {resolved_path}"

        result = self._convert_file_tree_to_string(content)
        if content.failure is DirectoryScanFailure.UNREADABLE:
            result = f"Could not read the directory: {resolved_path}\n{result}"

        notice = _partial_listing_notice(content)
        if notice:
            result += "\n" + notice
        return result

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
            str: 显示用的路径名称
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
        level = self._normalize_level(arguments.get("level", 3) if arguments else 3)
        filter_binary = arguments.get("filter_binary", False) if arguments else False

        # 尝试从工具上下文缓存中获取已扫描的数据
        file_tree_content = None
        if hasattr(tool_context, '_list_dir_cache') and id(self) in tool_context._list_dir_cache:
            file_tree_content = tool_context._list_dir_cache[id(self)]
            # 使用完后清理缓存
            del tool_context._list_dir_cache[id(self)]

        # 如果缓存中没有数据，重新扫描（fallback）- 使用 asyncio.to_thread 避免阻塞事件循环
        if not file_tree_content:
            logger.warning("No cached tree data found, re-scanning directory")
            file_tree_content = await self._scan_async(path, level, filter_binary)

        # 返回工具详情
        return ToolDetail(
            type=DisplayType.FILE_TREE,
            data=file_tree_content
        )

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
                size_str = format_file_size(node.file_size) if node.file_size is not None else "0B"
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
            result: 工具执行的结果
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
