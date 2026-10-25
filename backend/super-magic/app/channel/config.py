"""IM 渠道凭证持久化（存储于 .workspace/.magic/config/im-channels.json）。"""
from dataclasses import dataclass, asdict, field
from enum import StrEnum
from pathlib import Path
from typing import Optional

from agentlang.logger import get_logger
from app.channel.im_channel_config_migration import (
    CURRENT_IM_CHANNEL_CONFIG_VERSION,
    apply_im_channel_config_migrations,
)
from app.path_manager import PathManager
from app.utils.async_file_utils import async_read_json, async_write_json, async_exists

logger = get_logger(__name__)

_CONFIG_FILENAME = "im-channels.json"
DEFAULT_WECHAT_CDN_BASE_URL = "https://novac2c.cdn.weixin.qq.com/c2c"


class DisabledReason(StrEnum):
    """enabled=False 时记录禁用原因，空字符串表示未知/旧数据兼容。"""
    SESSION_EXPIRED = "session_expired"
    USER_DISABLED = "user_disabled"


@dataclass
class IMChannelDisplay:
    """控制 IM 渠道向用户展示哪些内容，默认全部关闭。"""
    show_reasoning: bool = False
    show_tools: bool = False


def _config_path() -> Path:
    return PathManager.get_magic_config_dir() / _CONFIG_FILENAME


@dataclass
class WeComCredential:
    bot_id: str
    secret: str
    enabled: bool = True
    disabled_reason: str = ""
    # 绑定的话题 ID，避免不同话题抢占同一 WS 连接
    topic_id: str = ""
    display: IMChannelDisplay = field(default_factory=IMChannelDisplay)

    def __post_init__(self) -> None:
        if isinstance(self.display, dict):
            self.display = IMChannelDisplay(**self.display)


@dataclass
class DingTalkCredential:
    client_id: str
    client_secret: str
    enabled: bool = True
    disabled_reason: str = ""
    topic_id: str = ""
    display: IMChannelDisplay = field(default_factory=IMChannelDisplay)

    def __post_init__(self) -> None:
        if isinstance(self.display, dict):
            self.display = IMChannelDisplay(**self.display)


@dataclass
class LarkCredential:
    app_id: str
    app_secret: str
    enabled: bool = True
    disabled_reason: str = ""
    topic_id: str = ""
    display: IMChannelDisplay = field(default_factory=IMChannelDisplay)

    def __post_init__(self) -> None:
        if isinstance(self.display, dict):
            self.display = IMChannelDisplay(**self.display)


@dataclass
class WechatCredential:
    bot_token: str
    ilink_bot_id: str
    # getupdates 使用的域名，由 get_qrcode_status 返回
    base_url: str
    cdn_base_url: str = DEFAULT_WECHAT_CDN_BASE_URL
    ilink_user_id: str = ""
    enabled: bool = True
    disabled_reason: str = ""
    topic_id: str = ""
    display: IMChannelDisplay = field(default_factory=IMChannelDisplay)

    def __post_init__(self) -> None:
        if isinstance(self.display, dict):
            self.display = IMChannelDisplay(**self.display)


@dataclass
class IMChannelsConfig:
    wecom: Optional[WeComCredential] = None
    dingtalk: Optional[DingTalkCredential] = None
    lark: Optional[LarkCredential] = None
    wechat: Optional[WechatCredential] = None


async def load_config() -> IMChannelsConfig:
    """读取当前版本的 IM 渠道配置。"""
    path = _config_path()
    if not await async_exists(path):
        return IMChannelsConfig()
    try:
        raw_data = await async_read_json(path)
        if not isinstance(raw_data, dict):
            raise TypeError("IM channel config must be an object")
        version = raw_data.get("version")
        if version != CURRENT_IM_CHANNEL_CONFIG_VERSION:
            raise ValueError(
                f"IM channel config migration has not completed: version={version}, "
                f"expected={CURRENT_IM_CHANNEL_CONFIG_VERSION}"
            )
        data = raw_data
        return IMChannelsConfig(
            wecom=(
                WeComCredential(**_get_credential_data(data, "wecom"))
                if "wecom" in data
                else None
            ),
            dingtalk=(
                DingTalkCredential(**_get_credential_data(data, "dingtalk"))
                if "dingtalk" in data
                else None
            ),
            lark=(
                LarkCredential(**_get_credential_data(data, "lark"))
                if "lark" in data
                else None
            ),
            wechat=(
                WechatCredential(**_get_credential_data(data, "wechat"))
                if "wechat" in data
                else None
            ),
        )
    except Exception as e:
        logger.warning(f"[IMConfig] 读取配置失败，忽略: {e}")
        return IMChannelsConfig()


async def migrate_im_channel_config_for_topic(current_topic_id: str) -> None:
    """启动期将旧配置迁移到当前版本，并把旧渠道绑定到当前话题。"""
    normalized_topic_id = current_topic_id.strip()
    if not normalized_topic_id:
        raise ValueError("Current topic ID is required for IM channel config migration")

    path = _config_path()
    if not await async_exists(path):
        return

    raw_data = await async_read_json(path)
    if not isinstance(raw_data, dict):
        raise TypeError("IM channel config must be an object")

    migrated_data = apply_im_channel_config_migrations(
        raw_data,
        current_topic_id=normalized_topic_id,
    )
    if migrated_data == raw_data:
        return

    await async_write_json(path, migrated_data, indent=2, ensure_ascii=False)
    logger.info(
        f"[IMConfigMigration] 已将配置迁移到 v{CURRENT_IM_CHANNEL_CONFIG_VERSION} 并写回 {path}"
    )


async def save_config(config: IMChannelsConfig) -> None:
    """写入持久化配置。"""
    path = _config_path()
    data = {"version": CURRENT_IM_CHANNEL_CONFIG_VERSION}
    if config.wecom:
        data["wecom"] = asdict(config.wecom)
    if config.dingtalk:
        data["dingtalk"] = asdict(config.dingtalk)
    if config.lark:
        data["lark"] = asdict(config.lark)
    if config.wechat:
        data["wechat"] = asdict(config.wechat)
    await async_write_json(path, data, indent=2, ensure_ascii=False)
    logger.info(f"[IMConfig] 已保存配置到 {path}")


def _get_credential_data(data: dict[str, object], channel_key: str) -> dict[str, object]:
    """校验迁移后的单渠道凭证结构，避免把非法 JSON 传入 dataclass。"""
    raw_credential = data[channel_key]
    if not isinstance(raw_credential, dict):
        raise TypeError(f"IM channel credential must be an object: {channel_key}")
    return raw_credential
