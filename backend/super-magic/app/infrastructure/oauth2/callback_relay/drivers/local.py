"""基于本地文件的 OAuth2 callback relay driver。"""

from __future__ import annotations

import os
from pathlib import Path

from app.infrastructure.oauth2.callback_relay.interface import OAuth2CallbackRelay
from app.infrastructure.oauth2.callback_relay.models import (
    OAuth2CallbackPayload,
    OAuth2CallbackResult,
    OAuth2CallbackStatus,
)
from app.infrastructure.oauth2.security import hash_text
from app.infrastructure.oauth2.session_store import OAuth2SessionStore
from app.infrastructure.oauth2.time_utils import format_utc
from app.path_manager import PathManager
from app.utils.async_file_utils import (
    async_chmod,
    async_exists,
    async_read_json,
    async_unlink,
    async_write_json,
)
from app.utils.runtime_storage import (
    RuntimeEvictionPolicy,
    ensure_runtime_directory,
    evict_runtime_files,
    get_runtime_config_int,
    trigger_opportunistic_cleanup,
)

ENV_LOCAL_REDIRECT_URI = "OAUTH2_LOCAL_CALLBACK_REDIRECT_URI"

def _load_callback_eviction_policy() -> RuntimeEvictionPolicy:
    return RuntimeEvictionPolicy(
        max_entries=get_runtime_config_int(
            "runtime_cleanup.oauth2_callback.max_file_count",
            minimum=1,
        ),
        target_entries=get_runtime_config_int(
            "runtime_cleanup.oauth2_callback.target_file_count",
            minimum=0,
        ),
        max_age_seconds=get_runtime_config_int(
            "runtime_cleanup.oauth2_callback.max_age_hours",
            minimum=1,
        )
        * 60
        * 60,
    )


class LocalOAuth2CallbackRelay(OAuth2CallbackRelay):
    """将 OAuth2 callback payload 作为临时 JSON 文件存储在 .runtime 下。"""

    def __init__(self, root_dir: Path | None = None) -> None:
        """使用可选 runtime 根目录初始化本地 callback relay。"""
        self._root_dir = (
            root_dir
            or PathManager.get_runtime_dir()
            / "oauth2"
            / "callback_relay"
            / "local"
        )

    @property
    def callbacks_dir(self) -> Path:
        """返回存储 callback JSON 文件的目录。"""
        return self._root_dir / "callbacks"

    def get_redirect_uri(self, app_name: str) -> str:
        """返回本地开发使用的 redirect URI。"""
        configured = os.getenv(ENV_LOCAL_REDIRECT_URI, "").strip()
        if configured:
            return configured
        port = os.getenv("SUPER_MAGIC_API_PORT", "8002")
        return f"http://127.0.0.1:{port}/api/dev/oauth2/callback"

    async def save_callback(self, payload: OAuth2CallbackPayload) -> None:
        """为本地开发持久化单个 callback payload。"""
        if not payload.state:
            raise ValueError("state is required.")
        payload.received_at = payload.received_at or format_utc()
        payload.source = payload.source or "local"
        file_path = self._callback_file(payload.state)
        await ensure_runtime_directory(file_path.parent)
        self._trigger_cleanup()
        await async_write_json(file_path, payload.to_dict(), ensure_ascii=False, indent=2)
        await async_chmod(file_path, 0o600)

    async def fetch_callback(self, state: str) -> OAuth2CallbackResult:
        """从本地 runtime 存储中按 state 拉取 callback payload。"""
        self._trigger_cleanup()
        file_path = self._callback_file(state)
        if not await async_exists(file_path):
            return OAuth2CallbackResult(status=OAuth2CallbackStatus.PENDING, message="Callback has not arrived.")
        try:
            payload = OAuth2CallbackPayload.from_dict(await async_read_json(file_path))
        except Exception as exc:
            return OAuth2CallbackResult(status=OAuth2CallbackStatus.FAILED, message=f"Callback payload is invalid: {exc}")
        if payload.state != state:
            return OAuth2CallbackResult(status=OAuth2CallbackStatus.FAILED, message="Callback state does not match.")
        if payload.error:
            return OAuth2CallbackResult(status=OAuth2CallbackStatus.DENIED, payload=payload, message=payload.error)
        if not payload.code:
            return OAuth2CallbackResult(status=OAuth2CallbackStatus.FAILED, payload=payload, message="Callback code is missing.")
        return OAuth2CallbackResult(status=OAuth2CallbackStatus.RECEIVED, payload=payload)

    async def delete_callback(self, state: str) -> None:
        """删除已消费的 callback payload。"""
        file_path = self._callback_file(state)
        if await async_exists(file_path):
            await async_unlink(file_path)

    def _callback_file(self, state: str) -> Path:
        """返回单个 state 对应的 callback 文件路径。"""
        return self.callbacks_dir / f"{hash_text(state)}.json"

    def _trigger_cleanup(self) -> None:
        trigger_opportunistic_cleanup(
            "oauth2_callbacks",
            self._cleanup_callbacks,
        )

    async def _cleanup_callbacks(self) -> None:
        active_hashes = await OAuth2SessionStore().collect_active_state_hashes()
        protected_paths = frozenset(
            self.callbacks_dir / f"{state_hash}.json"
            for state_hash in active_hashes
        )
        await evict_runtime_files(
            self.callbacks_dir,
            policy=_load_callback_eviction_policy(),
            suffixes=(".json",),
            protected_paths=protected_paths,
        )
