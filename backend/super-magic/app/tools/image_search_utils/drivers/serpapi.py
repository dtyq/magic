from typing import List

import aiohttp

from agentlang.config.config import config
from agentlang.logger import get_logger
from agentlang.utils.metadata import MetadataUtil
from app.tools.image_search_utils.drivers.base import ImageSearchDriverInterface, ImageSearchResultItem

logger = get_logger(__name__)


class SerpApiImageSearchDriver(ImageSearchDriverInterface):
    """SerpApi (Google Images) 图片搜索驱动"""

    def __init__(self):
        self.api_key = config.get("serpapi.api_key", default="")
        self.endpoint = config.get("serpapi.api_endpoint", default="https://serpapi.com")

    def is_available(self) -> bool:
        return bool(self.api_key)

    async def search(
        self,
        query: str,
        count: int = 20,
        offset: int = 0,
    ) -> List[ImageSearchResultItem]:
        search_url = f"{self.endpoint.rstrip('/')}/search.json"
        headers = {}
        MetadataUtil.add_magic_and_user_authorization_headers(headers)

        params = {
            "engine": "google_images_light",
            "q": query,
            "api_key": self.api_key,
            "device": "mobile",
            "hl": "en",
            "gl": "us",
            "start": offset,
        }
        results: List[ImageSearchResultItem] = []

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(search_url, params=params, headers=headers) as response:
                    response.raise_for_status()
                    data = await response.json()

            image_values = data.get("images_results", [])

            for img in image_values:
                width = img.get("original_width", 0)
                height = img.get("original_height", 0)
                if width == 0 or height == 0:
                    width = 1024
                    height = 768

                results.append(ImageSearchResultItem(
                    content_url=img.get("original", img.get("link", "")),
                    name=img.get("title", f"Image {len(results) + 1}"),
                    width=width,
                    height=height,
                    content_size="0 B",  # SerpApi 不提供文件大小
                    encoding_format="image/jpeg",
                    host_page_url=img.get("link", ""),
                    thumbnail_url=img.get("thumbnail", img.get("serpapi_thumbnail", "")),
                ))

        except Exception as e:
            logger.error(f"SerpApi Image Search 请求失败: {e}")

        return results
