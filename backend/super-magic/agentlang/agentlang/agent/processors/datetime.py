"""日期时间语法处理器

提供 @datetime 语法，用于生成格式化的日期时间。

支持的参数：
- format: 日期时间格式字符串，默认 "%Y-%m-%d %H:%M:%S"
- timezone: 时区，如 "UTC", "Asia/Shanghai"，默认本地时区
- offset: 时间偏移量（秒），默认0

使用示例：
- @datetime() - 生成当前时间
- @datetime("%Y-%m-%d") - 生成日期格式
- @datetime(timezone="UTC") - 生成UTC时间
- @datetime(format="%H:%M:%S", offset=3600) - 生成1小时后的时间
"""

from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional
import zoneinfo

from agentlang.logger import get_logger

from .base import BaseSyntaxProcessor

logger = get_logger(__name__)


class DatetimeProcessor(BaseSyntaxProcessor):
    """日期时间语法处理器

    生成格式化的日期时间，支持时区和时间偏移。
    """

    def __init__(self, agents_dir: Optional[Path] = None):
        """初始化日期时间处理器

        Args:
            agents_dir: Agent 文件目录，用于解析相对路径
        """
        super().__init__(agents_dir)

    def get_syntax_name(self) -> str:
        """返回语法名称"""
        return "datetime"

    def get_positional_param_mapping(self) -> List[str]:
        """返回位置参数映射"""
        return ["format", "timezone", "offset"]

    def get_required_params(self) -> List[str]:
        """返回必需参数列表"""
        return []

    def get_optional_params(self) -> List[str]:
        """返回可选参数列表"""
        return ["format", "timezone", "offset"]

    def _run(self) -> str:
        """处理日期时间语法

        Returns:
            str: 格式化的日期时间字符串

        Raises:
            ValueError: 参数无效
        """
        try:
            # 解析参数 - 无需手动验证，基类已完成
            date_format = self._get_parameter("format", "%Y-%m-%d %H:%M:%S")
            timezone_name = self._get_parameter("timezone")
            offset_str = self._get_parameter("offset", "0")

            # 转换偏移量为浮点数
            try:
                offset = float(offset_str)
            except ValueError:
                raise ValueError(f"无效的偏移量: {offset_str}")

            # 获取当前时间
            now = datetime.now()

            # 应用时间偏移
            if offset != 0:
                now = now + timedelta(seconds=offset)

            # 处理时区
            if timezone_name:
                try:
                    if timezone_name.upper() == "UTC":
                        tz = timezone.utc
                    else:
                        tz = zoneinfo.ZoneInfo(timezone_name)

                    # 转换到指定时区
                    now = now.astimezone(tz)
                except Exception as e:
                    raise ValueError(f"无效的时区: {timezone_name} - {e}")

            # 格式化日期时间
            try:
                result = now.strftime(date_format)
            except Exception as e:
                raise ValueError(f"无效的日期时间格式: {date_format} - {e}")

            logger.debug(f"生成日期时间: {result} (格式: {date_format}, 时区: {timezone_name}, 偏移: {offset}秒)")
            return result

        except Exception as e:
            error_msg = f"生成日期时间失败: {e}"
            logger.error(error_msg)
            raise RuntimeError(error_msg) from e
