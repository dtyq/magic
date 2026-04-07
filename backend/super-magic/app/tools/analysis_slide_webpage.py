"""网页元素分析工具

通过浏览器加载网页并执行 JavaScript 脚本分析页面中所有元素的尺寸、位置和内容
"""

from app.i18n import i18n
import asyncio
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import urlparse
from datetime import datetime

from pydantic import Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from agentlang.llms.factory import LLMFactory
from agentlang.utils.token_estimator import truncate_text_by_token
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool
from magic_use.magic_browser import MagicBrowser, MagicBrowserConfig

logger = get_logger(__name__)

# Default max length for AI analysis
DEFAULT_MAX_ANALYSIS_LENGTH = 300

# Default max tokens for content truncation
DEFAULT_MAX_TOKENS = 8000


class AnalysisSlideWebpageParams(BaseToolParams):
    target: str = Field(
        ...,
        description="""<!--zh: 网页目标，可以是本地HTML文件路径（相对于工作目录）或远程URL地址-->
Webpage target, can be local HTML file path (relative to working directory) or remote URL address"""
    )
    max_width: int = Field(
        ...,
        description="""<!--zh: 画布最大宽度，用于检测元素是否超出边界-->
Canvas max width, used to detect if elements exceed boundaries"""
    )
    max_height: int = Field(
        ...,
        description="""<!--zh: 画布最大高度，用于检测元素是否超出边界-->
Canvas max height, used to detect if elements exceed boundaries"""
    )
    top_elements_offset: int = Field(
        default=0,
        description="获取'主要布局元素'列表时的起始偏移量（0-based），用于分页。",
        ge=0
    )
    top_elements_limit: int = Field(
        default=10,
        description="获取'主要布局元素'列表时一次返回的最大数量（范围 5-20），用于分页。",
        ge=5,
        le=20
    )

    @field_validator('target')
    @classmethod
    def validate_target(cls, v: str) -> str:
        """验证目标地址格式"""
        if not v or not v.strip():
            raise ValueError("target 不能为空")
        return v.strip()

    @field_validator('max_width', 'max_height')
    @classmethod
    def validate_dimensions(cls, v: int) -> int:
        """验证尺寸参数"""
        if v <= 0:
            raise ValueError("宽度和高度必须大于0")
        return v


