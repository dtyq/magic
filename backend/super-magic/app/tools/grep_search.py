from app.i18n import i18n
import os
import re
import json
import asyncio
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from agentlang.utils.schema import FileInfo
from agentlang.utils.token_estimator import num_tokens_from_string
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.utils.file_utils import is_binary_file
from app.utils.async_file_utils import async_count_text_lines, async_stat

logger = get_logger(__name__)

# Protection constants
MAX_LINE_LENGTH = 300  # Single line max characters, covers 80% normal cases
MATCH_PREVIEW_BEFORE_CHARS = 80
MATCH_PREVIEW_AFTER_CHARS = 120
MAX_MATCH_WINDOWS_PER_LINE = 3
MAX_CONTEXT_LINE_PREVIEW_CHARS = 320
MAX_FORMATTED_OUTPUT_TOKENS = 10000
MAX_FORMATTED_OUTPUT_CHARS = 120000

# Filesystem mode profiles: broad glob over many files is slow regardless of fs type,
# but network mounts (s3/nfs) need much stricter limits to avoid download storms.
# Set WORKSPACE_FS_MODE=local to relax limits when running on a local disk.
_FS_PROFILES: Dict[str, Dict[str, int]] = {
    "network": {"max_files": 300,  "preflight_timeout": 10, "execution_timeout": 30},
    "local":   {"max_files": 2000, "preflight_timeout": 30, "execution_timeout": 120},
}
_fs_profile = _FS_PROFILES.get(os.getenv("WORKSPACE_FS_MODE", "network"), _FS_PROFILES["network"])

MAX_SEARCH_FILES   = _fs_profile["max_files"]
PREFLIGHT_TIMEOUT  = _fs_profile["preflight_timeout"]
EXECUTION_TIMEOUT  = _fs_profile["execution_timeout"]

# Default ignore patterns for common binary/non-text files
DEFAULT_IGNORE_PATTERNS = [
    "*.jpg", "*.png", "*.gif",
    "*.mp4", "*.mov",
    "*.zip", "*.tar", "*.gz",
    "*.doc", "*.docx", "*.xls", "*.xlsx", "*.ppt", "*.pptx", "*.pdf",
    "node_modules", ".git"
]

# Constants for consistent messaging
NO_MATCHES_MSG = "No matches found"
WARNINGS_SECTION = "\n\nWarnings/Errors:\n"
OUTPUT_TRUNCATED_HINT = (
    "\n\n[Output truncated: result exceeds safe context budget. "
    "Narrow path/include/pattern and run grep_search again.]"
)


@dataclass
class LineInfo:
    """Line information with type and content"""
    line_number: int
    content: str
    is_match: bool  # True for match lines, False for context lines


@dataclass
class SearchResult:
    """搜索结果数据类"""
    content: str  # 格式化的搜索结果文本
    matched_files: List[Path]  # 匹配的文件路径列表
    has_matches: bool  # 是否有匹配结果


class GrepSearchParams(BaseToolParams):
    pattern: str = Field(..., description="The regular expression pattern to search for in file contents")
    include: str = Field(
        "",
        description="File pattern to include in the search (e.g. \"*.js\", \"*.{ts,tsx}\", \"*.py\")"
    )
    path: str = Field(
        "",
        description="The directory to search in. Defaults to the current working directory."
    )


