from app.i18n import i18n
import asyncio
import json
import random
import enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from agentlang.context.tool_context import ToolContext
from app.core.entity.factory.tool_detail_factory import ToolDetailFactory
from app.core.entity.message.server_message import ToolDetail
from agentlang.tools.tool_result import ToolResult
from app.core.entity.tool.tool_result_types import SearchResult, WebSearchToolResult
from agentlang.logger import get_logger
from app.tools.core import BaseTool, BaseToolParams, tool
from app.tools.web_search_utils import get_search_driver

logger = get_logger(__name__)

# 搜索结果最大数量
MAX_RESULTS = 10


class SearchTimePeriod(enum.StrEnum):
    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    YEAR = "year"


class WebSearchRequirement(BaseModel):
    # 字段默认值与既有搜索驱动保持一致；类 docstring 会进入模型 Schema，不放内部说明。
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(
        min_length=1,
        description="""<!--zh: 需求名称，用于区分搜索结果。-->
Name identifying this search requirement in the results.""",
    )
    query: str = Field(
        min_length=1,
        description="""<!--zh: 具体搜索关键词，避免宽泛词汇；可将单一主题词与详细关键词分别作为需求搜索，以丰富结果。-->
Specific search keywords. Avoid vague terms; use separate requirements for a subject keyword and a more detailed query to broaden coverage.""",
    )
    limit: int = Field(
        default=10,
        ge=1,
        le=20,
        description="""<!--zh: 返回结果数量，默认 10，范围 1–20。-->
Requested result count, from 1 to 20; defaults to 10.""",
    )
    offset: int = Field(
        default=0,
        ge=0,
        description="""<!--zh: 分页偏移量，默认 0，不得为负数。-->
Non-negative pagination offset; defaults to 0.""",
    )
    language: str = Field(
        default="zh-CN",
        description="""<!--zh: 搜索语言，默认 zh-CN。-->
Search language; defaults to 'zh-CN'.""",
    )
    region: str = Field(
        default="CN",
        description="""<!--zh: 搜索区域，默认 CN。-->
Search region; defaults to 'CN'.""",
    )
    time_period: SearchTimePeriod | None = Field(
        default=None,
        description="""<!--zh: 时间范围：day/week/month/year；省略表示不限。-->
Time range: day, week, month, or year. Omit for no time restriction.""",
    )

    @field_validator("language")
    @classmethod
    def normalize_language(cls, value: str) -> str:
        return value or "zh-CN"

    @field_validator("region")
    @classmethod
    def normalize_region(cls, value: str) -> str:
        return value or "CN"


class WebSearchParams(BaseToolParams):
    model_config = ConfigDict(extra="forbid")

    search_group_name: str = Field(
        ...,
        description="""<!--zh: 自行为这组相关搜索起一个简短名称，如 industry-report。同组后续搜索复用完全相同的名称；独立搜索使用新名称。仅标记结果所属分组，不做去重。名称由你创建，不要查询或填写平台话题 ID。-->
Choose a short name for this group of related searches, such as 'industry-report'. Reuse the exact name for follow-up searches in the same group; choose a new name for a separate group. This only labels the results; it does not deduplicate them. Create the name yourself; do not look up or use the platform conversation ID.""",
    )
    requirements: list[WebSearchRequirement] = Field(
        min_length=1,
        description="""<!--zh: 搜索需求列表，每项独立搜索，多个需求并发处理。直接传对象数组，不要序列化为字符串。-->
Web search requirements; each item runs a search, and multiple items run concurrently. Pass an array of objects, not a serialized string.""",
    )