@tool()
class AnalysisSlideWebpage(WorkspaceTool[AnalysisSlideWebpageParams]):
    """<!--zh
    幻灯片网页分析工具

    加载网页（本地HTML或URL），注入脚本分析DOM，提供页面布局、内容及问题的结构化报告。
    主要用于分析类似幻灯片的网页。

    使用示例:
    ```json
    {
        "tool_name": "analysis_slide_webpage",
        "arguments": {
            "target": "slide.html",
            "max_width": 1920,
            "max_height": 1080,
            "top_elements_offset": 0,
            "top_elements_limit": 10
    -->
    Slide webpage analysis tool

    Load webpage (local HTML or URL), inject script to analyze DOM, provide structured report of page layout, content, and issues.
    Mainly used to analyze slide-like webpages.

    Usage example:
    ```json
    {
        "tool_name": "analysis_slide_webpage",
        "arguments": {
            "target": "slide.html",
            "max_width": 1920,
            "max_height": 1080,
            "top_elements_offset": 0,
            "top_elements_limit": 10
        }
    }
    ```

    检测的主要问题类型:
    - CANVAS_OVERFLOW: 超出画布。
    - PARENT_OVERFLOW: 超出父容器。
    - CLIPPED: 内容被父容器裁切。
    - HAS_HORIZONTAL_SCROLLBAR / HAS_VERTICAL_SCROLLBAR: 出现滚动条。
    - IMG_FAILED: 图片加载失败。
    - ASPECT_RATIO_DISTORTED: 图片宽高比失真。
    - IMAGE_CONTENT_SIGNIFICANTLY_CUT_OFF: 图片被父容器严重裁切。
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
        # 创建适合页面分析的浏览器实例
        browser = await MagicBrowser.create_for_scraping()
        logger.debug("创建浏览器实例用于网页元素分析")
        return browser

    def _get_analyzer_script(self) -> str:
        """获取网页元素分析脚本"""
        # Read the external JavaScript file
        script_path = Path(__file__).parent / "magic_slide" / "analysis_slide_webpage.js"
        try:
            with open(script_path, 'r', encoding='utf-8') as f:
                return f.read()
        except FileNotFoundError:
            logger.error(f"Analysis script not found: {script_path}")
            raise FileNotFoundError(f"Required analysis script not found: {script_path}")
        except Exception as e:
            logger.error(f"Failed to read analysis script: {e}")
            raise

    async def _get_page_html(self, browser: MagicBrowser, page_id: str) -> str:
        """获取页面HTML内容"""
        try:
            # Get the full HTML content of the page
            html_result = await browser.evaluate_js(
                page_id=page_id,
                js_code="document.documentElement.outerHTML"
            )

            if hasattr(html_result, 'error'):
                logger.warning(f"Failed to get page HTML: {html_result.error}")
                return ""

            if hasattr(html_result, 'result') and html_result.result:
                return str(html_result.result)

            return ""

        except Exception as e:
            logger.warning(f"Exception getting page HTML: {e}")
            return ""

    async def _analyze_with_ai(
        self,
        browser_analysis: str,
        html_content: str,
        target: str,
        max_length: int,
        model_id: Optional[str] = None
    ) -> str:
        """使用AI分析浏览器分析结果和HTML内容，生成修复建议"""
        try:
            # Get model_id from configuration if not provided
            if model_id is None:
                from app.core.ai_abilities import AIAbility, get_ability_config
                model_id = get_ability_config(
                    AIAbility.ANALYSIS_SLIDE,
                    "model_id",
                    default="deepseek-chat"
                )

            # Truncate HTML content to avoid token limits
            truncated_html, is_html_truncated = truncate_text_by_token(html_content, DEFAULT_MAX_TOKENS // 2)
            truncated_analysis, is_analysis_truncated = truncate_text_by_token(browser_analysis, DEFAULT_MAX_TOKENS // 2)

            if is_html_truncated:
                logger.warning(f"HTML content was truncated for AI analysis")
            if is_analysis_truncated:
                logger.warning(f"Browser analysis was truncated for AI analysis")

            # Get current time context
            current_time_str = datetime.now().strftime("%Y年%m月%d日 %H:%M:%S")

            # Build prompt
            prompt = f"""\
当前时间: {current_time_str}
分析目标: {target}
分析摘要要求: 控制在 {max_length} 字以内

网页HTML源码:
```html
{truncated_html}
```

浏览器技术分析结果:
```
{truncated_analysis}
```

请查看以下网页的源码和浏览器技术分析结果，并将浏览器技术分析结果中的问题转译为简短的、易于人类理解的表述。
如果没有发现明显问题，请回复"无问题"。

