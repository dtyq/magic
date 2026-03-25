"""
微信 channel 运行态持久化。

这里只保存极少量、值得跨进程保留的状态：
- get_updates_buf：长轮询游标

不把具体路径 getter 塞进 PathManager；由业务层在这里自行基于 workspace
基础目录推导文件位置即可。
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path

from agentlang.logger import get_logger
from app.path_manager import PathManager
from app.utils.async_file_utils import async_exists, async_read_json, async_unlink, async_write_json

logger = get_logger(__name__)

_STATE_SUBDIR = "im-channels"
_STATE_FILENAME = "wechat-runtime-state.json"


@dataclass
class WechatRuntimeState:
    get_updates_buf: str = ""


def _state_file() -> Path:
    return PathManager.get_magic_config_dir() / _STATE_SUBDIR / _STATE_FILENAME


async def load_runtime_state() -> WechatRuntimeState:
    path = _state_file()
    if not await async_exists(path):
        return WechatRuntimeState()

    try:
        data = await async_read_json(path)
    except Exception as e:
        logger.warning(f"[WechatState] 读取运行态失败，按空状态处理: {e}")
        return WechatRuntimeState()

    return WechatRuntimeState(
        get_updates_buf=str(data.get("get_updates_buf") or ""),
    )


async def save_runtime_state(state: WechatRuntimeState) -> None:
    await async_write_json(_state_file(), asdict(state), ensure_ascii=False)


async def save_get_updates_buf(get_updates_buf: str) -> None:
    await save_runtime_state(WechatRuntimeState(get_updates_buf=get_updates_buf))


async def clear_runtime_state() -> None:
    path = _state_file()
    if not await async_exists(path):
        return
    await async_unlink(path)
