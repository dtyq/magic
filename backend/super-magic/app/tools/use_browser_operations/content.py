"""浏览器内容读取操作组

包含页面内容读取、转换等操作
"""


from pydantic import Field

from agentlang.logger import get_logger
from agentlang.utils.token_estimator import num_tokens_from_string
from app.tools.use_browser_operations.base import BaseOperationParams, OperationGroup, operation
from magic_use.magic_browser import (
    MagicBrowser, MagicBrowserError,
    PageStateSuccess, MarkdownSuccess, ScreenshotSuccess
)
from agentlang.tools.tool_result import ToolResult
from app.tools.visual_understanding import VisualUnderstanding, VisualUnderstandingParams
from app.tools.webview_utils import (
    WebviewContentParams, process_webview_content
)

# 日志记录器
logger = get_logger(__name__)

# 与 read_file 保持一致的单次内容上限（按 token）
MAX_TOOL_RESULT_TOKENS = 20000


def _truncate_content_for_tool_result(content: str, max_tokens: int = MAX_TOOL_RESULT_TOKENS) -> tuple[str, bool, int, int]:
    """按 token 限制截断输出内容，避免 ToolResult 过长。"""
    original_tokens = num_tokens_from_string(content)
    if original_tokens <= max_tokens:
        return content, False, original_tokens, original_tokens

    # 二分查找最大可保留前缀，逻辑与 read_file 的截断策略一致
    left, right = 0, len(content)
    best_content = ""
    best_tokens = 0

    while left <= right:
        mid = (left + right) // 2
        candidate = content[:mid]
        candidate_tokens = num_tokens_from_string(candidate)
        if candidate_tokens <= max_tokens:
            best_content = candidate
            best_tokens = candidate_tokens
            left = mid + 1
        else:
            right = mid - 1

    if not best_content.endswith("\n"):
        best_content += "..."

    return best_content, True, original_tokens, best_tokens


class ReadAsMarkdownParams(BaseOperationParams, WebviewContentParams):
    """读取页面为Markdown的参数"""
    pass


class VisualQueryParams(BaseOperationParams):
    """视觉查询参数"""
    query: str = Field(..., description="关于当前页面截图的问题或分析要求")


