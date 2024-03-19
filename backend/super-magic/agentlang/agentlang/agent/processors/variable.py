"""变量语法处理器

提供 @variable 语法，用于获取变量值。

支持的参数：
- key: 变量名称（必需）
- default: 默认值（可选）

使用示例：
- @variable("user_name")
- @variable("user_name", "guest")
- @variable(key="user_name", default="guest")
"""

from typing import Any, Dict, List, Optional
from pathlib import Path

from agentlang.logger import get_logger

from .base import BaseSyntaxProcessor

logger = get_logger(__name__)


class VariableProcessor(BaseSyntaxProcessor):
    """@variable 语法处理器

    用于获取上下文变量的值。
    """

    def __init__(self, agents_dir: Optional[Path] = None, variables: Optional[Dict[str, Any]] = None):
        """初始化变量处理器

        Args:
            agents_dir: Agent文件目录，用于解析相对路径
            variables: 初始变量字典
        """
        super().__init__(agents_dir)
        self.variables = variables or {}

    def get_positional_param_mapping(self) -> List[str]:
        """返回位置参数映射：第一个参数对应key，第二个对应default"""
        return ["key", "default"]

    def get_required_params(self) -> List[str]:
        """返回必需参数列表"""
        return ["key"]

    def get_optional_params(self) -> List[str]:
        """返回可选参数列表"""
        return ["default"]

    def _run(self) -> str:
        """处理变量语法

        Returns:
            str: 变量值

        Raises:
            ValueError: 变量不存在且未提供默认值
        """
        try:
            # 获取参数 - 无需手动验证，基类已完成
            var_key = self._get_parameter("key")
            default_value = self._get_parameter("default")

            logger.debug(f"获取变量: {var_key}")

            # 获取变量值
            if var_key in self.variables:
                var_value = self.variables[var_key]
                logger.debug(f"变量 {var_key} 存在")
                return str(var_value)
            elif default_value is not None:
                logger.debug(f"变量 {var_key} 不存在，使用默认值")
                return default_value
            else:
                raise ValueError(f"变量 {var_key} 不存在且未提供默认值")

        except Exception as e:
            if isinstance(e, ValueError):
                raise
            error_msg = f"获取变量失败: {e}"
            logger.error(error_msg)
            raise RuntimeError(error_msg) from e

    def update_variables(self, variables: Optional[Dict[str, Any]]):
        """更新变量字典

        Args:
            variables: 新的变量字典
        """
        self.variables = variables or {}
        logger.debug(f"更新变量字典，共 {len(self.variables)} 个变量")

    def get_syntax_name(self) -> str:
        """返回语法名称"""
        return "variable"
