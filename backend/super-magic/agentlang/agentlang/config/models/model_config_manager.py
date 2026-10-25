"""
模型配置管理器

ModelConfigManager 是模型配置的统一内存注册中心。
所有消费方（LLMFactory、ModelConfigUtils 等）均从此处获取模型配置，
不再分散查询 config.yaml 或 dynamic_config.yaml。

加载分两阶段：
  阶段一（ws 服务启动时）: initialize([ConfigYamlProvider()])
  阶段二（客户端 init 完成后）: refresh_provider(MagicServiceProvider())

自动刷新：
  Provider 可通过 refresh_policy 声明刷新策略（使用次数阈值 / 时间间隔）。
  满足条件时由 maybe_refresh_in_background() 以后台 Task 执行，不阻塞 chat。
"""
import asyncio
import time
from typing import Dict, List, Optional, Set

from agentlang.config.models.model_config import ModelConfig
from agentlang.config.models.provider_interface import ModelProvider
from agentlang.logger import get_logger

logger = get_logger(__name__)


class ModelConfigManager:
    """模型配置内存注册中心（单例）

    线程安全前提：所有读写均在主事件循环中执行，
    initialize/refresh_provider 为 async 方法，不允许在子线程中直接调用。
    """

    _instance: Optional["ModelConfigManager"] = None

    def __new__(cls) -> "ModelConfigManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self) -> None:
        if not hasattr(self, "_initialized"):
            self._models: Dict[str, ModelConfig] = {}
            # 已成功加载过的 provider_type -> 实例（用于自动刷新）
            self._registered_providers: Dict[str, ModelProvider] = {}
            # 已成功加载过的 provider_type 集合，用于幂等判断
            self._loaded_provider_types: Set[str] = set()
            # 每个 provider 的使用计数
            self._use_counts: Dict[str, int] = {}
            # 每个 provider 的上次成功加载时间（unix timestamp）
            self._last_loaded_at: Dict[str, float] = {}
            # 正在后台刷新中的 provider_type，防止并发重复触发
            self._refreshing: Set[str] = set()
            # 当前沙箱内被运行时判定为不支持原生视觉的模型 ID。
            self._disabled_multimodal_model_ids: Set[str] = set()
            self._initialized: bool = True

    async def initialize(self, providers: List[ModelProvider]) -> None:
        """从 providers 列表加载全部模型配置

        按 provider priority 从低到高依次加载，具体冲突以 ModelConfig.priority 为准。
        例如 magic-service(priority=100) 与 config.yaml(priority=2) 出现同 model_id 时，
        保留 config.yaml 静态入口参与加载，但最终由 magic-service 动态模型覆盖。

        Args:
            providers: 要加载的服务商列表
        """
        merged: Dict[str, ModelConfig] = {}
        for provider in sorted(providers, key=lambda p: p.priority):
            try:
                models = await provider.load()
                for mc in models:
                    self._merge_model_config(merged, mc)
                self._mark_loaded(provider)
                logger.info(
                    f"Provider '{provider.provider_type}' loaded {len(models)} models"
                )
            except Exception as e:
                logger.error(f"Provider '{provider.provider_type}' load failed: {e}")

        self._models = merged
        self._sync_pricing()
        model_ids = list(self._models.keys())
        logger.info(f"ModelConfigManager initialized with {len(self._models)} models: {model_ids}")

    async def refresh_provider(self, provider: ModelProvider) -> None:
        """重新加载单个服务商并将结果合并进当前注册表

        高优先级的同 model_id 会覆盖已有的低优先级模型条目。
        如果当前注册表已有相同 model_id 但 ModelConfig.priority 更高，则不覆盖。
        这保证了本地 config.yaml 可以保留同 host 静态模型，而 magic-service 刷新成功后
        仍然以动态模型配置为准。

        Args:
            provider: 要重新加载的服务商实例
        """
        try:
            models = await provider.load()
        except Exception as e:
            logger.error(f"Provider '{provider.provider_type}' refresh failed: {e}")
            return

        updated = 0
        for mc in models:
            if self._merge_model_config(self._models, mc):
                updated += 1

        self._mark_loaded(provider)
        self._sync_pricing()
        model_ids = list(self._models.keys())
        logger.info(
            f"Provider '{provider.provider_type}' refreshed: {updated} models updated, "
            f"total {len(self._models)} models in manager: {model_ids}"
        )

    def is_provider_loaded(self, provider_type: str) -> bool:
        """判断指定类型的服务商是否已成功加载过"""
        return provider_type in self._loaded_provider_types

    async def ensure_provider_loaded(self, provider: ModelProvider) -> None:
        """幂等加载：若该服务商类型尚未加载，则执行一次 refresh_provider"""
        if self.is_provider_loaded(provider.provider_type):
            return
        logger.info(
            f"Provider '{provider.provider_type}' not yet loaded, triggering on-demand load"
        )
        await self.refresh_provider(provider)

    def maybe_refresh_in_background(self, provider_type: str) -> None:
        """按策略判断是否需要刷新，满足条件则启动后台 Task（不阻塞调用方）

        判断顺序：
          1. provider 未注册（尚未加载成功过）→ 跳过，交给 ensure_provider_loaded 处理
          2. 正在刷新中 → 跳过，防止并发重复触发
          3. 递增使用计数
          4. 检查 use_count 或 interval_seconds 是否达到阈值 → 达到则创建后台 Task

        Args:
            provider_type: 服务商类型标识
        """
        provider = self._registered_providers.get(provider_type)
        if provider is None:
            return

        policy = provider.refresh_policy
        if policy is None:
            return

        # 递增使用计数
        self._use_counts[provider_type] = self._use_counts.get(provider_type, 0) + 1
        use_count = self._use_counts[provider_type]

        if provider_type in self._refreshing:
            return

        # 判断是否满足刷新条件
        needs_refresh = False
        if policy.use_count is not None and use_count % policy.use_count == 0:
            needs_refresh = True
        if policy.interval_seconds is not None:
            last = self._last_loaded_at.get(provider_type, 0.0)
            if time.time() - last >= policy.interval_seconds:
                needs_refresh = True

        if needs_refresh:
            asyncio.create_task(self._background_refresh(provider))

    async def _background_refresh(self, provider: ModelProvider) -> None:
        """后台刷新任务，由 maybe_refresh_in_background 创建"""
        provider_type = provider.provider_type
        self._refreshing.add(provider_type)
        try:
            logger.info(f"Background refresh started for provider '{provider_type}'")
            await self.refresh_provider(provider)
        except Exception as e:
            logger.warning(f"Background refresh failed for provider '{provider_type}': {e}")
        finally:
            self._refreshing.discard(provider_type)

    def get(self, model_id: str) -> Optional[ModelConfig]:
        """按 model_id 获取模型配置

        Args:
            model_id: 模型标识符

        Returns:
            ModelConfig 或 None（未找到时）
        """
        mc = self._models.get(model_id)
        if mc is None:
            logger.debug(f"Model '{model_id}' not found in ModelConfigManager")
        return mc

    def list_all(self) -> List[ModelConfig]:
        """返回所有已注册的模型配置列表"""
        return list(self._models.values())

    def disable_multimodal(self, model_id: str) -> None:
        """在当前沙箱内存配置中关闭指定模型的原生多模态能力。"""
        normalized = str(model_id or "").strip()
        if not normalized:
            return

        self._disabled_multimodal_model_ids.add(normalized)
        model_config = self._models.get(normalized)
        if model_config is not None:
            model_config.supports_multimodal = False
        logger.warning(f"模型原生多模态能力已在当前沙箱关闭: model_id={normalized}")

    # ------------------------------------------------------------------
    # 内部方法
    # ------------------------------------------------------------------

    def _merge_model_config(self, registry: Dict[str, ModelConfig], model_config: ModelConfig) -> bool:
        """按 ModelConfig.priority 合并单个模型配置。

        Args:
            registry: 目标模型注册表
            model_config: 待合并模型配置

        Returns:
            bool: True 表示写入或覆盖，False 表示被已有高优先级配置保留
        """
        if model_config.model_id in self._disabled_multimodal_model_ids:
            model_config.supports_multimodal = False

        existing = registry.get(model_config.model_id)
        if existing is not None and existing.priority > model_config.priority:
            logger.debug(
                "Skip lower priority model config: "
                f"model_id={model_config.model_id}, "
                f"incoming={model_config.provider_id}:{model_config.priority}, "
                f"existing={existing.provider_id}:{existing.priority}"
            )
            return False
        registry[model_config.model_id] = model_config
        return True

    def _mark_loaded(self, provider: ModelProvider) -> None:
        """标记 provider 已成功加载，更新注册表和时间戳"""
        provider_type = provider.provider_type
        self._loaded_provider_types.add(provider_type)
        self._registered_providers[provider_type] = provider
        self._last_loaded_at[provider_type] = time.time()

    @staticmethod
    def _get_source_priority(provider_source: str) -> int:
        """根据 provider_source 字符串返回优先级数值，用于 refresh 时的覆盖判断"""
        _priority_map = {
            "openai": 1,
            "config.yaml": 2,
            "magic-service": 100,
        }
        return _priority_map.get(provider_source, 0)

    def _sync_pricing(self) -> None:
        """将当前全部模型的 pricing 信息同步到 LLMFactory.pricing"""
        try:
            from agentlang.llms.factory import LLMFactory
            models_config = {}
            pricing_model_count = 0
            pricing_alias_count = 0
            for mc in self._models.values():
                if not mc.pricing:
                    continue
                pricing_model_count += 1
                models_config[mc.model_id] = {"pricing": mc.pricing}
                # 同一个模型在系统里可能有多个名字。模型配置里保存的是业务入口名，
                # 但请求上游和统计成本时未必继续使用这个名字。
                #
                # 例子：
                #   model_id = "auto"                         # 业务入口，用户/Agent 选择的是它
                #   name = "deepseek-v4-flash"                 # 真正发给 OpenAI 兼容接口的模型名
                #   resolved_model_id = "deepseek-v4-flash-x"  # 动态路由后实际落地的模型名
                #   metadata.api_model = "deepseek-v4-flash"   # config.yaml provider 里的 api_model
                #
                # 如果 pricing 只注册在 "auto" 上，而成本统计拿 "deepseek-v4-flash" 去查，
                # 就会查不到这份价格，最后退回 default pricing。aliases 的作用就是把这些
                # “同一个模型的不同名字”都挂到同一份 pricing 上，让以下查询都命中同一价格：
                #   auto -> 价格 A
                #   deepseek-v4-flash -> 价格 A
                #   deepseek-v4-flash-x -> 价格 A
                #
                # 注意：这里不是新增模型，也不是改变实际调用模型，只是补齐成本统计的查价入口。
                aliases = {
                    mc.name,
                    mc.resolved_model_id,
                    mc.metadata.get("api_model") if isinstance(mc.metadata, dict) else None,
                }
                for alias in aliases:
                    if isinstance(alias, str) and alias.strip():
                        alias_id = alias.strip()
                        if alias_id not in models_config:
                            models_config[alias_id] = {"pricing": mc.pricing}
                            pricing_alias_count += 1
            LLMFactory.pricing.replace_pricing_from_config(models_config)
            if self._should_warn_missing_pricing(pricing_model_count):
                logger.warning(
                    f"已加载 {len(self._models)} 个模型，但没有任何 pricing 配置，将继续使用默认价格"
                )
            elif pricing_model_count > 0:
                logger.debug(
                    "模型价格配置已同步: "
                    f"模型价格={pricing_model_count}, alias={pricing_alias_count}, "
                    f"总入口={len(models_config)}"
                )
        except Exception as e:
            logger.warning(f"Pricing sync failed: {e}")

    def _should_warn_missing_pricing(self, pricing_model_count: int) -> bool:
        """判断 0 pricing 是否值得报警。

        config.yaml 是启动期本地兜底 provider，通常只承载可调用入口和上下文窗口，
        不一定承载线上定价。只有更高优先级 provider（例如 magic-service）加载完成后，
        仍然没有任何 pricing，才说明成本统计会长期退回默认价格，需要 warning。
        """
        if not self._models or pricing_model_count > 0:
            return False
        config_priority = self._get_source_priority("config.yaml")
        return any(
            self._get_source_priority(provider_type) > config_priority
            for provider_type in self._loaded_provider_types
        )


# 全局单例
model_config_manager = ModelConfigManager()
