"""文件路径模糊匹配工具

处理模型输出文件路径时可能出现的中英文标点符号混淆、Unicode 特殊空白，
以及 CJK 与 ASCII/数字 之间误插空格等问题。

归一化规则由 fuzzy_text_matcher 统一提供。
"""

from pathlib import Path
from typing import Optional

from agentlang.logger import get_logger
from app.utils.fuzzy_text_matcher import FileMatchResult, find_unique_in_filenames

logger = get_logger(__name__)


class FilePathFuzzyMatcher:
    """文件路径模糊匹配器，处理路径层面的字符差异。

    归一化规则：中英文标点替换、Unicode 特殊空白替换、CJK-ASCII 边界空格移除。
    所有规则由 fuzzy_text_matcher.normalize_for_match() 统一管理。
    """

    @classmethod
    def try_find_fuzzy_match(cls, file_path: Path, base_dir: Path) -> Optional[FileMatchResult]:
        """尝试在同一目录下查找归一化等价的文件。

        逻辑：
        1. 如果文件路径已存在，直接返回 None（不需要模糊匹配）
        2. 提取文件名，在同一目录下查找归一化等价的唯一候选
        3. 若唯一命中，返回 FileMatchResult；否则返回 None

        Args:
            file_path: 原始文件路径（绝对路径）
            base_dir: 工作目录根路径（用于构造相对路径警告信息）
        """
        if file_path.exists():
            return None

        parent_dir = file_path.parent
        original_filename = file_path.name

        result = find_unique_in_filenames(original_filename, parent_dir)
        if result is None:
            logger.debug(f"未找到模糊匹配的文件: {original_filename}")
            return None

        matched_file = result.path

        # 将警告里的路径换成相对于 base_dir 的形式，更易于 AI 理解
        try:
            relative_original = file_path.relative_to(base_dir)
            relative_matched = matched_file.relative_to(base_dir)
            warning = (
                f"**Path Auto-Correction Applied**\n\n"
                f"Found a file with mixed/extra characters in its name.\n\n"
                f"- Your input: `{relative_original}`\n"
                f"- Matched file: `{relative_matched}`\n"
                f"- Reason: Both paths normalize to the same result after standardizing "
                f"punctuation marks and boundary spaces.\n\n"
                f"**IMPORTANT**: For all future requests, you MUST use `{relative_matched}` "
                f"directly to avoid repeated path corrections."
            )
        except ValueError:
            warning = result.warning  # 无法计算相对路径时保留默认 warning

        logger.info(f"模糊匹配成功: {original_filename} -> {matched_file.name}")
        return FileMatchResult(path=matched_file, warning=warning)
