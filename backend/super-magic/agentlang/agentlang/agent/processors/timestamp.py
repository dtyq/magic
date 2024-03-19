"""时间戳语法处理器

提供 @timestamp 语法，用于生成 Unix 时间戳。

支持的参数：
- format: 时间戳格式，支持 "s"(秒)、"ms"(毫秒)、"us"(微秒)
- offset: 时间偏移量（秒）

使用示例：
- @timestamp() - 生成当前时间戳（秒）
- @timestamp("ms") - 生成毫秒时间戳
- @timestamp("s", offset=3600) - 生成1小时后的时间戳
"""

import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from agentlang.logger import get_logger

from .base import BaseSyntaxProcessor

logger = get_logger(__name__)


class TimestampProcessor(BaseSyntaxProcessor):
    """时间戳语法处理器

    生成 Unix 时间戳，支持不同格式和时间偏移。
    """

    def __init__(self, agents_dir: Optional[Path] = None):
        """初始化时间戳处理器

        Args:
            agents_dir: Agent 文件目录，用于解析相对路径
        """
        super().__init__(agents_dir)

    def get_syntax_name(self) -> str:
        """返回语法名称"""
        return "timestamp"

    def get_positional_param_mapping(self) -> List[str]:
        """返回位置参数映射"""
        return ["format", "offset"]

    def get_required_params(self) -> List[str]:
        """返回必需参数列表"""
        return []

    def get_optional_params(self) -> List[str]:
        """返回可选参数列表"""
        return ["format", "offset"]

    def _run(self) -> str:
        """处理时间戳语法

        Returns:
            str: 生成的时间戳

        Raises:
            ValueError: 参数无效
        """
        try:
            # 解析参数 - 无需手动验证，基类已完成
            format_type = self._get_parameter("format", "s")
            offset_str = self._get_parameter("offset", "0")

            # 转换偏移量为浮点数
            try:
                offset = float(offset_str)
            except ValueError:
                raise ValueError(f"无效的偏移量: {offset_str}")

            # 验证格式类型
            valid_formats = ["s", "ms", "us"]
            if format_type not in valid_formats:
                raise ValueError(f"无效的时间戳格式: {format_type}，支持的格式: {valid_formats}")

            # 获取当前时间并加上偏移
            current_time = time.time() + offset

            # 根据格式类型生成时间戳
            if format_type == "s":
                timestamp = int(current_time)
            elif format_type == "ms":
                timestamp = int(current_time * 1000)
            elif format_type == "us":
                timestamp = int(current_time * 1000000)

            result = str(timestamp)
            logger.debug(f"生成时间戳: {result} (格式: {format_type}, 偏移: {offset}秒)")
            return result

        except Exception as e:
            error_msg = f"生成时间戳失败: {e}"
            logger.error(error_msg)
            raise RuntimeError(error_msg) from e
