"""飞书 channel 运行态持久化。

只保存极少量、值得跨进程保留的状态：
- last_chat_id：最后一次活跃会话 ID，供 cron 主动推送复用
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path

from agentlang.logger import get_logger
from app.path_manager import PathManager
from app.utils.async_file_utils import async_exists, async_read_json, async_unlink, async_write_json

logger = get_logger(__name__)

_STATE_SUBDIR = "im-channels"
_STATE_FILENAME = "lark-runtime-state.json"


@dataclass
class LarkRuntimeState:
    # 最后一次收到用户消息的 chat_id，跨重启保留供 cron 主动推送复用
    last_chat_id: str = ""


def _state_file() -> Path:
    return PathManager.get_magic_config_dir() / _STATE_SUBDIR / _STATE_FILENAME


async def load_runtime_state() -> LarkRuntimeState:
    path = _state_file()
    if not await async_exists(path):
        return LarkRuntimeState()

    try:
        data = await async_read_json(path)
    except Exception as e:
        logger.warning(f"[LarkState] 读取运行态失败，按空状态处理: {e}")
        return LarkRuntimeState()

    return LarkRuntimeState(
        last_chat_id=str(data.get("last_chat_id") or ""),
    )


async def save_runtime_state(state: LarkRuntimeState) -> None:
    await async_write_json(_state_file(), asdict(state), ensure_ascii=False)


async def clear_runtime_state() -> None:
    path = _state_file()
    if not await async_exists(path):
        return
    await async_unlink(path)
