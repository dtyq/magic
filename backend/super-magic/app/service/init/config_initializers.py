"""Magic Service 动态配置初始化启动器。"""

from collections.abc import Mapping
from typing import Any, Optional

from agentlang.config.ai_abilities.ability_config_manager import ai_ability_config_manager
from agentlang.config.models.model_config_manager import model_config_manager
from app.core.ai_ability_providers.magic_service_provider import MagicServiceAIAbilityProvider
from app.core.context.agent_context import AgentContext
from app.core.model_providers.magic_service_provider import MagicServiceProvider
from app.service.init.initializer import InitExecutionMode


class ModelConfigInitializer:
    """加载 Magic Service 模型列表。"""

    name = "magic-service-models"
    order = 100
    mode = InitExecutionMode.PARALLEL

    async def run(self, context: AgentContext) -> None:
        """刷新模型配置。"""
        await model_config_manager.refresh_provider(MagicServiceProvider())


class AIAbilityConfigInitializer:
    """加载 Magic Service AI 能力和全局系统提示词。"""

    name = "magic-service-ai-abilities"
    order = 100
    mode = InitExecutionMode.PARALLEL

    def __init__(self, dynamic_config: Optional[Mapping[str, Any]] = None) -> None:
        """保存任务入口携带的动态配置。"""
        dynamic_ai_abilities = (dynamic_config or {}).get("ai_abilities")
        self._dynamic_ai_abilities = (
            dynamic_ai_abilities
            if isinstance(dynamic_ai_abilities, Mapping) and dynamic_ai_abilities
            else None
        )

    async def run(self, context: AgentContext) -> None:
        """加载 AI 能力，并在任务首次成功加载时固定全局系统提示词。"""
        provider = MagicServiceAIAbilityProvider(self._dynamic_ai_abilities)

        # 首次必须使用当前 provider 请求完整配置，不能被 manager 的已加载状态短路，
        # 否则预启动场景只能拿到 AI 能力，无法为当前任务建立提示词快照。
        if not context.is_global_system_prompt_initialized() or self._dynamic_ai_abilities:
            await ai_ability_config_manager.refresh_provider(provider)
        else:
            await ai_ability_config_manager.ensure_provider_loaded(provider)

        if provider.is_loaded_successfully():
            context.initialize_global_system_prompt(provider.get_global_system_prompt())
