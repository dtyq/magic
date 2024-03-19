"""
浏览器管理模块

管理全局唯一的 Playwright 浏览器实例和上下文，
提供浏览器初始化、上下文创建和生命周期管理功能。
"""

import asyncio
import os
from typing import Dict, Optional

from playwright.async_api import Browser, BrowserContext, async_playwright

from agentlang.logger import get_logger
from magic_use.magic_browser_config import MagicBrowserConfig
from magic_use.server_health_checker import wait_for_browser_server

# 设置日志
logger = get_logger(__name__)


class BrowserManager:
    """浏览器管理器，负责全局浏览器实例和上下文的生命周期管理"""

    _instance = None
    _initialized = False

    def __new__(cls):
        """单例模式实现"""
        if cls._instance is None:
            cls._instance = super(BrowserManager, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        """初始化浏览器管理器"""
        # 如果已经初始化过，则跳过
        if BrowserManager._initialized:
            return

        self._playwright = None
        self._browser = None
        self._initialized = False
        self._contexts: Dict[str, BrowserContext] = {}  # 上下文ID到对象的映射
        self._context_counter = 0  # 上下文ID计数器
        self._lock = asyncio.Lock()  # 用于保护并发初始化
        self._storage_save_tasks = {}  # 存储状态定期保存任务
        self._client_refs = 0  # 客户端引用计数

        BrowserManager._initialized = True

    async def register_client(self) -> None:
        """注册浏览器客户端，增加引用计数"""
        async with self._lock:
            self._client_refs += 1
            logger.debug(f"注册浏览器客户端，当前引用数: {self._client_refs}")

    async def unregister_client(self) -> None:
        """注销浏览器客户端，减少引用计数

        当引用计数归零时，自动关闭浏览器实例
        """
        async with self._lock:
            if self._client_refs > 0:
                self._client_refs -= 1

            logger.debug(f"注销浏览器客户端，当前引用数: {self._client_refs}")

            # 如果没有活跃客户端，则自动关闭浏览器
            if self._client_refs == 0 and self._initialized:
                await self.close()

    async def initialize(self, config: MagicBrowserConfig = None) -> None:
        """初始化浏览器实例

        根据配置选择本地模式或服务端模式：
        - 本地模式：启动本地浏览器实例（browser_type.launch）
        - 服务端模式：连接远程浏览器服务端（browser_type.connect）

        Args:
            config: 浏览器配置，如果为None则使用默认爬虫配置
        """
        # 使用锁防止并发初始化
        async with self._lock:
            if self._initialized:
                logger.debug("浏览器已初始化，跳过重复初始化")
                return

            self.config = config or MagicBrowserConfig.create_for_scraping()

            try:
                # 启动 Playwright
                logger.debug("启动 Playwright 实例")
                self._playwright = await async_playwright().start()

                # 获取浏览器类型
                browser_type_mapping = {
                    "chromium": self._playwright.chromium,
                    "firefox": self._playwright.firefox,
                    "webkit": self._playwright.webkit
                }

                browser_type = browser_type_mapping.get(self.config.browser_type.lower())
                if not browser_type:
                    logger.warning(f"未知的浏览器类型: {self.config.browser_type}，使用 chromium")
                    browser_type = self._playwright.chromium

                # 根据配置选择初始化模式
                if self.config.use_server_mode:
                    # 服务端模式：连接远程浏览器服务器
                    await self._initialize_server_mode(browser_type)
                else:
                    # 本地模式：启动本地浏览器实例
                    await self._initialize_local_mode(browser_type)

                self._initialized = True
                logger.info(f"浏览器初始化完成 (模式: {'服务端' if self.config.use_server_mode else '本地'})")

            except Exception as e:
                logger.error(f"初始化浏览器失败: {e}", exc_info=True)
                # 清理资源
                if self._playwright:
                    try:
                        await self._playwright.stop()
                    except Exception as stop_error:
                        logger.error(f"停止 Playwright 时出错: {stop_error}")
                    self._playwright = None
                raise

    async def _initialize_local_mode(self, browser_type) -> None:
        """
        本地模式初始化：启动本地浏览器实例

        Args:
            browser_type: Playwright 浏览器类型对象
        """
        logger.info("使用本地模式初始化浏览器")

        # 移除user_data_dir相关配置，避免冲突
        browser_args = self.config.browser_args.copy()
        user_data_dir_args = [arg for arg in browser_args if '--user-data-dir' in arg]
        for arg in user_data_dir_args:
            browser_args.remove(arg)
            logger.warning(f"移除user_data_dir参数: {arg}")

        # 启动浏览器，并使用配置生成的启动选项
        launch_options = self.config.to_launch_options()
        launch_options["args"] = browser_args

        logger.debug(f"浏览器启动选项: {launch_options}")
        self._browser = await browser_type.launch(**launch_options)

        logger.info(f"已启动本地浏览器: {self.config.browser_type}")

    async def _initialize_server_mode(self, browser_type) -> None:
        """
        服务端模式初始化：连接远程浏览器服务器

        Args:
            browser_type: Playwright 浏览器类型对象
        """
        ws_url = self.config.browser_server_url
        logger.info(f"使用服务端模式初始化浏览器，服务端地址: {ws_url}")

        # 步骤1：等待服务端就绪
        try:
            logger.info("开始检查浏览器服务端健康状态")
            await wait_for_browser_server(
                ws_url=ws_url,
                timeout=self.config.server_health_check_timeout,
                check_interval=self.config.server_health_check_interval
            )
            logger.info("浏览器服务端健康检查通过")
        except TimeoutError as e:
            error_msg = f"浏览器服务端健康检查超时: {e}"
            logger.error(error_msg)
            raise RuntimeError(error_msg) from e
        except Exception as e:
            error_msg = f"浏览器服务端健康检查失败: {e}"
            logger.error(error_msg, exc_info=True)
            raise RuntimeError(error_msg) from e

        # 步骤2：连接到浏览器服务端
        try:
            logger.info(f"开始连接到浏览器服务端: {ws_url}")

            # 使用 connect 方法连接到远程浏览器
            # 注意：connect 方法不支持 launch_options 中的大部分参数
            # 这些参数应该在服务端启动时配置
            connect_options = {
                "timeout": self.config.server_connect_timeout
            }

            logger.debug(f"连接选项: {connect_options}")
            self._browser = await browser_type.connect(ws_url, **connect_options)

            logger.info(f"已成功连接到浏览器服务端: {ws_url}")

        except Exception as e:
            error_msg = f"连接浏览器服务端失败: {e}"
            logger.error(error_msg, exc_info=True)
            raise RuntimeError(error_msg) from e

    async def get_context(self, config: Optional[MagicBrowserConfig] = None) -> tuple[str, BrowserContext]:
        """获取或创建浏览器上下文

        如果浏览器尚未初始化，则先初始化浏览器

        Args:
            config: 浏览器配置，如果为None则使用管理器的默认配置

        Returns:
            tuple: (上下文ID, 上下文对象)
        """
        if not self._initialized:
            await self.initialize(config)

        # 创建新的上下文
        context_id = self._generate_context_id()
        context_config = config or self.config
        context_options = await context_config.to_context_options()

        # 创建上下文
        context = await self._browser.new_context(**context_options)

        # 注入反指纹脚本
        try:
            # 获取语言设置，从 context_config 中提取
            language_setting = context_config.language or "zh-CN"
            # 提取主要语言，例如从 "zh-CN,zh;q=0.9,en;q=0.8" 中提取 "zh-CN"
            primary_language = language_setting.split(',')[0]
            # 构造语言数组，将主要语言放在首位
            languages_array = f"['{primary_language}'"
            # 如果有其它语言偏好，也添加进来（按优先级排序）
            secondary_languages = []
            for lang_pref in language_setting.split(',')[1:]:
                if ';' in lang_pref:
                    lang = lang_pref.split(';')[0].strip()
                    if lang and lang != primary_language:
                        secondary_languages.append(f"'{lang}'")
                elif lang_pref.strip() and lang_pref.strip() != primary_language:
                    secondary_languages.append(f"'{lang_pref.strip()}'")

            if secondary_languages:
                languages_array += ", " + ", ".join(secondary_languages)
            languages_array += "]"

            anti_fingerprint_script = f"""
            // Webdriver属性隐藏
            Object.defineProperty(navigator, 'webdriver', {{
                get: () => undefined
            }});

            // 根据配置统一语言设置
            Object.defineProperty(navigator, 'languages', {{
                get: () => {languages_array}
            }});

            // 模拟插件
            Object.defineProperty(navigator, 'plugins', {{
                get: () => [1, 2, 3, 4, 5]
            }});

            // Chrome运行时环境
            window.chrome = {{ runtime: {{}} }};

            // 权限查询
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({{ state: Notification.permission }}) :
                    originalQuery(parameters)
            );

            // Shadow DOM处理
            (function () {{
                const originalAttachShadow = Element.prototype.attachShadow;
                Element.prototype.attachShadow = function attachShadow(options) {{
                    return originalAttachShadow.call(this, {{ ...options, mode: "open" }});
                }};
            }})();
            """
            await context.add_init_script(anti_fingerprint_script)
            logger.debug(f"已为上下文 {context_id} 注入反指纹JS脚本，语言设置: {languages_array}")
        except Exception as e:
            logger.error(f"注入反指纹JS脚本失败: {e}")

        # 注册上下文
        self._contexts[context_id] = context

        # 设置定期保存存储状态的任务
        if context_config.storage_state_file:
            save_task = asyncio.create_task(self._periodic_save_storage_state(context_id))
            self._storage_save_tasks[context_id] = save_task

        logger.info(f"已创建浏览器上下文: {context_id}")
        return context_id, context

    def _generate_context_id(self) -> str:
        """生成唯一的上下文ID"""
        self._context_counter += 1
        return f"ctx_{self._context_counter}"

    async def get_context_by_id(self, context_id: str) -> Optional[BrowserContext]:
        """根据ID获取浏览器上下文

        Args:
            context_id: 上下文ID

        Returns:
            Optional[BrowserContext]: 上下文对象，如果不存在则返回None
        """
        return self._contexts.get(context_id)

    async def _save_context_storage_state(self, context_id: str) -> None:
        """保存上下文存储状态

        Args:
            context_id: 上下文ID
        """
        context = self._contexts.get(context_id)
        if not context or not self.config.storage_state_file:
            if not context:
                logger.warning(f"无法保存存储状态：上下文 {context_id} 不存在")
            elif not self.config.storage_state_file:
                logger.warning(f"无法保存存储状态：未配置存储状态文件路径，上下文 {context_id}")
            return

        try:
            await self.config.save_storage_state(context)
        except Exception as e:
            logger.error(f"保存上下文存储状态失败: {context_id}, {e}")

    async def _periodic_save_storage_state(self, context_id: str) -> None:
        """定期保存上下文存储状态的任务

        Args:
            context_id: 上下文ID
        """
        try:
            while context_id in self._contexts:
                # 每15分钟保存一次存储状态
                await asyncio.sleep(15 * 60)
                await self._save_context_storage_state(context_id)
        except asyncio.CancelledError:
            # 任务被取消时不再尝试保存状态，由 close_context 统一处理
            # await self._save_context_storage_state(context_id)
            pass
        except Exception as e:
            logger.error(f"定期保存存储状态任务失败: {context_id}, {e}")

    async def close_context(self, context_id: str) -> None:
        """关闭并移除上下文

        Args:
            context_id: 上下文ID
        """
        # 先获取上下文对象，而不是直接 pop
        context = self._contexts.get(context_id)

        if context:
            # 取消定期保存任务
            save_task = self._storage_save_tasks.pop(context_id, None)
            if save_task:
                save_task.cancel()
                try:
                    # 等待任务结束，忽略 CancelledError
                    await save_task
                except asyncio.CancelledError:
                    logger.debug(f"上下文 {context_id} 的保存任务已取消。")
                except Exception as e:
                    logger.error(f"等待上下文 {context_id} 的保存任务结束时出错: {e}")

            # 在移除上下文之前，保存最终状态
            if self.config and self.config.storage_state_file:
                try:
                    logger.debug(f"尝试保存上下文 {context_id} 的最终存储状态...")
                    # 直接使用 context 对象进行保存
                    await self.config.save_storage_state(context)
                    logger.info(f"已成功保存上下文 {context_id} 的最终存储状态。")
                except Exception as e:
                    logger.error(f"保存上下文 {context_id} 的最终存储状态失败: {e}")
            else:
                logger.debug(f"未配置存储状态文件路径或无配置，跳过上下文 {context_id} 的最终状态保存。")

            # 从字典中移除上下文ID
            self._contexts.pop(context_id, None)

            # 关闭上下文
            try:
                await context.close()
                logger.info(f"已关闭浏览器上下文: {context_id}")
            except Exception as e:
                logger.error(f"关闭 Playwright 上下文 {context_id} 时出错: {e}")
        else:
            logger.warning(f"尝试关闭一个不存在或已被关闭的上下文: {context_id}")

    async def close(self) -> None:
        """关闭浏览器和Playwright

        关闭所有上下文和浏览器实例
        """
        if not self._initialized:
            logger.debug("浏览器未初始化，无需关闭")
            return

        mode = "服务端" if (self.config and self.config.use_server_mode) else "本地"
        logger.info(f"开始关闭浏览器 (模式: {mode})")

        try:
            # 关闭所有上下文
            context_ids = list(self._contexts.keys())
            for context_id in context_ids:
                await self.close_context(context_id)

            # 关闭浏览器
            if self._browser:
                await self._browser.close()
                self._browser = None
                logger.info(f"已关闭浏览器 (模式: {mode})")

            # 停止Playwright
            if self._playwright:
                await self._playwright.stop()
                self._playwright = None
                logger.info("已停止 Playwright")

            self._initialized = False
            logger.info(f"浏览器关闭完成 (模式: {mode})")

        except Exception as e:
            logger.error(f"关闭浏览器失败: {e}", exc_info=True)
            raise
