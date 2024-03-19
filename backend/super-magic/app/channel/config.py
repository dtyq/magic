"""IM 渠道凭证持久化（存储于 .workspace/.magic/config/im-channels.json）。"""
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional

from agentlang.logger import get_logger
from app.paths import PathManager
from app.utils.async_file_utils import async_read_json, async_write_json, async_exists

logger = get_logger(__name__)

_CONFIG_FILENAME = "im-channels.json"


def _config_path() -> Path:
    return PathManager.get_magic_config_dir() / _CONFIG_FILENAME


@dataclass
class WeComCredential:
    bot_id: str
    secret: str
    enabled: bool = True
    # 绑定的沙盒 ID，防止多沙盒同时抢占同一 WS 连接
    sandbox_id: str = ""


@dataclass
class DingTalkCredential:
    client_id: str
    client_secret: str
    enabled: bool = True
    sandbox_id: str = ""


@dataclass
class LarkCredential:
    app_id: str
    app_secret: str
    enabled: bool = True
    sandbox_id: str = ""


@dataclass
class IMChannelsConfig:
    wecom: Optional[WeComCredential] = None
    dingtalk: Optional[DingTalkCredential] = None
    lark: Optional[LarkCredential] = None


async def load_config() -> IMChannelsConfig:
    """读取持久化配置，文件不存在时返回空配置。"""
    path = _config_path()
    if not await async_exists(path):
        return IMChannelsConfig()
    try:
        data = await async_read_json(path)
        return IMChannelsConfig(
            wecom=WeComCredential(**data["wecom"]) if "wecom" in data else None,
            dingtalk=DingTalkCredential(**data["dingtalk"]) if "dingtalk" in data else None,
            lark=LarkCredential(**data["lark"]) if "lark" in data else None,
        )
    except Exception as e:
        logger.warning(f"[IMConfig] 读取配置失败，忽略: {e}")
        return IMChannelsConfig()


async def save_config(config: IMChannelsConfig) -> None:
    """写入持久化配置。"""
    path = _config_path()
    data = {}
    if config.wecom:
        data["wecom"] = asdict(config.wecom)
    if config.dingtalk:
        data["dingtalk"] = asdict(config.dingtalk)
    if config.lark:
        data["lark"] = asdict(config.lark)
    await async_write_json(path, data, indent=2, ensure_ascii=False)
    logger.info(f"[IMConfig] 已保存配置到 {path}")
