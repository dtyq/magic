"""
Token 估计器模块

基于字符启发式的轻量级 token 估算，避免 tiktoken 冷启动开销。
精度上不如 BPE 精确编码，但满足压缩阈值判断、内容截断等场景。
"""

from agentlang.logger import get_logger

logger = get_logger(__name__)


def num_tokens_from_string(string: str) -> int:
    """
    估算字符串的 token 数量

    采用字符级启发式：中文每 1.5 字符 ≈ 1 token，其余每 4 字符 ≈ 1 token。
    """
    if not string:
        return 0

    chinese_char_count = sum(1 for char in string if '\u4e00' <= char <= '\u9fff')
    non_chinese_char_count = len(string) - chinese_char_count
    estimated = int(chinese_char_count / 1.5 + non_chinese_char_count / 4)
    return max(1, estimated)


def truncate_text_by_token(text: str, max_tokens: int) -> tuple[str, bool]:
    """
    按估算 token 数截断文本

    Returns:
        (截断后文本, 是否被截断)
    """
    if not text:
        return "", False

    if len(text) < max_tokens:
        return text, False

    token_count = 0.0
    position = 0
    for i, char in enumerate(text):
        if '\u4e00' <= char <= '\u9fff':
            token_count += 1 / 1.5
        else:
            token_count += 1 / 4
        if int(token_count) >= max_tokens:
            position = i
            break

    if position == 0 or position >= len(text) - 1:
        return text, False

    truncated_text = text[:position] + "\n\n... [内容过长已截断] ..."
    return truncated_text, True
