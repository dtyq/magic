"""
Diff 生成工具类

用于生成标准的 unified diff 和代码片段，
便于展示文件修改的内容。
"""

import difflib
from typing import Optional, List, Tuple
from agentlang.logger import get_logger

logger = get_logger(__name__)


class DiffGenerator:
    """Diff 生成器"""

    @staticmethod
    def generate_summary_diff(
        old_content: str,
        new_content: str,
        file_path: str
    ) -> str:
        """
        生成用于 LLM 的摘要 diff（简洁统计信息）

        Args:
            old_content: 原始内容
            new_content: 新内容
            file_path: 文件路径（用于 diff 头部）

        Returns:
            简洁的变更摘要
        """
        if old_content == new_content:
            return ""

        stats = DiffGenerator.calculate_change_stats(old_content, new_content)

        return f"""\
--- a/{file_path}
+++ b/{file_path}

Large file change - showing summary:
  Lines: {stats['old_line_count']} → {stats['new_line_count']} ({stats['new_line_count'] - stats['old_line_count']:+d})
  Size: {stats['old_size']} → {stats['new_size']} bytes ({stats['size_change']:+d})
  Added: +{stats['added_lines']} lines
  Deleted: -{stats['deleted_lines']} lines
  Modified: ~{stats['modified_lines']} lines\
"""

    @staticmethod
    def generate_unified_diff(
        old_content: str,
        new_content: str,
        file_path: str,
        context_lines: int = 3
    ) -> str:
        """
        生成标准的 unified diff（用于详细展示）

        Args:
            old_content: 原始内容
            new_content: 新内容
            file_path: 文件路径（用于 diff 头部）
            context_lines: 上下文行数，默认3行

        Returns:
            标准的 unified diff 格式
        """
        if old_content == new_content:
            return ""

        old_lines = old_content.splitlines(keepends=True)
        new_lines = new_content.splitlines(keepends=True)

        # 如果最后一行没有换行符，添加一个
        if old_lines and not old_lines[-1].endswith('\n'):
            old_lines[-1] += '\n'
        if new_lines and not new_lines[-1].endswith('\n'):
            new_lines[-1] += '\n'

        diff_lines = list(difflib.unified_diff(
            old_lines,
            new_lines,
            fromfile=f"a/{file_path}",
            tofile=f"b/{file_path}",
            n=context_lines
        ))

        return ''.join(diff_lines)

    @staticmethod
    def generate_match_locations_snippet(
        content: str,
        search_string: str,
        max_matches: int = 10
    ) -> Tuple[List[int], str]:
        """
        生成所有匹配位置的代码片段

        Args:
            content: 文件内容
            search_string: 搜索字符串
            max_matches: 最多显示的匹配数

        Returns:
            (行号列表, 格式化的匹配位置片段)
        """
        if not content or not search_string:
            return [], ""

        lines = content.split('\n')
        matches = []
        line_numbers = []

        # 查找所有匹配
        for i, line in enumerate(lines):
            if search_string in line:
                line_num = i + 1
                line_numbers.append(line_num)

                if len(matches) < max_matches:
                    # 获取匹配位置的上下文（前后各1行）
                    snippet_lines = []

                    # 前一行
                    if i > 0:
                        snippet_lines.append(f"  {i:4}|{lines[i-1][:100]}")

                    # 匹配行（高亮）
                    snippet_lines.append(f"> {line_num:4}|{line[:100]}")

                    # 后一行
                    if i < len(lines) - 1:
                        snippet_lines.append(f"  {i+2:4}|{lines[i+1][:100]}")

                    matches.append('\n'.join(snippet_lines))

        if not matches:
            return [], ""

        # 格式化输出
        output = f"Found {len(line_numbers)} matches"
        if len(line_numbers) > max_matches:
            output += f" (showing first {max_matches})"
        output += f" at lines: {', '.join(map(str, line_numbers[:20]))}"
        if len(line_numbers) > 20:
            output += f", ... and {len(line_numbers) - 20} more"
        output += "\n\n"

        output += "\n---\n".join(matches)

        return line_numbers, output

    @staticmethod
    def calculate_change_stats(
        old_content: str,
        new_content: str
    ) -> dict:
        """
        计算变更统计信息

        Args:
            old_content: 原始内容
            new_content: 新内容

        Returns:
            包含统计信息的字典
        """
        old_lines = old_content.split('\n')
        new_lines = new_content.split('\n')

        # 使用 difflib 计算差异
        matcher = difflib.SequenceMatcher(None, old_lines, new_lines)
        opcodes = matcher.get_opcodes()

        added = 0
        deleted = 0
        modified = 0

        for tag, i1, i2, j1, j2 in opcodes:
            if tag == 'insert':
                added += j2 - j1
            elif tag == 'delete':
                deleted += i2 - i1
            elif tag == 'replace':
                # 替换操作计为修改
                modified += max(i2 - i1, j2 - j1)

        # 计算文件大小变化
        old_size = len(old_content.encode('utf-8'))
        new_size = len(new_content.encode('utf-8'))
        size_change = new_size - old_size

        return {
            'added_lines': added,
            'deleted_lines': deleted,
            'modified_lines': modified,
            'total_changes': added + deleted + modified,
            'old_size': old_size,
            'new_size': new_size,
            'size_change': size_change,
            'old_line_count': len(old_lines),
            'new_line_count': len(new_lines)
        }
