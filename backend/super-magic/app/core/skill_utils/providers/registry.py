"""Provider 注册中心

全局单例，维护所有 SkillProvider 实例，并按配置/能力探测决定 enabled 状态。
"""
from __future__ import annotations

from typing import Iterator

from agentlang.logger import get_logger
from app.core.skill_utils.providers.base import SkillProvider, SkillProviderId

logger = get_logger(__name__)

# 全局单例
_registry: "ProviderRegistry | None" = None


class ProviderRegistry:
    """Provider 注册中心（进程级单例）

    启动时调用 get_registry() 完成惰性初始化。
    测试时可调用 reset() 清除缓存。
    """

    def __init__(self) -> None:
        self._providers: dict[SkillProviderId, SkillProvider] = {}
        self._init_providers()

    def _init_providers(self) -> None:
        from app.core.skill_utils.providers.my_library import MyLibraryProvider
        from app.core.skill_utils.providers.magic_market import MagicMarketProvider
        from app.core.skill_utils.providers.github import GitHubProvider
        from app.core.skill_utils.providers.skillhub import SkillHubProvider
        from app.core.skill_utils.providers.clawhub import ClawHubProvider
        from app.core.skill_utils.providers.npx import NpxProvider

        for provider in [
            MyLibraryProvider(),
            MagicMarketProvider(),
            GitHubProvider(),
            SkillHubProvider(),
            ClawHubProvider(),
            NpxProvider(),
        ]:
            self._providers[provider.id] = provider
            status = "enabled" if provider.enabled else "disabled"
            logger.debug(f"[registry] {provider.id.value}: {status}")

    # ── 查询接口 ──────────────────────────────────────────────────────────────

    def get(self, provider_id: SkillProviderId | str) -> SkillProvider:
        """按 id 取 provider；provider 不存在时抛 KeyError"""
        if isinstance(provider_id, str):
            provider_id = SkillProviderId(provider_id)
        return self._providers[provider_id]

    def enabled_providers(self) -> list[SkillProvider]:
        """返回所有 enabled 的 provider（按优先级排序）"""
        order = [
            SkillProviderId.MY_LIBRARY,
            SkillProviderId.MAGIC_MARKET,
            SkillProviderId.CLAWHUB,
            SkillProviderId.SKILLHUB,
            SkillProviderId.NPX,
            SkillProviderId.GITHUB,
        ]
        result = []
        for pid in order:
            p = self._providers.get(pid)
            if p and p.enabled:
                result.append(p)
        return result

    def all_providers(self) -> Iterator[SkillProvider]:
        return iter(self._providers.values())

    # ── 单例管理 ──────────────────────────────────────────────────────────────

    @classmethod
    def reset(cls) -> None:
        """清除单例缓存（测试用）"""
        global _registry
        _registry = None


def get_registry() -> ProviderRegistry:
    """获取全局 ProviderRegistry 单例（惰性初始化）"""
    global _registry
    if _registry is None:
        _registry = ProviderRegistry()
    return _registry
