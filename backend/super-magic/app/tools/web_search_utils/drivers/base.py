from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class SearchResultItem:
    """搜索结果项"""
    title: str
    link: str
    snippet: str = ""
    domain: str = ""
    icon_url: str = ""


class SearchDriverInterface(ABC):
    """搜索驱动接口"""

    @abstractmethod
    def is_available(self) -> bool:
        """检查此驱动是否可用（API key 是否配置、服务是否可达等）"""
        ...

    @abstractmethod
    async def search(
        self,
        query: str,
        limit: int = 10,
        offset: int = 0,
        language: str = "zh-CN",
        region: str = "CN",
        time_period: Optional[str] = None,
    ) -> List[SearchResultItem]:
        """
        执行搜索

        Args:
            query: 搜索查询
            limit: 结果数量
            offset: 分页偏移量
            language: 搜索语言
            region: 搜索区域
            time_period: 时间范围 (day/week/month/year)

        Returns:
            搜索结果列表
        """
        ...
