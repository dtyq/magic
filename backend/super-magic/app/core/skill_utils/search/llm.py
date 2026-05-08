"""LLMSearchDriver：本地全量扫描 + 外部关键词搜索 + LLM 一次性筛选

搜索流程：
  1. 本地来源（system / my_library）：全量扫描，获取所有已知 skill
  2. 外部来源（market / skillhub / clawhub）：并发关键词搜索
  3. 合并去重，构成完整候选池
  4. 一次 LLM 调用，按 keywords 从候选池中筛选相关 skill
  5. 解析失败或 LLM 调用异常时自动回退到 KeywordSearchDriver

使用方式：
    from app.core.skill_utils.search import LLMSearchDriver
    aggregator = SearchAggregator(search_driver=LLMSearchDriver())
    aggregator = SearchAggregator(search_driver=LLMSearchDriver(model_id="deepseek-v3.2"))
"""
from __future__ import annotations

import asyncio
import json
import re
from dataclasses import replace

from agentlang.logger import get_logger
from app.core.skill_utils.providers.base import SkillCandidate
from app.core.skill_utils.result import KeywordResult, SearchResult
from app.core.skill_utils.search.base import SearchDriver

logger = get_logger(__name__)

# 本地来源：全量扫描（不依赖关键词）
_LOCAL_PROVIDERS = {"system", "my_library"}
# 外部来源：关键词搜索
_EXTERNAL_PROVIDERS = {"market", "skillhub", "clawhub"}

_PER_KEYWORD_TOP_K = 5

_SYSTEM_PROMPT = """\
你是一个技能搜索助手。根据用户的搜索关键词，对候选技能的相关性打分，并调用 score_skills 工具返回结果。

技能来源（provider）说明：
- system：系统内置技能，已预装，无需安装，稳定可靠
- my_library：用户个人技能库，已收藏或安装的技能，使用前可能需要确认是否已安装
- skillhub：官方技能市场，需安装后使用
- clawhub：第三方技能市场，需安装后使用
- market：通用技能市场，需安装后使用

规则：
- 只为与任意关键词相关的技能打分，完全无关的技能跳过
- 分数范围 0.0-5.0，越相关越高；低于 1.0 视为无关，不必返回
- provider 和 id 必须来自候选列表，不能编造
- 如果多个搜索关键词语义相同或高度重叠（如中英文互译、同义词），视为同一查询，只为其中一个关键词返回打分结果，不要重复输出相同内容
- 优先级：system 和 my_library 来源的技能能满足需求时，必须给予更高分数（≥4.0），尤其 provider=system 的内置技能优先级最高；同功能的外部来源技能（skillhub / clawhub / market）分数应低于本地技能\
"""

# tool calling 工具定义：打分而非筛选，逻辑更清晰
_SCORE_SKILLS_TOOL: dict = {
    "type": "function",
    "function": {
        "name": "score_skills",
        "description": "对候选技能与搜索关键词的相关性打分，只需对相关技能打分，无关技能跳过",
        "parameters": {
            "type": "object",
            "properties": {
                "scores": {
                    "type": "array",
                    "description": "相关技能的打分列表，每条记录表示某个技能对某个关键词的相关性得分",
                    "items": {
                        "type": "object",
                        "properties": {
                            "provider": {
                                "type": "string",
                                "description": "技能来源，如 system / my_library / skillhub / clawhub / market",
                            },
                            "id": {
                                "type": "string",
                                "description": "技能唯一 ID",
                            },
                            "keyword": {
                                "type": "string",
                                "description": "与该技能相关的搜索关键词",
                            },
                            "score": {
                                "type": "number",
                                "description": "相关性得分，范围 0.0-5.0，越高越相关",
                            },
                        },
                        "required": ["provider", "id", "keyword", "score"],
                    },
                },
            },
            "required": ["scores"],
        },
    },
}


def _candidate_line(c: SkillCandidate, index: int) -> str:
    desc = (c.description or "").strip()[:100]
    name_cn = (c.extra or {}).get("name_cn", "")
    desc_cn = ((c.extra or {}).get("description_cn", "") or "")[:80]
    extra = ""
    if name_cn:
        extra += f"，中文名：{name_cn}"
    if desc_cn:
        extra += f"，中文描述：{desc_cn}"
    provider_val = c.provider.value if hasattr(c.provider, "value") else str(c.provider)
    return f"{index}. provider={provider_val} ID: {c.id}，名称: {c.name}{extra}，描述: {desc}"


