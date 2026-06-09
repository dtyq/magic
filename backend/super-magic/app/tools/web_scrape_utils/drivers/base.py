from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class WebScrapeResultItem:
    """网页抓取结果项"""
    markdown: str
    site_name: str = ""
    logo: Optional[str] = None
    image_list: List[str] = field(default_factory=list)
    usage: Dict[str, int] = field(default_factory=dict)


class WebScrapeDriverInterface(ABC):
    """网页抓取驱动接口"""

    @abstractmethod
    def is_available(self) -> bool:
        """检查此驱动是否可用"""
        ...

    @abstractmethod
    async def scrape(self, url: str) -> WebScrapeResultItem:
        """
        抓取网页并返回 Markdown 内容

        Args:
            url: 目标网页 URL

        Returns:
            WebScrapeResultItem: 抓取结果

        Raises:
            Exception: 抓取失败
        """
        ...

    @abstractmethod
    async def fallback_scrape(self, url: str) -> WebScrapeResultItem:
        """
        降级抓取：当主抓取检测到反爬后，使用备选方式重新抓取

        Args:
            url: 目标网页 URL

        Returns:
            WebScrapeResultItem: 抓取结果

        Raises:
            RuntimeError: 降级抓取不可用或失败
        """
        ...
