"""浏览器交互操作组

包含点击、输入文本等交互操作
"""

import asyncio
import os
import re

from pathlib import Path
from typing import Any, Dict, Literal, Annotated, Optional

from pydantic import Field, model_validator, field_validator

from agentlang.logger import get_logger
from app.tools.use_browser_operations.base import BaseOperationParams, OperationGroup, operation
from magic_use.magic_browser import (
    JSEvalSuccess, MagicBrowser, MagicBrowserError,
    ClickSuccess, InputSuccess, InteractiveElementsSuccess, ScreenshotSuccess, ScrollToSuccess
)
from agentlang.tools.tool_result import ToolResult
from app.tools.visual_understanding import VisualUnderstanding, VisualUnderstandingParams

# 日志记录器
logger = get_logger(__name__)


class GetInteractiveElementsParams(BaseOperationParams):
    """获取交互元素参数"""
    scope: Literal["viewport", "all"] = Field("viewport", description="元素范围 ('viewport': 可见区域, 'all': 整个页面)")


class ClickParams(BaseOperationParams):
    """点击元素参数"""
    selector: str = Field(
        ...,
        description="CSS selector of the element to click (e.g., '#element-id', '.class-name', '[attribute=value]', '[magic-touch-id=\"a1b2c\"]')"
    )


class InputTextParams(BaseOperationParams):
    """输入文本参数"""
    selector: str = Field(
        ...,
        description="CSS selector of the input field (e.g., '#input-id', 'input[name=\"username\"]', '[magic-touch-id=\"a1b2c\"]')"
    )
    text: str = Field(
        ...,
        description="Text content to input"
    )
    clear_first: bool = Field(
        True,
        description="Whether to clear the input field before typing"
    )
    press_enter: bool = Field(
        False,
        description="Whether to press Enter key after typing"
    )


class FindInteractiveElementVisuallyParams(BaseOperationParams):
    """通过视觉描述获取元素选择器参数"""
    element_description: str = Field(
        ...,
        description='对目标元素（按钮、链接、输入框等）的自然语言描述 (例如: \'页面顶部的搜索按钮\', \'带有"登录"文字的链接\')，不能是一个区域，必须是对具体的单个元素的描述'
    )


class ScrollToParams(BaseOperationParams):
    """滚动到指定屏幕参数"""
    screen_number: Annotated[int, Field(ge=1, description="目标屏幕编号 (从 1 开始)")] = Field(
        ...,
    )


