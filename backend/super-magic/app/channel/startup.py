"""IM 渠道启动期编排。"""
from agentlang.logger import get_logger

from app.channel.base.registry import build_default_channel_registry
from app.channel.config import load_config
from app.utils.init_client_message_util import InitClientMessageUtil

logger = get_logger(__name__)


async def auto_connect_channels_for_current_sandbox() -> None:
    """启动时按当前沙盒绑定关系触发 IM 渠道自动连接。"""
    current_sandbox_id = InitClientMessageUtil.get_sandbox_id()

    config = await load_config()
    for channel in build_default_channel_registry().get_all():
        credential = getattr(config, channel.key, None)
        if credential is None or not credential.enabled:
            continue

        if not credential.sandbox_id:
            logger.warning(f"[IMConfig] {channel.label}配置缺少 sandbox_id，跳过自动连接")
            continue

        if credential.sandbox_id != current_sandbox_id:
            logger.info(
                f"[IMConfig] {channel.label}绑定的沙盒({credential.sandbox_id})"
                f"与当前沙盒({current_sandbox_id})不符，跳过自动连接"
            )
            continue

        try:
            started = await channel.start_from_config(config)
            if started:
                logger.info(f"[IMConfig] 已为{channel.label}提交自动连接请求")
        except Exception as e:
            logger.warning(f"[IMConfig] 自动连接{channel.label}失败: {e}")
