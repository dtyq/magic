"""SearchAggregator：多来源、多关键词并发检索并归一化排序

find_skills 工具的核心检索层，对模型完全透明（top_k/sources 等参数内部决定）。
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field

from agentlang.logger import get_logger
from app.core.skill_utils.providers.base import SkillCandidate, SkillProviderId

logger = get_logger(__name__)

# 检索参数（内部常量，不暴露给工具）
_PER_KEYWORD_TOP_K = 5   # 每个 keyword 保留的候选数
_GLOBAL_TOP_K = 20        # 全局最大候选数

# 来源优先级权重（影响排序分）
_PROVIDER_WEIGHT: dict[SkillProviderId, float] = {
    SkillProviderId.MY_LIBRARY:   1.2,
    SkillProviderId.MAGIC_MARKET: 1.1,
    SkillProviderId.CLAWHUB:      1.0,
    SkillProviderId.SKILLHUB:     1.0,
    SkillProviderId.NPX:          0.9,
    SkillProviderId.GITHUB:       0.8,
}


@dataclass
class KeywordResult:
    """单关键词的检索结果"""

    keyword: str
    candidates: list[SkillCandidate]
    provider_errors: dict[str, str] = field(default_factory=dict)  # provider_id -> error_msg


@dataclass
class SearchResult:
    """全部关键词的聚合检索结果"""

    keyword_results: list[KeywordResult]

    @property
    def all_candidates(self) -> list[SkillCandidate]:
        """返回所有 keyword 候选的去重并集（按 score 降序）"""
        seen: set[tuple] = set()
        merged: list[SkillCandidate] = []
        for kr in self.keyword_results:
            for c in kr.candidates:
                key = (c.provider, c.id)
                if key not in seen:
                    seen.add(key)
                    merged.append(c)
        merged.sort(key=lambda x: x.score, reverse=True)
        return merged[:_GLOBAL_TOP_K]


class SearchAggregator:
    """并发跑所有 enabled provider，归一化打分，按关键词分组返回结果"""

    async def search_many(
        self,
        keywords: list[str],
        *,
        providers: list[str] | None = None,
    ) -> SearchResult:
        """对多个关键词同时发起检索

        每个 keyword × 每个 enabled provider 并发执行，
        失败的 provider 不阻塞其他来源，结果中标注错误信息。

        providers: 限定来源（provider id 字符串列表），None 表示不过滤。
        """
        from app.core.skill_utils.providers.registry import get_registry

        all_enabled = get_registry().enabled_providers()
        if providers is not None:
            provider_set = set(providers)
            all_enabled = [p for p in all_enabled if p.id.value in provider_set]

        if not all_enabled:
            return SearchResult(keyword_results=[
                KeywordResult(keyword=kw, candidates=[]) for kw in keywords
            ])

        # keywords 为空时（仅 my_library 列全量），用空字符串驱动搜索并放大 limit
        effective_keywords = keywords if keywords else [""]
        per_kw_limit = _GLOBAL_TOP_K if not keywords else _PER_KEYWORD_TOP_K

        # 生成所有 (keyword, provider) 组合的 task
        tasks = []
        task_meta = []  # (keyword, provider_id)
        for kw in effective_keywords:
            for p in all_enabled:
                task_meta.append((kw, p.id))
                tasks.append(p.search(kw, limit=per_kw_limit))

        raw_results = await asyncio.gather(*tasks, return_exceptions=True)

        # 按 keyword 分组
        kw_to_candidates: dict[str, list[SkillCandidate]] = {kw: [] for kw in effective_keywords}
        kw_to_errors: dict[str, dict[str, str]] = {kw: {} for kw in effective_keywords}

        for (kw, provider_id), result in zip(task_meta, raw_results):
            if isinstance(result, BaseException):
                kw_to_errors[kw][provider_id.value] = str(result)
                logger.warning(f"[aggregator] {provider_id.value} 搜索 '{kw}' 失败: {result}")
                continue
            # 打分
            for candidate in result:
                candidate.score = self._score(candidate, kw)
            kw_to_candidates[kw].extend(result)

        # 去重 + 排序
        keyword_results = []
        for kw in effective_keywords:
            candidates = _dedup_and_sort(kw_to_candidates[kw], limit=per_kw_limit)
            keyword_results.append(KeywordResult(
                keyword=kw,
                candidates=candidates,
                provider_errors=kw_to_errors[kw],
            ))

        return SearchResult(keyword_results=keyword_results)

    # ── 打分 ──────────────────────────────────────────────────────────────────

    def _score(self, candidate: SkillCandidate, keyword: str) -> float:
        kw_lower = keyword.lower()
        name_lower = candidate.name.lower()
        desc_lower = candidate.description.lower()

        score = 0.0

        # 名称匹配
        if name_lower == kw_lower:
            score += 5.0
        elif name_lower.startswith(kw_lower):
            score += 3.0
        elif kw_lower in name_lower:
            score += 2.0

        # description 匹配
        if kw_lower in desc_lower:
            score += 1.0

        # 来源权重
        weight = _PROVIDER_WEIGHT.get(candidate.provider, 1.0)
        score *= weight

        return score


def _dedup_and_sort(
    candidates: list[SkillCandidate], *, limit: int
) -> list[SkillCandidate]:
    """按 (provider, id) 去重，并按 score 降序取前 limit 条"""
    seen: set[tuple] = set()
    unique: list[SkillCandidate] = []
    for c in candidates:
        key = (c.provider, c.id)
        if key not in seen:
            seen.add(key)
            unique.append(c)
    unique.sort(key=lambda x: x.score, reverse=True)
    return unique[:limit]
