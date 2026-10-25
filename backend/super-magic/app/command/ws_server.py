"""
HTTP API服务器命令模块（原WebSocket服务器改为HTTP API服务器）
"""
import asyncio
import importlib
import importlib.metadata
import os
import socket
import time
from contextlib import asynccontextmanager
from pathlib import Path
from types import FrameType
from typing import Optional

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from uvicorn.config import Config

from agentlang.environment import Environment
from agentlang.logger import get_logger
from agentlang.utils.process_manager import ProcessManager
from app.api.middleware import (
    RequestLoggingMiddleware,
    UserAuthorizationMiddleware,
    WebSocketAuthorizationMiddleware,
)
from app.api.routes import api_router
from app.infrastructure.observability import (
    install_error_tracking,
    instrument_aiohttp,
    instrument_fastapi,
    instrument_httpx,
    instrument_openai,
    instrument_requests,
    setup_telemetry,
    shutdown_telemetry,
)
from app.service.agent_dispatcher import AgentDispatcher
from app.service.cron.service import CronService
from app.service.idle_monitor_service import IdleMonitorService
from app.service.service_shutdown_coordinator import (
    ServiceShutdownCoordinator,
    ShutdownTrigger,
)
from app.service.service_shutdown_diagnostics import ShutdownDiagnosticsCollector

# 获取日志记录器
logger = get_logger(__name__)

# 存储服务器实例和全局变量
ws_server = None
_app = None  # 存储FastAPI应用实例的内部变量
_LOCAL_IM_AUTO_CONNECT_ENV = "ENABLE_LOCAL_IM_CHANNEL_AUTO_CONNECT"
_TRUE_ENV_VALUES = {"true", "1", "yes", "on"}
_API_PORT_ENV = "SUPER_MAGIC_API_PORT"
_DEFAULT_API_PORT = 8002
_resolved_api_port: Optional[int] = None


def get_api_port() -> int:
    """读取 HTTP API 服务监听端口，配置为空或非法时回退到默认端口。"""
    global _resolved_api_port
    if _resolved_api_port is not None:
        return _resolved_api_port

    raw_port = os.getenv(_API_PORT_ENV, "").strip()
    if not raw_port:
        _resolved_api_port = _DEFAULT_API_PORT
        return _resolved_api_port

    try:
        port = int(raw_port)
    except ValueError:
        logger.warning(f"{_API_PORT_ENV}={raw_port!r} 不是有效端口，回退到 {_DEFAULT_API_PORT}")
        _resolved_api_port = _DEFAULT_API_PORT
        return _resolved_api_port

    if port < 1 or port > 65535:
        logger.warning(f"{_API_PORT_ENV}={raw_port!r} 超出端口范围，回退到 {_DEFAULT_API_PORT}")
        _resolved_api_port = _DEFAULT_API_PORT
        return _resolved_api_port

    _resolved_api_port = port
    return _resolved_api_port


async def maybe_auto_connect_im_channels_for_local_dev() -> None:
    """本地开发开关：ws-server 启动后立即触发一次 IM 渠道自动连接。"""
    enabled = os.getenv(_LOCAL_IM_AUTO_CONNECT_ENV, "").strip().lower() in _TRUE_ENV_VALUES
    if not enabled:
        return

    try:
        from agentlang.environment import Environment

        if not Environment.is_local():
            logger.warning(
                f"{_LOCAL_IM_AUTO_CONNECT_ENV}=true 仅允许本地开发环境使用，"
                "当前非 local 环境，跳过 IM 渠道自动连接"
            )
            return

        from app.channel.startup import auto_connect_channels_for_current_topic

        await auto_connect_channels_for_current_topic()
        logger.info(f"{_LOCAL_IM_AUTO_CONNECT_ENV}=true，已触发本地 IM 渠道自动连接")
    except Exception as e:
        logger.warning(f"本地 IM 渠道自动连接失败，不影响 ws-server 启动: {e}")


