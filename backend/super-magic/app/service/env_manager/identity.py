"""Identity resolution for encrypted env values."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping

ID_KIND_PERSONAL = "uid"
ID_KIND_WORKSPACE = "pid"


@dataclass(frozen=True)
class EnvIdentity:
    """Encryption identity for one env storage scope."""

    kind: str
    value: str


class EnvIdentityResolver:
    """Resolve the current user/project identity used for env encryption."""

    def __init__(self, metadata: Mapping[str, object] | None = None) -> None:
        self._metadata = dict(metadata or {})

    def resolve_personal(self) -> EnvIdentity | None:
        return self._resolve(ID_KIND_PERSONAL, "user_id")

    def resolve_workspace(self) -> EnvIdentity | None:
        return self._resolve(ID_KIND_WORKSPACE, "project_id")

    def _resolve(self, kind: str, metadata_key: str) -> EnvIdentity | None:
        value = self._read_metadata_value(metadata_key)
        if not value:
            return None
        return EnvIdentity(kind=kind, value=value)

    def _read_metadata_value(self, key: str) -> str:
        # 工具调用优先使用 ToolContext metadata；进程注入没有工具上下文时再读 init message。
        value = self._metadata.get(key)
        if value is None:
            value = self._load_runtime_metadata().get(key)
        if value is None:
            return ""
        return str(value).strip()

    @staticmethod
    def _load_runtime_metadata() -> Mapping[str, object]:
        try:
            from app.utils.init_client_message_util import InitClientMessageUtil

            return InitClientMessageUtil.get_metadata()
        except Exception:
            return {}
