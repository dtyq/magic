from app.i18n import i18n
import asyncio
import json
import random
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional, Tuple

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from app.core.entity.factory.tool_detail_factory import ToolDetailFactory
from app.core.entity.message.server_message import ToolDetail
from agentlang.tools.tool_result import ToolResult
from app.core.entity.tool.tool_result_types import SearchResult, WebSearchToolResult
from agentlang.logger import get_logger
from app.tools.core import BaseTool, BaseToolParams, tool
from app.utils.xml_escape_fixer import XMLEscapeFixer
from app.tools.web_search_utils import get_search_driver

logger = get_logger(__name__)

# 搜索结果最大数量
MAX_RESULTS = 10


class WebSearchParams(BaseToolParams):
    topic_id: str = Field(
        ...,
        description="""<!--zh: 搜索主题标识符，用于同一主题下的搜索去重。对于同一搜索主题使用相同的topic_id（如'tech-news-research'），确保不同搜索词不会返回重复结果-->
Search topic identifier for deduplication within the same topic. Use the same topic_id for the same search topic (e.g., 'tech-news-research') to ensure different search terms don't return duplicate results"""
    )
    requirements_xml: str = Field(
        ...,
        description="""<!--zh
搜索需求XML配置，示例：
<requirements>
    <requirement>
        <name>OpenAI新闻</name>
        <query>OpenAI GPT-4.1 发布 2025</query>
    </requirement>
    <requirement>
        <name>特斯拉财报</name>
        <query>Tesla Q1 2025 earnings report</query>
        <limit>20</limit>
        <offset>1</offset>
        <time_period>month</time_period>
    </requirement>
</requirements>

格式要求：
- 每个 <requirement> 标签包含一个搜索需求
- 所有文本字段需要进行适当的 XML 转义（如 & 需要写成 &amp;，< 需要写成 &lt; 等）

字段说明：
- name: 需求名称，用于区分搜索结果
- query: 具体搜索关键词，避免宽泛词汇
- limit: 结果数量 (默认10，最大20)
- offset: 分页偏移量 (默认0)
- language: 搜索语言 (默认zh-CN)
- region: 搜索区域 (默认CN)
- time_period: 时间范围 (可选): day/week/month/year

建议使用单个query关键词与多个query关键词以得到足够丰富的搜索结果，如：query="GPT-4.1" 与 query="OpenAI GPT-4.1 发布 2025" 等组合使用
-->
Search requirements XML configuration, example:
<requirements>
    <requirement>
        <name>OpenAI News</name>
        <query>OpenAI GPT-4.1 release 2025</query>
    </requirement>
    <requirement>
        <name>Tesla Earnings</name>
        <query>Tesla Q1 2025 earnings report</query>
        <limit>20</limit>
        <offset>1</offset>
        <time_period>month</time_period>
    </requirement>
</requirements>

Format requirements:
- Each <requirement> tag contains one search requirement
- All text fields need proper XML escaping (e.g., & should be &amp;, < should be &lt;, etc.)

Field descriptions:
- name: Requirement name to distinguish search results
- query: Specific search keywords, avoid broad terms
- limit: Result count (default 10, max 20)
- offset: Pagination offset (default 0)
- language: Search language (default zh-CN)
- region: Search region (default CN)
- time_period: Time range (optional): day/week/month/year

Suggest using both single and multiple query keywords to get rich results, e.g., query="GPT-4.1" and query="OpenAI GPT-4.1 release 2025" in combination"""
    )


