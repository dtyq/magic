"""
AI 能力运行时配置注册表。
"""
from typing import Any, Dict, Optional, Type

from agentlang.config.ai_abilities.ability_config import AIAbilityConfig
from agentlang.logger import get_logger
from app.core.ai_ability_configs.base import BaseAIAbilityConfig
from app.core.ai_ability_configs.configs import (
    AgentRerankAbilityConfig,
    AnalysisAudioAbilityConfig,
    CompactAbilityConfig,
    DeepWriteAbilityConfig,
    MemoryAbilityConfig,
    PurifyAbilityConfig,
    SkillRerankAbilityConfig,
    SmartFilenameAbilityConfig,
    SummarizeAbilityConfig,
    VideoUnderstandingAbilityConfig,
    VisualUnderstandingAbilityConfig,
    JsonRepairValidationAbilityConfig,
    FollowUpQuestionsAbilityConfig,
)

logger = get_logger(__name__)

_ABILITY_CONFIG_CLASSES: Dict[str, Type[BaseAIAbilityConfig]] = {
    VisualUnderstandingAbilityConfig.ability_key_value: VisualUnderstandingAbilityConfig,
    SummarizeAbilityConfig.ability_key_value: SummarizeAbilityConfig,
    SmartFilenameAbilityConfig.ability_key_value: SmartFilenameAbilityConfig,
    PurifyAbilityConfig.ability_key_value: PurifyAbilityConfig,
    DeepWriteAbilityConfig.ability_key_value: DeepWriteAbilityConfig,
    CompactAbilityConfig.ability_key_value: CompactAbilityConfig,
    AnalysisAudioAbilityConfig.ability_key_value: AnalysisAudioAbilityConfig,
    VideoUnderstandingAbilityConfig.ability_key_value: VideoUnderstandingAbilityConfig,
    MemoryAbilityConfig.ability_key_value: MemoryAbilityConfig,
    SkillRerankAbilityConfig.ability_key_value: SkillRerankAbilityConfig,
    AgentRerankAbilityConfig.ability_key_value: AgentRerankAbilityConfig,
    JsonRepairValidationAbilityConfig.ability_key_value: JsonRepairValidationAbilityConfig,
    FollowUpQuestionsAbilityConfig.ability_key_value: FollowUpQuestionsAbilityConfig,
}


def create_ai_ability_config(
    ability_key: str,
    config_dict: Dict[str, Any],
    provider_source: str,
    priority: int,
) -> Optional[AIAbilityConfig]:
    """按 ability_key 创建对应的业务配置对象。"""
    normalized_key = ability_key.strip()
    if not normalized_key:
        logger.warning("AI ability config key is empty, skipping")
        return None

    config_class = _ABILITY_CONFIG_CLASSES.get(normalized_key)
    if config_class is None:
        logger.debug(f"AI ability '{normalized_key}' is not registered for runtime-config, skipping")
        return None

    return config_class(
        config=_extract_config(config_dict),
        enabled=_extract_enabled(config_dict),
        provider_source=provider_source,
        priority=priority,
    )


def _extract_config(config_dict: Dict[str, Any]) -> Dict[str, Any]:
    """从兼容格式中提取业务配置。"""
    nested_config = config_dict.get("config")
    if isinstance(nested_config, dict):
        return dict(nested_config)

    legacy_config = dict(config_dict)
    legacy_config.pop("enabled", None)
    return legacy_config


def _extract_enabled(config_dict: Dict[str, Any]) -> bool:
    """从兼容格式中提取启用状态。"""
    if "enabled" not in config_dict:
        return True

    enabled = config_dict.get("enabled")
    if isinstance(enabled, bool):
        return enabled
    if isinstance(enabled, str):
        return enabled.strip().lower() not in {"", "0", "false", "off", "no"}

    return bool(enabled)
