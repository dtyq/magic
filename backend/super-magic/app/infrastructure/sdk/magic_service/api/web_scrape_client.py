"""
WebScrape 客户端

提供第三方网页爬取 API 的客户端封装，用作反爬虫场景下的降级方案
"""

import httpx
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

from agentlang.logger import get_logger
from agentlang.utils.metadata import MetadataUtil

logger = get_logger(__name__)


class WebScrapeResponse(BaseModel):
    """WebScrape 响应数据模型"""
    markdown: str = Field(..., description="网页文markdown内容")
    site_name: str = Field(default="", description="网站名称")
    logo: Optional[str] = Field(None, description="网站Logo URL")
    image_list: list = Field(default_factory=list, description="页面图片列表")
    usage: Dict[str, int] = Field(default_factory=dict, description="API使用量统计")


class WebScrapeClient:
    """
    WebScrape 客户端

    用于在无头浏览器遇到反爬虫时，使用第三方 API 获取网页内容

    Example:
        ```python
        client = WebScrapeClient(
            endpoint="https://api.example.com/read",
            token="your_token"
        )

        response = await client.fetch_webpage("https://example.com")
        print(response.markdown)
        print(response.usage)  # 查看API使用量
        ```
    """

    def __init__(
        self,
        endpoint: str,
        token: str,
        timeout: int = 30,
        mode: str = "quality"
    ):
        """
        初始化 WebScrape 客户端

        Args:
            endpoint: API端点URL
            token: 认证Token
            timeout: 请求超时时间(秒)
            mode: 抓取模式 (quality/speed)
        """
        self.endpoint = endpoint
        self.token = token
        self.timeout = timeout
        self.mode = mode

        logger.info(f"WebScrapeClient 已初始化 - Endpoint: {endpoint}, Mode: {mode}")

    async def fetch_webpage(
        self,
        url: str,
        mode: Optional[str] = None
    ) -> WebScrapeResponse:
        """
        使用 WebScrape 获取网页内容

        Args:
            url: 目标网页URL
            mode: 抓取模式 (quality/speed)，如果不提供则使用初始化时的默认值

        Returns:
            WebScrapeResponse: 格式化后的响应数据

        Raises:
            httpx.HTTPError: HTTP 请求失败
            ValueError: 响应数据格式无效
        """
        fetch_mode = mode or self.mode

        logger.info(f"WebScrape 开始获取: {url} (mode: {fetch_mode})")

        try:
            headers = {
                "api-key": self.token,
                "Content-Type": "application/json"
            }
            # 动态设置最新的 metadata 到请求头（每次调用都获取最新值）
            extra_headers = MetadataUtil.get_llm_request_headers()
            if extra_headers:
                # 给headers请求头塞入extra_headers
                headers.update(extra_headers)
                logger.info(f"互联网搜索动态设置请求头: {list(extra_headers.keys())}")

            # 添加 Magic-Authorization 与 User-Authorization 认证头
            MetadataUtil.add_magic_and_user_authorization_headers(headers)
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.endpoint,
                    headers=headers,
                    json={
                        "url": url,
                        "formats": ["MARKDOWN"],
                        "mode": fetch_mode
                    },
                    timeout=self.timeout
                )

                # 检查HTTP状态码
                response.raise_for_status()

                # 解析响应数据
                response_data = response.json()

                # 验证响应结构
                if not response_data.get("success"):
                    raise ValueError(f"API 返回失败: {response_data.get('message', '未知错误')}")

                if "data" not in response_data or "content" not in response_data["data"]:
                    raise ValueError("API响应格式无效：缺少 data.content 字段")

                content = response_data["data"]["content"]

                # 验证必需字段
                if "markdown" not in content:
                    raise ValueError("API响应缺少必需的 'markdown' 字段")

                # 构建响应对象
                response = WebScrapeResponse(
                    markdown=content.get("markdown", ""),
                    site_name=content.get("site_name", ""),
                    logo=content.get("logo"),
                    image_list=content.get("image_list", []),
                    usage=content.get("usage", {})
                )

                logger.info(
                    f"WebScrape 获取成功: {url} - "
                    f"内容长度: {len(response.markdown)} 字符, "
                    f"Usage: {response.usage}"
                )

                return response

        except httpx.HTTPStatusError as e:
            logger.error(
                f"WebScrape HTTP 错误: {url} - "
                f"状态码: {e.response.status_code}, "
                f"响应: {e.response.text[:200]}"
            )
            raise
        except httpx.TimeoutException:
            logger.error(f"WebScrape 请求超时: {url} (timeout: {self.timeout}s)")
            raise
        except httpx.RequestError as e:
            logger.error(f"WebScrape 请求失败: {url} - {e}")
            raise
        except ValueError as e:
            logger.error(f"WebScrape 响应格式无效: {url} - {e}")
            raise
        except Exception as e:
            logger.error(f"WebScrape 未知错误: {url} - {e}", exc_info=True)
            raise
