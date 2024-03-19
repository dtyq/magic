"""
浏览器配置模块

提供浏览器配置类和相关功能，用于自定义浏览器行为和特性。
包含人类行为模拟、性能优化、用户代理伪装和会话持久化等功能。
"""

import os
import aiohttp
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from app.paths import PathManager
from agentlang.config.config import config
from agentlang.logger import get_logger

# 设置日志
logger = get_logger(__name__)

# 默认浏览器头部配置
DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    'Sec-Ch-Ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"macOS"'
}

@dataclass
class MagicBrowserProxyConfig:
    """代理服务器配置"""

    # 代理服务器地址（例如 http://proxy.example.com:8080）
    server: Optional[str] = None

    # 用户名（如果需要认证）
    username: Optional[str] = None

    # 密码（如果需要认证）
    password: Optional[str] = None

    # 不使用代理的地址列表（例如 ["localhost", "127.0.0.1"]）
    bypass: Optional[List[str]] = None

    def to_dict(self) -> Optional[Dict[str, Any]]:
        """转换为代理配置字典"""
        if not self.server:
            return None

        result = {"server": self.server}

        if self.username and self.password:
            result["username"] = self.username
            result["password"] = self.password

        if self.bypass:
            result["bypass"] = ",".join(self.bypass)

        return result


