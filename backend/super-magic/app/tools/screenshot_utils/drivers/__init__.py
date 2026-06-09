from typing import Dict, Type

from app.tools.screenshot_utils.drivers.base import ScreenshotDriverInterface
from app.tools.screenshot_utils.drivers.browser import BrowserScreenshotDriver
from app.tools.screenshot_utils.drivers.web_collector import WebCollectorScreenshotDriver

DRIVERS: Dict[str, Type[ScreenshotDriverInterface]] = {
    "browser": BrowserScreenshotDriver,
    "web_collector": WebCollectorScreenshotDriver,
}
