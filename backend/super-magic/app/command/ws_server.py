"""
HTTP API服务器命令模块（原WebSocket服务器改为HTTP API服务器）
"""
import asyncio
import importlib
import importlib.metadata
import os
import signal
import socket
import time
from contextlib import asynccontextmanager
from typing import Optional

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from uvicorn.config import Config
from pathlib import Path

from app.api.middleware import RequestLoggingMiddleware
from app.api.routes import api_router
from app.service.agent_dispatcher import AgentDispatcher
from agentlang.logger import get_logger
from app.service.cron.service import CronService
from app.service.idle_monitor_service import IdleMonitorService
from agentlang.utils.process_manager import ProcessManager
from app.infrastructure.observability import (
    setup_telemetry,
    instrument_fastapi,
    instrument_aiohttp,
    instrument_requests,
    instrument_httpx,
    instrument_openai,
    shutdown_telemetry,
    install_error_tracking,
)

# 获取日志记录器
logger = get_logger(__name__)

# 存储服务器实例和全局变量
ws_server = None
_app = None  # 存储FastAPI应用实例的内部变量

async def cleanup_stale_files_on_startup():
    """启动时残留文件清理检查，用于清理上次运行遗留的临时文件"""
    # 清理 .visual 目录中超过 1 小时的残留文件
    try:
        from app.tools.visual_understanding_utils.file_operations_utils import cleanup_stale_visual_files
        await cleanup_stale_visual_files()
        logger.info(".visual 目录残留文件检查完成")
    except Exception as e:
        logger.error(f".visual 目录残留文件清理失败: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """服务生命周期管理"""
    # 启动时
    logger.info("服务正在启动...")

    # Initialize OpenTelemetry (non-intrusive, controlled by ENABLE_TELEMETRY env var)
    # Note: setup_telemetry is idempotent, safe to call multiple times
    # It's already called in start_ws_server() to catch early errors
    setup_telemetry()
    install_error_tracking()
    instrument_aiohttp()
    instrument_requests()
    instrument_httpx()
    instrument_openai()

    # 打印Git commit ID
    # git_commit_id = os.getenv("GIT_COMMIT_ID", "未知")
    # logger.info(f"当前版本Git commit ID: {git_commit_id}")

    # 运行启动时迁移任务
    try:
        from app.utils.migration_helper import run_startup_migrations
        run_startup_migrations()
        logger.info("启动时迁移任务已启动")
    except Exception as e:
        logger.error(f"启动时迁移任务失败: {e}")

    # 执行启动时残留文件清理检查
    await cleanup_stale_files_on_startup()

    logger.info("HTTP API服务将监听端口：8002")
    yield
    # 关闭时
    logger.info("服务正在关闭...")
    shutdown_telemetry()

def create_app() -> FastAPI:
    """创建并配置FastAPI应用实例"""
    # 创建 FastAPI 应用
    app = FastAPI(
        title="Super Magic API",
        description="Super Magic HTTP API 服务",
        version="1.0.0",
        lifespan=lifespan,
    )

    # Auto-instrument FastAPI with OpenTelemetry (non-intrusive, controlled by env var)
    instrument_fastapi(app)

    # 添加请求日志中间件
    app.add_middleware(RequestLoggingMiddleware)

    # 添加 CORS 中间件 - 修改配置以解决浏览器跨域问题
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # 允许所有源，也可以指定特定域名，如 ["http://localhost:3000"]
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],  # 明确指定允许的方法
        allow_headers=["*"],  # 允许所有头信息
        expose_headers=["*"],  # 暴露所有头信息
        max_age=600,  # 预检请求结果缓存时间，单位秒
    )

    # 注册HTTP API路由
    app.include_router(api_router)

    # Add root-level health check endpoint for container health checks
    @app.get("/health", tags=["系统"])
    async def root_health_check():
        """
        Root level health check endpoint

        Provides health status at root level for container orchestration systems
        that expect health checks at /health instead of /api/health
        """
        return {
            "status": "healthy",
            "service": "SuperMagic API",
            "version": "1.0.0"
        }

    return app

def create_workspace_static_server() -> FastAPI:
    """
    创建专门用于服务.workspace目录的静态文件服务器

    这个服务器只监听127.0.0.1，专门提供.workspace目录的HTTP访问
    用于PDF/PPTX转换服务访问依赖文件
    """
    static_app = FastAPI(
        title="Workspace Static Files Server",
        description="仅用于本地访问.workspace目录的静态文件服务",
        version="1.0.0",
    )

    # 确保.workspace目录存在
    workspace_dir = Path(".workspace")
    if workspace_dir.exists() and workspace_dir.is_dir():
        # 直接在根路径挂载静态文件，这样可以通过 http://127.0.0.1:8003/filename 访问
        static_app.mount("/", StaticFiles(directory=str(workspace_dir)), name="workspace")
        logger.info(f"🔒 静态文件服务器：已挂载.workspace目录 -> {workspace_dir.absolute()}")
    else:
        logger.warning(f"⚠️  静态文件服务器：.workspace目录不存在: {workspace_dir.absolute()}")

        # 即使目录不存在，也创建一个空的应用，避免启动失败
        @static_app.get("/")
        async def workspace_not_found():
            return {"error": ".workspace directory not found"}

    # 添加基础健康检查
    @static_app.get("/__health__")
    async def static_server_health():
        return {"status": "healthy", "service": "workspace-static-server"}

    return static_app

async def start_workspace_static_server(port: int = 8003):
    """
    启动.workspace静态文件服务器

    Args:
        port: 监听端口，默认8003
    """
    try:
        static_app = create_workspace_static_server()

        # 配置服务器，只监听127.0.0.1
        config = Config(
            static_app,
            host="127.0.0.1",  # 🔒 只监听localhost
            port=port,
            log_level="warning",
            access_log=False,
        )

        server = uvicorn.Server(config)
        logger.info(f"🔒 .workspace静态文件服务器启动在端口 {port} (仅限127.0.0.1访问)")

        # 在后台运行服务器
        await server.serve()

    except Exception as e:
        logger.error(f"❌ 启动.workspace静态文件服务器失败: {e}")

def get_app() -> FastAPI:
    """获取FastAPI应用实例，避免循环导入

    Returns:
        FastAPI: 应用实例
    """
    global _app
    if _app is None:
        _app = create_app()
    return _app

class CustomServer(uvicorn.Server):
    """自定义 uvicorn Server 类，用于正确处理信号"""

    def install_signal_handlers(self) -> None:
        """不安装信号处理器，使用我们自己的处理方式"""
        pass

    async def shutdown(self, sockets=None):
        """尝试优雅地关闭服务器"""
        logger.info("正在关闭 uvicorn 服务器...")
        await super().shutdown(sockets=sockets)

def start_ws_server():
    """启动WebSocket服务器"""
    # ====================================================================
    # 🔧 IMPORTANT: Initialize telemetry BEFORE any other initialization
    # This ensures ERROR logs during startup are properly tracked
    # ====================================================================
    setup_telemetry()
    install_error_tracking()
    instrument_aiohttp()    # Async HTTP client (aiohttp.ClientSession)
    instrument_requests()   # Sync HTTP client (requests.get/post)
    instrument_httpx()      # Modern HTTP client (httpx.Client/AsyncClient)
    instrument_openai()     # OpenAI SDK (LLM API calls)
    logger.info("✅ OpenTelemetry 已在启动早期初始化")

    # 获取环境变量中的日志级别
    log_level = os.getenv("LOG_LEVEL", "INFO")

    # 获取FastAPI应用实例
    app = get_app()

    # 创建一个仅启动WS服务器的异步函数
    async def run_ws_only():
        process_manager = ProcessManager.get_instance()
        # 获取并处理entry_points
        try:
            # 使用pkg_resources处理entry_points
            process_entry_points = list(importlib.metadata.entry_points(group='command.ws_server.process'))

            logger.info(f"找到 {len(process_entry_points)} 个 ws_server 进程 entry_points")

            # 检查是否启用 filebase watcher

            # 加载所有找到的entry_points
            for entry_point in process_entry_points:
                logger.info(f"正在加载进程: {entry_point.name}")
                value = entry_point.value
                value = value.split(":")
                module_name = value[0]
                function_name = value[1]
                logger.info(f"加载模块: {module_name}, 函数: {function_name}")
                loader = importlib.import_module(module_name)
                await loader.load(process_manager, log_level)
        except Exception as e:
            logger.error(f"加载entry_points时出错: {e}")

        dispatcher = AgentDispatcher.get_instance()
        await dispatcher.setup()

        # 在这里计算并打印启动时间
        startup_start_time_str = os.getenv("STARTUP_START_TIME")
        if startup_start_time_str:
            startup_start_time = float(startup_start_time_str)
            startup_end_time = time.time()
            startup_duration = startup_end_time - startup_start_time
            logger.info(f"🚀 服务启动完成! 总耗时: {startup_duration:.3f}秒 ({startup_duration*1000:.0f}毫秒)")

            # 清理环境变量
            del os.environ["STARTUP_START_TIME"]

        IdleMonitorService.get_instance().start()

        # 启动 cron 调度服务
        cron_service = CronService()
        cron_service.start()

        # 使用与原main()函数相似的代码，但只启动WebSocket服务
        # 创建并配置WebSocket socket
        ws_port = 8002
        ws_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        ws_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        ws_socket.bind(("0.0.0.0", ws_port))

        logger.info(f"WebSocket服务将监听端口：{ws_port}")

        # 创建uvicorn配置
        uvicorn_config = Config(
            app,
            host="0.0.0.0",
            port=0,
            log_level="warning",  # 设置为warning级别，避免显示框架启动的INFO日志
            ws_ping_interval=None,
            access_log=False,  # 禁用访问日志
        )

        # 启动服务器
        global ws_server
        ws_server = CustomServer(uvicorn_config)

        # 同样需要处理信号
        shutdown_event = asyncio.Event()

        # 设置信号处理器
        def handle_signal(sig, frame):
            logger.info(f"收到信号 {sig}，准备关闭服务...")
            shutdown_event.set()

            # 启动强制终止定时器，10秒后强制杀死进程
            def force_kill():
                time.sleep(10)
                logger.warning("优雅关闭超时，使用SIGKILL强制终止进程")
                try:
                    os.kill(os.getpid(), signal.SIGKILL)
                except Exception as e:
                    logger.error(f"SIGKILL失败: {e}")

            import threading
            threading.Thread(target=force_kill, daemon=True).start()

        # 注册信号处理器
        original_sigint_handler = signal.getsignal(signal.SIGINT)
        original_sigterm_handler = signal.getsignal(signal.SIGTERM)
        signal.signal(signal.SIGINT, handle_signal)
        signal.signal(signal.SIGTERM, handle_signal)

        try:
            # 启动主HTTP API服务
            ws_task = asyncio.create_task(ws_server.serve(sockets=[ws_socket]))

            logger.info("✅ 主API服务已启动 (0.0.0.0:8002)，静态文件服务将按需启动")

            # 等待关闭事件
            await shutdown_event.wait()
            logger.info("正在停止所有服务...")
        except Exception as e:
            logger.error(f"服务运行过程中出现错误: {e}")
        finally:
            # 优雅关闭服务器
            if ws_server:
                ws_server.should_exit = True

            # 取消服务任务
            ws_task.cancel()

            # 停止所有服务
            await process_manager.stop_all()
            await cron_service.stop()
            IdleMonitorService.get_instance().stop()

            try:
                # 等待任务完成，设置5秒超时
                await asyncio.wait_for(
                    asyncio.gather(ws_task, return_exceptions=True),
                    timeout=5.0
                )
                logger.info("✅ 主服务已优雅关闭")
            except (asyncio.TimeoutError, Exception) as e:
                logger.warning(f"优雅关闭失败: {e}，使用SIGKILL强制终止进程")
                os.kill(os.getpid(), signal.SIGKILL)

            # 恢复原始信号处理器
            signal.signal(signal.SIGINT, original_sigint_handler)
            signal.signal(signal.SIGTERM, original_sigterm_handler)

            # 关闭socket
            ws_socket.close()
            logger.info("WebSocket服务已完全关闭")

    # 运行异步函数
    asyncio.run(run_ws_only())