class ContentOperations(OperationGroup):
    """内容操作组

    包含页面内容读取、转换等操作
    """
    group_name = "content"
    group_description = "页面内容读取相关操作"

    @operation(
        example=[
            {
                "operation": "read_as_markdown",
                "operation_params": {
                    "scope": "viewport"
                }
            },
            {
                "operation": "read_as_markdown",
                "operation_params": {
                    "scope": "all"
                }
            },
            {
                "operation": "read_as_markdown",
                "operation_params": {
                    "scope": "all",
                    "purify": "只保留正文内容" # 使用自定义标准净化
                }
            },
            {
                "operation": "read_as_markdown",
                "operation_params": {
                    "summarize": True  # 开启总结模式
                }
            }
        ]
    )
    async def read_as_markdown(self, browser: MagicBrowser, params: ReadAsMarkdownParams) -> ToolResult:
        """将网页内容读取为 Markdown 格式。

        可以获取网页中的所有内容，包括文本、链接、图片等。但图片只只能获取链接，若想要理解图片内容，请使用 visual_query 工具配合 scroll_to 逐步分析网页。

        `scope` 参数 (默认为 `viewport`):
        - `viewport`: 只获取当前视口内的内容，直接返回完整内容。
        - `all`: 获取整个页面内容；非总结模式下返回正文（过长自动截断），总结模式下返回总结内容。

        `purify` 参数 (默认为 `true`):
        - `true`: 使用默认通用标准尝试净化内容，移除广告、导航、页脚等非正文元素。有助于提取核心文章，但有误删风险。
        - `false`: 保留网页原始内容结构，不进行净化。
        - `字符串`: 将该字符串作为自定义标准进行净化，例如 "保留文章主体，移除相关推荐"。

        `summarize` 参数 (默认为 `false`):
        - `true`: 开启总结模式，自动读取整个页面内容并进行智能总结，损失一定信息但极大提升阅读效率。
        - `false`: 关闭总结模式。
        - 注意：总结模式与 `viewport` 互斥，开启后会强制设置 `purify=false`。
        """
        # 1. 获取并验证页面
        _, error_result = await self._get_validated_page(browser, params)
        if error_result:
            return error_result
        page_id = params.page_id or await browser.get_active_page_id()
        if not page_id:
            return ToolResult.error("无法确定要读取的页面ID")

        # 2. 调用 MagicBrowser 的 read_as_markdown 方法
        try:
            result = await browser.read_as_markdown(page_id=page_id, scope=params.scope)

            if isinstance(result, MagicBrowserError):
                return ToolResult.error(result.error)
            elif isinstance(result, MarkdownSuccess):
                # 提取数据
                markdown_text = result.markdown
                url = result.url
                title = result.title
                scope = result.scope

                # 获取当前屏幕编号（如果适用）
                current_screen = None
                if scope == "viewport":
                    try:
                        page_state_result = await browser.get_page_state(page_id=page_id)
                        if isinstance(page_state_result, PageStateSuccess) and page_state_result.state.position_info:
                            current_screen = int(page_state_result.state.position_info.current_screen)
                            logger.info(f"获取到当前屏幕编号: {current_screen}")
                    except Exception as state_exc:
                        logger.warning(f"获取页面 {page_id} 状态时出错: {state_exc!s}")

                # 3. 使用统一的内容处理函数
                content_params = WebviewContentParams(
                    scope=scope,
                    purify=params.purify,
                    summarize=params.summarize
                )

                processed_result = await process_webview_content(
                    content=markdown_text,
                    title=title,
                    url=url,
                    params=content_params,
                    current_screen=current_screen,
                    original_content=result.markdown
                )

                # 4. 格式化成功结果
                markdown_result_header = (
                    f"**操作: read_as_markdown**\n"
                    f"状态: 成功 ✓\n"
                    f"范围: {scope}{f' (第 {current_screen} 屏)' if scope == 'viewport' and current_screen else ''}\n"
                )

                # 总结模式信息
                if params.summarize:
                    markdown_result_header += f"总结模式: 开启 (损失一定信息但大幅提升阅读效率)\n"
                else:
                    markdown_result_header += f"是否净化: {'是' if processed_result.is_purified else '否'}"
                    if processed_result.is_purified:
                        markdown_result_header += f" (标准: {'通用' if processed_result.purification_criteria is None else f'自定义 - {processed_result.purification_criteria}'})"
                    markdown_result_header += f"{' 注意: 净化可能会误删除部分有价值信息' if processed_result.is_purified else ''}\n"

                markdown_result_header += f"标题: {title}\n"

                if params.summarize:
                    # 总结模式：直接返回总结内容
                    markdown_result_content = f"\n**总结内容**:\n{processed_result.content}"
                    markdown_result_tip = "\n\n说明: 上述总结内容已包含页面核心信息。"
                    markdown_result = markdown_result_header + markdown_result_content + markdown_result_tip
                elif scope == "all":
                    # scope 为 'all' 且非总结模式时，返回正文（必要时截断）
                    final_content, was_truncated, original_tokens, shown_tokens = _truncate_content_for_tool_result(
                        processed_result.content
                    )
                    markdown_result_content = f"\n**内容详情**:\n{final_content}"
                    if was_truncated:
                        markdown_result_tip = (
                            "\n\n**提示**: 已读取整个页面正文，但为控制上下文长度已截断。"
                            f"（原始约 {original_tokens} tokens，当前约 {shown_tokens} tokens）"
                        )
                    else:
                        markdown_result_tip = "\n\n**提示**: 已成功读取**整个页面**的正文内容。"
                    markdown_result = markdown_result_header + markdown_result_content + markdown_result_tip
                else: # scope 为 'viewport'
                    # scope 为 'viewport' 时，包含完整内容和提示
                    markdown_result_content = f"\n**内容详情**:\n{processed_result.content}"
                    screen_info = f" (第 {current_screen} 屏)" if current_screen else ""
                    markdown_result_tip = f"\n\n**提示**: 已成功读取**当前视口{screen_info}**的内容。如需获取页面其他部分内容，请使用滚动操作（如 `scroll_down`）后再次读取，或使用 `scope: all` 参数一次性读取整个页面。"
                    markdown_result = markdown_result_header + markdown_result_content + markdown_result_tip

                # Prepare structured data
                structured_data = {
                    "title": title,
                    "url": url,
                    "scope": scope,
                    "content": processed_result.content,
                    "summarize": params.summarize,
                    "purify": processed_result.is_purified,
                    "purification_criteria": processed_result.purification_criteria,
                    "summary": processed_result.summary,
                    "current_screen": current_screen
                }

                return ToolResult(
                    content=markdown_result,
                    extra_info={
                        "structured_data": structured_data
                    }
                )
            else:
                logger.error(f"read_as_markdown 操作返回了未知类型: {type(result)}")
                return ToolResult.error("read_as_markdown 操作返回了意外的结果类型。")

        except Exception as e:
            logger.error(f"read_as_markdown 外部处理失败: {e!s}", exc_info=True)
            return ToolResult.error("Failed to read as markdown")

    @operation(
        example=[{
            "operation": "visual_query",
            "operation_params": {
                "query": "请描述当前网页的页面风格和配色方案"
            },
            "operation": "visual_query",
            "operation_params": {
                "query": "请用结构化的 Markdown 文本提取当前网页中文章图片里的内容"
            }
        }]
    )
    async def visual_query(self, browser: MagicBrowser, params: VisualQueryParams) -> ToolResult:
        """使用视觉理解能力分析当前网页的视口内的内容，可配合 scroll_to 逐步分析整个网页的布局、风格、元素特征等，也可以用于理解有大量图片元素的网站。但由于是视觉分析，无法获取网页中的链接的 URL 信息，如有需要请使用 read_as_markdown 或 get_interactive_elements。
        """
        # 1. 获取并验证页面
        page, error_result = await self._get_validated_page(browser, params)
        if error_result: return error_result
        page_id = params.page_id or await browser.get_active_page_id()
        if not page_id:
            return ToolResult.error("无法确定要进行视觉查询的页面ID")

        logger.info(f"开始视觉查询: 页面={page_id}, 查询='{params.query}'")

        try:
            # 2. 截图 (默认截取当前视口，由 MagicBrowser 处理临时文件)
            logger.info(f"请求截取页面 {page_id} 的屏幕截图用于视觉查询...")
            # 强制使用临时文件进行截图
            screenshot_result = await browser.take_screenshot(page_id=page_id, path=None, full_page=False)

            if isinstance(screenshot_result, MagicBrowserError):
                logger.error(f"视觉查询截图失败: {screenshot_result.error}")
                return ToolResult.error(f"视觉查询准备截图失败: {screenshot_result.error}")
            elif not isinstance(screenshot_result, ScreenshotSuccess):
                logger.error(f"take_screenshot 返回未知类型: {type(screenshot_result)}")
                return ToolResult.error("截图操作返回意外结果类型。")

            screenshot_path = screenshot_result.path
            # 临时文件现在由 MagicBrowser 管理，这里不需要再关心 is_temp
            logger.info(f"视觉查询截图成功，路径: {screenshot_path}")

            # 3. 调用视觉理解工具
            visual_understanding = VisualUnderstanding()
            vision_params = VisualUnderstandingParams(images=[str(screenshot_path)], query=params.query)
            logger.info(f"向视觉模型发送查询: {params.query}")
            vision_result = await visual_understanding.execute_purely(params=vision_params)

            if not vision_result.ok:
                error_msg = vision_result.content or "视觉模型执行失败"
                logger.error(f"视觉理解失败: {error_msg}")
                return ToolResult.error(f"视觉理解失败: {error_msg}")

            # 4. 格式化成功结果
            analysis_content = vision_result.content
            markdown_content = (
                f"**操作: visual_query**\n"
                f"状态: 成功 ✓\n"
                f"页面ID: {page_id}\n"
                f"**分析结果**:\n{analysis_content}\n"
            )
            logger.info(f"视觉查询成功，页面: {page_id}, 查询: '{params.query}'")
            return ToolResult(content=markdown_content)

        except Exception as e:
            logger.exception(f"视觉查询操作中发生未预期的错误: {e!s}")
            return ToolResult.error("Visual query failed")
