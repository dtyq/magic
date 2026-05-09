"""搜索结果模型（与搜索驱动解耦，避免循环依赖）"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.core.skill_utils.providers.base import SkillCandidate

_GLOBAL_TOP_K = 20


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
