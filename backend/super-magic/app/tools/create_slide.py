"""创建幻灯片工具

聚合文件写入和网页分析功能，实现"创建幻灯片 + 自定义分析"的一体化操作
"""

import asyncio
import html
import json
import os
import re
import stat
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from pydantic import Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.service.browser.browser_config_adapter import BrowserConfigAdapter
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool
from app.tools.write_file import WriteFile, WriteFileParams
from app.utils.async_file_utils import async_exists, async_read_text, async_stat, async_write_text
from magic_use import BrowserClient, create_browser

logger = get_logger(__name__)

# 字号检测常量
MIN_FONT_SIZE_PX = 16  # 最小字号阈值
SLIDE_NOTES_PATTERN = re.compile(
    r'<template\b(?=[^>]*\bdata-magic-slide-notes(?:\s|=|>))[^>]*>[\s\S]*?</template\s*>',
    re.IGNORECASE,
)


def _extract_slide_notes(content: str) -> str:
    match = SLIDE_NOTES_PATTERN.search(content)
    if not match:
        return ""
    opening_end = match.group(0).find(">")
    closing_start = match.group(0).lower().rfind("</template")
    if opening_end < 0 or closing_start < 0:
        return ""
    return html.unescape(match.group(0)[opening_end + 1 : closing_start]).strip()


def _upsert_slide_notes(content: str, notes: str) -> str:
    notes_block = (
        '<template data-magic-slide-notes data-format="plain-text" data-version="1">\n'
        f"{html.escape(notes, quote=False)}\n"
        "</template>"
    )
    if SLIDE_NOTES_PATTERN.search(content):
        has_written_block = False

        def replace_notes_block(_match: re.Match[str]) -> str:
            nonlocal has_written_block
            if has_written_block:
                return ""
            has_written_block = True
            return notes_block

        return SLIDE_NOTES_PATTERN.sub(replace_notes_block, content)

    for closing_tag in ("</body>", "</html>"):
        index = content.lower().find(closing_tag)
        if index >= 0:
            return f"{content[:index]}{notes_block}\n{content[index:]}"
    return f"{content}\n{notes_block}"


class CreateSlideParams(BaseToolParams):
    file_path: str = Field(
        ...,
        description="Workspace-relative output HTML path."
    )
    content: str = Field(
        ...,
        description="Complete slide HTML."
    )
    speaker_notes: Optional[str] = Field(
        default=None,
        description="Notes text; omitted preserves existing notes or creates an empty block.",
    )
    max_width: int = Field(
        ...,
        description="Positive canvas width in pixels."
    )
    max_height: int = Field(
        ...,
        description="Positive canvas height in pixels."
    )
    analysis_js: str = Field(
        ...,
        description="JavaScript function body using maxWidth/maxHeight and returning analysis results."
    )
    insert_after_slide: str = Field(
        ...,
        description="New-slide insertion anchor; empty inserts first. Existing slides keep their order."
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


# 使用说明：agents/skills/creating-slides/SKILL.md
@tool(code_mode_only=True)
class CreateSlide(AbstractFileTool[CreateSlideParams], WorkspaceTool[CreateSlideParams]):
    """Write a slide, preserve or update notes, analyze layout, and register its path."""

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
        content = params.content
        target_path = self.base_dir / params.file_path
        if params.speaker_notes is None and await async_exists(target_path):
            existing_content = await async_read_text(target_path)
            # Preserve the newly authored visual HTML while retaining notes when the model
            # omitted the optional field during an overwrite.
            content = _upsert_slide_notes(params.content, _extract_slide_notes(existing_content))
        else:
            content = _upsert_slide_notes(content, params.speaker_notes or "")

        # 构建 WriteFile 参数
        write_params = WriteFileParams(
            file_path=params.file_path,
            content=content
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

    async def _create_browser(self) -> BrowserClient:
        """创建浏览器实例"""
        # 创建浏览器实例用于网页分析
        config = await BrowserConfigAdapter.build_playwright(str(self.base_dir))
        browser = await create_browser(config)
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

    async def _check_font_sizes(self, browser: BrowserClient, page_id: str) -> Optional[str]:
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

            result = await browser.evaluate(page_id, script)

            if result:
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
            if not await async_exists(local_file_path):
                raise FileNotFoundError(f"文件不存在: {params.file_path}")
            if not stat.S_ISREG((await async_stat(local_file_path)).st_mode):
                raise ValueError(f"指定路径不是文件: {params.file_path}")

            target_url = self._prepare_file_url(str(local_file_path))
            logger.debug(f"加载文件: {params.file_path} -> {target_url}")

            # 导航到目标页面
            pages = await browser.list_pages()
            if not pages:
                raise RuntimeError("无法获取活跃页面ID")
            page_id = pages[0].id
            await browser.navigate(page_id, target_url)

            # 等待页面加载完成
            await asyncio.sleep(2)

            # 获取活跃页面ID
            # 构建立即执行函数
            full_script = f"""
(function(maxWidth, maxHeight) {{
    {params.analysis_js}
}})({params.max_width}, {params.max_height})
"""

            logger.debug("执行自定义分析脚本")
            analysis_result = await browser.evaluate(page_id, full_script)

            if analysis_result is None:
                raise Exception("分析结果为空")

            # 格式化用户分析结果
            formatted_result = self._format_js_result(analysis_result)

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
            if not await async_exists(magic_project_js_path):
                return None

            js_content = await async_read_text(magic_project_js_path)

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

    def _calculate_insert_position(self, slides: List[str], insert_after: str) -> tuple[int, str]:
        """
        Calculate insert position in slides array

        Args:
            slides: Current slides array
            insert_after: Insert position parameter (empty string or filename)

        Returns:
            tuple[int, str]: (insert position index, status message)
        """
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
            if not await async_exists(magic_project_js_path):
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

            # 内容更新不负责排序，也不重写项目配置，避免旧的插入参数移动已有页面。
            if file_name in slides:
                return f"Slide order preserved: '{file_name}' remains at position {slides.index(file_name) + 1}."

            # Calculate insert position
            insert_position, position_msg = self._calculate_insert_position(
                slides, 
                params.insert_after_slide,
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
            await async_write_text(magic_project_js_path, new_content)

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
