from app.i18n import i18n
import asyncio
import json
import os
import re
import aiohttp
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional, Tuple

from pydantic import Field

from agentlang.config.config import config
from agentlang.context.tool_context import ToolContext
from agentlang.utils.metadata import MetadataUtil
from app.core.entity.factory.tool_detail_factory import ToolDetailFactory
from app.core.entity.message.server_message import ToolDetail
from agentlang.tools.tool_result import ToolResult
from app.core.entity.tool.tool_result import WebSearchToolResult
from agentlang.logger import get_logger
from app.tools.core import BaseTool, BaseToolParams, tool
from app.utils.xml_escape_fixer import XMLEscapeFixer

logger = get_logger(__name__)

# 搜索结果最大数量
MAX_RESULTS = 10

# 安全搜索配置，默认开启
SAFE_SEARCH_ENABLED = True



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


# 自定义 WebSearchAPI 实现，替代 langchain_community 的 WebSearchAPIWrapper
class WebSearchAPI:
    """自定义的 Bing 搜索 API 包装器"""

    def __init__(self, k: int = 10, search_kwargs: dict = None):
        """
        初始化 Bing 搜索 API 包装器

        Args:
            k: 返回结果数量
            search_kwargs: 搜索参数
        """
        self.k = k
        self.search_kwargs = search_kwargs or {}
        # 从配置管理器获取 API 密钥和搜索 URL，而不是从环境变量
        self.subscription_key = config.get("bing.search_api_key", "")
        self.search_url = config.get("bing.search_endpoint", "https://api.bing.microsoft.com/v7.0") + "/search"
        self.magic_authorization = config.get("sandbox.magic_authorization")

    async def run(self, query: str) -> str:
        """
        执行搜索并返回结果的文本摘要

        Args:
            query: 搜索查询

        Returns:
            str: 搜索结果的文本摘要
        """
        search_results = await self._search(query)
        if not search_results:
            return "No results found"

        # 格式化为文本
        result_str = ""
        for i, result in enumerate(search_results, 1):
            result_str += f"{i}. {result['title']}: {result['snippet']}\n"

        return result_str

    async def results(self, query: str, k: int = None) -> List[Dict[str, Any]]:
        """
        执行搜索并返回结构化结果

        Args:
            query: 搜索查询
            k: 结果数量，覆盖初始化时设置的值

        Returns:
            List[Dict[str, Any]]: 搜索结果列表
        """
        limit = k if k is not None else self.k
        search_results = await self._search(query, limit)
        return search_results

    async def _search(self, query: str, limit: int = None) -> List[Dict[str, Any]]:
        """
        执行实际的 Bing 搜索 API 调用

        Args:
            query: 搜索查询
            limit: 结果数量限制

        Returns:
            List[Dict[str, Any]]: 搜索结果列表
        """
        if not self.subscription_key:
            raise ValueError("Bing Search API key is required")

        # 设置请求头
        headers = {
            "Ocp-Apim-Subscription-Key": self.subscription_key,
            "Accept": "application/json"
        }

        # 添加 api-key 认证头（使用 search_api_key 的值）
        if self.subscription_key:
            headers["api-key"] = self.subscription_key

        # 动态设置最新的 metadata 到请求头（每次调用都获取最新值）
        extra_headers = MetadataUtil.get_llm_request_headers()
        if extra_headers:
            # 给headers请求头塞入extra_headers
            headers.update(extra_headers)
            logger.info(f"互联网搜索动态设置请求头: {list(extra_headers.keys())}")

        # 添加 Magic-Authorization 认证头（如果存在）
        MetadataUtil.add_magic_and_user_authorization_headers(headers)

        # 设置查询参数
        params = {
            "q": query,
            "count": limit or self.k,
            **self.search_kwargs
        }

        # 清理参数
        for k, v in list(params.items()):
            if v is None:
                del params[k]

        try:
            # 发送 HTTP 请求
            async with aiohttp.ClientSession() as session:
                async with session.get(self.search_url, headers=headers, params=params) as response:
                    if response.status != 200:
                        error_detail = await response.text()
                        logger.error(f"Bing Search API 请求失败: {response.status} {error_detail}")
                        return []

                    data = await response.json()

                    # 解析响应数据
                    if "webPages" not in data or "value" not in data["webPages"]:
                        return []

                    results = []
                    for item in data["webPages"]["value"]:
                        results.append({
                            "title": item.get("name", ""),
                            "link": item.get("url", ""),
                            "snippet": item.get("snippet", "")
                        })

                    return results[:limit or self.k]
        except Exception as e:
            logger.error(f"Bing Search API 请求异常: {e}")
            return []