def _parse_search_requirements_xml(xml_string: str) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    """解析搜索需求XML字符串

    Args:
        xml_string: XML格式的需求字符串

    Returns:
        Tuple of (requirements_list, fix_message)
        - requirements_list: List of requirement dictionaries
        - fix_message: Optional message about XML fixes made, None if no fixes

    Raises:
        ValueError: XML格式错误或缺少必要字段
    """
    try:
        # Auto-fix XML special characters if needed
        fixed_xml, fixes = XMLEscapeFixer.fix_xml_string(xml_string.strip())
        fix_message = XMLEscapeFixer.format_fixes_message(fixes) if fixes else None

        if fix_message:
            logger.info(f"XML自动修复: {fix_message}")

        # 解析XML
        root = ET.fromstring(fixed_xml)

        if root.tag != 'requirements':
            raise ValueError("XML根节点必须是 <requirements>")

        requirements = []

        for req_element in root.findall('requirement'):
            # 提取必要字段
            name = req_element.find('name')
            query = req_element.find('query')

            # 检查必要字段
            required_fields = [
                ('name', name),
                ('query', query),
            ]

            for field_name, element in required_fields:
                if element is None or not element.text or not element.text.strip():
                    raise ValueError(f"字段 '{field_name}' 不能为空")

            # 提取可选字段并设置默认值
            limit_element = req_element.find('limit')
            limit = 10  # 默认值
            if limit_element is not None and limit_element.text:
                try:
                    limit = int(limit_element.text.strip())
                    if limit < 1 or limit > 20:
                        raise ValueError(f"limit 必须在 1-20 之间，当前值: {limit}")
                except ValueError as e:
                    if "invalid literal" in str(e):
                        raise ValueError(f"limit 必须是数字，当前值: {limit_element.text}")
                    raise

            offset_element = req_element.find('offset')
            offset = 0  # 默认值
            if offset_element is not None and offset_element.text:
                try:
                    offset = int(offset_element.text.strip())
                    if offset < 0:
                        raise ValueError(f"offset 必须大于等于0，当前值: {offset}")
                except ValueError as e:
                    if "invalid literal" in str(e):
                        raise ValueError(f"offset 必须是数字，当前值: {offset_element.text}")
                    raise

            language_element = req_element.find('language')
            language = language_element.text.strip() if language_element is not None and language_element.text else "zh-CN"

            region_element = req_element.find('region')
            region = region_element.text.strip() if region_element is not None and region_element.text else "CN"

            time_period_element = req_element.find('time_period')
            time_period = time_period_element.text.strip() if time_period_element is not None and time_period_element.text else None

            # 构造需求对象
            requirement = {
                'name': name.text.strip(),
                'query': query.text.strip(),
                'limit': limit,
                'offset': offset,
                'language': language,
                'region': region,
                'time_period': time_period
            }

            requirements.append(requirement)

        if not requirements:
            raise ValueError("至少需要一个 <requirement> 元素")

        return requirements, fix_message

    except ET.ParseError as e:
        raise ValueError(f"XML解析错误: {e}")


@tool()
class WebSearch(BaseTool[WebSearchParams]):
    """<!--zh
    互联网搜索工具，支持XML格式配置多个搜索需求并行处理，支持分页搜索。
    请充分利用并发搜索能力，提高搜索效率。
    搜索结果仅提供线索，需通过其它工具阅读网页以获取完整信息。
    搜索结果包含标题、URL、摘要和来源网站。
    -->
    Internet search tool supporting XML format configuration for multiple search requirements with parallel processing and pagination.
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
            # 解析XML需求
            try:
                requirements_data, xml_fix_message = _parse_search_requirements_xml(params.requirements_xml)
            except ValueError as e:
                return WebSearchToolResult.error(f"需求XML解析失败: {e}，请在修正XML数据后重新执行")

            if not requirements_data:
                return WebSearchToolResult(content="搜索需求不能为空，请在修正XML数据后重新执行")

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

            # Add XML fix notification if any fixes were made
            if xml_fix_message:
                message += f"\n\nNote: {xml_fix_message}. Please properly escape special characters when generating XML next time."

            # 设置输出文本
            output_dict = {
                "message": message,
                "topic_id": params.topic_id,
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

            # Store requirement names in extra_info to avoid reparsing XML
            result.extra_info['requirement_names'] = requirement_names

            return result

        except Exception as e:
            logger.exception(f"搜索操作失败: {e!s}")
            return WebSearchToolResult.error("Search operation failed")

    def _handle_requirements_results(self, requirements_data: List[Dict[str, Any]], all_results) -> WebSearchToolResult:
        """格式化多个需求的搜索结果"""
        result = WebSearchToolResult(content="")

        for req_data, search_results in zip(requirements_data, all_results):
            result_key = f"{req_data['name']} ({req_data['query']})"
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
        if not arguments or "requirements_xml" not in arguments:
            return {
                "action": i18n.translate("web_search", category="tool.actions"),
                "remark": i18n.translate("web_search.completed", category="tool.messages")
            }

        try:
            # Get requirement names from extra_info (stored during execute) to avoid reparsing XML
            requirement_names = result.extra_info.get('requirement_names', [])
            if not requirement_names:
                # Fallback: parse XML if extra_info is not available
                requirements_data, _ = _parse_search_requirements_xml(arguments["requirements_xml"])
                requirement_names = [req['name'] for req in requirements_data]

            if len(requirement_names) > 1:
                names_str = ', '.join(requirement_names[:3])
                if len(requirement_names) > 3:
                    names_str += i18n.translate("web_search.more_items", category="tool.messages")
                return {
                    "action": i18n.translate("web_search", category="tool.actions"),
                    "remark": i18n.translate("web_search.requirements", category="tool.messages", requirements=names_str)
                }
            else:
                return {
                    "action": i18n.translate("web_search", category="tool.actions"),
                    "remark": i18n.translate("web_search.requirement", category="tool.messages", requirement=requirement_names[0])
                }
        except Exception:
            return {
                "action": i18n.translate("web_search", category="tool.actions"),
                "remark": i18n.translate("web_search.completed", category="tool.messages")
            }
