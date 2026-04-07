# agentlang/agentlang/streaming/drivers/socketio/driver.py
import asyncio
import json
import os
import time
from pathlib import Path
from typing import Optional, Dict, Any, TextIO
from datetime import datetime

from ...interface import StreamingInterface
from ...models import ChunkData, StreamingResult
from .config import SocketIODriverConfig
from agentlang.logger import get_logger
from agentlang.path_manager import PathManager
from agentlang.utils.shadow_code import ShadowCode

logger = get_logger(__name__)

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
        self.sio_client = None
        self.connection_time = None

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
                formatted_data = json.dumps(debug_entry, indent=2, ensure_ascii=False)
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
        """完整初始化连接，确保命名空间连接可用"""
        try:
            # 验证配置有效性
            if not self.config.validate():
                return StreamingResult(success=False, message="Invalid streaming configuration")

            if not self.config.enabled:
                return StreamingResult(success=False, message="Socket.IO streaming disabled")

            # 初始化消息队列系统
            await self._initialize_message_queue()

            try:
                # 建立完整连接（包括命名空间连接确认）
                await self._establish_full_connection()
            except Exception:
                # 连接失败时清理已创建的队列任务，防止 background task 泄漏
                await self._shutdown_message_queue()
                raise

            return StreamingResult(success=True, message="Socket.IO ready")

        except Exception as e:
            logger.error(f"Initialize error: {e}")
            return StreamingResult(success=False, message=f"Init error: {e}")

    async def push(self, chunk_data: ChunkData) -> StreamingResult:
        """推送临时消息（加入消息队列，保证顺序发送）"""
        try:
            # 统计预期发送数量
            request_id = chunk_data.request_id
            if request_id not in self.stats_by_request:
                self.stats_by_request[request_id] = {"expected": 0, "actual": 0}
            self.stats_by_request[request_id]["expected"] += 1

            # 检查消息队列是否可用
            if not self.message_queue:
                logger.warning(f"Message queue not initialized, discarding message for {request_id}")
                return StreamingResult(success=False, message="Queue not initialized")

            # 将消息放入队列，非阻塞
            try:
                self.message_queue.put_nowait(chunk_data)
                logger.debug(f"Message queued for {request_id}, queue size: {self.message_queue.qsize()}")
                return StreamingResult(success=True)
            except asyncio.QueueFull:
                logger.warning(f"Message queue full, discarding message for {request_id}")
                return StreamingResult(success=False, message="Queue full, message discarded")

        except Exception as e:
            logger.warning(f"Push error for request {chunk_data.request_id} (ignored): {e}")
            return StreamingResult(success=False, message="Push failed, discarded")

    async def _async_push(self, chunk_data: ChunkData) -> bool:
        """异步推送实现（内部方法）

        Returns:
            bool: 推送是否成功
        """
        request_id = chunk_data.request_id
        try:
            # 轻量级连接检查
            await self._ensure_connection()

            # 最后一次安全检查连接状态
            if not self.sio_client or not self.sio_client.connected:
                logger.warning(f"Connection failed for {request_id}, skipping push")
                return False

            # 构建消息
            message = await self._build_message(chunk_data)
            if message is None:
                # 没有消息构建器或构建失败，跳过推送
                logger.debug(f"Message build failed for {request_id}, skipping push")
                return False

            # Write to debug file if enabled
            self._write_to_debug_file(request_id, message)

            # 发送消息（设置短超时，快速失败）
            await asyncio.wait_for(
                self.sio_client.emit(self.config.event_name, message, namespace=self.config.namespace),
                timeout=self.config.push_timeout
            )

            # 统计实际发送成功数量
            if request_id in self.stats_by_request:
                self.stats_by_request[request_id]["actual"] += 1

            logger.debug(f"Message sent successfully for {request_id}")
            return True

        except Exception as e:
            # 记录但不处理错误，保持轻量化
            logger.warning(f"Async push failed for {request_id}: {e}")
            return False

    async def _establish_full_connection(self) -> None:
        """建立完整连接，包括命名空间连接确认"""
        try:
            # 检查连接是否过期
            if (self.sio_client and self.sio_client.connected and
                self.connection_time and
                time.time() - self.connection_time > self.config.max_connection_age):
                logger.info("Connection expired, closing old connection")
                await self._close_connection()

            if self.sio_client and self.sio_client.connected:
                return

            # 创建新连接
            self.sio_client = socketio.AsyncClient(logger=False, engineio_logger=False)

            # 添加命名空间连接事件监听（参考 test_single_message.py）
            namespace_connected = False

            @self.sio_client.event(namespace=self.config.namespace)
            async def connect():
                nonlocal namespace_connected
                namespace_connected = True
                logger.debug(f"Namespace {self.config.namespace} connected successfully")

            # 连接到服务器
            await asyncio.wait_for(
                self.sio_client.connect(
                    self.config.base_url,
                    transports=self.config.transports,
                    namespaces=[self.config.namespace],
                    socketio_path=self.config.socketio_path,
                    wait=False
                ),
                timeout=self.config.connection_timeout
            )

                        # 等待连接真正建立，参考 test_single_message.py
            logger.debug("Waiting for connection to be fully established...")
            connection_check_timeout = self.config.connection_timeout
            start_time = time.time()
            while not self.sio_client.connected and (time.time() - start_time) < connection_check_timeout:
                await asyncio.sleep(0.1)

            if not self.sio_client.connected:
                raise ConnectionError("Connection established but not in connected state")

            # 等待命名空间连接成功（参考 test_single_message.py）
            logger.debug(f"Waiting for namespace {self.config.namespace} to connect...")
            namespace_timeout = 5.0  # 命名空间连接超时
            start_time = time.time()
            while not namespace_connected and (time.time() - start_time) < namespace_timeout:
                await asyncio.sleep(0.1)

            if not namespace_connected:
                raise ConnectionError(f"Namespace {self.config.namespace} failed to connect")

            self.connection_time = time.time()
            logger.info(f"Socket.IO connected to {self.config.base_url} with path {self.config.socketio_path}, namespace {self.config.namespace} ready")

        except Exception as e:
            logger.warning(f"Full connection failed: {e}")
            await self._close_connection()
            raise

    async def _ensure_connection(self) -> None:
        """轻量级连接检查，必要时重连"""
        if not self.sio_client or not self.sio_client.connected:
            logger.debug("Connection lost, re-establishing...")
            await self._establish_full_connection()
        elif self.sio_client and hasattr(self.sio_client, 'namespaces') and self.config.namespace not in self.sio_client.namespaces:
            logger.debug(f"Namespace {self.config.namespace} lost, re-establishing...")
            await self._establish_full_connection()

    async def _close_connection(self) -> None:
        """关闭连接"""
        try:
            if self.sio_client:
                await self.sio_client.disconnect()
        except Exception:
            pass  # 静默处理关闭错误
        finally:
            self.sio_client = None
            self.connection_time = None

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
        """断开连接，清理资源"""
        try:
            # 等待消息队列处理完成（在关闭前）
            completion_success = await self.wait_for_queue_completion(timeout=3.0)

            # 打印所有请求的推送统计信息
            self._log_all_push_statistics()

            # 停止消息队列系统
            await self._shutdown_message_queue()

            # 断开连接，清理资源
            await self._close_connection()

            # Close debug file
            self._close_debug_file()

            if completion_success:
                return StreamingResult(success=True, message="Connection closed after queue completion")
            else:
                return StreamingResult(success=True, message="Connection closed with queue timeout warnings")

        except Exception as e:
            logger.warning(f"Finalize error: {e}")
            return StreamingResult(success=True, message="Connection closed with warnings")

    async def _initialize_message_queue(self) -> None:
        """初始化消息队列系统"""
        try:
            # 创建消息队列（设置合理的最大大小防止内存溢出）
            self.message_queue = asyncio.Queue(maxsize=1000)

            # 创建关闭事件
            self._shutdown_event = asyncio.Event()

            # 启动队列工作任务
            self.queue_worker_task = asyncio.create_task(self._message_queue_worker())

            logger.debug("Message queue system initialized")

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
