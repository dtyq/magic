"""Skill 搜索驱动包

新增驱动：继承 SearchDriver，实现 async search(keywords, *, providers) -> SearchResult，
传入 SearchAggregator(search_driver=YourDriver()) 即可。
"""
from app.core.skill_utils.search.base import SearchDriver
from app.core.skill_utils.search.keyword import KeywordSearchDriver
from app.core.skill_utils.search.llm import LLMSearchDriver

__all__ = [
    "SearchDriver",
    "KeywordSearchDriver",
    "LLMSearchDriver",
]
