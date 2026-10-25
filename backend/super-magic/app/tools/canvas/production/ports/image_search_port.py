"""图片搜索端口。"""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class ImageSearchRequest:
    """描述一项图片搜索请求。"""

    query: str
    count: int
    expected_aspect_ratio: str | None = None
    requirement_explanation: str | None = None


@dataclass(frozen=True)
class ImageSearchCandidate:
    """描述一个可下载的图片候选。"""

    content_url: str
    name: str
    width: int
    height: int
    host_page_url: str | None = None


class ImageSearchPort(ABC):
    """定义搜索服务和 Canvas 物化之间的边界。"""

    @abstractmethod
    async def search(self, request: ImageSearchRequest) -> list[ImageSearchCandidate]:
        """返回搜索候选，不写入 Canvas。"""