要求：
1. 将「浏览器技术分析结果」转化为简短的、易于人类理解的、可操作的修复建议
2. 不要虚构除「浏览器技术分析结果」以外的任何内容，不要提供你的个人观点
3. 只转译「浏览器技术分析结果」中的问题，不要给出任何建议
4. 控制回复长度在{max_length}字以内
"""

            # Build messages
            messages = [
                {
                    "role": "system",
                    "content": "你是一个专业的前端网页问题转译专家，专注于将机器分析报告转化为简短的、易于人类理解的表述。你从不给出任何建议，而是忠实地转译问题。"
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ]

            # Call LLM
            logger.debug(f"Calling AI model for webpage analysis: target={target}, max_length={max_length}")
            response = await LLMFactory.call_with_tool_support(
                model_id=model_id,
                messages=messages,
                tools=None,
                stop=None,
            )

            # Process response
            if not response or not response.choices or len(response.choices) == 0:
                logger.error("No valid response from AI model")
                return "AI分析失败：未收到有效响应"

            ai_analysis = response.choices[0].message.content
            if not ai_analysis:
                return "AI分析失败：响应内容为空"

            # Add truncation note if content was truncated
            if is_html_truncated or is_analysis_truncated:
                ai_analysis += "\n\n(注：此分析基于截断内容生成)"

            return ai_analysis

        except Exception as e:
            logger.exception(f"AI analysis failed: {e}")
            return f"AI分析失败: {str(e)}"

    async def execute(self, tool_context: ToolContext, params: AnalysisSlideWebpageParams) -> ToolResult:
        """执行网页元素分析"""
        target = params.target

        logger.info(
            f"开始网页元素分析: target={target}, max_width={params.max_width}, max_height={params.max_height}, "
            f"offset={params.top_elements_offset}, limit={params.top_elements_limit}"
        )

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
                    return ToolResult.error(f"本地文件不存在: {target}")
                if not local_file_path.is_file():
                    return ToolResult.error(f"指定路径不是文件: {target}")

                target_url = self._prepare_file_url(str(local_file_path))
                logger.debug(f"使用本地文件: {target} -> {target_url}")

            # 导航到目标页面
            logger.debug(f"导航到页面: {target_url}")
            goto_result = await browser.goto(page_id=None, url=target_url)

            if hasattr(goto_result, 'error'):
                return ToolResult.error(f"页面导航失败: {goto_result.error}")

            # 等待页面加载完成
            await asyncio.sleep(2)

            # 获取活跃页面ID
            page_id = await browser.get_active_page_id()
            if not page_id:
                return ToolResult.error("无法获取活跃页面ID")

            # 注入并执行分析脚本
            analyzer_script = self._get_analyzer_script()
            logger.debug("执行网页元素分析脚本")

            # 替换占位符为实际参数值
            full_script = analyzer_script.replace('{MAX_WIDTH}', str(params.max_width)).replace('{MAX_HEIGHT}', str(params.max_height)).replace('{TOP_ELEMENTS_OFFSET}', str(params.top_elements_offset)).replace('{TOP_ELEMENTS_LIMIT}', str(params.top_elements_limit))

            analysis_result = await browser.evaluate_js(
                page_id=page_id,
                js_code=full_script
            )

            if hasattr(analysis_result, 'error'):
                return ToolResult.error(f"执行分析失败: {analysis_result.error}")

            if not hasattr(analysis_result, 'result') or not analysis_result.result:
                return ToolResult.error("分析结果为空")

            # 获取浏览器分析结果
            browser_analysis = str(analysis_result.result)

            # 获取页面HTML内容
            logger.debug("获取页面HTML内容")
            html_content = await self._get_page_html(browser, page_id)

            # 使用AI分析生成修复建议
            logger.debug("调用AI进行深度分析")
            ai_analysis = await self._analyze_with_ai(
                browser_analysis=browser_analysis,
                html_content=html_content,
                target=target,
                max_length=DEFAULT_MAX_ANALYSIS_LENGTH
            )

            # 直接返回AI分析结果
            return ToolResult(content=ai_analysis)

        except Exception as e:
            logger.error(f"网页元素分析失败: {e}", exc_info=True)
            return ToolResult.error("Analysis failed")

        finally:
            # 清理浏览器资源
            if browser:
                try:
                    await browser.close()
                    logger.debug("浏览器实例已关闭")
                except Exception as e:
                    logger.warning(f"关闭浏览器时出错: {e}")

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        target = arguments.get("target", "") if arguments else ""
        return i18n.translate("analysis_slide_webpage.remark", category="tool.messages", target=target)

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
                "action": i18n.translate("analysis_slide_webpage", category="tool.actions"),
                "remark": i18n.translate("analysis_slide_webpage.error", category="tool.messages", error=result.content)
            }

        return {
            "action": i18n.translate("analysis_slide_webpage", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }
