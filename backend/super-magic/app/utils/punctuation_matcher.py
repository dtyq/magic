"""文本锚点标点匹配工具

处理 edit_file / multi_edit_file 系列工具在 old_string 匹配失败时，
因中英文标点混淆、Unicode 特殊空白或 CJK-ASCII 边界空格造成的偏差。

归一化规则由 fuzzy_text_matcher 统一提供；本模块只保留对外接口，
供 edit_file / multi_edit_file 调用。
"""

from typing import Optional

from app.utils.fuzzy_text_matcher import TextMatchResult, find_in_text


class PunctuationMatcher:
    """文本锚点匹配纠偏器，内部复用 fuzzy_text_matcher 的统一规则。"""

    @classmethod
    def try_auto_fix_punctuation(
        cls,
        search_str: str,
        content: str,
    ) -> Optional[TextMatchResult]:
        """尝试自动纠正 old_string 与文件内容的轻微差异。

        采用四档梯度匹配（精确 → 去尾空白 → 去首尾空白 → 归一化/flex 正则）。
        只有精确匹配失败，且归一化后唯一命中时才自动纠正。

        Returns:
            None 表示无法自动纠正（未找到或命中多个）；
            TextMatchResult.actual 为文件中的真实子串，.warning 为 AI 侧纠偏提示。
        """
        result = find_in_text(search_str, content)
        if result is None or result.actual == search_str:
            return None

        # 只在匹配层面唯一时才自动纠正（避免在归一化后多候选时误修改）
        if result.match_count != 1:
            return None

        return result

    @classmethod
    def check_fuzzy_match_with_punctuation(
        cls,
        search_str: str,
        content: str,
        max_results: int = 3,  # 保留参数，兼容调用方签名
    ) -> Optional[str]:
        """在 old_string 完全无法命中时，提供诊断提示（仅用于生成错误信息，不做自动替换）。

        Returns:
            诊断字符串，或 None（无法诊断）
        """
        result = find_in_text(search_str, content)
        if result is None or result.actual == search_str:
            return None

        return (
            "--- NORMALIZATION MISMATCH DETECTED ---\n\n"
            f"A close match was found after normalization, but it appears multiple times "
            f"or failed uniqueness check, so auto-correction was skipped.\n\n"
            f"- You searched for: `{search_str[:100]}{'...' if len(search_str) > 100 else ''}`\n"
            f"- Close match in file: `{result.actual[:100]}{'...' if len(result.actual) > 100 else ''}`\n\n"
            "-> Copy the exact text from the file, including punctuation and spacing.\n\n---\n"
        )
