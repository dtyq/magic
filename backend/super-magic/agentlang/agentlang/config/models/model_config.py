"""
模型配置数据类与工具

ModelConfig 是统一的模型配置数据结构，字段对齐 config.yaml。
ModelConfigUtils 是面向调用方的便捷访问入口，实际查询委托给 ModelConfigManager。
"""
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from agentlang.logger import get_logger

logger = get_logger(__name__)


def parse_bool_value(value: Any, default: bool = False) -> bool:
    """解析配置来源中的布尔值，兼容布尔、数字和常见字符串表示。"""
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "y", "on"}:
            return True
        if normalized in {"false", "0", "no", "n", "off", ""}:
            return False
    return bool(value)

if TYPE_CHECKING:
    from agentlang.config.models.model_profile import ModelProfile
    from agentlang.config.models.provider_config import ProviderConfig, ProviderModelConfig


@dataclass
class ModelConfig:
    """结构化模型配置

    运行时统一模型配置，由本地 providers/model_profiles 或管理后台模型列表归一化得到。
    provider_source 标记该配置来自哪个服务商，仅供调试使用。
    """
    # 必填字段
    model_id: str
    name: str
    provider: str
    api_key: str
    api_base_url: str
    client_type: str = "openai_chat_completions"

    # 模型类型
    type: str = "llm"  # "llm" 或 "embedding"

    # Token 限制
    max_context_tokens: int = 128000
    max_output_tokens: int = 8192

    # 模型参数
    temperature: float = 0.7
    top_p: float = 1.0

    # 功能支持
    supports_tool_use: bool = True
    # 是否支持 OpenAI-compatible 图片输入。
    supports_multimodal: bool = False

    # 可选字段
    stop: Optional[List[str]] = None
    headers: Dict[str, str] = field(default_factory=dict)
    query_params: Dict[str, str] = field(default_factory=dict)
    extra_params: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    # 实际解析后的底层模型 ID（动态聚合模型会指向真实的原子模型）
    resolved_model_id: Optional[str] = None

    # 定价信息（对齐 config.yaml 的 pricing 段）
    pricing: Dict[str, Any] = field(default_factory=dict)

    # 来源服务商标识，仅用于调试
    provider_source: str = ""
    # 实际服务商 ID，用于区分 config.yaml 内部展开出的多个服务商
    provider_id: str = ""
    # 模型条目优先级，同 model_id 冲突时数值越高越优先
    priority: int = 0

    @classmethod
    def from_dict(cls, model_id: str, config_dict: Dict[str, Any], provider_source: str = "") -> "ModelConfig":
        """从配置字典创建 ModelConfig 实例

        Args:
            model_id: 模型标识符
            config_dict: 来自配置文件的配置字典
            provider_source: 来源服务商类型，如 "config.yaml"、"magic-service"

        Returns:
            ModelConfig: 填充了所有字段的 ModelConfig 实例
        """
        return cls(
            model_id=model_id,
            name=str(config_dict.get("name", model_id)),
            provider=str(config_dict.get("provider", "openai")),
            client_type=str(config_dict.get("client_type", "openai_chat_completions")),
            api_key=config_dict.get("api_key", ""),
            api_base_url=config_dict.get("api_base_url", ""),
            type=config_dict.get("type", "llm"),
            max_context_tokens=int(config_dict.get("max_context_tokens", 8192)),
            max_output_tokens=int(config_dict.get("max_output_tokens", 4096)),
            temperature=float(config_dict.get("temperature", 0.7)),
            top_p=float(config_dict.get("top_p", 1.0)),
            supports_tool_use=parse_bool_value(config_dict.get("supports_tool_use"), default=True),
            supports_multimodal=parse_bool_value(config_dict.get("supports_multimodal")),
            stop=config_dict.get("stop"),
            headers={str(k): str(v) for k, v in _dict_or_empty(config_dict.get("headers")).items()},
            query_params={str(k): str(v) for k, v in _dict_or_empty(config_dict.get("query_params")).items()},
            extra_params=config_dict.get("extra_params", {}),
            metadata=config_dict.get("metadata", {}),
            resolved_model_id=config_dict.get("resolved_model_id") or None,
            pricing=config_dict.get("pricing", {}),
            provider_source=provider_source,
            provider_id=str(config_dict.get("provider_id") or provider_source or config_dict.get("provider", "")),
            priority=int(config_dict.get("priority", 0)),
        )

    @classmethod
    def from_provider_model_and_profile(
        cls,
        provider: "ProviderConfig",
        provider_model: "ProviderModelConfig",
        profile: "ModelProfile",
        provider_source: str,
    ) -> "ModelConfig":
        """由 Provider 调用配置和模型资料合成运行时模型配置。"""
        request_defaults = {
            **(provider.request_defaults or {}),
            **(provider_model.request_defaults or {}),
        }
        return cls(
            model_id=provider_model.model_id,
            name=provider_model.api_model,
            provider=provider.provider_id,
            client_type=provider.client_type,
            api_key=provider.api_key,
            api_base_url=provider.base_url,
            type=profile.type,
            max_context_tokens=provider_model.max_context_tokens
            if provider_model.max_context_tokens is not None
            else profile.max_context_tokens,
            max_output_tokens=provider_model.max_output_tokens
            if provider_model.max_output_tokens is not None
            else profile.max_output_tokens,
            temperature=float(request_defaults.get("temperature", 0.7)),
            top_p=float(request_defaults.get("top_p", 1.0)),
            supports_tool_use=profile.supports_tool_use,
            supports_multimodal=profile.supports_multimodal,
            stop=request_defaults.get("stop"),
            pricing=profile.pricing,
            headers=provider.headers,
            query_params=provider.query_params,
            extra_params={
                **(request_defaults.get("extra_params") or {}),
                **provider_model.extra_params,
            },
            metadata={
                **profile.metadata,
                **provider.metadata,
                **provider_model.metadata,
                "provider_id": provider.provider_id,
                "api_model": provider_model.api_model,
                "profile": profile.model,
            },
            provider_source=provider_source,
            provider_id=provider.provider_id,
            priority=provider.priority,
        )

    def to_dict(self) -> Dict[str, Any]:
        """将 ModelConfig 转换回字典格式"""
        result = {
            "model_id": self.model_id,
            "name": self.name,
            "provider": self.provider,
            "client_type": self.client_type,
            "api_key": self.api_key,
            "api_base_url": self.api_base_url,
            "type": self.type,
            "max_context_tokens": self.max_context_tokens,
            "max_output_tokens": self.max_output_tokens,
            "temperature": self.temperature,
            "top_p": self.top_p,
            "supports_tool_use": self.supports_tool_use,
            "supports_multimodal": self.supports_multimodal,
            "provider_id": self.provider_id,
            "priority": self.priority,
        }

        if self.stop:
            result["stop"] = self.stop
        if self.headers:
            result["headers"] = self.headers
        if self.query_params:
            result["query_params"] = self.query_params
        if self.extra_params:
            result["extra_params"] = self.extra_params
        if self.metadata:
            result["metadata"] = self.metadata
        if self.resolved_model_id:
            result["resolved_model_id"] = self.resolved_model_id
        if self.pricing:
            result["pricing"] = self.pricing

        return result


