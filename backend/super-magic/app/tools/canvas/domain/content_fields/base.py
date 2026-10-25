"""Canvas Content Fields 抽象基类。"""

from __future__ import annotations

from abc import ABC, abstractmethod
from copy import deepcopy
from dataclasses import dataclass


@dataclass
class CanvasContentFields(ABC):
    """定义所有 Content Fields 的公共行为。"""

    def clone(self) -> "CanvasContentFields":
        """返回当前 Fields 的深拷贝。"""
        return deepcopy(self)

    @property
    def generation_status(self) -> str | None:
        """返回生成状态；非生成 Content 默认没有状态。"""
        return None

    @property
    def error_message(self) -> str | None:
        """返回生成错误；非生成 Content 默认没有错误。"""
        return None

    @property
    def asset_path(self) -> str | None:
        """返回媒体路径；非媒体 Content 默认没有路径。"""
        return None

    @abstractmethod
    def to_dict(self) -> dict[str, object]:
        """转换为前端协议字段。"""
