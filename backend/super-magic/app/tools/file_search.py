from app.i18n import i18n
import fnmatch
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from agentlang.utils.schema import FileInfo
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool
from app.utils.async_file_utils import async_try_count_text_lines

logger = get_logger(__name__)


class FileSearchParams(BaseToolParams):
    query: str = Field(
        ...,
        description="""<!--zh: 要搜索的模糊文件名-->
Fuzzy file name to search"""
    )


@tool()
class FileSearch(WorkspaceTool[FileSearchParams]):
    """<!--zh
    基于对文件路径的模糊匹配的快速文件搜索。
    如果你知道文件路径的一部分但不确切知道它的位置，请使用此工具。响应将限制为10个结果。如果需要进一步过滤结果，请使查询更具体。
    -->
    Fast file search based on fuzzy matching of file paths.
    Use this tool if you know part of a file path but don't know its exact location. Response will be limited to 10 results. Make query more specific if further filtering needed.
    """

    async def execute(self, tool_context: ToolContext, params: FileSearchParams) -> ToolResult:
        """执行工具并返回结果

        Args:
            tool_context: 工具上下文
            params: 文件搜索参数

        Returns:
            ToolResult: 包含搜索结果
        """
        result, matches = await self._search(params.query)

        return ToolResult(
            content=result,
            extra_info={
                "query": params.query,
                "matches": matches,
                "match_count": len(matches),
            },
        )

    async def _run(self, query: str) -> str:
        """运行工具并返回搜索结果"""
        result, _ = await self._search(query)
        return result

    async def _search(self, query: str) -> Tuple[str, List[Dict[str, Any]]]:
        """搜索文件并同时返回模型可读文本和前端展示数据"""
        try:
            # 获取所有文件路径
            all_files = self._get_all_files(self.base_dir)

            # 使用模糊匹配过滤文件
            matches = self._fuzzy_match(all_files, query)

            # 限制结果数量
            matches = matches[:10]

            if not matches:
                return "未找到匹配的文件", []

            # 格式化输出
            output = ["找到以下匹配的文件：\n"]
            match_infos: List[Dict[str, Any]] = []
            for file_path in matches:
                stat = file_path.stat()
                rel_path = str(file_path.relative_to(self.base_dir))

                # 创建 FileInfo 对象
                file_info = FileInfo(
                    name=file_path.name,
                    path=rel_path,
                    is_dir=False,
                    size=stat.st_size,
                    last_modified=stat.st_mtime,
                    line_count=await async_try_count_text_lines(file_path)
                    if file_path.suffix in [".py", ".js", ".ts", ".jsx", ".tsx", ".vue", ".md", ".txt"]
                    else None,
                )

                # 格式化输出
                size_str = self._format_size(file_info.size)
                line_str = f", {file_info.line_count} lines" if file_info.line_count is not None else ""
                output.append(f"{file_info.path} ({size_str}{line_str}) - {file_info.format_time()}")
                match_infos.append({
                    "path": file_info.path,
                    "name": file_info.name,
                    "size": file_info.size,
                    "size_text": size_str,
                    "line_count": file_info.line_count,
                    "updated_at": file_info.format_time(),
                })

            return "\n".join(output), match_infos

        except Exception as e:
            logger.error(f"执行文件搜索时出错: {e}", exc_info=True)
            return f"执行文件搜索时出错: {e!s}", []

    def _get_all_files(self, directory: Path) -> List[Path]:
        """递归获取目录下的所有文件"""
        files = []
        try:
            for item in directory.rglob("*"):
                if item.is_file():
                    files.append(item)
        except Exception as e:
            logger.warning(f"获取文件列表时出错: {e}")
        return files

    def _fuzzy_match(self, files: List[Path], pattern: str) -> List[Path]:
        """使用模糊匹配过滤文件"""
        # 将模式转换为通配符模式
        wildcard_pattern = f"*{pattern}*"

        # 过滤匹配的文件
        matches = []
        for file in files:
            if fnmatch.fnmatch(file.name.lower(), wildcard_pattern.lower()):
                matches.append(file)

        # 按相关性排序（完全匹配优先，然后是文件名长度）
        matches.sort(
            key=lambda x: (
                x.name.lower() != pattern.lower(),  # 完全匹配优先
                len(x.name),  # 较短的文件名优先
                str(x),  # 按路径字母顺序
            )
        )

        return matches

    def _format_size(self, size: int) -> str:
        """格式化文件大小"""
        for unit in ["B", "KB", "MB", "GB"]:
            if size < 1024:
                return f"{size:.1f}{unit}"
            size /= 1024
        return f"{size:.1f}TB"

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        return arguments.get("query", "") if arguments else ""

    async def get_before_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        query = arguments.get("query", "") if arguments else ""
        return {
            "tool_name": tool_name,
            "action": i18n.translate("file_search", category="tool.actions"),
            "remark": i18n.translate("file_search.searching", category="tool.messages", query=query),
        }

    async def get_tool_detail(
        self,
        tool_context: ToolContext,
        result: ToolResult,
        arguments: Dict[str, Any] = None,
    ) -> Optional[ToolDetail]:
        if not result.ok or not result.extra_info:
            return None

        query = result.extra_info.get("query") or (arguments or {}).get("query", "")
        matches = result.extra_info.get("matches") or []
        match_count = result.extra_info.get("match_count", len(matches))

        lines = [
            f"# {i18n.translate('file_search.detail_title', category='tool.messages')}",
            "",
            f"- {i18n.translate('file_search.detail_query', category='tool.messages')}: `{query}`",
            f"- {i18n.translate('file_search.detail_search_dir', category='tool.messages')}: `{self.base_dir}`",
            f"- {i18n.translate('file_search.detail_count', category='tool.messages')}: {match_count}",
            "",
        ]
        if matches:
            lines.append(f"## {i18n.translate('file_search.detail_matches', category='tool.messages')}")
            lines.append("")
            for item in matches:
                line_count = item.get("line_count")
                line_text = f", {line_count} lines" if line_count is not None else ""
                lines.append(f"- `{item.get('path', '')}` ({item.get('size_text', '')}{line_text})")
        else:
            lines.append(i18n.translate("search.no_results", category="tool.messages"))

        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(file_name="file_search_results.md", content="\n".join(lines)),
        )

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None) -> Dict:
        """
        获取工具调用后的友好动作和备注
        """
        query = arguments.get("query", "") if arguments else ""
        if not result.ok:
            return {
                "tool_name": tool_name,
                "action": i18n.translate("file_search", category="tool.actions"),
                "remark": i18n.translate("search.error", category="tool.messages", error=result.content)
            }

        match_count = 0
        if result.extra_info:
            match_count = result.extra_info.get("match_count", 0)

        return {
            "tool_name": tool_name,
            "action": i18n.translate("file_search", category="tool.actions"),
            "remark": i18n.translate(
                "file_search.searched",
                category="tool.messages",
                query=query,
                count=match_count,
            )
        }
