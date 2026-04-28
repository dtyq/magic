"""视频来源处理器：负责将各类视频来源解析为可传给 LLM 的 URL 或 base64 data URL。"""

import asyncio
import base64
import re
from pathlib import Path
from typing import List

from agentlang.logger import get_logger
from app.tools.media_utils import (
    BatchMediaResolveResults,
    MediaResolveResult,
    generate_presigned_url,
)
from app.utils.async_file_utils import async_read_bytes, async_stat

logger = get_logger(__name__)

# 视频文件扩展名到 MIME 类型的映射
VIDEO_MIME_MAP = {
    "mp4": "video/mp4",
    "avi": "video/x-msvideo",
    "mov": "video/quicktime",
    "mkv": "video/x-matroska",
    "webm": "video/webm",
    "flv": "video/x-flv",
    "wmv": "video/x-ms-wmv",
    "m4v": "video/x-m4v",
}

# 本地视频 base64 编码大小上限（MB）
LOCAL_FILE_BASE64_MAX_MB = 20.0


class VideoProcessor:
    """视频来源处理器。

    负责将 URL 或本地文件路径解析为可传给 LLM 的 URL 或 base64 data URL，
    并提供批量并发解析能力。
    """

    async def resolve_all(self, sources: List[str]) -> BatchMediaResolveResults:
        """并发解析所有视频来源。

        Args:
            sources: 视频来源列表（URL 或本地路径）

        Returns:
            BatchMediaResolveResults: 包含每个来源解析结果的批量对象
        """
        tasks = [self.resolve_video(source) for source in sources]
        raw_results = await asyncio.gather(*tasks, return_exceptions=True)

        batch = BatchMediaResolveResults()
        for i, raw in enumerate(raw_results):
            source = sources[i]
            if isinstance(raw, Exception):
                logger.warning(f"解析视频 {source} 时发生异常: {raw}")
                batch.results.append(MediaResolveResult(source=source, error=str(raw)))
            elif isinstance(raw, MediaResolveResult):
                batch.results.append(raw)
            else:
                batch.results.append(
                    MediaResolveResult(source=source, error=f"未知结果类型: {type(raw)}")
                )

        logger.info(
            f"视频解析完成，总数: {len(sources)}，"
            f"成功: {batch.success_count}，失败: {batch.failed_count}"
        )
        return batch

    async def resolve_video(self, video: str) -> MediaResolveResult:
        """将单个视频来源解析为可传给 LLM 的 URL 或 base64 data URL。

        策略：
        - HTTP/HTTPS URL：直接使用，LLM 调用失败时由 LLMRequestHandler 负责 fallback
        - 本地文件路径：先生成预签名 URL；失败后读取文件编码为 base64（不超过大小限制）

        Args:
            video: 视频来源（URL 或本地路径）

        Returns:
            MediaResolveResult
        """
        source = video.strip()

        if re.match(r'^https?://', source):
            logger.debug(f"视频来源为 HTTP URL: {source}")
            return MediaResolveResult(source=source, resolved_url=source)

        # 本地文件路径：先尝试预签名 URL，失败后 base64 编码
        try:
            presigned_url = await generate_presigned_url(source)
            logger.info(f"本地视频已生成预签名 URL: {source}")
            return MediaResolveResult(source=source, resolved_url=presigned_url)
        except Exception as url_error:
            logger.warning(f"本地文件预签名 URL 失败: {url_error}，尝试 base64 编码: {source}")

        try:
            b64_url = await self.local_file_to_base64(source)
            logger.info(f"本地视频已编码为 base64: {source}")
            return MediaResolveResult(source=source, resolved_url=b64_url)
        except Exception as b64_error:
            logger.error(f"本地视频 base64 编码失败: {b64_error}: {source}")
            return MediaResolveResult(source=source, error=str(b64_error))

    async def local_file_to_base64(
        self,
        file_path: str,
        max_size_mb: float = LOCAL_FILE_BASE64_MAX_MB,
    ) -> str:
        """将本地视频文件编码为 base64 data URL。

        Args:
            file_path: 本地文件路径
            max_size_mb: 允许编码的最大文件大小（MB），超过时抛出异常

        Returns:
            str: base64 data URL，格式为 data:<mime>;base64,<data>

        Raises:
            ValueError: 文件大小超过限制时抛出
        """
        stat = await async_stat(file_path)
        file_size_mb = stat.st_size / (1024 * 1024)
        if file_size_mb > max_size_mb:
            raise ValueError(
                f"视频文件 {Path(file_path).name} 大小为 {file_size_mb:.1f}MB，"
                f"超过 base64 编码限制 {max_size_mb:.0f}MB，请使用可公开访问的 URL"
            )

        file_content = await async_read_bytes(file_path)
        b64_data = base64.b64encode(file_content).decode("utf-8")
        ext = Path(file_path).suffix.lower().lstrip(".")
        mime_type = VIDEO_MIME_MAP.get(ext, "video/mp4")
        return f"data:{mime_type};base64,{b64_data}"

    async def download_and_encode_base64(self, url: str, timeout: int = 600) -> str:
        """下载远程视频并编码为 base64 data URL。

        Args:
            url: 视频 HTTP/HTTPS URL
            timeout: 下载超时时间（秒）

        Returns:
            str: base64 data URL
        """
        import httpx
        async with httpx.AsyncClient(timeout=float(timeout), follow_redirects=True) as client:
            response = await client.get(url)
            response.raise_for_status()
            content_type = response.headers.get("content-type", "video/mp4").split(";")[0].strip()
            b64_data = base64.b64encode(response.content).decode("utf-8")
            return f"data:{content_type};base64,{b64_data}"
