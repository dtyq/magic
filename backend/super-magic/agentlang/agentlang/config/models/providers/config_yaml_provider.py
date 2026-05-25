"""
config.yaml 模型服务商

从 config.yaml 的 models 段读取模型配置，无网络请求。
优先级 priority=2，处于 magic-service (3) 之下、openai (1) 之上。
"""
from typing import Callable, List, Optional

from agentlang.config.config import config
from agentlang.config.models.model_config import ModelConfig
from agentlang.config.models.provider_interface import ModelProvider
from agentlang.logger import get_logger

logger = get_logger(__name__)

PROVIDER_TYPE = "config.yaml"
PROVIDER_PRIORITY = 2

# model_filter 类型：接收 ModelConfig，返回 True 表示该模型应被跳过
ModelFilterFunc = Callable[[ModelConfig], bool]


class ConfigYamlProvider(ModelProvider):
    """从 config.yaml 的 models 段加载模型配置"""

    def __init__(self, model_filter: Optional[ModelFilterFunc] = None) -> None:
        """初始化 ConfigYamlProvider

        Args:
            model_filter: 可选的模型过滤函数。接收 ModelConfig，返回 True 表示应跳过该模型。
                         未提供时不做任何过滤。
        """
        self._model_filter = model_filter

    @property
    def provider_type(self) -> str:
        return PROVIDER_TYPE

    @property
    def priority(self) -> int:
        return PROVIDER_PRIORITY

    async def load(self) -> List[ModelConfig]:
        """读取 config.yaml 中的所有模型配置

        Returns:
            List[ModelConfig]: 解析成功的模型列表，单个解析失败时跳过并记录日志
        """
        models_dict = config.get("models", {})
        if not isinstance(models_dict, dict):
            logger.warning("config.yaml 'models' section is not a dict, skipping")
            return []

        result: List[ModelConfig] = []
        for model_id, model_dict in models_dict.items():
            if not isinstance(model_dict, dict):
                logger.warning(f"Model '{model_id}' config is not a dict, skipping")
                continue
            try:
                mc = ModelConfig.from_dict(model_id, model_dict, provider_source=PROVIDER_TYPE)
                if self._model_filter and self._model_filter(mc):
                    logger.info(
                        f"Skipping model '{model_id}' from config.yaml: "
                        f"filtered by model_filter"
                    )
                    continue
                result.append(mc)
            except Exception as e:
                logger.error(f"Failed to parse model '{model_id}' from config.yaml: {e}")

        logger.debug(f"ConfigYamlProvider loaded {len(result)} models from config.yaml")
        return result
