"""通用图片搜索适配器。"""

from app.tools.canvas.production.ports.image_search_port import (
    ImageSearchCandidate,
    ImageSearchPort,
    ImageSearchRequest,
)


class GenericImageSearchPort(ImageSearchPort):
    """连接现有通用图片搜索驱动，不承担 Canvas 写入。"""

    async def search(self, request: ImageSearchRequest) -> list[ImageSearchCandidate]:
        """调用当前配置的图片搜索驱动并收窄返回字段。"""
        from app.tools.image_search_utils.driver_factory import get_image_search_driver

        items = await get_image_search_driver().search(request.query, count=request.count)
        return [
            ImageSearchCandidate(item.content_url, item.name, item.width, item.height, item.host_page_url)
            for item in items
            if item.content_url
        ]
