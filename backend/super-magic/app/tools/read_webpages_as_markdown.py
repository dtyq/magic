"""Batch webpage content reading tool

This tool reads multiple webpages and aggregates their content into a single markdown document.
It leverages the browser's goto_and_read_as_markdown operation with summarize mode enabled.
"""

from app.i18n import i18n
import asyncio
import os
import re
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field

from agentlang.context.tool_context import ToolContext
from agentlang.config.config import config
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.tools.core import BaseToolParams, tool
from magic_use.magic_browser import MagicBrowser
from app.tools.workspace_tool import WorkspaceTool
from app.tools.webview_utils import (
    WebviewContentParams, process_webview_content, goto_external_website_with_referer
)
from app.infrastructure.sdk.magic_service.api.web_scrape_client import WebScrapeClient, WebScrapeResponse

logger = get_logger(__name__)

# Maximum number of concurrent webpage requests
MAX_CONCURRENT_REQUESTS = 10

# Base64 检测阈值（超过这个长度的连续字母数字字符串被认为是 base64）
BASE64_DETECTION_THRESHOLD = 1000


def _detect_and_clean_noise_content(content: str, url: str) -> str:
    """检测并清理内容中的噪音数据（base64、Data URI 等）

    Args:
        content: 待检测的内容
        url: 原始 URL（用于判断文件类型）

    Returns:
        str: 处理后的内容，噪音数据已替换为友好提示
    """
    if not content or len(content) < BASE64_DETECTION_THRESHOLD:
        return content

    # 检测 Data URI（需要先检测，因为包含 base64）
    # 匹配 data:image/xxx;base64,... 或 data:application/xxx;base64,...
    # 至少 500 字符的 Data URI
    data_uri_pattern = r'data:(image|application|audio|video)/([^;,]+);base64,([A-Za-z0-9+/=]{500,})'

    # 检测 PDF base64 特征（以 JVBERi 开头，这是 "%PDF-" 的 base64 编码）
    pdf_pattern = r'JVBERi[0-9a-zA-Z+/=]{100,}'

    # 检测通用 base64 特征（长串连续的字母数字加上 +/= 字符）
    # 匹配至少 1000 个字符的 base64 串
    general_base64_pattern = r'[A-Za-z0-9+/]{1000,}={0,2}'

    # 判断文件类型
    is_pdf = url.lower().endswith('.pdf')

    def replace_data_uri(match):
        """替换匹配到的 Data URI"""
        mime_type = match.group(1)  # image, application, etc.
        sub_type = match.group(2)    # png, jpeg, pdf, etc.
        base64_data = match.group(3)
        size_kb = len(base64_data) / 1024

        replacement = f"**[内嵌 {mime_type.upper()}/{sub_type.upper()} 文件，约 {size_kb:.1f} KB，已省略]**"

        logger.info(f"检测到并替换了 Data URI: URL={url}, 类型={mime_type}/{sub_type}, 大小={size_kb:.1f}KB")
        return replacement

    def replace_base64(match):
        """替换匹配到的 base64 内容"""
        matched_text = match.group(0)
        size_kb = len(matched_text) / 1024

        # 根据 URL 判断是 PDF 还是其他类型
        if is_pdf:
            replacement = f"\n\n---\n\n⚠️ **检测到大型 PDF 文件内容** (约 {size_kb:.1f} KB)\n\n"
            replacement += "此 URL 指向一个 PDF 文件，但返回了 base64 编码的原始数据。\n\n"
            replacement += "**建议操作**：\n"
            replacement += "1. 先使用 `download_from_url` 工具下载 PDF 文件到本地\n"
            replacement += "2. 然后使用 `convert_to_markdown` 工具转换为 Markdown：\n"
            replacement += "   ```\n"
            replacement += "   {\n"
            replacement += '     "input_path": "downloads/your-file.pdf",\n'
            replacement += '     "output_path": "converted/your-file.md"\n'
            replacement += "   }\n"
            replacement += "   ```\n\n"
            replacement += "原始 base64 数据过大，已省略显示。\n\n---\n\n"
        else:
            # 可能是图片或其他二进制文件
            replacement = f"\n\n---\n\n⚠️ **检测到 Base64 编码内容** (约 {size_kb:.1f} KB)\n\n"
            replacement += "此内容包含大量 base64 编码数据（可能是嵌入的图片或其他二进制文件）。\n\n"
            replacement += "为避免传输大量无意义数据，已省略显示。如需处理此文件，请考虑：\n"
            replacement += "1. 使用 `download_from_url` 工具先下载文件到本地\n"
            replacement += "2. 使用 `convert_to_markdown` 工具处理已下载的文件\n\n---\n\n"

        logger.info(f"检测到并替换了 base64 内容: URL={url}, 大小={size_kb:.1f}KB, 类型={'PDF' if is_pdf else '未知'}")
        return replacement

    # 1. 先检测并替换 Data URI（最具体的模式）
    data_uri_matches = list(re.finditer(data_uri_pattern, content))
    if data_uri_matches:
        logger.warning(f"检测到 {len(data_uri_matches)} 个 Data URI: {url}")
        content = re.sub(data_uri_pattern, replace_data_uri, content)

    # 2. 检测 PDF 特征
    if re.search(pdf_pattern, content):
        logger.warning(f"检测到 PDF base64 内容: {url}")
        content = re.sub(pdf_pattern, replace_base64, content)

    # 3. 再检测通用 base64 特征
    matches = list(re.finditer(general_base64_pattern, content))
    if matches:
        logger.warning(f"检测到 {len(matches)} 个大型 base64 片段: {url}")
        content = re.sub(general_base64_pattern, replace_base64, content)

    return content