# Magic 搜索 API 包装器
class MagicSearchAPI:
    """自定义的 Magic 搜索 API 包装器（基于 Bing 实现）"""

    def __init__(self, k: int = 10, search_kwargs: dict = None):
        """
        初始化 Magic 搜索 API 包装器

        Args:
            k: 返回结果数量
            search_kwargs: 搜索参数
        """
        self.k = k
        self.search_kwargs = search_kwargs or {}
        # 从环境变量获取 API 密钥和搜索 URL
        self.subscription_key = os.getenv("MAGIC_API_KEY", "")
        magic_base_base_url = os.getenv("MAGIC_API_SERVICE_BASE_URL", "")
        self.search_url = f"{magic_base_base_url}/v2/search" if magic_base_base_url else ""
        self.magic_authorization = config.get("sandbox.magic_authorization")

    async def run(self, query: str) -> str:
        """
        执行搜索并返回结果的文本摘要

        Args:
            query: 搜索查询

        Returns:
            str: 搜索结果的文本摘要
        """
        search_results = await self._search(query)
        if not search_results:
            return "No results found"

        # 格式化为文本
        result_str = ""
        for i, result in enumerate(search_results, 1):
            result_str += f"{i}. {result['title']}: {result['snippet']}\n"

        return result_str

    async def results(self, query: str, k: int = None) -> List[Dict[str, Any]]:
        """
        执行搜索并返回结构化结果

        Args:
            query: 搜索查询
            k: 结果数量，覆盖初始化时设置的值

        Returns:
            List[Dict[str, Any]]: 搜索结果列表
        """
        limit = k if k is not None else self.k
        search_results = await self._search(query, limit)
        return search_results

    async def _search(self, query: str, limit: int = None) -> List[Dict[str, Any]]:
        """
        执行实际的 Magic 搜索 API 调用

        Args:
            query: 搜索查询
            limit: 结果数量限制

        Returns:
            List[Dict[str, Any]]: 搜索结果列表
        """
        if not self.subscription_key:
            raise ValueError("Magic Search API key is required")

        # 设置请求头
        headers = {
            "api-key": self.subscription_key,
            "Accept": "application/json"
        }

        # 动态设置最新的 metadata 到请求头（每次调用都获取最新值）
        extra_headers = MetadataUtil.get_llm_request_headers()
        if extra_headers:
            # 给headers请求头塞入extra_headers
            headers.update(extra_headers)
            logger.info(f"互联网搜索动态设置请求头: {list(extra_headers.keys())}")

        # 添加 Magic-Authorization 认证头（如果存在）
        MetadataUtil.add_magic_and_user_authorization_headers(headers)

        # 设置查询参数
        params = {
            "q": query,
            "count": limit or self.k,
            **self.search_kwargs
        }

        # 清理参数
        for k, v in list(params.items()):
            if v is None:
                del params[k]

        try:
            # 发送 HTTP 请求
            async with aiohttp.ClientSession() as session:
                async with session.get(self.search_url, headers=headers, params=params) as response:
                    if response.status != 200:
                        error_detail = await response.text()
                        logger.error(f"Magic Search API 请求失败: {response.status} {error_detail}")
                        return []

                    data = await response.json()

                    # 解析响应数据
                    if "web_pages" not in data or "value" not in data["web_pages"]:
                        return []

                    results = []
                    for item in data["web_pages"]["value"]:
                        results.append({
                            "title": item.get("name", ""),
                            "link": item.get("url", ""),
                            "snippet": item.get("snippet", "")
                        })

                    return results[:limit or self.k]
        except Exception as e:
            logger.error(f"Magic Search API 请求异常: {e}")
            return []


