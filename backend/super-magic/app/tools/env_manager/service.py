"""Shared environment variable persistence logic for env-manager tools."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Mapping

from app.path_manager import PathManager
from app.service.env_manager import EnvFileStore, EnvIdentity, EnvIdentityResolver, EnvValueRecord

SCOPE_PERSONAL = "personal"
SCOPE_WORKSPACE = "workspace"
SCOPE_ALL = "all"

WRITE_SCOPES = {SCOPE_PERSONAL, SCOPE_WORKSPACE}
LIST_SCOPES = {SCOPE_PERSONAL, SCOPE_WORKSPACE, SCOPE_ALL}
KEY_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


class EnvManagerError(ValueError):
    """Stable model-facing env-manager error with structured display context."""

    def __init__(self, code: str, message: str, **context: str) -> None:
        super().__init__(message)
        self.code = code
        self.context = context


class EnvManagerService:
    """Read and write personal/workspace environment variable files."""

    def __init__(
        self,
        *,
        personal_env_file: Path | None = None,
        workspace_dir: Path | None = None,
        workspace_env_file: Path | None = None,
        metadata: Mapping[str, object] | None = None,
        store: EnvFileStore | None = None,
    ) -> None:
        self._personal_env_file = personal_env_file
        self._workspace_dir = workspace_dir
        self._workspace_env_file = workspace_env_file
        self._identity_resolver = EnvIdentityResolver(metadata)
        self._store = store or EnvFileStore()

    def get_personal_env_file(self) -> Path:
        return self._personal_env_file or PathManager.get_personal_env_file()

    def get_workspace_dir(self) -> Path:
        return self._workspace_dir or PathManager.get_workspace_dir()

    def get_workspace_env_file(self) -> Path:
        return self._workspace_env_file or PathManager.get_workspace_env_file()

    def get_workspace_env_paths(self) -> list[Path]:
        workspace_dir = self.get_workspace_dir()
        return [
            workspace_dir / ".magic" / "skills" / ".env",
            workspace_dir / ".env",
            self.get_workspace_env_file(),
        ]

    def get_env_paths(self, scope: str) -> list[Path]:
        self.validate_scope(scope, LIST_SCOPES)
        return [env_path for env_path, _ in self.get_env_path_specs(scope)]

    def get_env_path_specs(self, scope: str) -> list[tuple[Path, str]]:
        self.validate_scope(scope, LIST_SCOPES)
        if scope == SCOPE_PERSONAL:
            return [(self.get_personal_env_file(), SCOPE_PERSONAL)]
        if scope == SCOPE_WORKSPACE:
            return [(env_path, SCOPE_WORKSPACE) for env_path in self.get_workspace_env_paths()]
        return [(env_path, SCOPE_WORKSPACE) for env_path in self.get_workspace_env_paths()] + [
            (self.get_personal_env_file(), SCOPE_PERSONAL)
        ]

    def get_write_env_file(self, scope: str) -> Path:
        self.validate_scope(scope, WRITE_SCOPES)
        if scope == SCOPE_PERSONAL:
            return self.get_personal_env_file()
        return self.get_workspace_env_file()

    @staticmethod
    def validate_scope(scope: str, allowed_scopes: set[str]) -> None:
        if scope not in allowed_scopes:
            allowed = "|".join(sorted(allowed_scopes))
            raise EnvManagerError("invalid_scope", f"scope 必须是: {allowed}", scope=scope, allowed=allowed)

    @staticmethod
    def validate_key(key: str | None) -> str:
        key = (key or "").strip()
        if not key:
            raise EnvManagerError("key_required", "KEY 不能为空")
        if not KEY_PATTERN.match(key):
            raise EnvManagerError("invalid_key", f"KEY 格式不合法: {key}", key=key)
        return key

    @staticmethod
    def mask_value(value: str) -> str:
        if not EnvFileStore.is_supported_value(value):
            return "*" * min(len(value), 8)
        return value[:4] + "*" * (len(value) - 8) + value[-4:] if len(value) > 8 else "*" * len(value)

    @staticmethod
    def validate_value(value: str | None) -> str:
        if value is None:
            raise EnvManagerError("value_required", "VALUE 不能为空")
        if not EnvFileStore.is_supported_value(value):
            # OS 环境变量不能包含 NUL，提前拒绝避免后续任何工具进程都无法启动。
            raise EnvManagerError("invalid_value", "VALUE 包含不支持的空字节")
        return value

    async def set_env(self, key: str | None, value: str | None, scope: str = SCOPE_PERSONAL) -> dict[str, Any]:
        key = self.validate_key(key)
        value = self.validate_value(value)

        env_file = self.get_write_env_file(scope)
        await self._store.set_value(env_file, key, value, self._resolve_identity(scope))
        return {
            "ok": True,
            "key": key,
            "scope": scope,
            "target": self.describe_scope(scope),
        }

    async def unset_env(self, key: str | None, scope: str = SCOPE_PERSONAL) -> dict[str, Any]:
        key = self.validate_key(key)
        env_file = self.get_write_env_file(scope)

        if not await self._store.unset_value(env_file, key, self._resolve_identity(scope)):
            raise EnvManagerError("key_not_found", f"KEY 不存在: {key}", key=key)

        return {
            "ok": True,
            "key": key,
            "scope": scope,
            "target": self.describe_scope(scope),
        }

    async def list_env(self, scope: str = SCOPE_PERSONAL) -> dict[str, Any]:
        merged: dict[str, EnvValueRecord] = {}
        for env_path, env_scope in self.get_env_path_specs(scope):
            # list_env 保留不可用密文的占位记录，让用户能看到损坏变量。
            merged.update(await self._store.read_records(env_path, self._resolve_identity(env_scope)))

        keys = [
            {
                "key": key,
                "value": self.mask_value(merged[key].value) if merged[key].available and merged[key].value else merged[key].value,
                "available": merged[key].available,
            }
            for key in sorted(merged)
        ]
        return {
            "ok": True,
            "scope": scope,
            "target": self.describe_scope(scope),
            "count": len(keys),
            "keys": keys,
        }

    @staticmethod
    def describe_scope(scope: str) -> str:
        if scope == SCOPE_PERSONAL:
            return "personal env"
        if scope == SCOPE_WORKSPACE:
            return "workspace env"
        if scope == SCOPE_ALL:
            return "effective env"
        return "unknown env"

    def _resolve_identity(self, scope: str) -> EnvIdentity | None:
        if scope == SCOPE_PERSONAL:
            return self._identity_resolver.resolve_personal()
        if scope == SCOPE_WORKSPACE:
            return self._identity_resolver.resolve_workspace()
        return None
