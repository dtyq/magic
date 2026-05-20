from typing import List

import aiohttp

from agentlang.config.config import config
from agentlang.logger import get_logger
from agentlang.utils.metadata import MetadataUtil
from app.tools.driver_log_utils import redact_headers, to_log_text
from app.tools.image_search_utils.drivers.base import ImageSearchDriverInterface, ImageSearchResultItem

logger = get_logger(__name__)


class BingImageSearchDriver(ImageSearchDriverInterface):
    """Bing 图片搜索驱动"""

    def __init__(self):
        self.api_key = config.get("bing.search_api_key", default="")
        self.endpoint = config.get("bing.search_endpoint", default="https://api.bing.microsoft.com/v7.0")

    def is_available(self) -> bool:
        return bool(self.api_key)

    async def search(
        self,
        query: str,
        count: int = 20,
        offset: int = 0,
    ) -> List[ImageSearchResultItem]:
        base_endpoint = self.endpoint.rstrip('/')
        image_search_url = f"{base_endpoint}/images/search"
        headers = {"Ocp-Apim-Subscription-Key": self.api_key}
        MetadataUtil.add_magic_and_user_authorization_headers(headers)

        params = {"q": query, "count": count, "offset": offset}
        results: List[ImageSearchResultItem] = []

        logger.info(
            f"[BingImageSearchDriver] request GET {image_search_url} "
            f"params={to_log_text(params)} headers={to_log_text(redact_headers(headers))}"
        )

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(image_search_url, headers=headers, params=params) as response:
                    logger.info(f"[BingImageSearchDriver] response status={response.status}")
                    response.raise_for_status()
                    data = await response.json()
                    logger.info(f"[BingImageSearchDriver] response body={to_log_text(data)}")

            image_values = data.get("value", [])

            for img in image_values:
                results.append(ImageSearchResultItem(
                    content_url=img.get("contentUrl", ""),
                    name=img.get("name", ""),
                    width=img.get("width", 0),
                    height=img.get("height", 0),
                    content_size=img.get("contentSize", "0 B"),
                    encoding_format=img.get("encodingFormat", "image/jpeg"),
                    host_page_url=img.get("hostPageUrl", ""),
                    thumbnail_url=img.get("thumbnailUrl", ""),
                    date_published=img.get("datePublished"),
                ))

        except Exception as e:
            logger.error(f"Bing Image Search API 请求失败: {e}")

        return results
