"""
页面注册表模块

提供全局页面管理功能，
负责页面的注册、注销和状态跟踪。
"""

import asyncio
import math
from typing import Dict, List, Optional, Union

from pydantic import BaseModel, Field
from playwright.async_api import Page

from agentlang.logger import get_logger
from magic_use.js_loader import JSLoader
from magic_use.userscript_manager import UserscriptManager

# 设置日志
logger = get_logger(__name__)


# 页面状态相关数据模型
class ScrollPosition(BaseModel):
    """页面滚动位置和尺寸信息"""
    x: float = 0.0
    y: float = 0.0
    document_width: float = 0.0
    document_height: float = 0.0
    viewport_width: float = 0.0
    viewport_height: float = 0.0


class PositionInfo(BaseModel):
    """页面相对位置计算信息"""
    total_screens: float = 0.0
    current_screen: float = 0.0
    read_percent: float = 0.0
    remaining_percent: float = 0.0


class PageState(BaseModel):
    """单个页面的结构化状态信息"""
    page_id: str
    url: Optional[str] = None
    title: Optional[str] = None
    context_id: Optional[str] = None
    scroll_position: Optional[ScrollPosition] = Field(default=None, description="详细滚动和尺寸数据")
    position_info: Optional[PositionInfo] = Field(default=None, description="计算出的相对位置数据")
    error: Optional[str] = Field(default=None, description="获取状态时发生的错误信息")


