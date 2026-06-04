import json
from pathlib import Path

import httpx

from agentlang.config.config import config
from agentlang.logger import get_logger
from app.tools.driver_log_utils import redact_headers, to_log_text
from app.tools.download_utils.drivers.base import DownloadDriverInterface, DownloadResultItem
from app.tools.web_scrape_utils.drivers.web_collector import AccessDeniedException

logger = get_logger(__name__)


class WebCollectorDownloadDriver(DownloadDriverInterface):
    """通过 web-collector 服务代理下载"""

    def __init__(self):
        self.base_url: str = config.get("web_collector.base_url", default="")
        self.api_token: str = config.get("web_collector.api_token", default="")

    def is_available(self) -> bool:
        return bool(self.base_url)

    async def download(self, url: str, dest: Path, timeout: int = 15) -> DownloadResultItem:
        """通过 web-collector /v2/download 代理下载"""
        return await self._do_download(url, dest, timeout)

    async def _do_download(self, url: str, dest: Path, timeout_seconds: int) -> DownloadResultItem:
        """调用 web-collector 下载接口，再从返回的 download_url 拉取文件"""
        api_url = f"{self.base_url.rstrip('/')}/v2/download"

        headers = {}
        if self.api_token:
            headers["Authorization"] = f"Bearer {self.api_token}"

        payload = {"url": url, "timeout": timeout_seconds}

        logger.info(
            f"[WebCollectorDownloadDriver] request POST {api_url} "
            f"json={to_log_text(payload)} headers={to_log_text(redact_headers(headers))}"
        )

        async with httpx.AsyncClient(timeout=timeout_seconds + 10) as client:
            # Step 1: 请求 web-collector 下载
            resp = await client.post(api_url, json=payload, headers=headers)
            logger.info(f"[WebCollectorDownloadDriver] response status={resp.status_code}")
            if resp.status_code != 200:
                logger.error(
                    f"[WebCollectorDownloadDriver] response error status={resp.status_code} "
                    f"body={to_log_text(resp.text)}"
                )
                # 解析错误响应，对 ACCESS_DENIED 抛出专用异常
                try:
                    error_data = json.loads(resp.text)
                    if error_data.get("error_code") == "ACCESS_DENIED":
                        raise AccessDeniedException(error_data.get("error", "当前访问被限制，请联系管理员"))
                except (json.JSONDecodeError, KeyError):
                    pass
                raise Exception(f"web-collector 下载失败，状态码: {resp.status_code}, 响应: {resp.text}")

            data = resp.json()
            logger.info(f"[WebCollectorDownloadDriver] response body={to_log_text(data)}")
            if not data.get("success"):
                raise Exception(f"web-collector 下载失败: {data.get('error', '未知错误')}")

            download_url = data.get("download_url")
            if not download_url:
                raise Exception("web-collector 响应缺少 download_url")

            content_type = data.get("content_type", "application/octet-stream")
            file_size = data.get("file_size", 0)
            final_url = data.get("url", url)

            # Step 2: 从 download_url 拉取文件到本地
            tmp_path = dest.with_suffix(dest.suffix + '.tmp')
            try:
                logger.info(f"[WebCollectorDownloadDriver] request GET {to_log_text(download_url)}")
                async with client.stream("GET", download_url, headers=headers) as file_resp:
                    logger.info(f"[WebCollectorDownloadDriver] file response status={file_resp.status_code}")
                    file_resp.raise_for_status()
                    actual_size = 0
                    with open(tmp_path, 'wb') as f:
                        async for chunk in file_resp.aiter_bytes(chunk_size=8192):
                            f.write(chunk)
                            actual_size += len(chunk)

                tmp_path.rename(dest)
                # 用实际下载大小覆盖（更准确）
                if actual_size > 0:
                    file_size = actual_size
            except Exception:
                if tmp_path.exists():
                    tmp_path.unlink()
                raise

        logger.info(f"[web_collector] 下载完成: {url} -> {dest}, size={file_size}")
        return DownloadResultItem(
            file_path=dest,
            content_type=content_type,
            file_size=file_size,
            final_url=final_url,
        )