async def cleanup_stale_files_on_startup():
    """启动时残留文件清理检查，用于清理上次运行遗留的临时文件"""
    # 清理 .visual 目录中超过 1 小时的残留文件
    try:
        from app.tools.visual_understanding_utils.file_operations_utils import cleanup_stale_visual_files
        await cleanup_stale_visual_files()
        logger.info(".visual 目录残留文件检查完成")
    except Exception as e:
        logger.error(f".visual 目录残留文件清理失败: {e}")

    try:
        from app.path_manager import PathManager
        from app.utils.runtime_storage import (
            RuntimeEvictionPolicy,
            evict_runtime_directories,
            get_runtime_config_int,
        )

        for runtime_dir, config_key in (
            (
                PathManager.get_background_compact_dir(),
                "runtime_cleanup.background_compact.max_age_days",
            ),
            (
                PathManager.get_memory_after_run_dir(),
                "runtime_cleanup.memory_after_run.max_age_days",
            ),
        ):
            policy = RuntimeEvictionPolicy(
                max_age_seconds=get_runtime_config_int(config_key, minimum=1)
                * 24
                * 60
                * 60,
            )
            await evict_runtime_directories(runtime_dir, policy=policy)
        logger.info("runtime 临时会话目录残留检查完成")
    except Exception as e:
        logger.error(f"runtime 临时会话目录残留清理失败: {e}")

    try:
        from app.service.chat_history_cleanup_service import ChatHistoryCleanupService
        await ChatHistoryCleanupService().run()
    except Exception as e:
        logger.error(f"聊天记录启动统计与清理失败: {e}")

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

    # 初始化工具定义缓存；失败时内部回退到运行时工具扫描，不阻塞服务启动。
    try:
        from app.tools.core.tool_factory import tool_factory
        await tool_factory.ensure_definitions_initialized()
        logger.info("工具定义初始化流程完成")
    except Exception as e:
        logger.error(f"工具定义缓存初始化出现未预期异常: {e}")

    # 初始化模型配置管理器（阶段一：加载 config.yaml 静态配置）
    # MagicServiceProvider 在客户端 init 完成后由 agent_dispatcher 触发加载（阶段二）
    try:
        from agentlang.config.models.model_config_manager import model_config_manager
        from agentlang.config.models.providers.config_yaml_provider import ConfigYamlProvider
        from app.core.model_providers.model_filter import should_skip_model
        await model_config_manager.initialize([ConfigYamlProvider(model_filter=should_skip_model)])
        logger.info("模型配置管理器初始化完成")
    except Exception as e:
        logger.error(f"模型配置管理器初始化失败: {e}")

    # 初始化 AI 能力配置管理器（阶段一：加载 config.yaml 静态配置）
    try:
        from agentlang.config.ai_abilities.ability_config_manager import ai_ability_config_manager
        from agentlang.config.ai_abilities.providers.config_yaml_provider import ConfigYamlAIAbilityProvider
        from app.core.ai_ability_configs import create_ai_ability_config
        await ai_ability_config_manager.initialize([ConfigYamlAIAbilityProvider(create_ai_ability_config)])
        logger.info("AI 能力配置管理器初始化完成")
    except Exception as e:
        logger.error(f"AI 能力配置管理器初始化失败: {e}")

    # 执行启动时残留文件清理检查
    await cleanup_stale_files_on_startup()

    # 恢复通用沙箱任务，避免服务重启后丢失页面提交的合成任务。
    try:
        from app.service.sandbox_task.capability_runner import run_capability
        from app.service.sandbox_task.task_manager import SandboxTaskManager
        recovered = await SandboxTaskManager.instance().recover(run_capability)
        logger.info("通用沙箱任务恢复完成: {}", recovered)
    except Exception as e:
        logger.error("通用沙箱任务恢复失败: {}", e)

    logger.info(f"HTTP API服务将监听端口：{get_api_port()}")
    try:
        yield
    finally:
        # 关闭时
        logger.info("服务正在关闭...")
        from app.service.agent_runtime import AgentRuntime
        shutdown_coordinator = getattr(
            app.state,
            "service_shutdown_coordinator",
            None,
        )
        if isinstance(shutdown_coordinator, ServiceShutdownCoordinator):
            await shutdown_coordinator.prepare_shutdown()
            await shutdown_coordinator.mark_closing_app()
        try:
            await AgentRuntime.get_instance().close_all(
                reason="service_shutdown"
            )
        except asyncio.CancelledError:
            raise
        except Exception as error:
            if isinstance(
                shutdown_coordinator,
                ServiceShutdownCoordinator,
            ):
                shutdown_coordinator.record_cleanup_error(
                    "agent_runtime",
                    error,
                )
            raise
        finally:
            try:
                shutdown_telemetry()
            except Exception as error:
                if isinstance(
                    shutdown_coordinator,
                    ServiceShutdownCoordinator,
                ):
                    shutdown_coordinator.record_cleanup_error(
                        "telemetry",
                        error,
                    )
                raise


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

    # User-Authorization 校验中间件必须在其他中间件**之前**注册——
    # Starlette 的 add_middleware 是后进先出（后注册的成为最外层），
    # 这样 UserAuthorizationMiddleware 才会成为最外层，先于 CORS /
    # 日志中间件拒绝未鉴权请求，避免无意义的下游处理。
    app.add_middleware(UserAuthorizationMiddleware)

    # WebSocket 鉴权中间件：BaseHTTPMiddleware 不覆盖 WebSocket scope，
    # 需要独立的纯 ASGI 中间件。只保护这里显式列出的 WS 路径，
    # 不影响 HTTP 链和未列出的 WS 端点。凭证口径与 HTTP 侧一致
    # （User-Authorization header，浏览器客户端可用 ?token= 兜底）。
    app.add_middleware(
        WebSocketAuthorizationMiddleware,
        protected_paths={"/api/v1/messages/subscribe"},
    )

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

    def __init__(
        self,
        config: Config,
        shutdown_coordinator: ServiceShutdownCoordinator,
    ) -> None:
        super().__init__(config)
        self._shutdown_coordinator = shutdown_coordinator

    def handle_exit(self, sig: int, frame: Optional[FrameType]) -> None:
        """把 Uvicorn 捕获的信号桥接到统一退出协调器。"""
        self._shutdown_coordinator.request_shutdown(
            ShutdownTrigger.SIGNAL,
            signal_number=sig,
        )
        super().handle_exit(sig, frame)

    async def shutdown(self, sockets: Optional[list[socket.socket]] = None) -> None:
        """尝试优雅地关闭服务器"""
        if self._shutdown_coordinator.request is None:
            self._shutdown_coordinator.request_shutdown(ShutdownTrigger.UVICORN_EXIT)
        await self._shutdown_coordinator.mark_draining_uvicorn()
        self._shutdown_coordinator.start_prepare_shutdown()
        logger.info("正在关闭 uvicorn 服务器...")
        try:
            await super().shutdown(sockets=sockets)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            self._shutdown_coordinator.record_cleanup_error(
                "uvicorn_shutdown",
                error,
            )
            raise
        finally:
            await self._shutdown_coordinator.prepare_shutdown()
        # capture_signals() 随后可能重新抛出信号；先记录进入事件循环收尾，
        # 此时不能宣称进程已退出，watchdog 仍继续计时。
        await self._shutdown_coordinator.mark_closing_event_loop()