# Tavily 搜索 API 包装器
class TavilySearchAPI:
    """自定义的 Tavily 搜索 API 包装器"""

    def __init__(self, k: int = 10, search_kwargs: dict = None):
        """
        初始化 Tavily 搜索 API 包装器

        Args:
            k: 返回结果数量
            search_kwargs: 搜索参数
        """
        self.k = k
        self.search_kwargs = search_kwargs or {}
        # 从配置管理器获取 API 密钥和搜索 URL
        self.api_key = config.get("tavily.api_key", "")
        self.api_endpoint = config.get("tavily.api_endpoint", "https://api.tavily.com")
        self.search_endpoint = config.get("tavily.search_endpoint", "/search")
        # 添加Magic-Authorization认证头
        self.magic_authorization = config.get("sandbox.magic_authorization")
        self.search_url = f"{self.api_endpoint}{self.search_endpoint}"

    async def run(self, query: str) -> str:
        """
        执行搜索并返回结果的文本摘要

        Args:
            query: 搜索查询

        Returns:
            str: 搜索结果的文本摘要
        """
        search_results = await self._search(query)
        if not search_results or not search_results.get("results"):
            return "No results found"

        # 格式化为文本，包含 AI 生成的答案和搜索结果
        result_str = ""

        # 添加 AI 生成的答案（如果有）
        if "answer" in search_results and search_results["answer"]:
            result_str += f"AI 生成的答案: {search_results['answer']}\n\n搜索结果:\n"

        # 添加搜索结果
        for i, result in enumerate(search_results["results"], 1):
            result_str += f"{i}. {result['title']}: {result['content']}\n"

        return result_str

    async def results(self, query: str, k: int = None) -> List[Dict[str, Any]]:
        """
        执行搜索并返回结构化结果

        Args:
            query: 搜索查询
            k: 结果数量，覆盖初始化时设置的值

        Returns:
            List[Dict[str, Any]]: 搜索结果列表
        """
        limit = k if k is not None else self.k
        search_results = await self._search(query, limit)

        # 检查结果是否有效
        if not search_results or not search_results.get("results"):
            return []

        # 转换结果格式以与 Bing 搜索结果兼容
        formatted_results = []
        for item in search_results["results"]:
            formatted_results.append({
                "title": item.get("title", ""),
                "link": item.get("url", ""),
                "snippet": item.get("content", ""),
                "domain": self._extract_domain(item.get("url", "")),
                "icon_url": self._get_favicon_url(self._extract_domain(item.get("url", "")))
            })

        return formatted_results

    async def _search(self, query: str, limit: int = None) -> Dict[str, Any]:
        """
        执行实际的 Tavily 搜索 API 调用

        Args:
            query: 搜索查询
            limit: 结果数量限制

        Returns:
            Dict[str, Any]: 搜索结果
        """
        if not self.api_key:
            raise ValueError("Tavily Search API key is required")

        # 设置请求头
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        # 添加 api-key 认证头（使用 api_key 的值）
        if self.api_key:
            headers["api-key"] = self.api_key

        # 添加 Magic-Authorization 认证头（如果存在）
        MetadataUtil.add_magic_and_user_authorization_headers(headers)

        # 设置请求数据
        data = {
            "query": query,
            "max_results": limit or self.k,
            "include_answer": True,
            "search_depth": "basic",
            **self.search_kwargs
        }

        try:
            # 发送 HTTP 请求
            async with aiohttp.ClientSession() as session:
                async with session.post(self.search_url, headers=headers, json=data) as response:
                    if response.status != 200:
                        error_detail = await response.text()
                        logger.error(f"Tavily Search API 请求失败: {response.status} {error_detail}")
                        return {}

                    return await response.json()
        except Exception as e:
            logger.error(f"Tavily Search API 请求异常: {e}")
            return {}

    def _extract_domain(self, url: str) -> str:
        """从URL中提取域名"""
        try:
            domain = re.search(r"https?://([^/]+)", url)
            if domain:
                return domain.group(1)
            return url
        except Exception:
            return url

    def _get_favicon_url(self, domain: str) -> str:
        """生成网站favicon的URL"""
        return f"https://{domain}/favicon.ico"


