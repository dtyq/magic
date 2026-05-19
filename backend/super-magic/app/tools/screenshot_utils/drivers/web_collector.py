import os
from pathlib import Path
from typing import Optional

import httpx

from agentlang.config.config import config
from agentlang.logger import get_logger
from app.tools.screenshot_utils.drivers.base import ScreenshotDriverInterface, ScreenshotResultItem

logger = get_logger(__name__)


class WebCollectorScreenshotDriver(ScreenshotDriverInterface):
    """通过 web-collector /v2/screenshot 代理截图"""

    def __init__(self):
        self.base_url: str = config.get("web_collector.base_url", default="")
        self.api_token: str = config.get("web_collector.api_token", default="")

    def is_available(self) -> bool:
        return bool(self.base_url)

    async def screenshot(
        self,
        url: str,
        dest: Path,
        full_page: bool = False,
        width: int = 1280,
        height: int = 720,
        wait_for: Optional[str] = None,
        format: str = "png",
    ) -> ScreenshotResultItem:
        """调用 web-collector 截图接口，再从返回的 download_url 拉取图片"""
        api_url = f"{self.base_url.rstrip('/')}/v2/screenshot"

        headers = {}
        if self.api_token:
            headers["Authorization"] = f"Bearer {self.api_token}"

        payload = {
            "url": url,
            "full_page": full_page,
            "width": width,
            "height": height,
            "format": format,
        }
        if wait_for:
            payload["wait_for"] = wait_for

        async with httpx.AsyncClient(timeout=60) as client:
            # Step 1: 请求截图
            resp = await client.post(api_url, json=payload, headers=headers)
            if resp.status_code != 200:
                raise Exception(f"web-collector 截图失败，状态码: {resp.status_code}, 响应: {resp.text}")

            data = resp.json()
            if not data.get("success"):
                raise Exception(f"web-collector 截图失败: {data.get('error', '未知错误')}")

            download_url = data.get("download_url")
            if not download_url:
                raise Exception("web-collector 响应缺少 download_url")

            file_size = data.get("size", 0)

            # Step 2: 下载截图文件到本地
            dest.parent.mkdir(parents=True, exist_ok=True)
            tmp_path = dest.with_suffix(dest.suffix + '.tmp')
            try:
                async with client.stream("GET", download_url, headers=headers) as file_resp:
                    file_resp.raise_for_status()
                    actual_size = 0
                    with open(tmp_path, 'wb') as f:
                        async for chunk in file_resp.aiter_bytes(chunk_size=8192):
                            f.write(chunk)
                            actual_size += len(chunk)

                tmp_path.rename(dest)
                if actual_size > 0:
                    file_size = actual_size
            except Exception:
                if tmp_path.exists():
                    tmp_path.unlink()
                raise

        logger.info(f"[web_collector] 截图完成: {url} -> {dest}, size={file_size}")
        return ScreenshotResultItem(
            file_path=dest,
            format=format,
            width=width,
            height=height,
            file_size=file_size,
        )
