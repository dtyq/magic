"""随机值语法处理器

提供 @random 语法，用于生成随机数和随机字符串。

支持的参数：
- type: 随机值类型，"int"(整数)、"float"(浮点数)、"string"(字符串)，默认"int"
- min: 最小值（用于数值类型），默认0
- max: 最大值（用于数值类型），默认100
- length: 字符串长度（用于字符串类型），默认8
- charset: 字符集，"letters"(字母)、"digits"(数字)、"alphanumeric"(字母数字)、"all"(所有可见字符)，默认"alphanumeric"

使用示例：
- @random() - 生成0-100的随机整数
- @random("int", 1, 10) - 生成1-10的随机整数
- @random("float", 0.0, 1.0) - 生成0.0-1.0的随机浮点数
- @random(type="int", min=1, max=10) - 使用命名参数生成1-10的随机整数
- @random("string", length=12) - 生成12位随机字符串
- @random("string", length=6, charset="digits") - 生成6位数字字符串

注意：为了向后兼容，仍然支持 min_val 和 max_val 参数
"""

import random
import string
from pathlib import Path
from typing import Any, Dict, List, Optional

from agentlang.logger import get_logger

from .base import BaseSyntaxProcessor

logger = get_logger(__name__)


class RandomProcessor(BaseSyntaxProcessor):
    """随机值语法处理器

    生成随机数和随机字符串，支持多种类型和参数配置。
    """

    def __init__(self, agents_dir: Optional[Path] = None):
        """初始化随机值处理器

        Args:
            agents_dir: Agent 文件目录，用于解析相对路径
        """
        super().__init__(agents_dir)

        # 定义字符集
        self._charsets = {
            "letters": string.ascii_letters,
            "digits": string.digits,
            "alphanumeric": string.ascii_letters + string.digits,
            "all": string.ascii_letters + string.digits + string.punctuation
        }

    def get_syntax_name(self) -> str:
        """返回语法名称"""
        return "random"

    def get_positional_param_mapping(self) -> List[str]:
        """返回位置参数映射"""
        return ["type", "min", "max", "length", "charset"]

    def get_required_params(self) -> List[str]:
        """返回必需参数列表"""
        return []

    def get_optional_params(self) -> List[str]:
        """返回可选参数列表"""
        return ["type", "min", "max", "min_val", "max_val", "length", "charset"]

    def _run(self) -> str:
        """处理随机值语法

        Returns:
            str: 生成的随机值字符串

        Raises:
            ValueError: 参数无效
        """
        try:
            # 解析参数 - 无需手动验证，基类已完成
            value_type = self._get_parameter("type", "int")

            # 验证类型
            valid_types = ["int", "float", "string"]
            if value_type not in valid_types:
                raise ValueError(f"无效的随机值类型: {value_type}，支持的类型: {valid_types}")

            # 根据类型生成随机值
            if value_type == "int":
                result = self._generate_random_int()
            elif value_type == "float":
                result = self._generate_random_float()
            else:  # value_type == "string"
                result = self._generate_random_string()

            logger.debug(f"生成随机值: {result} (类型: {value_type})")
            return result

        except Exception as e:
            error_msg = f"生成随机值失败: {e}"
            logger.error(error_msg)
            raise RuntimeError(error_msg) from e

    def _generate_random_int(self) -> str:
        """生成随机整数

        Returns:
            str: 随机整数字符串
        """
        # 优先使用新的参数名，向后兼容旧的参数名
        min_val_str = self._get_parameter("min") or self._get_parameter("min_val", "0")
        max_val_str = self._get_parameter("max") or self._get_parameter("max_val", "100")

        try:
            min_val = int(min_val_str)
            max_val = int(max_val_str)
        except ValueError as e:
            raise ValueError(f"无效的数值参数: {e}")

        if min_val > max_val:
            raise ValueError(f"最小值不能大于最大值: min={min_val}, max={max_val}")

        return str(random.randint(min_val, max_val))

    def _generate_random_float(self) -> str:
        """生成随机浮点数

        Returns:
            str: 随机浮点数字符串
        """
        # 优先使用新的参数名，向后兼容旧的参数名
        min_val_str = self._get_parameter("min") or self._get_parameter("min_val", "0.0")
        max_val_str = self._get_parameter("max") or self._get_parameter("max_val", "1.0")

        try:
            min_val = float(min_val_str)
            max_val = float(max_val_str)
        except ValueError as e:
            raise ValueError(f"无效的数值参数: {e}")

        if min_val > max_val:
            raise ValueError(f"最小值不能大于最大值: min={min_val}, max={max_val}")

        return str(random.uniform(min_val, max_val))

    def _generate_random_string(self) -> str:
        """生成随机字符串

        Returns:
            str: 随机字符串
        """
        length_str = self._get_parameter("length", "8")
        charset_name = self._get_parameter("charset", "alphanumeric")

        try:
            length = int(length_str)
        except ValueError:
            raise ValueError(f"无效的长度参数: {length_str}")

        if length <= 0:
            raise ValueError(f"字符串长度必须大于0: {length}")

        if charset_name not in self._charsets:
            raise ValueError(f"无效的字符集: {charset_name}，支持的字符集: {list(self._charsets.keys())}")

        charset = self._charsets[charset_name]
        return ''.join(random.choice(charset) for _ in range(length))
