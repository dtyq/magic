"""
AI 能力配置管理器。

AIAbilityConfigManager 是 ai_abilities 的统一内存注册中心，负责按 provider
优先级合并配置并提供查询入口。
"""
import asyncio
import json
import time
from typing import Any, Dict, List, Optional, Set

from agentlang.config.ai_abilities.ability_config import AIAbilityConfig
from agentlang.config.ai_abilities.provider_interface import AIAbilityProvider
from agentlang.logger import get_logger

logger = get_logger(__name__)

_SENSITIVE_CONFIG_KEYWORDS = (
    "api_key",
    "secret",
    "token",
    "authorization",
    "password",
)


class AIAbilityConfigManager:
    """AI 能力配置内存注册中心。"""

    _instance: Optional["AIAbilityConfigManager"] = None

    def __new__(cls) -> "AIAbilityConfigManager":
        """获取单例实例。"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self) -> None:
        """初始化内存注册表。"""
        if not hasattr(self, "_initialized"):
            self._abilities: Dict[str, AIAbilityConfig] = {}
            self._registered_providers: Dict[str, AIAbilityProvider] = {}
            self._loaded_provider_types: Set[str] = set()
            self._use_counts: Dict[str, int] = {}
            self._last_loaded_at: Dict[str, float] = {}
            self._refreshing: Set[str] = set()
            self._initialized = True

    async def initialize(self, providers: List[AIAbilityProvider]) -> None:
        """从 provider 列表初始化 AI 能力配置。"""
        merged: Dict[str, AIAbilityConfig] = {}
        for provider in sorted(providers, key=lambda p: p.priority):
            try:
                abilities = await provider.load()
                for ability_config in abilities:
                    self._merge_ability_config(merged, ability_config)
                self._mark_loaded(provider)
                logger.info(
                    f"AI ability provider '{provider.provider_type}' loaded {len(abilities)} abilities"
                )
            except Exception as e:
                logger.error(f"AI ability provider '{provider.provider_type}' load failed: {e}")

        self._abilities = merged
        logger.info(
            "AIAbilityConfigManager initialized with "
            f"{len(self._abilities)} abilities: {self._format_ability_config_snapshot(self._abilities)}"
        )

    async def refresh_provider(self, provider: AIAbilityProvider) -> None:
        """刷新单个 provider 并合并到当前注册表。"""
        try:
            abilities = await provider.load()
        except Exception as e:
            logger.error(f"AI ability provider '{provider.provider_type}' refresh failed: {e}")
            return

        updated = 0
        for ability_config in abilities:
            if self._merge_ability_config(self._abilities, ability_config):
                updated += 1

        self._mark_loaded(provider)
        runtime_log_summary = provider.get_runtime_log_summary()
        runtime_log_suffix = f", {runtime_log_summary}" if runtime_log_summary else ""
        logger.info(
            f"AI ability provider '{provider.provider_type}' refreshed: "
            f"{updated} abilities updated, total {len(self._abilities)} abilities: "
            f"{self._format_ability_config_snapshot(self._abilities)}"
            f"{runtime_log_suffix}"
        )

    def is_provider_loaded(self, provider_type: str) -> bool:
        """判断 provider 是否成功加载过。"""
        return provider_type in self._loaded_provider_types

    async def ensure_provider_loaded(self, provider: AIAbilityProvider) -> None:
        """幂等加载 provider。"""
        if self.is_provider_loaded(provider.provider_type):
            return
        logger.info(
            f"AI ability provider '{provider.provider_type}' not loaded, triggering on-demand load"
        )
        await self.refresh_provider(provider)

    def maybe_refresh_in_background(self, provider_type: str) -> None:
        """按刷新策略启动后台刷新。"""
        provider = self._registered_providers.get(provider_type)
        if provider is None:
            return

        policy = provider.refresh_policy
        if policy is None:
            return

        self._use_counts[provider_type] = self._use_counts.get(provider_type, 0) + 1
        use_count = self._use_counts[provider_type]

        if provider_type in self._refreshing:
            return

        needs_refresh = False
        if policy.use_count is not None and use_count % policy.use_count == 0:
            needs_refresh = True
        if policy.interval_seconds is not None:
            last = self._last_loaded_at.get(provider_type, 0.0)
            if time.time() - last >= policy.interval_seconds:
                needs_refresh = True

        if needs_refresh:
            asyncio.create_task(self._background_refresh(provider))

    async def _background_refresh(self, provider: AIAbilityProvider) -> None:
        """执行后台刷新任务。"""
        provider_type = provider.provider_type
        self._refreshing.add(provider_type)
        try:
            logger.info(f"Background refresh started for AI ability provider '{provider_type}'")
            await self.refresh_provider(provider)
        except Exception as e:
            logger.warning(f"Background refresh failed for AI ability provider '{provider_type}': {e}")
        finally:
            self._refreshing.discard(provider_type)

    def get(self, ability_key: str) -> Optional[AIAbilityConfig]:
        """按 ability_key 获取 AI 能力配置。"""
        ability_config = self._abilities.get(ability_key)
        if ability_config is None:
            logger.debug(f"AI ability '{ability_key}' not found in AIAbilityConfigManager")
        return ability_config

    def get_value(self, ability_key: str, key: str, default: Any = None) -> Any:
        """读取指定能力的单个配置值。"""
        ability_config = self.get(ability_key)
        if ability_config is None:
            return default
        return ability_config.get(key, default)

    def list_all(self) -> List[AIAbilityConfig]:
        """返回全部 AI 能力配置。"""
        return list(self._abilities.values())

    def _merge_ability_config(
        self,
        registry: Dict[str, AIAbilityConfig],
        ability_config: AIAbilityConfig,
    ) -> bool:
        """按优先级和配置对象规则合并单个 AI 能力配置。"""
        validation_error = ability_config.validate_for_merge()
        if validation_error is not None:
            logger.debug(
                "Skip invalid AI ability config: "
                f"ability_key={ability_config.ability_key}, "
                f"provider={ability_config.provider_source}, "
                f"reason={validation_error}, "
                f"config={self._sanitize_config(ability_config.config)}"
            )
            return False

        existing = registry.get(ability_config.ability_key)
        if existing is not None and existing.priority > ability_config.priority:
            logger.debug(
                "Skip lower priority AI ability config: "
                f"ability_key={ability_config.ability_key}, "
                f"incoming={ability_config.provider_source}:{ability_config.priority}, "
                f"existing={existing.provider_source}:{existing.priority}"
            )
            return False

        merged_config = ability_config.merge_with(existing)
        merged_validation_error = merged_config.validate_for_merge()
        if merged_validation_error is not None:
            logger.info(
                "Skip merged AI ability config: "
                f"ability_key={merged_config.ability_key}, "
                f"provider={merged_config.provider_source}, "
                f"reason={merged_validation_error}, "
                f"config={self._sanitize_config(merged_config.config)}"
            )
            return False

        registry[merged_config.ability_key] = merged_config
        return True

    def _mark_loaded(self, provider: AIAbilityProvider) -> None:
        """标记 provider 已加载。"""
        provider_type = provider.provider_type
        self._loaded_provider_types.add(provider_type)
        self._registered_providers[provider_type] = provider
        self._last_loaded_at[provider_type] = time.time()

    def _format_ability_config_snapshot(
        self,
        abilities: Dict[str, AIAbilityConfig],
    ) -> str:
        """格式化当前生效的 AI 能力配置快照。"""
        snapshot = [
            {
                "ability_key": ability_key,
                "enabled": ability_config.enabled,
                "provider_source": ability_config.provider_source,
                "priority": ability_config.priority,
                "config": self._sanitize_config(ability_config.config),
            }
            for ability_key, ability_config in sorted(abilities.items())
        ]
        return json.dumps(snapshot, ensure_ascii=False, sort_keys=True, default=str)

    def _sanitize_config(self, config_dict: Dict[str, Any]) -> Dict[str, Any]:
        """脱敏配置中可能包含凭据的字段。"""
        sanitized: Dict[str, Any] = {}
        for key, value in config_dict.items():
            sanitized[str(key)] = self._sanitize_config_value(str(key), value)
        return sanitized

    def _sanitize_config_value(self, key: str, value: Any) -> Any:
        """递归脱敏单个配置值。"""
        lower_key = key.lower()
        if any(keyword in lower_key for keyword in _SENSITIVE_CONFIG_KEYWORDS):
            return "***"

        if isinstance(value, dict):
            return {
                str(child_key): self._sanitize_config_value(str(child_key), child_value)
                for child_key, child_value in value.items()
            }

        if isinstance(value, list):
            return [self._sanitize_config_value(key, item) for item in value]

        return value


ai_ability_config_manager = AIAbilityConfigManager()
