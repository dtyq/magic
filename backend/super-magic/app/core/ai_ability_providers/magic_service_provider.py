"""
Magic Service AI 能力配置 provider。

从 magic-service sandbox runtime-config 接口加载新版 super-magic 可消费的
ai_abilities 结构。
"""
from collections.abc import Mapping
from typing import Any, List, Optional

from agentlang.config.ai_abilities.ability_config import AIAbilityConfig
from agentlang.config.ai_abilities.provider_interface import AIAbilityProvider, RefreshPolicy
from agentlang.logger import get_logger
from app.core.ai_ability_configs import create_ai_ability_config
from app.infrastructure.sdk.magic_service.factory import create_magic_service_sdk_with_defaults
from app.infrastructure.sdk.magic_service.parameter.ai_ability_runtime_config_parameter import (
    AiAbilityRuntimeConfigParameter,
)

logger = get_logger(__name__)

PROVIDER_TYPE = "magic-service"
PROVIDER_PRIORITY = 3
LEGACY_PROVIDER_SOURCE = "dynamic_config.ai_abilities"

_REFRESH_USE_COUNT = 50
_REFRESH_INTERVAL_SECONDS = 3600


class MagicServiceAIAbilityProvider(AIAbilityProvider):
    """从 magic-service 加载 AI 能力运行时配置。"""

    def __init__(
        self,
        dynamic_ai_abilities: Optional[Mapping[str, Any]] = None,
    ) -> None:
        """初始化 magic-service AI 能力配置 provider。"""
        self._dynamic_ai_abilities = (
            dict(dynamic_ai_abilities)
            if isinstance(dynamic_ai_abilities, Mapping) and dynamic_ai_abilities
            else None
        )
        self._global_system_prompt = ""
        self._loaded_successfully = False

    @property
    def provider_type(self) -> str:
        """返回 provider 类型标识。"""
        return PROVIDER_TYPE

    @property
    def priority(self) -> int:
        """返回 magic-service 优先级。"""
        return PROVIDER_PRIORITY

    @property
    def refresh_policy(self) -> RefreshPolicy:
        """返回自动刷新策略。"""
        return RefreshPolicy(
            use_count=_REFRESH_USE_COUNT,
            interval_seconds=_REFRESH_INTERVAL_SECONDS,
        )

    async def load(self) -> List[AIAbilityConfig]:
        """调用 magic-service runtime-config 接口并解析 AI 能力配置。"""
        try:
            sdk = create_magic_service_sdk_with_defaults()
            runtime_config = await sdk.ai_ability.get_runtime_config_async(
                AiAbilityRuntimeConfigParameter()
            )
            self._global_system_prompt = runtime_config.get_global_system_prompt()
            self._loaded_successfully = True
            self._dynamic_ai_abilities = None
            return self._parse_runtime_config_items(runtime_config.get_ai_abilities())
        except Exception as e:
            if self._dynamic_ai_abilities is None:
                raise
            logger.warning(
                "MagicServiceAIAbilityProvider: failed to load runtime config, "
                f"using dynamic_config.ai_abilities fallback: {e}"
            )
            return self._parse_legacy_dynamic_configs()

    def get_global_system_prompt(self) -> str:
        """获取从 Magic Service 加载的全局系统提示词。"""
        return self._global_system_prompt

    def is_loaded_successfully(self) -> bool:
        """判断最近一次 runtime-config 是否成功加载。"""
        return self._loaded_successfully

    def get_runtime_log_summary(self) -> str:
        """返回全局系统提示词的脱敏加载摘要。"""
        prompt = self._global_system_prompt
        if not prompt:
            return "global_system_prompt=empty"
        preview = " ".join(prompt.split())[:100]
        return (
            f"global_system_prompt_length={len(prompt)}, "
            f"global_system_prompt_preview={preview!r}"
        )

    def _parse_runtime_config_items(self, ability_items: Mapping[str, Any]) -> List[AIAbilityConfig]:
        """解析 magic-service runtime-config 返回的 AI 能力配置。"""
        result: List[AIAbilityConfig] = []
        for ability_key, ability_config_item in ability_items.items():
            try:
                parsed_config = create_ai_ability_config(
                    ability_key,
                    ability_config_item.to_dict(),
                    PROVIDER_TYPE,
                    self.priority,
                )
                if parsed_config is not None:
                    result.append(parsed_config)
            except Exception as e:
                logger.warning(
                    f"MagicServiceAIAbilityProvider: failed to parse ability '{ability_key}': {e}"
                )

        logger.info(f"MagicServiceAIAbilityProvider loaded {len(result)} abilities")
        return result

    def _parse_legacy_dynamic_configs(self) -> List[AIAbilityConfig]:
        """解析旧版本 dynamic_config.ai_abilities 兼容配置。"""
        if not isinstance(self._dynamic_ai_abilities, Mapping):
            return []

        result: List[AIAbilityConfig] = []
        for ability_key, ability_dict in self._dynamic_ai_abilities.items():
            if not isinstance(ability_dict, dict):
                logger.warning(
                    f"MagicServiceAIAbilityProvider: legacy ability '{ability_key}' is not a dict, skipping"
                )
                continue

            try:
                parsed_config = create_ai_ability_config(
                    str(ability_key),
                    ability_dict,
                    LEGACY_PROVIDER_SOURCE,
                    self.priority,
                )
                if parsed_config is not None:
                    result.append(parsed_config)
            except Exception as e:
                logger.warning(
                    f"MagicServiceAIAbilityProvider: failed to parse legacy ability '{ability_key}': {e}"
                )

        logger.info(
            "MagicServiceAIAbilityProvider loaded "
            f"{len(result)} fallback abilities from dynamic_config.ai_abilities"
        )
        return result
