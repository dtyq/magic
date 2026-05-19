"""Batch webpage content reading tool

This tool reads multiple webpages and aggregates their content into a single markdown document.
It leverages the browser's goto_and_read_as_markdown operation with summarize mode enabled.
"""

from app.i18n import i18n
import asyncio
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from agentlang.context.tool_context import ToolContext
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool
from app.tools.web_scrape_utils import get_web_scrape_driver, clean_noise_content, process_content_by_requirements

logger = get_logger(__name__)

# Maximum number of concurrent webpage requests
MAX_CONCURRENT_REQUESTS = 10


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

    def __init__(self, **data):
        super().__init__(**data)
        self.driver = get_web_scrape_driver()

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
            url_start_time = asyncio.get_event_loop().time()
            driver_name = self.driver.__class__.__name__

            try:
                logger.info(f"[{driver_name}] Processing {current_idx}/{total_count}: {url}")

                # 调用驱动抓取
                try:
                    scrape_result = await self.driver.scrape(url)
                except Exception as scrape_err:
                    # 主抓取失败，尝试降级
                    logger.warning(
                        f"[{driver_name}] 主抓取失败，尝试降级 ({current_idx}/{total_count}): {url}, 错误: {scrape_err}"
                    )
                    scrape_result = await self.driver.fallback_scrape(url)

                title = scrape_result.site_name or "未知标题"
                content = scrape_result.markdown

                # 检测并清理噪音内容
                content = clean_noise_content(content, url)

                # 内容处理（按需提炼 + 反爬检测）
                processed_content, is_anti_crawl_detected = await process_content_by_requirements(
                    content=content,
                    title=title,
                    url=url,
                    requirements=requirements,
                    tool_context=tool_context
                )

                # 检测到反爬：调用驱动的降级方法重新抓取
                if is_anti_crawl_detected:
                    logger.warning(
                        f"[{driver_name}] 检测到反爬特征，使用降级方式重试 ({current_idx}/{total_count}): {url}"
                    )
                    try:
                        fallback_result = await self.driver.fallback_scrape(url)
                        title = fallback_result.site_name or title
                        content = clean_noise_content(fallback_result.markdown, url)
                        processed_content, _ = await process_content_by_requirements(
                            content=content,
                            title=title,
                            url=url,
                            requirements=requirements,
                            tool_context=tool_context
                        )
                    except Exception as fallback_err:
                        logger.warning(f"[{driver_name}] 降级抓取失败: {url}, 错误: {fallback_err}")

                url_end_time = asyncio.get_event_loop().time()
                logger.info(
                    f"[{driver_name}] 处理完成 {current_idx}/{total_count} "
                    f"用时 {url_end_time - url_start_time:.2f}s: {url}"
                )

                return WebpageReadingResult(
                    url=url,
                    title=title,
                    content=processed_content,
                    is_success=True,
                    source=driver_name
                )

            except Exception as e:
                logger.error(f"[{driver_name}] 处理失败 ({current_idx}/{total_count}): {url}, 错误: {e}")
                return WebpageReadingResult(
                    url=url,
                    is_success=False,
                    error_message=f"网页获取失败: {str(e)}",
                    source=driver_name
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
