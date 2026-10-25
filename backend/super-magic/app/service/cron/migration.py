"""Cron payload 的全部历史兼容与版本迁移。"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass

from app.core.entity.message.client_message import AgentMode
from app.core.subagent_delegation import is_custom_agent_code
from app.path_manager import PathManager
from app.service.cron.schema import (
    CURRENT_PAYLOAD_VERSION,
    LEGACY_BASELINE_VERSION,
    PAYLOAD_VERSION_FIELD,
)
from app.utils.async_file_utils import async_scandir


# ── Payload 版本迁移 ──────────────────────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class CronPayloadMigrationResult:
    """单次 payload 迁移结果。"""

    payload: dict[str, object]
    field_patch: dict[str, object | None]
    complete: bool
    reason: str | None = None

    @property
    def changed(self) -> bool:
        return bool(self.field_patch)


MigrationFunction = Callable[[dict[str, object], str | None], dict[str, object]]
_V2_PAYLOAD_VERSION = LEGACY_BASELINE_VERSION + 1


def _migrate_v1_to_v2(
    payload: dict[str, object],
    inferred_agent_mode: str | None,
) -> dict[str, object]:
    """v1 → v2：补齐 Agent 模式并写入 payload 版本号。"""
    migrated = dict(payload)
    raw_mode = migrated.get("agent_mode")
    agent_mode = raw_mode.strip() if isinstance(raw_mode, str) else ""
    if not agent_mode:
        if inferred_agent_mode is None:
            return migrated
        migrated["agent_mode"] = inferred_agent_mode
    migrated[PAYLOAD_VERSION_FIELD] = _V2_PAYLOAD_VERSION
    return migrated


_MIGRATIONS: dict[int, MigrationFunction] = {
    LEGACY_BASELINE_VERSION: _migrate_v1_to_v2,
}


def _read_payload_version(payload: Mapping[str, object]) -> int:
    raw_version = payload.get(PAYLOAD_VERSION_FIELD, LEGACY_BASELINE_VERSION)
    if isinstance(raw_version, bool) or not isinstance(raw_version, int):
        raise ValueError(
            f"cron payload.{PAYLOAD_VERSION_FIELD} must be an integer when present, "
            f"got {type(raw_version).__name__}"
        )
    if raw_version < LEGACY_BASELINE_VERSION:
        raise ValueError(
            f"cron payload.{PAYLOAD_VERSION_FIELD} must be >= "
            f"{LEGACY_BASELINE_VERSION}, got {raw_version}"
        )
    return raw_version


def _build_field_patch(
    source: Mapping[str, object],
    target: Mapping[str, object],
) -> dict[str, object | None]:
    patch: dict[str, object | None] = {}
    keys = dict.fromkeys((*source.keys(), *target.keys()))
    for key in keys:
        if key not in target:
            patch[key] = None
        elif source.get(key) != target[key]:
            patch[key] = target[key]
    return patch


def _result(
    original: dict[str, object],
    migrated: dict[str, object],
    *,
    complete: bool,
    reason: str | None = None,
) -> CronPayloadMigrationResult:
    return CronPayloadMigrationResult(
        payload=migrated if complete else original,
        field_patch=_build_field_patch(original, migrated) if complete else {},
        complete=complete,
        reason=reason,
    )


def apply_migrations(
    payload: Mapping[str, object],
    *,
    inferred_agent_mode: str | None,
) -> CronPayloadMigrationResult:
    """按版本链迁移一个 cron payload，不执行文件读写。"""
    original = dict(payload)
    migrated = dict(payload)
    version = _read_payload_version(migrated)

    if version > CURRENT_PAYLOAD_VERSION:
        raw_mode = migrated.get("agent_mode")
        has_agent_mode = isinstance(raw_mode, str) and bool(raw_mode.strip())
        return _result(
            original,
            original,
            complete=has_agent_mode,
            reason=(
                None
                if has_agent_mode
                else f"future payload version v{version} has no agent_mode"
            ),
        )

    raw_mode = migrated.get("agent_mode")
    if raw_mode is not None and not isinstance(raw_mode, str):
        return _result(
            original,
            original,
            complete=False,
            reason="cron payload.agent_mode must be a string",
        )
    has_agent_mode = isinstance(raw_mode, str) and bool(raw_mode.strip())
    if not has_agent_mode:
        if inferred_agent_mode is None:
            return _result(
                original,
                original,
                complete=False,
                reason="legacy agent mode could not be inferred",
            )
        migrated["agent_mode"] = inferred_agent_mode

    while version < CURRENT_PAYLOAD_VERSION:
        migrate = _MIGRATIONS.get(version)
        if migrate is None:
            return _result(
                original,
                original,
                complete=False,
                reason=f"missing migration v{version} to v{version + 1}",
            )

        migrated = migrate(migrated, inferred_agent_mode)
        next_version = _read_payload_version(migrated)
        if next_version <= version:
            return _result(
                original,
                original,
                complete=False,
                reason=f"migration v{version} did not advance payload version",
            )
        version = next_version

    return _result(original, migrated, complete=True)


# ── Legacy Agent 身份迁移 ─────────────────────────────────────────────────────

def _builtin_agent_modes() -> dict[str, str]:
    modes: dict[str, str] = {}
    for mode in AgentMode:
        if mode in (AgentMode.CUSTOM_AGENT, AgentMode.MAGICLAW):
            continue
        modes.setdefault(mode.get_agent_type(), mode.value)
    return modes


_BUILTIN_AGENT_MODES = _builtin_agent_modes()


async def resolve_legacy_agent_mode(agent_name: str | None) -> str | None:
    """根据稳定的 Agent code 规则解析旧 cron 的 Agent 模式。"""
    if not isinstance(agent_name, str):
        return None
    normalized_name = agent_name.strip()
    if not normalized_name:
        return None

    builtin_mode = _BUILTIN_AGENT_MODES.get(normalized_name)
    if builtin_mode is not None:
        return builtin_mode

    if is_custom_agent_code(normalized_name):
        return AgentMode.CUSTOM_AGENT.value

    if await _is_registered_claw_code(normalized_name):
        return AgentMode.MAGICLAW.value

    return None


async def _is_registered_claw_code(agent_name: str) -> bool:
    """只按 Claw 注册目录名判断 code，不读取人格文件内容。"""
    try:
        entries = await async_scandir(PathManager.get_claws_root_dir())
    except (FileNotFoundError, NotADirectoryError):
        return False

    normalized_name = agent_name.casefold()
    return any(
        entry.is_dir() and entry.name.casefold() == normalized_name
        for entry in entries
    )


__all__ = [
    "CronPayloadMigrationResult",
    "apply_migrations",
    "resolve_legacy_agent_mode",
]
