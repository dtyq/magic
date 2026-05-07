"""magic-service 图片生成驱动

通过 magic-service API 的 /images/generations 和 /images/edits 端点生成图片。
"""

import dataclasses
import json
import re
from dataclasses import dataclass
from typing import List, Optional

import aiohttp

from agentlang.logger import get_logger
from agentlang.utils.metadata import MetadataUtil
from app.tools.media_generator.base import (
    BaseImageGeneratorHandler,
    ImageGenerationProviderError,
    ImageGenerationRequest,
    ImageGenerationResponse,
)
from app.utils.credential_utils import sanitize_headers

logger = get_logger(__name__)


@dataclass
class _ImageApiPayload:
    """magic-service 图片生成 API 请求体"""

    model: str
    prompt: str
    images: List[str]
    n: int
    size: Optional[str] = None
    sequential_image_generation: str = "auto"


class MagicServiceHandler(BaseImageGeneratorHandler):
    """magic-service 图片生成驱动"""

    def __init__(self, api_base_url: str, access_key: str) -> None:
        super().__init__()
        self._api_base_url = api_base_url
        self._access_key = access_key

    @property
    def name(self) -> str:
        return "magic_service"

    def is_available(self) -> bool:
        return bool(self._api_base_url and self._access_key)

    def _build_api_headers(self) -> dict[str, str]:
        """构建 magic-service 请求头（Content-Type、api-key、Magic-* 元数据）。"""
        headers: dict[str, str] = {
            "Content-Type": "application/json",
            "api-key": self._access_key,
        }
        MetadataUtil.add_magic_and_user_authorization_headers(headers)

        if MetadataUtil.is_initialized():
            metadata = MetadataUtil.get_metadata()
            if task_id := metadata.get("super_magic_task_id"):
                headers["Magic-Task-Id"] = task_id
            if topic_id := metadata.get("topic_id"):
                headers["Magic-Topic-Id"] = topic_id
            if chat_topic_id := metadata.get("chat_topic_id"):
                headers["Magic-Chat-Topic-Id"] = chat_topic_id
            if language := metadata.get("language"):
                headers["Magic-Language"] = language

        logger.debug(
            f"构建的 API 请求头: {json.dumps(sanitize_headers(headers), ensure_ascii=False)}"
        )
        return headers

    async def _call_api(self, endpoint: str, payload: _ImageApiPayload) -> list[str]:
        """
        调用 magic-service 图片生成 API，返回图片 URL 列表。
        支持新格式响应（{"created": ..., "data": [...], "usage": {...}}）。
        """
        url = f"{self._api_base_url.rstrip('/')}/images/{endpoint}"
        headers = self._build_api_headers()
        payload_dict = dataclasses.asdict(payload)

        logger.info(f"调用 magic-service API: {url}, payload: {payload_dict}")

        async with aiohttp.ClientSession() as session:
            async with session.post(
                url, json=payload_dict, headers=headers, timeout=300
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(
                        f"API request failed, status code: {response.status}, error: {error_text}"
                    )

                response_data = await response.json()
                logger.info(
                    f"magic-service API response: {json.dumps({'headers': dict(response.headers), 'body': response_data}, ensure_ascii=False)}"
                )

                if isinstance(response_data, dict) and "data" in response_data:
                    # 优先检查 provider 级别的明确错误（内容审核、参数非法等），此类错误不应重试
                    provider_error_code = response_data.get("provider_error_code")
                    provider_error_message = response_data.get("provider_error_message") or "unknown provider error"
                    if provider_error_code:
                        # 过滤掉错误信息中的真实 URL，避免暴露内部服务地址
                        sanitized_message = re.sub(
                            r"https?://[^\s`'\"]+",
                            "[hidden]",
                            provider_error_message,
                        )
                        raise ImageGenerationProviderError(
                            f"Image generation rejected by provider (code={provider_error_code}): {sanitized_message}",
                            provider_error_code=provider_error_code,
                        )

                    data_array = response_data.get("data", [])
                    image_urls = [
                        item["url"]
                        for item in data_array
                        if isinstance(item, dict) and "url" in item
                    ]
                    if not image_urls:
                        raise Exception(
                            "Image generation service returned no image URLs. "
                            "This is a transient service error; retry the same request once."
                        )
                    logger.info(f"成功解析 {len(image_urls)} 个图片 URL")
                    return image_urls

                raise Exception(
                    f"Unexpected API response format. Expected dict with 'data' key, "
                    f"got: {type(response_data).__name__}. Response: {str(response_data)[:200]}"
                )

    async def generate(self, request: ImageGenerationRequest) -> ImageGenerationResponse:
        """调用 magic-service API 生成图片，下载到临时文件后返回。"""
        endpoint = "edits" if request.reference_image_urls else "generations"

        payload = _ImageApiPayload(
            model=request.model,
            prompt=request.prompt,
            size=request.size,
            images=request.reference_image_urls,
            n=1,
        )

        image_urls = await self._call_api(endpoint, payload)
        if not image_urls:
            raise ValueError("API returned no image URLs")

        return ImageGenerationResponse(images=await self._download_images(image_urls))
