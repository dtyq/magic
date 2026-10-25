"""网页元素分析工具

通过浏览器加载网页并执行 JavaScript 脚本分析页面中所有元素的尺寸、位置和内容
"""

import asyncio
import stat
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import urlparse

from pydantic import Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.llms.factory import LLMFactory
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from agentlang.utils.token_estimator import truncate_text_by_token
from app.i18n import i18n
from app.service.browser.browser_config_adapter import BrowserConfigAdapter
from app.service.browser.workspace_page_loader import load_workspace_page
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool
from app.utils.async_file_utils import async_exists, async_read_text, async_stat
from magic_use import BrowserClient, create_browser

logger = get_logger(__name__)

# Default max length for AI analysis
DEFAULT_MAX_ANALYSIS_LENGTH = 300

# Default max tokens for content truncation
DEFAULT_MAX_TOKENS = 8000


class AnalysisSlideWebpageParams(BaseToolParams):
    target: str = Field(
        ...,
        description="Workspace-relative HTML path or remote webpage URL."
    )
    max_width: int = Field(
        ...,
        description="Positive canvas and browser viewport width in pixels."
    )
    max_height: int = Field(
        ...,
        description="Positive canvas and browser viewport height in pixels."
    )
    top_elements_offset: int = Field(
        default=0,
        description="Zero-based offset into the main-layout-element list.",
        ge=0
    )
    top_elements_limit: int = Field(
        default=10,
        description="Main-layout-element page size, from 5 to 20.",
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


# 使用说明：agents/skills/slide-template-maker/SKILL.md
# 参数与结果契约：agents/skills/slide-template-maker/references/webpage-layout-analysis.md
@tool(code_mode_only=True)
class AnalysisSlideWebpage(WorkspaceTool[AnalysisSlideWebpageParams]):
    """Analyze a local HTML file or URL for layout issues and repair suggestions."""

    def __init__(self, **data):
        super().__init__(**data)

    def _is_url(self, target: str) -> bool:
        """判断目标是否为URL"""
        try:
            result = urlparse(target)
            return bool(result.scheme and result.netloc)
        except Exception:
            return False

    async def _create_browser(self, *, viewport_width: int, viewport_height: int) -> BrowserClient:
        """创建浏览器实例"""
        # 创建适合页面分析的浏览器实例
        config = await BrowserConfigAdapter.build_playwright(
            str(self.base_dir),
            viewport_width=viewport_width,
            viewport_height=viewport_height,
            device_scale_factor=1,
        )
        browser = await create_browser(config)
        logger.debug("创建浏览器实例用于网页元素分析")
        return browser

    async def _get_analyzer_script(self) -> str:
        """获取网页元素分析脚本"""
        # Read the external JavaScript file
        script_path = Path(__file__).parent / "magic_slide" / "analysis_slide_webpage.js"
        try:
            return await async_read_text(script_path)
        except FileNotFoundError:
            logger.error(f"Analysis script not found: {script_path}")
            raise FileNotFoundError(f"Required analysis script not found: {script_path}")
        except Exception as e:
            logger.error(f"Failed to read analysis script: {e}")
            raise

    async def _get_page_html(self, browser: BrowserClient, page_id: str) -> str:
        """获取页面HTML内容"""
        try:
            # Get the full HTML content of the page
            html_result = await browser.evaluate(page_id, "document.documentElement.outerHTML")
            return str(html_result) if html_result else ""

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
                    default="deepseek-v4-flash"
                )

            # Truncate HTML content to avoid token limits
            truncated_html, is_html_truncated = truncate_text_by_token(html_content, DEFAULT_MAX_TOKENS // 2)
            truncated_analysis, is_analysis_truncated = truncate_text_by_token(browser_analysis, DEFAULT_MAX_TOKENS // 2)

            if is_html_truncated:
                logger.warning("HTML content was truncated for AI analysis")
            if is_analysis_truncated:
                logger.warning("Browser analysis was truncated for AI analysis")

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
            return f"AI analysis failed: {e!s}"

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
            browser = await self._create_browser(
                viewport_width=params.max_width,
                viewport_height=params.max_height,
            )

            pages = await browser.list_pages()
            if not pages:
                return ToolResult.error("无法获取活跃页面ID")
            page_id = pages[0].id

            # 准备并加载目标页面
            if self._is_url(target):
                target_url = target
                await browser.navigate(page_id, target_url)
                logger.debug(f"使用远程URL: {target_url}")
            else:
                local_file_path = self.base_dir / target
                if not await async_exists(local_file_path):
                    return ToolResult.error(f"本地文件不存在: {target}")
                if not stat.S_ISREG((await async_stat(local_file_path)).st_mode):
                    return ToolResult.error(f"指定路径不是文件: {target}")
                target_url = await load_workspace_page(
                    browser,
                    page_id,
                    Path(self.base_dir),
                    local_file_path,
                )
                logger.debug(f"使用自包含工作区页面: {target} -> {target_url}")

            # 等待页面加载完成
            await asyncio.sleep(2)

            # 注入并执行分析脚本
            analyzer_script = await self._get_analyzer_script()
            logger.debug("执行网页元素分析脚本")

            # 替换占位符为实际参数值
            full_script = (
                analyzer_script.replace("{MAX_WIDTH}", str(params.max_width))
                .replace("{MAX_HEIGHT}", str(params.max_height))
                .replace("{TOP_ELEMENTS_OFFSET}", str(params.top_elements_offset))
                .replace("{TOP_ELEMENTS_LIMIT}", str(params.top_elements_limit))
            )

            analysis_result = await browser.evaluate(page_id, full_script)

            if not analysis_result:
                return ToolResult.error("分析结果为空")

            # 获取浏览器分析结果
            browser_analysis = str(analysis_result)

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
