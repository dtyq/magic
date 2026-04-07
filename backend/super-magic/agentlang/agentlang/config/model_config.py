"""
模型配置工具

提供统一的模型配置访问接口，封装优先级逻辑：动态配置 -> 全局配置 -> 默认值
"""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from agentlang.config.config import config
from agentlang.config.dynamic_config import dynamic_config
from agentlang.logger import get_logger

logger = get_logger(__name__)


@dataclass
class ModelConfig:
    """结构化模型配置

    该数据类表示完整的模型配置，包含类型安全的字段。
    所有字段都有合理的默认值。
    """
    # 必填字段
    model_id: str
    name: str
    provider: str
    api_key: str
    api_base_url: str

    # 模型类型
    type: str = "llm"  # "llm" 或 "embedding"

    # Token 限制
    max_context_tokens: int = 128000
    max_output_tokens: int = 8192

    # 模型参数
    temperature: float = 0.7
    top_p: float = 1.0

    # 功能支持
    supports_tool_use: bool = False

    # 可选字段
    stop: Optional[List[str]] = None
    extra_params: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    # 实际解析后的底层模型 ID（动态聚合模型会指向真实的原子模型）
    resolved_model_id: Optional[str] = None

    @classmethod
    def from_dict(cls, model_id: str, config_dict: Dict[str, Any]) -> "ModelConfig":
        """从配置字典创建 ModelConfig 实例

        Args:
            model_id: 模型标识符
            config_dict: 来自配置文件的配置字典

        Returns:
            ModelConfig: 填充了所有字段的 ModelConfig 实例
        """
        return cls(
            model_id=model_id,
            name=config_dict.get("name", model_id),
            provider=config_dict.get("provider", "openai"),
            api_key=config_dict.get("api_key", ""),
            api_base_url=config_dict.get("api_base_url", ""),
            type=config_dict.get("type", "llm"),
            max_context_tokens=int(config_dict.get("max_context_tokens", 8192)),
            max_output_tokens=int(config_dict.get("max_output_tokens", 4096)),
            temperature=float(config_dict.get("temperature", 0.7)),
            top_p=float(config_dict.get("top_p", 1.0)),
            supports_tool_use=bool(config_dict.get("supports_tool_use", False)),
            stop=config_dict.get("stop"),
            extra_params=config_dict.get("extra_params", {}),
            metadata=config_dict.get("metadata", {}),
            resolved_model_id=config_dict.get("resolved_model_id") or None,
        )

    def to_dict(self) -> Dict[str, Any]:
        """将 ModelConfig 转换回字典格式

        Returns:
            Dict[str, Any]: 模型配置的字典表示
        """
        result = {
            "model_id": self.model_id,
            "name": self.name,
            "provider": self.provider,
            "api_key": self.api_key,
            "api_base_url": self.api_base_url,
            "type": self.type,
            "max_context_tokens": self.max_context_tokens,
            "max_output_tokens": self.max_output_tokens,
            "temperature": self.temperature,
            "top_p": self.top_p,
            "supports_tool_use": self.supports_tool_use,
        }

        if self.stop:
            result["stop"] = self.stop
        if self.extra_params:
            result["extra_params"] = self.extra_params
        if self.metadata:
            result["metadata"] = self.metadata
        if self.resolved_model_id:
            result["resolved_model_id"] = self.resolved_model_id

        return result


