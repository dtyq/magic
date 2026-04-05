"""钉钉 channel 运行态持久化。

只保存极少量、值得跨进程保留的状态：
- last_message_data：最后一次收到的原始消息 dict（即 ChatbotMessage.from_dict 的入参），
  供 cron 主动推送用 ChatbotMessage.from_dict(data) 还原后复用会话上下文。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from agentlang.logger import get_logger
from app.path_manager import PathManager
from app.utils.async_file_utils import async_exists, async_read_json, async_unlink, async_write_json

logger = get_logger(__name__)

_STATE_SUBDIR = "im-channels"
_STATE_FILENAME = "dingtalk-runtime-state.json"


@dataclass
class DingTalkRuntimeState:
    # 最后一次收到用户消息时的原始 callback.data dict，跨重启保留供 cron 主动推送复用
    last_message_data: dict[str, Any] = field(default_factory=dict)
    last_message_at_ms: int = 0


def _state_file() -> Path:
    return PathManager.get_magic_config_dir() / _STATE_SUBDIR / _STATE_FILENAME


async def load_runtime_state() -> DingTalkRuntimeState:
    path = _state_file()
    if not await async_exists(path):
        return DingTalkRuntimeState()

    try:
        data = await async_read_json(path)
    except Exception as e:
        logger.warning(f"[DingTalkState] 读取运行态失败，按空状态处理: {e}")
        return DingTalkRuntimeState()

    return DingTalkRuntimeState(
        last_message_data=data.get("last_message_data") or {},
        last_message_at_ms=int(data.get("last_message_at_ms") or 0),
    )


async def save_runtime_state(state: DingTalkRuntimeState) -> None:
    await async_write_json(
        _state_file(),
        {
            "last_message_data": state.last_message_data,
            "last_message_at_ms": state.last_message_at_ms,
        },
        ensure_ascii=False,
    )


async def clear_runtime_state() -> None:
    path = _state_file()
    if not await async_exists(path):
        return
    await async_unlink(path)
