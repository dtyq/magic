"""
Token 估计器模块

提供计算 LLM 模型 token 数量的辅助函数
"""

import tiktoken

from agentlang.logger import get_logger

logger = get_logger(__name__)


def num_tokens_from_string(string: str, model: str = "gpt-3.5-turbo") -> int:
    """
    估计字符串的 token 数量

    Args:
        string: 要计算的字符串
        model: 模型名称，支持 OpenAI 的模型系列

    Returns:
        int: 估计的 token 数量
    """
    if not string:
        return 0

    try:
        # 获取对应模型的编码器
        try:
            if model.startswith(("gpt-4", "gpt-3.5-turbo")):
                encoding = tiktoken.encoding_for_model(model)
            else:
                # 默认使用通用编码器
                encoding = tiktoken.get_encoding("cl100k_base")
        except Exception as enc_err:
            # 编码器获取失败，直接抛出异常使用模拟计算方法
            logger.error(f"获取编码器失败: {enc_err!s}，使用模拟计算方法")
            raise

        # 计算并返回token数量
        return len(encoding.encode(string))
    except Exception as e:
        # 记录错误日志
        logger.error(f"Token计算出错: {e!s}，使用模拟计算方法")

        # 使用自己实现的模拟计算方法
        return _simulate_token_count(string)


def _simulate_token_count(text: str) -> int:
    """
    模拟计算token数量的方法

    英文约每4个字符算1个token
    中文约每1.5个字符算1个token

    Args:
        text: 要计算的文本

    Returns:
        int: 估计的token数量
    """
    if not text:
        return 0

    # 统计中文字符数量
    chinese_char_count = sum(1 for char in text if '\u4e00' <= char <= '\u9fff')

    # 统计非中文字符数量
    non_chinese_char_count = len(text) - chinese_char_count

    # 估算token数量：中文字符/1.5 + 非中文字符/4
    estimated_tokens = int(chinese_char_count / 1.5 + non_chinese_char_count / 4)

    # 确保至少返回1个token
    return max(1, estimated_tokens)


def truncate_text_by_token(text: str, max_tokens: int) -> tuple[str, bool]:
    """
    截取文本使其不超过指定的token数量

    Args:
        text: 要截取的文本
        max_tokens: 最大token数量

    Returns:
        tuple[str, bool]: (截取后的文本, 是否被截断)
    """
    if not text:
        return "", False

    # 如果文本很短，直接返回
    if len(text) < max_tokens:
        return text, False

    # 初始化计数器和当前位置
    token_count = 0
    position = 0

    # 遍历文本字符
    for i, char in enumerate(text):
        # 增加token计数
        if '\u4e00' <= char <= '\u9fff':
            # 中文字符
            token_count += 1 / 1.5
        else:
            # 非中文字符
            token_count += 1 / 4

        # 检查是否达到最大token数
        if int(token_count) >= max_tokens:
            position = i
            break

    # 如果没有达到最大token数，表示整个文本都在限制内
    if position == 0 or position >= len(text) - 1:
        return text, False

    # 截断文本并添加省略提示
    truncated_text = text[:position] + "\n\n... [内容过长已截断] ..."
    return truncated_text, True 