class ModelConfigUtils:
    """统一模型配置访问工具类

    该类提供访问模型配置的统一入口，实现以下优先级：
    1. 动态配置 (dynamic_config.yaml)
    2. 全局配置 (config.yaml)
    3. 默认值（如果提供）

    使用示例:
        from agentlang.config import model_config_utils, ModelConfig

        # 获取结构化模型配置
        config: ModelConfig = model_config_utils.get_model_config("gpt-4")
        if config:
            print(f"最大 tokens: {config.max_context_tokens}")
            print(f"支持工具: {config.supports_tool_use}")

        # 获取原始字典（向后兼容）
        config_dict = model_config_utils.get_model_config_dict("gpt-4")
    """

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ModelConfigUtils, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, '_initialized'):
            self._initialized = True
            logger.debug("ModelConfigUtils initialized")

    def get_model_config_dict(self, model_id: str) -> Optional[Dict[str, Any]]:
        """获取模型配置（字典格式）

        优先级：
        1. 动态配置 (dynamic_config.get_model_config)
        2. 全局配置 (config.get("models"))

        Args:
            model_id: 模型标识符

        Returns:
            Optional[Dict[str, Any]]: 模型配置字典，如果未找到则返回 None

        注意:
            该方法保留用于向后兼容。
            建议使用 get_model_config() 以获得类型安全的访问。
        """
        if not model_id:
            logger.warning("model_id 不能为空")
            return None

        # 优先级 1: 尝试动态配置
        model_config_dict = dynamic_config.get_model_config(model_id)
        if model_config_dict:
            logger.debug(f"使用动态配置: {model_id}")
            return model_config_dict

        # 优先级 2: 尝试全局配置
        global_models_config = config.get("models", {})
        if model_id in global_models_config:
            model_config_dict = global_models_config[model_id]
            logger.debug(f"使用全局配置: {model_id}")
            return model_config_dict

        # 在任何配置中都未找到
        logger.debug(f"模型 {model_id} 未在任何配置中找到")
        return None

    def get_model_config(self, model_id: str) -> Optional[ModelConfig]:
        """获取结构化模型配置

        优先级：
        1. 动态配置 (dynamic_config.get_model_config)
        2. 全局配置 (config.get("models"))

        Args:
            model_id: 模型标识符

        Returns:
            Optional[ModelConfig]: ModelConfig 实例，如果未找到则返回 None

        示例:
            config = model_config_utils.get_model_config("gpt-4")
            if config:
                print(f"最大上下文: {config.max_context_tokens}")
                print(f"支持工具: {config.supports_tool_use}")
        """
        config_dict = self.get_model_config_dict(model_id)
        if not config_dict:
            return None

        try:
            return ModelConfig.from_dict(model_id, config_dict)
        except Exception as e:
            logger.error(f"解析模型配置失败 {model_id}: {e}")
            return None

    def get_max_context_tokens(self, model_id: str, default: int = 8192) -> int:
        """获取模型的最大上下文 tokens

        便捷方法，用于访问常用的 max_context_tokens 字段。

        Args:
            model_id: 模型标识符
            default: 未找到时的默认值

        Returns:
            int: 最大上下文 tokens
        """
        model_config = self.get_model_config(model_id)
        if not model_config:
            logger.debug(
                f"模型 {model_id} 未找到，返回默认 max_context_tokens: {default}"
            )
            return default

        return model_config.max_context_tokens

    def get_max_output_tokens(self, model_id: str, default: int = 4096) -> int:
        """获取模型的最大输出 tokens

        便捷方法，用于访问常用的 max_output_tokens 字段。

        Args:
            model_id: 模型标识符
            default: 未找到时的默认值

        Returns:
            int: 最大输出 tokens
        """
        model_config = self.get_model_config(model_id)
        if not model_config:
            logger.debug(
                f"模型 {model_id} 未找到，返回默认 max_output_tokens: {default}"
            )
            return default

        return model_config.max_output_tokens

    def supports_tool_use(self, model_id: str, default: bool = False) -> bool:
        """检查模型是否支持工具调用

        便捷方法，用于检查常用的 supports_tool_use 字段。

        Args:
            model_id: 模型标识符
            default: 未找到时的默认值

        Returns:
            bool: 如果模型支持工具调用返回 True，否则返回 False
        """
        model_config = self.get_model_config(model_id)
        if not model_config:
            logger.debug(
                f"模型 {model_id} 未找到，返回默认 supports_tool_use: {default}"
            )
            return default

        return model_config.supports_tool_use


# 全局单例实例
model_config_utils = ModelConfigUtils()
