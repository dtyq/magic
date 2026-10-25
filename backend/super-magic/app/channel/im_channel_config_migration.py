"""IM 渠道配置的版本化链式迁移。

历史配置没有显式版本号，统一视为 v1。每次配置结构变化时：
1. 在本文件新增一个命名明确的 `migrate_vN_to_vN_plus_1_*` 函数；
2. 将函数注册到 `_MIGRATIONS`；
3. 将 `CURRENT_IM_CHANNEL_CONFIG_VERSION` 递增一位。

迁移只负责把旧 JSON 规范化为当前内存结构，不负责文件读写。
"""
from collections.abc import Callable

from agentlang.logger import get_logger

logger = get_logger(__name__)

LEGACY_UNVERSIONED_CONFIG_VERSION = 1
CURRENT_IM_CHANNEL_CONFIG_VERSION = 2
CONFIG_VERSION_FIELD = "version"

ConfigMigration = Callable[[dict[str, object], str], dict[str, object]]

_CHANNEL_KEYS = ("wecom", "dingtalk", "lark", "wechat")


def migrate_v1_to_v2_replace_sandbox_binding_with_topic_binding(
    data: dict[str, object],
    current_topic_id: str,
) -> dict[str, object]:
    """v1 → v2：把旧沙箱绑定迁移为首次加载该配置的话题绑定。

    v1 没有根版本号，各渠道凭证使用 `sandbox_id`。新版本首次启动时，调用方必须
    传入当前 INIT 的稳定 `topic_id`；迁移会把所有缺少 `topic_id` 的旧渠道凭证绑定
    到该话题，使同一次启动可以继续自动连接，并立即由配置层写回 v2 文件。

    这是明确的 v1 升级规则：project 级共享配置中的旧 IM 凭证由首次加载它的话题
    接管。该规则用于保证线上旧沙箱升级后无感恢复，不需要用户重新连接渠道。
    """
    migrated = dict(data)

    for channel_key in _CHANNEL_KEYS:
        raw_credential = migrated.get(channel_key)
        if not isinstance(raw_credential, dict):
            continue

        credential = dict(raw_credential)
        topic_id = str(credential.get("topic_id") or "").strip()
        if not topic_id:
            if not current_topic_id:
                raise ValueError(
                    f"Current topic ID is required to migrate legacy {channel_key} channel binding"
                )
            credential["topic_id"] = current_topic_id
        credential.pop("sandbox_id", None)
        migrated[channel_key] = credential

    migrated[CONFIG_VERSION_FIELD] = 2
    return migrated


_MIGRATIONS: dict[int, ConfigMigration] = {
    1: migrate_v1_to_v2_replace_sandbox_binding_with_topic_binding,
}


def apply_im_channel_config_migrations(
    raw_data: dict[str, object],
    *,
    current_topic_id: str = "",
) -> dict[str, object]:
    """按版本顺序将 IM 渠道配置迁移到当前版本。"""
    data = dict(raw_data)
    version = _read_config_version(data)

    while version < CURRENT_IM_CHANNEL_CONFIG_VERSION:
        migration = _MIGRATIONS.get(version)
        if migration is None:
            raise ValueError(f"Missing IM channel config migration: v{version} -> v{version + 1}")

        logger.info(f"[IMConfigMigration] 执行 v{version} → v{version + 1} 配置迁移")
        data = migration(data, current_topic_id)
        version = _read_config_version(data)

    return data


def _read_config_version(data: dict[str, object]) -> int:
    raw_version = data.get(CONFIG_VERSION_FIELD, LEGACY_UNVERSIONED_CONFIG_VERSION)
    if isinstance(raw_version, bool) or not isinstance(raw_version, int):
        raise ValueError(f"Invalid IM channel config version: {raw_version}")
    if not LEGACY_UNVERSIONED_CONFIG_VERSION <= raw_version <= CURRENT_IM_CHANNEL_CONFIG_VERSION:
        raise ValueError(f"Unsupported IM channel config version: {raw_version}")
    return raw_version
