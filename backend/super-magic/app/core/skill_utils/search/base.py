"""SearchDriver：搜索驱动抽象基类

搜索驱动拥有整个搜索管道的控制权：
  - 决定从哪些 provider 取数据、以何种策略取（全量/关键词）
  - 决定如何对结果进行筛选和排序

新增驱动只需继承 SearchDriver 并实现 search()，
再传入 SearchAggregator(search_driver=MyDriver()) 即可生效。

已内置驱动：
  - KeywordSearchDriver：并发关键词搜索 + 文本评分排序（默认）
  - LLMSearchDriver：本地全量扫描 + 外部关键词搜索 + LLM 一次性筛选
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from app.core.skill_utils.result import SearchResult


class SearchDriver(ABC):
    """搜索驱动抽象基类"""

    @abstractmethod
    async def search(
        self,
        keywords: list[str],
        *,
        providers: list[str] | None = None,
    ) -> SearchResult:
        """执行搜索并返回结构化结果。

        Args:
            keywords: 搜索关键词列表，空列表表示列全量（仅对支持全量的来源有效）。
            providers: 限定来源（provider id 字符串列表），None 表示不过滤。

        Returns:
            SearchResult，按关键词分组的候选结果。
        """