class ReadWebpagesAsMarkdownParams(BaseToolParams):
    urls: List[str] = Field(
        ...,
        description="""<!--zh: 需要读取并转换为 markdown 的网页 URL 列表-->
List of webpage URLs to read and convert to markdown""",
        min_length=1
    )
    requirements: str = Field(
        default="",
        description="""<!--zh: 提炼要求。为空时返回网页原文；非空时按该要求提炼网页内容-->
Refinement requirements. Empty returns original webpage content; non-empty refines content based on this requirement."""
    )


class WebpageReadingResult(BaseModel):
    """Result of reading a single webpage"""
    url: str
    title: str = ""
    content: str = ""
    is_success: bool = False
    error_message: Optional[str] = None
    # Data source: "browser" (default) or "search_api" (fallback)
    source: str = "browser"


@tool()
class ReadWebpagesAsMarkdown(WorkspaceTool[ReadWebpagesAsMarkdownParams]):
    """<!--zh: 批量网页读取工具，将多个网页内容聚合为单个markdown文档。-->
Batch webpage reading tool that aggregates multiple webpage contents into single markdown document.
    """

    async def _fetch_via_search_api(
        self,
        tool_context: ToolContext,
        url: str,
        current_idx: int,
        total_count: int,
        requirements: str = ""
    ) -> WebpageReadingResult:
        """
        使用 WebScrape 获取网页内容

        Args:
            tool_context: 工具上下文
            url: 目标URL
            current_idx: 当前索引
            total_count: 总数
            requirements: 提炼要求。为空返回原文，非空按要求提炼

        Returns:
            WebpageReadingResult: 处理结果
        """
        url_start_time = asyncio.get_event_loop().time()

        try:
            # 检查是否启用 API
            if not config.get("web_scraping.enable_search_api_fallback", False):
                return WebpageReadingResult(
                    url=url,
                    is_success=False,
                    error_message="WebScrape 功能未启用",
                    source="search_api"
                )

            # 从配置读取 API 参数
            magic_service_base_url = os.getenv("MAGIC_API_SERVICE_BASE_URL")
            #拼凑 WebScrape 端点 magic_service_base_url . /v2/web-scrape
            endpoint = f"{magic_service_base_url.rstrip('/')}/v2/web-scrape" if magic_service_base_url else ""
            token = config.get("web_scraping.search_api.token")
            timeout = config.get("web_scraping.search_api.timeout", 30)
            mode = config.get("web_scraping.search_api.mode", "quality")

            # 检查配置完整性
            if not endpoint or not token:
                logger.warning(
                    "WebScrape 配置不完整 - "
                    f"endpoint: {'已配置' if endpoint else '未配置'}, "
                    f"token: {'已配置' if token else '未配置'}"
                )
                return WebpageReadingResult(
                    url=url,
                    is_success=False,
                    error_message="WebScrape 配置不完整",
                    source="search_api"
                )

            logger.info(f"[API Mode] Processing {current_idx}/{total_count}: {url}")

            # 创建客户端并调用 API (类似 WebWebScrape 的用法)
            webScrapeClient = WebScrapeClient(
                endpoint=endpoint,
                token=token,
                timeout=timeout,
                mode=mode
            )
            response: WebScrapeResponse = await webScrapeClient.fetch_webpage(url)

            # 转换为Markdown格式
            content = response.markdown
            title = response.site_name or "未知标题"

            # 记录API使用情况
            logger.info(
                f"[API Mode] 成功获取: {url} - "
                f"内容长度: {len(content)} 字符, "
                f"Usage: {response.usage}"
            )

            # 检测并清理噪音内容（在 Summarize 之前处理，避免 LLM 幻觉）
            content = _detect_and_clean_noise_content(content, url)

            processed_content, _ = await self._process_content_by_requirements(
                tool_context=tool_context,
                content=content,
                title=title,
                url=url,
                requirements=requirements
            )

            url_end_time = asyncio.get_event_loop().time()
            url_processing_time = url_end_time - url_start_time

            logger.info(
                f"[API Mode] 处理完成 {current_idx}/{total_count} "
                f"用时 {url_processing_time:.2f}s: {url}"
            )

            return WebpageReadingResult(
                url=url,
                title=title,
                content=processed_content,
                is_success=True,
                source="search_api"  # 标记数据来源
            )

        except Exception as e:
            logger.error(f"[API Mode] 获取失败: {url}, 错误: {e}", exc_info=True)
            return WebpageReadingResult(
                url=url,
                is_success=False,
                error_message=f"网页获取失败: {str(e)}",
                source="search_api"
            )

    async def execute(self, tool_context: ToolContext, params: ReadWebpagesAsMarkdownParams) -> ToolResult:
        """
        Execute batch webpage reading operation with concurrent processing

        Args:
            tool_context: Tool execution context
            params: Parameters containing the list of URLs to process

        Returns:
            ToolResult: Aggregated markdown content from all webpages
        """
        if not params.urls:
            return ToolResult.error("No URLs provided for reading")

        urls = params.urls
        start_time = asyncio.get_event_loop().time()
        logger.info(f"Starting concurrent batch webpage reading for {len(urls)} URLs with max {MAX_CONCURRENT_REQUESTS} concurrent requests")

        # Create semaphore to limit concurrent requests
        semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)

        # Create tasks for concurrent processing
        tasks = [
            self._process_single_url(
                tool_context, url, semaphore, idx + 1, len(urls),
                params.requirements
            )
            for idx, url in enumerate(urls)
        ]

        # Execute all tasks concurrently with optimized exception handling
        results = await asyncio.gather(*tasks, return_exceptions=True)

        end_time = asyncio.get_event_loop().time()
        total_time = end_time - start_time
        logger.info(f"Concurrent processing completed in {total_time:.2f} seconds (avg: {total_time/len(urls):.2f}s per URL)")

        # Process results and handle any exceptions
        processed_results = []
        for idx, result in enumerate(results):
            if isinstance(result, Exception):
                # Handle exceptions that occurred during processing
                error_msg = f"Unexpected error processing URL: {str(result)}"
                processed_results.append(WebpageReadingResult(
                    url=urls[idx],
                    is_success=False,
                    error_message=error_msg
                ))
                logger.error(f"Exception while processing URL {urls[idx]}: {result}", exc_info=True)
            else:
                processed_results.append(result)

        # Generate aggregated result
        formatted_result = self._format_results(processed_results, params.requirements)

        # Generate summary statistics
        total_urls = len(urls)
        success_count = sum(1 for r in processed_results if r.is_success)
        failure_count = total_urls - success_count

        logger.info(f"Concurrent batch webpage reading completed: "
                    f"Processed {total_urls} webpages concurrently, "
                    f"Success: {success_count}, "
                    f"Failed: {failure_count}")

        # 构建 data 字段，方便 agent 编码访问
        # 将所有网页内容整理为列表，只保留必要字段
        webpages_list = []
        for result in processed_results:
            webpages_list.append({
                "url": result.url,
                "title": result.title,
                "content": result.content if result.is_success else "",
                "is_success": result.is_success
            })

        return ToolResult(
            content=formatted_result,
            data={"webpages": webpages_list}
        )

    async def _process_single_url(
        self,
        tool_context: ToolContext,
        url: str,
        semaphore: asyncio.Semaphore,
        current_idx: int,
        total_count: int,
        requirements: str = ""
    ) -> WebpageReadingResult:
        """
        Process a single URL with concurrency control

        Args:
            tool_context: Tool execution context
            url: URL to process
            semaphore: Semaphore for controlling concurrency
            current_idx: Current URL index (1-based)
            total_count: Total number of URLs
            requirements: 提炼要求。为空返回原文，非空按要求提炼

        Returns:
            WebpageReadingResult: Result of processing the URL
        """
        async with semaphore:
            # Browser mode (API mode is used as fallback only)
            url_start_time = asyncio.get_event_loop().time()
            # Create independent browser instance for complete isolation
            browser = await MagicBrowser.create_for_scraping()
            try:
                logger.info(f"[Browser] Processing {current_idx}/{total_count}: {url}")

                # Navigate to the webpage with human behavior simulation
                goto_result = await goto_external_website_with_referer(browser, url, None) # None creates new page automatically
                if not goto_result.success:
                    logger.warning(
                        f"[Browser] 导航失败，尝试使用 API 模式兜底 ({current_idx}/{total_count}): {url}, 错误: {goto_result.error}"
                    )
                    return await self._fetch_via_search_api(
                        tool_context=tool_context,
                        url=url,
                        current_idx=current_idx,
                        total_count=total_count,
                        requirements=requirements
                    )

                # Get the active page ID after navigation
                page_id = await browser.get_active_page_id()
                if not page_id:
                    logger.warning(
                        f"[Browser] 获取页面ID失败，尝试使用 API 模式兜底 ({current_idx}/{total_count}): {url}"
                    )
                    return await self._fetch_via_search_api(
                        tool_context=tool_context,
                        url=url,
                        current_idx=current_idx,
                        total_count=total_count,
                        requirements=requirements
                    )

                # Read page content as markdown
                read_result = await browser.read_as_markdown(page_id, scope="all")
                if not read_result.success:
                    logger.warning(
                        f"[Browser] 读取页面内容失败，尝试使用 API 模式兜底 ({current_idx}/{total_count}): {url}, 错误: {read_result.error}"
                    )
                    return await self._fetch_via_search_api(
                        tool_context=tool_context,
                        url=url,
                        current_idx=current_idx,
                        total_count=total_count,
                        requirements=requirements
                    )

                # Extract title and content
                title = read_result.title
                content = read_result.markdown

                # 检测并清理噪音内容（在 Summarize/Purify 之前处理，避免 LLM 幻觉）
                content = _detect_and_clean_noise_content(content, url)

                processed_content, is_anti_crawl_detected = await self._process_content_by_requirements(
                    tool_context=tool_context,
                    content=content,
                    title=title,
                    url=url,
                    requirements=requirements
                )

                # 检测反爬特征，如果检测到则自动切换到 API 模式兜底
                if is_anti_crawl_detected:
                    logger.warning(
                        f"[Browser] 检测到反爬特征，自动切换到 API 模式重试 ({current_idx}/{total_count}): {url}"
                    )
                    return await self._fetch_via_search_api(
                        tool_context=tool_context,
                        url=url,
                        current_idx=current_idx,
                        total_count=total_count,
                        requirements=requirements
                    )

                result = WebpageReadingResult(
                    url=url,
                    title=title,
                    content=processed_content,
                    is_success=True,
                    source="browser"
                )

                url_end_time = asyncio.get_event_loop().time()
                url_processing_time = url_end_time - url_start_time
                logger.info(f"[Browser] Successfully processed {current_idx}/{total_count} in {url_processing_time:.2f}s: {url}")
                return result

            except Exception as e:
                # Browser 模式失败时，尝试使用 API 模式兜底
                logger.warning(
                    f"[Browser] 处理失败，尝试使用 API 模式兜底 ({current_idx}/{total_count}): {url}, 错误: {e}"
                )
                return await self._fetch_via_search_api(
                    tool_context=tool_context,
                    url=url,
                    current_idx=current_idx,
                    total_count=total_count,
                    requirements=requirements
                )

            finally:
                # Clean up the independent browser instance
                try:
                    await browser.close()
                    logger.debug(f"Cleaned up browser instance for URL: {url}")
                except Exception as cleanup_e:
                    logger.warning(f"Error during browser cleanup for {url}: {cleanup_e}")

    async def _process_content_by_requirements(
        self,
        tool_context: ToolContext,
        content: str,
        title: str,
        url: str,
        requirements: str
    ) -> Tuple[str, bool]:
        """根据 requirements 处理内容。

        规则：
        - requirements 为空：返回原文
        - requirements 非空：按 requirements 提炼
        """
        # 原文模式：不净化不总结，保留网页原文；同时复用现有反爬检测逻辑
        base_params = WebviewContentParams(scope="all", purify=False, summarize=False)
        base_processed = await process_webview_content(
            content=content,
            title=title,
            url=url,
            params=base_params,
            tool_context=tool_context,
            original_content=content
        )

        clean_requirements = requirements.strip()
        if not clean_requirements:
            return base_processed.content, base_processed.is_anti_crawl_detected

        from app.tools.summarize import Summarize

        # 仅补充“按需求聚焦”的约束，避免与 summarize 工具主提示词重复
        enhanced_requirements = (
            "请仅围绕以下需求提炼信息，保持高信息密度，用最少的字表达最多的内容，在有限字数内确保需求相关关键信息完整不遗漏：\n"
            "若原文存在可能与需求相关的图片，请保留图片（使用 Markdown 图片语法），由你自行判断并保留可能相关的图片。\n"
            f"{clean_requirements}"
        )

        try:
            summarized_content = await Summarize().summarize_content(
                content=base_processed.content,
                title=title,
                requirements=enhanced_requirements,
                target_length=1000,
            )
            if summarized_content:
                return summarized_content, base_processed.is_anti_crawl_detected
            logger.warning(f"按要求提炼失败，回退原文: {url}")
            return base_processed.content, base_processed.is_anti_crawl_detected
        except Exception as e:
            logger.warning(f"按要求提炼出错，回退原文: {url}, 错误: {e}")
            return base_processed.content, base_processed.is_anti_crawl_detected

    def _format_results(self, results: List[WebpageReadingResult], requirements: str = "") -> str:
        """
        Format the batch reading results into a single markdown document

        Args:
            results: List of webpage reading results
            requirements: 提炼要求。为空表示原文模式，非空表示按要求提炼模式

        Returns:
            str: Formatted markdown content
        """
        formatted_parts = []

        # Add header
        total_count = len(results)
        success_count = sum(1 for r in results if r.is_success)
        failure_count = total_count - success_count

        formatted_parts.append("# 深度阅读多个网页内容结果\n")
        formatted_parts.append(f"**共处理 {total_count} 个网页，成功: {success_count}，失败: {failure_count}**\n")

        # Add separator
        formatted_parts.append("---\n")

        # Add successful results
        success_results = [r for r in results if r.is_success]
        for idx, result in enumerate(success_results, 1):
            formatted_parts.append(f"## {idx}. [{result.title}]({result.url})\n")
            # base64 内容已在更早阶段处理，这里直接使用
            formatted_parts.append(f"{result.content}\n")
            formatted_parts.append("---\n")

        # Add failed results section if any
        failed_results = [r for r in results if not r.is_success]
        if failed_results:
            formatted_parts.append("### 处理失败的网页\n")
            for result in failed_results:
                formatted_parts.append(f"- {result.url}\n")

        # Add content explanation based on processing mode
        if success_count > 0:
            formatted_parts.append("### 内容说明\n")

            if requirements.strip():
                formatted_parts.append("本次批量读取使用了按要求提炼模式，上述结果仅保留与提炼要求相关的关键信息。\n")
            else:
                formatted_parts.append("本次批量读取使用了原文模式，上述结果为网页原文内容（已自动过滤明显的 base64 噪音数据）。\n")

        return "\n".join(formatted_parts)



    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        """
        Get tool detail for display

        Args:
            tool_context: Tool execution context
            result: Tool execution result
            arguments: Tool execution arguments

        Returns:
            Optional[ToolDetail]: Tool detail for display
        """
        if not result.ok:
            return None

        if not arguments or "urls" not in arguments:
            logger.warning("No URLs provided in arguments")
            return None

        url_count = len(arguments["urls"])

        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(
                file_name=f"深度阅读多个网页内容结果 (共{url_count}个网页)",
                content=result.content
            )
        )



    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        if not arguments or "urls" not in arguments:
            return i18n.translate("read_webpages_as_markdown.read_failed", category="tool.messages")

        url_count = len(arguments["urls"])

        if not result.ok:
            return i18n.translate("read_webpages_as_markdown.batch_read_failed", category="tool.messages", count=url_count)

        return i18n.translate("read_webpages_as_markdown.count_remark", category="tool.messages", count=url_count)

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None) -> Dict:
        """
        Get friendly action and remark after tool execution

        Args:
            tool_name: Name of the tool
            tool_context: Tool execution context
            result: Tool execution result
            execution_time: Time taken for execution
            arguments: Tool execution arguments

        Returns:
            Dict: Friendly action and remark
        """
        if not result.ok:
            return {
                "action": i18n.translate("read_webpages_as_markdown", category="tool.actions"),
                "remark": i18n.translate("read_webpages_as_markdown.read_error", category="tool.messages", error=result.content)
            }

        return {
            "action": i18n.translate("read_webpages_as_markdown", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }
