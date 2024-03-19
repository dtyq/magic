"""
输入诊断工具

在 edit_file 匹配失败时提供自动化诊断提示，帮助 AI 识别常见的输入格式问题。

与 PunctuationMatcher 的区别：
- PunctuationMatcher: 处理中英文标点符号差异，可自动修复
- InputDiagnoser: 诊断其他输入格式问题（转义、全角半角等），只提示不修复

注意：此工具提供的提示可能不适用，仅作为启发性建议。
"""

import re
from typing import Optional


class InputDiagnoser:
    """
    AI 输入问题诊断器

    在 edit_file 工具匹配失败时，提供简短的诊断提示，
    帮助 AI 识别可能的输入格式问题。
    """

    @classmethod
    def diagnose_input_issues(cls, search_str: str, content: str) -> Optional[str]:
        """
        诊断 AI 输入的常见问题

        Args:
            search_str: AI 提供的 old_string
            content: 文件实际内容

        Returns:
            诊断提示信息（如果发现问题），或 None

        Note:
            只在匹配失败时调用，提供启发性建议，不保证准确
        """
        hints = []

        # 检测编程式转义
        if hint := cls._check_programming_escapes(search_str):
            hints.append(hint)

        # 检测全角半角混用
        if hint := cls._check_fullwidth_halfwidth(search_str):
            hints.append(hint)

        # 检测特殊空白字符
        if hint := cls._check_special_whitespace(search_str):
            hints.append(hint)

        # 诊断多行匹配差异
        if hint := cls._diagnose_multiline_diff(search_str, content):
            hints.append(hint)

        if not hints:
            return None

        # 组合所有提示
        header = (
            "--- DIAGNOSTIC HINTS ---\n\n"
            "Possible issues detected (check what applies to your case):\n"
        )

        return header + "\n\n".join(hints) + "\n\n---"

    @classmethod
    def _check_programming_escapes(cls, text: str) -> Optional[str]:
        """
        检测编程式转义序列

        检测 \" \' \n \t 等常见的编程语言转义写法
        """
        # 查找常见转义序列
        escape_pattern = r'\\["\'\nt]'
        escapes = re.findall(escape_pattern, text)

        if not escapes:
            return None

        # 获取位置信息
        positions = [m.start() for m in re.finditer(escape_pattern, text)]
        pos_str = ', '.join(map(str, positions[:5]))  # 最多显示 5 个
        if len(positions) > 5:
            pos_str += f' (+{len(positions)-5} more)'

        # 统计每种转义
        unique_escapes = sorted(set(escapes))
        escape_str = ' '.join(unique_escapes)

        return (
            f"Programming-style escapes detected: {escape_str} at positions {pos_str}\n"
            f"  -> Don't use \\\" or \\' - Copy the actual quote characters from file\n"
            f'  -> Example: Use " (quote mark) not \\" (backslash+quote)'
        )

    @classmethod
    def _check_fullwidth_halfwidth(cls, text: str) -> Optional[str]:
        """
        检测全角半角混用

        检测全角 ASCII 字符（如 Ａ Ｂ Ｃ）与半角字符混用
        """
        # 检测全角 ASCII 字符（U+FF00-U+FF5E）
        fullwidth_pattern = r'[\uff00-\uff5e]+'
        fullwidth_matches = re.findall(fullwidth_pattern, text)

        if not fullwidth_matches:
            return None

        # 提取唯一字符作为示例
        fullwidth_chars = set(''.join(fullwidth_matches))
        examples = ''.join(sorted(fullwidth_chars)[:5])
        if len(fullwidth_chars) > 5:
            examples += '...'

        return (
            f"Fullwidth characters detected: {examples}\n"
            f"  -> These may differ from halfwidth ASCII in file\n"
            f"  -> Example: 'Ａ' (fullwidth) vs 'A' (halfwidth)"
        )

    @classmethod
    def _check_special_whitespace(cls, text: str) -> Optional[str]:
        """
        检测特殊空白字符

        检测全角空格、零宽空格等非标准空白字符
        """
        issues = []

        # 全角空格 (U+3000)
        if '\u3000' in text:
            count = text.count('\u3000')
            issues.append(f"fullwidth spaces (U+3000): {count} found")

        # 零宽空格 (U+200B)
        if '\u200b' in text:
            count = text.count('\u200b')
            issues.append(f"zero-width spaces (U+200B): {count} found")

        # 不间断空格 (U+00A0)
        if '\u00a0' in text:
            count = text.count('\u00a0')
            issues.append(f"non-breaking spaces (U+00A0): {count} found")

        if not issues:
            return None

        return (
            "Special whitespace characters detected:\n"
            + "\n".join(f"  - {issue}" for issue in issues)
            + "\n  -> These look like spaces but are different Unicode characters\n"
            + "  -> Copy the exact whitespace from file"
        )

    @classmethod
    def _diagnose_multiline_diff(cls, search_str: str, content: str) -> Optional[str]:
        """
        诊断多行匹配差异

        当 old_string 是多行时，检测可能的差异位置
        """
        lines = search_str.split('\n')

        # 单行不诊断
        if len(lines) <= 1:
            return None

        # 检查第一行是否在文件中
        first_line = lines[0]
        if first_line not in content:
            return None  # 第一行都不匹配，不是多行问题

        # 对于超长字符串，建议拆分（基于字符数而非行数）
        char_count = len(search_str)
        if char_count > 500:  # 超过 500 字符建议拆分
            return (
                f"Very long old_string ({char_count} characters, {len(lines)} lines)\n"
                f"  -> Consider splitting into multiple smaller edits\n"
                f"  -> Or use shell commands (sed/awk) for large replacements"
            )

        # 尝试找到具体哪些行不匹配
        content_lines = content.split('\n')

        # 查找第一行在文件中的位置
        try:
            first_line_idx = content_lines.index(first_line)
        except ValueError:
            return None

        # 检查后续行
        mismatched_lines = []
        for i in range(1, min(len(lines), 10)):  # 最多检查前 10 行
            if first_line_idx + i >= len(content_lines):
                mismatched_lines.append(i + 1)  # 文件行数不够
                break

            search_line = lines[i]
            file_line = content_lines[first_line_idx + i]

            if search_line != file_line:
                mismatched_lines.append(i + 1)

        if not mismatched_lines:
            # 前面的行都匹配，可能是后面的行有问题
            return (
                f"Multiline match failed ({len(lines)} lines)\n"
                f"  -> First line matches, but later lines differ\n"
                f"  -> Check trailing whitespace, blank lines, or indentation"
            )

        # 具体指出哪些行不匹配
        if len(mismatched_lines) <= 3:
            lines_str = ', '.join(map(str, mismatched_lines))
        else:
            lines_str = ', '.join(map(str, mismatched_lines[:3])) + f' (+{len(mismatched_lines)-3} more)'

        return (
            f"Multiline match: Lines {lines_str} don't match file content\n"
            f"  -> Re-read the file and copy those lines exactly\n"
            f"  -> Check: spaces vs tabs, trailing whitespace, blank lines"
        )
