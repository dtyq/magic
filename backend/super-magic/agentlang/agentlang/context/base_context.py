"""
基础上下文类

定义所有上下文类型的共同接口和基本功能
"""

import time
from typing import Any, Dict


class BaseContext:
    """
    基础上下文类，提供上下文数据的管理功能
    """

    def __init__(self):
        """
        初始化基础上下文
        """
        self._metadata = {}
        self._created_at = int(time.time() * 1000)  # 创建时间戳（毫秒）

    def to_dict(self) -> Dict[str, Any]:
        """
        将上下文转换为字典格式

        Returns:
            Dict[str, Any]: 上下文的字典表示
        """
        # 基类只返回元数据和创建时间
        result = {"_created_at": self._created_at, **self._metadata}
        return result

    def set_metadata(self, key: str, value: Any) -> None:
        """
        设置元数据

        Args:
            key: 元数据键
            value: 元数据值
        """
        self._metadata[key] = value

    def get_metadata(self, key: str, default: Any = None) -> Any:
        """
        获取元数据

        Args:
            key: 元数据键
            default: 如果键不存在时返回的默认值

        Returns:
            Any: 元数据值或默认值
        """
        return self._metadata.get(key, default)

    def update_metadata(self, metadata: Dict[str, Any]) -> None:
        """
        批量更新元数据

        Args:
            metadata: 要更新的元数据字典
        """
        self._metadata.update(metadata)

    def get_creation_time(self) -> int:
        """
        获取上下文创建时间

        Returns:
            int: 创建时间戳（毫秒）
        """
        return self._created_at

    def merge(self, other: "BaseContext") -> None:
        """
        合并另一个上下文的数据

        Args:
            other: 要合并的上下文对象
        """
        self._metadata.update(other._metadata) 