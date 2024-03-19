"""UUID语法处理器

提供 @uuid 语法，用于生成 UUID。

支持的参数：
- version: UUID版本，支持 1 或 4，默认 4
- uppercase: 是否大写，默认 False
- no_hyphens: 是否移除连字符，默认 False

使用示例：
- @uuid() - 生成UUID4
- @uuid(version=1) - 生成UUID1
- @uuid(uppercase=true) - 生成大写UUID
- @uuid(no_hyphens=true) - 生成无连字符UUID
"""

import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from agentlang.logger import get_logger

from .base import BaseSyntaxProcessor

logger = get_logger(__name__)


class UuidProcessor(BaseSyntaxProcessor):
    """UUID语法处理器

    生成 UUID，支持不同版本和格式选项。
    """

    def __init__(self, agents_dir: Optional[Path] = None):
        """初始化UUID处理器

        Args:
            agents_dir: Agent 文件目录，用于解析相对路径
        """
        super().__init__(agents_dir)

    def get_syntax_name(self) -> str:
        """返回语法名称"""
        return "uuid"

    def get_positional_param_mapping(self) -> List[str]:
        """返回位置参数映射"""
        return ["version", "uppercase", "no_hyphens"]

    def get_required_params(self) -> List[str]:
        """返回必需参数列表"""
        return []

    def get_optional_params(self) -> List[str]:
        """返回可选参数列表"""
        return ["version", "uppercase", "no_hyphens"]

    def _run(self) -> str:
        """处理UUID语法

        Returns:
            str: 生成的UUID字符串

        Raises:
            ValueError: 参数无效
        """
        try:
            # 解析参数 - 无需手动验证，基类已完成
            version_str = self._get_parameter("version", "4")
            uppercase_str = self._get_parameter("uppercase", "false")
            no_hyphens_str = self._get_parameter("no_hyphens", "false")

            # 转换参数类型
            try:
                version = int(version_str)
            except ValueError:
                raise ValueError(f"无效的版本号: {version_str}")

            # 处理布尔参数，支持多种类型
            def parse_bool(value):
                if isinstance(value, bool):
                    return value
                elif isinstance(value, str):
                    lower_value = value.lower()
                    if lower_value in ('true', '1', 'yes', 'on'):
                        return True
                    elif lower_value in ('false', '0', 'no', 'off'):
                        return False
                    else:
                        raise ValueError(f"无效的布尔值: {value}")
                else:
                    return bool(value)

            uppercase = parse_bool(uppercase_str)
            no_hyphens = parse_bool(no_hyphens_str)

            # 验证版本
            if version not in [1, 4]:
                raise ValueError(f"不支持的UUID版本: {version}，支持的版本: 1, 4")

            # 生成UUID
            if version == 1:
                generated_uuid = uuid.uuid1()
            else:  # version == 4
                generated_uuid = uuid.uuid4()

            # 转换为字符串
            uuid_str = str(generated_uuid)

            # 应用格式选项
            if no_hyphens:
                uuid_str = uuid_str.replace("-", "")

            if uppercase:
                uuid_str = uuid_str.upper()

            logger.debug(f"生成UUID: {uuid_str} (版本: {version}, 大写: {uppercase}, 无连字符: {no_hyphens})")
            return uuid_str

        except Exception as e:
            error_msg = f"生成UUID失败: {e}"
            logger.error(error_msg)
            raise RuntimeError(error_msg) from e