@tool()
class WebSearch(BaseTool[WebSearchParams]):
    """<!--zh
    互联网搜索工具，支持多个搜索需求并行处理和分页搜索。
    请充分利用并发搜索能力，提高搜索效率。
    搜索结果仅提供线索，需通过其它工具阅读网页以获取完整信息。
    搜索结果包含标题、URL、摘要和来源网站。
    -->
    Internet search tool supporting multiple search requirements with parallel processing and pagination.
    Make full use of concurrent search capabilities to improve efficiency.
    Search results only provide clues; use other tools to read webpages for complete information.
    Search results include title, URL, summary, and source website.
    """

    def __init__(self, **data):
        super().__init__(**data)
        self.driver = get_search_driver()

    def is_available(self) -> bool:
        return self.driver is not None and self.driver.is_available()

    async def execute(
        self,
        tool_context: ToolContext,
        params: WebSearchParams
    ) -> ToolResult:
        """执行搜索并返回格式化的结果。"""
        try:
            requirements_data = [requirement.model_dump(mode="json") for requirement in params.requirements]

            logger.info(f"执行互联网搜索: 需求数量={len(requirements_data)}, 驱动={self.driver.__class__.__name__}")

            # 并发执行所有查询
            # 每个请求随机延迟，避免同时到达上游触发限流
            async def _staggered_search(req: dict):
                await asyncio.sleep(random.uniform(0, 1.0))
                return await self.driver.search(
                    query=req['query'],
                    limit=req['limit'],
                    offset=req['offset'],
                    language=req['language'],
                    region=req['region'],
                    time_period=req['time_period'],
                )

            tasks = [
                _staggered_search(req)
                for req in requirements_data
            ]
            all_results = await asyncio.gather(*tasks)

            # 创建结构化结果
            result = self._handle_requirements_results(requirements_data, all_results)

            # 构建消息
            requirement_names = [req['name'] for req in requirements_data]
            if len(requirement_names) > 1:
                message = f"Search completed: {', '.join(requirement_names)}"
            else:
                message = f"Search completed: {requirement_names[0]}"

            # 提醒大模型：搜索结果只是摘要片段，须读取网页原文才能作为证据
            message += "\n\n[Note] These results are snippet previews only, not full content — do not use them as evidence for conclusions. Read the full content of key pages as needed before drawing conclusions."

            # 设置输出文本
            output_dict = {
                "message": message,
                "search_group_name": params.search_group_name,
                "requirements": requirement_names,
                "results": result.output_results_to_dict()
            }
            result.content = json.dumps(output_dict, ensure_ascii=False)

            # 设置 data 字段，方便 agent 编码访问
            all_results_list = []
            for requirement_name, search_results in result.output_results.items():
                for search_result in search_results:
                    all_results_list.append({
                        "url": search_result.url,
                        "title": search_result.title,
                        "snippet": search_result.snippet if search_result.snippet else ""
                    })
            result.data = {"results": all_results_list}

            # 保存已校验的需求名称，供结果展示直接使用。
            result.extra_info['requirement_names'] = requirement_names

            return result

        except Exception as e:
            logger.exception(f"搜索操作失败: {e!s}")
            return WebSearchToolResult.error("Search operation failed")

    def _handle_requirements_results(self, requirements_data: List[Dict[str, Any]], all_results) -> WebSearchToolResult:
        """格式化多个需求的搜索结果"""
        result = WebSearchToolResult(content="")
        query_by_keyword: dict[str, str] = {}

        for req_data, search_results in zip(requirements_data, all_results):
            result_key = f"{req_data['name']} ({req_data['query']})"
            query_by_keyword[result_key] = req_data['query']
            # 驱动返回 List[SearchResultItem]，直接转为 SearchResult
            output_models = [
                SearchResult(
                    title=item.title,
                    url=item.link,
                    snippet=item.snippet or None,
                )
                for item in search_results
            ]
            search_models = [
                SearchResult(
                    title=item.title,
                    url=item.link,
                    snippet=item.snippet or None,
                    source=item.domain or None,
                    icon_url=item.icon_url or None,
                )
                for item in search_results
            ]
            result.output_results[result_key] = output_models
            result.search_results[result_key] = search_models

        # 详情显示真实查询词，分组身份仍保留 name(query)；不改模型输出，也不重新解析请求。
        result.extra_info['search_queries'] = query_by_keyword
        return result

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        """生成工具详情，用于前端展示"""
        if not result.content:
            return None

        try:
            if not isinstance(result, WebSearchToolResult):
                return None

            return ToolDetailFactory.create_search_detail_from_search_results(
                search_results=result.search_results,
                query_by_keyword=result.extra_info.get('search_queries'),
            )
        except Exception as e:
            logger.error(f"生成工具详情失败: {e!s}")
            return None

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None) -> Dict:
        """获取工具调用后的友好动作和备注"""
        # 处理错误情况
        if not result.ok:
            return {
                "action": i18n.translate("web_search", category="tool.actions"),
                "remark": i18n.translate("web_search.error", category="tool.messages", error=result.content)
            }

        # 处理成功情况
        # 消息卡片靠真实查询词区分搜索批次；内部 name 只用于关联结果，详情另行展示完整查询。
        queries: list[str] = []
        search_queries = result.extra_info.get('search_queries')
        if isinstance(search_queries, dict):
            queries = [
                query.strip()
                for query in search_queries.values()
                if isinstance(query, str) and query.strip()
            ]

        if not queries and arguments:
            requirements = arguments.get('requirements')
            if isinstance(requirements, list):
                for requirement in requirements:
                    if not isinstance(requirement, dict):
                        continue
                    query = requirement.get('query')
                    if isinstance(query, str) and query.strip():
                        queries.append(query.strip())

        if len(queries) == 1:
            remark = i18n.translate("web_search.requirement", category="tool.messages", requirement=queries[0])
        elif queries:
            query_summary = ', '.join(queries[:3])
            if len(queries) > 3:
                query_summary += i18n.translate("web_search.more_items", category="tool.messages")
            remark = i18n.translate("web_search.requirements", category="tool.messages", requirements=query_summary)
        else:
            remark = i18n.translate("web_search.completed", category="tool.messages")

        return {
            "action": i18n.translate("web_search", category="tool.actions"),
            "remark": remark
        }
