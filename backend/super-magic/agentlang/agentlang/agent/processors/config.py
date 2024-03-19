"""配置语法处理器

提供 @config 语法，用于获取配置值。

支持的参数：
- key: 配置键名称（必需）
- default: 默认值（可选）

使用示例：
- @config("model.temperature")
- @config("model.temperature", "0.7")
- @config(key="model.temperature", default="0.7")
"""

from typing import Any, List, Optional
from pathlib import Path

from agentlang.config import config
from agentlang.logger import get_logger

from .base import BaseSyntaxProcessor

logger = get_logger(__name__)


class ConfigProcessor(BaseSyntaxProcessor):
    """@config 语法处理器

    用于获取配置值。
    """

    def __init__(self, agents_dir: Optional[Path] = None):
        """初始化配置处理器

        Args:
            agents_dir: Agent文件目录，用于解析相对路径
        """
        super().__init__(agents_dir)

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
        """处理配置语法

        Returns:
            str: 配置值

        Raises:
            ValueError: 配置不存在且未提供默认值
        """
        try:
            # 获取参数 - 无需手动验证，基类已完成
            config_key = self._get_parameter("key")
            default_value = self._get_parameter("default")

            logger.debug(f"获取配置: {config_key}")

            # 直接使用 config.get() 方法，它已经支持点分隔键名
            config_value = config.get(config_key, default_value)

            if config_value is not None:
                logger.debug(f"配置 {config_key} 值为: {config_value}")
                return str(config_value)
            else:
                raise ValueError(f"配置 {config_key} 不存在且未提供默认值")

        except Exception as e:
            if isinstance(e, ValueError):
                raise
            error_msg = f"获取配置失败: {e}"
            logger.error(error_msg)
            raise RuntimeError(error_msg) from e

    def get_syntax_name(self) -> str:
        """返回语法名称"""
        return "config"