def _build_system_content(system_candidates: list[SkillCandidate]) -> str:
    """构建 system 消息：指令 + 系统内置技能列表（内容稳定，利于缓存）"""
    lines = [_SYSTEM_PROMPT]
    if system_candidates:
        lines.append("\n\n## 系统内置技能（provider=system，优先级最高）\n")
        for i, c in enumerate(system_candidates, 1):
            lines.append(_candidate_line(c, i))
    return "\n".join(lines)


def _build_user_content(user_candidates: list[SkillCandidate], keywords: list[str]) -> str:
    """构建 user 消息：搜索关键词 + 非系统来源候选（随请求变化）"""
    lines = [f"搜索关键词：{json.dumps(keywords, ensure_ascii=False)}"]
    if user_candidates:
        lines.append("\n## 其他候选技能\n")
        for i, c in enumerate(user_candidates, 1):
            lines.append(_candidate_line(c, i))
    lines.append("\n请调用 score_skills 工具对相关技能打分：")
    return "\n".join(lines)


def _parse_tool_call(arguments_json: str) -> list[dict] | None:
    """从 score_skills tool_call arguments 解析打分列表 [{provider, id, keyword, score}]"""
    try:
        args = json.loads(arguments_json)
        raw_scores = args.get("scores")
        if not isinstance(raw_scores, list):
            return None
        result: list[dict] = []
        for item in raw_scores:
            if not isinstance(item, dict):
                continue
            provider = item.get("provider", "")
            skill_id = item.get("id", "")
            keyword = item.get("keyword", "")
            score = item.get("score", 0.0)
            if not skill_id or not keyword:
                continue
            result.append({
                "provider": provider,
                "id": skill_id,
                "keyword": keyword,
                "score": float(score),
            })
        return result
    except (json.JSONDecodeError, ValueError):
        return None


def _parse_text_fallback(text: str) -> list[dict] | None:
    """降级：从文本 JSON 中提取 scores 列表（模型不支持工具时使用）"""
    text = text.strip()
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if not match:
        return None
    try:
        raw = json.loads(match.group())
        if not isinstance(raw, dict):
            return None
        raw_scores = raw.get("scores")
        if isinstance(raw_scores, list):
            return _parse_tool_call(json.dumps({"scores": raw_scores}))
    except (json.JSONDecodeError, ValueError):
        pass
    return None


def _dedup(candidates: list[SkillCandidate]) -> list[SkillCandidate]:
    seen: set[tuple] = set()
    unique: list[SkillCandidate] = []
    for c in candidates:
        key = (c.provider, c.id)
        if key not in seen:
            seen.add(key)
            unique.append(c)
    return unique


