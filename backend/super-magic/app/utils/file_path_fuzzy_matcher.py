"""
文件路径模糊匹配工具

用于处理大模型输出文件路径时可能出现的中英文标点符号混淆问题
"""

import os
from pathlib import Path
from typing import Optional, Tuple

from agentlang.logger import get_logger

logger = get_logger(__name__)


class FilePathFuzzyMatcher:
    """文件路径模糊匹配器，处理中英文标点符号差异"""

    # 中英文标点符号映射表
    PUNCTUATION_MAP = {
        '（': '(',
        '）': ')',
        '，': ',',
        '。': '.',
        '：': ':',
        '；': ';',
        '？': '?',
        '！': '!',
        '【': '[',
        '】': ']',
        '《': '<',
        '》': '>',
        '"': '"',
        '"': '"',
        ''': "'",
        ''': "'",
        '｛': '{',
        '｝': '}',
        '、': ',',
        '—': '-',
        '－': '-',
    }

    @classmethod
    def normalize_punctuation(cls, text: str) -> str:
        """
        将中文标点符号转换为英文标点符号

        Args:
            text: 输入文本

        Returns:
            标准化后的文本
        """
        result = text
        for cn_punct, en_punct in cls.PUNCTUATION_MAP.items():
            result = result.replace(cn_punct, en_punct)
        return result

    @classmethod
    def try_find_fuzzy_match(cls, file_path: Path, base_dir: Path) -> Optional[Tuple[Path, str]]:
        """
        尝试在同一目录下查找模糊匹配的文件

        逻辑：
        1. 如果文件路径存在，直接返回 None（不需要模糊匹配）
        2. 如果文件路径不存在，提取文件名并标准化标点符号
        3. 在同一目录下查找标准化后文件名匹配的文件
        4. 如果有且只有一个匹配，返回该文件路径和警告信息
        5. 否则返回 None

        Args:
            file_path: 原始文件路径（绝对路径）
            base_dir: 工作目录根路径

        Returns:
            Optional[Tuple[Path, str]]: (匹配的文件路径, 警告信息) 或 None
        """
        # 如果文件已存在，不需要模糊匹配
        if file_path.exists():
            return None

        # 获取目录和文件名
        parent_dir = file_path.parent
        original_filename = file_path.name

        # 检查目录是否存在
        if not parent_dir.exists() or not parent_dir.is_dir():
            logger.debug(f"父目录不存在，无法进行模糊匹配: {parent_dir}")
            return None

        # 标准化原始文件名的标点符号
        normalized_filename = cls.normalize_punctuation(original_filename)

        # 注意：不能因为标准化后文件名相同就跳过匹配
        # 因为实际文件可能是中文标点，用户输入是英文标点
        # 例如：用户输入 MCP: 实际文件是 MCP：
        # 这种情况下，用户输入标准化后还是 MCP:，但需要匹配到 MCP：

        logger.info(f"尝试模糊匹配文件: '{original_filename}' (normalized: '{normalized_filename}')")

        # 在同一目录下查找匹配的文件
        matched_files = []
        try:
            for entry in parent_dir.iterdir():
                if entry.is_file():
                    # 标准化当前文件名
                    entry_normalized = cls.normalize_punctuation(entry.name)

                    # 检查标准化后的文件名是否匹配
                    if entry_normalized == normalized_filename:
                        matched_files.append(entry)
                        logger.debug(f"找到匹配文件: {entry.name}")
        except Exception as e:
            logger.error(f"遍历目录时出错: {parent_dir}, error={e}")
            return None

        # 如果有且只有一个匹配，返回该文件
        if len(matched_files) == 1:
            matched_file = matched_files[0]

            # 计算相对路径（用于警告信息）
            try:
                relative_original = file_path.relative_to(base_dir)
                relative_matched = matched_file.relative_to(base_dir)
            except ValueError:
                # 如果无法计算相对路径，使用文件名
                relative_original = original_filename
                relative_matched = matched_file.name

            warning = (
                f"**Path Auto-Correction Applied**\n\n"
                f"Found a file with mixed Chinese/English punctuation marks.\n\n"
                f"- Your input: `{relative_original}`\n"
                f"- Matched file: `{relative_matched}`\n"
                f"- Reason: Both paths normalize to the same result after standardizing punctuation marks.\n\n"
                f"**IMPORTANT**: For all future requests, you MUST use `{relative_matched}` directly to avoid repeated path corrections."
            )

            logger.info(f"模糊匹配成功: {original_filename} -> {matched_file.name}")
            return matched_file, warning

        elif len(matched_files) > 1:
            logger.warning(f"模糊匹配找到多个文件({len(matched_files)})，无法自动选择: {[f.name for f in matched_files]}")
            return None
        else:
            logger.debug(f"未找到模糊匹配的文件: {normalized_filename}")
            return None
