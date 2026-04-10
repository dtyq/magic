"""
微信 channel 运行态持久化。

这里只保存极少量、值得跨进程保留的状态：
- get_updates_buf：长轮询游标

不把具体路径 getter 塞进 PathManager；由业务层在这里自行基于 workspace
基础目录推导文件位置即可。
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path

from agentlang.logger import get_logger
from app.path_manager import PathManager
from app.utils.async_file_utils import async_exists, async_read_json, async_unlink, async_write_json

logger = get_logger(__name__)

_STATE_SUBDIR = "im-channels"
_STATE_FILENAME = "wechat-runtime-state.json"
MAX_CONTEXT_TOKEN_USERS = 20


@dataclass
class WechatRuntimeState:
    get_updates_buf: str = ""
    last_message_at_ms: int = 0
    # 最近活跃用户，供当前 cron 主动推送兜底
    last_active_user_id: str = ""
    # 按用户缓存最近可用的 context_token，字典顺序即最近使用顺序
    context_tokens_by_user: dict[str, "WechatUserContext"] = field(default_factory=dict)


@dataclass(slots=True)
class WechatUserContext:
    user_id: str = ""
    context_token: str = ""


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

    get_updates_buf = str(data.get("get_updates_buf") or "")
    last_message_at_ms = int(data.get("last_message_at_ms") or 0)
    last_active_user_id = str(data.get("last_active_user_id") or "")
    raw_context_tokens = data.get("context_tokens_by_user") or {}
    context_tokens_by_user: dict[str, WechatUserContext] = {}
    for user_id, raw_context in raw_context_tokens.items():
        normalized_user_id = str(user_id).strip()
        if not normalized_user_id:
            continue

        if not isinstance(raw_context, dict):
            continue

        context_token = str(raw_context.get("context_token") or "").strip()
        if not context_token:
            continue

        context_tokens_by_user[normalized_user_id] = WechatUserContext(
            user_id=normalized_user_id,
            context_token=context_token,
        )

    state = WechatRuntimeState(
        get_updates_buf=get_updates_buf,
        last_message_at_ms=last_message_at_ms,
        last_active_user_id=last_active_user_id,
        context_tokens_by_user=context_tokens_by_user,
    )
    _trim_context_tokens(state)
    return state


async def save_runtime_state(state: WechatRuntimeState) -> None:
    _trim_context_tokens(state)
    await async_write_json(_state_file(), asdict(state), ensure_ascii=False)


async def clear_runtime_state() -> None:
    path = _state_file()
    if not await async_exists(path):
        return
    await async_unlink(path)


def save_context_token(
    state: WechatRuntimeState,
    *,
    user_id: str,
    context_token: str,
    max_users: int = MAX_CONTEXT_TOKEN_USERS,
) -> WechatRuntimeState:
    if not user_id or not context_token:
        return state

    cache = dict(state.context_tokens_by_user)
    cache.pop(user_id, None)
    cache[user_id] = WechatUserContext(user_id=user_id, context_token=context_token)

    state.last_active_user_id = user_id
    state.context_tokens_by_user = cache
    _trim_context_tokens(state, max_users=max_users)
    return state


def get_context_token(state: WechatRuntimeState, user_id: str) -> str | None:
    if not user_id:
        return None
    user_context = state.context_tokens_by_user.get(user_id)
    return user_context.context_token if user_context else None


def get_latest_context(state: WechatRuntimeState) -> WechatUserContext:
    user_id = state.last_active_user_id
    if not user_id:
        return WechatUserContext()
    return state.context_tokens_by_user.get(
        user_id,
        WechatUserContext(user_id=user_id, context_token=get_context_token(state, user_id) or ""),
    )


def _trim_context_tokens(
    state: WechatRuntimeState,
    *,
    max_users: int = MAX_CONTEXT_TOKEN_USERS,
) -> None:
    if max_users <= 0:
        state.context_tokens_by_user = {}
        state.last_active_user_id = ""
        return

    while len(state.context_tokens_by_user) > max_users:
        oldest_user_id = next(iter(state.context_tokens_by_user))
        state.context_tokens_by_user.pop(oldest_user_id, None)

    if state.last_active_user_id and state.last_active_user_id not in state.context_tokens_by_user:
        state.last_active_user_id = next(reversed(state.context_tokens_by_user), "")
