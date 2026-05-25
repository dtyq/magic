from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class ImageSearchResultItem:
    """图片搜索结果项（统一格式）"""
    content_url: str
    name: str
    width: int
    height: int
    content_size: str = "0 B"  # 格式如 "123456 B"
    encoding_format: str = "image/jpeg"
    host_page_url: str = ""
    thumbnail_url: str = ""
    date_published: Optional[str] = None


class ImageSearchDriverInterface(ABC):
    """图片搜索驱动接口"""

    @abstractmethod
    def is_available(self) -> bool:
        """检查此驱动是否可用"""
        ...

    @abstractmethod
    async def search(
        self,
        query: str,
        count: int = 20,
        offset: int = 0,
    ) -> List[ImageSearchResultItem]:
        """
        执行图片搜索

        Args:
            query: 搜索查询
            count: 结果数量
            offset: 分页偏移量

        Returns:
            图片搜索结果列表
        """
        ...
