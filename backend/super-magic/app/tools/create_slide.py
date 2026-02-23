"""创建幻灯片工具

聚合文件写入和网页分析功能，实现"创建幻灯片 + 自定义分析"的一体化操作
"""

from app.i18n import i18n
import aiofiles
import asyncio
import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from pydantic import Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool
from app.tools.write_file import WriteFile, WriteFileParams
from magic_use.magic_browser import MagicBrowser

logger = get_logger(__name__)

# 字号检测常量
MIN_FONT_SIZE_PX = 16  # 最小字号阈值


class CreateSlideParams(BaseToolParams):
    file_path: str = Field(
        ...,
        description="""<!--zh: 幻灯片HTML文件输出路径，相对于工作目录-->
Slide HTML file output path, relative to working directory"""
    )
    content: str = Field(
        ...,
        description="""<!--zh: 幻灯片HTML内容-->
Slide HTML content"""
    )
    max_width: int = Field(
        ...,
        description="""<!--zh: 期望的最大宽度（如1920px），传递给分析脚本使用-->
Expected max width (e.g., 1920px), passed to analysis script"""
    )
    max_height: int = Field(
        ...,
        description="""<!--zh: 期望的最大高度（如1080px），传递给分析脚本使用-->
Expected max height (e.g., 1080px), passed to analysis script"""
    )
    analysis_js: str = Field(
        ...,
        description="""<!--zh: 自定义JavaScript分析脚本的函数体内容，不要包含 function() 或 () => 等函数声明，直接写函数体代码。将自动包装为 (function(maxWidth, maxHeight) { 你的代码 })(maxWidth, maxHeight) 格式执行。记住要用 return 语句返回分析结果。-->
Custom JavaScript analysis script function body content. Don't include function() or () => declarations, write function body code directly. Will be auto-wrapped as (function(maxWidth, maxHeight) { your code })(maxWidth, maxHeight) format for execution. Remember to use return statement to return analysis result."""
    )
    insert_after_slide: str = Field(
        ...,
        description="""<!--zh
插入位置（必填）：
- 空字符串 ""：插入到第一页（slides数组开头）
- 具体文件名：插入到该文件之后，如 "封面.html"、"cover.html"
- 如果指定的文件不存在于slides数组中，将自动插入到末尾并给出警告

示例：
- insert_after_slide="" → 插入为第一页
- insert_after_slide="封面.html" → 插入到"封面.html"之后
- insert_after_slide="目录.html" → 插入到"目录.html"之后

此参数用于自动更新 magic.project.js 的 slides 数组，确保幻灯片在演示控制器中可见。
-->
Insert position (required):
- Empty string "": Insert at first position (beginning of slides array)
- Specific filename: Insert after that file, e.g., "cover.html", "contents.html"
- If specified file doesn't exist in slides array, will auto-insert at end with warning

Examples:
- insert_after_slide="" → Insert as first page
- insert_after_slide="cover.html" → Insert after "cover.html"
- insert_after_slide="contents.html" → Insert after "contents.html"

This parameter auto-updates slides array in magic.project.js to ensure slide is visible in presentation controller."""
    )

    @field_validator('file_path')
    @classmethod
    def validate_file_path(cls, v: str) -> str:
        """验证文件路径格式"""
        if not v or not v.strip():
            raise ValueError("file_path 不能为空")
        return v.strip()

    @field_validator('content')
    @classmethod
    def validate_content(cls, v: str) -> str:
        """验证内容不能为空"""
        if not v or not v.strip():
            raise ValueError("content 不能为空")
        return v

    @field_validator('max_width', 'max_height')
    @classmethod
    def validate_dimensions(cls, v: int) -> int:
        """验证尺寸参数"""
        if v <= 0:
            raise ValueError("宽度和高度必须大于0")
        return v

    @field_validator('analysis_js')
    @classmethod
    def validate_analysis_js(cls, v: str) -> str:
        """验证分析脚本不能为空"""
        if not v or not v.strip():
            raise ValueError("analysis_js 不能为空")
        return v.strip()


