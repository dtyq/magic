# agentlang/agentlang/streaming/drivers/socketio/driver.py
import asyncio
import json
import os
import random
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional, TextIO

from agentlang.logger import get_logger
from agentlang.path_manager import PathManager
from agentlang.utils.security import sanitize_log_value
from agentlang.utils.shadow_code import ShadowCode

from ...interface import StreamingInterface
from ...models import ChunkData, StreamingResult
from .config import SocketIODriverConfig

logger = get_logger(__name__)

# 连接按进程复用后，发送可能落后于入队；1000 刚好顶满一轮压缩后的长流。
_MESSAGE_QUEUE_MAXSIZE = 5000
# 进程退出才等排空。单轮 LLM 结束不再 join，避免 Agent 空等 Engine.IO。
_SHUTDOWN_DRAIN_TIMEOUT_SECONDS = 20.0

_shared_driver: Optional["SocketIODriver"] = None
_shared_driver_shutdown: bool = False


@dataclass(frozen=True)
class _QueuedSocketIOMessage:
    request_id: str
    message: Dict[str, Any]


def get_shared_socketio_driver(config: SocketIODriverConfig) -> "SocketIODriver":
    """进程内复用同一条发往 magic-service 的 Socket.IO 连接。

    | 时机           | 行为                                      |
    | 第一次推流     | 新建 driver，initialize 时才握手          |
    | 之后每轮 LLM   | 返回同一实例，只替换当轮 message_builder  |
    | 单轮 finalize  | 不断开                                    |
    | 进程 shutdown  | shutdown_shared_socketio_driver 再断开    |
    """
    global _shared_driver
    if _shared_driver_shutdown:
        raise RuntimeError("Socket.IO driver is shutting down")
    if _shared_driver is None:
        _shared_driver = SocketIODriver(config)
    else:
        _shared_driver.attach_runtime_config(config)
    return _shared_driver


def reset_shared_socketio_driver() -> None:
    """测试用：丢掉单例引用，不负责断开真实连接。"""
    global _shared_driver, _shared_driver_shutdown
    _shared_driver = None
    _shared_driver_shutdown = False


async def shutdown_shared_socketio_driver() -> None:
    """进程退出：等队列排空后断开，并清空单例。"""
    global _shared_driver, _shared_driver_shutdown
    _shared_driver_shutdown = True
    driver = _shared_driver
    _shared_driver = None
    if driver is None:
        return
    await driver.shutdown()

# Environment variable name for debug log file path (same as StdoutStream)
STDOUT_STREAM_DEBUG_FILE_ENV = "STDOUT_STREAM_DEBUG_FILE"

try:
    import socketio
    SOCKETIO_AVAILABLE = True
except ImportError:
    SOCKETIO_AVAILABLE = False
    socketio = None


