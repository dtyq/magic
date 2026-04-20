"""图像生成提示词搜索工具

从 nanobanana 精选图像生成提示词库（1300+ 条）中搜索创意灵感，支持关键词搜索、
分类过滤、随机浏览，结果可直接用于图像生成提示词参考。
"""

import random as random_module
from typing import Any, Dict, List, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.i18n import i18n
from app.path_manager import PathManager
from app.tools.core import BaseTool, BaseToolParams, tool
from app.utils.async_file_utils import async_read_json

logger = get_logger(__name__)

_VALID_SORT_BY = {"rank", "likes", "views", "date"}

# 内存缓存，懒加载单例，asyncio 单事件循环下无需加锁
_prompts_cache: Optional[List[Dict[str, Any]]] = None


async def _load_prompts() -> List[Dict[str, Any]]:
    """懒加载并缓存提示词库数据"""
    global _prompts_cache
    if _prompts_cache is not None:
        return _prompts_cache

    # 在首次调用时解析路径，确保 PathManager 已完成初始化
    # 使用 magic_design 目录，该目录在加密部署环境中可正常访问
    data_path = PathManager.get_project_root() / "app" / "tools" / "magic_design" / "prompts.json"
    try:
        data = await async_read_json(data_path)
        _prompts_cache = data if isinstance(data, list) else []
        logger.info("Loaded %d prompts from library", len(_prompts_cache))
    except Exception as e:
        logger.error("Failed to load prompt library: %s", e)
        _prompts_cache = []

    return _prompts_cache


def _do_search(
    prompts: List[Dict[str, Any]],
    query: Optional[str],
    category: Optional[str],
    sort_by: str,
    limit: int,
    offset: int,
    use_random: bool,
) -> tuple[List[Dict[str, Any]], int]:
    """执行过滤、排序、分页，返回 (当前页结果, 总匹配数)"""
    filtered = prompts

    # 分类精确过滤（不区分大小写）
    if category:
        cat_lower = category.lower()
        filtered = [
            p for p in filtered
            if any(c.lower() == cat_lower for c in p.get("categories", []))
        ]

    # 随机浏览：直接 shuffle 后截取
    if use_random:
        pool = list(filtered)
        random_module.shuffle(pool)
        results = pool[:limit]
        return results, len(results)

    # 关键词搜索：按命中分打分排序
    if query and query.strip():
        keywords = query.lower().split()
        scored: List[tuple[int, int, Dict[str, Any]]] = []
        for p in filtered:
            prompt_text = p.get("prompt", "").lower()
            categories = p.get("categories", [])
            search_text = " ".join([
                prompt_text,
                p.get("author_name", "").lower(),
                p.get("author", "").lower(),
                " ".join(c.lower() for c in categories),
            ])
            score = 0
            for kw in keywords:
                if kw in search_text:
                    score += 1
                    if kw in prompt_text:
                        score += 2
                    if any(kw in c.lower() for c in categories):
                        score += 3
            if score > 0:
                scored.append((score, p.get("rank", 9999), p))

        scored.sort(key=lambda x: (-x[0], x[1]))
        filtered = [item[2] for item in scored]
    else:
        # 无关键词时按字段排序
        if sort_by == "likes":
            filtered = sorted(filtered, key=lambda p: p.get("likes", 0), reverse=True)
        elif sort_by == "views":
            filtered = sorted(filtered, key=lambda p: p.get("views", 0), reverse=True)
        elif sort_by == "date":
            filtered = sorted(filtered, key=lambda p: p.get("date", ""), reverse=True)
        else:
            filtered = sorted(filtered, key=lambda p: p.get("rank", 9999))

    total = len(filtered)
    return filtered[offset: offset + limit], total


def _format_content(results: List[Dict[str, Any]], total_matched: int, offset: int) -> str:
    """将搜索结果格式化为模型可读文本"""
    if not results:
        return "No matching prompts found in the library."

    showing_from = offset + 1
    showing_to = offset + len(results)
    lines = [
        f"Prompt library: {total_matched} match(es) total, showing #{showing_from}–#{showing_to}.\n"
    ]

    for i, p in enumerate(results, 1):
        rank = p.get("rank", "?")
        categories = ", ".join(p.get("categories", []))
        likes = p.get("likes", 0)
        views = p.get("views", 0)
        author = p.get("author_name") or p.get("author", "unknown")
        image = p.get("image", "")
        source = p.get("source_url", "")
        prompt_text = p.get("prompt", "")

        lines.append(f"--- Result {i} (Rank #{rank}) ---")
        lines.append(f"Categories: {categories} | Likes: {likes:,} | Views: {views:,} | Author: @{author}")
        if image:
            lines.append(f"Preview: {image}")
        lines.append(f"\nPrompt:\n{prompt_text}")
        if source:
            lines.append(f"\nSource: {source}")
        lines.append("")

    return "\n".join(lines)


