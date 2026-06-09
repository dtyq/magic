"""MCP 配置运行时环境变量解析。"""

from __future__ import annotations

import os
import re
from urllib.parse import parse_qsl, urlsplit, urlunsplit

from agentlang.logger import get_logger
from app.path_manager import PathManager

from .models import MCPServerConfig

logger = get_logger(__name__)

_ENV_PLACEHOLDER_PATTERN = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")


class MCPEnvResolutionError(ValueError):
    """MCP 配置引用了不可用的运行时环境变量。"""

    def __init__(self, missing_names: set[str]) -> None:
        self.missing_names = tuple(sorted(missing_names))
        super().__init__(f"Missing environment variable(s): {', '.join(self.missing_names)}")


class MCPEnvVarResolver:
    """在 MCP 建连前解析 ${VAR_NAME}，不污染持久化配置。"""

    def __init__(self, env_values: dict[str, str] | None = None) -> None:
        self._env_values = env_values

    def resolve_config(self, config: MCPServerConfig) -> MCPServerConfig:
        env_values = self._env_values if self._env_values is not None else self._load_effective_env()
        missing: set[str] = set()
        updates: dict[str, object] = {}

        if config.url is not None:
            updates["url"] = self._resolve_string(config.url, env_values, missing)
        if config.token is not None:
            updates["token"] = self._resolve_string(config.token, env_values, missing)
        if config.headers is not None:
            updates["headers"] = self._resolve_mapping(config.headers, env_values, missing)
        if config.env is not None:
            updates["env"] = self._resolve_mapping(config.env, env_values, missing)

        if missing:
            raise MCPEnvResolutionError(missing)

        return config.model_copy(deep=True, update=updates)

    @classmethod
    def _load_effective_env(cls) -> dict[str, str]:
        from app.service.env_manager import EnvFileStore, EnvIdentityResolver

        values = dict(os.environ)
        store = EnvFileStore()
        identity_resolver = EnvIdentityResolver()
        personal_env_path = PathManager.get_personal_env_file()

        for env_path in PathManager.get_process_env_paths():
            if not env_path.exists():
                continue

            identity = (
                identity_resolver.resolve_personal()
                if env_path == personal_env_path
                else identity_resolver.resolve_workspace()
            )
            try:
                # MCP 连接发生在服务进程内，这里复用 env-manager 的解密和可用性过滤规则。
                values.update(store.read_values_sync(env_path, identity))
            except Exception as exc:
                logger.warning(f"加载 MCP 环境变量文件失败: {env_path}: {exc}")

        return values

    @classmethod
    def _resolve_mapping(
        cls,
        mapping: dict[str, str],
        env_values: dict[str, str],
        missing: set[str],
    ) -> dict[str, str]:
        return {
            str(key): cls._resolve_string(str(value), env_values, missing)
            for key, value in mapping.items()
        }

    @staticmethod
    def _resolve_string(value: str, env_values: dict[str, str], missing: set[str]) -> str:
        def replace(match: re.Match[str]) -> str:
            name = match.group(1)
            if name not in env_values:
                missing.add(name)
                return match.group(0)
            return env_values[name]

        return _ENV_PLACEHOLDER_PATTERN.sub(replace, value)


def redact_config_values(config: MCPServerConfig, text: str) -> str:
    """把已解析的 MCP 敏感值从错误文案里脱敏后再返回给模型。"""
    redacted = text or ""
    if config.url:
        redacted = _replace_value(redacted, config.url, _redact_url(config.url))
        for _, query_value in parse_qsl(urlsplit(config.url).query, keep_blank_values=True):
            redacted = _replace_value(redacted, query_value, "<redacted>")
    if config.token:
        redacted = _replace_value(redacted, config.token, "<redacted>")
    for mapping in (config.headers, config.env):
        for value in (mapping or {}).values():
            redacted = _redact_scalar_value(redacted, str(value))
    return redacted


def _redact_scalar_value(text: str, value: str) -> str:
    redacted = _replace_value(text, value, "<redacted>")
    for prefix in ("Bearer ", "Token ", "Basic "):
        if value.startswith(prefix):
            redacted = _replace_value(redacted, value[len(prefix):], "<redacted>")
    return redacted


def _replace_value(text: str, value: str, replacement: str) -> str:
    if not value:
        return text
    return text.replace(value, replacement)


def _redact_url(url: str) -> str:
    parts = urlsplit(url)
    if not parts.query:
        return url
    redacted_query = "&".join(
        f"{key}=<redacted>"
        for key, _ in parse_qsl(parts.query, keep_blank_values=True)
    )
    return urlunsplit((parts.scheme, parts.netloc, parts.path, redacted_query, parts.fragment))