@dataclass
class MagicBrowserConfig:
    """浏览器配置类"""

    # 浏览器类型：chromium, firefox, webkit
    browser_type: str = "chromium"

    # 是否无头模式（不显示浏览器窗口）
    headless: bool = True

    # 浏览器窗口尺寸
    viewport_width: int = 1280
    viewport_height: int = 1940

    # 是否禁用安全特性（同源策略等）
    disable_security: bool = False

    # 是否启用人类行为模拟（模拟真实用户访问行为）
    human_behavior_simulation: bool = True

    # 是否启用浏览器指纹伪装
    fingerprint_mask: bool = True

    # 是否启用性能优化
    performance_optimization: bool = True

    # 是否禁用弹窗和通知
    disable_popups: bool = True

    # 是否启用更多高级人类行为模拟设置
    advanced_human_behavior_simulation: bool = False

    # 代理配置
    proxy: Optional[MagicBrowserProxyConfig] = None

    # 隐式等待超时时间（毫秒）
    default_timeout: int = 30000

    # 截图和下载文件的保存路径
    download_path: Optional[str] = None

    # 浏览器启动参数
    browser_args: List[str] = field(default_factory=list)

    # 用户代理字符串和其他HTTP头部
    user_agent: Optional[str] = DEFAULT_HEADERS['User-Agent']

    # 自定义HTTP头部
    extra_headers: Dict[str, str] = field(default_factory=lambda: DEFAULT_HEADERS.copy())

    # 浏览器语言设置
    language: str = "zh-CN,zh;q=0.9,en;q=0.8"

    # 是否启用地理位置欺骗
    geolocation_spoofing: bool = False

    # 地理位置（经纬度）
    geolocation: Optional[Dict[str, float]] = None

    # 时区ID
    timezone_id: Optional[str] = None

    # 浏览器存储状态保存路径
    storage_state_file: Optional[str] = None

    # 浏览器权限列表
    permissions: Optional[List[str]] = None

    # ========== 服务端模式配置 ==========
    # 是否使用服务端模式（连接远程浏览器服务器）
    use_server_mode: bool = False

    # 浏览器服务端 WebSocket URL（例如：ws://127.0.0.1:3000）
    browser_server_url: Optional[str] = None

    # 服务端健康检查超时时间（秒）
    server_health_check_timeout: int = 60

    # 服务端健康检查重试间隔（秒）
    server_health_check_interval: float = 1.0

    # 服务端连接超时时间（毫秒）
    server_connect_timeout: int = 30000
    # ========== 服务端模式配置结束 ==========

    def __post_init__(self):
        """初始化后处理"""
        # 设置默认下载路径
        if not self.download_path:
            self.download_path = str(PathManager.get_workspace_dir() / ".webview-reports")

        # 确保浏览器参数是列表
        if not isinstance(self.browser_args, list):
            self.browser_args = []

        # 如果需要禁用安全特性，添加相应参数
        if self.disable_security:
            if self.browser_type == "chromium":
                security_args = [
                    "--disable-web-security",
                    "--allow-running-insecure-content",
                    "--disable-features=IsolateOrigins,site-per-process"
                ]
                for arg in security_args:
                    if arg not in self.browser_args:
                        self.browser_args.append(arg)

        # 如果启用人类行为模拟，添加相应参数
        if self.human_behavior_simulation:
            if self.browser_type == "chromium":
                human_behavior_args = [
                    '--disable-blink-features=AutomationControlled',  # 隐藏自动化控制特征，防止网站检测到这是自动化浏览器
                    '--disable-features=IsolateOrigins,site-per-process',  # 禁用站点隔离，允许跨域操作，避免一些安全限制
                    '--disable-site-isolation-trials',  # 禁用站点隔离试验，提高对复杂网站的兼容性
                    '--disable-web-security',  # 禁用同源策略等Web安全特性，允许跨域请求
                    '--disable-sync',  # 禁用Google账户同步功能，减少特征暴露
                    '--disable-background-networking',  # 禁用后台网络请求，避免不必要的连接
                    '--disable-background-timer-throttling',  # 禁用后台计时器限制，提高性能
                    '--disable-backgrounding-occluded-windows',  # 禁用对被遮挡窗口的资源限制
                    '--disable-breakpad',  # 禁用崩溃报告，避免向Google发送数据
                    '--disable-client-side-phishing-detection',  # 禁用客户端钓鱼检测，减少对Google的请求
                    '--disable-component-update',  # 禁用组件更新，避免版本变化
                    '--disable-default-apps',  # 禁用默认应用，减少浏览器特征
                    '--disable-infobars',  # 禁用顶部信息栏，避免"Chrome正在被自动控制"提示
                    '--disable-notifications',  # 禁用通知弹窗，避免干扰
                    '--no-default-browser-check',  # 不检查是否为默认浏览器
                    '--no-first-run',  # 跳过首次运行体验，避免欢迎页面
                    '--password-store=basic',  # 使用基本密码存储而非系统密钥链，减少系统集成
                    '--use-mock-keychain',  # 使用模拟密钥链，避免访问系统密钥链
                    '--disable-cookie-encryption',  # 禁用Cookie加密，方便读取和修改Cookie
                    '--allow-pre-commit-input',  # 允许在页面渲染完成前输入，提高响应速度
                ]
                for arg in human_behavior_args:
                    if arg not in self.browser_args:
                        self.browser_args.append(arg)

        # 如果启用浏览器指纹伪装，添加相应参数
        if self.fingerprint_mask:
            if self.browser_type == "chromium":
                fingerprint_args = [
                    "--js-flags=--random-seed=1157259159",  # 使所有JS随机数具有确定性
                    "--force-device-scale-factor=2",  # 标准化设备缩放比例
                    "--hide-scrollbars",  # 隐藏滚动条
                    "--force-color-profile=srgb",  # 使用一致的颜色配置文件
                    "--font-render-hinting=none",  # 忽略操作系统字体提示
                    "--disable-2d-canvas-clip-aa",  # 禁用2D画布裁剪抗锯齿
                    "--disable-partial-raster"  # 禁用部分光栅化
                ]
                for arg in fingerprint_args:
                    if arg not in self.browser_args:
                        self.browser_args.append(arg)

        # 如果启用性能优化，添加相应参数
        if self.performance_optimization:
            if self.browser_type == "chromium":
                performance_args = [
                    "--disable-renderer-backgrounding",  # 不根据焦点限制标签页渲染
                    "--disable-background-networking",  # 不根据焦点限制网络请求
                    "--disable-background-timer-throttling",  # 不限制计时器
                    "--disable-backgrounding-occluded-windows",  # 不限制被遮挡窗口
                    "--disable-ipc-flooding-protection",  # 不限制IPC通信流量
                    "--disable-lazy-loading",  # 预先加载所有内容而不是按需加载
                    "--disable-extensions-http-throttling",  # 不限制HTTP流量
                    "--disable-back-forward-cache",  # 禁用浏览导航缓存
                    "--remote-debugging-address=0.0.0.0",  # 允许远程调试
                    "--enable-experimental-extension-apis"  # 启用实验性扩展API
                ]
                for arg in performance_args:
                    if arg not in self.browser_args:
                        self.browser_args.append(arg)

        # 如果禁用弹窗和通知，添加相应参数
        if self.disable_popups:
            if self.browser_type == "chromium":
                popup_args = [
                    "--no-first-run",  # 禁用首次运行体验
                    "--no-default-browser-check",  # 禁用默认浏览器检查
                    "--disable-infobars",  # 禁用信息栏
                    "--disable-notifications",  # 禁用通知
                    "--disable-desktop-notifications",  # 禁用桌面通知
                    "--deny-permission-prompts",  # 拒绝权限提示
                    "--disable-session-crashed-bubble",  # 禁用会话崩溃气泡
                    "--disable-hang-monitor",  # 禁用挂起监视器
                    "--disable-popup-blocking",  # 禁用弹窗拦截
                    "--disable-component-update",  # 禁用组件更新
                    "--suppress-message-center-popups",  # 禁止消息中心弹窗
                    "--disable-client-side-phishing-detection",  # 禁用客户端钓鱼检测
                    "--disable-print-preview",  # 禁用打印预览
                    "--disable-speech-api",  # 禁用语音API
                    "--disable-speech-synthesis-api",  # 禁用语音合成API
                    "--no-pings",  # 禁用ping请求
                    "--disable-default-apps",  # 禁用默认应用
                    "--ash-no-nudges",  # 禁用提示
                    "--disable-search-engine-choice-screen",  # 禁用搜索引擎选择屏幕
                    "--disable-datasaver-prompt",  # 禁用数据保存提示
                    "--block-new-web-contents",  # 阻止新的Web内容
                    "--disable-breakpad",  # 禁用崩溃报告
                    "--disable-domain-reliability"  # 禁用域名可靠性
                ]
                for arg in popup_args:
                    if arg not in self.browser_args:
                        self.browser_args.append(arg)

        # 如果启用高级人类行为模拟设置，添加相应参数
        if self.advanced_human_behavior_simulation:
            if self.browser_type == "chromium":
                advanced_args = [
                    "--disable-features=GlobalMediaControls,MediaRouter,DialMediaRouteProvider",  # 禁用媒体控制
                    "--simulate-outdated-no-au=\"Tue, 31 Dec 2099 23:59:59 GMT\"",  # 模拟过期，禁用浏览器自动更新
                    "--export-tagged-pdf",  # 导出带标签的PDF
                    "--generate-pdf-document-outline",  # 生成PDF文档大纲
                    "--metrics-recording-only",  # 仅记录指标
                    "--silent-debugger-extension-api",  # 静默调试器扩展API
                    "--noerrdialogs",  # 无错误对话框
                    "--disable-prompt-on-repost"  # 禁用重新发布提示
                ]
                for arg in advanced_args:
                    if arg not in self.browser_args:
                        self.browser_args.append(arg)

        # 设置语言
        if self.language:
            lang_arg = f"--lang={self.language}"
            if lang_arg not in self.browser_args:
                self.browser_args.append(lang_arg)

        # ========== 服务端模式配置验证 ==========
        # 验证服务端模式配置
        if self.use_server_mode:
            if not self.browser_server_url:
                raise ValueError("启用服务端模式时必须提供 browser_server_url")

            # 验证 URL 格式
            if not self.browser_server_url.startswith(('ws://', 'wss://')):
                raise ValueError(f"browser_server_url 必须以 ws:// 或 wss:// 开头，当前值: {self.browser_server_url}")

            logger.info(f"浏览器配置为服务端模式，将连接到: {self.browser_server_url}")
        else:
            logger.debug("浏览器配置为本地模式")
        # ========== 服务端模式配置验证结束 ==========

    def to_launch_options(self) -> Dict[str, Any]:
        """转换为 Playwright 浏览器启动选项"""
        options = {
            "headless": self.headless,
            "args": self.browser_args,
            "timeout": self.default_timeout,
        }

        if self.download_path:
            # 确保下载目录存在
            os.makedirs(self.download_path, exist_ok=True)
            options["downloads_path"] = self.download_path

        # 添加代理配置
        if self.proxy:
            proxy_dict = self.proxy.to_dict()
            if proxy_dict:
                options["proxy"] = proxy_dict

        return options

    async def to_context_options(self) -> Dict[str, Any]:
        """转换为 Playwright 浏览器上下文选项"""
        options = {
            "viewport": {
                "width": self.viewport_width,
                "height": self.viewport_height
            },
            "accept_downloads": True,
            "extra_http_headers": self.extra_headers,
            "bypass_csp": self.disable_security,  # 绕过内容安全策略
            "ignore_https_errors": self.disable_security  # 忽略HTTPS证书错误
        }

        if self.user_agent:
            options["user_agent"] = self.user_agent

        # 添加地理位置欺骗
        if self.geolocation_spoofing and self.geolocation:
            options["geolocation"] = self.geolocation

        # 添加时区设置（默认使用中国上海）
        options["timezone_id"] = self.timezone_id or "Asia/Shanghai"

        # 添加语言设置（默认使用中文）
        locale = self.language.split(',')[0] if self.language else "zh-CN"
        options["locale"] = locale

        # 加载存储状态（包括cookies和localStorage）
        if self.storage_state_file:
            if os.path.exists(self.storage_state_file):
                try:
                    # 直接提供文件路径给storage_state参数
                    options["storage_state"] = self.storage_state_file
                    logger.info(f"将从 {self.storage_state_file} 加载存储状态")
                except Exception as e:
                    logger.warning(f"加载存储状态失败: {e}")
            else:
                # 尝试从云端下载模板
                try:
                    # 从配置中获取模板URL
                    template_url = config.get("browser.storage_state_template_url")

                    if not template_url:
                        logger.info("未配置浏览器存储状态模板URL，跳过加载存储状态")
                        return options

                    logger.info(f"本地存储状态文件不存在，尝试从云端下载模板: {template_url}")

                    # 使用异步请求下载模板
                    async with aiohttp.ClientSession() as session:
                        async with session.get(template_url) as response:
                            if response.status == 200:
                                # 确保目录存在
                                os.makedirs(os.path.dirname(self.storage_state_file), exist_ok=True)
                                # 保存模板到本地
                                content = await response.read()
                                with open(self.storage_state_file, 'wb') as f:
                                    f.write(content)
                                options["storage_state"] = self.storage_state_file
                                logger.info(f"已从云端下载模板并保存到 {self.storage_state_file}")
                            else:
                                logger.warning(f"从云端下载模板失败，状态码: {response.status}")
                except Exception as e:
                    logger.warning(f"从云端下载模板失败: {e}")

        return options

    async def save_storage_state(self, context) -> None:
        """
        保存完整的浏览器存储状态到文件（包括cookies和localStorage）

        Args:
            context: Playwright浏览器上下文
        """
        if not self.storage_state_file:
            return

        try:
            # 使用context的storage_state方法直接保存到文件
            await context.storage_state(path=self.storage_state_file)
            logger.info(f"已保存存储状态到 {self.storage_state_file}")
        except Exception as e:
            logger.error(f"保存存储状态失败: {e}")

    @classmethod
    def create_for_scraping(cls) -> 'MagicBrowserConfig':
        """创建针对网页爬取优化的配置，自动合并全局配置覆盖"""
        # 创建基础爬虫配置
        browser_config = cls(
            headless=True,
            disable_security=True,  # 启用安全限制解除，解决CSP限制问题
            human_behavior_simulation=True,
            fingerprint_mask=True,
            performance_optimization=True,
            disable_popups=True,
            advanced_human_behavior_simulation=True,
            # 中国上海的经纬度
            geolocation={"latitude": 31.230416, "longitude": 121.473701},
            geolocation_spoofing=True,
            timezone_id="Asia/Shanghai",
            # cookie配置
            storage_state_file=str(PathManager.get_browser_storage_state_file()),
            permissions=["geolocation", "notifications"]
        )

        # 从全局配置中读取并覆盖非空配置
        if config.get("browser.headless") is not None:
            browser_config.headless = config.get("browser.headless")
        if config.get("browser.default_timeout") is not None:
            browser_config.default_timeout = config.get("browser.default_timeout")
        if config.get("browser.viewport_width") is not None:
            browser_config.viewport_width = config.get("browser.viewport_width")
        if config.get("browser.viewport_height") is not None:
            browser_config.viewport_height = config.get("browser.viewport_height")
        if config.get("browser.ignore_https_errors") is not None:
            browser_config.disable_security = config.get("browser.ignore_https_errors")
        if config.get("browser.user_agent") is not None:
            browser_config.user_agent = config.get("browser.user_agent")
        if config.get("browser.browser_type") is not None:
            browser_config.browser_type = config.get("browser.browser_type")

        # ========== 根据环境自动选择浏览器模式 ==========
        from agentlang.environment import Environment

        # 根据环境自动选择模式：dev 环境用本地模式，其他环境用服务端模式
        is_dev_env = Environment.is_dev()

        # 如果配置文件明确指定了 use_server_mode，则使用配置值
        # 否则根据环境自动选择
        if config.get("browser.use_server_mode") is not None:
            browser_config.use_server_mode = config.get("browser.use_server_mode")
            logger.info(f"使用配置文件指定的浏览器模式: {'服务端模式' if browser_config.use_server_mode else '本地模式'}")
        else:
            # dev 环境使用本地模式，非 dev 环境使用服务端模式
            browser_config.use_server_mode = not is_dev_env
            logger.info(f"根据环境自动选择浏览器模式: {'本地模式' if is_dev_env else '服务端模式'} (环境: {'dev' if is_dev_env else 'production'})")

        # 读取服务端模式相关配置
        if config.get("browser.browser_server_url") is not None:
            browser_config.browser_server_url = config.get("browser.browser_server_url")
        if config.get("browser.server_health_check_timeout") is not None:
            browser_config.server_health_check_timeout = config.get("browser.server_health_check_timeout")
        if config.get("browser.server_health_check_interval") is not None:
            browser_config.server_health_check_interval = config.get("browser.server_health_check_interval")
        if config.get("browser.server_connect_timeout") is not None:
            browser_config.server_connect_timeout = config.get("browser.server_connect_timeout")
        # ========== 服务端模式配置读取结束 ==========

        return browser_config
