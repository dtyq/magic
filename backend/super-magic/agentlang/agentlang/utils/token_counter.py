"""
令牌计数器模块

提供用于跟踪和管理LLM令牌使用的工具
"""


class TokenCounter:
    """
    令牌计数器类，用于跟踪和管理LLM令牌使用
    """

    def __init__(self):
        """初始化令牌计数器"""
        self.input_tokens = 0
        self.output_tokens = 0
        self.total_tokens = 0

    def add_input_tokens(self, count: int) -> None:
        """
        添加输入令牌数

        Args:
            count: 输入令牌数
        """
        self.input_tokens += count
        self.total_tokens += count

    def add_output_tokens(self, count: int) -> None:
        """
        添加输出令牌数

        Args:
            count: 输出令牌数
        """
        self.output_tokens += count
        self.total_tokens += count

    def reset(self) -> None:
        """重置计数器"""
        self.input_tokens = 0
        self.output_tokens = 0
        self.total_tokens = 0

    def get_stats(self) -> dict:
        """
        获取统计信息

        Returns:
            dict: 包含输入、输出和总令牌数的字典
        """
        return {
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "total_tokens": self.total_tokens,
        } 