class LLMSearchDriver(SearchDriver):
    """LLM 搜索驱动：本地全量 + 外部关键词 + LLM 筛选"""

    def __init__(
        self,
        model_id: str | None = None,
        fallback: SearchDriver | None = None,
    ) -> None:
        self._model_id = model_id
        self._fallback: SearchDriver | None = fallback

    def _get_model_id(self) -> str:
        if self._model_id:
            return self._model_id
        from app.core.ai_abilities import AIAbility, get_ability_config
        return get_ability_config(AIAbility.SKILL_RERANK, "model_id", default="deepseek-v3.2")

    def _get_fallback(self) -> SearchDriver:
        if self._fallback is None:
            from app.core.skill_utils.search.keyword import KeywordSearchDriver
            self._fallback = KeywordSearchDriver()
        return self._fallback

    async def search(
        self,
        keywords: list[str],
        *,
        providers: list[str] | None = None,
    ) -> SearchResult:
        # 全量列出场景直接走 fallback（无关键词，LLM 筛选无意义）
        if not keywords:
            return await self._get_fallback().search(keywords, providers=providers)

        try:
            return await self._llm_search(keywords, providers=providers)
        except Exception as e:
            logger.warning(f"[llm_driver] LLM 搜索失败，回退到关键词驱动: {e}")
            return await self._get_fallback().search(keywords, providers=providers)

    async def _llm_search(
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

        # 按来源类型分组
        local_providers = [p for p in all_enabled if p.id.value in _LOCAL_PROVIDERS]
        external_providers = [p for p in all_enabled if p.id.value in _EXTERNAL_PROVIDERS]

        # 本地来源：全量扫描（empty keyword）
        local_tasks = [(p.id, p.search("", limit=200)) for p in local_providers]
        # 外部来源：所有关键词合并搜索（取并集）
        external_tasks = [
            (p.id, p.search(kw, limit=10))
            for kw in keywords
            for p in external_providers
        ]

        all_tasks = [t[1] for t in local_tasks + external_tasks]
        all_meta = [t[0] for t in local_tasks + external_tasks]
        raw_results = await asyncio.gather(*all_tasks, return_exceptions=True)

        all_candidates: list[SkillCandidate] = []
        provider_errors: dict[str, str] = {}

        for provider_id, result in zip(all_meta, raw_results):
            if isinstance(result, BaseException):
                provider_errors[provider_id.value] = str(result)
                logger.warning(f"[llm_driver] {provider_id.value} 搜索失败: {result}")
                continue
            all_candidates.extend(result)

        all_candidates = _dedup(all_candidates)

        if not all_candidates:
            return SearchResult(keyword_results=[
                KeywordResult(keyword=kw, candidates=[], provider_errors=provider_errors)
                for kw in keywords
            ])

        # LLM 对候选打分，返回 [{provider, id, keyword, score}] 扁平列表
        score_entries = await self._call_llm(all_candidates, keywords)

        # 构建双层索引：优先 (provider, id)，备用 id（文本降级时 provider 可能为空）
        full_map: dict[tuple[str, str], SkillCandidate] = {
            (c.provider.value, c.id): c for c in all_candidates
        }
        id_only_map: dict[str, SkillCandidate] = {}
        for c in all_candidates:
            id_only_map.setdefault(c.id, c)

        # 按关键词分组，同一 (provider, id) 取最高分
        kw_scored: dict[str, dict[tuple[str, str], float]] = {kw: {} for kw in keywords}
        for entry in score_entries:
            kw = entry["keyword"]
            if kw not in kw_scored:
                continue
            key = (entry["provider"], entry["id"])
            prev = kw_scored[kw].get(key, 0.0)
            kw_scored[kw][key] = max(prev, entry["score"])

        keyword_results = []
        for kw in keywords:
            scored_map = kw_scored.get(kw, {})
            # 按分数降序，取 Top K
            sorted_keys = sorted(scored_map.items(), key=lambda x: x[1], reverse=True)
            candidates = []
            for (provider_val, skill_id), score in sorted_keys[:_PER_KEYWORD_TOP_K]:
                original = full_map.get((provider_val, skill_id)) or id_only_map.get(skill_id)
                if original is None:
                    continue
                # 用 LLM 打分覆盖 score，其余字段保留原始值
                c = replace(original, score=score)
                candidates.append(c)
            keyword_results.append(KeywordResult(
                keyword=kw,
                candidates=candidates,
                provider_errors=provider_errors,
            ))

        return SearchResult(keyword_results=keyword_results)

    async def _call_llm(
        self,
        candidates: list[SkillCandidate],
        keywords: list[str],
    ) -> list[dict]:
        from agentlang.llms.factory import LLMFactory
        from agentlang.llms.processors.processor_config import ProcessorConfig

        # 系统 skill 放入 system 消息（内容稳定，利于 prompt cache 命中）
        # 其余候选放入 user 消息（随关键词/外部搜索结果变化）
        system_candidates = [c for c in candidates if c.provider.value == "system"]
        user_candidates = [c for c in candidates if c.provider.value != "system"]

        model_id = self._get_model_id()
        messages = [
            {"role": "system", "content": _build_system_content(system_candidates)},
            {"role": "user", "content": _build_user_content(user_candidates, keywords)},
        ]

        from app.tools.media_utils import DISABLE_THINKING_BODY

        processor_config = ProcessorConfig.create_default()
        processor_config.streaming_enabled = False

        response = await LLMFactory.call_with_tool_support(
            model_id=model_id,
            messages=messages,
            tools=[_SCORE_SKILLS_TOOL],
            processor_config=processor_config,
            extra_body=DISABLE_THINKING_BODY,
        )

        choice = response.choices[0]
        tool_calls = getattr(choice.message, "tool_calls", None)

        # 优先从 tool_call arguments 解析（结构有 schema 保障）
        if tool_calls:
            arguments_json = tool_calls[0].function.arguments
            logger.debug(f"[llm_driver] tool_call model={model_id}, keywords={keywords}, args={arguments_json[:300]}")
            result = _parse_tool_call(arguments_json)
            if result is not None:
                return result
            logger.warning(f"[llm_driver] tool_call 解析失败，尝试文本降级: {arguments_json[:100]!r}")

        # 降级：模型不支持工具或未调用工具时，从文本内容解析
        raw_text = choice.message.content or ""
        logger.debug(f"[llm_driver] text fallback model={model_id}, keywords={keywords}, response={raw_text[:300]}")
        result = _parse_text_fallback(raw_text)
        if result is None:
            raise ValueError(f"LLM 返回内容无法解析（tool_call 和文本均失败）: {raw_text[:100]!r}")

        return result
