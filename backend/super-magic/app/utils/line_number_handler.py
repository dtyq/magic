"""
行号处理工具类

用于处理 read_file 工具输出的行号前缀，
自动识别并移除格式为 `lineNumber\tcontent` 的行号。
"""

import re
from typing import Optional, Tuple, List
from agentlang.logger import get_logger

logger = get_logger(__name__)


class LineNumberHandler:
    """行号前缀处理器"""

    # 行号格式：数字 + 制表符 + 内容
    # 例如: "42\tfunction hello() {"
    LINE_NUMBER_PATTERN = re.compile(r'^(\d+)\t')

    @classmethod
    def strip_line_numbers(cls, content: str) -> str:
        """
        移除所有行的行号前缀

        Args:
            content: 可能包含行号前缀的内容

        Returns:
            移除行号后的内容
        """
        if not content:
            return content

        lines = content.split('\n')
        stripped_lines = []

        for line in lines:
            # 使用正则表达式移除行号前缀
            stripped_line = cls.LINE_NUMBER_PATTERN.sub('', line)
            stripped_lines.append(stripped_line)

        return '\n'.join(stripped_lines)

    @classmethod
    def detect_and_strip(cls, old_string: str) -> Tuple[str, bool, Optional[str]]:
        """
        检测并移除行号前缀

        Args:
            old_string: 可能包含行号的字符串

        Returns:
            (处理后的字符串, 是否检测到行号, 警告信息)
        """
        # 检查第一行是否包含行号前缀
        first_line = old_string.split('\n')[0] if old_string else ""
        match = cls.LINE_NUMBER_PATTERN.match(first_line)

        if match:
            # 检测到行号前缀
            stripped = cls.strip_line_numbers(old_string)
            warning = (
                "Warning: old_string appears to contain line number prefix.\n"
                "Remove the number and tab at the start.\n"
                f"Example: \"{first_line[:30]}...\" should be \"{stripped.split('\\n')[0][:30]}...\""
            )
            logger.warning(f"检测到行号前缀: {first_line[:50]}...")
            return stripped, True, warning

        return old_string, False, None

    @classmethod
    def validate_no_line_numbers(cls, old_string: str) -> Tuple[bool, Optional[str]]:
        """
        验证字符串不包含行号前缀

        Args:
            old_string: 要验证的字符串

        Returns:
            (是否有效, 错误信息)
        """
        # 检查每一行是否都有行号前缀（可能是完整的行号块）
        lines = old_string.split('\n')
        if not lines:
            return True, None

        # 统计有行号前缀的行
        lines_with_numbers = 0
        total_lines = len([l for l in lines if l.strip()])  # 非空行数

        for line in lines:
            if line.strip() and cls.LINE_NUMBER_PATTERN.match(line):
                lines_with_numbers += 1

        # 如果超过一半的非空行都有行号，认为是行号块
        if total_lines > 0 and lines_with_numbers > total_lines / 2:
            suggestion = cls.strip_line_numbers(old_string)
            return False, (
                f"Found line number prefixes in {lines_with_numbers}/{total_lines} lines.\n"
                "The old_string should not contain line numbers from read_file output.\n"
                f"Suggested old_string (first 100 chars):\n{suggestion[:100]}..."
            )

        # 检查第一行
        if lines[0] and cls.LINE_NUMBER_PATTERN.match(lines[0]):
            suggestion = cls.LINE_NUMBER_PATTERN.sub('', lines[0])
            return False, (
                "old_string appears to contain line number prefix.\n"
                "Remove the number and tab at the start.\n"
                f"Line: \"{lines[0][:50]}...\" should be \"{suggestion[:50]}...\""
            )

        return True, None

    @classmethod
    def extract_line_numbers(cls, content: str) -> List[int]:
        """
        从包含行号的内容中提取所有行号

        Args:
            content: 包含行号前缀的内容

        Returns:
            行号列表
        """
        line_numbers = []
        lines = content.split('\n')

        for line in lines:
            match = cls.LINE_NUMBER_PATTERN.match(line)
            if match:
                try:
                    line_num = int(match.group(1))
                    line_numbers.append(line_num)
                except ValueError:
                    continue

        return line_numbers
