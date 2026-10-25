"""Fake 图片搜索端口。"""

from app.tools.canvas.production.ports.image_search_port import (
    ImageSearchCandidate,
    ImageSearchPort,
    ImageSearchRequest,
)


class FakeImageSearchPort(ImageSearchPort):
    """返回注入的 mock 搜索候选。"""

    def __init__(self, candidates: list[ImageSearchCandidate] | None = None) -> None:
        """保存固定候选。"""
        self._candidates = candidates or [ImageSearchCandidate("https://mock.invalid/image.png", "mock image", 800, 600)]

    async def search(self, request: ImageSearchRequest) -> list[ImageSearchCandidate]:
        """按 count 截取固定候选。"""
        return self._candidates[: request.count]