class InteractionOperations(OperationGroup):
    """交互操作组

    包含元素点击、输入文本等交互操作
    """
    group_name = "interaction"
    group_description = "页面交互相关操作"

    @operation(
        example={
            "operation": "get_interactive_elements",
            "operation_params": {
                "scope": "viewport",
            }
        }
    )
    async def get_interactive_elements(self, browser: MagicBrowser, params: GetInteractiveElementsParams) -> ToolResult:
        """获取浏览器页面中的可交互元素（传统的查找可交互元素的方法，备选方案）

        获取页面中的可交互元素，如按钮、链接、输入框等。
        可选范围：'viewport' 只获取可视区域内的元素，'all' 获取页面所有元素
        """
        # 获取活跃页面ID
        page_id = params.page_id
        if not page_id:
            page_id = await browser.get_active_page_id()
            if not page_id:
                return ToolResult.error("没有可操作的页面或页面加载失败，请传入具体的 page_id 或使用 goto 跳转到可用的页面。")

        scope = params.scope

        try:
            # 调用browser层的get_interactive_elements方法
            result = await browser.get_interactive_elements(page_id, scope)

            # 处理结果
            if isinstance(result, MagicBrowserError):
                return ToolResult.error(result.error)
            elif isinstance(result, InteractiveElementsSuccess):
                # 获取元素数据
                elements_by_category = result.elements_by_category
                total_count = result.total_count

                # 构建结构化的Markdown内容
                markdown_content = (
                    f"**操作: get_interactive_elements**\n"
                    f"状态: 成功 ✓\n"
                    f"范围: {scope}\n"
                    f"元素总数: {total_count}\n"
                )

                # 添加元素摘要（按类别分组展示）
                if total_count > 0:
                    markdown_content += "\n**可交互元素列表 (按类别)**:\n"

                    # 定义显示顺序和限制
                    display_count = 0
                    MAX_DISPLAY = 100  # 最多显示100条

                    # 按类别展示元素，优先显示用户请求的类别
                    categories_to_display = ['button', 'link', 'input_and_select', 'other']

                    for category_name in categories_to_display:
                        # 只显示请求的类别或者在 'all' 模式下显示所有类别
                        elements_in_category = elements_by_category.get(category_name, [])
                        if elements_in_category and display_count < MAX_DISPLAY:
                            # 美化类别名称显示
                            display_category = category_name.replace('_', ' & ').title()
                            markdown_content += f"\n* **{display_category}**:\n"

                            for elem in elements_in_category:
                                if display_count >= MAX_DISPLAY:
                                    break

                                elem_type = elem.get("type", "未知")
                                elem_selector = elem.get("selector", "无法定位")
                                elem_name = elem.get("name") or elem.get("name_en") or "无名"
                                elem_text = elem.get("text", "")[:30]
                                elem_value = elem.get("value")
                                elem_href = elem.get("href")

                                # 构建单行描述
                                description = f"`{elem_selector}` ({elem_type})"
                                if elem_text:
                                    # 直接使用完整的文本，JS端已截断
                                    description += f" | 文本: '{elem_text}'"
                                elif elem_name != "无名":
                                    description += f" | 名称: '{elem_name}'"

                                if elem_value is not None:
                                    # 显示完整的值
                                    description += f" | 值: '{str(elem_value)}'"
                                if elem_href:
                                    # 显示完整的链接
                                    description += f" | 链接: '{elem_href}'"

                                markdown_content += f"  - {description}\n"
                                display_count += 1

                    if total_count > display_count:
                        markdown_content += f"\n... 还有 {total_count - display_count} 个元素未显示\n"

                    markdown_content += (
                        "\n**提示**: 使用 `click` 或 `input_text` 操作与这些元素交互，"
                        "使用元素的 `selector` 值（例如: `[magic-touch-id=\"a1b2c3\"]`）。\n"
                    )
                else:
                    markdown_content += "\n**提示**: 未找到任何可交互元素。你可以尝试使用 'all' 范围或检查页面是否有可交互内容。\n"

                return ToolResult(content=markdown_content)
            else:
                logger.error(f"get_interactive_elements 操作返回了未知类型: {type(result)}")
                return ToolResult.error("get_interactive_elements 操作返回了意外的结果类型。")

        except Exception as e:
            logger.error(f"get_interactive_elements 外部处理失败: {e!s}", exc_info=True)
            return ToolResult.error("Failed to get interactive elements")

    @operation(
        example={
            "operation": "find_interactive_element_visually",
            "operation_params": {
                "element_description": '搜索结果中的第一个可点击的网页链接标题'
            }
        }
    )
    async def find_interactive_element_visually(self, browser: MagicBrowser, params: FindInteractiveElementVisuallyParams) -> ToolResult:
        """查找可交互的元素信息，只需用自然语言描述即可精准找到复杂页面中的任何交互元素（按钮、链接、输入框等），自动返回CSS选择器列表。（推荐使用，遇到错误时再使用 get_interactive_elements），在使用前请先使用 visual_query 结合用户需求查看网页结构以便更精准地描述要找的元素。

        支持模糊描述，如："搜索输入框"，在复杂页面结构中依然高效可靠。但请注意，描述对象必须是一个具体的元素，而非一个区域，反面案例：「网站导航菜单或顶部菜单栏」，正面案例：「与 XX 有关的链接或按钮」。

        使用视觉理解模型识别描述对应的多个可能元素标记，然后获取它们对应的 magic-touch-id 并构造成选择器列表返回。
        """
        page_id = params.page_id
        if not page_id:
            page_id = await browser.get_active_page_id()
            if not page_id:
                return ToolResult.error("没有可操作的页面或页面加载失败，请传入具体的 page_id 或使用 goto 跳转到可用的页面。")

        logger.info(f"开始视觉定位: 页面={page_id}, 描述='{params.element_description}'")

        screenshot_path_obj: Optional[Path] = None

        try:
            # 加载标记JS模块
            load_result = await browser.ensure_js_module_loaded(page_id, ["marker"])
            if not load_result.get("marker"):
                return ToolResult.error("加载视觉标记JS模块失败")
            await asyncio.sleep(0.5) # 等待标记渲染稳定

            logger.info(f"截取带标记的页面 {page_id} 截图...")
            # 强制使用临时文件截图
            screenshot_result = await browser.take_screenshot(page_id=page_id, path=None, full_page=False)

            if isinstance(screenshot_result, MagicBrowserError):
                logger.error(f"视觉定位截图失败: {screenshot_result.error}")
                return ToolResult.error(f"视觉定位准备截图失败: {screenshot_result.error}")
            elif not isinstance(screenshot_result, ScreenshotSuccess):
                logger.error(f"take_screenshot 返回未知类型: {type(screenshot_result)}")
                return ToolResult.error("截图操作返回意外结果类型。")

            screenshot_path_obj = screenshot_result.path
            logger.info(f"视觉定位截图成功，路径: {screenshot_path_obj}")

            # 调用视觉理解模型查找标记ID
            visual_understanding = VisualUnderstanding()
            # --- 修改提示词：要求返回所有可能的标记ID，逗号分隔 ---
            vision_query = f"请找到一到三个可能与描述 \"{params.element_description}\" 有关的元素，返回它们右上角的彩色标签里的字母+数字标记内容，用逗号分隔（例如：B3, A12, C1）。如果找不到任何匹配的标记，请返回 \"未找到\"。"
            vision_params = VisualUnderstandingParams(images=[str(screenshot_path_obj)], query=vision_query)
            logger.info(f"向视觉模型发送标记查找查询: {vision_query}")
            vision_result = await visual_understanding.execute_purely(params=vision_params)

            if not vision_result.ok:
                error_msg = vision_result.content or "视觉模型执行失败"
                logger.error(f"视觉标记查找失败: {error_msg}")
                return ToolResult.error(f"视觉标记查找失败: {error_msg}")

            # 解析视觉模型返回的标记ID
            found_marker_ids_str = vision_result.content.strip()
            logger.info(f"视觉模型返回标记 ID 字符串: '{found_marker_ids_str}'")

            # --- 修改解析逻辑：使用 findall 查找所有匹配的ID ---
            marker_ids = re.findall(r'\b[A-Za-z]\d+\b', found_marker_ids_str)
            if not marker_ids or "未找到" in found_marker_ids_str:
                logger.warning(f"视觉模型未能找到匹配 \"{params.element_description}\" 的标记ID。")
                # --- 修改错误提示，引导用户调整描述或使用其他方法 ---
                return ToolResult.error(f"无法根据描述 \"{params.element_description}\" 在当前视口上定位到任何元素。请尝试使用 visual_query 结合用户需求查看网页结构以便更精准地描述要找的元素。如果重复失败，可以尝试使用 get_interactive_elements 查看所有可选元素。")

            logger.info(f"成功解析出 {len(marker_ids)} 个可能的标记 ID: {marker_ids}")

            # --- 循环处理每个标记ID，获取元素详情 ---
            found_elements = []
            for marker_id in marker_ids:
                # 调用JS查找具有该标记ID的元素并获取其 magic-touch-id 及其他信息
                js_code = f"""
                (() => {{
                    const markerIdStr = "{marker_id}"; // 使用当前循环的 marker_id
                    // 调用 marker.js 中定义的全局查找函数获取 touchId
                    const touchId = window.MagicMarker.find(markerIdStr);
                    if (!touchId) {{
                        return null; // 未找到 touchId
                    }}

                    // 使用 touchId 查找元素
                    const selector = `[magic-touch-id="${{touchId}}"]`;
                    const element = document.querySelector(selector);
                    if (!element) {{
                        return {{ markerId: markerIdStr, touchId: touchId, error: "Element not found with touchId" }}; // 找到了 touchId 但找不到元素
                    }}

                    // 获取元素信息
                    const elementType = element.tagName.toLowerCase();
                    let elementText = (element.textContent || element.innerText || "").trim();
                    if (elementText.length > 256) {{
                        elementText = elementText.substring(0, 256) + "..."; // 截断并加省略号
                    }}
                    const elementHref = elementType === 'a' ? element.getAttribute('href') : null;
                    const elementName = element.getAttribute('name') || element.getAttribute('aria-label') || element.getAttribute('title') || '';

                    return {{
                        markerId: markerIdStr, // 包含标记ID以便参考
                        touchId: touchId,
                        type: elementType,
                        text: elementText,
                        name: elementName, // 增加 name/aria-label/title
                        href: elementHref,
                        selector: selector // 也返回选择器本身
                    }};
                }})()
                """
                logger.info(f"在页面 {page_id} 上执行 JS 获取元素详情 (标记ID: '{marker_id}')...")
                element_details_result = await browser.evaluate_js(page_id=page_id, js_code=js_code)

                if isinstance(element_details_result, MagicBrowserError):
                    logger.error(f"获取标记 {marker_id} 元素详情失败: {element_details_result.error}")
                    # 单个元素查找失败不中断整个过程，记录日志继续查找其他标记
                    continue
                elif not isinstance(element_details_result, JSEvalSuccess):
                    logger.error(f"evaluate_js (标记 {marker_id}) 返回未知类型: {type(element_details_result)}")
                    continue

                element_details = element_details_result.result
                logger.info(f"标记 {marker_id} 获取到的元素详情: {element_details}")

                # 收集有效的元素信息
                if element_details and element_details.get("touchId") and not element_details.get("error"):
                    found_elements.append(element_details)
                elif element_details and element_details.get("error"):
                    logger.warning(f"虽然找到了标记 {marker_id} 和 touchId {element_details.get('touchId')}, 但未能找到对应的元素。")
                else:
                     logger.warning(f"虽然找到了标记 {marker_id}，但未能找到对应的可交互元素选择器 (touchId)。")

            # --- 构建并返回包含多个可能元素的结果 ---
            if found_elements:
                markdown_content = (
                    f"**操作: find_interactive_element_visually**\n"
                    f"状态: 成功 ✓\n"
                    f"描述: '{params.element_description}'\n"
                    f"定位到 {len(found_elements)} 个可能的元素:\n\n"
                )

                for i, elem in enumerate(found_elements, 1):
                    selector = elem["selector"]
                    elem_type = elem.get("type", "未知")
                    elem_text = elem.get("text")
                    elem_name = elem.get("name")
                    elem_href = elem.get("href")
                    marker_id = elem.get("markerId", "N/A") # 显示标记ID

                    markdown_content += f"**选项 {i} (标记 {marker_id}):**\n"
                    markdown_content += f"- 选择器: `{selector}`\n"
                    markdown_content += f"- 类型: `{elem_type}`\n"
                    if elem_text:
                        markdown_content += f"- 文本: '{elem_text}'\n"
                    if elem_name:
                         markdown_content += f"- 名称/标签: '{elem_name}'\n"
                    if elem_href:
                        markdown_content += f"- 链接地址 (href): `{elem_href}`\n"
                    markdown_content += "\n"


                markdown_content += (
                    f"**提示**: 请检查以上选项，选择最符合你意图的元素选择器 (`selector`)，"
                    f"然后使用 `click` 或 `input_text` 与之交互。"
                    f"如果元素是链接且你想导航，建议直接使用 `goto` 操作，而非 `click`。"
                    f"如果没有找到合适的元素，请尝试提供更精确的描述或使用 `get_interactive_elements` 查看所有元素。"
                )

                logger.info(f"视觉定位成功，找到 {len(found_elements)} 个可能元素，描述: '{params.element_description}'")
                return ToolResult(content=markdown_content)
            else:
                # 虽然找到了标记，但JS未能定位到任何一个有效元素
                logger.warning(f"根据描述 \"{params.element_description}\" 找到了 {len(marker_ids)} 个标记 ({marker_ids})，但无法在页面上定位到任何有效的可交互元素。")
                return ToolResult.error(f"根据描述 \"{params.element_description}\" 找到了视觉标记，但无法在页面上定位到任何有效的可交互元素。可能是元素已消失、被遮挡或不可交互。请尝试使用 get_interactive_elements。")

        except Exception as e:
            logger.exception(f"视觉定位操作中发生未预期的错误: {e!s}")
            return ToolResult.error("Visual location failed")

    @operation(
        example={
            "operation": "click",
            "operation_params": {
                "selector": "[magic-touch-id=\"a1b2\"]"
            }
        }
    )
    async def click(self, browser: MagicBrowser, params: ClickParams) -> ToolResult:
        """点击浏览器页面上的元素。非必要请直接 goto 到链接而非使用 click 点击。

        接收标准的 CSS 选择器来定位元素。可以通过 get_interactive_elements 或 find_interactive_element_visually 获取选择器。
        """
        # 获取活跃页面ID
        page_id = params.page_id
        if not page_id:
            page_id = await browser.get_active_page_id()
            if not page_id:
                return ToolResult.error("没有可操作的页面或页面加载失败，请传入具体的 page_id 或使用 goto 跳转到可用的页面。")

        selector = params.selector

        try:
            # 检查 selector 是否为空
            if not selector:
                return ToolResult.error("无效的 selector，选择器不能为空。")

            # 获取页面信息用于结果展示
            page = await browser.get_page_by_id(page_id)
            url_before = page.url if page else "未知"

            # 使用Browser的click方法，直接传入 selector
            logger.info(f"尝试点击元素: {selector}")
            result = await browser.click(page_id, selector)

            if isinstance(result, MagicBrowserError):
                return ToolResult.error(result.error)
            elif isinstance(result, ClickSuccess):
                # 格式化成功结果
                markdown_content = (
                    f"**操作: click**\n"
                    f"状态: 成功 ✓\n"
                    f"选择器: `{selector}`"
                )
                # 如果点击后有导航，可以添加 URL 和标题信息
                if result.final_url:
                    markdown_content += f"\n页面现已导航至: `{result.final_url}`"
                if result.title_after:
                    markdown_content += f"\n点击后的页面标题: {result.title_after}"

                return ToolResult(content=markdown_content)
            else:
                logger.error(f"click 操作返回了未知类型: {type(result)}")
                return ToolResult.error("click 操作返回了意外的结果类型。")

        except Exception as e:
            logger.error(f"click 外部处理失败: {e!s}", exc_info=True)
            return ToolResult.error(f"Failed to click element '{selector}'")

    @operation(
        example={
            "operation": "input_text",
            "operation_params": {
                "selector": "input[name='search']",
                "text": "content to input",
                "clear_first": True,
                "press_enter": True
            }
        }
    )
    @operation(name="input") # 显式指定操作名为 input
    async def input_text(self, browser: MagicBrowser, params: InputTextParams) -> ToolResult:
        """向指定的输入框输入文本

        接收标准的 CSS 选择器来定位输入框。可以通过 get_interactive_elements 或 find_interactive_element_visually 获取选择器。
        如输入搜索内容时，请输入符合当前对话上下文场景的内容，例如：调研国际化相关内容时应使用英文输入。
        """
        # 获取活跃页面ID
        page_id = params.page_id
        if not page_id:
            page_id = await browser.get_active_page_id()
            if not page_id:
                return ToolResult.error("没有可操作的页面或页面加载失败，请传入具体的 page_id 或使用 goto 跳转到可用的页面。")

        selector = params.selector
        text = params.text
        clear_first = params.clear_first
        press_enter = params.press_enter

        try:
            # 检查 selector 是否为空
            if not selector:
                return ToolResult.error("无效的 selector，选择器不能为空。")

            # 获取页面信息用于结果展示
            page = await browser.get_page_by_id(page_id)
            url_before = page.url if page else "未知"

            # 使用Browser的input_text方法，直接传入 selector
            logger.info(f"尝试向元素 {selector} 输入文本: '{text[:20]}...'")
            result = await browser.input_text(page_id, selector, text, clear_first, press_enter)

            if isinstance(result, MagicBrowserError):
                return ToolResult.error(result.error)
            elif isinstance(result, InputSuccess):
                # 格式化成功结果
                action_desc = "输入" if not press_enter else "输入并按下 Enter"
                markdown_content = (
                    f"**操作: input_text**\n"
                    f"状态: 成功 ✓\n"
                    f"选择器: `{selector}`\n"
                    f"操作: {action_desc}"
                )
                # 如果输入后有导航，可以添加 URL 和标题信息
                if result.final_url:
                    markdown_content += f"\n导航至: `{result.final_url}`"
                if result.title_after:
                    markdown_content += f"\n页面标题: {result.title_after}"

                return ToolResult(content=markdown_content)
            else:
                logger.error(f"input_text 操作返回了未知类型: {type(result)}")
                return ToolResult.error("input_text 操作返回了意外的结果类型。")

        except Exception as e:
            logger.error(f"input_text 外部处理失败: {e!s}", exc_info=True)
            return ToolResult.error(f"Failed to input text to '{selector}'")

    @operation(
        example={
            "operation": "scroll_to",
            "operation_params": {
                "screen_number": 3
            }
        }
    )
    async def scroll_to(self, browser: MagicBrowser, params: ScrollToParams) -> ToolResult:
        """将页面滚动到指定的屏幕编号位置。

        例如，`screen_number: 1` 滚动到页面顶部，`screen_number: 2` 滚动到第二屏的位置。
        """
        page_id = params.page_id
        if not page_id:
            page_id = await browser.get_active_page_id()
            if not page_id:
                return ToolResult.error("没有可操作的页面或页面加载失败，请传入具体的 page_id 或使用 goto 跳转到可用的页面。")

        screen_number = params.screen_number

        try:
            logger.info(f"尝试滚动页面 {page_id} 到屏幕编号: {screen_number}")
            result = await browser.scroll_to(page_id, screen_number)

            if isinstance(result, MagicBrowserError):
                return ToolResult.error(result.error)
            elif isinstance(result, ScrollToSuccess):
                # 构建结果描述
                screen_number = result.screen_number

                markdown_content = (
                    f"**操作: scroll_to**\n"
                    f"状态: 成功 ✓\n"
                    f"目标屏幕编号: {screen_number}\n"
                    f"提示：当前操作并不会自动获取页面内容，请继续使用其它工具来获取页面内容。"
                )

                return ToolResult(content=markdown_content)
            else:
                logger.error(f"scroll_to 操作返回了未知类型: {type(result)}")
                return ToolResult.error("scroll_to 操作返回了意外的结果类型。")

        except Exception as e:
            logger.error(f"scroll_to 外部处理失败: {e!s}", exc_info=True)
            return ToolResult.error(f"Failed to scroll to screen {screen_number}")
