"""模型资料目录。"""
from typing import Any, Dict

from agentlang.config.models.model_profile import ModelProfile
from agentlang.config.models.model_config import parse_bool_value
from agentlang.logger import get_logger

logger = get_logger(__name__)


class ModelCatalog:
    """从 config.yaml 的 model_profiles 解析模型资料。"""

    def __init__(self, overrides: Dict[str, Dict[str, Any]] | None = None) -> None:
        self._overrides = overrides or {}

    def resolve(self, *, profile: str | None, api_model: str, model_type: str | None = None) -> ModelProfile:
        profile_key = profile or api_model
        if profile_key in self._overrides:
            return _profile_from_override(profile_key, self._overrides[profile_key], model_type)

        logger.warning(f"模型资料未命中：profile={profile_key}，api_model={api_model}，使用保守默认值")
        return ModelProfile(model=profile_key, type=model_type or "llm")


def _profile_from_override(profile_key: str, raw: Dict[str, Any], model_type: str | None) -> ModelProfile:
    return ModelProfile(
        model=profile_key,
        type=str(model_type or raw.get("type", "llm")),
        max_context_tokens=int(raw.get("max_context_tokens", 128000)),
        max_output_tokens=int(raw.get("max_output_tokens", 8192)),
        supports_tool_use=parse_bool_value(raw.get("supports_tool_use"), default=True),
        supports_multimodal=parse_bool_value(raw.get("supports_multimodal")),
        pricing=_dict_or_empty(raw.get("pricing")),
        metadata=_dict_or_empty(raw.get("metadata")),
    )


def _dict_or_empty(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}
