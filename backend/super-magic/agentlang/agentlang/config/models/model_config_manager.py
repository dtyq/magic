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
            self._initialized: bool = True

    async def initialize(self, providers: List[ModelProvider]) -> None:
        """从 providers 列表加载全部模型配置

        按 priority 从低到高依次加载，高优先级的同 model_id 条目覆盖低优先级。

        Args:
            providers: 要加载的服务商列表
        """
        merged: Dict[str, ModelConfig] = {}
        for provider in sorted(providers, key=lambda p: p.priority):
            try:
                models = await provider.load()
                for mc in models:
                    merged[mc.model_id] = mc
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

        高优先级的同 model_id 会覆盖已有的低优先级条目。
        如果当前注册表已有相同 model_id 但优先级更高，则不覆盖。

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
            existing = self._models.get(mc.model_id)
            if existing is None or provider.priority >= self._get_source_priority(existing.provider_source):
                self._models[mc.model_id] = mc
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

    # ------------------------------------------------------------------
    # 内部方法
    # ------------------------------------------------------------------

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
            "magic-service": 3,
        }
        return _priority_map.get(provider_source, 0)

    def _sync_pricing(self) -> None:
        """将当前全部模型的 pricing 信息同步到 LLMFactory.pricing"""
        try:
            from agentlang.llms.factory import LLMFactory
            for mc in self._models.values():
                if mc.pricing:
                    LLMFactory.pricing.add_model_pricing(mc.model_id, mc.pricing)  # type: ignore[arg-type]
        except Exception as e:
            logger.warning(f"Pricing sync failed: {e}")


# 全局单例
model_config_manager = ModelConfigManager()
