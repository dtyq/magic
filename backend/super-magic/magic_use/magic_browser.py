"""
浏览器控制核心模块

提供浏览器实例的创建、配置和控制功能，
包括页面操作、元素查找和内容获取等基础功能。
"""

import asyncio
import tempfile
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Union, Literal

from pydantic import BaseModel, Field
from playwright.async_api import Page, Error as PlaywrightError

from agentlang.logger import get_logger
from agentlang.utils.file import safe_delete
from magic_use.browser_manager import BrowserManager
from magic_use.magic_browser_config import MagicBrowserConfig
from magic_use.page_registry import PageRegistry, PageState

# 设置日志
logger = get_logger(__name__)

# --- Constants ---
PAGE_NAVIGATION_TIMEOUT_MS = 15000  # 页面导航超时时间（毫秒）：15秒
ELEMENT_INTERACTION_TIMEOUT_MS = 5000  # 元素交互超时时间（毫秒）：5秒
SCREENSHOT_TIMEOUT_MS = 5000  # 截图操作超时时间（毫秒）：5秒

# --- DTO Definitions ---

class MagicBrowserError(BaseModel):
    """通用的 MagicBrowser 操作失败结果"""
    success: Literal[False] = False
    error: str = Field(..., description="错误信息描述")
    operation: Optional[str] = Field(None, description="执行失败的操作名称")
    details: Optional[Dict[str, Any]] = Field(None, description="可选的错误上下文细节")

class GotoSuccess(BaseModel):
    success: Literal[True] = True
    final_url: str
    title: str

class ClickSuccess(BaseModel):
    success: Literal[True] = True
    final_url: Optional[str] = None # 点击不一定导致导航
    title_after: Optional[str] = None

class InputSuccess(BaseModel):
    success: Literal[True] = True
    final_url: Optional[str] = None # 输入后按回车可能导致导航
    title_after: Optional[str] = None

class ScreenshotSuccess(BaseModel):
    success: Literal[True] = True
    path: Path
    is_temp: bool

class MarkdownSuccess(BaseModel):
    success: Literal[True] = True
    markdown: str
    url: str
    title: str
    scope: str

class InteractiveElementsSuccess(BaseModel):
    success: Literal[True] = True
    elements_by_category: Dict[str, List[Dict[str, Any]]] # JS 返回结构可能仍是 Dict
    total_count: int

class JSEvalSuccess(BaseModel):
    success: Literal[True] = True
    result: Any # JS 返回结果类型未知

class PageStateSuccess(BaseModel):
    success: Literal[True] = True
    state: PageState # 直接封装 PageState

class ScrollPositionData(BaseModel):
    """用于 ScrollSuccess 的滚动位置数据"""
    x: float
    y: float

class ScrollSuccess(BaseModel):
    success: Literal[True] = True
    direction: str
    full_page: bool
    before: ScrollPositionData
    after: ScrollPositionData
    actual_distance: float

class ScrollToSuccess(BaseModel):
    success: Literal[True] = True
    screen_number: int
    target_y: float
    before: ScrollPositionData
    after: ScrollPositionData

# 定义统一的返回类型别名
MagicBrowserResult = Union[
    GotoSuccess, ClickSuccess, InputSuccess, ScreenshotSuccess, MarkdownSuccess,
    InteractiveElementsSuccess, JSEvalSuccess, PageStateSuccess, ScrollSuccess, ScrollToSuccess,
    MagicBrowserError
]

# --- End DTO Definitions ---


