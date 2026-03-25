"""系统时区检测工具"""
import os
from datetime import datetime


def get_system_timezone() -> str:
    """获取当前系统时区的 IANA 名称。

    检测顺序：
    1. TZ 环境变量
    2. /etc/timezone 文件（Linux/Debian 系）
    3. /etc/localtime 软链接（macOS / Linux RedHat 系）
    4. 兜底：返回 "UTC"
    """
    # 1. TZ 环境变量
    tz = os.environ.get("TZ", "").strip()
    if tz:
        return tz

    # 2. /etc/timezone（Debian/Ubuntu）
    try:
        with open("/etc/timezone", encoding="utf-8") as f:
            tz = f.read().strip()
            if tz:
                return tz
    except OSError:
        pass

    # 3. /etc/localtime 软链接（macOS / CentOS / Arch）
    try:
        localtime_path = os.readlink("/etc/localtime")
        marker = "/zoneinfo/"
        idx = localtime_path.find(marker)
        if idx != -1:
            tz = localtime_path[idx + len(marker):]
            if tz:
                return tz
    except OSError:
        pass

    return "UTC"
