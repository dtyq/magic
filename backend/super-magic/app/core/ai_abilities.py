"""
AI Ability definitions and defaults for Super Magic application

This module defines the specific AI abilities used in the Super Magic application
and their default configurations.
"""
from enum import Enum
from typing import Any, Dict


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
    VIDEO_UNDERSTANDING = "video_understanding"

    # v1.3 implementations
    SKILL_RERANK = "skill_rerank"
    MEMORY = "memory"
    AGENT_RERANK = "agent_rerank"
    JSON_REPAIR_VALIDATION = "json_repair_validation"
    FOLLOW_UP_QUESTIONS = "follow_up_questions"
    PERSONA_CHAT = "persona_chat"


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
        "model_id": "deepseek-v4-flash",
        "timeout": 60,
        "enabled": True,
    },

    # Purify Ability (v1.1)
    # Used for content purification and cleaning
    AIAbility.PURIFY: {
        "model_id": "deepseek-v4-flash",
        "max_tokens": 24000,
        "enabled": True,
    },

    # Deep Write Ability (v1.1)
    # Used for deep content writing with references
    AIAbility.DEEP_WRITE: {
        "model_id": "deepseek-v4-flash",
        "temperature": 0.7,
        "min_reference_files": 3,
        "enabled": True,
    },

    # Analysis Slide Ability (v1.1)
    # Used for analyzing webpage/slide content
    AIAbility.ANALYSIS_SLIDE: {
        "model_id": "deepseek-v4-flash",
        "timeout": 60,
        "enabled": True,
    },

    # Compact Ability (v1.2)
    # 上下文压缩专属模型，不配置（或配置为空）时使用主 Agent 模型
    AIAbility.COMPACT: {
        "model_id": "deepseek-v4-flash",
        "enabled": True,
        # TODO: compact 当前未消费 enabled 开关，后续可接入统一的能力启停控制
    },

    # Analysis Audio Ability (v1.2)
    # 用于音频项目分析
    AIAbility.ANALYSIS_AUDIO: {
        "model_id": "qwen3.5-flash",
        "enabled": True,
    },

    # Video Understanding Ability (v1.2)
    # 用于视频内容理解与分析
    AIAbility.VIDEO_UNDERSTANDING: {
        "model_id": "qwen3.5-flash",
        "timeout": 600,
        "enabled": True,
    },

    # Skill Rerank Ability (v1.3)
    # 用于 find_skills 工具的 LLM 重排驱动，使用轻量快速模型降低延迟
    AIAbility.SKILL_RERANK: {
        "model_id": "deepseek-v4-flash",
    },

    # Agent Rerank Ability (v1.3)
    # 用于 Agent 搜索结果的轻量模型排序
    AIAbility.AGENT_RERANK: {
        "model_id": "deepseek-v4-flash",
    },

    # 记忆提取能力 (v1.3)
    # 为后续回合记忆提取保留独立的轻量模型能力
    AIAbility.MEMORY: {
        "model_id": "deepseek-v4-flash",
        "enabled": True,
    },

    AIAbility.JSON_REPAIR_VALIDATION: {
        "model_id": "deepseek-v4-flash",
        "timeout": 30,
        "max_advice_words": 50,
        "enabled": True,
    },

    # 追加问题能力。空模型使用轻量默认值；明确 enabled=false 时不得回退到该默认值。
    AIAbility.FOLLOW_UP_QUESTIONS: {
        "model_id": "deepseek-v4-flash",
        "temperature": 0.3,
        "max_tokens": 512,
        "enabled": True,
    },

    # 人设访谈能力：persona_chat 工具让 AI 人设回答访谈问题。
    # 未配置专属模型时跟随当前对话的文本模型（auto 等模型可能不在用户套餐内）。
    AIAbility.PERSONA_CHAT: {
        "model_id": "",
    },
}


