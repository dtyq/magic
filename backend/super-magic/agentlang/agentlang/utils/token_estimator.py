"""
Token 估计器模块

基于字符启发式的轻量级 token 估算，避免 tiktoken 冷启动开销。
精度上不如 BPE 精确编码，但满足压缩阈值判断、内容截断等场景。
"""

from dataclasses import dataclass

from agentlang.logger import get_logger

logger = get_logger(__name__)


@dataclass(slots=True)
class TokenEstimateCounter:
    """
    累计字符后统一取整，使分块计数与整段文本使用相同口径。

    背景：记忆测量要支持增量解码，但不能改变项目原有的中文／其它字符估算公式。
    MOCK DEMO：四个英文字符分成四块，每块单独估算并取整可能得到 4 Token；
    先累计 4 个字符再统一取整，得到 1 Token，与整段估算一致。
    本类只数已解码字符，不处理 UTF-8 字节边界；文件读取方使用增量 decoder。
    它不是精确 tokenizer，也不提供内容摘要、语义质量或是否应删记忆的判断。
    """

    chinese_char_count: int = 0
    non_chinese_char_count: int = 0

    def add_text(self, text: str) -> None:
        chinese = sum(1 for char in text if '\u4e00' <= char <= '\u9fff')
        self.chinese_char_count += chinese
        self.non_chinese_char_count += len(text) - chinese

    @property
    def estimated_tokens(self) -> int:
        if not self.chinese_char_count and not self.non_chinese_char_count:
            return 0
        return max(1, int(self.chinese_char_count / 1.5 + self.non_chinese_char_count / 4))


def num_tokens_from_string(string: str) -> int:
    """
    估算字符串的 token 数量

    采用字符级启发式：中文每 1.5 字符 ≈ 1 token，其余每 4 字符 ≈ 1 token。

    整段调用与分块测量共用字符范围和最后一次取整；它估算上下文成本，不测文件字节大小。
    此函数不读磁盘、不保留跨次状态，每次输入均从空计数开始。
    """
    counter = TokenEstimateCounter()
    counter.add_text(string)
    return counter.estimated_tokens


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
