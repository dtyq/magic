"""网页视觉理解工具

通过浏览器截图和视觉理解技术分析网页内容
"""

from app.i18n import i18n
import asyncio
import re
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import urlparse

from pydantic import Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from agentlang.utils.token_estimator import num_tokens_from_string, truncate_text_by_token
from app.core.entity.message.server_message import ToolDetail, DisplayType, FileContent
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool
from magic_use.magic_browser import MagicBrowser, MagicBrowserConfig
from app.tools.use_browser_operations.content import ContentOperations, VisualQueryParams

logger = get_logger(__name__)


class VisualUnderstandingWebpageParams(BaseToolParams):
    target: str = Field(
        ...,
        description="""<!--zh: 网页目标，可以是本地HTML文件路径（相对于工作目录）或远程URL地址-->
Webpage target, can be local HTML file path (relative to working directory) or remote URL address"""
    )
    query: str = Field(
        ...,
        description="""<!--zh: 关于网页内容的问题或分析要求，例如：'描述这个网页的布局和主要内容'、'分析网页的设计风格'等。工具会自动将页面HTML代码作为参考信息提供给AI大模型-->
Question or analysis requirements about webpage content, e.g., 'Describe the layout and main content of this webpage', 'Analyze the design style of webpage', etc. Tool will automatically provide page HTML code as reference information to AI LLM"""
    )

    @field_validator('target')
    @classmethod
    def validate_target(cls, v: str) -> str:
        """验证目标地址格式"""
        if not v or not v.strip():
            raise ValueError("target 不能为空")
        return v.strip()


