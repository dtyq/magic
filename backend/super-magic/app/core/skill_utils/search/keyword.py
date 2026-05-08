"""KeywordSearchDriver：并发关键词搜索 + 文本评分排序（默认搜索驱动）

对所有 enabled provider 并发执行关键词搜索，
通过文本匹配规则和来源权重对候选打分排序。
"""
from __future__ import annotations

import asyncio

from agentlang.logger import get_logger
from app.core.skill_utils.providers.base import SkillCandidate, SkillProviderId
from app.core.skill_utils.result import KeywordResult, SearchResult
from app.core.skill_utils.search.base import SearchDriver

logger = get_logger(__name__)

_PER_KEYWORD_TOP_K = 5
_GLOBAL_TOP_K = 20

# 来源优先级权重；SYSTEM 最高，确保内置 skill 优先展示
_PROVIDER_WEIGHT: dict[SkillProviderId, float] = {
    SkillProviderId.SYSTEM:       2.0,
    SkillProviderId.MY_LIBRARY:   1.2,
    SkillProviderId.MAGIC_MARKET: 1.1,
    SkillProviderId.CLAWHUB:      1.0,
    SkillProviderId.SKILLHUB:     1.0,
    SkillProviderId.NPX:          0.9,
    SkillProviderId.GITHUB:       0.8,
}


def _text_match_score(text: str, keyword: str) -> float:
    """单字段文本匹配得分（精确 5 / 前缀 3 / 包含 2 / 无 0）"""
    if not text or not keyword:
        return 0.0
    if text == keyword:
        return 5.0
    if text.startswith(keyword):
        return 3.0
    if keyword in text:
        return 2.0
    return 0.0


def _score(candidate: SkillCandidate, keyword: str) -> float:
    kw = keyword.lower()
    raw = 0.0

    raw += _text_match_score(candidate.name.lower(), kw)
    if kw and kw in candidate.description.lower():
        raw += 1.0

    if candidate.extra:
        name_cn = candidate.extra.get("name_cn", "").lower()
        desc_cn = candidate.extra.get("description_cn", "").lower()
        raw += _text_match_score(name_cn, kw)
        if kw and desc_cn and kw in desc_cn:
            raw += 1.0

    score = raw * _PROVIDER_WEIGHT.get(candidate.provider, 1.0)

    if candidate.provider == SkillProviderId.SYSTEM and score == 0.0:
        score = 0.1

    return score


def _dedup(candidates: list[SkillCandidate]) -> list[SkillCandidate]:
    seen: set[tuple] = set()
    unique: list[SkillCandidate] = []
    for c in candidates:
        key = (c.provider, c.id)
        if key not in seen:
            seen.add(key)
            unique.append(c)
    return unique


class KeywordSearchDriver(SearchDriver):
    """默认搜索驱动：并发关键词搜索 + 文本评分排序"""

    async def search(
        self,
        keywords: list[str],
        *,
        providers: list[str] | None = None,
    ) -> SearchResult:
        from app.core.skill_utils.providers.registry import get_registry

        all_enabled = get_registry().enabled_providers()
        if providers is not None:
            provider_set = set(providers)
            all_enabled = [p for p in all_enabled if p.id.value in provider_set]

        if not all_enabled:
            return SearchResult(keyword_results=[
                KeywordResult(keyword=kw, candidates=[]) for kw in keywords
            ])

        effective_keywords = keywords if keywords else [""]
        per_kw_limit = _GLOBAL_TOP_K if not keywords else _PER_KEYWORD_TOP_K

        tasks, task_meta = [], []
        for kw in effective_keywords:
            for p in all_enabled:
                task_meta.append((kw, p.id))
                tasks.append(p.search(kw, limit=per_kw_limit))

        raw_results = await asyncio.gather(*tasks, return_exceptions=True)

        kw_to_candidates: dict[str, list[SkillCandidate]] = {kw: [] for kw in effective_keywords}
        kw_to_errors: dict[str, dict[str, str]] = {kw: {} for kw in effective_keywords}

        for (kw, provider_id), result in zip(task_meta, raw_results):
            if isinstance(result, BaseException):
                kw_to_errors[kw][provider_id.value] = str(result)
                logger.warning(f"[keyword_driver] {provider_id.value} 搜索 '{kw}' 失败: {result}")
                continue
            kw_to_candidates[kw].extend(result)

        keyword_results = []
        for kw in effective_keywords:
            candidates = _dedup(kw_to_candidates[kw])
            for c in candidates:
                c.score = _score(c, kw)
            candidates.sort(key=lambda x: x.score, reverse=True)
            keyword_results.append(KeywordResult(
                keyword=kw,
                candidates=candidates[:per_kw_limit],
                provider_errors=kw_to_errors[kw],
            ))

        return SearchResult(keyword_results=keyword_results)
