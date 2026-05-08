"""部署环境检测工具

通过 init_client_message 中的 magic_service_host 域名判断当前是否为 SaaS 环境。
SaaS 域名特征：包含 letsmagic.cn / magicrew.ai / teamshare.cn。
非 SaaS（私有化部署）：其他域名，客户将产品包装为自研，不注入任何引导信息。
"""
from urllib.parse import urlparse

from agentlang.logger import get_logger

logger = get_logger(__name__)

# SaaS 国际站地址
SAAS_INTERNATIONAL_SITE_URL = "https://www.magicrew.ai"

# SaaS 环境域名后缀列表
_SAAS_DOMAIN_SUFFIXES = (
    "letsmagic.cn",
    "magicrew.ai",
    "teamshare.cn",
)


def is_saas_deployment() -> bool:
    """判断当前是否为 SaaS 环境。

    通过 init_client_message.json 中的 magic_service_host 域名判断。
    域名包含已知 SaaS 后缀则为 SaaS 环境，否则视为私有化部署。
    读取失败时保守返回 False（不注入引导语）。
    """
    try:
        from app.utils.init_client_message_util import InitClientMessageUtil
        host_url = InitClientMessageUtil.get_magic_service_host()
    except Exception as e:
        logger.warning(f"无法获取 magic_service_host，默认非 SaaS 环境: {e}")
        return False

    try:
        hostname = urlparse(host_url).hostname or ""
    except Exception:
        hostname = ""

    hostname_lower = hostname.lower()
    for suffix in _SAAS_DOMAIN_SUFFIXES:
        if hostname_lower == suffix or hostname_lower.endswith("." + suffix):
            logger.debug(f"检测到 SaaS 环境: {hostname}")
            return True

    logger.debug(f"非 SaaS 环境（私有化部署）: {hostname}")
    return False