@tool()
class CreateSlide(AbstractFileTool[CreateSlideParams], WorkspaceTool[CreateSlideParams]):
    """<!--zh
    创建幻灯片工具

    创建HTML幻灯片文件并执行自定义分析脚本。主要用于：
    1. 创建幻灯片HTML文件（总是覆盖模式）
    2. 通过浏览器加载并执行自定义JavaScript分析

    analysis_js 参数用法：
    - 传入函数体内容（不要包含 function() 或 () => 声明）
    - 可以访问 maxWidth、maxHeight 变量
    - 必须使用 return 语句返回分析结果

    ⚠️ 核心检测目标：
    幻灯片最常见问题是元素超出 1920×1080 画布导致内容不可见，必须重点检测：
    1. 元素是否溢出边界（四个方向：左x<0、上y<0、右x+w>1920、下y+h>1080）
    2. 图片是否过度拉伸（显示尺寸 vs 原始尺寸）
    3. 至少检测 5 个以上关键元素（根据页面实际内容选择合适的选择器）
    4. 返回 issues 数组，包含所有问题的具体数值，便于定位修复

    启发性示例（根据实际页面灵活调整）：

    示例1 - 单个元素四方向边界检测逻辑：
    ```javascript
    const issues = [];
    const el = document.querySelector('你的选择器');  // 根据实际页面选择
    if (el) {
        const {x, y, width, height} = el.getBoundingClientRect();
        if (x < 0) issues.push(`元素左侧溢出: x=${Math.round(x)}`);
        if (y < 0) issues.push(`元素顶部溢出: y=${Math.round(y)}`);
        if (x + width > maxWidth) issues.push(`元素右侧溢出: ${Math.round(x+width)} > ${maxWidth}`);
        if (y + height > maxHeight) issues.push(`元素底部溢出: ${Math.round(y+height)} > ${maxHeight}`);
    }
    ```

    示例2 - 批量检测逻辑（选择器根据实际调整）：
    ```javascript
    document.querySelectorAll('你的选择器').forEach((el, i) => {
        const {x, y, width, height} = el.getBoundingClientRect();
        if (x + width > maxWidth) issues.push(`元素${i+1}右侧溢出: ${Math.round(x+width)}`);
        if (y + height > maxHeight) issues.push(`元素${i+1}底部溢出: ${Math.round(y+height)}`);
    });
    ```

    示例3 - 图片拉伸检测逻辑：
    ```javascript
    document.querySelectorAll('img').forEach((img, i) => {
        const {width: dw, height: dh} = img.getBoundingClientRect();
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            const scaleX = dw / img.naturalWidth;
            const scaleY = dh / img.naturalHeight;
            if (scaleX > 1.2 || scaleY > 1.2) {
                issues.push(`图片${i+1}过度放大${Math.round(Math.max(scaleX, scaleY) * 100)}%`);
            }
        }
    });
    return issues;
    ```
    -->
    Create slide tool

    Create HTML slide file and execute custom analysis script. Main uses:
    1. Create slide HTML file (always override mode)
    2. Load via browser and execute custom JavaScript analysis

    analysis_js parameter usage:
    - Pass function body content (don't include function() or () => declaration)
    - Can access maxWidth, maxHeight variables
    - Must use return statement to return analysis result

    ⚠️ Core detection objectives:
    Most common slide problem is elements exceeding 1920×1080 canvas causing invisible content, focus on:
    1. Elements overflow boundaries (four directions: left x<0, top y<0, right x+w>1920, bottom y+h>1080)
    2. Images over-stretched (display size vs original size)
    3. Check at least 5+ key elements (choose appropriate selectors based on actual page content)
    4. Return issues array containing all problems with specific values for easy troubleshooting

    Inspirational examples (flexibly adapt to actual page):

    Example 1 - Single element four-direction boundary check logic:
    ```javascript
    const issues = [];
    const el = document.querySelector('your-selector');  // Choose based on actual page
    if (el) {
        const {x, y, width, height} = el.getBoundingClientRect();
        if (x < 0) issues.push(`Element left overflow: x=${Math.round(x)}`);
        if (y < 0) issues.push(`Element top overflow: y=${Math.round(y)}`);
        if (x + width > maxWidth) issues.push(`Element right overflow: ${Math.round(x+width)} > ${maxWidth}`);
        if (y + height > maxHeight) issues.push(`Element bottom overflow: ${Math.round(y+height)} > ${maxHeight}`);
    }
    ```

    Example 2 - Batch check logic (adjust selector based on actual):
    ```javascript
    document.querySelectorAll('your-selector').forEach((el, i) => {
        const {x, y, width, height} = el.getBoundingClientRect();
        if (x + width > maxWidth) issues.push(`Element${i+1} right overflow: ${Math.round(x+width)}`);
        if (y + height > maxHeight) issues.push(`Element${i+1} bottom overflow: ${Math.round(y+height)}`);
    });
    ```

    Example 3 - Image stretch check logic:
    ```javascript
    document.querySelectorAll('img').forEach((img, i) => {
        const {width: dw, height: dh} = img.getBoundingClientRect();
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            const scaleX = dw / img.naturalWidth;
            const scaleY = dh / img.naturalHeight;
            if (scaleX > 1.2 || scaleY > 1.2) {
                issues.push(`Image${i+1} over-enlarged ${Math.round(Math.max(scaleX, scaleY) * 100)}%`);
            }
        }
    });
    return issues;
    ```
    """

    def __init__(self, **data):
        super().__init__(**data)
        # 初始化 WriteFile 工具实例，传递 base_dir 确保路径一致
        self.write_file = WriteFile(base_dir=self.base_dir)

    async def execute(self, tool_context: ToolContext, params: CreateSlideParams) -> ToolResult:
        """
        执行幻灯片创建和分析

        Args:
            tool_context: 工具上下文
            params: 参数对象

        Returns:
            ToolResult: 包含操作结果
        """
        # 1. 文件写入阶段（失败则直接返回错误）
        try:
            file_status, file_existed = await self._write_slide_file(tool_context, params)
        except Exception as e:
            logger.exception(f"文件写入失败: {e}")
            return ToolResult.error("Failed to write file")

        # 2. 浏览器分析阶段（失败不阻断）
        try:
            analysis_result = await self._analyze_with_browser(params)
            analysis_status = f"布局分析结果:\n{analysis_result}"
        except Exception as e:
            logger.warning(f"浏览器分析失败: {e}")
            analysis_status = f"布局分析失败: {str(e)}"

        # 3. 自动更新 magic.project.js 的 slides 数组
        update_status = await self._update_slides_array(params)

        # 4. 组合人类可读的结果
        content = f"{file_status}\n\n{analysis_status}\n\n{update_status}"

        # 5. 保存文件是否已存在的信息到 extra_info，供后续使用
        return ToolResult(content=content, extra_info={"file_existed": file_existed})

    async def _write_slide_file(self, tool_context: ToolContext, params: CreateSlideParams) -> tuple[str, bool]:
        """
        写入幻灯片文件

        Args:
            tool_context: 工具上下文
            params: 参数对象

        Returns:
            tuple[str, bool]: (文件操作状态描述, 文件是否已存在)
        """
        # 构建 WriteFile 参数
        write_params = WriteFileParams(
            file_path=params.file_path,
            content=params.content
        )

        # 调用 WriteFile 工具
        write_result = await self.write_file.execute(tool_context, write_params)

        # 检查写入结果
        if not write_result.ok:
            raise Exception(write_result.content)

        # 获取文件是否已存在的信息
        file_existed = write_result.extra_info.get("file_existed", False) if write_result.extra_info else False

        # 返回文件操作状态描述和文件是否已存在
        return write_result.content, file_existed

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
        # 创建浏览器实例用于网页分析
        browser = await MagicBrowser.create_for_scraping()
        logger.debug("创建浏览器实例用于网页分析")
        return browser

    def _format_js_result(self, js_result) -> str:
        """格式化 JavaScript 执行结果为可读字符串"""
        if js_result is None:
            return "JavaScript 执行未返回结果，请检查代码中是否包含 return 语句"

        if js_result == "":
            return "JavaScript 执行返回空字符串"

        if isinstance(js_result, bool):
            return f"执行结果: {js_result}"

        if isinstance(js_result, (int, float)):
            return f"执行结果: {js_result}"

        if isinstance(js_result, str):
            return js_result

        if isinstance(js_result, (dict, list)):
            # 如果是结构化数据，转换为格式化的字符串
            return json.dumps(js_result, ensure_ascii=False, indent=2)

        # 其他类型直接转换为字符串
        return str(js_result)

    async def _check_font_sizes(self, browser: MagicBrowser, page_id: str) -> Optional[str]:
        """
        自动检测幻灯片中的小字号文本

        Args:
            browser: 浏览器实例
            page_id: 页面ID

        Returns:
            Optional[str]: 如果发现小字号则返回提示信息，否则返回 None
        """
        try:
            script = f"""
            (function() {{
                const MIN_FONT_SIZE = {MIN_FONT_SIZE_PX};
                const textElements = document.querySelectorAll('p, li, div, span, h1, h2, h3, h4, h5, h6');

                for (const el of textElements) {{
                    const text = el.textContent.trim();
                    if (text.length < 10) continue;  // 跳过短文本

                    const fontSize = parseFloat(getComputedStyle(el).fontSize);
                    if (fontSize < MIN_FONT_SIZE) {{
                        return true;
                    }}
                }}

                return false;
            }})()
            """

            result = await browser.evaluate_js(page_id=page_id, js_code=script)

            if hasattr(result, 'result') and result.result:
                return "💡 Reminder: Some small font sizes detected. You may want to review whether they meet the specifications."

            return None

        except Exception as e:
            logger.warning(f"字号检测失败: {e}")
            return None

    async def _analyze_with_browser(self, params: CreateSlideParams) -> str:
        """
        使用浏览器分析幻灯片

        Args:
            params: 参数对象

        Returns:
            str: 分析结果字符串
        """
        browser = None
        try:
            # 创建浏览器实例
            browser = await self._create_browser()

            # 准备目标URL
            local_file_path = self.base_dir / params.file_path
            if not local_file_path.exists():
                raise FileNotFoundError(f"文件不存在: {params.file_path}")
            if not local_file_path.is_file():
                raise ValueError(f"指定路径不是文件: {params.file_path}")

            target_url = self._prepare_file_url(str(local_file_path))
            logger.debug(f"加载文件: {params.file_path} -> {target_url}")

            # 导航到目标页面
            goto_result = await browser.goto(page_id=None, url=target_url)
            if hasattr(goto_result, 'error'):
                raise Exception(f"页面导航失败: {goto_result.error}")

            # 等待页面加载完成
            await asyncio.sleep(2)

            # 获取活跃页面ID
            page_id = await browser.get_active_page_id()
            if not page_id:
                raise Exception("无法获取活跃页面ID")

            # 构建立即执行函数
            full_script = f"""
(function(maxWidth, maxHeight) {{
    {params.analysis_js}
}})({params.max_width}, {params.max_height})
"""

            logger.debug("执行自定义分析脚本")
            analysis_result = await browser.evaluate_js(
                page_id=page_id,
                js_code=full_script
            )

            if hasattr(analysis_result, 'error'):
                raise Exception(f"执行分析失败: {analysis_result.error}")

            if not hasattr(analysis_result, 'result'):
                raise Exception("分析结果为空")

            # 格式化用户分析结果
            formatted_result = self._format_js_result(analysis_result.result)

            # 自动检测字号问题
            font_warning = await self._check_font_sizes(browser, page_id)
            if font_warning:
                formatted_result = f"{formatted_result}\n\n{font_warning}"

            return formatted_result

        finally:
            # 清理浏览器资源
            if browser:
                try:
                    await browser.close()
                    logger.debug("浏览器实例已关闭")
                except Exception as e:
                    logger.warning(f"关闭浏览器时出错: {e}")

    async def _parse_magic_project_config(self, magic_project_js_path: Path) -> Optional[Dict]:
        """
        Parse magic.project.js file to extract complete config

        Args:
            magic_project_js_path: Path to magic.project.js file

        Returns:
            Optional[Dict]: Complete config dict, or None if parsing fails
        """
        try:
            if not magic_project_js_path.exists():
                return None

            async with aiofiles.open(magic_project_js_path, 'r', encoding='utf-8') as f:
                js_content = await f.read()

            # Strategy 1: Try to parse standard format - window.magicProjectConfig
            standard_patterns = [
                r'window\.magicProjectConfig\s*=\s*(\{[\s\S]*?\});',
                r'magicProjectConfig\s*=\s*(\{[\s\S]*?\});'
            ]

            for pattern in standard_patterns:
                matches = re.finditer(pattern, js_content, re.MULTILINE | re.DOTALL)
                for match in matches:
                    try:
                        config_json = match.group(1)
                        # Try to parse as JSON
                        try:
                            config_data = json.loads(config_json)
                        except json.JSONDecodeError:
                            # If JSON parsing fails, try simple JS object parsing
                            logger.debug("JSON parsing failed, trying simple JS object parsing")
                            continue

                        if isinstance(config_data, dict):
                            logger.debug(f"Parsed config from magic.project.js: {config_data}")
                            return config_data
                    except Exception as e:
                        logger.debug(f"Failed to parse config: {e}")
                        continue

            # Strategy 2: Try to parse legacy format - window.slides
            slides_array_patterns = [
                r'window\.slides\s*=\s*(\[[\s\S]*?\]);',
                r'(?:const|var|let)\s+slides\s*=\s*(\[[\s\S]*?\]);',
            ]

            for pattern in slides_array_patterns:
                matches = re.finditer(pattern, js_content, re.MULTILINE | re.DOTALL)
                for match in matches:
                    try:
                        slides_json = match.group(1)
                        slides = json.loads(slides_json)
                        if isinstance(slides, list):
                            logger.debug(f"Parsed slides array from legacy format: {slides}")
                            # Convert to new format
                            return {
                                "version": "1.0.0",
                                "type": "slide",
                                "name": magic_project_js_path.parent.name,
                                "slides": slides
                            }
                    except Exception as e:
                        logger.debug(f"Failed to parse slides array: {e}")
                        continue

            return None

        except Exception as e:
            logger.warning(f"Error parsing magic.project.js: {e}")
            return None

    def _calculate_insert_position(self, slides: List[str], insert_after: str, current_file: str) -> tuple[int, str]:
        """
        Calculate insert position in slides array

        Args:
            slides: Current slides array
            insert_after: Insert position parameter (empty string or filename)
            current_file: Current filename

        Returns:
            tuple[int, str]: (insert position index, status message)
        """
        # Check if file already exists in array
        if current_file in slides:
            # File exists, remove it first (will re-insert at new position)
            slides.remove(current_file)
            logger.info(f"File '{current_file}' already exists in slides array, will reposition")

        # Empty string: insert at beginning
        if not insert_after or insert_after.strip() == "":
            return 0, f"✓ 已插入到第一页位置"

        # Specified file: insert after that file
        try:
            index = slides.index(insert_after)
            return index + 1, f"✓ 已插入到 '{insert_after}' 之后"
        except ValueError:
            # Specified file doesn't exist, insert at end
            logger.warning(f"指定的文件 '{insert_after}' 不存在于 slides 数组中，将插入到末尾")
            return len(slides), f"⚠️ 指定的文件 '{insert_after}' 不存在，已插入到末尾"

    async def _update_slides_array(self, params: CreateSlideParams) -> str:
        """
        Auto-update slides array in magic.project.js

        Args:
            params: Tool parameters containing file_path and insert_after_slide

        Returns:
            str: Update status message
        """
        try:
            # Get the file path and its parent directory
            file_path = Path(params.file_path)
            file_name = file_path.name

            # Determine the project directory
            if not file_path.is_absolute():
                full_file_path = self.base_dir / file_path
            else:
                full_file_path = file_path

            project_dir = full_file_path.parent
            magic_project_js_path = project_dir / "magic.project.js"

            # If magic.project.js doesn't exist, skip update
            if not magic_project_js_path.exists():
                logger.debug(f"magic.project.js not found at {magic_project_js_path}, skipping update")
                return "⚠️ 未找到 magic.project.js，无法自动更新 slides 数组"

            # Parse magic.project.js to get complete config
            config_data = await self._parse_magic_project_config(magic_project_js_path)

            if config_data is None:
                logger.warning("Failed to parse config from magic.project.js")
                return "⚠️ 解析 magic.project.js 失败，请手动更新 slides 数组"

            # Get slides array
            slides = config_data.get('slides', [])
            if not isinstance(slides, list):
                logger.warning(f"Invalid slides array type: {type(slides)}")
                return "⚠️ slides 数组格式错误，请手动检查 magic.project.js"

            # Calculate insert position
            insert_position, position_msg = self._calculate_insert_position(
                slides, 
                params.insert_after_slide, 
                file_name
            )

            # Insert file at calculated position
            slides.insert(insert_position, file_name)
            config_data['slides'] = slides

            # Generate new magic.project.js content
            config_json = json.dumps(config_data, indent=2, ensure_ascii=False)
            new_content = f"""\
window.magicProjectConfig = {config_json};
window.magicProjectConfigure(window.magicProjectConfig);
"""

            # Write updated content
            async with aiofiles.open(magic_project_js_path, 'w', encoding='utf-8') as f:
                await f.write(new_content)

            logger.info(f"Successfully updated slides array in magic.project.js: inserted '{file_name}' at position {insert_position}")
            
            return f"📋 magic.project.js 更新成功\n{position_msg}\n当前页面顺序位置：第 {insert_position + 1} 页"

        except Exception as e:
            logger.exception(f"Error updating slides array: {e}")
            return f"⚠️ 更新 magic.project.js 失败: {str(e)}\n请手动使用 edit_file 工具更新 slides 数组"

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        """
        根据工具执行结果获取对应的ToolDetail

        Args:
            tool_context: 工具上下文
            result: 工具执行的结果
            arguments: 工具执行的参数字典

        Returns:
            Optional[ToolDetail]: 工具详情对象，可能为None
        """
        if not result.ok:
            return None

        if not arguments or "file_path" not in arguments or "content" not in arguments:
            logger.warning("没有提供file_path或content参数")
            return None

        file_path = arguments["file_path"]
        content = arguments["content"]
        file_name = os.path.basename(file_path)

        # CreateSlide 工具总是创建 HTML 文件
        return ToolDetail(
            type=DisplayType.HTML,
            data=FileContent(
                file_name=file_name,
                content=content
            )
        )

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        if not arguments or "file_path" not in arguments:
            return i18n.translate("read_file.not_found", category="tool.messages")

        file_path = arguments["file_path"]
        file_name = os.path.basename(file_path)

        # 检查文件是创建还是重写
        file_existed = result.extra_info.get("file_existed", False) if result.extra_info else False

        if file_existed:
            return i18n.translate("create_slide.rewrite_success_with_file", category="tool.messages", file_name=file_name)
        else:
            return i18n.translate("create_slide.success_with_file", category="tool.messages", file_name=file_name)

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None
    ) -> Dict:
        """获取工具调用后的友好动作和备注"""
        if not arguments or "file_path" not in arguments:
            return {
                "action": i18n.translate("create_slide", category="tool.actions"),
                "remark": i18n.translate("create_slide.exception", category="tool.messages")
            }

        return {
            "action": i18n.translate("create_slide", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }
