from pathlib import Path
from urllib.parse import urlparse

import aiohttp
import asyncio

from agentlang.logger import get_logger
from app.tools.driver_log_utils import redact_headers, to_log_text
from app.tools.download_utils.drivers.base import DownloadDriverInterface, DownloadResultItem
from app.tools.webview_utils import IMAGE_DOWNLOAD_HEADERS

logger = get_logger(__name__)

# 可重试的 HTTP 状态码
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
# 最大重试次数
MAX_RETRIES = 3
# 重试基础间隔（秒）
RETRY_BASE_DELAY = 1.0


class DirectDownloadDriver(DownloadDriverInterface):
    """直接 HTTP 下载驱动"""

    def is_available(self) -> bool:
        return True

    async def download(self, url: str, dest: Path, timeout: int = 15) -> DownloadResultItem:
        """通过 aiohttp 直接下载文件，带重试"""
        last_error = None
        for attempt in range(MAX_RETRIES):
            try:
                return await self._do_download(url, dest, timeout)
            except RetryableDownloadError as e:
                last_error = e
                if attempt < MAX_RETRIES - 1:
                    delay = RETRY_BASE_DELAY * (2 ** attempt)
                    logger.warning(f"[direct] 下载可重试错误 (第{attempt + 1}次): {url}, 错误: {e}, {delay}s 后重试")
                    await asyncio.sleep(delay)
                    continue
            except (asyncio.TimeoutError, aiohttp.ServerTimeoutError, aiohttp.ClientConnectionError) as e:
                # 网络抖动 / 对端慢响应 / 短暂连接重置等也归入可重试范畴
                last_error = e
                if attempt < MAX_RETRIES - 1:
                    delay = RETRY_BASE_DELAY * (2 ** attempt)
                    logger.warning(
                        f"[direct] 下载网络错误 (第{attempt + 1}次): {url}, "
                        f"类型: {type(e).__name__}, 错误: {e!s}, {delay}s 后重试"
                    )
                    await asyncio.sleep(delay)
                    continue
            except Exception:
                raise
        raise last_error

    async def _do_download(self, url: str, dest: Path, timeout_seconds: int) -> DownloadResultItem:
        """执行实际的 HTTP 下载"""
        aio_timeout = aiohttp.ClientTimeout(total=timeout_seconds)

        # 构建请求头：模拟浏览器 + 同域名 Referer 防盗链
        headers = IMAGE_DOWNLOAD_HEADERS.copy()
        parsed_url = urlparse(url)
        if parsed_url.netloc and parsed_url.scheme:
            headers["Referer"] = f"{parsed_url.scheme}://{parsed_url.netloc}/"

        logger.info(
            f"[DirectDownloadDriver] request GET {to_log_text(url)} "
            f"headers={to_log_text(redact_headers(headers))}"
        )

        async with aiohttp.ClientSession(timeout=aio_timeout) as session:
            async with session.get(url, allow_redirects=True, headers=headers) as response:
                logger.info(f"[DirectDownloadDriver] response status={response.status}")
                # 可重试的状态码
                if response.status in RETRYABLE_STATUS_CODES:
                    raise RetryableDownloadError(
                        f"HTTP {response.status} {response.reason}"
                    )

                if response.status != 200:
                    raise Exception(f"下载失败，HTTP状态码: {response.status}, 原因: {response.reason}")

                final_url = str(response.url)
                content_type = response.headers.get('Content-Type', 'application/octet-stream')
                expected_size = response.content_length  # 可能为 None
                logger.info(
                    "[DirectDownloadDriver] response meta "
                    f"content_type={to_log_text(content_type)} expected_size={expected_size}"
                )

                # 写入临时文件再 rename（原子操作）
                tmp_path = dest.with_suffix(dest.suffix + '.tmp')
                try:
                    file_size = 0
                    with open(tmp_path, 'wb') as f:
                        async for chunk in response.content.iter_chunked(8192):
                            f.write(chunk)
                            file_size += len(chunk)

                    # Content-Length 校验：确保下载完整
                    if expected_size is not None and file_size != expected_size:
                        raise RetryableDownloadError(
                            f"下载不完整: 期望 {expected_size} 字节, 实际 {file_size} 字节"
                        )

                    tmp_path.rename(dest)
                except Exception:
                    if tmp_path.exists():
                        tmp_path.unlink()
                    raise

        logger.info(f"[direct] 下载完成: {url} -> {dest}, size={file_size}")
        return DownloadResultItem(
            file_path=dest,
            content_type=content_type,
            file_size=file_size,
            final_url=final_url,
        )


class RetryableDownloadError(Exception):
    """可重试的下载错误"""
    pass