# Metaso 搜索 API 包装器
class MetasoSearchAPI:
    """自定义的 Metaso 搜索 API 包装器"""

    def __init__(self, k: int = 10, search_kwargs: dict = None):
        """
        初始化 Metaso 搜索 API 包装器

        Args:
            k: 返回结果数量
            search_kwargs: 搜索参数
        """
        self.k = k
        self.search_kwargs = search_kwargs or {}
        # 从配置管理器获取 API 密钥和搜索 URL
        self.api_key = config.get("metaso.api_key", "")
        self.api_endpoint = config.get("metaso.api_endpoint", "https://metaso.cn")
        self.search_endpoint = config.get("metaso.search_endpoint", "/api/v1/search")
        self.search_url = f"{self.api_endpoint}{self.search_endpoint}"

    async def run(self, query: str) -> str:
        """
        执行搜索并返回结果的文本摘要

        Args:
            query: 搜索查询

        Returns:
            str: 搜索结果的文本摘要
        """
        search_results = await self._search(query)
        if not search_results or not search_results.get("webpages"):
            return "No results found"

        # 格式化为文本
        result_str = ""
        for i, result in enumerate(search_results["webpages"], 1):
            result_str += f"{i}. {result['title']}: {result['snippet']}\n"

        return result_str

    async def results(self, query: str, k: int = None, page: int = 1) -> List[Dict[str, Any]]:
        """
        执行搜索并返回结构化结果

        Args:
            query: 搜索查询
            k: 结果数量，覆盖初始化时设置的值
            page: 页码，用于分页

        Returns:
            List[Dict[str, Any]]: 搜索结果列表
        """
        limit = k if k is not None else self.k
        search_results = await self._search(query, limit, page)

        # 检查结果是否有效
        if not search_results or not search_results.get("webpages"):
            return []

        # 转换结果格式以与 Bing 搜索结果兼容
        formatted_results = []
        for item in search_results["webpages"]:
            formatted_results.append({
                "title": item.get("title", ""),
                "link": item.get("link", ""),
                "snippet": item.get("snippet", ""),
                "domain": self._extract_domain(item.get("link", "")),
                "icon_url": self._get_favicon_url(self._extract_domain(item.get("link", ""))),
                "position": item.get("position", 0),
                "authors": item.get("authors", []),
                "date": item.get("date", "")
            })

        return formatted_results

    async def _search(self, query: str, limit: int = None, page: int = 1) -> Dict[str, Any]:
        """
        执行实际的 Metaso 搜索 API 调用

        Args:
            query: 搜索查询
            limit: 结果数量限制
            page: 页码

        Returns:
            Dict[str, Any]: 搜索结果
        """
        if not self.api_key:
            raise ValueError("Metaso Search API key is required")

        # 设置请求头
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
            "Content-Type": "application/json"
        }

        # 添加 api-key 认证头（使用 api_key 的值）
        if self.api_key:
            headers["api-key"] = self.api_key

        # 添加 Magic-Authorization 认证头
        MetadataUtil.add_magic_and_user_authorization_headers(headers)

        # 设置请求数据
        data = {
            "q": query,
            "scope": "webpage",
            "page": str(page),  # Metaso API 要求 page 为字符串
            "includeSummary": False,
            "includeRawContent": False,
            "conciseSnippet": False,
            **self.search_kwargs
        }

        # 只有当 limit 不等于默认值时才添加 size 参数
        if limit and limit != self.k:
            data["size"] = limit

        try:
            # 记录请求详情用于调试
            logger.info(f"Metaso Search API 请求: URL={self.search_url}, Data={data}")

            # 发送 HTTP 请求
            async with aiohttp.ClientSession() as session:
                async with session.post(self.search_url, headers=headers, json=data) as response:
                    if response.status != 200:
                        error_detail = await response.text()
                        logger.error(f"Metaso Search API 请求失败: {response.status} {error_detail}")
                        return {}

                    response_data = await response.json()
                    logger.info(f"Metaso Search API 响应: status={response.status}, webpages_count={len(response_data.get('webpages', []))}")
                    return response_data
        except Exception as e:
            logger.error(f"Metaso Search API 请求异常: {e}")
            return {}

    def _extract_domain(self, url: str) -> str:
        """从URL中提取域名"""
        try:
            domain = re.search(r"https?://([^/]+)", url)
            if domain:
                return domain.group(1)
            return url
        except Exception:
            return url

    def _get_favicon_url(self, domain: str) -> str:
        """生成网站favicon的URL"""
        return f"https://{domain}/favicon.ico"


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
        # 从配置中获取API密钥和端点
        # Bing 搜索配置
        self.bing_api_key = config.get("bing.search_api_key", default="")
        self.bing_endpoint = config.get("bing.search_endpoint", default="https://api.bing.microsoft.com/v7.0")

        # Tavily 搜索配置
        self.tavily_api_key = config.get("tavily.api_key", default="")
        self.tavily_endpoint = config.get("tavily.api_endpoint", default="https://api.tavily.com")

        # Metaso 搜索配置
        self.metaso_api_key = config.get("metaso.api_key", default="")
        self.metaso_endpoint = config.get("metaso.api_endpoint", default="https://metaso.cn")

        # Magic 搜索配置（从环境变量读取）
        self.magic_api_key = os.getenv("MAGIC_API_KEY", "")
        magic_base_base_url = os.getenv("MAGIC_API_SERVICE_BASE_URL", "")
        self.magic_endpoint = f"{magic_base_base_url}/v2/search" if magic_base_base_url else ""

        # 获取默认搜索引擎配置
        self.default_engine = config.get("web_search.default_engine", default="magic").lower()

        # 根据配置和可用性决定使用哪个搜索引擎
        self.use_tavily = False
        self.use_metaso = False
        self.use_magic = False

        # 1. 如果明确指定使用 magic 且 magic 配置有效，则使用 magic
        if self.default_engine == "magic" and self.magic_api_key:
            self.use_magic = True
        # 2. 如果明确指定使用 metaso 且 metaso 配置有效，则使用 metaso
        elif self.default_engine == "metaso" and self.metaso_api_key:
            self.use_metaso = True
        # 3. 如果明确指定使用 tavily 且 tavily 配置有效，则使用 tavily
        elif self.default_engine == "tavily" and self.tavily_api_key:
            self.use_tavily = True
        # 4. 如果明确指定使用 bing 且 bing 配置有效，则使用 bing
        elif self.default_engine == "bing" and self.bing_api_key:
            self.use_tavily = False
            self.use_metaso = False
            self.use_magic = False
        # 5. 回退逻辑：如果首选引擎不可用，尝试其他可用的引擎
        elif not self._get_primary_engine_available():
            if self.magic_api_key:
                self.use_magic = True
            elif self.metaso_api_key:
                self.use_metaso = True
            elif self.tavily_api_key:
                self.use_tavily = True
            elif self.bing_api_key:
                self.use_tavily = False
                self.use_metaso = False
                self.use_magic = False

        # 确定使用的搜索引擎名称
        engine_name = "Magic" if self.use_magic else ("Metaso" if self.use_metaso else ("Tavily" if self.use_tavily else "Bing"))
        logger.info(f"搜索工具初始化，使用搜索引擎: {engine_name}")

    def _get_primary_engine_available(self) -> bool:
        """检查首选搜索引擎是否可用"""
        if self.default_engine == "magic":
            return bool(self.magic_api_key)
        elif self.default_engine == "metaso":
            return bool(self.metaso_api_key)
        elif self.default_engine == "tavily":
            return bool(self.tavily_api_key)
        elif self.default_engine == "bing":
            return bool(self.bing_api_key)
        return False

    def is_available(self) -> bool:
        """
        检查搜索工具是否可用

        检查搜索API的API密钥和端点是否已正确配置

        Returns:
            bool: 如果工具可用返回True，否则返回False
        """
        # 根据当前配置的搜索引擎判断可用性
        if self.use_magic:
            # 检查 Magic 搜索是否可用
            if self.magic_api_key and self.magic_endpoint:
                return True

            # Magic 不可用但是配置文件中指定使用 Magic，尝试回退到其他引擎
            if self.default_engine == "magic":
                logger.warning("指定的 Magic 搜索不可用，尝试使用其他搜索引擎作为备选")
                if self.metaso_api_key and self.metaso_endpoint:
                    self.use_magic = False
                    self.use_metaso = True
                    return True
                elif self.tavily_api_key and self.tavily_endpoint:
                    self.use_magic = False
                    self.use_tavily = True
                    return True
                elif self.bing_api_key and self.bing_endpoint:
                    self.use_magic = False
                    return True
        elif self.use_metaso:
            # 检查 Metaso 搜索是否可用
            if self.metaso_api_key and self.metaso_endpoint:
                return True

            # Metaso 不可用但是配置文件中指定使用 Metaso，尝试回退到其他引擎
            if self.default_engine == "metaso":
                logger.warning("指定的 Metaso 搜索不可用，尝试使用其他搜索引擎作为备选")
                if self.magic_api_key and self.magic_endpoint:
                    self.use_metaso = False
                    self.use_magic = True
                    return True
                elif self.tavily_api_key and self.tavily_endpoint:
                    self.use_metaso = False
                    self.use_tavily = True
                    return True
                elif self.bing_api_key and self.bing_endpoint:
                    self.use_metaso = False
                    return True
        elif self.use_tavily:
            # 检查 Tavily 搜索是否可用
            if self.tavily_api_key and self.tavily_endpoint:
                return True

            # Tavily 不可用但是配置文件中指定使用 Tavily，尝试回退到其他引擎
            if self.default_engine == "tavily":
                logger.warning("指定的 Tavily 搜索不可用，尝试使用其他搜索引擎作为备选")
                if self.magic_api_key and self.magic_endpoint:
                    self.use_tavily = False
                    self.use_magic = True
                    return True
                elif self.metaso_api_key and self.metaso_endpoint:
                    self.use_tavily = False
                    self.use_metaso = True
                    return True
                elif self.bing_api_key and self.bing_endpoint:
                    self.use_tavily = False
                    return True
        else:
            # 检查 Bing 搜索是否可用
            if self.bing_api_key and self.bing_endpoint:
                return True

            # Bing 不可用但是配置文件中指定使用 Bing，尝试回退到其他引擎
            if self.default_engine == "bing":
                logger.warning("指定的 Bing 搜索不可用，尝试使用其他搜索引擎作为备选")
                if self.magic_api_key and self.magic_endpoint:
                    self.use_magic = True
                    return True
                elif self.metaso_api_key and self.metaso_endpoint:
                    self.use_metaso = True
                    return True
                elif self.tavily_api_key and self.tavily_endpoint:
                    self.use_tavily = True
                    return True

        # 记录错误信息
        if self.use_magic:
            if not self.magic_api_key:
                logger.warning("Magic搜索API密钥未配置")
            elif not self.magic_endpoint:
                logger.warning("Magic搜索API端点未配置")
        elif self.use_metaso:
            if not self.metaso_api_key:
                logger.warning("Metaso搜索API密钥未配置")
            elif not self.metaso_endpoint:
                logger.warning("Metaso搜索API端点未配置")
        elif self.use_tavily:
            if not self.tavily_api_key:
                logger.warning("Tavily搜索API密钥未配置")
            elif not self.tavily_endpoint:
                logger.warning("Tavily搜索API端点未配置")
        else:
            if not self.bing_api_key:
                logger.warning("必应搜索API密钥未配置")
            elif not self.bing_endpoint:
                logger.warning("必应搜索API端点未配置")

        # 检查是否有任何可用的搜索引擎作为备选
        if not self.use_magic and not self.use_metaso and not self.use_tavily and not self.bing_api_key:
            # 按优先级尝试备选引擎：Magic > Metaso > Tavily > Bing
            if self.magic_api_key and self.magic_endpoint:
                logger.info("使用 Magic 搜索作为备选")
                self.use_magic = True
                return True
            elif self.metaso_api_key and self.metaso_endpoint:
                logger.info("使用 Metaso 搜索作为备选")
                self.use_metaso = True
                return True
            elif self.tavily_api_key and self.tavily_endpoint:
                logger.info("使用 Tavily 搜索作为备选")
                self.use_tavily = True
                return True
        elif self.use_magic and not self.magic_api_key:
            if self.metaso_api_key and self.metaso_endpoint:
                logger.info("使用 Metaso 搜索作为备选")
                self.use_magic = False
                self.use_metaso = True
                return True
            elif self.tavily_api_key and self.tavily_endpoint:
                logger.info("使用 Tavily 搜索作为备选")
                self.use_magic = False
                self.use_tavily = True
                return True
            elif self.bing_api_key and self.bing_endpoint:
                logger.info("使用 Bing 搜索作为备选")
                self.use_magic = False
                return True
        elif self.use_metaso and not self.metaso_api_key:
            if self.magic_api_key and self.magic_endpoint:
                logger.info("使用 Magic 搜索作为备选")
                self.use_metaso = False
                self.use_magic = True
                return True
            elif self.tavily_api_key and self.tavily_endpoint:
                logger.info("使用 Tavily 搜索作为备选")
                self.use_metaso = False
                self.use_tavily = True
                return True
            elif self.bing_api_key and self.bing_endpoint:
                logger.info("使用 Bing 搜索作为备选")
                self.use_metaso = False
                return True
        elif self.use_tavily and not self.tavily_api_key:
            if self.magic_api_key and self.magic_endpoint:
                logger.info("使用 Magic 搜索作为备选")
                self.use_tavily = False
                self.use_magic = True
                return True
            elif self.metaso_api_key and self.metaso_endpoint:
                logger.info("使用 Metaso 搜索作为备选")
                self.use_tavily = False
                self.use_metaso = True
                return True
            elif self.bing_api_key and self.bing_endpoint:
                logger.info("使用 Bing 搜索作为备选")
                self.use_tavily = False
                return True

        return False

    async def execute(
        self,
        tool_context: ToolContext,
        params: WebSearchParams
    ) -> ToolResult:
        """
        执行搜索并返回格式化的结果。

        Args:
            tool_context: 工具上下文
            params: 搜索参数对象

        Returns:
            WebSearchToolResult: 包含搜索结果的工具结果
        """
        try:
            # 解析XML需求
            try:
                requirements_data, xml_fix_message = _parse_search_requirements_xml(params.requirements_xml)
            except ValueError as e:
                return WebSearchToolResult(error=f"需求XML解析失败: {e}，请在修正XML数据后重新执行")

            if not requirements_data:
                return WebSearchToolResult(content="搜索需求不能为空，请在修正XML数据后重新执行")

            # 记录搜索请求
            api_type = "Metaso" if self.use_metaso else ("Tavily" if self.use_tavily else "Bing")
            logger.info(f"执行{api_type}互联网搜索: 需求数量={len(requirements_data)}")

            # 并发执行所有查询
            tasks = [
                self._perform_search(
                    query=req['query'],
                    limit=req['limit'],
                    offset=req['offset'],
                    language=req['language'],
                    region=req['region'],
                    time_period=req['time_period'],
                )
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
            # 将所有搜索结果展平为列表，只保留必要字段
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
            return WebSearchToolResult(error="Search operation failed")

    def _handle_queries_results(self, queries: List[str], all_results: List[List[Dict[str, Any]]]) -> WebSearchToolResult:
        """
        格式化多个查询的搜索结果

        Args:
            queries: 查询字符串列表
            all_results: 每个查询对应的搜索结果列表

        Returns:
            WebSearchToolResult: 包含所有格式化搜索结果的工具结果
        """
        result = WebSearchToolResult(content="")

        # 格式化所有结果
        for q, search_results in zip(queries, all_results):
            result.set_output_results(q, search_results)
            result.set_search_results(q, search_results)

        return result

    def _handle_requirements_results(self, requirements_data: List[Dict[str, Any]], all_results: List[List[Dict[str, Any]]]) -> WebSearchToolResult:
        """
        格式化多个需求的搜索结果

        Args:
            requirements_data: 需求数据列表
            all_results: 每个需求对应的搜索结果列表

        Returns:
            WebSearchToolResult: 包含所有格式化搜索结果的工具结果
        """
        result = WebSearchToolResult(content="")

        # 格式化所有结果
        for req_data, search_results in zip(requirements_data, all_results):
            # 使用需求名称作为键，但同时保留查询字符串信息
            result_key = f"{req_data['name']} ({req_data['query']})"
            result.set_output_results(result_key, search_results)
            result.set_search_results(result_key, search_results)

        return result

    async def _perform_search(
        self, query: str, limit: int, offset: int, language: str, region: str, time_period: Optional[str]
    ) -> List[Dict[str, Any]]:
        """执行实际的搜索请求，根据配置使用 Magic、Metaso、Tavily 或 Bing"""

        # 检查是否使用 Magic 搜索
        if self.use_magic:
            return await self._perform_magic_search(
                query=query,
                limit=limit,
                offset=offset,
                language=language,
                region=region,
                time_period=time_period
            )
        # 检查是否使用 Metaso 搜索
        elif self.use_metaso:
            return await self._perform_metaso_search(
                query=query,
                limit=limit,
                offset=offset,
                language=language,
                region=region,
                time_period=time_period
            )
        # 检查是否使用 Tavily 搜索
        elif self.use_tavily:
            return await self._perform_tavily_search(
                query=query,
                limit=limit,
                offset=offset,
                language=language,
                region=region,
                time_period=time_period
            )
        else:
            return await self._perform_bing_search(
                query=query,
                limit=limit,
                offset=offset,
                language=language,
                region=region,
                time_period=time_period
            )

    async def _perform_bing_search(
        self, query: str, limit: int, offset: int, language: str, region: str, time_period: Optional[str]
    ) -> List[Dict[str, Any]]:
        """执行 Bing 搜索请求"""
        # 确保limit不超过限制
        limit = min(limit, MAX_RESULTS)

        # 设置搜索参数
        search_params = {
            "count": limit,
            "offset": offset,
            "setLang": language,
            "mkt": f"{language}-{region}",
        }

        # 设置安全搜索（使用常量配置）
        if SAFE_SEARCH_ENABLED:
            search_params["safeSearch"] = "Strict"
        else:
            search_params["safeSearch"] = "Off"

        # 设置时间范围
        if time_period:
            if time_period == "day":
                search_params["freshness"] = "Day"
            elif time_period == "week":
                search_params["freshness"] = "Week"
            elif time_period == "month":
                search_params["freshness"] = "Month"

        try:
            # 创建 WebSearchAPI 实例
            search = WebSearchAPI(
                k=limit,  # 返回结果数量
                search_kwargs={
                    "mkt": f"{language}-{region}",  # 设置区域
                    "setLang": language,  # 设置语言
                    "offset": offset,  # 设置偏移量
                },
            )

            # 执行搜索请求
            # 获取结构化结果
            search_results = await search.results(query, limit)

            # 增强结果，添加来源网站和favicon
            for item in search_results:
                # 提取域名（来源网站）
                domain = self._extract_domain(item["link"])
                item["domain"] = domain
                item["icon_url"] = self._get_favicon_url(domain)

            return search_results

        except Exception as e:
            logger.error(f"必应搜索API请求失败: {e!s}")
            return []  # 返回空结果

    async def _perform_magic_search(
        self, query: str, limit: int, offset: int, language: str, region: str, time_period: Optional[str]
    ) -> List[Dict[str, Any]]:
        """执行 Magic 搜索请求"""
        # 确保limit不超过限制
        limit = min(limit, MAX_RESULTS)

        # 设置搜索参数
        search_params = {
            "count": limit,
            "offset": offset,
            "setLang": language,
            "mkt": f"{language}-{region}",
        }

        # 设置安全搜索（使用常量配置）
        if SAFE_SEARCH_ENABLED:
            search_params["safeSearch"] = "Strict"
        else:
            search_params["safeSearch"] = "Off"

        # 设置时间范围
        if time_period:
            if time_period == "day":
                search_params["freshness"] = "Day"
            elif time_period == "week":
                search_params["freshness"] = "Week"
            elif time_period == "month":
                search_params["freshness"] = "Month"

        try:
            # 创建 MagicSearchAPI 实例
            search = MagicSearchAPI(
                k=limit,  # 返回结果数量
                search_kwargs={
                    "mkt": f"{language}-{region}",  # 设置区域
                    "setLang": language,  # 设置语言
                    "offset": offset,  # 设置偏移量
                },
            )

            # 执行搜索请求
            # 获取结构化结果
            search_results = await search.results(query, limit)

            # 增强结果，添加来源网站和favicon
            for item in search_results:
                # 提取域名（来源网站）
                domain = self._extract_domain(item["link"])
                item["domain"] = domain
                item["icon_url"] = self._get_favicon_url(domain)

            return search_results

        except Exception as e:
            logger.error(f"Magic搜索API请求失败: {e!s}")
            return []  # 返回空结果

    async def _perform_tavily_search(
        self, query: str, limit: int, offset: int, language: str, region: str, time_period: Optional[str]
    ) -> List[Dict[str, Any]]:
        """执行 Tavily 搜索请求"""
        # 确保limit不超过限制
        limit = min(limit, MAX_RESULTS)

        # 设置搜索参数
        search_kwargs = {}

        # 设置时间范围
        if time_period:
            if time_period == "day":
                search_kwargs["days"] = 1
            elif time_period == "week":
                search_kwargs["days"] = 7
            elif time_period == "month":
                search_kwargs["days"] = 30

        # 注意：Tavily API 可能不直接支持offset，这里做一个简单的处理
        # 如果需要实现分页，可能需要在这里做额外的逻辑处理
        try:
            # 创建 TavilySearchAPI 实例
            search = TavilySearchAPI(
                k=limit + offset,  # 获取更多结果以支持offset
                search_kwargs=search_kwargs
            )

            # 执行搜索请求
            search_results = await search.results(query, limit + offset)

            # 手动处理offset（因为Tavily可能不支持offset参数）
            if offset > 0 and len(search_results) > offset:
                search_results = search_results[offset:offset + limit]
            elif offset > 0:
                search_results = []  # 如果offset超出范围，返回空结果
            else:
                search_results = search_results[:limit]

            return search_results

        except Exception as e:
            logger.error(f"Tavily搜索API请求失败: {e!s}")
            return []  # 返回空结果

    async def _perform_metaso_search(
        self, query: str, limit: int, offset: int, language: str, region: str, time_period: Optional[str]
    ) -> List[Dict[str, Any]]:
        """执行 Metaso 搜索请求"""
        # 确保limit不超过限制
        limit = min(limit, MAX_RESULTS)

        # 将 offset 转换为页码（Metaso 使用页码分页）
        page = (offset // limit) + 1 if limit > 0 else 1

        # 设置搜索参数
        search_kwargs = {}

        # 处理时间范围，如果 Metaso 需要特殊处理，可以在这里添加关键词
        if time_period:
            # Metaso API 可能不直接支持时间范围过滤，
            # 可以考虑在查询中添加时间相关关键词
            time_keywords = {
                "day": "今天 最新",
                "week": "本周 近期",
                "month": "本月 最近"
            }
            if time_period in time_keywords:
                query = f"{query} {time_keywords[time_period]}"

        try:
            # 创建 MetasoSearchAPI 实例
            search = MetasoSearchAPI(
                k=limit,
                search_kwargs=search_kwargs
            )

            # 执行搜索请求
            search_results = await search.results(query, limit, page)

            return search_results

        except Exception as e:
            logger.error(f"Metaso搜索API请求失败: {e!s}")
            return []  # 返回空结果

    def _extract_domain(self, url: str) -> str:
        """从URL中提取域名"""
        try:
            domain = re.search(r"https?://([^/]+)", url)
            if domain:
                return domain.group(1)
            return url
        except Exception:
            return url

    def _get_favicon_url(self, domain: str) -> str:
        """生成网站favicon的URL"""
        return f"https://{domain}/favicon.ico"

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        """
        生成工具详情，用于前端展示

        Args:
            tool_context: 工具上下文
            result: 工具结果
            arguments: 工具参数

        Returns:
            Optional[ToolDetail]: 工具详情
        """
        if not result.content:
            return None

        try:
            if not isinstance(result, WebSearchToolResult):
                return None

            # 使用工厂创建展示详情
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
                # 多个搜索需求
                names_str = ', '.join(requirement_names[:3])
                if len(requirement_names) > 3:
                    names_str += i18n.translate("web_search.more_items", category="tool.messages")
                return {
                    "action": i18n.translate("web_search", category="tool.actions"),
                    "remark": i18n.translate("web_search.requirements", category="tool.messages", requirements=names_str)
                }
            else:
                # 单个搜索需求
                return {
                    "action": i18n.translate("web_search", category="tool.actions"),
                    "remark": i18n.translate("web_search.requirement", category="tool.messages", requirement=requirement_names[0])
                }
        except Exception:
            # 如果解析失败，返回通用消息
            return {
                "action": i18n.translate("web_search", category="tool.actions"),
                "remark": i18n.translate("web_search.completed", category="tool.messages")
            }
