"""环境变量语法处理器

提供 @env 语法，用于获取环境变量。

支持的参数：
- key: 环境变量名称（必需）
- default: 默认值（可选）

使用示例：
- @env("API_KEY")
- @env("API_KEY", "default_value")
- @env(key="API_KEY", default="default_value")
"""

import os
from typing import List, Optional
from pathlib import Path

from agentlang.logger import get_logger

from .base import BaseSyntaxProcessor

logger = get_logger(__name__)


class EnvProcessor(BaseSyntaxProcessor):
    """@env 语法处理器

    用于获取环境变量的值。
    """

    def __init__(self, agents_dir: Optional[Path] = None):
        """初始化环境变量处理器

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
        """处理环境变量语法

        Returns:
            str: 环境变量的值

        Raises:
            ValueError: 环境变量不存在且未提供默认值
        """
        try:
            # 获取参数 - 无需手动验证，基类已完成
            env_key = self._get_parameter("key")
            default_value = self._get_parameter("default")

            logger.debug(f"获取环境变量: {env_key}")

            # 获取环境变量值
            env_value = os.environ.get(env_key)

            if env_value is not None:
                logger.debug(f"环境变量 {env_key} 存在")
                return env_value
            elif default_value is not None:
                logger.debug(f"环境变量 {env_key} 不存在，使用默认值")
                return default_value
            else:
                raise ValueError(f"环境变量 {env_key} 不存在且未提供默认值")

        except Exception as e:
            if isinstance(e, ValueError):
                raise
            error_msg = f"获取环境变量失败: {e}"
            logger.error(error_msg)
            raise RuntimeError(error_msg) from e

    def get_syntax_name(self) -> str:
        """返回语法名称"""
        return "env"
