"""IM 渠道启动期编排。"""
from agentlang.logger import get_logger

from app.channel.base.registry import build_default_channel_registry
from app.channel.config import load_config, migrate_im_channel_config_for_topic
from app.utils.init_client_message_util import InitClientMessageUtil

logger = get_logger(__name__)


async def auto_connect_channels_for_current_topic() -> None:
    """启动时按当前话题绑定关系触发 IM 渠道自动连接。"""
    current_topic_id = InitClientMessageUtil.get_topic_id()
    if not current_topic_id:
        logger.warning("[IMConfig] 当前初始化配置缺少 topic_id，跳过自动连接")
        return

    await migrate_im_channel_config_for_topic(current_topic_id)
    config = await load_config()
    for channel in build_default_channel_registry().get_all():
        credential = getattr(config, channel.key, None)
        if credential is None or not credential.enabled:
            continue

        if not credential.topic_id:
            logger.warning(f"[IMConfig] {channel.label}配置缺少 topic_id，跳过自动连接")
            continue

        if credential.topic_id != current_topic_id:
            logger.info(
                f"[IMConfig] {channel.label}绑定的话题({credential.topic_id})"
                f"与当前话题({current_topic_id})不符，跳过自动连接"
            )
            continue

        try:
            started = await channel.start_from_config(config)
            if started:
                logger.info(f"[IMConfig] 已为{channel.label}提交自动连接请求")
        except Exception as e:
            logger.warning(f"[IMConfig] 自动连接{channel.label}失败: {e}")


async def auto_connect_channels_for_current_sandbox() -> None:
    """兼容旧内部调用，实际按当前话题绑定关系自动连接。"""
    await auto_connect_channels_for_current_topic()
