"""沙箱环境检测工具。"""

from agentlang.logger import get_logger

logger = get_logger(__name__)


async def is_magiclaw_sandbox() -> bool:
    """判断当前沙箱是否为 magiclaw（Claw）模式。

    优先读取 agent_config.json（由 chat 消息持久化写入），
    兜底读取 last_dispatch_message.json 中的 agent_mode。
    首次启动时两者都不存在 → 返回 False（首次启动也不会有 IM 凭证配置）。
    """
    from app.path_manager import PathManager
    from app.utils.async_file_utils import async_exists, async_try_read_json

    # 优先：agent_config.json
    agent_config_file = PathManager.get_agent_config_file()
    if await async_exists(agent_config_file):
        agent_config = await async_try_read_json(agent_config_file)
        if isinstance(agent_config, dict):
            agent_type = agent_config.get("type", "")
            if isinstance(agent_type, str) and agent_type.strip() == "magiclaw":
                return True

    # 兜底：last_dispatch_message.json
    last_msg_file = PathManager.get_chat_history_dir() / "last_dispatch_message.json"
    if await async_exists(last_msg_file):
        data = await async_try_read_json(last_msg_file)
        if isinstance(data, dict) and data.get("agent_mode") == "magiclaw":
            return True

    return False
