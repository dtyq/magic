"""平台 CLI 状态探测实现集合。"""

from app.service.cli_status.providers.dws import DwsCliStatusProbe
from app.service.cli_status.providers.lark import LarkCliStatusProbe

__all__ = [
    "DwsCliStatusProbe",
    "LarkCliStatusProbe",
]