def start_ws_server() -> None:
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
    shutdown_coordinator: Optional[ServiceShutdownCoordinator] = None

    # 创建一个仅启动WS服务器的异步函数
    async def run_ws_only() -> None:
        nonlocal shutdown_coordinator
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

        # 启动 cron 调度服务
        cron_service = CronService()
        idle_monitor = IdleMonitorService.get_instance()
        loop = asyncio.get_running_loop()
        force_shutdown_timeout_seconds = (
            Environment.get_sandbox_force_shutdown_timeout_seconds()
        )
        graceful_shutdown_timeout_seconds = (
            Environment.get_sandbox_graceful_shutdown_timeout_seconds()
        )
        diagnostics = ShutdownDiagnosticsCollector(
            process_manager=process_manager,
        )
        coordinator = ServiceShutdownCoordinator(
            loop=loop,
            force_shutdown_timeout_seconds=force_shutdown_timeout_seconds,
            graceful_shutdown_timeout_seconds=graceful_shutdown_timeout_seconds,
            idle_monitor=idle_monitor,
            cron_service=cron_service,
            process_manager=process_manager,
            diagnostics=diagnostics,
        )
        shutdown_coordinator = coordinator

        ws_socket: Optional[socket.socket] = None
        server: Optional[CustomServer] = None
        ws_task: Optional[asyncio.Task[None]] = None
        shutdown_wait_task: Optional[asyncio.Task[None]] = None
        try:
            # 使用与原main()函数相似的代码，但只启动WebSocket服务
            ws_port = get_api_port()
            ws_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            ws_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            ws_socket.bind(("0.0.0.0", ws_port))
            logger.info(f"WebSocket服务将监听端口：{ws_port}")

            uvicorn_config = Config(
                app,
                host="0.0.0.0",
                port=0,
                log_level="warning",  # 设置为warning级别，避免显示框架启动的INFO日志
                ws_ping_interval=None,
                access_log=False,  # 禁用访问日志
                timeout_graceful_shutdown=graceful_shutdown_timeout_seconds,
            )

            global ws_server
            active_server = CustomServer(uvicorn_config, coordinator)
            server = active_server
            ws_server = active_server
            diagnostics.bind_server(active_server)
            app.state.service_shutdown_coordinator = coordinator

            def request_idle_shutdown() -> None:
                coordinator.request_shutdown(ShutdownTrigger.IDLE_TIMEOUT)

            cron_service.start()
            idle_monitor.start(request_idle_shutdown)

            # 启动主HTTP API服务
            ws_task = asyncio.create_task(
                active_server.serve(sockets=[ws_socket]),
                name="uvicorn-main-server",
            )

            async def request_server_shutdown() -> None:
                await coordinator.wait_requested()
                active_server.should_exit = True

            shutdown_wait_task = asyncio.create_task(
                request_server_shutdown(),
                name="service-shutdown-wait",
            )

            logger.info(f"✅ 主API服务已启动 (0.0.0.0:{ws_port})，静态文件服务将按需启动")
            await maybe_auto_connect_im_channels_for_local_dev()

            done, _ = await asyncio.wait(
                {ws_task, shutdown_wait_task},
                return_when=asyncio.FIRST_COMPLETED,
            )
            if ws_task in done:
                if ws_task.cancelled():
                    coordinator.request_shutdown(
                        ShutdownTrigger.SERVER_TASK_EXIT
                    )
                    await ws_task
                server_error = ws_task.exception()
                if server_error is not None:
                    coordinator.request_shutdown(
                        ShutdownTrigger.SERVER_EXCEPTION
                    )
                    raise server_error
                if coordinator.request is None:
                    coordinator.request_shutdown(ShutdownTrigger.UVICORN_EXIT)
            else:
                await ws_task
        except asyncio.CancelledError:
            coordinator.request_shutdown(ShutdownTrigger.SERVER_EXCEPTION)
            raise
        except Exception as error:
            coordinator.request_shutdown(ShutdownTrigger.SERVER_EXCEPTION)
            await coordinator.wait_requested()
            coordinator.record_cleanup_error("server_runtime", error)
            logger.error(
                f"服务运行过程中出现错误: {type(error).__qualname__}"
            )
            raise
        finally:
            if server is not None:
                server.should_exit = True

            if coordinator.request is None:
                coordinator.request_shutdown(ShutdownTrigger.UVICORN_EXIT)

            if shutdown_wait_task is not None and not shutdown_wait_task.done():
                shutdown_wait_task.cancel()
                await asyncio.gather(shutdown_wait_task, return_exceptions=True)

            if ws_task is not None and not ws_task.done():
                await asyncio.shield(
                    asyncio.gather(ws_task, return_exceptions=True)
                )

            await coordinator.prepare_shutdown()
            if ws_socket is not None:
                ws_socket.close()
            await coordinator.mark_closing_event_loop()
            logger.info("应用关闭流程已返回，正在结束事件循环")

    # 运行异步函数
    try:
        asyncio.run(run_ws_only())
    finally:
        if shutdown_coordinator is not None:
            shutdown_coordinator.finish_event_loop_shutdown()