class ModelConfigUtils:
    """统一模型配置访问工具类

    所有查询委托给 ModelConfigManager，不再直接读取配置文件。
    """

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ModelConfigUtils, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, "_initialized"):
            self._initialized = True

    def _get_manager(self):
        # 延迟导入避免循环依赖
        from agentlang.config.models.model_config_manager import model_config_manager
        return model_config_manager

    def get_model_config_dict(self, model_id: str) -> Optional[Dict[str, Any]]:
        """获取模型配置（字典格式）"""
        if not model_id:
            logger.warning("model_id cannot be empty")
            return None
        mc = self._get_manager().get(model_id)
        if mc is None:
            logger.debug(f"Model {model_id} not found in model config manager")
            return None
        return mc.to_dict()

    def get_model_config(self, model_id: str) -> Optional["ModelConfig"]:
        """获取结构化模型配置"""
        if not model_id:
            logger.warning("model_id cannot be empty")
            return None
        mc = self._get_manager().get(model_id)
        if mc is None:
            logger.debug(f"Model {model_id} not found in model config manager")
        return mc

    def get_max_context_tokens(self, model_id: str, default: int = 8192) -> int:
        """获取模型的最大上下文 tokens"""
        mc = self.get_model_config(model_id)
        if not mc:
            logger.debug(f"Model {model_id} not found, returning default max_context_tokens: {default}")
            return default
        return mc.max_context_tokens

    def get_max_output_tokens(self, model_id: str, default: int = 4096) -> int:
        """获取模型的最大输出 tokens"""
        mc = self.get_model_config(model_id)
        if not mc:
            logger.debug(f"Model {model_id} not found, returning default max_output_tokens: {default}")
            return default
        return mc.max_output_tokens

    def supports_tool_use(self, model_id: str, default: bool = True) -> bool:
        """检查模型是否支持工具调用"""
        mc = self.get_model_config(model_id)
        if not mc:
            logger.debug(f"Model {model_id} not found, returning default supports_tool_use: {default}")
            return default
        return mc.supports_tool_use


# 全局单例实例
model_config_utils = ModelConfigUtils()


def _dict_or_empty(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}