@tool()
class VisualUnderstandingWebpage(WorkspaceTool[VisualUnderstandingWebpageParams]):
    """<!--zh
    网页视觉理解工具

    对指定的网页进行截图并通过视觉理解技术分析其内容。
    支持本地HTML文件和远程URL，提供一步到位的无状态分析。

    **增强功能：**
    - 自动获取页面HTML代码（最多16K token）作为AI大模型的参考信息
    - 结合视觉截图和HTML代码进行更准确的分析
    - 提供代码级别的精确定位和问题识别能力

    适用场景：
    - 网页布局和设计分析
    - 网页内容概览和总结
    - 网页可用性评估
    - 网页视觉元素识别
    - HTML代码质量检查
    - 页面结构分析

    使用示例：
    ```
    # 分析远程网页
    visual_understanding_webpage(
        target="https://example.com",
        query="分析这个网页的主要内容和布局结构"
    )

    # 分析本地HTML文件
    visual_understanding_webpage(
        target="report.html",
        query="检查这个报告页面的显示效果是否正常"
    )
    ```
    -->
    Webpage visual understanding tool

    Screenshot specified webpage and analyze its content through visual understanding technology.
    Supports local HTML files and remote URLs, provides one-stop stateless analysis.

    **Enhanced features:**
    - Auto-retrieve page HTML code (max 16K tokens) as AI LLM reference information
    - Combine visual screenshots and HTML code for more accurate analysis
    - Provide code-level precise positioning and problem identification capabilities

    Use scenarios:
    - Webpage layout and design analysis
    - Webpage content overview and summary
    - Webpage usability assessment
    - Webpage visual element identification
    - HTML code quality check
    - Page structure analysis

    Usage examples:
    ```
    # Analyze remote webpage
    visual_understanding_webpage(
        target="https://example.com",
        query="Analyze the main content and layout structure of this webpage"
    )

    # Analyze local HTML file
    visual_understanding_webpage(
        target="report.html",
        query="Check if this report page displays correctly"
    )
    ```
    """

    def __init__(self, **data):
        super().__init__(**data)

    def _is_url(self, target: str) -> bool:
        """判断目标是否为URL"""
        try:
            result = urlparse(target)
            return bool(result.scheme and result.netloc)
        except Exception:
            return False

    def _prepare_file_url(self, file_path: str) -> str:
        """将本地文件路径转换为file:// URL"""
        # 确保路径是绝对路径
        if not Path(file_path).is_absolute():
            file_path = str(self.base_dir / file_path)

        # 转换为file:// URL
        file_url = Path(file_path).as_uri()
        logger.debug(f"本地文件转换为URL: {file_path} -> {file_url}")
        return file_url

    async def _create_browser(self) -> MagicBrowser:
        """创建浏览器实例"""
        # 创建适合截图的浏览器实例
        browser = await MagicBrowser.create_for_scraping()
        logger.debug("创建浏览器实例用于网页视觉理解")
        return browser

    async def execute(self, tool_context: ToolContext, params: VisualUnderstandingWebpageParams) -> ToolResult:
        """执行网页视觉理解分析"""
        target = params.target
        query = params.query

        logger.info(f"开始网页视觉理解分析: target={target}, query={query}")

        browser = None
        try:
            # 创建浏览器实例
            browser = await self._create_browser()

            # 准备目标URL
            if self._is_url(target):
                target_url = target
                logger.debug(f"使用远程URL: {target_url}")
            else:
                # 验证本地文件是否存在
                local_file_path = self.base_dir / target
                if not local_file_path.exists():
                    return ToolResult(error=f"本地文件不存在: {target}")
                if not local_file_path.is_file():
                    return ToolResult(error=f"指定路径不是文件: {target}")

                target_url = self._prepare_file_url(str(local_file_path))
                logger.debug(f"使用本地文件: {target} -> {target_url}")

            # 导航到目标页面
            logger.debug(f"导航到页面: {target_url}")
            goto_result = await browser.goto(page_id=None, url=target_url)

            if hasattr(goto_result, 'error'):
                return ToolResult(error=f"页面导航失败: {goto_result.error}")

            # 等待页面加载完成
            await asyncio.sleep(2)

            # 获取活跃页面ID
            page_id = await browser.get_active_page_id()
            if not page_id:
                return ToolResult(error="无法获取活跃页面ID")

            # 获取页面HTML内容作为参考信息
            html_content = ""
            try:
                # 通过浏览器获取页面HTML
                html_result = await browser.evaluate_js(
                    page_id=page_id,
                    js_code="document.documentElement.outerHTML"
                )
                # Check if the result is successful and has content
                if hasattr(html_result, 'success') and html_result.success and hasattr(html_result, 'result'):
                    raw_html = str(html_result.result)

                    # 计算token数量并截断（限制16K token）
                    token_count = num_tokens_from_string(raw_html)
                    logger.debug(f"原始HTML token数量: {token_count}")

                    if token_count > 16000:
                        html_content, was_truncated = truncate_text_by_token(raw_html, 16000)
                        if was_truncated:
                            logger.debug("HTML内容已截断以控制在16K token内")
                    else:
                        html_content = raw_html

                elif hasattr(html_result, 'error'):
                    logger.warning(f"获取页面HTML失败: {html_result.error}")
                else:
                    logger.warning("无法获取页面HTML内容")

            except Exception as html_error:
                logger.warning(f"获取HTML内容时出错: {html_error}")

            # 构建增强的查询内容（将HTML放在query前面）
            enhanced_query = query
            if html_content:
                enhanced_query = f"""**页面HTML代码参考：**
```html
{html_content}
```

**视觉理解任务：**
{query}"""
                logger.debug("已将HTML内容添加到查询中作为参考信息")

            # 通过 ContentOperations 进行视觉查询
            logger.debug(f"执行增强视觉查询")
            content_ops = ContentOperations()
            visual_params = VisualQueryParams(page_id=page_id, query=enhanced_query)
            visual_result = await content_ops.visual_query(browser, visual_params)

            if not visual_result.ok:
                return ToolResult(error=f"视觉分析失败: {visual_result.content}")

            # 格式化结果
            html_info = ""
            if html_content:
                html_token_count = num_tokens_from_string(html_content)
                html_info = f" (包含HTML参考信息，{html_token_count} tokens)"

            logger.info(f"网页视觉理解分析完成: {target}")
            return ToolResult(content=visual_result.content)

        except Exception as e:
            logger.error(f"网页视觉理解分析失败: {e}", exc_info=True)
            return ToolResult(error="Analysis failed")

        finally:
            # 清理浏览器资源
            if browser:
                try:
                    await browser.close()
                    logger.debug("浏览器实例已关闭")
                except Exception as e:
                    logger.warning(f"关闭浏览器时出错: {e}")

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        """生成工具详情，用于前端展示"""
        if not result.ok or not result.content:
            return None

        try:
            # 从参数中获取目标和查询
            target = arguments.get("target", "未知网页") if arguments else "未知网页"
            query = arguments.get("query", "") if arguments else ""

            # 生成标题
            title = f"网页视觉理解: {target}"

            # 清理目标名称，使其适用于文件名
            safe_target = re.sub(r'[\\/*?:"<>|]', '_', target)
            # 限制文件名长度，避免过长
            safe_target = safe_target[:50] if len(safe_target) > 50 else safe_target
            file_name = f"网页视觉理解_{safe_target}.md"

            # 构建内容，只包含结论
            content = f"## {title}\n\n{result.content}"

            return ToolDetail(
                type=DisplayType.MD,
                data=FileContent(
                    file_name=file_name,
                    content=content
                )
            )
        except Exception as e:
            logger.error(f"生成工具详情失败: {e!s}")
            return None

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        target = arguments.get("target", "") if arguments else ""
        return i18n.translate("visual_understanding_webpage.analysis_webpage", category="tool.messages", target=target)

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None
    ) -> Dict:
        """获取工具调用后的友好动作和备注"""
        if not result.ok:
            return {
                "action": i18n.translate("visual_understanding_webpage", category="tool.actions"),
                "remark": i18n.translate("visual_understanding_webpage.error", category="tool.messages", error=result.content)
            }

        return {
            "action": i18n.translate("visual_understanding_webpage", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }
