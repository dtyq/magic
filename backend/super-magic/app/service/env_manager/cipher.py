"""AES-GCM codec for env-manager values."""

from __future__ import annotations

import base64
import hashlib
import json
import os
import secrets
from typing import Any

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from .identity import EnvIdentity

ENV_VALUE_ENCRYPTION_PREFIX = "smenc:v1:"
ENV_VALUE_ENCRYPTION_MARKER = "smenc:"
_ALGORITHM = "A256GCM-HKDF-SHA256"
_KEY_INFO_PREFIX = "super-magic/env-manager/v1"
_KID_PREFIX = "sm-env:kid:v1"
_SALT_BYTES = 16
_NONCE_BYTES = 12
_KEY_BYTES = 32


class EnvValueCipher:
    """Encrypt and decrypt a single dotenv value."""

    @staticmethod
    def is_encrypted_marker(value: str) -> bool:
        return value.startswith(ENV_VALUE_ENCRYPTION_MARKER)

    def encrypt(self, env_key: str, value: str, identity: EnvIdentity) -> str:
        salt = os.urandom(_SALT_BYTES)
        nonce = os.urandom(_NONCE_BYTES)
        kid = self._kid(identity)
        key = self._derive_key(identity, env_key, salt)
        plaintext = self._pack_plaintext(value)
        # AAD 绑定变量名和身份指纹，避免密文被搬到其他 env key 下复用。
        aad = self._build_aad(identity.kind, kid, env_key)
        ciphertext = AESGCM(key).encrypt(nonce, plaintext, aad)
        envelope = {
            "a": _ALGORITHM,
            "i": identity.kind,
            "kid": kid,
            "salt": self._b64encode(salt),
            "nonce": self._b64encode(nonce),
            "ct": self._b64encode(ciphertext),
        }
        payload = json.dumps(envelope, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        return f"{ENV_VALUE_ENCRYPTION_PREFIX}{self._b64encode(payload)}"

    def decrypt(self, env_key: str, encrypted_value: str, identity: EnvIdentity | None) -> str | None:
        if not encrypted_value.startswith(ENV_VALUE_ENCRYPTION_PREFIX) or identity is None:
            return None

        try:
            envelope = self._load_envelope(encrypted_value)
            if envelope.get("a") != _ALGORITHM:
                return None
            if envelope.get("i") != identity.kind:
                return None

            kid = str(envelope.get("kid") or "")
            if kid != self._kid(identity):
                return None

            salt = self._b64decode_required(envelope.get("salt"))
            nonce = self._b64decode_required(envelope.get("nonce"))
            ciphertext = self._b64decode_required(envelope.get("ct"))
            key = self._derive_key(identity, env_key, salt)
            aad = self._build_aad(identity.kind, kid, env_key)
            plaintext = AESGCM(key).decrypt(nonce, ciphertext, aad)
            return self._unpack_plaintext(plaintext)
        except Exception:
            return None

    def can_unset_unavailable_value(self, encrypted_value: str, identity: EnvIdentity | None) -> bool:
        """Return whether an encrypted-but-unusable value may be removed."""
        if not self.is_encrypted_marker(encrypted_value):
            return False
        if not encrypted_value.startswith(ENV_VALUE_ENCRYPTION_PREFIX):
            return True

        try:
            # 格式已经坏到无法解析 envelope 时，只能把它当作可清理的损坏数据。
            envelope = self._load_envelope(encrypted_value)
        except Exception:
            return True

        if identity is None:
            return False
        if envelope.get("a") != _ALGORITHM:
            return True
        if envelope.get("i") != identity.kind:
            return False

        kid = str(envelope.get("kid") or "")
        return kid == self._kid(identity)

    @staticmethod
    def _pack_plaintext(value: str) -> bytes:
        # 随机 padding 只弱化长度特征，不承担密钥安全职责。
        padding_size = 8 + secrets.randbelow(25)
        padding = EnvValueCipher._b64encode(os.urandom(padding_size))
        payload = {"v": value, "p": padding}
        return json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")

    @staticmethod
    def _unpack_plaintext(plaintext: bytes) -> str | None:
        payload = json.loads(plaintext.decode("utf-8"))
        if not isinstance(payload, dict):
            return None
        value = payload.get("v")
        if not isinstance(value, str):
            return None
        return value

    @staticmethod
    def _derive_key(identity: EnvIdentity, env_key: str, salt: bytes) -> bytes:
        info = f"{_KEY_INFO_PREFIX}/{identity.kind}/{env_key}".encode("utf-8")
        return HKDF(
            algorithm=hashes.SHA256(),
            length=_KEY_BYTES,
            salt=salt,
            info=info,
        ).derive(identity.value.encode("utf-8"))

    @staticmethod
    def _kid(identity: EnvIdentity) -> str:
        # 密文中只保存身份指纹，不落盘原始 user_id/project_id。
        digest = hashlib.sha256(f"{_KID_PREFIX}:{identity.kind}:{identity.value}".encode("utf-8")).digest()
        return EnvValueCipher._b64encode(digest[:16])

    @staticmethod
    def _build_aad(kind: str, kid: str, env_key: str) -> bytes:
        return f"smenc:v1:{kind}:{kid}:{env_key}".encode("utf-8")

    @staticmethod
    def _load_envelope(encrypted_value: str) -> dict[str, Any]:
        payload = encrypted_value[len(ENV_VALUE_ENCRYPTION_PREFIX):]
        decoded = EnvValueCipher._b64decode(payload)
        envelope = json.loads(decoded.decode("utf-8"))
        if not isinstance(envelope, dict):
            raise ValueError("encrypted env envelope must be a JSON object")
        return envelope

    @staticmethod
    def _b64encode(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")

    @staticmethod
    def _b64decode(data: str) -> bytes:
        padding = "=" * (-len(data) % 4)
        return base64.urlsafe_b64decode(f"{data}{padding}".encode("ascii"))

    @staticmethod
    def _b64decode_required(value: object) -> bytes:
        if not isinstance(value, str) or not value:
            raise ValueError("missing base64 field")
        return EnvValueCipher._b64decode(value)
