#!/usr/bin/env python3
"""
沙箱网关服务
集成Docker容器管理、WebSocket通信和FastAPI服务
"""

import asyncio
import logging
import os
import signal
import sys
from typing import Any

import uvicorn
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

from fastapi import FastAPI
from uvicorn.config import Config

from app.config import settings
from app.controllers import health_router, sandbox_router, chat_history_router
from app.middlewares import TokenValidationMiddleware, RequestLoggingMiddleware
from app.services.sandbox_service import sandbox_service
from app.utils.logging import setup_logging

# 配置日志
logger = setup_logging(
    log_level=settings.log_level,
    log_file=settings.log_file
)


# 重写 uvicorn.Server 类以便正确处理信号
class CustomServer(uvicorn.Server):
    """自定义 uvicorn Server 类，用于正确处理信号"""
    
    def install_signal_handlers(self) -> None:
        """不安装信号处理器，使用我们自己的处理方式"""
        pass
    
    async def shutdown(self, sockets=None):
        """尝试优雅地关闭服务器"""
        logger.info("正在关闭 uvicorn 服务器...")
        await super().shutdown(sockets=sockets)


# 创建FastAPI应用
app = FastAPI(
    title="沙箱容器网关",
    description="沙箱容器网关服务，提供Docker容器管理和WebSocket通信",
    version="0.1.0",
    docs_url="/docs" if os.environ.get("ENABLE_DOCS", "True").lower() in ("true", "1", "yes") else None,
    redoc_url="/redoc" if os.environ.get("ENABLE_DOCS", "True").lower() in ("true", "1", "yes") else None,
)

# 注册中间件
app.add_middleware(TokenValidationMiddleware)
app.add_middleware(RequestLoggingMiddleware)  # 添加请求日志中间件

# 注册路由
app.include_router(health_router)
app.include_router(sandbox_router)
app.include_router(chat_history_router)


# 全局服务器实例
server = None


# 信号处理
def handle_exit(sig: Any, frame: Any) -> None:
    """
    处理退出信号
    
    Args:
        sig: 信号
        frame: 帧
    """
    global server
    logger.info(f"收到信号 {sig}，正在关闭服务...")
    if server:
        server.should_exit = True
    else:
        sys.exit(0)


# 注册信号处理器
signal.signal(signal.SIGINT, handle_exit)
signal.signal(signal.SIGTERM, handle_exit)


@app.on_event("startup")
async def startup_event() -> None:
    """应用启动时执行"""
    # 检查Docker镜像是否存在
    try:
        image_name = sandbox_service.image_name
        sandbox_service.docker_client.images.get(image_name)
        logger.info(f"沙箱容器镜像 '{image_name}' 已就绪")
    except Exception as e:
        logger.warning(f"警告: 沙箱容器镜像检查失败: {str(e)}")
        logger.warning("请先确保已经构建好镜像，否则沙箱功能将无法正常使用")

    # 启动沙箱容器清理任务
    asyncio.create_task(sandbox_service.cleanup_idle_containers())
    logger.info("沙箱网关已启动，开始定期清理闲置沙箱容器")


async def start_async() -> None:
    """异步启动沙箱网关服务"""
    global server
    port = settings.sandbox_gateway_port

    # 创建uvicorn配置
    uvicorn_config = Config(
        app,
        host="0.0.0.0",
        port=port,
        log_level=settings.log_level.lower(),
        ws_ping_interval=None,  # 禁用 WebSocket ping
    )

    # 启动FastAPI应用
    logger.info(f"启动沙箱网关服务，监听 0.0.0.0:{port}")
    logger.info(f"使用沙箱镜像: {sandbox_service.image_name}")
    logger.info(f"应用环境: {settings.app_env}")
    
    # 使用自定义服务器启动
    server = CustomServer(uvicorn_config)
    
    # 创建关闭事件
    shutdown_event = asyncio.Event()
    
    # 修改信号处理器来设置事件
    def handle_signal(sig, frame):
        """处理信号"""
        # 使用signal.Signals枚举获取信号名称
        signal_name = signal.Signals(sig).name
        
        logger.info(f"收到信号 {signal_name}，准备关闭服务...")
        server.should_exit = True
        shutdown_event.set()
    
    # 设置信号处理器
    original_sigint_handler = signal.getsignal(signal.SIGINT)
    original_sigterm_handler = signal.getsignal(signal.SIGTERM)
    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)
    
    # 创建服务任务
    server_task = asyncio.create_task(server.serve())
    
    try:
        # 等待关闭事件或服务器任务完成
        await asyncio.wait(
            [asyncio.create_task(shutdown_event.wait()), server_task],
            return_when=asyncio.FIRST_COMPLETED
        )
    except Exception as e:
        logger.error(f"服务运行过程中出现错误: {e}")
    finally:
        # 确保服务器标记为退出
        server.should_exit = True
        
        # 等待一小段时间让lifespan正常关闭
        await asyncio.sleep(0.5)
        
        # 取消服务任务
        if not server_task.done():
            server_task.cancel()
            try:
                await asyncio.wait_for(server_task, timeout=5.0)
            except (asyncio.CancelledError, asyncio.TimeoutError):
                pass
        
        # 恢复原始信号处理器
        signal.signal(signal.SIGINT, original_sigint_handler)
        signal.signal(signal.SIGTERM, original_sigterm_handler)
        
        logger.info("服务已完全关闭")


def start() -> None:
    """启动沙箱网关服务的同步入口点"""
    try:
        asyncio.run(start_async())
    except KeyboardInterrupt:
        logger.info("用户终止程序")
    except Exception as e:
        logger.error(f"启动服务时出错: {e}")
        sys.exit(1)


if __name__ == "__main__":
    try:
        # 启动服务
        start()
    except KeyboardInterrupt:
        logger.info("用户终止程序")
    except Exception as e:
        logger.error(f"启动服务时出错: {e}")
        sys.exit(1) 
