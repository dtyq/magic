"""SearchAggregator：搜索驱动调度器

对外接口保持不变（find_skills 等调用方无需修改）。
通过注入 SearchDriver 可随时切换搜索策略：
  - KeywordSearchDriver：并发关键词搜索 + 文本评分排序
  - LLMSearchDriver：本地全量扫描 + 外部关键词搜索 + LLM 筛选

无参构造时自动检测：SKILL_RERANK 能力的 model_id 已配置且可用 → LLMSearchDriver，
否则 → KeywordSearchDriver。

结果模型 SearchResult / KeywordResult 从 result.py 重导出，
保持对 `from search_service import SearchResult` 的历史调用兼容。
"""
from __future__ import annotations

from agentlang.logger import get_logger
from app.core.skill_utils.result import KeywordResult, SearchResult  # noqa: F401（重导出）
from app.core.skill_utils.search.base import SearchDriver

logger = get_logger(__name__)

__all__ = ["SearchAggregator", "SearchResult", "KeywordResult"]


def _resolve_default_driver() -> SearchDriver:
    """自动选择搜索驱动：model_id 可用则用 LLM 驱动，否则用关键词驱动"""
    try:
        from app.core.ai_abilities import AIAbility, get_ability_config
        from agentlang.llms.factory import LLMFactory

        model_id = get_ability_config(AIAbility.SKILL_RERANK, "model_id")
        if model_id:
            LLMFactory.get_model_config(model_id)  # 不可用时抛 ValueError
            from app.core.skill_utils.search.llm import LLMSearchDriver
            logger.debug(f"[search_aggregator] 使用 LLMSearchDriver，model={model_id}")
            return LLMSearchDriver(model_id=model_id)
    except Exception as e:
        logger.debug(f"[search_aggregator] LLM 驱动不可用，回退到关键词驱动: {e}")

    from app.core.skill_utils.search.keyword import KeywordSearchDriver
    return KeywordSearchDriver()


class SearchAggregator:
    """搜索驱动调度器（薄包装，不持有业务逻辑）"""

    def __init__(self, search_driver: SearchDriver | None = None) -> None:
        self._driver: SearchDriver = search_driver if search_driver is not None else _resolve_default_driver()

    async def search_many(
        self,
        keywords: list[str],
        *,
        providers: list[str] | None = None,
    ) -> SearchResult:
        """对多个关键词同时发起检索，委托给当前 SearchDriver 执行。

        providers: 限定来源（provider id 字符串列表），None 表示不过滤。
        """
        return await self._driver.search(keywords, providers=providers)