class SearchImagePromptsParams(BaseToolParams):
    query: Optional[str] = Field(
        default=None,
        description="""<!--zh: 关键词搜索，匹配提示词正文、作者名、分类名。留空则按 sort_by 顺序浏览。-->
Keyword search. Matches prompt text, author name, and category names. Leave empty to browse by sort_by order.""",
    )
    category: Optional[str] = Field(
        default=None,
        description="""<!--zh: 分类过滤，不区分大小写。可选值：Photography, Product & Brand, Girl, Food & Drink, Illustration & 3D, App, JSON, Other。-->
Category filter, case-insensitive. Valid values: Photography, Product & Brand, Girl, Food & Drink, Illustration & 3D, App, JSON, Other.""",
    )
    sort_by: str = Field(
        default="rank",
        description="""<!--zh: 排序字段，仅在无 query 时生效。rank（默认，按互动量综合排名）/ likes / views / date。-->
Sort field, only applies when query is empty. One of: rank (default, overall engagement rank), likes, views, date.""",
    )
    limit: int = Field(
        default=5,
        description="""<!--zh: 返回结果数量，默认 5，最大 20。-->
Number of results to return. Default 5, max 20.""",
    )
    offset: int = Field(
        default=0,
        description="""<!--zh: 分页偏移量，默认 0。-->
Pagination offset. Default 0.""",
    )
    random: bool = Field(
        default=False,
        description="""<!--zh: 随机浏览模式。为 True 时忽略 query 和 sort_by，从库中随机抽取 limit 条结果。-->
Random browse mode. When True, ignores query and sort_by and returns random results.""",
    )


@tool()
class SearchImagePrompts(BaseTool[SearchImagePromptsParams]):
    """<!--zh
    从 nanobanana 精选图像生成提示词库（1300+ 条）中搜索创意灵感。
    库中的提示词按互动量排名，涵盖 Photography、Product & Brand、Girl、Food & Drink、
    Illustration & 3D、App、JSON、Other 等分类，每条包含完整提示词原文、预览图和来源链接。
    使用场景：用户需要图像生成灵感时，先搜索库中相关提示词，提取其结构和技法作为参考，
    再结合用户需求写出高质量的生成提示词。
    -->
    Search the nanobanana curated image generation prompt library (1300+ entries) for creative inspiration. Prompts are ranked by engagement and cover Photography, Product & Brand, Girl, Food & Drink, Illustration & 3D, App, JSON, and Other categories. Each entry includes the full prompt text, a preview image URL, and a source link. Use this tool when users need image generation inspiration: search for relevant prompts, extract structural patterns and techniques, then craft a high-quality prompt tailored to the user's needs."""

    async def execute(
        self, tool_context: ToolContext, params: SearchImagePromptsParams
    ) -> ToolResult:
        limit = min(max(1, params.limit), 20)
        offset = max(0, params.offset)
        sort_by = params.sort_by if params.sort_by in _VALID_SORT_BY else "rank"

        prompts = await _load_prompts()
        if not prompts:
            return ToolResult(
                ok=False,
                content="Prompt library is unavailable. The data file may be missing.",
            )

        results, total_matched = _do_search(
            prompts=prompts,
            query=params.query,
            category=params.category,
            sort_by=sort_by,
            limit=limit,
            offset=offset,
            use_random=params.random,
        )

        content = _format_content(results, total_matched, offset)

        data: Dict[str, Any] = {
            "total_matched": total_matched,
            "results": [
                {
                    "rank": p.get("rank"),
                    "id": p.get("id"),
                    "prompt": p.get("prompt"),
                    "categories": p.get("categories", []),
                    "likes": p.get("likes"),
                    "views": p.get("views"),
                    "image": p.get("image"),
                    "images": p.get("images", []),
                    "author_name": p.get("author_name"),
                    "source_url": p.get("source_url"),
                }
                for p in results
            ],
        }

        return ToolResult(ok=True, content=content, data=data)

    # ------------------------------------------------------------------
    # 展示与 i18n
    # ------------------------------------------------------------------

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        if not result.ok:
            return {
                "action": i18n.translate("search_image_prompts", category="tool.actions"),
                "remark": i18n.translate("search_image_prompts.exception", category="tool.messages"),
            }
        count = len((result.data or {}).get("results", []))
        return {
            "action": i18n.translate("search_image_prompts", category="tool.actions"),
            "remark": i18n.translate(
                "search_image_prompts.success",
                category="tool.messages",
                count=count,
            ),
        }
