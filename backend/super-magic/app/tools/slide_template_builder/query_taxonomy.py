"""Fetch the active slide template category and tag catalog.

Skill: agents/skills/slide-template-maker/SKILL.md
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.tools.core import BaseTool, BaseToolParams, tool
from app.tools.slide_template_builder import taxonomy_source
from app.tools.slide_template_builder.taxonomy import compact_agent_catalog, format_index_content


class QuerySlideTemplateTaxonomyParams(BaseToolParams):
    """No arguments. Returns a short index in content and the full catalog in data."""


@tool(name="query_slide_template_taxonomy", code_mode_only=True)
class QuerySlideTemplateTaxonomy(BaseTool[QuerySlideTemplateTaxonomyParams]):
    """<!--zh
    拉取当前有效的幻灯片模板分类和标签。content 是短索引；完整标签在 result.data。先根据源稿的用途和视觉语义挑选，再列出需要的分组。不要用关键词子串过滤，不要 print 全表，不要猜 code。
    -->
    Fetch the current slide template category and tag catalog. content is a short index; full tags are in result.data. Pick codes by this template's purpose and visuals. List only the groups it needs. Do not substring-search names, print the full catalog, or invent codes.
    """

    name = "query_slide_template_taxonomy"

    async def execute(self, tool_context: ToolContext, params: QuerySlideTemplateTaxonomyParams) -> ToolResult:
        snapshot = await taxonomy_source.resolve_taxonomy(
            taxonomy_source.access_context_from_tool(tool_context)
        )
        catalog = compact_agent_catalog(snapshot.catalog)
        data = {
            "source": snapshot.source,
            "categories": catalog["categories"],
            "groups": catalog["groups"],
        }
        return ToolResult(content=format_index_content(catalog), data=data)

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] | None = None
    ) -> Dict:
        return {
            "tool_name": tool_name,
            "action": i18n.translate("query_slide_template_taxonomy", category="tool.actions"),
            "remark": i18n.translate("query_slide_template_taxonomy.before", category="tool.messages"),
        }

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] | None = None,
    ) -> Dict:
        key = (
            "query_slide_template_taxonomy.after_success"
            if result.ok
            else "query_slide_template_taxonomy.after_failed"
        )
        return {
            "tool_name": tool_name,
            "action": i18n.translate("query_slide_template_taxonomy", category="tool.actions"),
            "remark": i18n.translate(key, category="tool.messages"),
        }

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] | None = None
    ) -> Optional[ToolDetail]:
        title = "Slide template taxonomy"
        body = result.content or "Taxonomy query failed."
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(file_name="slide_template_taxonomy.md", content=f"# {title}\n\n{body}"),
        )
