"""magic-service 图片生成驱动

通过 magic-service API 的 /images/generation-tasks 端点异步生成图片。
"""

import asyncio
import dataclasses
import json
import re
import time
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
    ImageTaskCreatedCallback,
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

    _BASE64_IMAGE_PATTERN = re.compile(
        r"^data:(?P<mime_type>image/[^;]+);base64,(?P<data>.*)$",
        re.DOTALL,
    )
    _POLL_INTERVAL_SECONDS = 5
    _POLL_TIMEOUT_SECONDS = 560

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

    @classmethod
    def _sanitize_payload_for_log(cls, payload: dict) -> dict:
        """脱敏请求中的 Base64 图片，避免日志记录完整图片内容。"""
        sanitized = dict(payload)
        sanitized["images"] = [
            cls._sanitize_image_for_log(image)
            for image in payload.get("images", [])
        ]
        return sanitized

    @classmethod
    def _sanitize_image_for_log(cls, image: str) -> str | dict[str, object]:
        """将 Base64 Data URL 转换为仅包含类型和长度的日志摘要。"""
        match = cls._BASE64_IMAGE_PATTERN.match(image)
        if match is None:
            return image
        return {
            "type": "base64_image",
            "mime_type": match.group("mime_type"),
            "base64_length": len(match.group("data")),
        }

    @staticmethod
    def _parse_time_field(response_data: dict, key: str) -> Optional[str]:
        """从任务响应里取非空时间字符串。"""
        value = response_data.get(key)
        return value if isinstance(value, str) and value else None

    async def _call_api(
        self,
        payload: _ImageApiPayload,
        on_task_created: Optional[ImageTaskCreatedCallback] = None,
    ) -> list[str]:
        """调用 magic-service 异步图片生成 API，轮询完成后返回图片 URL 列表。

        任务创建成功后立即回调 on_task_created：发起时间与预期完成时间只在创建响应里有，
        而本方法要轮询到任务结束才返回，所以必须在此刻把这一对值交出去 —— 前端就是靠
        这两个绝对时刻算进度百分比。
        """
        url = f"{self._api_base_url.rstrip('/')}/images/generation-tasks"
        headers = self._build_api_headers()
        payload_dict = dataclasses.asdict(payload)

        sanitized_payload = self._sanitize_payload_for_log(payload_dict)
        logger.info(
            f"提交 magic-service 图片生成任务: {url}, payload: {sanitized_payload}"
        )

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
                    f"magic-service 图片生成任务提交响应: {json.dumps({'headers': dict(response.headers), 'body': response_data}, ensure_ascii=False)}"
                )
                if not isinstance(response_data, dict):
                    raise Exception(
                        f"Unexpected generation task response format. "
                        f"Expected dict, got: {type(response_data).__name__}"
                    )

                task_id = str(response_data.get("id") or "").strip()
                if not task_id:
                    raise ValueError("magic-service image generation task response missing id")

                if on_task_created is not None:
                    await on_task_created(
                        task_id,
                        self._parse_time_field(response_data, "expected_finished_at"),
                        # 兼容尚未返回 started_at 的旧接口。
                        self._parse_time_field(response_data, "started_at")
                        or self._parse_time_field(response_data, "created_at"),
                    )

            poll_started_at = time.monotonic()
            deadline = poll_started_at + self._POLL_TIMEOUT_SECONDS
            query_url = f"{self._api_base_url.rstrip('/')}/images/generation-tasks/{task_id}"
            last_logged_status: str | None = None

            try:
                while True:
                    async with session.get(
                        query_url, headers=headers, timeout=300
                    ) as response:
                        if response.status != 200:
                            error_text = await response.text()
                            raise Exception(
                                f"Generation task query failed, status code: {response.status}, error: {error_text}"
                            )

                        task_data = await response.json()
                        if not isinstance(task_data, dict):
                            raise Exception(
                                f"Unexpected generation task query response format. "
                                f"Expected dict, got: {type(task_data).__name__}"
                            )

                    status = str(task_data.get("status") or "").strip().lower()
                    if status != last_logged_status:
                        logger.info(
                            f"magic-service 图片生成任务查询响应: {json.dumps({'task_id': task_id, 'body': task_data}, ensure_ascii=False)}"
                        )
                        last_logged_status = status

                    if status == "failed":
                        error = task_data.get("error") if isinstance(task_data.get("error"), dict) else {}
                        code = error.get("code")
                        message = error.get("message") or "image generation failed"
                        raise Exception(f"Image generation task failed: {message} (code={code})")

                    if status == "succeeded":
                        response_payload = task_data.get("response")
                        if not isinstance(response_payload, dict):
                            raise Exception("Image generation task succeeded without response payload")

                        if "data" not in response_payload:
                            raise Exception(
                                f"Unexpected API response format. Expected dict with 'data' key. "
                                f"Response: {str(response_payload)[:200]}"
                            )

                        provider_error_code = response_payload.get("provider_error_code")
                        provider_error_message = response_payload.get("provider_error_message") or "unknown provider error"
                        if provider_error_code:
                            sanitized_message = re.sub(
                                r"https?://[^\s`'\"]+",
                                "[hidden]",
                                provider_error_message,
                            )
                            raise ImageGenerationProviderError(
                                f"Image generation rejected by provider (code={provider_error_code}): {sanitized_message}",
                                provider_error_code=provider_error_code,
                            )

                        data_array = response_payload.get("data", [])
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

                    if time.monotonic() >= deadline:
                        raise TimeoutError(
                            f"Image generation task polling timeout after {self._POLL_TIMEOUT_SECONDS}s: {task_id}"
                        )

                    await asyncio.sleep(self._POLL_INTERVAL_SECONDS)
            except asyncio.CancelledError:
                # 用户终止任务 / 转向时，轮询协程会被直接取消：这条路径既不抛 TimeoutError 也不留
                # 异常栈，不记日志就完全无从排查「画布一直转圈」到底是 provider 慢还是协程被丢弃。
                # 画布元素的终态由调用方（GenerationSubmissionService）收敛。
                logger.warning(
                    f"magic-service 图片生成轮询被取消（任务未收敛，交由调用方写终态）: "
                    f"task_id={task_id}, 已等待 {time.monotonic() - poll_started_at:.1f}s, "
                    f"超时上限 {self._POLL_TIMEOUT_SECONDS}s"
                )
                raise

    async def generate(
        self,
        request: ImageGenerationRequest,
        on_task_created: Optional[ImageTaskCreatedCallback] = None,
    ) -> ImageGenerationResponse:
        """调用 magic-service 异步图片生成 API，下载到临时文件后返回。"""
        payload = _ImageApiPayload(
            model=request.model,
            prompt=request.prompt,
            size=request.size,
            images=request.reference_image_urls,
            n=1,
        )

        image_urls = await self._call_api(payload, on_task_created)
        if not image_urls:
            raise ValueError("API returned no image URLs")

        return ImageGenerationResponse(images=await self._download_images(image_urls))
