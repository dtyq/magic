import os
from typing import List

import aiohttp

from agentlang.logger import get_logger
from agentlang.utils.metadata import MetadataUtil
from app.tools.driver_log_utils import redact_headers, to_log_text
from app.tools.image_search_utils.drivers.base import ImageSearchDriverInterface, ImageSearchResultItem

logger = get_logger(__name__)


class MagicImageSearchDriver(ImageSearchDriverInterface):
    """Magic 图片搜索驱动"""

    def __init__(self):
        self.api_key = os.getenv("MAGIC_API_KEY", "")
        base_url = os.getenv("MAGIC_API_SERVICE_BASE_URL", "")
        self.endpoint = f"{base_url}/v2/image-search" if base_url else ""

    def is_available(self) -> bool:
        return bool(self.api_key and self.endpoint)

    async def search(
        self,
        query: str,
        count: int = 20,
        offset: int = 0,
    ) -> List[ImageSearchResultItem]:
        headers = {"api-key": self.api_key}
        MetadataUtil.add_magic_and_user_authorization_headers(headers)
        extra_headers = MetadataUtil.get_llm_request_headers()
        if extra_headers:
            headers.update(extra_headers)

        params = {"q": query, "count": count, "offset": offset}
        results: List[ImageSearchResultItem] = []

        logger.info(
            f"[MagicImageSearchDriver] request GET {self.endpoint} "
            f"params={to_log_text(params)} headers={to_log_text(redact_headers(headers))}"
        )

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.endpoint, headers=headers, params=params) as response:
                    logger.info(f"[MagicImageSearchDriver] response status={response.status}")
                    response.raise_for_status()
                    data = await response.json()
                    logger.info(f"[MagicImageSearchDriver] response body={to_log_text(data)}")

            images = data.get("images", {})
            image_values = images.get("value", [])

            for img in image_values:
                # Magic API 返回 snake_case，需要映射
                content_size_raw = img.get("content_size", img.get("contentSize", "0 B"))
                results.append(ImageSearchResultItem(
                    content_url=img.get("content_url", img.get("contentUrl", "")),
                    name=img.get("name", ""),
                    width=img.get("width", 0),
                    height=img.get("height", 0),
                    content_size=content_size_raw if isinstance(content_size_raw, str) else f"{content_size_raw} B",
                    encoding_format=img.get("encoding_format", img.get("encodingFormat", "image/jpeg")),
                    host_page_url=img.get("host_page_url", img.get("hostPageUrl", "")),
                    thumbnail_url=img.get("thumbnail_url", img.get("thumbnailUrl", "")),
                    date_published=img.get("date_published", img.get("datePublished")),
                ))

        except Exception as e:
            logger.error(f"Magic Image Search API 请求失败: {e}")

        return results
