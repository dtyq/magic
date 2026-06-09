from typing import Dict, Type

from app.tools.download_utils.drivers.base import DownloadDriverInterface
from app.tools.download_utils.drivers.direct import DirectDownloadDriver
from app.tools.download_utils.drivers.web_collector import WebCollectorDownloadDriver

DRIVERS: Dict[str, Type[DownloadDriverInterface]] = {
    "direct": DirectDownloadDriver,
    "web_collector": WebCollectorDownloadDriver,
}
