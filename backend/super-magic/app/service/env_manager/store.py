"""Dotenv file store with encrypted value support."""

from __future__ import annotations

from dataclasses import dataclass
from io import StringIO
from pathlib import Path

from dotenv import dotenv_values
from dotenv.parser import parse_stream

from app.utils.async_file_utils import async_exists, async_mkdir, async_read_text, async_write_text

from .cipher import EnvValueCipher
from .identity import EnvIdentity

CORRUPTED_ENV_VALUE_MESSAGE = "Data is corrupted and cannot be used"
_NULL_BYTE = "\x00"


@dataclass(frozen=True)
class EnvValueRecord:
    """Decoded env value plus whether it can be used at runtime."""

    value: str
    available: bool = True


class EnvFileStore:
    """Read and write dotenv files while decoding encrypted env values."""

    def __init__(self, cipher: EnvValueCipher | None = None) -> None:
        self._cipher = cipher or EnvValueCipher()

    async def set_value(self, path: Path, key: str, value: str, identity: EnvIdentity | None) -> None:
        stored_value = self._encode_value(key, value, identity)
        text = await self._read_text(path)
        await async_mkdir(path.parent, parents=True, exist_ok=True)
        await async_write_text(path, self._set_key_in_text(text, key, stored_value), encoding="utf-8")

    async def unset_value(self, path: Path, key: str, identity: EnvIdentity | None) -> bool:
        if not await async_exists(path):
            return False

        text = await async_read_text(path, encoding="utf-8")
        if not self._can_unset_key(text, key, identity):
            return False

        await async_write_text(path, self._unset_key_in_text(text, key), encoding="utf-8")
        return True

    async def read_values(self, path: Path, identity: EnvIdentity | None) -> dict[str, str]:
        if not await async_exists(path):
            return {}
        return self._available_values(self.read_records_from_text(await async_read_text(path, encoding="utf-8"), identity))

    async def read_records(self, path: Path, identity: EnvIdentity | None) -> dict[str, EnvValueRecord]:
        if not await async_exists(path):
            return {}
        return self.read_records_from_text(await async_read_text(path, encoding="utf-8"), identity)

    def read_values_sync(self, path: Path, identity: EnvIdentity | None) -> dict[str, str]:
        if not path.exists():
            return {}
        return self._available_values(self.read_records_from_text(path.read_text(encoding="utf-8"), identity))

    def read_values_from_text(self, text: str, identity: EnvIdentity | None) -> dict[str, str]:
        return self._available_values(self.read_records_from_text(text, identity))

    def read_records_from_text(self, text: str, identity: EnvIdentity | None) -> dict[str, EnvValueRecord]:
        # 列表读取需要保留损坏记录；运行时读取会再过滤为可用值。
        values: dict[str, EnvValueRecord] = {}
        for key, raw_value in self._read_raw_values(text).items():
            if raw_value is None:
                continue
            env_key = str(key)
            if not self.is_supported_value(raw_value):
                values[env_key] = EnvValueRecord(value=CORRUPTED_ENV_VALUE_MESSAGE, available=False)
                continue

            value = self._decode_value(env_key, raw_value, identity)
            if value is not None and self.is_supported_value(value):
                values[env_key] = EnvValueRecord(value=value, available=True)
            elif self._cipher.is_encrypted_marker(raw_value) or value is not None:
                # 明文旧数据或解密后的值如果包含 NUL，也不能进入系统环境变量，按损坏数据展示。
                values[env_key] = EnvValueRecord(value=CORRUPTED_ENV_VALUE_MESSAGE, available=False)
        return values

    async def _read_text(self, path: Path) -> str:
        if not await async_exists(path):
            return ""
        return await async_read_text(path, encoding="utf-8")

    def _encode_value(self, key: str, value: str, identity: EnvIdentity | None) -> str:
        if identity is None:
            return value
        return self._cipher.encrypt(key, value, identity)

    def _decode_value(self, key: str, value: str, identity: EnvIdentity | None) -> str | None:
        if self._cipher.is_encrypted_marker(value):
            return self._cipher.decrypt(key, value, identity)
        return value

    def _can_unset_key(self, text: str, key: str, identity: EnvIdentity | None) -> bool:
        raw_values = self._read_raw_values(text)
        if key not in raw_values or raw_values[key] is None:
            return False
        raw_value = raw_values[key] or ""
        if not self.is_supported_value(raw_value):
            if self._cipher.is_encrypted_marker(raw_value):
                return self._cipher.can_unset_unavailable_value(raw_value, identity)
            return True

        value = self._decode_value(key, raw_value, identity)
        if value is not None:
            return True

        # 密文损坏时允许清理当前身份下的数据；身份不匹配的密文仍按不存在处理。
        return self._cipher.can_unset_unavailable_value(raw_value, identity)

    @staticmethod
    def is_supported_value(value: str) -> bool:
        return _NULL_BYTE not in value

    @staticmethod
    def _read_raw_values(text: str) -> dict[str, str | None]:
        return dict(dotenv_values(stream=StringIO(text), interpolate=False))

    @staticmethod
    def _available_values(records: dict[str, EnvValueRecord]) -> dict[str, str]:
        return {key: record.value for key, record in records.items() if record.available}

    @classmethod
    def _set_key_in_text(cls, text: str, key: str, value: str) -> str:
        # 使用 dotenv parser 保留无关行，避免覆盖用户已有注释和其他变量格式。
        replacement = cls._format_line(key, value)
        found = False
        lines: list[str] = []
        for binding in parse_stream(StringIO(text)):
            if binding.key == key:
                if not found:
                    lines.append(replacement)
                found = True
            else:
                lines.append(binding.original.string)

        if not found:
            if text and not text.endswith("\n"):
                lines.append("\n")
            lines.append(replacement)

        return "".join(lines)

    @staticmethod
    def _unset_key_in_text(text: str, key: str) -> str:
        lines: list[str] = []
        for binding in parse_stream(StringIO(text)):
            if binding.key != key:
                lines.append(binding.original.string)
        return "".join(lines)

    @staticmethod
    def _format_line(key: str, value: str) -> str:
        escaped = (
            value.replace("\\", "\\\\")
            .replace("'", "\\'")
            .replace("\r", "\\r")
            .replace("\n", "\\n")
        )
        return f"{key}='{escaped}'\n"