def get_ability_config(ability: AIAbility, key: str, default: Any = None) -> Any:
    """Helper function to get AI ability configuration with application defaults

    This reads the provider-backed AIAbilityConfigManager and adds application-level defaults.

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
    from agentlang.config.ai_abilities.ability_config_manager import ai_ability_config_manager

    ability_config = ai_ability_config_manager.get(ability.value)
    value = ability_config.get(key) if ability_config is not None else None

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
    return get_ability_config(AIAbility.SMART_FILENAME, "model_id", default="deepseek-v4-flash")


def get_purify_model_id() -> str:
    """获取内容净化能力使用的模型ID

    Returns:
        str: 模型ID
    """
    return get_ability_config(AIAbility.PURIFY, "model_id", default="deepseek-v4-flash")


def get_deep_write_model_id() -> str:
    """获取深度写作能力使用的模型ID

    Returns:
        str: 模型ID
    """
    return get_ability_config(AIAbility.DEEP_WRITE, "model_id", default="deepseek-v4-flash")


def get_analysis_slide_model_id() -> str:
    """获取幻灯片分析能力使用的模型ID

    Returns:
        str: 模型ID
    """
    return get_ability_config(AIAbility.ANALYSIS_SLIDE, "model_id", default="deepseek-v4-flash")


def get_analysis_audio_model_id() -> str:
    """获取音频分析能力使用的模型ID

    Returns:
        str: 模型ID
    """
    return get_ability_config(AIAbility.ANALYSIS_AUDIO, "model_id", default="qwen3.5-flash")


def get_video_understanding_model_id() -> str:
    """获取视频理解能力使用的模型ID

    Returns:
        str: 模型ID
    """
    return get_ability_config(AIAbility.VIDEO_UNDERSTANDING, "model_id", default="qwen3.5-flash")


def get_video_understanding_timeout() -> int:
    """获取视频理解能力使用的超时时间（秒）

    Returns:
        int: 超时时间（秒）
    """
    return int(get_ability_config(AIAbility.VIDEO_UNDERSTANDING, "timeout", default=600))


def get_memory_model_id() -> str:
    """获取后续回合记忆提取使用的模型 ID。

    Returns:
        str: 记忆提取能力使用的模型 ID。
    """
    model_id = get_ability_config(AIAbility.MEMORY, "model_id", default="deepseek-v4-flash")
    return str(model_id).strip() or "deepseek-v4-flash"


def get_compact_model_id() -> str | None:
    """获取上下文压缩能力使用的模型ID

    返回 None 表示未配置专属模型，压缩时继续使用主 Agent 当前模型。
    会验证 model_id 对应的 LLM 配置是否可以正常加载，不可用时返回 None。

    Returns:
        Optional[str]: 模型ID，未配置或配置不可用时返回 None
    """
    from agentlang.config.ai_ability_manager import ai_ability_manager
    from agentlang.logger import get_logger

    logger = get_logger(__name__)

    model_id = ai_ability_manager.get(AIAbility.COMPACT.value, "model_id", default=None)
    if not model_id or not model_id.strip():
        return None

    try:
        from agentlang.llms.factory import LLMFactory
        LLMFactory.get_model_config(model_id, expected_type="llm", allow_fallback=False)
        return model_id
    except Exception as e:
        logger.warning(f"compact 专属模型 '{model_id}' 配置不可用，将使用当前运行时模型: {e}")
        return None


def _get_required_ability_model_id(ability: AIAbility) -> str:
    """返回能力配置模型；未配置或配置为空时使用代码默认模型。"""
    defaults = AI_ABILITY_DEFAULTS.get(ability, {})
    default_model_id = str(defaults.get("model_id") or "").strip()
    if not default_model_id:
        raise RuntimeError(f"AI ability '{ability.value}' has no default model_id")

    configured_model_id = str(
        get_ability_config(
            ability,
            "model_id",
            default=default_model_id,
        )
        or ""
    ).strip()
    return configured_model_id or default_model_id


def get_skill_rerank_model_id() -> str:
    """返回 Skill Candidate 选择模型。"""
    return _get_required_ability_model_id(AIAbility.SKILL_RERANK)


def get_agent_rerank_model_id() -> str:
    """返回 Agent Candidate 排序模型。"""
    return _get_required_ability_model_id(AIAbility.AGENT_RERANK)