class PageRegistry:
    """页面注册表，负责全局页面管理"""

    _instance = None
    _initialized = False
    _userscript_manager: Optional[UserscriptManager] = None
    _userscript_load_task: Optional[asyncio.Task] = None

    def __new__(cls):
        """单例模式实现"""
        if cls._instance is None:
            cls._instance = super(PageRegistry, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        """初始化页面注册表"""
        # 如果已经初始化过，则跳过
        if PageRegistry._initialized:
            return

        self._pages: Dict[str, Page] = {}  # 页面ID到页面对象的映射
        self._page_counter = 0  # 页面ID计数器
        self._js_loaders: Dict[str, JSLoader] = {}  # 页面ID到JS加载器的映射
        self._page_contexts: Dict[str, str] = {}  # 页面ID到上下文ID的映射
        self._lock = asyncio.Lock()  # 用于保护注册和注销操作

        # 获取 UserscriptManager 实例并后台加载脚本
        # 使用 create_task 避免阻塞 __init__
        if PageRegistry._userscript_manager is None and PageRegistry._userscript_load_task is None:
            async def _init_userscript_manager():
                try:
                    PageRegistry._userscript_manager = await UserscriptManager.get_instance()
                    await PageRegistry._userscript_manager.load_scripts()
                except Exception as e:
                    logger.error(f"初始化或加载 UserscriptManager 失败: {e}", exc_info=True)
                finally:
                    PageRegistry._userscript_load_task = None # 清理任务引用

            PageRegistry._userscript_load_task = asyncio.create_task(_init_userscript_manager())
            logger.info("已启动后台 Userscript 加载任务。")


        PageRegistry._initialized = True

    def _generate_page_id(self) -> str:
        """生成唯一的页面ID"""
        self._page_counter += 1
        return f"page_{self._page_counter}"

    async def register_page(self, page: Page, context_id: Optional[str] = None) -> str:
        """注册页面

        Args:
            page: Playwright页面对象
            context_id: 页面所属的上下文ID，可以为None

        Returns:
            str: 页面ID
        """
        async with self._lock:
            page_id = self._generate_page_id()
            self._pages[page_id] = page

            # 创建并关联JS加载器
            self._js_loaders[page_id] = JSLoader(page)

            # 记录页面所属的上下文，如果有
            if context_id:
                self._page_contexts[page_id] = context_id

            # 修改页面加载处理函数
            async def handle_page_load_and_script_injection():
                # 检查页面是否仍然有效，避免在已关闭页面上操作
                if page.is_closed():
                    logger.warning(f"页面 {page_id} 在处理加载事件前已关闭。")
                    return

                page_url = ""
                try:
                    page_url = page.url # 先获取 URL
                    # 只跳过浏览器内置页面
                    if page_url.startswith(('chrome://', 'chrome-error://', 'about:', 'edge://', 'firefox://')):
                        logger.debug(f"页面 {page_id} URL: {page_url} 是内置页面，跳过脚本注入。")
                        return

                    # 1. 加载核心模块并初始化 (marker, pure)
                    core_modules = ["marker", "pure"]
                    core_success = False
                    for module in core_modules:
                        # 确保 JS 模块加载函数现在处理 page_id
                        load_result = await self.ensure_js_module_loaded(page_id, module)
                        if load_result.get(module, False):
                            core_success = True
                    if not core_success:
                        logger.warning(f"页面 {page_id} URL: {page_url} 核心 JS 模块加载不完全，可能影响后续操作。")
                        # 即使核心模块失败，也尝试加载油猴脚本？或者直接返回？
                        # return # 暂时选择返回，避免在不完整状态下注入

                    # 初始化 MagicMarker (如果存在)
                    # 检查 MagicMarker 是否真的存在，避免不必要的 evaluate 调用
                    if core_success and "marker" in core_modules: # 假设 marker 模块提供了 MagicMarker
                        await page.evaluate("if(typeof window.MagicMarker !== 'undefined' && window.MagicMarker.mark) window.MagicMarker.mark()")

                    logger.info(f"页面 {page_id} URL: {page_url} 核心 JS 模块加载完成。")


                    # 2. 注入匹配的油猴脚本 (Userscripts)
                    if self._userscript_manager:
                        # 确保 userscript manager 已经初始化完成
                        # 可以加一个简单的等待，或者依赖于 manager 内部的 initialized 标志
                        if not self._userscript_manager._initialized:
                            # 如果还在加载中，可以稍微等待一下
                            if PageRegistry._userscript_load_task:
                                logger.debug(f"页面 {page_id} 等待 Userscript 加载完成...")
                                try:
                                     await asyncio.wait_for(PageRegistry._userscript_load_task, timeout=10.0) # 设置超时
                                except asyncio.TimeoutError:
                                     logger.warning(f"等待 Userscript 加载超时，页面 {page_id} 可能不会注入油猴脚本。")
                                except Exception as e:
                                     logger.error(f"等待 Userscript 加载时出错: {e}", exc_info=True)

                        if self._userscript_manager._initialized:
                             # 获取匹配脚本 (目前只处理 document-end)
                             matching_scripts = self._userscript_manager.get_matching_scripts(url=page_url, run_at="document-end")
                             if matching_scripts:
                                 logger.info(f"页面 {page_id} URL: {page_url} 找到 {len(matching_scripts)} 个匹配的油猴脚本，准备注入...")
                                 for script in matching_scripts:
                                     try:
                                         # 再次检查页面是否关闭
                                         if page.is_closed():
                                             logger.warning(f"页面 {page_id} 在注入脚本 '{script.name}' 前已关闭。")
                                             break # 停止注入后续脚本
                                         await page.add_script_tag(content=script.content)
                                         logger.debug(f"成功注入脚本 '{script.name}' 到页面 {page_id}")
                                     except Exception as e:
                                         # 同样处理 Playwright 导航/关闭错误
                                         if "Navigation or evaluation failed" in str(e) or "Target page, context or browser has been closed" in str(e):
                                             logger.warning(f"注入油猴脚本 '{script.name}' 时页面 {page_id} 发生导航或关闭错误: {e!s}")
                                             break # 停止注入后续脚本
                                         else:
                                             logger.error(f"注入油猴脚本 '{script.name}' 到页面 {page_id} 失败: {e!s}", exc_info=True)
                             else:
                                logger.debug(f"页面 {page_id} URL: {page_url} 没有找到匹配的油猴脚本 (run_at=document-end)。")
                        else:
                             logger.warning(f"Userscript manager 未能成功初始化，无法为页面 {page_id} 注入油猴脚本。")
                    else:
                         logger.warning("Userscript manager 实例不存在，无法注入油猴脚本。")

                except Exception as e:
                    # 捕获处理过程中的任何其他异常
                    # playwright._impl._api_types.Error: Navigation or evaluation failed
                    # 这类错误可能在页面跳转或关闭时发生，需要优雅处理
                    if "Navigation or evaluation failed" in str(e) or "Target page, context or browser has been closed" in str(e):
                         logger.warning(f"页面 {page_id} (URL: {page_url}) 在处理加载/注入时发生导航或关闭错误: {e!s}")
                    else:
                         logger.error(f"处理页面 {page_id} (URL: {page_url}) 加载和脚本注入时发生意外错误: {e!s}", exc_info=True)

            # 监听页面事件
            # 页面完全加载后（包括所有资源）再执行核心JS加载和油猴脚本注入
            # 这比domcontentloaded事件更晚触发，页面更稳定，减少导航冲突
            # 使用 lambda: asyncio.create_task(...) 确保异步执行且不阻塞事件循环
            page.on("load", lambda: asyncio.create_task(handle_page_load_and_script_injection()))

            # 处理页面关闭事件
            await self._set_page_close_listener(page, page_id)

            logger.info(f"已注册页面: {page_id}")
            return page_id

    async def unregister_page(self, page_id: str) -> None:
        """注销页面

        Args:
            page_id: 页面ID
        """
        async with self._lock:
            self._pages.pop(page_id, None)
            self._js_loaders.pop(page_id, None)
            self._page_contexts.pop(page_id, None)
            logger.info(f"已注销页面: {page_id}")

    async def _set_page_close_listener(self, page: Page, page_id: str) -> None:
        """设置页面关闭事件监听器

        当页面关闭时自动从注册表中注销

        Args:
            page: Playwright页面对象
            page_id: 页面ID
        """
        # 定义关闭处理函数
        async def handle_close():
            # 在注销前尝试移除事件监听器，减少潜在的内存泄漏风险
            # 注意：Playwright 的 page.remove_listener 可能需要原始的 lambda 函数引用，这比较麻烦
            # 通常 Playwright 会在页面关闭时自动清理监听器，所以这里可以省略显式移除
            # page.remove_listener("domcontentloaded", the_lambda_reference) # 难以获取 lambda 引用
            await self.unregister_page(page_id)

        # 监听页面关闭事件
        page.on("close", lambda: asyncio.create_task(handle_close()))

    async def get_page_by_id(self, page_id: str) -> Optional[Page]:
        """根据ID获取页面

        Args:
            page_id: 页面ID

        Returns:
            Optional[Page]: 页面对象，如果不存在则返回None
        """
        # 增加检查，如果页面对象存在但已关闭，也返回 None
        page = self._pages.get(page_id)
        if page and page.is_closed():
             logger.debug(f"尝试获取已关闭的页面: {page_id}")
             # 从注册表中移除已关闭的页面，防止后续访问
             # 注意：关闭事件应该已经触发了 unregister_page，这里是双重保险
             # 如果 unregister_page 由于某种原因未执行，这里可以补救
             # 但需要注意并发问题，最好依赖 close 事件
             # async with self._lock:
             #     self._pages.pop(page_id, None)
             #     self._js_loaders.pop(page_id, None)
             #     self._page_contexts.pop(page_id, None)
             return None
        return page

    async def get_context_id_for_page(self, page_id: str) -> Optional[str]:
        """获取页面所属的上下文ID

        Args:
            page_id: 页面ID

        Returns:
            Optional[str]: 上下文ID，如果不存在则返回None
        """
        # 可以在这里也加入页面是否存在的检查，如果 page_id 不在 self._pages 中，直接返回 None
        if page_id not in self._pages:
             return None
        return self._page_contexts.get(page_id)

    async def ensure_js_module_loaded(self, page_id: str, module_names: Union[str, List[str]]) -> Dict[str, bool]:
        """确保指定页面加载了JS模块

        Args:
            page_id: 页面ID
            module_names: 模块名称或名称列表

        Returns:
            Dict[str, bool]: 加载结果，键为模块名，值为是否成功
        """
        js_loader = self._js_loaders.get(page_id)
        page = await self.get_page_by_id(page_id) # 使用 get_page_by_id 获取页面，包含关闭检查

        # 增加检查：如果页面或加载器不存在，或页面已关闭，则不加载
        if not js_loader or not page: # page 已经是检查过是否关闭的了
            logger.warning(f"页面 {page_id} 无效或已关闭，无法加载 JS 模块: {module_names}")
            if isinstance(module_names, str):
                return {module_names: False}
            else:
                return {name: False for name in module_names}

        # 统一转换为列表
        if isinstance(module_names, str):
            module_names = [module_names]

        results = {}
        for module_name in module_names:
            try:
                # 再次检查页面状态，因为加载可能是异步的
                if page.is_closed():
                     logger.warning(f"页面 {page_id} 在尝试加载模块 '{module_name}' 前已关闭。")
                     results[module_name] = False
                     continue
                success = await js_loader.load_module(module_name)
                results[module_name] = success
            except Exception as e:
                # 同样处理 Playwright 导航/关闭错误
                if "Navigation or evaluation failed" in str(e) or "Target page, context or browser has been closed" in str(e):
                     logger.warning(f"加载 JS 模块 '{module_name}' 时页面 {page_id} 发生导航或关闭错误: {e!s}")
                else:
                     logger.error(f"加载JS模块失败: {module_name} on page {page_id}, {e}", exc_info=True)
                results[module_name] = False

        return results

    async def _get_page_scroll_info(self, page: Page) -> Dict[str, Union[int, float]]:
        """获取页面滚动信息

        Args:
            page: Playwright页面对象

        Returns:
            Dict: 滚动信息，包括位置和文档高度
        """
        # 增加页面关闭检查
        if page.is_closed():
            logger.warning(f"尝试在已关闭的页面上获取滚动信息。")
            return {
                "x": 0, "y": 0, "document_width": 0, "document_height": 0,
                "viewport_width": 0, "viewport_height": 0
            }
        try:
            scroll_info = await page.evaluate("""
                () => {
                    return {
                        x: window.scrollX || window.pageXOffset,
                        y: window.scrollY || window.pageYOffset,
                        document_width: document.documentElement.scrollWidth,
                        document_height: document.documentElement.scrollHeight,
                        viewport_width: window.innerWidth,
                        viewport_height: window.innerHeight
                    };
                }
            """)
            return scroll_info
        except Exception as e:
            # 处理 Playwright 导航/关闭错误
            if "Navigation or evaluation failed" in str(e) or "Target page, context or browser has been closed" in str(e):
                 logger.warning(f"获取页面滚动信息时发生导航或关闭错误: {e!s}")
            else:
                 logger.error(f"获取页面滚动信息失败: {e}", exc_info=True)
            return {
                "x": 0, "y": 0, "document_width": 0, "document_height": 0,
                "viewport_width": 0, "viewport_height": 0
            }

    async def get_page_state(self, page_id: str) -> PageState:
        """获取页面状态信息

        基于页面ID获取完整的页面状态，包括滚动位置、内容百分比等信息。
        返回结构化的 PageState 对象，便于客户端理解和处理页面状态。

        Args:
            page_id: 页面ID

        Returns:
            PageState: 结构化的页面状态信息
        """
        page = await self.get_page_by_id(page_id) # 使用包含关闭检查的方法获取页面
        if not page:
            return PageState(page_id=page_id, error=f"页面不存在或已关闭: {page_id}")

        try:
            # 获取基本信息
            url = page.url # 如果页面刚关闭，这里可能出错
            title = await page.title() # 同上

            # 获取滚动位置信息
            scroll_info = await self._get_page_scroll_info(page)

            # 创建滚动位置对象
            scroll_position = ScrollPosition(
                x=scroll_info.get("x", 0),
                y=scroll_info.get("y", 0),
                document_width=scroll_info.get("document_width", 0),
                document_height=scroll_info.get("document_height", 0),
                viewport_width=scroll_info.get("viewport_width", 0),
                viewport_height=scroll_info.get("viewport_height", 0)
            )

            # 计算相对位置信息
            position_info = None
            current_pos = scroll_info.get("y", 0)
            doc_height = scroll_info.get("document_height", 0)
            viewport_height = scroll_info.get("viewport_height", 0)

            # 如果文档有高度和视口高度，计算相对位置数据
            if doc_height > 0 and viewport_height > 0:
                # 计算剩余和已读百分比
                remaining_height = max(0, doc_height - (current_pos + viewport_height))
                remaining_percent = round(remaining_height / doc_height * 100)
                read_percent = 100 - remaining_percent

                # 计算总屏数和当前屏位置
                total_screens = math.ceil(doc_height / viewport_height) if viewport_height > 0 else 1
                current_screen = math.ceil(current_pos / viewport_height + 1) if viewport_height > 0 else 1


                # 创建位置信息对象
                position_info = PositionInfo(
                    total_screens=total_screens,
                    current_screen=current_screen,
                    read_percent=read_percent,
                    remaining_percent=remaining_percent
                )

            # 返回完整的页面状态
            return PageState(
                page_id=page_id,
                url=url,
                title=title,
                scroll_position=scroll_position,
                position_info=position_info,
                context_id=self._page_contexts.get(page_id) # context_id 不依赖 page 对象状态
            )
        except Exception as e:
             # 处理 Playwright 导航/关闭错误
             if "Navigation or evaluation failed" in str(e) or "Target page, context or browser has been closed" in str(e):
                 logger.warning(f"获取页面状态时发生导航或关闭错误: {page_id}, {e!s}")
                 # 返回部分信息或标记错误
                 return PageState(
                    page_id=page_id,
                    error=f"获取页面状态时页面已关闭或导航失败: {str(e)}"
                 )
             else:
                 logger.error(f"获取页面状态失败: {page_id}, {e}", exc_info=True)
                 return PageState(
                     page_id=page_id,
                     error=f"获取页面状态失败: {str(e)}"
                 )

    async def get_all_pages(self) -> Dict[str, Page]:
        """获取所有**当前打开**的页面

        Returns:
            Dict[str, Page]: 页面ID到页面对象的映射 (只包含未关闭的页面)
        """
        # 返回副本，并过滤掉已关闭的页面
        active_pages = {}
        all_page_ids = list(self._pages.keys()) # 创建 key 的副本进行迭代
        for page_id in all_page_ids:
             page = await self.get_page_by_id(page_id) # 使用包含检查的方法
             if page:
                 active_pages[page_id] = page
        return active_pages

    async def get_page_basic_info(self, page_id: str) -> Dict[str, any]:
        """获取页面基本信息

        Args:
            page_id: 页面ID

        Returns:
            Dict: 页面基本信息，包括URL和标题，如果页面不存在或关闭则返回错误信息
        """
        page = await self.get_page_by_id(page_id) # 使用包含关闭检查的方法
        if not page:
            return {"page_id": page_id, "error": "页面不存在或已关闭"}

        try:
            url = page.url
            title = await page.title()
            return {
                "page_id": page_id,
                "url": url,
                "title": title,
                "context_id": self._page_contexts.get(page_id)
            }
        except Exception as e:
             # 处理 Playwright 导航/关闭错误
             if "Navigation or evaluation failed" in str(e) or "Target page, context or browser has been closed" in str(e):
                  logger.warning(f"获取页面基本信息时发生导航或关闭错误: {page_id}, {e!s}")
                  return {
                      "page_id": page_id,
                      "error": f"获取页面基本信息时页面已关闭或导航失败: {str(e)}"
                  }
             else:
                  logger.error(f"获取页面基本信息失败: {page_id}, {e}", exc_info=True)
                  return {
                      "page_id": page_id,
                      "error": f"获取页面基本信息失败: {str(e)}"
                  }