class SocketIODriver(StreamingInterface):
    """基础 Socket.IO 推送驱动（轻量化实现，配置化消息构建）"""

    def __init__(self, config: SocketIODriverConfig):
        if not SOCKETIO_AVAILABLE:
            raise ImportError("python-socketio not installed")

        # 使用 SocketIODriverConfig 来管理配置
        self.config: SocketIODriverConfig = config

        # 连接状态
        self.sio_client: Optional["socketio.AsyncClient"] = None
        self.connection_time: Optional[float] = None
        self._connection_lock = asyncio.Lock()
        self._closing: bool = False
        self._closed: bool = False
        self._next_connection_attempt_at: float = 0.0
        self._reconnect_delay: float = config.reconnect_delay
        self._connection_attempts: int = 0
        self._connection_failures: int = 0
        self._dropped_messages: int = 0

        # 消息队列系统 - 保证消息顺序发送
        self.message_queue: Optional[asyncio.Queue] = None
        self.queue_worker_task: Optional[asyncio.Task] = None
        self._shutdown_event: Optional[asyncio.Event] = None

        # 推送统计
        self.stats_by_request: Dict[str, Dict[str, int]] = {}  # request_id -> {expected: int, actual: int}

        # Debug file for local development
        self._debug_file: Optional[TextIO] = None
        self._init_debug_file()

    def get_driver_name(self) -> str:
        return "socketio"

    def attach_runtime_config(self, config: SocketIODriverConfig) -> None:
        """复用连接时只换当轮消息构建器，不改 base_url / namespace。"""
        if config.message_builder is not None:
            self.config.message_builder = config.message_builder

    def get_push_statistics(self, request_id: str) -> Dict[str, int]:
        """获取指定请求的推送统计信息"""
        return self.stats_by_request.get(request_id, {"expected": 0, "actual": 0})

    def _init_debug_file(self) -> None:
        """Initialize debug file if environment variable is set.

        The file path is treated as a relative path based on the project root directory.
        """
        debug_file_path = os.environ.get(STDOUT_STREAM_DEBUG_FILE_ENV)
        if debug_file_path:
            try:
                # Convert relative path to absolute path based on project root
                path_obj = Path(debug_file_path)
                if not path_obj.is_absolute():
                    # Relative path: resolve based on project root
                    project_root = PathManager.get_project_root()
                    absolute_path = project_root / debug_file_path
                else:
                    # Already absolute path
                    absolute_path = path_obj

                # Ensure parent directory exists
                absolute_path.parent.mkdir(parents=True, exist_ok=True)

                # Open file in append mode
                self._debug_file = open(absolute_path, "a", encoding="utf-8")
                logger.info(f"SocketIO debug file enabled: {absolute_path}")
            except Exception as e:
                logger.warning(f"Failed to open debug file '{debug_file_path}': {e}")
                self._debug_file = None

    def _unshadow_recursive(self, obj: Any) -> Any:
        """Recursively unshadow all string values in a data structure.

        Args:
            obj: The object to process (can be dict, list, str, or other types)

        Returns:
            The processed object with all shadowed strings decoded
        """
        if isinstance(obj, str):
            # Decode string if it's shadowed
            return ShadowCode.unshadow(obj) if ShadowCode.is_shadowed(obj) else obj
        elif isinstance(obj, dict):
            # Recursively process dictionary values
            return {key: self._unshadow_recursive(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            # Recursively process list items
            return [self._unshadow_recursive(item) for item in obj]
        else:
            # Return other types as is
            return obj

    def _write_to_debug_file(self, request_id: str, message: Dict[str, Any]) -> None:
        """Write message to debug file if enabled.

        Args:
            request_id: The request ID for tracking
            message: The message being sent
        """
        if self._debug_file:
            try:
                # Decode shadowed content in the message
                decoded_message = self._unshadow_recursive(message)

                # Format with timestamp and request_id for better tracking
                debug_entry = {
                    "timestamp": datetime.now().isoformat(),
                    "request_id": request_id,
                    "message": decoded_message
                }
                formatted_data = json.dumps(
                    sanitize_log_value(debug_entry),
                    indent=2,
                    ensure_ascii=False,
                )
                self._debug_file.write(formatted_data + "\n")
                self._debug_file.write("=" * 80 + "\n")  # Separator for readability
                self._debug_file.flush()
            except Exception as e:
                logger.warning(f"Failed to write to debug file: {e}")

    def _close_debug_file(self) -> None:
        """Close the debug file if it was opened."""
        if self._debug_file:
            try:
                self._debug_file.close()
                self._debug_file = None
            except Exception as e:
                logger.warning(f"Failed to close debug file: {e}")

    def __del__(self):
        """Destructor to ensure debug file is closed."""
        self._close_debug_file()

    def _log_all_push_statistics(self) -> None:
        """记录所有请求的推送统计信息汇总"""
        if not self.stats_by_request:
            logger.debug("No push statistics to log")
            return

        # 计算总体统计
        total_expected = 0
        total_actual = 0
        request_count = len(self.stats_by_request)

        for request_id, stats in self.stats_by_request.items():
            total_expected += stats["expected"]
            total_actual += stats["actual"]

        # 计算总成功率
        overall_success_rate = (total_actual / total_expected * 100) if total_expected > 0 else 0

        # 打印汇总统计信息
        logger.info(f"SocketIO推送统计汇总: 处理了 {request_count} 个请求，应推送 {total_expected} 个chunk，实际推送 {total_actual} 个chunk，总成功率 {overall_success_rate:.1f}%")

        # 清理所有统计数据
        self.stats_by_request.clear()

    async def is_available(self) -> bool:
        """检查服务可用性"""
        return self.config.enabled and SOCKETIO_AVAILABLE

    async def initialize(self) -> StreamingResult:
        """握手连接。已连通则直接复用，不重建 client / worker。"""
        try:
            if not self.config.validate():
                return StreamingResult(success=False, message="Invalid streaming configuration")

            if not self.config.enabled:
                return StreamingResult(success=False, message="Socket.IO streaming disabled")

            async with self._connection_lock:
                if self._closing:
                    return StreamingResult(success=False, message="Socket.IO driver is shutting down")
                created_queue = await self._initialize_message_queue()
                try:
                    connected = await self._connect_locked()
                except BaseException:
                    # 首轮建连失败才拆掉刚建的 worker；复用中的队列继续给后续重连用。
                    if created_queue:
                        await self._shutdown_message_queue()
                    raise
                if not connected:
                    if created_queue:
                        await self._shutdown_message_queue()
                    return StreamingResult(success=False, message="Socket.IO connection is backing off")

            return StreamingResult(success=True, message="Socket.IO ready")

        except Exception as e:
            logger.error(f"Initialize error: {e}")
            return StreamingResult(success=False, message=f"Init error: {e}")

    async def push(self, chunk_data: ChunkData) -> StreamingResult:
        """入队前用当轮 builder 构好消息，避免复用连接时发到下一轮 builder。"""
        try:
            if self._closing:
                return StreamingResult(success=False, message="Socket.IO driver is shutting down")
            request_id = chunk_data.request_id
            if request_id not in self.stats_by_request:
                self.stats_by_request[request_id] = {"expected": 0, "actual": 0}
            self.stats_by_request[request_id]["expected"] += 1

            if not self.message_queue:
                logger.warning(f"Message queue not initialized, discarding message for {request_id}")
                return StreamingResult(success=False, message="Queue not initialized")

            message = await self._build_message(chunk_data)
            if message is None:
                logger.debug(f"Message build failed for {request_id}, skipping push")
                return StreamingResult(success=False, message="Message build failed")

            if self._closing:
                return StreamingResult(success=False, message="Socket.IO driver is shutting down")

            try:
                self.message_queue.put_nowait(_QueuedSocketIOMessage(request_id, message))
                logger.debug(f"Message queued for {request_id}, queue size: {self.message_queue.qsize()}")
                return StreamingResult(success=True)
            except asyncio.QueueFull:
                logger.warning(f"Message queue full, discarding message for {request_id}")
                return StreamingResult(success=False, message="Queue full, message discarded")

        except Exception as e:
            logger.warning(f"Push error for request {chunk_data.request_id} (ignored): {e}")
            return StreamingResult(success=False, message="Push failed, discarded")

    async def _async_push(self, item: _QueuedSocketIOMessage) -> bool:
        """真正写 websocket。调用方是后台 worker，不在 Agent 热路径上。"""
        request_id = item.request_id
        try:
            if not await self._ensure_connection():
                self._dropped_messages += 1
                return False
            client = self.sio_client
            if client is None:
                self._dropped_messages += 1
                return False

            self._write_to_debug_file(request_id, item.message)

            await asyncio.wait_for(
                client.emit(self.config.event_name, item.message, namespace=self.config.namespace),
                timeout=self.config.push_timeout
            )

            if request_id in self.stats_by_request:
                self.stats_by_request[request_id]["actual"] += 1

            logger.debug(f"Message sent successfully for {request_id}")
            return True

        except Exception as e:
            self._dropped_messages += 1
            logger.warning(f"Async push failed for {request_id}: {e}")
            return False

    def _is_connected(self) -> bool:
        client = self.sio_client
        return bool(client and client.connected and self.config.namespace in client.namespaces)

    async def _ensure_connection(self) -> bool:
        """初始化与发送共用一把锁；空闲断线不产生后台重连任务。"""
        async with self._connection_lock:
            return await self._connect_locked()

    async def _connect_locked(self) -> bool:
        if self._closed:
            return False
        # 检查连接是否过期
        expired = self.connection_time is not None and time.monotonic() - self.connection_time > self.config.max_connection_age
        if self._is_connected() and not expired:
            return True
        if time.monotonic() < self._next_connection_attempt_at:
            return False

        client: Optional["socketio.AsyncClient"] = None
        self._connection_attempts += 1
        try:
            await self._close_connection_locked()
            # 只有现有发送路径负责恢复，避免库重连和新建客户端同时运行。
            client = socketio.AsyncClient(reconnection=False, logger=False, engineio_logger=False)
            await asyncio.wait_for(
                client.connect(
                    self.config.base_url,
                    transports=self.config.transports,
                    namespaces=[self.config.namespace],
                    socketio_path=self.config.socketio_path,
                    wait=True,
                    wait_timeout=self.config.connection_timeout,
                ),
                timeout=self.config.connection_timeout,
            )
            self.sio_client = client
            self.connection_time = time.monotonic()
            self._reconnect_delay = self.config.reconnect_delay
            self._next_connection_attempt_at = 0.0
            logger.info(f"Socket.IO connected namespace={self.config.namespace} attempts={self._connection_attempts}")
            return True
        except Exception as error:
            self._connection_failures += 1
            delay = self._reconnect_delay + random.uniform(-self.config.reconnect_jitter, self.config.reconnect_jitter)
            self._next_connection_attempt_at = time.monotonic() + delay
            self._reconnect_delay = min(self._reconnect_delay * 2, self.config.reconnect_delay_max)
            logger.warning(
                f"Socket.IO connection failed error={type(error).__name__} "
                f"retry_after_seconds={delay:.2f} failures={self._connection_failures}"
            )
            return False
        finally:
            if client is not None and client is not self.sio_client:
                try:
                    await self._shutdown_client(client)
                except Exception as error:
                    # 释放失败保留引用，下次先重试释放，不能遗弃仍有资源的客户端。
                    self.sio_client = client
                    logger.warning(f"Socket.IO client cleanup failed error={type(error).__name__}")

    async def _shutdown_client(self, client: "socketio.AsyncClient") -> None:
        try:
            await asyncio.wait_for(client.shutdown(), timeout=self.config.connection_timeout)
        finally:
            # Socket.IO 握手未完成时 shutdown 可能无事可做，Engine.IO 仍须释放 HTTP 会话。
            await asyncio.wait_for(client.eio.disconnect(abort=True), timeout=self.config.connection_timeout)

    async def _close_connection_locked(self) -> None:
        if self.sio_client is not None:
            await self._shutdown_client(self.sio_client)
            self.sio_client = None
        self.connection_time = None

    async def _close_connection(self) -> None:
        """关闭连接"""
        async with self._connection_lock:
            await self._close_connection_locked()

    async def _build_message(self, chunk_data: ChunkData) -> Optional[Dict[str, Any]]:
        """构建 Socket.IO 消息"""
        message_builder = self.config.get_message_builder()
        if not message_builder:
            logger.warning(f"No message builder configured for request {chunk_data.request_id}, skipping push")
            return None

        try:
            return await message_builder.build_message(chunk_data)
        except Exception as e:
            logger.warning(f"Message builder failed for request {chunk_data.request_id}: {e}, skipping push")
            return None

    async def wait_for_queue_completion(self, timeout: float = 3.0) -> bool:
        """等待消息队列处理完成

        Args:
            timeout: 等待超时时间（秒）

        Returns:
            bool: True表示队列已完成，False表示超时
        """
        if not self.message_queue:
            logger.debug("No message queue to wait for")
            return True

        try:
            logger.debug(f"Waiting for message queue completion (queue size: {self.message_queue.qsize()})")

            # 等待队列中所有任务完成
            await asyncio.wait_for(self.message_queue.join(), timeout=timeout)

            logger.debug("Message queue processing completed")
            return True

        except asyncio.TimeoutError:
            remaining_count = self.message_queue.qsize()
            logger.warning(f"Message queue completion timeout ({timeout}s), {remaining_count} messages remaining")
            return False
        except Exception as e:
            logger.warning(f"Error waiting for queue completion: {e}")
            return False

    async def finalize(self) -> StreamingResult:
        """单轮 LLM 结束：包已入队即可，不断开、不等 Engine.IO 排空。

        落库消息 / 工具消息可以赶到尾巴 chunk 前面，前端已兼容。
        真正断开走 shutdown()，由进程退出调用。
        """
        queue_size = self.message_queue.qsize() if self.message_queue else 0
        logger.info(
            f"Socket.IO connection reused after stream, remaining queued messages: {queue_size} "
            f"connected={self._is_connected()} attempts={self._connection_attempts} "
            f"failures={self._connection_failures} discarded={self._dropped_messages}"
        )
        return StreamingResult(success=True, message="Socket.IO reused, drain in background")

    async def shutdown(self, timeout: float = _SHUTDOWN_DRAIN_TIMEOUT_SECONDS) -> StreamingResult:
        """进程退出时排空发送队列并断开。"""
        self._closing = True
        try:
            completion_success = await self.wait_for_queue_completion(timeout=timeout)
            self._log_all_push_statistics()
            if completion_success:
                return StreamingResult(success=True, message="Connection closed after queue completion")
            return StreamingResult(success=True, message="Connection closed with queue timeout warnings")
        except Exception as e:
            logger.warning(f"Shutdown error: {e}")
            return StreamingResult(success=True, message="Connection closed with warnings")
        finally:
            try:
                await self._shutdown_message_queue()
            finally:
                self._closed = True
                try:
                    await self._close_connection()
                finally:
                    self._close_debug_file()

    async def _initialize_message_queue(self) -> bool:
        """启动发送 worker。已在跑则复用，返回是否新建。"""
        if (
            self.message_queue is not None
            and self.queue_worker_task is not None
            and not self.queue_worker_task.done()
        ):
            return False

        try:
            self.message_queue = asyncio.Queue(maxsize=_MESSAGE_QUEUE_MAXSIZE)
            self._shutdown_event = asyncio.Event()
            self.queue_worker_task = asyncio.create_task(self._message_queue_worker())
            logger.debug("Message queue system initialized")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize message queue: {e}")
            raise

    async def _shutdown_message_queue(self) -> None:
        """关闭消息队列系统"""
        try:
            # 设置关闭事件
            if self._shutdown_event:
                self._shutdown_event.set()

            # 等待队列工作任务完成（最多等待3秒）
            if self.queue_worker_task and not self.queue_worker_task.done():
                try:
                    await asyncio.wait_for(self.queue_worker_task, timeout=3.0)
                except asyncio.TimeoutError:
                    logger.warning("Message queue worker shutdown timeout (3s), cancelling task")
                    self.queue_worker_task.cancel()
                    try:
                        await self.queue_worker_task
                    except asyncio.CancelledError:
                        pass

            # 清理资源
            self.message_queue = None
            self.queue_worker_task = None
            self._shutdown_event = None

            logger.debug("Message queue system shutdown complete")

        except Exception as e:
            logger.warning(f"Error during message queue shutdown: {e}")

    async def _message_queue_worker(self) -> None:
        """消息队列工作任务 - 按顺序处理队列中的消息"""
        logger.info("Message queue worker started")

        try:
            while not self._shutdown_event.is_set():
                try:
                    # 优化：同时等待消息和关闭事件，提升关闭响应速度
                    get_task = asyncio.create_task(self.message_queue.get())
                    shutdown_task = asyncio.create_task(self._shutdown_event.wait())

                    done, pending = await asyncio.wait(
                        [get_task, shutdown_task],
                        return_when=asyncio.FIRST_COMPLETED
                    )

                    # 取消未完成的任务
                    for task in pending:
                        task.cancel()
                        try:
                            await task
                        except asyncio.CancelledError:
                            pass

                    # 检查哪个任务完成了
                    if shutdown_task in done:
                        # 关闭事件触发，但先检查是否同时有消息需要处理
                        if get_task in done:
                            # 同时有消息，先处理这个消息再退出
                            chunk_data = get_task.result()
                            success = await self._async_push(chunk_data)
                            self.message_queue.task_done()
                        # 处理完当前消息后退出循环
                        break

                    if get_task in done:
                        # 获取到消息，处理它
                        chunk_data = get_task.result()

                        # 处理消息（原来的异步推送逻辑）
                        success = await self._async_push(chunk_data)

                        # 标记任务完成
                        self.message_queue.task_done()

                except asyncio.TimeoutError:
                    # 这种情况下不应该发生，但保留兼容性
                    continue
                except Exception as e:
                    logger.warning(f"Error processing message in queue worker: {e}")
                    # 继续处理下一个消息
                    continue

        except asyncio.CancelledError:
            logger.info("Message queue worker cancelled")
            raise
        except Exception as e:
            logger.error(f"Unexpected error in message queue worker: {e}")
        finally:
            logger.info("Message queue worker stopped")