@tool()
class GrepSearch(WorkspaceTool[GrepSearchParams]):
    """<!--zh
    - 快速内容搜索工具，适用于任何大小的代码库
    - 使用完整正则语法搜索文件内容（如 "log.*Error", "function\\s+\\w+"）
    - 显示匹配行及上下文（每个匹配前后3行）
    - 使用 include 参数按模式过滤文件（如 "*.js", "*.{ts,tsx}", "*.py"）
    - 返回最多20个最相关的文件，按修改时间排序
    - 自动忽略二进制文件和常见目录（node_modules, .git等）
    - 需要在多个文件中查找特定代码模式或文本时使用此工具
    - 必须指定具体的 path 和精确的 include 模式，避免在整个工作区使用宽泛的 glob（如 "*.html"），文件过多会导致搜索极慢或超时
    - 如需额外上下文，根据文件大小使用 read file：小文件（<200行）- 完整读取；中等文件（200-500行）- 按需判断；大文件（>500行）- 使用 offset/limit 参数读取特定部分
    -->
    - Fast content search tool that works with any codebase size
    - Searches file contents using regular expressions with full regex syntax (e.g. "log.*Error", "function\\s+\\w+")
    - Shows matching lines with context (3 lines before/after each match)
    - Filter files by pattern with include parameter (e.g. "*.js", "*.{ts,tsx}", "*.py")
    - Returns up to 20 most relevant files sorted by modification time
    - Automatically ignores binary files and common directories (node_modules, .git, etc.)
    - Use this tool when you need to find specific code patterns or text across multiple files
    - Always specify a concrete path and a narrow include pattern; avoid broad globs (e.g. "*.html") over the entire workspace as too many files will make the search extremely slow or time out
    - If additional context is needed, use read file based on file size: small files (<200 lines) - read entirely; medium files (200-500 lines) - judge by need; large files (>500 lines) - read specific sections with offset/limit parameters.
    """

    async def execute(self, tool_context: ToolContext, params: GrepSearchParams) -> ToolResult:
        """执行工具并返回结果

        Args:
            tool_context: 工具上下文
            params: 搜索参数

        Returns:
            ToolResult: 包含搜索结果或错误信息
        """
        # Validate regex pattern
        try:
            re.compile(params.pattern)
        except re.error as e:
            return ToolResult.error(f"Invalid regex pattern: {e}")

        # 执行搜索
        search_result = await self._run(
            pattern=params.pattern,
            include=params.include,
            path=params.path
        )

        # 更新匹配文件的时间戳
        await self._update_file_timestamps(tool_context, search_result.matched_files)

        # 准备 extra_info 用于前端展示
        extra_info = {}
        # 只要有实际内容（不是简单的 NO_MATCHES_MSG），就设置 extra_info
        if search_result.content and search_result.content != NO_MATCHES_MSG:
            extra_info.update({
                "search_query": params.pattern,
                "search_content": search_result.content,
                "matched_files_count": len(search_result.matched_files),
                "context_lines": 3  # Fixed context lines
            })

        # 返回ToolResult
        return ToolResult(
            content=search_result.content,
            extra_info=extra_info
        )

    async def execute_purely(
        self,
        pattern: str,
        include: str = "",
        path: str = "",
        max_results: int = 50
    ) -> Dict[str, Any]:
        """无Context纯粹执行grep，供其他工具内部调用

        Args:
            pattern: 搜索模式（正则表达式）
            include: 文件包含模式（如 "*.csv"）
            path: 搜索路径（相对于base_dir）
            max_results: 最大返回匹配行数

        Returns:
            {
                "success": bool,
                "matches": List[Dict],  # [{"content": str, "file": str, "line_number": int}]
                "content": str,  # 格式化文本
                "matched_files": List[str]  # 匹配的文件路径
            }
        """
        try:
            # 复用 _run 方法执行搜索
            search_result = await self._run(
                pattern=pattern,
                include=include,
                path=path
            )

            if not search_result.has_matches:
                return {
                    "success": False,
                    "matches": [],
                    "content": search_result.content,
                    "matched_files": []
                }

            # 从格式化内容中提取纯粹的匹配行（复用已有的解析逻辑）
            # 重新执行ripgrep获取JSON格式（用于纯粹模式）
            cmd = [
                "rg",
                "--line-number",
                "--json",
                "--sort=modified",
                "--max-count", str(max_results),  # 使用传入的max_results参数
                "--max-filesize", "5M",
                "--max-columns", str(MAX_LINE_LENGTH),
                "--context", "0"  # 纯粹模式不需要上下文
            ]

            if not include:
                for ignore_pattern in DEFAULT_IGNORE_PATTERNS:
                    cmd.extend(["--glob", f"!{ignore_pattern}"])

            if include:
                cmd.extend(["--glob", include])

            # 确定搜索目录
            if path:
                search_path = Path(path)
                if search_path.is_absolute():
                    search_dir = search_path
                else:
                    search_dir = self.base_dir / search_path
            else:
                search_dir = self.base_dir

            cmd.extend([pattern, str(search_dir)])

            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(self.base_dir)
            )
            try:
                stdout, _ = await asyncio.wait_for(
                    process.communicate(), timeout=EXECUTION_TIMEOUT
                )
            except asyncio.TimeoutError:
                try:
                    process.kill()
                    await process.wait()
                except Exception:
                    pass
                return {
                    "success": False,
                    "matches": [],
                    "content": f"Search timed out after {EXECUTION_TIMEOUT}s. Try a more specific path or pattern.",
                    "matched_files": []
                }
            stdout_str = stdout.decode('utf-8').strip()

            # 解析JSON输出为简单格式
            matches = []
            matched_files = set()

            for line in stdout_str.splitlines():
                if len(matches) >= max_results:
                    break
                try:
                    data = json.loads(line)
                    if data.get("type") == "match":
                        file_path = data["data"]["path"]["text"]
                        line_number = data["data"]["line_number"]
                        content = data["data"]["lines"]["text"].rstrip()

                        matches.append({
                            "content": content,
                            "file": file_path,
                            "line_number": line_number
                        })
                        matched_files.add(file_path)
                except (json.JSONDecodeError, KeyError):
                    continue

            return {
                "success": len(matches) > 0,
                "matches": matches,
                "content": f"Found {len(matches)} matches in {len(matched_files)} files",
                "matched_files": list(matched_files)
            }

        except Exception as e:
            logger.error(f"execute_purely failed: {e}", exc_info=True)
            return {
                "success": False,
                "matches": [],
                "content": f"Search error: {str(e)}",
                "matched_files": []
            }

    def _combine_output(self, stdout_str: str, stderr_str: str) -> str:
        """统一组合 stdout 和 stderr 输出

        Args:
            stdout_str: 标准输出内容
            stderr_str: 错误输出内容

        Returns:
            组合后的完整输出
        """
        if not stdout_str and not stderr_str:
            return NO_MATCHES_MSG

        if not stdout_str:
            content = NO_MATCHES_MSG
            if stderr_str:
                content += WARNINGS_SECTION + stderr_str
            return content

        # 有 stdout 内容
        content = stdout_str
        if stderr_str:
            content += WARNINGS_SECTION + stderr_str
        return content

    async def _update_file_timestamps(self, tool_context: ToolContext, matched_files: List[Path]) -> None:
        """更新匹配文件的时间戳

        Args:
            tool_context: 工具上下文
            matched_files: 匹配的文件路径列表
        """
        if not matched_files:
            return

        horizon = self.get_horizon(tool_context)
        for file_path in matched_files:
            try:
                await horizon.update_timestamp(file_path)
                logger.debug(f"已更新搜索结果文件时间戳: {file_path}")
            except Exception as e:
                logger.warning(f"更新文件时间戳失败 {file_path}: {e}")

    async def _count_matching_files(self, include: str, search_dir: Path) -> Optional[int]:
        """预检：统计将被搜索的文件数，超限时提前中止，避免 S3 大量下载。

        只运行 rg --files（S3 LIST，便宜），不读取文件内容（S3 GET，昂贵）。
        一旦计数超过 MAX_SEARCH_FILES 立即 kill，不等全部列完。

        Returns:
            文件数量；超时返回 None（视为未知，由调用方决策）
        """
        cmd = ["rg", "--files"]
        if not include:
            for pattern in DEFAULT_IGNORE_PATTERNS:
                cmd.extend(["--glob", f"!{pattern}"])
        if include:
            cmd.extend(["--glob", include])
        cmd.append(str(search_dir))

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
            cwd=str(self.base_dir)
        )

        count = 0

        async def _read_until_limit() -> None:
            nonlocal count
            assert process.stdout is not None
            while True:
                line = await process.stdout.readline()
                if not line:
                    break
                count += 1
                if count > MAX_SEARCH_FILES:
                    return  # 已超限，不需要继续计数

        try:
            await asyncio.wait_for(_read_until_limit(), timeout=PREFLIGHT_TIMEOUT)
        except asyncio.TimeoutError:
            logger.warning(f"Pre-flight file count timed out after {PREFLIGHT_TIMEOUT}s, counted {count} files so far")
            try:
                process.kill()
                await process.wait()
            except Exception:
                pass
            return None
        else:
            try:
                process.kill()
                await process.wait()
            except Exception:
                pass

        return count

    async def _run(self, pattern: str, include: str = "", path: str = "") -> SearchResult:
        """运行工具并返回搜索结果"""
        try:
            # 确定搜索目录
            if path:
                search_path = Path(path)
                if search_path.is_absolute():
                    search_dir = search_path
                else:
                    search_dir = self.base_dir / search_path
            else:
                search_dir = self.base_dir

            # 预检：统计匹配文件数，防止 S3 大量 GET 下载
            file_count = await self._count_matching_files(include, search_dir)
            if file_count is None:
                return SearchResult(
                    content=(
                        f"Search aborted: file enumeration timed out after {PREFLIGHT_TIMEOUT}s. "
                        f"The search scope is too broad for a network filesystem. "
                        f"Narrow the search by specifying a more specific path or include pattern."
                    ),
                    matched_files=[],
                    has_matches=False
                )
            if file_count > MAX_SEARCH_FILES:
                return SearchResult(
                    content=(
                        f"Search aborted: {file_count}+ files match the search scope "
                        f"(limit: {MAX_SEARCH_FILES}). "
                        f"On a network filesystem, searching too many files triggers excessive downloads. "
                        f"Narrow the search by:\n"
                        f"- Using a more specific subdirectory path (e.g., path='src/components')\n"
                        f"- Combining include with a specific path instead of searching the entire workspace"
                    ),
                    matched_files=[],
                    has_matches=False
                )

            # 构建 ripgrep 命令
            cmd = [
                "rg",
                "--line-number",
                "--json",
                "--sort=modified",  # 按修改时间排序，优先显示最新文件
                "--max-count", "10",  # 限制每个文件的匹配数量
                "--max-filesize", "5M",  # 限制文件大小避免大文件
                "--max-columns", str(MAX_LINE_LENGTH),  # 限制单行长度，防止二进制文件
                "--max-columns-preview",  # 在普通文本模式输出更友好的长行预览
                "--context", "3"  # 固定3行上下文
            ]

            # 添加默认忽略模式 (除非有自定义的 include)
            if not include:
                for ignore_pattern in DEFAULT_IGNORE_PATTERNS:
                    cmd.extend(["--glob", f"!{ignore_pattern}"])

            # 添加包含模式
            if include:
                cmd.extend(["--glob", include])

            # 添加搜索模式和目录
            cmd.extend([pattern, str(search_dir)])

            # 执行命令 - 使用异步版本，带总超时防止卡住
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(self.base_dir)
            )
            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(), timeout=EXECUTION_TIMEOUT
                )
            except asyncio.TimeoutError:
                try:
                    process.kill()
                    await process.wait()
                except Exception:
                    pass
                return SearchResult(
                    content=(
                        f"Search timed out after {EXECUTION_TIMEOUT}s. "
                        f"The search scope may still be too broad. "
                        f"Try a more specific path or pattern."
                    ),
                    matched_files=[],
                    has_matches=False
                )

            # 处理结果 - 统一组合 stdout 和 stderr
            stdout_str = stdout.decode('utf-8').strip()
            stderr_str = stderr.decode('utf-8').strip()

            if process.returncode == 0 or process.returncode == 1:  # 1 表示没有匹配
                if not stdout_str:
                    return SearchResult(
                        content=self._combine_output("", stderr_str),
                        matched_files=[],
                        has_matches=False
                    )

                # 解析 JSON 输出并按文件分组
                matches = self._parse_ripgrep_output(stdout_str)
                if not matches:
                    return SearchResult(
                        content=self._combine_output("", stderr_str),
                        matched_files=[],
                        has_matches=False
                    )

                # 限制文件数量 (选择最相关的文件)
                max_files = 20  # 固定限制
                if len(matches) > max_files:
                    # 按匹配行数排序，选择匹配最多的文件（不包括上下文行）
                    sorted_matches = sorted(
                        matches.items(),
                        key=lambda x: len([line for line in x[1] if line.is_match]),
                        reverse=True
                    )
                    matches = dict(sorted_matches[:max_files])
                    logger.info(f"Limited results to top {max_files} files with most matches")

                # 格式化输出并获取匹配文件列表
                formatted_content = await self._format_matches(matches, max_files)
                final_content = self._combine_output(formatted_content, stderr_str)

                matched_files = list(matches.keys())
                return SearchResult(
                    content=final_content,
                    matched_files=matched_files,
                    has_matches=True
                )
            else:
                # 失败情况，聚合所有输出
                error_msg = f"Search failed (exit code: {process.returncode})"
                if stdout_str:
                    error_msg += f"\nOutput: {stdout_str}"
                if stderr_str:
                    error_msg += f"\nErrors: {stderr_str}"
                logger.error(f"ripgrep search failed: {error_msg}")
                return SearchResult(
                    content=error_msg,
                    matched_files=[],
                    has_matches=False
                )

        except FileNotFoundError:
            return SearchResult(
                content="Error: ripgrep (rg) command not found. Please ensure ripgrep is installed.",
                matched_files=[],
                has_matches=False
            )
        except Exception as e:
            logger.error(f"Error executing search: {e}", exc_info=True)
            return SearchResult(
                content=f"Error executing search: {e!s}",
                matched_files=[],
                has_matches=False
            )

    def _parse_ripgrep_output(self, output: str) -> Dict[Path, List[LineInfo]]:
        """解析 ripgrep 的 JSON 输出，处理匹配行和上下文行"""
        import json

        matches: Dict[Path, List[LineInfo]] = {}
        for line in output.splitlines():
            try:
                data = json.loads(line)
                line_type = data.get("type")

                # Process both match and context lines
                if line_type in ["match", "context"]:
                    path = Path(data["data"]["path"]["text"])
                    line_number = data["data"]["line_number"]
                    raw_content = data["data"]["lines"]["text"].rstrip('\n\r')
                    is_match = (line_type == "match")
                    if is_match:
                        submatches = data["data"].get("submatches", [])
                        content = self._build_match_preview(raw_content, submatches)
                    else:
                        content = self._truncate_context_line(raw_content)

                    if path not in matches:
                        matches[path] = []

                    matches[path].append(LineInfo(
                        line_number=line_number,
                        content=content,
                        is_match=is_match
                    ))
            except json.JSONDecodeError:
                continue
            except KeyError:
                continue

        # Sort lines by line number within each file to maintain proper order
        for path in matches:
            matches[path].sort(key=lambda x: x.line_number)

        return matches

    def _byte_offset_to_char_index(self, text: str, byte_offset: int) -> int:
        """把 UTF-8 字节偏移转换成 Python 字符索引"""
        if byte_offset <= 0:
            return 0

        encoded = text.encode("utf-8")
        safe_offset = min(byte_offset, len(encoded))
        return len(encoded[:safe_offset].decode("utf-8", errors="ignore"))

    def _extract_char_spans(self, content: str, submatches: List[Dict[str, Any]]) -> List[Tuple[int, int]]:
        """从 ripgrep submatches 提取字符级命中区间"""
        spans: List[Tuple[int, int]] = []
        for submatch in submatches:
            start_byte = submatch.get("start")
            end_byte = submatch.get("end")
            if not isinstance(start_byte, int) or not isinstance(end_byte, int):
                continue

            start_char = self._byte_offset_to_char_index(content, start_byte)
            end_char = self._byte_offset_to_char_index(content, end_byte)
            if end_char > start_char:
                spans.append((start_char, end_char))

        if not spans:
            return []

        # 合并重叠区间，避免重复片段
        spans.sort(key=lambda item: item[0])
        merged: List[Tuple[int, int]] = []
        for start, end in spans:
            if not merged or start > merged[-1][1]:
                merged.append((start, end))
            else:
                merged[-1] = (merged[-1][0], max(merged[-1][1], end))

        return merged

    def _truncate_context_line(self, content: str, max_chars: int = MAX_CONTEXT_LINE_PREVIEW_CHARS) -> str:
        """安全截断上下文行，避免超长单行撑爆输出"""
        if len(content) <= max_chars:
            return content

        head_chars = max(40, max_chars // 2 - 20)
        tail_chars = max(30, max_chars - head_chars - 30)
        omitted_chars = len(content) - head_chars - tail_chars
        return (
            f"{content[:head_chars]}"
            f" ...[truncated {omitted_chars} chars]... "
            f"{content[-tail_chars:]}"
        )

    def _build_match_preview(self, content: str, submatches: List[Dict[str, Any]]) -> str:
        """构建命中行预览：始终保留命中点附近窗口，保证命中可见"""
        spans = self._extract_char_spans(content, submatches)
        if not spans:
            return self._truncate_context_line(content)

        snippets: List[str] = []
        visible_spans = spans[:MAX_MATCH_WINDOWS_PER_LINE]
        for start, end in visible_spans:
            window_start = max(0, start - MATCH_PREVIEW_BEFORE_CHARS)
            window_end = min(len(content), end + MATCH_PREVIEW_AFTER_CHARS)
            prefix = "..." if window_start > 0 else ""
            suffix = "..." if window_end < len(content) else ""
            snippet = (
                f"[col {start + 1}-{end}] "
                f"{prefix}{content[window_start:window_end]}{suffix}"
            )
            snippets.append(snippet)

        hidden_windows = len(spans) - len(visible_spans)
        hidden_suffix = f" (+{hidden_windows} more matches)" if hidden_windows > 0 else ""
        merged_preview = " || ".join(snippets) + hidden_suffix
        return self._truncate_context_line(merged_preview, MAX_CONTEXT_LINE_PREVIEW_CHARS * 2)

    def _truncate_formatted_output(self, content: str) -> Tuple[str, bool]:
        """对最终格式化结果做预算控制，避免输出撑爆上下文"""
        if (
            len(content) <= MAX_FORMATTED_OUTPUT_CHARS
            and num_tokens_from_string(content) <= MAX_FORMATTED_OUTPUT_TOKENS
        ):
            return content, False

        right_bound = min(len(content), MAX_FORMATTED_OUTPUT_CHARS)
        left, right = 0, right_bound
        best = ""

        while left <= right:
            mid = (left + right) // 2
            candidate = content[:mid]
            if num_tokens_from_string(candidate) <= MAX_FORMATTED_OUTPUT_TOKENS:
                best = candidate
                left = mid + 1
            else:
                right = mid - 1

        if not best:
            best = content[: min(1000, right_bound)]

        return best.rstrip() + OUTPUT_TRUNCATED_HINT, True

    async def _format_matches(self, matches: Dict[Path, List[LineInfo]], max_files: int = 20) -> str:
        """格式化匹配结果，区分匹配行和上下文行"""
        if not matches:
            return NO_MATCHES_MSG

        # Calculate actual match counts (excluding context lines)
        total_matches = sum(len([line for line in lines if line.is_match]) for lines in matches.values())
        file_count = len(matches)

        output = []
        output.append(f"Found {total_matches} matches in {file_count} files")
        if file_count == max_files:
            output.append(f"(Limited to top {max_files} files)")
        output.append("")  # Empty line for spacing

        for file_path, lines in matches.items():
            # Skip binary files
            try:
                if await is_binary_file(file_path):
                    logger.warning(f"Skipping binary file: {file_path}")
                    continue
            except Exception as e:
                logger.warning(f"Binary check failed for {file_path}, treating as binary: {e}")
                continue

            # 获取文件信息
            stat = await async_stat(file_path)
            display_path = str(file_path.resolve())

            # 创建 FileInfo 对象
            file_info = FileInfo(
                name=file_path.name,
                path=display_path,
                is_dir=False,
                size=stat.st_size,
                last_modified=stat.st_mtime,
                line_count=await self._count_lines(file_path),
            )

            # 添加文件信息
            size_str = self._format_size(file_info.size)
            line_str = f", {file_info.line_count} lines" if file_info.line_count is not None else ""
            output.append(f"\n{file_info.path} ({size_str}{line_str}) - {file_info.format_time()}")

            # 添加匹配行和上下文行，使用不同的前缀
            for line_info in lines:
                if line_info.is_match:
                    # Match line with ':' prefix
                    output.append(f"  {line_info.line_number}: {line_info.content}")
                else:
                    # Context line with '-' prefix
                    output.append(f"  {line_info.line_number}- {line_info.content}")

        raw_output = "\n".join(output)
        safe_output, truncated = self._truncate_formatted_output(raw_output)
        if truncated:
            logger.info("grep_search output truncated by safety budget")
        return safe_output

    def _format_size(self, size: int) -> str:
        """格式化文件大小"""
        for unit in ["B", "KB", "MB", "GB"]:
            if size < 1024:
                return f"{size:.1f}{unit}"
            size /= 1024
        return f"{size:.1f}TB"

    async def _count_lines(self, file_path: Path) -> Optional[int]:
        """计算文件行数"""
        try:
            return await async_count_text_lines(file_path)
        except (OSError, UnicodeDecodeError):
            return None

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        """Get tool details for display - shows the search results with syntax highlighting"""
        # Early return for error cases
        if not result.ok:
            return None

        if not result.extra_info or "search_content" not in result.extra_info:
            return None

        search_content = result.extra_info.get("search_content", "")
        if not search_content or search_content == NO_MATCHES_MSG:
            return None

        # Get search details
        search_query = result.extra_info.get("search_query", "")
        matched_files_count = result.extra_info.get("matched_files_count", 0)
        context_lines = result.extra_info.get("context_lines", 3)

        # Format search results as markdown with syntax highlighting
        markdown_content = f"## Search Results: '{search_query}'\n\n"
        markdown_content += f"**Files matched:** {matched_files_count}\n"
        markdown_content += f"**Context lines:** {context_lines} lines before/after each match\n\n"
        markdown_content += "```grep\n"
        markdown_content += search_content  # This now includes stderr if present
        markdown_content += "\n```"

        return ToolDetail(
            type=DisplayType.MD,  # Use Markdown display type
            data=FileContent(
                file_name="search_results.md",
                content=markdown_content
            )
        )

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
                "action": i18n.translate("grep_search", category="tool.actions"),
                "remark": i18n.translate("search.error", category="tool.messages", error=result.content)
            }

        return {
            "action": i18n.translate("grep_search", category="tool.actions"),
            "remark": arguments.get("pattern", "") if arguments else ""
        }
