"""
AI Ability definitions and defaults for Super Magic application

This module defines the specific AI abilities used in the Super Magic application
and their default configurations.
"""
from enum import Enum
from typing import Dict, Any


class AIAbility(str, Enum):
    """Enumeration of AI abilities in Super Magic

    Each ability corresponds to a specific AI capability in the application.
    The values map to configuration keys in config.yaml under ai_abilities section.
    """
    # v1.0 implementations
    VISUAL_UNDERSTANDING = "visual_understanding"
    SUMMARIZE = "summarize"

    # v1.1 implementations
    SMART_FILENAME = "smart_filename"
    PURIFY = "purify"
    DEEP_WRITE = "deep_write"
    ANALYSIS_SLIDE = "analysis_slide"

    # v1.2 implementations
    COMPACT = "compact"
    ANALYSIS_AUDIO = "analysis_audio"


# Default configurations for each AI ability
# These serve as application-level fallback values
AI_ABILITY_DEFAULTS: Dict[str, Dict[str, Any]] = {
    # Visual Understanding Ability
    # Used for image analysis and visual content understanding
    AIAbility.VISUAL_UNDERSTANDING: {
        "model_id": "qwen3.5-flash",
        "timeout": 120,
        "max_images": 10,
        "enabled": True,
    },

    # Summarize Ability
    # Used for text summarization and information extraction
    AIAbility.SUMMARIZE: {
        "model_id": "qwen3.5-flash",
        "default_target_length": 500,
        "enabled": True,
    },

    # Smart Filename Ability (v1.1)
    # Used for generating smart filenames from webpage titles
    AIAbility.SMART_FILENAME: {
        "model_id": "deepseek-v3.2",
        "timeout": 60,
        "enabled": True,
    },

    # Purify Ability (v1.1)
    # Used for content purification and cleaning
    AIAbility.PURIFY: {
        "model_id": "deepseek-v3.2",
        "max_tokens": 24000,
        "enabled": True,
    },

    # Deep Write Ability (v1.1)
    # Used for deep content writing with references
    AIAbility.DEEP_WRITE: {
        "model_id": "deepseek-v3.2",
        "temperature": 0.7,
        "min_reference_files": 3,
        "enabled": True,
    },

    # Analysis Slide Ability (v1.1)
    # Used for analyzing webpage/slide content
    AIAbility.ANALYSIS_SLIDE: {
        "model_id": "deepseek-v3.2",
        "timeout": 60,
        "enabled": True,
    },

    # Compact Ability (v1.2)
    # 上下文压缩专属模型，不配置（或配置为空）时使用主 Agent 模型
    # 默认配置为 qwen3.5-flash；若模型配置不可用，运行时仍会回退到主 Agent 模型
    AIAbility.COMPACT: {
        "model_id": "qwen3.5-flash",
        "enabled": True,
        # TODO: compact 当前未消费 enabled 开关，后续可接入统一的能力启停控制
    },

    # Analysis Audio Ability (v1.2)
    # 用于音频项目分析
    AIAbility.ANALYSIS_AUDIO: {
        "model_id": "qwen3.5-flash",
        "enabled": True,
    },
}


def get_ability_config(ability: AIAbility, key: str, default: Any = None) -> Any:
    """Helper function to get AI ability configuration with application defaults

    This wraps the agentlang AIAbilityManager and adds application-level defaults.

    Args:
        ability: AI ability enum
        key: Configuration key
        default: Optional custom default (overrides AI_ABILITY_DEFAULTS)

    Returns:
        Configuration value

    Examples:
        from app.core.ai_abilities import AIAbility, get_ability_config

        model_id = get_ability_config(AIAbility.VISUAL_UNDERSTANDING, "model_id")
        timeout = get_ability_config(AIAbility.SUMMARIZE, "timeout", default=180)
    """
    from agentlang.config.ai_ability_manager import ai_ability_manager

    # Try to get from configuration manager
    value = ai_ability_manager.get(ability.value, key, default=None)

    # If not found, try application defaults
    if value is None and default is None:
        app_defaults = AI_ABILITY_DEFAULTS.get(ability, {})
        value = app_defaults.get(key)

    # Use custom default if provided
    if value is None:
        value = default

    return value


# Convenience methods for specific abilities
def get_visual_understanding_model_id() -> str:
    """获取视觉理解能力使用的模型ID

    Returns:
        str: 模型ID
    """
    return get_ability_config(AIAbility.VISUAL_UNDERSTANDING, "model_id", default="qwen3.5-flash")


def get_summarize_model_id() -> str:
    """获取摘要能力使用的模型ID

    Returns:
        str: 模型ID
    """
    return get_ability_config(AIAbility.SUMMARIZE, "model_id", default="qwen3.5-flash")


def get_smart_filename_model_id() -> str:
    """获取智能文件名能力使用的模型ID

    Returns:
        str: 模型ID
    """
    return get_ability_config(AIAbility.SMART_FILENAME, "model_id", default="deepseek-v3.2")


def get_purify_model_id() -> str:
    """获取内容净化能力使用的模型ID

    Returns:
        str: 模型ID
    """
    return get_ability_config(AIAbility.PURIFY, "model_id", default="deepseek-v3.2")


def get_deep_write_model_id() -> str:
    """获取深度写作能力使用的模型ID

    Returns:
        str: 模型ID
    """
    return get_ability_config(AIAbility.DEEP_WRITE, "model_id", default="deepseek-v3.2")


def get_analysis_slide_model_id() -> str:
    """获取幻灯片分析能力使用的模型ID

    Returns:
        str: 模型ID
    """
    return get_ability_config(AIAbility.ANALYSIS_SLIDE, "model_id", default="deepseek-v3.2")


def get_analysis_audio_model_id() -> str:
    """获取音频分析能力使用的模型ID

    Returns:
        str: 模型ID
    """
    return get_ability_config(AIAbility.ANALYSIS_AUDIO, "model_id", default="qwen3.5-flash")


def get_compact_model_id() -> str | None:
    """获取上下文压缩能力使用的模型ID

    返回 None 表示未配置专属模型，压缩时继续使用主 Agent 当前模型。
    会验证 model_id 对应的 LLM 配置是否可以正常加载，不可用时返回 None。

    Returns:
        Optional[str]: 模型ID，未配置或配置不可用时返回 None
    """
    from agentlang.logger import get_logger
    from agentlang.llms.factory import LLMFactory

    logger = get_logger(__name__)

    model_id = get_ability_config(AIAbility.COMPACT, "model_id", default=None)
    if not model_id or not model_id.strip():
        return None

    try:
        LLMFactory.get(model_id)
        return model_id
    except Exception as e:
        logger.warning(f"compact 专属模型 '{model_id}' 配置不可用，将使用主 Agent 默认模型: {e}")
        return None