class MagicBrowser:
    """浏览器控制类

    管理浏览器页面集合，提供页面操作和内容获取功能。
    通过组合 BrowserManager 和 PageRegistry 实现功能。
    统一处理底层 Playwright 错误并返回结构化结果对象。
    """

    def __init__(self, config: Optional[MagicBrowserConfig] = None):
        """内部构造函数，请使用 create() 或 create_for_scraping() 方法创建实例

        Args:
            config: 浏览器配置，如果为None则使用默认爬虫配置
        """
        self.config = config or MagicBrowserConfig.create_for_scraping()
        self._browser_manager = BrowserManager()
        self._page_registry = PageRegistry()

        self._active_context_id: Optional[str] = None
        self._active_page_id: Optional[str] = None
        self._managed_page_ids: set[str] = set()
        self._initialized: bool = False
        self._temp_files: List[Path] = [] # 用于管理临时截图文件

        # --- 临时截图目录 ---
        self._TEMP_SCREENSHOT_DIR: Optional[Path] = None
        try:
            # 在系统临时目录下为该浏览器实例创建唯一的截图子目录
            temp_dir = Path(tempfile.gettempdir())
            unique_dir_name = f"super_magic_browser_screenshots_{uuid.uuid4()}"
            self._TEMP_SCREENSHOT_DIR = temp_dir / unique_dir_name
            self._TEMP_SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
            logger.info(f"浏览器临时截图目录已创建: {self._TEMP_SCREENSHOT_DIR}")
        except Exception as e:
            logger.error(f"创建临时截图目录失败: {self._TEMP_SCREENSHOT_DIR}, 错误: {e}", exc_info=True)
            self._TEMP_SCREENSHOT_DIR = None # 标记为不可用
        # --- 结束临时截图目录 ---

    @classmethod
    async def create(cls, config: Optional[MagicBrowserConfig] = None) -> 'MagicBrowser':
        """创建并初始化浏览器实例

        Args:
            config: 浏览器配置，如果为None则使用默认爬虫配置

        Returns:
            MagicBrowser: 完全初始化的浏览器实例
        """
        instance = cls(config)
        await instance._initialize()
        return instance

    @classmethod
    async def create_for_scraping(cls) -> 'MagicBrowser':
        """创建针对网页爬取优化的浏览器实例

        Returns:
            MagicBrowser: 完全初始化的爬虫优化浏览器实例
        """
        config = MagicBrowserConfig.create_for_scraping()
        return await cls.create(config)

    async def _initialize(self) -> None:
        """内部初始化方法

        初始化底层浏览器管理器并创建首个上下文
        """
        if self._initialized:
            return

        try:
            # 初始化浏览器管理器
            await self._browser_manager.initialize(self.config)
            # 注册为浏览器客户端
            await self._browser_manager.register_client()

            # 创建默认上下文
            context_id, _ = await self._browser_manager.get_context(self.config)
            self._active_context_id = context_id

            self._initialized = True
            logger.info("MagicBrowser 初始化完成")
        except Exception as e:
            logger.error(f"初始化浏览器失败: {e}", exc_info=True)
            raise

    async def new_context(self) -> str:
        """创建新的浏览器上下文并设为活动"""
        try:
            context_id, _ = await self._browser_manager.get_context(self.config)
            self._active_context_id = context_id
            logger.info(f"创建新上下文并设为活动: {context_id}")
            return context_id
        except Exception as e:
            logger.error(f"创建浏览器上下文失败: {e}", exc_info=True)
            raise # 上下文创建失败也视为严重错误

    async def new_page(self, context_id: Optional[str] = None) -> str:
        """创建新页面并设为活动"""
        try:
            use_context_id = context_id or self._active_context_id
            if not use_context_id:
                logger.warning("未指定上下文ID且无活动上下文，创建新上下文")
                use_context_id = await self.new_context()

            context = await self._browser_manager.get_context_by_id(use_context_id)
            if not context:
                raise ValueError(f"上下文不存在: {use_context_id}")

            page = await context.new_page()
            page_id = await self._page_registry.register_page(page, use_context_id)
            self._managed_page_ids.add(page_id)
            self._active_page_id = page_id
            self._active_context_id = use_context_id # 更新活动的 context ID

            # PageRegistry 内部的 handle_page_load_and_script_injection 会处理 JS 加载

            logger.info(f"创建新页面并设为活动: {page_id} (上下文: {use_context_id})")
            return page_id
        except Exception as e:
            logger.error(f"创建页面失败: {e}", exc_info=True)
            raise # 页面创建失败视为严重错误

    async def ensure_js_module_loaded(self, page_id: str, module_names: Union[str, List[str]]) -> Dict[str, bool]:
        """确保指定页面加载了JS模块

        Args:
            page_id: 页面ID
            module_names: 模块名称或名称列表

        Returns:
            Dict[str, bool]: 加载结果
        """
        return await self._page_registry.ensure_js_module_loaded(page_id, module_names)

    async def get_active_context_id(self) -> Optional[str]:
        """获取当前活动上下文ID"""
        return self._active_context_id

    async def has_active_context(self) -> bool:
        """检查是否有活动上下文"""
        if not self._active_context_id:
            return False
        context = await self._browser_manager.get_context_by_id(self._active_context_id)
        return context is not None

    async def get_active_page_id(self) -> Optional[str]:
        """获取当前活动页面ID (并验证页面是否仍有效)"""
        if self._active_page_id:
            page = await self._page_registry.get_page_by_id(self._active_page_id)
            if not page: # get_page_by_id 内部已检查 is_closed
                logger.warning(f"活动页面 {self._active_page_id} 已不存在或关闭，清除活动页面ID。")
                self._managed_page_ids.discard(self._active_page_id)
                self._active_page_id = None
        return self._active_page_id

    async def get_page_by_id(self, page_id: str) -> Optional[Page]:
        """根据ID获取有效页面 (不存在或已关闭则返回None)"""
        return await self._page_registry.get_page_by_id(page_id)

    async def get_active_context(self) -> Optional[Any]: # 返回类型应为 Context，但避免循环导入
        """获取当前活动上下文对象"""
        if not self._active_context_id:
            return None
        return await self._browser_manager.get_context_by_id(self._active_context_id)

    async def get_active_page(self) -> Optional[Page]:
        """获取当前活动页面对象"""
        page_id = await self.get_active_page_id()
        if not page_id:
            return None
        return await self.get_page_by_id(page_id)

    async def get_all_pages(self) -> Dict[str, Page]:
        """获取所有当前打开的页面"""
        # PageRegistry 的 get_all_pages 已优化为只返回打开的页面
        return await self._page_registry.get_all_pages()

    async def close_page(self, page_id: str) -> bool:
        """关闭指定的页面并清理相关资源

        Args:
            page_id: 要关闭的页面ID

        Returns:
            bool: 是否成功关闭页面
        """
        if page_id not in self._managed_page_ids:
            logger.warning(f"尝试关闭未管理的页面: {page_id}")
            return False

        try:
            # 获取页面对象
            page = await self.get_page_by_id(page_id)

            # 如果是当前活动页面，清除活动页面引用
            if self._active_page_id == page_id:
                self._active_page_id = None

            # 从管理集合中移除
            self._managed_page_ids.discard(page_id)

            # 从注册表中注销
            await self._page_registry.unregister_page(page_id)

            # 关闭页面
            if page and not page.is_closed():
                await page.close()
                logger.info(f"已关闭页面: {page_id}")

            return True

        except Exception as e:
            logger.error(f"关闭页面 {page_id} 时出错: {e}", exc_info=True)
            return False

    async def goto(self, page_id: Optional[str], url: str, wait_until: str = "domcontentloaded") -> MagicBrowserResult:
        """导航到指定URL，如果 page_id 为 None，则自动创建新页面。"""
        operation_name = "goto"
        page: Optional[Page] = None
        actual_page_id: Optional[str] = page_id

        try:
            # 如果未提供 page_id，创建新页面
            if not actual_page_id:
                logger.info(f"{operation_name}: 未提供 page_id，创建新页面访问 {url}")
                actual_page_id = await self.new_page() # new_page 会设为活动页面
                page = await self.get_page_by_id(actual_page_id)
                if not page: # new_page 应该保证页面存在，但作为保险
                    raise RuntimeError(f"未能创建或获取新页面用于 {operation_name}")
            else:
                page = await self.get_page_by_id(actual_page_id)
                if not page:
                    return MagicBrowserError(error=f"页面不存在或已关闭: {actual_page_id}", operation=operation_name)

            # 设置活动页面（即使是已存在的页面，也更新为活动）
            self._active_page_id = actual_page_id
            context_id = await self._page_registry.get_context_id_for_page(actual_page_id)
            if context_id: self._active_context_id = context_id

            logger.info(f"{operation_name}: 页面 {actual_page_id} 导航至 {url}")
            await page.goto(url, wait_until=wait_until, timeout=PAGE_NAVIGATION_TIMEOUT_MS)
            await self._wait_for_stable_network(page)

            final_url = page.url
            title = "获取标题失败"
            try:
                title = await page.title() or "无标题"
            except PlaywrightError as title_e: # 更精确地捕获 Playwright 错误
                logger.warning(f"获取页面 {actual_page_id} 标题失败: {title_e}")
            except Exception as title_e_general: # 捕获其他可能的异常
                logger.warning(f"获取页面 {actual_page_id} 标题时发生意外错误: {title_e_general}")


            logger.info(f"{operation_name}: 页面 {actual_page_id} 导航成功, URL: {final_url}, Title: {title}")
            return GotoSuccess(final_url=final_url, title=title)

        except PlaywrightError as e: # 捕获特定的 Playwright 错误
            error_msg = f"导航到 {url} 失败 (Playwright Error): {e}"
            logger.error(error_msg, exc_info=False) # PlaywrightError 通常信息足够
            return MagicBrowserError(error=error_msg, operation=operation_name, details={"url": url, "page_id": actual_page_id})
        except Exception as e: # 捕获其他意外错误
            error_msg = f"导航到 {url} 失败 (Unexpected Error): {e}"
            logger.error(error_msg, exc_info=True)
            return MagicBrowserError(error=error_msg, operation=operation_name, details={"url": url, "page_id": actual_page_id})

    async def click(self, page_id: str, selector: str) -> MagicBrowserResult:
        """点击指定元素"""
        operation_name = "click"
        page = await self.get_page_by_id(page_id)
        if not page:
            return MagicBrowserError(error=f"页面不存在或已关闭: {page_id}", operation=operation_name)

        try:
            self._active_page_id = page_id # 点击操作也设置活动页面
            logger.info(f"{operation_name}: 页面 {page_id} 点击选择器 '{selector}'")
            # 使用 click 方法，Playwright 会自动等待元素可见和可点击
            await page.click(selector, timeout=ELEMENT_INTERACTION_TIMEOUT_MS)
            await self._wait_for_stable_network(page)

            # 获取点击后的 URL 和标题 (可能变化)
            final_url = page.url
            title_after = "获取标题失败"
            try:
                # 检查页面是否在点击后关闭了
                if page.is_closed():
                    logger.warning(f"{operation_name}: 页面 {page_id} 在点击后关闭，无法获取后续标题。")
                    title_after = "页面已关闭"
                else:
                    title_after = await page.title() or "无标题"
            except PlaywrightError as title_e:
                logger.warning(f"获取页面 {page_id} 点击后标题失败: {title_e}")
            except Exception as title_e_general:
                logger.warning(f"获取页面 {page_id} 点击后标题时发生意外错误: {title_e_general}")

            logger.info(f"{operation_name}: 页面 {page_id} 点击 '{selector}' 成功。")
            return ClickSuccess(final_url=final_url, title_after=title_after)

        except PlaywrightError as e:
            error_msg = f"点击元素 '{selector}' 失败 (Playwright Error): {e}"
            logger.error(error_msg, exc_info=False)
            # 检查是否是元素找不到的错误
            if "selector resolved to no elements" in str(e):
                error_msg = f"点击失败: 找不到元素 '{selector}' 或元素不可见/不可交互。"
            elif "timeout" in str(e).lower():
                error_msg = f"点击元素 '{selector}' 超时，元素可能未在预期时间内出现或变为可点击状态。"
            return MagicBrowserError(error=error_msg, operation=operation_name, details={"selector": selector, "page_id": page_id})
        except Exception as e:
            error_msg = f"点击元素 '{selector}' 失败 (Unexpected Error): {e}"
            logger.error(error_msg, exc_info=True)
            return MagicBrowserError(error=error_msg, operation=operation_name, details={"selector": selector, "page_id": page_id})

    async def input_text(self, page_id: str, selector: str, text: str, clear_first: bool = True, press_enter: bool = False) -> MagicBrowserResult:
        """在输入框中输入文本"""
        operation_name = "input_text"
        page = await self.get_page_by_id(page_id)
        if not page:
            return MagicBrowserError(error=f"页面不存在或已关闭: {page_id}", operation=operation_name)

        details = {"selector": selector, "text_preview": text[:50] + '...', "clear_first": clear_first, "press_enter": press_enter, "page_id": page_id}

        try:
            self._active_page_id = page_id
            logger.info(f"{operation_name}: 页面 {page_id} 向 '{selector}' 输入文本 (Clear: {clear_first}, Enter: {press_enter})")

            # 使用 fill 方法输入，它会自动等待元素出现并清空
            if clear_first:
                await page.fill(selector, text, timeout=ELEMENT_INTERACTION_TIMEOUT_MS)
            else:
                # 如果不清空，使用 type 方法追加
                await page.type(selector, text, timeout=ELEMENT_INTERACTION_TIMEOUT_MS)

            final_url = page.url # 记录按回车前的 URL
            title_after = None

            if press_enter:
                logger.info(f"{operation_name}: 页面 {page_id} 在 '{selector}' 后按下 Enter")
                await page.press(selector, "Enter")
                await self._wait_for_stable_network(page)
                # 获取按回车后的 URL 和标题
                final_url = page.url
                try:
                    if page.is_closed():
                        logger.warning(f"{operation_name}: 页面 {page_id} 在输入并按 Enter 后关闭。")
                        title_after = "页面已关闭"
                    else:
                        title_after = await page.title() or "无标题"
                except PlaywrightError as title_e:
                    logger.warning(f"获取页面 {page_id} 输入后标题失败: {title_e}")
                    title_after = "获取标题失败"
                except Exception as title_e_general:
                    logger.warning(f"获取页面 {page_id} 输入后标题时发生意外错误: {title_e_general}")
                    title_after = "获取标题失败"


            logger.info(f"{operation_name}: 页面 {page_id} 向 '{selector}' 输入文本成功。")
            return InputSuccess(final_url=final_url, title_after=title_after)

        except PlaywrightError as e:
            error_msg = f"输入文本到 '{selector}' 失败 (Playwright Error): {e}"
            logger.error(error_msg, exc_info=False)
            if "selector resolved to no elements" in str(e):
                error_msg = f"输入失败: 找不到元素 '{selector}' 或元素不可见/不可交互。"
            elif "element is not an input element" in str(e):
                error_msg = f"输入失败: 选择器 '{selector}' 对应的元素不是一个可输入的元素 (如 input, textarea)。"
            elif "timeout" in str(e).lower():
                error_msg = f"输入文本到 '{selector}' 超时。"
            return MagicBrowserError(error=error_msg, operation=operation_name, details=details)
        except Exception as e:
            error_msg = f"输入文本到 '{selector}' 失败 (Unexpected Error): {e}"
            logger.error(error_msg, exc_info=True)
            return MagicBrowserError(error=error_msg, operation=operation_name, details=details)

    async def scroll_page(self, page_id: str, direction: str, full_page: bool = False) -> MagicBrowserResult:
        """滚动页面"""
        operation_name = "scroll_page"
        page = await self.get_page_by_id(page_id)
        if not page:
            return MagicBrowserError(error=f"页面不存在或已关闭: {page_id}", operation=operation_name)

        details = {"direction": direction, "full_page": full_page, "page_id": page_id}

        try:
            self._active_page_id = page_id
            logger.info(f"{operation_name}: 页面 {page_id} 滚动方向 '{direction}', 整页: {full_page}")

            # 获取页面滚动信息
            # _get_page_scroll_info 内部也应该处理 Playwright 错误
            scroll_info = await self._page_registry._get_page_scroll_info(page)
            viewport_height = scroll_info.get("viewport_height", 0)
            document_height = scroll_info.get("document_height", 0)
            current_y = scroll_info.get("y", 0)
            current_x = scroll_info.get("x", 0)

            scroll_script = ""
            target_y = current_y
            target_x = current_x

            # 计算滚动目标和脚本
            if direction == "up":
                scroll_amount = viewport_height * 0.8 if not full_page else document_height # 滚动视口80%
                target_y = max(0, current_y - scroll_amount)
            elif direction == "down":
                scroll_amount = viewport_height * 0.8 if not full_page else document_height
                target_y = min(document_height - viewport_height, current_y + scroll_amount) # 确保底部可见
                # 如果目标位置没有向下移动多少，尝试直接到底部
                if abs(target_y - current_y) < 10 and direction == "down":
                    target_y = document_height - viewport_height
            elif direction == "left":
                viewport_width = scroll_info.get("viewport_width", 0)
                scroll_amount = viewport_width * 0.8 if not full_page else scroll_info.get("document_width", 0)
                target_x = max(0, current_x - scroll_amount)
            elif direction == "right":
                viewport_width = scroll_info.get("viewport_width", 0)
                document_width = scroll_info.get("document_width", 0)
                scroll_amount = viewport_width * 0.8 if not full_page else document_width
                target_x = min(document_width - viewport_width, current_x + scroll_amount)
            elif direction == "top":
                target_x, target_y = 0, 0
            elif direction == "bottom":
                target_x = current_x # 通常垂直滚动时 x 不变
                target_y = max(0, document_height - viewport_height) # 滚动到底部使底部可见
            else:
                # 不应该发生，因为有 Literal 类型检查，但作为保险
                return MagicBrowserError(error=f"无效的滚动方向: {direction}", operation=operation_name, details=details)

            # 确保目标坐标是数字
            target_x = float(target_x)
            target_y = float(target_y)

            scroll_script = f"window.scrollTo({target_x}, {target_y});"
            await page.evaluate(scroll_script)
            await asyncio.sleep(0.5) # 等待滚动动画（如果存在）

            # 获取新的滚动位置
            new_scroll_info = await self._page_registry._get_page_scroll_info(page)
            new_x = new_scroll_info.get("x", 0)
            new_y = new_scroll_info.get("y", 0)
            actual_distance = new_y - current_y if direction in ["up", "down", "top", "bottom"] else new_x - current_x

            logger.info(f"{operation_name}: 页面 {page_id} 滚动成功, 新位置 (x={new_x}, y={new_y})")
            return ScrollSuccess(
                direction=direction,
                full_page=full_page,
                before=ScrollPositionData(x=current_x, y=current_y),
                after=ScrollPositionData(x=new_x, y=new_y),
                actual_distance=actual_distance
            )

        except PlaywrightError as e:
            error_msg = f"滚动页面失败 (Playwright Error): {e}"
            logger.error(error_msg, exc_info=False)
            return MagicBrowserError(error=error_msg, operation=operation_name, details=details)
        except Exception as e:
            error_msg = f"滚动页面失败 (Unexpected Error): {e}"
            logger.error(error_msg, exc_info=True)
            return MagicBrowserError(error=error_msg, operation=operation_name, details=details)

    async def scroll_to(self, page_id: str, screen_number: int) -> MagicBrowserResult:
        """将页面滚动到指定屏幕编号的位置 (>=1)。"""
        operation_name = "scroll_to"
        page = await self.get_page_by_id(page_id)
        if not page:
            return MagicBrowserError(error=f"页面不存在或已关闭: {page_id}", operation=operation_name)

        if screen_number < 1:
            return MagicBrowserError(error="屏幕编号必须大于或等于 1", operation=operation_name, details={"screen_number": screen_number})

        details = {"screen_number": screen_number, "page_id": page_id}

        try:
            self._active_page_id = page_id
            logger.info(f"{operation_name}: 页面 {page_id} 滚动到屏幕 {screen_number}")

            js_get_info = """
            () => ({ x: window.scrollX, y: window.scrollY, viewportHeight: window.innerHeight })
            """
            scroll_info_before = await page.evaluate(js_get_info)
            viewport_height = scroll_info_before.get("viewportHeight", 0) or 600 # 提供默认值
            current_x = scroll_info_before.get("x", 0)
            current_y = scroll_info_before.get("y", 0)

            target_y = (screen_number - 1) * viewport_height
            target_y = float(target_y) # 确保是浮点数

            scroll_script = f"window.scrollTo({float(current_x)}, {target_y});"
            await page.evaluate(scroll_script)
            await asyncio.sleep(0.5)

            scroll_info_after = await page.evaluate(js_get_info)
            new_x = scroll_info_after.get("x", 0)
            new_y = scroll_info_after.get("y", 0)

            logger.info(f"{operation_name}: 页面 {page_id} 滚动到屏幕 {screen_number} 成功, 新位置 (x={new_x}, y={new_y})")
            return ScrollToSuccess(
                screen_number=screen_number,
                target_y=target_y,
                before=ScrollPositionData(x=current_x, y=current_y),
                after=ScrollPositionData(x=new_x, y=new_y)
            )
        except PlaywrightError as e:
            error_msg = f"滚动到屏幕 {screen_number} 失败 (Playwright Error): {e}"
            logger.error(error_msg, exc_info=False)
            return MagicBrowserError(error=error_msg, operation=operation_name, details=details)
        except Exception as e:
            error_msg = f"滚动到屏幕 {screen_number} 失败 (Unexpected Error): {e}"
            logger.error(error_msg, exc_info=True)
            return MagicBrowserError(error=error_msg, operation=operation_name, details=details)

    async def get_page_state(self, page_id: str) -> MagicBrowserResult:
        """获取页面状态信息"""
        operation_name = "get_page_state"
        # PageRegistry.get_page_state 内部已处理页面不存在的情况并返回 PageState(error=...)
        try:
            page_state: PageState = await self._page_registry.get_page_state(page_id)
            if page_state.error:
                # 将 PageState 的错误转换为 MagicBrowserError
                return MagicBrowserError(error=page_state.error, operation=operation_name, details={"page_id": page_id})
            else:
                return PageStateSuccess(state=page_state)
        except Exception as e: # 捕获 PageRegistry 可能抛出的其他异常
            error_msg = f"获取页面 {page_id} 状态时发生意外错误: {e}"
            logger.error(error_msg, exc_info=True)
            return MagicBrowserError(error=error_msg, operation=operation_name, details={"page_id": page_id})

    async def read_as_markdown(self, page_id: str, scope: str = "viewport") -> MagicBrowserResult:
        """获取页面内容的Markdown表示"""
        operation_name = "read_as_markdown"
        page = await self.get_page_by_id(page_id)
        if not page:
            return MagicBrowserError(error=f"页面不存在或已关闭: {page_id}", operation=operation_name)

        details = {"scope": scope, "page_id": page_id}

        try:
            self._active_page_id = page_id
            logger.info(f"{operation_name}: 页面 {page_id} 读取范围 '{scope}'")

            # 内部处理 JS 加载
            load_result = await self._page_registry.ensure_js_module_loaded(page_id, ["lens"])
            if not load_result.get("lens"):
                return MagicBrowserError(error="加载JS模块 'lens' 失败", operation=operation_name, details=details)

            if scope not in ["viewport", "all"]:
                return MagicBrowserError(error=f"无效的范围: {scope}，支持 'viewport' 或 'all'", operation=operation_name, details=details)

            script = f"""
            async () => {{
                try {{
                    return await window.MagicLens.readAsMarkdown('{scope}');
                }} catch (e) {{
                    return {{ error: e.toString(), stack: e.stack }};
                }}
            }}
            """
            result = await page.evaluate(script)

            if isinstance(result, dict) and "error" in result:
                js_error = f"JS执行获取Markdown失败 ({scope}): {result['error']}"
                logger.error(js_error)
                return MagicBrowserError(error=js_error, operation=operation_name, details=details)

            url = page.url
            title = await page.title() or "无标题" # 同样需要处理 title 获取错误

            logger.info(f"{operation_name}: 页面 {page_id} 读取成功。")
            return MarkdownSuccess(markdown=result, url=url, title=title, scope=scope)

        except PlaywrightError as e:
            error_msg = f"读取Markdown失败 (Playwright Error): {e}"
            logger.error(error_msg, exc_info=False)
            return MagicBrowserError(error=error_msg, operation=operation_name, details=details)
        except Exception as e:
            error_msg = f"读取Markdown失败 (Unexpected Error): {e}"
            logger.error(error_msg, exc_info=True)
            return MagicBrowserError(error=error_msg, operation=operation_name, details=details)

    async def get_interactive_elements(self, page_id: str, scope: str = "viewport") -> MagicBrowserResult:
        """获取页面中的交互元素"""
        operation_name = "get_interactive_elements"
        page = await self.get_page_by_id(page_id)
        if not page:
            return MagicBrowserError(error=f"页面不存在或已关闭: {page_id}", operation=operation_name)

        details = {"scope": scope, "page_id": page_id}
        if scope not in ["viewport", "all"]:
            return MagicBrowserError(error=f"无效的范围: {scope}", operation=operation_name, details=details)

        try:
            self._active_page_id = page_id
            logger.info(f"{operation_name}: 页面 {page_id} 获取元素, 范围 '{scope}'")

            # 内部处理 JS 加载
            load_result = await self._page_registry.ensure_js_module_loaded(page_id, ["touch"])
            if not load_result.get("touch"):
                return MagicBrowserError(error="加载JS模块 'touch' 失败", operation=operation_name, details=details)

            scope_value = "viewport" if scope == "viewport" else "all"
            script = f"""
            async () => {{
                try {{
                    return await window.MagicTouch.getInteractiveElements('{scope_value}');
                }} catch (e) {{
                    return {{ error: e.toString(), stack: e.stack }};
                }}
            }}
            """
            result = await page.evaluate(script)

            if isinstance(result, dict) and "error" in result:
                js_error = f"JS执行获取交互元素失败: {result['error']}"
                logger.error(js_error)
                return MagicBrowserError(error=js_error, operation=operation_name, details=details)

            # result 应该是分类的元素字典
            elements_by_category = result if isinstance(result, dict) else {}
            total_count = sum(len(v) for v in elements_by_category.values() if isinstance(v, list))

            logger.info(f"{operation_name}: 页面 {page_id} 获取到 {total_count} 个元素。")
            return InteractiveElementsSuccess(elements_by_category=elements_by_category, total_count=total_count)

        except PlaywrightError as e:
            error_msg = f"获取交互元素失败 (Playwright Error): {e}"
            logger.error(error_msg, exc_info=False)
            return MagicBrowserError(error=error_msg, operation=operation_name, details=details)
        except Exception as e:
            error_msg = f"获取交互元素失败 (Unexpected Error): {e}"
            logger.error(error_msg, exc_info=True)
            return MagicBrowserError(error=error_msg, operation=operation_name, details=details)

    async def take_screenshot(self, page_id: str, path: Optional[str] = None, full_page: bool = False) -> MagicBrowserResult:
        """截取指定页面的屏幕截图"""
        operation_name = "take_screenshot"
        page = await self.get_page_by_id(page_id)
        if not page:
            return MagicBrowserError(error=f"页面不存在或已关闭: {page_id}", operation=operation_name)

        target_path_obj: Optional[Path] = None
        is_temp: bool = False
        final_path_str: str = ""

        try:
            if path:
                target_path_obj = Path(path)
                is_temp = False
                final_path_str = path
                try:
                    target_path_obj.parent.mkdir(parents=True, exist_ok=True)
                except Exception as mkdir_e:
                    return MagicBrowserError(error=f"无法创建截图目录: {mkdir_e}", operation=operation_name, details={"path": path})
            else:
                if not self._TEMP_SCREENSHOT_DIR:
                    return MagicBrowserError(error="临时截图目录不可用", operation=operation_name)
                temp_filename = f"screenshot_{uuid.uuid4()}.png"
                target_path_obj = self._TEMP_SCREENSHOT_DIR / temp_filename
                is_temp = True
                final_path_str = str(target_path_obj)

            logger.info(f"{operation_name}: 页面 {page_id} 截图至 '{final_path_str}' (Full: {full_page}, Temp: {is_temp})")
            await page.screenshot(path=final_path_str, full_page=full_page, timeout=SCREENSHOT_TIMEOUT_MS)

            # 如果是临时文件，添加到管理列表
            if is_temp and target_path_obj:
                self._temp_files.append(target_path_obj)
                logger.debug(f"临时截图文件 {target_path_obj} 已添加到待清理列表。")

            logger.info(f"{operation_name}: 页面 {page_id} 截图成功。")
            # 确保返回 Path 对象
            return ScreenshotSuccess(path=target_path_obj if target_path_obj else Path(final_path_str), is_temp=is_temp)

        except PlaywrightError as e:
            error_msg = f"截图失败 (Playwright Error): {e}"
            logger.error(error_msg, exc_info=False)
            return MagicBrowserError(error=error_msg, operation=operation_name, details={"path": final_path_str, "full_page": full_page, "page_id": page_id})
        except Exception as e:
            error_msg = f"截图失败 (Unexpected Error): {e}"
            logger.error(error_msg, exc_info=True)
            return MagicBrowserError(error=error_msg, operation=operation_name, details={"path": final_path_str, "full_page": full_page, "page_id": page_id})

    async def evaluate_js(self, page_id: str, js_code: str) -> MagicBrowserResult:
        """在指定页面上执行 JavaScript 代码"""
        operation_name = "evaluate_js"
        page = await self.get_page_by_id(page_id)
        if not page:
            return MagicBrowserError(error=f"页面不存在或已关闭: {page_id}", operation=operation_name)

        details = {"js_code_preview": js_code[:100] + '...', "page_id": page_id}

        try:
            logger.debug(f"{operation_name}: 页面 {page_id} 执行 JS: '{details['js_code_preview']}'")
            result = await page.evaluate(js_code)
            logger.debug(f"{operation_name}: 页面 {page_id} 执行 JS 成功, 返回类型: {type(result)}")
            return JSEvalSuccess(result=result)

        except PlaywrightError as e:
            error_msg = f"执行 JS 失败 (Playwright Error): {e}"
            logger.error(error_msg, exc_info=False)
            return MagicBrowserError(error=error_msg, operation=operation_name, details=details)
        except Exception as e:
            error_msg = f"执行 JS 失败 (Unexpected Error): {e}"
            logger.error(error_msg, exc_info=True)
            return MagicBrowserError(error=error_msg, operation=operation_name, details=details)

    # --- Cleanup ---
    async def cleanup_temp_files(self):
        """清理所有由该浏览器实例创建的临时文件"""
        if not self._temp_files:
            return
        logger.info(f"开始清理 {len(self._temp_files)} 个浏览器临时文件...")
        # 使用 safe_delete 进行并发清理
        tasks = [safe_delete(f) for f in self._temp_files]
        await asyncio.gather(*tasks)
        cleared_count = len(self._temp_files) # 记录清理的数量
        self._temp_files.clear()
        logger.info(f"浏览器临时文件清理完成 ({cleared_count} 个)。")

    async def close(self) -> None:
        """关闭浏览器, 关闭所有管理的页面, 注销客户端并清理临时文件"""
        if not self._initialized:
            return
        logger.info("开始关闭 MagicBrowser...")
        try:
            # 关闭所有管理的页面
            page_close_tasks = []
            managed_ids = list(self._managed_page_ids) # 迭代副本
            for page_id in managed_ids:
                page = await self.get_page_by_id(page_id) # 使用已包含检查的方法
                if page:
                    logger.debug(f"请求关闭页面: {page_id}")
                    page_close_tasks.append(page.close()) # 添加关闭任务
                # 主动从注册表注销，即使 page.close() 失败或页面已关闭
                await self._page_registry.unregister_page(page_id)

            if page_close_tasks:
                # 并发关闭页面，忽略个别错误
                results = await asyncio.gather(*page_close_tasks, return_exceptions=True)
                for i, result in enumerate(results):
                    if isinstance(result, Exception):
                        logger.warning(f"关闭页面 {managed_ids[i]} 时出现错误: {result}")

            self._managed_page_ids.clear()
            self._active_page_id = None
            logger.info("所有管理的页面已请求关闭并注销。")

            # 先关闭本实例创建的浏览器上下文，再注销客户端引用
            # 不能依赖 unregister_client ref=0 时的全量清理，否则中间实例的 context 会泄漏
            if self._active_context_id:
                try:
                    await self._browser_manager.close_context(self._active_context_id)
                except Exception as ctx_e:
                    logger.warning(f"关闭浏览器上下文 {self._active_context_id} 时出错: {ctx_e}")
            await self._browser_manager.unregister_client()
            self._active_context_id = None


            # 清理临时文件
            await self.cleanup_temp_files()

            self._initialized = False
            logger.info("MagicBrowser 关闭完成。")

        except Exception as e:
            logger.error(f"关闭 MagicBrowser 时发生异常: {e}", exc_info=True)
        finally:
            # 确保状态被重置
            self._initialized = False
            self._active_page_id = None
            self._active_context_id = None
            self._managed_page_ids.clear()
            self._temp_files.clear() # 再次清空以防万一

    async def _wait_for_stable_network(self, page: Page, wait_time: float = 0.5, max_wait_time: float = 5.0):
        """等待网络活动稳定 (内部辅助方法)"""
        # 记录活动请求和最后活动时间
        pending_requests = set()
        last_activity = asyncio.get_event_loop().time()

        # 定义关键资源类型
        RELEVANT_RESOURCE_TYPES = {
            'document', 'xhr', 'fetch', 'script',
            'stylesheet', 'image', 'font'
        }

        # 需要忽略的URL模式
        IGNORED_URL_PATTERNS = {
            'analytics', 'tracking', 'beacon', 'telemetry',
            'adserver', 'advertising', 'facebook.com/plugins',
            'platform.twitter', 'heartbeat', 'ping', 'wss://'
        }

        # 网络请求处理函数
        async def on_request(request):
            # 过滤资源类型
            if request.resource_type not in RELEVANT_RESOURCE_TYPES:
                return

            # 过滤忽略的URL模式
            url = request.url.lower()
            if any(pattern in url for pattern in IGNORED_URL_PATTERNS):
                return

            # 过滤数据URL和二进制对象URL
            if url.startswith(('data:', 'blob:')):
                return

            nonlocal last_activity
            pending_requests.add(request)
            last_activity = asyncio.get_event_loop().time()

        # 网络响应处理函数
        async def on_response(response):
            request = response.request
            if request not in pending_requests:
                return

            # 过滤不需要等待的内容类型
            content_type = response.headers.get('content-type', '').lower()
            if any(t in content_type for t in ['streaming', 'video', 'audio', 'event-stream']):
                pending_requests.remove(request)
                return

            nonlocal last_activity
            pending_requests.remove(request)
            last_activity = asyncio.get_event_loop().time()

        # 设置请求和响应监听器
        page.on("request", on_request)
        page.on("response", on_response)

        try:
            # 等待网络稳定
            start_time = asyncio.get_event_loop().time()
            while asyncio.get_event_loop().time() - start_time < max_wait_time:
                await asyncio.sleep(0.1)
                now = asyncio.get_event_loop().time()

                # 如果没有待处理请求且已稳定一段时间，则认为网络已稳定
                if len(pending_requests) == 0 and (now - last_activity) >= wait_time:
                    break

            # 如果超时但仍有请求
            if len(pending_requests) > 0:
                logger.debug(f"等待网络稳定超时 (>{max_wait_time}s)，仍有 {len(pending_requests)} 个活动请求")

        finally:
            # 移除监听器
            try:
                page.remove_listener("request", on_request)
                page.remove_listener("response", on_response)
            except Exception as remove_e:
                # 在页面关闭等情况下移除监听器可能失败，忽略错误
                logger.debug(f"移除网络监听器时出错 (可能页面已关闭): {remove_e}")

# JSLoader 移至 js_loader.py
# 其他依赖类 (BrowserManager, MagicBrowserConfig, PageRegistry) 从各自文件导入
