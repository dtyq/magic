import os
from pathlib import Path
from typing import Optional

from agentlang.logger import get_logger
from app.tools.screenshot_utils.drivers.base import ScreenshotDriverInterface, ScreenshotResultItem
from magic_use.magic_browser import MagicBrowser, MagicBrowserConfig

logger = get_logger(__name__)


class BrowserScreenshotDriver(ScreenshotDriverInterface):
    """本地 MagicBrowser 截图驱动"""

    def is_available(self) -> bool:
        return True

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
        """使用 MagicBrowser 打开页面并截图"""
        # 确保目标目录存在
        dest.parent.mkdir(parents=True, exist_ok=True)

        browser = await MagicBrowser.create(MagicBrowserConfig())
        try:
            # 导航到目标 URL
            await browser.goto(url)

            # 获取活跃页面
            page_id = await browser.get_active_page_id()
            if not page_id:
                raise Exception("无法获取浏览器活跃页面")

            page = await browser.get_page_by_id(page_id)
            if not page:
                raise Exception("无法获取页面对象")

            # 设置视窗大小
            await page.set_viewport_size({"width": width, "height": height})

            # 等待页面加载
            try:
                await page.wait_for_load_state("networkidle", timeout=10000)
            except Exception:
                pass

            # 等待指定选择器（可选）
            if wait_for:
                try:
                    await page.wait_for_selector(wait_for, timeout=5000)
                except Exception:
                    pass

            # 截图
            await page.screenshot(path=str(dest), full_page=full_page, type=format)
        finally:
            await browser.close()

        file_size = os.path.getsize(dest) if dest.exists() else 0

        logger.info(f"[browser] 截图完成: {url} -> {dest}, size={file_size}")
        return ScreenshotResultItem(
            file_path=dest,
            format=format,
            width=width,
            height=height,
            file_size=file_size,
        )
