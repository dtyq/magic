"""Shared environment variable persistence logic for env-manager tools."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from dotenv import dotenv_values, set_key, unset_key

from app.path_manager import PathManager

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
    ) -> None:
        self._personal_env_file = personal_env_file
        self._workspace_dir = workspace_dir
        self._workspace_env_file = workspace_env_file

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
        if scope == SCOPE_PERSONAL:
            return [self.get_personal_env_file()]
        if scope == SCOPE_WORKSPACE:
            return self.get_workspace_env_paths()
        return self.get_workspace_env_paths() + [self.get_personal_env_file()]

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
        return value[:4] + "*" * (len(value) - 8) + value[-4:] if len(value) > 8 else "*" * len(value)

    def set_env(self, key: str | None, value: str | None, scope: str = SCOPE_PERSONAL) -> dict[str, Any]:
        key = self.validate_key(key)
        if value is None:
            raise EnvManagerError("value_required", "VALUE 不能为空")

        env_file = self.get_write_env_file(scope)
        env_file.parent.mkdir(parents=True, exist_ok=True)
        if not env_file.exists():
            env_file.touch()

        set_key(str(env_file), key, value)
        return {
            "ok": True,
            "key": key,
            "scope": scope,
            "target": self.describe_scope(scope),
        }

    def unset_env(self, key: str | None, scope: str = SCOPE_PERSONAL) -> dict[str, Any]:
        key = self.validate_key(key)
        env_file = self.get_write_env_file(scope)

        if not env_file.exists() or key not in dotenv_values(str(env_file)):
            raise EnvManagerError("key_not_found", f"KEY 不存在: {key}", key=key)

        unset_key(str(env_file), key)
        return {
            "ok": True,
            "key": key,
            "scope": scope,
            "target": self.describe_scope(scope),
        }

    def list_env(self, scope: str = SCOPE_PERSONAL) -> dict[str, Any]:
        merged: dict[str, str] = {}
        for env_path in self.get_env_paths(scope):
            if env_path.exists():
                merged.update({k: v for k, v in dotenv_values(str(env_path)).items() if v is not None})

        keys = [{"key": key, "value": self.mask_value(merged[key]) if merged[key] else ""} for key in sorted(merged)]
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
