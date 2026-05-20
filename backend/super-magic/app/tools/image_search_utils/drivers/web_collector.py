from typing import List

import aiohttp

from agentlang.config.config import config
from agentlang.logger import get_logger
from app.tools.driver_log_utils import redact_headers, to_log_text
from app.tools.image_search_utils.drivers.base import ImageSearchDriverInterface, ImageSearchResultItem

logger = get_logger(__name__)


class WebCollectorImageSearchDriver(ImageSearchDriverInterface):
    """Web Collector 图片搜索驱动（调用独立的 web-collector 服务）"""

    def __init__(self):
        self.base_url = config.get("web_collector.base_url", "")
        self.api_token = config.get("web_collector.api_token", "")

    def is_available(self) -> bool:
        return bool(self.base_url)

    async def search(
        self,
        query: str,
        count: int = 20,
        offset: int = 0,
    ) -> List[ImageSearchResultItem]:
        search_url = f"{self.base_url.rstrip('/')}/v2/image-search"

        params = {
            "q": query,
            "count": count,
            "offset": offset,
        }

        headers = {
            "Accept": "application/json",
        }
        if self.api_token:
            headers["Authorization"] = f"Bearer {self.api_token}"

        logger.info(
            f"[WebCollectorImageSearchDriver] request GET {search_url} "
            f"params={to_log_text(params)} headers={to_log_text(redact_headers(headers))}"
        )

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(search_url, headers=headers, params=params) as response:
                    logger.info(f"[WebCollectorImageSearchDriver] response status={response.status}")
                    if response.status != 200:
                        error_detail = await response.text()
                        logger.error(
                            f"[WebCollectorImageSearchDriver] response error status={response.status} "
                            f"body={to_log_text(error_detail)}"
                        )
                        logger.error(f"Web Collector Image Search 请求失败: {response.status} {error_detail}")
                        return []

                    data = await response.json()
                    logger.info(f"[WebCollectorImageSearchDriver] response body={to_log_text(data)}")

                    images = data.get("images", {})
                    image_values = images.get("value", [])

                    results = []
                    for img in image_values:
                        results.append(ImageSearchResultItem(
                            content_url=img.get("content_url", img.get("contentUrl", "")),
                            name=img.get("name", ""),
                            width=img.get("width", 0),
                            height=img.get("height", 0),
                            content_size=img.get("content_size", img.get("contentSize", "0 B")),
                            encoding_format=img.get("encoding_format", img.get("encodingFormat", "image/jpeg")),
                            host_page_url=img.get("host_page_url", img.get("hostPageUrl", "")),
                            thumbnail_url=img.get("thumbnail_url", img.get("thumbnailUrl", "")),
                            date_published=img.get("date_published", img.get("datePublished")),
                        ))

                    return results
        except Exception as e:
            logger.error(f"Web Collector Image Search 请求异常: {e}")
            return []
