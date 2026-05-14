"""MCP 客户端

基于官方 MCP Python SDK 的单连接生命周期管理，支持：
- HTTP（Streamable HTTP 优先，自动回退 SSE）
- Stdio
- 连接失败时的指数退避重试
- 会话初始化失败时的 SSE 回退
- 工具列表获取和工具调用
"""

import asyncio
import random
import time
from typing import Any, Dict, List, Optional, Tuple

from agentlang.logger import get_logger
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from ..config.models import MCPServerConfig, MCPServerType

logger = get_logger(__name__)

# 清理操作最长等待时间（秒）
CONNECTION_CLEANUP_TIMEOUT = 2.0

# 是否已安装 cancel scope 异常过滤器
_cancel_scope_filter_installed = False

def _ensure_cancel_scope_error_filter() -> None:
    """安装事件循环异常过滤器，抑制 MCP 传输层 GC 清理时产生的噪音日志。

    当跨 task 的 cancel scope 冲突导致无法正常调用 __aexit__ 时，
    丢弃传输层引用后 GC 会自动清理 async generator 并产生一个
    'Task exception was never retrieved' 的 ERROR 日志。
    该过滤器仅抑制这一类特定的 RuntimeError，不影响其他异常。
    """
    global _cancel_scope_filter_installed
    if _cancel_scope_filter_installed:
        return

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return

    _cancel_scope_filter_installed = True
    original_handler = loop.get_exception_handler()

    def _filtered_handler(loop_ref, context):
        exc = context.get("exception")
        if (isinstance(exc, RuntimeError)
                and "Attempted to exit cancel scope in a different task" in str(exc)):
            logger.debug(f"已过滤 MCP 传输层清理时的 cancel scope 异常")
            return
        if original_handler:
            original_handler(loop_ref, context)
        else:
            loop_ref.default_exception_handler(context)

    loop.set_exception_handler(_filtered_handler)


class MCPClient:
    """基于官方 SDK 的 MCP 客户端封装

    提供统一接口连接不同类型的 MCP 服务器，支持工具列表获取、
    工具调用、健康检查和自动重连。
    """

    def __init__(self, config: MCPServerConfig, max_retries: int = 1, retry_delay: float = 1.0):
        """初始化 MCP 客户端

        Args:
            config: MCP 服务器配置
            max_retries: 最大重试次数
            retry_delay: 重试基础延迟时间（秒），实际延迟使用指数退避
        """
        self.config = config
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.session: Optional[ClientSession] = None
        self._read_stream = None
        self._write_stream = None
        self._transport_context = None

        logger.debug(f"初始化 MCP 客户端: {config.name} ({config.type.value}), 最大重试次数: {max_retries}")

    async def connect(self) -> bool:
        """连接到 MCP 服务器（带重试机制）

        Returns:
            bool: 连接是否成功
        """
        logger.debug(f"连接到 MCP 服务器: {self.config.name} ({self.config.type.value})")

        for attempt in range(self.max_retries + 1):
            try:
                self.config.validate_config()

                if self.config.type == MCPServerType.HTTP:
                    success = await self._connect_http()
                elif self.config.type == MCPServerType.STDIO:
                    success = await self._connect_stdio()
                else:
                    logger.warning(f"不支持的 MCP 服务器类型: {self.config.type}")
                    return False

                if not success:
                    if attempt < self.max_retries:
                        await self._wait_before_retry(attempt)
                        continue
                    return False

                if await self._create_session():
                    return True

                if attempt < self.max_retries:
                    await self._wait_before_retry(attempt)
                    continue
                return False

            except Exception as e:
                logger.warning(
                    f"连接 MCP 服务器 '{self.config.name}' 失败 "
                    f"(尝试 {attempt + 1}/{self.max_retries + 1}): {type(e).__name__}: {e}"
                )
                await self._cleanup_on_error()

                if attempt < self.max_retries and self._is_retryable_error(e):
                    await self._wait_before_retry(attempt)
                    continue
                return False

        return False

    async def disconnect(self) -> None:
        """断开连接，清理会话和传输层资源"""
        cancel_scope_conflict = False
        try:
            if self.session:
                try:
                    await asyncio.wait_for(
                        self.session.__aexit__(None, None, None),
                        timeout=CONNECTION_CLEANUP_TIMEOUT
                    )
                except asyncio.TimeoutError:
                    logger.warning(f"MCP 会话关闭超时: {self.config.name}")
                except asyncio.CancelledError:
                    logger.debug(f"MCP 会话关闭被取消: {self.config.name}")
                except Exception as e:
                    if "cancel scope" in str(e).lower():
                        cancel_scope_conflict = True
                        logger.debug(f"关闭 MCP 会话时遇到 cancel scope 冲突: {self.config.name}")
                    else:
                        logger.warning(f"关闭 MCP 会话时出错: {self.config.name}: {e}")
                finally:
                    self.session = None

            if cancel_scope_conflict:
                # 跨 task 调用 __aexit__ 触发 anyio cancel scope 冲突时，
                # 直接丢弃引用，zombie 后台 task 会自行超时结束。
                # 安装异常过滤器避免 GC 清理 async generator 时产生噪音 ERROR 日志。
                _ensure_cancel_scope_error_filter()
                self._transport_context = None
                self._read_stream = None
                self._write_stream = None
            else:
                await self._cleanup_transport()

            logger.info(f"MCP 服务器 '{self.config.name}' 连接已断开")

        except Exception as e:
            logger.warning(f"断开 MCP 服务器 '{self.config.name}' 连接时出错: {e}")

    async def list_tools(self) -> List[Dict[str, Any]]:
        """列出当前连接服务器上的可用工具

        Returns:
            List[Dict[str, Any]]: 工具列表，每项包含 name、description、inputSchema

        Raises:
            RuntimeError: 未连接时抛出
        """
        if not self.session:
            raise RuntimeError(f"未连接到 MCP 服务器 '{self.config.name}'")

        try:
            result = await self.session.list_tools()
            tools = []
            for tool in result.tools:
                if self.config.allowed_tools and tool.name not in self.config.allowed_tools:
                    continue
                tools.append({
                    "name": tool.name,
                    "description": tool.description or "",
                    "inputSchema": tool.inputSchema or {}
                })

            logger.debug(f"从 MCP 服务器 '{self.config.name}' 获取到 {len(tools)} 个工具")
            return tools

        except Exception as e:
            logger.warning(f"从 MCP 服务器 '{self.config.name}' 获取工具列表失败: {e}")
            raise

    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """调用工具（连接失效时自动重连）

        Args:
            name: 工具原始名称
            arguments: 工具参数

        Returns:
            Dict[str, Any]: 包含 content 和 isError 字段的结果
        """
        if not self.session or not await self.ping():
            logger.warning(f"MCP 服务器 '{self.config.name}' 连接失效，尝试重连")
            await self.disconnect()

            if not await self.connect():
                error_msg = f"无法连接到 MCP 服务器 '{self.config.name}'"
                logger.error(error_msg)
                return {"content": [{"type": "text", "text": error_msg}], "isError": True}

            logger.info(f"成功重连到 MCP 服务器 '{self.config.name}'")

        try:
            result = await self.session.call_tool(name, arguments)
            return {
                "content": result.content if hasattr(result, 'content') else [],
                "isError": result.isError if hasattr(result, 'isError') else False
            }
        except Exception as e:
            logger.warning(f"调用 MCP 工具 '{name}' 失败: {e}")
            return {"content": [{"type": "text", "text": str(e)}], "isError": True}

    async def ping(self) -> bool:
        """健康检查

        Returns:
            bool: 连接是否健康
        """
        try:
            if self.session:
                await self.session.send_ping()
                return True
            return False
        except Exception as e:
            logger.debug(f"MCP 服务器 '{self.config.name}' ping 失败: {e}")
            return False

    # ------------------------------------------------------------------ #
    # 内部：连接建立                                                        #
    # ------------------------------------------------------------------ #

    async def _connect_http(self) -> bool:
        """建立 HTTP 连接，优先 Streamable HTTP，自动回退 SSE"""
        if not self.config.url:
            raise ValueError("HTTP 服务器 URL 不能为空")

        headers = self._prepare_headers()

        streamable_ok, streamable_err = await self._try_streamable_http(headers)
        if streamable_ok:
            return True

        sse_ok, sse_err = await self._try_sse(headers)
        if sse_ok:
            return True

        raise RuntimeError(
            f"无法建立 HTTP 连接 (Streamable: {streamable_err}, SSE: {sse_err})"
        )

    async def _connect_stdio(self) -> bool:
        """建立 Stdio 连接"""
        if not self.config.command or not self.config.args:
            raise ValueError("Stdio 服务器命令和参数不能为空")

        server_params = StdioServerParameters(
            command=self.config.command,
            args=self.config.args,
            env=self.config.env or {}
        )
        try:
            logger.debug(f"尝试建立 Stdio 连接: {self.config.command} {' '.join(self.config.args)}")
            self._transport_context = stdio_client(server_params)
            self._read_stream, self._write_stream = await self._transport_context.__aenter__()
            logger.debug(f"Stdio 连接成功建立: {self.config.name}")
            return True
        except Exception as e:
            logger.warning(f"Stdio 连接失败: {e}")
            await self._cleanup_transport()
            return False

    def _prepare_headers(self) -> Dict[str, str]:
        """准备 HTTP 认证头，token 优先级高于自定义 headers"""
        headers: Dict[str, str] = {}
        if self.config.headers:
            headers.update(self.config.headers)
        if self.config.token:
            headers["Authorization"] = f"Bearer {self.config.token}"
        return headers

    async def _try_streamable_http(self, headers: Dict[str, str]) -> Tuple[bool, Optional[Exception]]:
        """尝试 Streamable HTTP 连接"""
        try:
            from mcp.client.streamable_http import streamablehttp_client
            self._transport_context = self._create_transport_client(streamablehttp_client, headers)
            self._read_stream, self._write_stream, _ = await self._transport_context.__aenter__()
            return True, None
        except Exception as e:
            await self._cleanup_transport()
            return False, e

    async def _try_sse(self, headers: Dict[str, str]) -> Tuple[bool, Optional[Exception]]:
        """尝试 SSE 连接"""
        try:
            from mcp.client.sse import sse_client
            self._transport_context = self._create_transport_client(sse_client, headers)
            self._read_stream, self._write_stream = await self._transport_context.__aenter__()
            return True, None
        except Exception as e:
            await self._cleanup_transport()
            return False, e

    def _create_transport_client(self, client_factory, headers: Dict[str, str]):
        """创建传输层客户端，不支持 headers 参数时降级为无头版本"""
        if headers:
            try:
                return client_factory(self.config.url, headers=headers)
            except TypeError:
                logger.warning(f"{client_factory.__name__} 不支持 headers 参数，使用基础连接")
                return client_factory(self.config.url)
        return client_factory(self.config.url)

    # ------------------------------------------------------------------ #
    # 内部：会话初始化                                                      #
    # ------------------------------------------------------------------ #

    async def _create_session(self) -> bool:
        """创建 MCP 会话并初始化，失败时尝试 SSE 回退"""
        if not self._read_stream or not self._write_stream:
            raise RuntimeError("传输流创建失败")

        try:
            self.session = ClientSession(self._read_stream, self._write_stream)
            await self.session.__aenter__()
            await self.session.initialize()
            logger.debug(f"MCP 服务器 '{self.config.name}' 连接成功")
            return True

        except (Exception, asyncio.CancelledError) as init_error:
            if self._should_try_sse_fallback(init_error):
                logger.debug(f"检测到协议不匹配，回退到 SSE 连接: {self.config.name}")
                try:
                    return await self._try_sse_fallback(init_error)
                except Exception as fallback_error:
                    logger.warning(f"SSE 回退失败: {type(fallback_error).__name__}: {fallback_error}")
                    await self._cleanup_on_error()
                    return False
            else:
                await self._cleanup_on_error()
                return False

    def _should_try_sse_fallback(self, error: BaseException) -> bool:
        """判断是否应该尝试 SSE 协议回退"""
        if self.config.type != MCPServerType.HTTP:
            return False

        error_str = str(error)
        error_type = type(error).__name__

        # anyio cancel scope 冲突不是协议协商失败，强行回退只会制造更多 zombie
        if "cancel scope" in error_str.lower():
            return False

        fallback_indicators = [
            "405" in error_str,
            "Method Not Allowed" in error_str,
            "streamablehttp" in error_type.lower(),
            "HTTPStatusError" in error_type,
            "McpError" in error_type,
            "Session terminated" in error_str,
            "session initialization failed" in error_str.lower(),
            "CancelledError" in error_type,
        ]
        return any(fallback_indicators)

    async def _try_sse_fallback(self, original_error: BaseException) -> bool:
        """执行 SSE 协议回退"""
        try:
            await self._cleanup_on_error(reset_first=True)

            headers = self._prepare_headers()
            sse_ok, sse_err = await self._try_sse(headers)
            if not sse_ok:
                raise RuntimeError(f"SSE 回退连接失败: {sse_err}")

            return await self._create_session_no_fallback()

        except Exception as fallback_error:
            raise RuntimeError(
                f"无法建立 MCP 连接到 '{self.config.name}' "
                f"(原始错误: {type(original_error).__name__}: {original_error}, "
                f"SSE 回退错误: {type(fallback_error).__name__}: {fallback_error})"
            )

    async def _create_session_no_fallback(self) -> bool:
        """创建会话（不再尝试协议回退）"""
        if not self._read_stream or not self._write_stream:
            raise RuntimeError("传输流创建失败")

        try:
            self.session = ClientSession(self._read_stream, self._write_stream)
            await self.session.__aenter__()
            await self.session.initialize()
            logger.debug(f"MCP 服务器 '{self.config.name}' 通过 SSE 回退连接成功")
            return True

        except (Exception, asyncio.CancelledError) as e:
            logger.warning(f"SSE 回退期间会话初始化失败: {type(e).__name__}: {e}")
            if self.session:
                try:
                    await asyncio.wait_for(
                        self.session.__aexit__(None, None, None),
                        timeout=CONNECTION_CLEANUP_TIMEOUT
                    )
                except (Exception, asyncio.TimeoutError):
                    pass
                finally:
                    self.session = None
            raise RuntimeError(f"SSE 回退期间会话初始化失败: {e}")

    # ------------------------------------------------------------------ #
    # 内部：资源清理                                                        #
    # ------------------------------------------------------------------ #

    async def _cleanup_transport(self) -> None:
        """清理传输层连接"""
        if self._transport_context:
            try:
                await asyncio.wait_for(
                    self._transport_context.__aexit__(None, None, None),
                    timeout=CONNECTION_CLEANUP_TIMEOUT
                )
            except asyncio.TimeoutError:
                logger.warning(f"MCP 传输层清理超时: {self.config.name}")
            except Exception as e:
                logger.debug(f"MCP 传输层清理时出错: {self.config.name}: {e}")
            finally:
                self._transport_context = None

    async def _cleanup_on_error(self, reset_first: bool = False) -> None:
        """清理错误时的连接资源

        Args:
            reset_first: 为 True 时先重置所有引用再执行清理操作，
                         可避免跨 task 的 async context manager 问题（SSE 回退场景）。
                         默认 False 时先清理再重置引用。
        """
        try:
            if reset_first:
                # 先保存引用、立即清空，再 await 清理
                session = self.session
                transport_context = self._transport_context
                self.session = None
                self._transport_context = None
                self._read_stream = None
                self._write_stream = None

                if session:
                    try:
                        await asyncio.wait_for(
                            session.__aexit__(None, None, None),
                            timeout=CONNECTION_CLEANUP_TIMEOUT
                        )
                    except (Exception, asyncio.TimeoutError):
                        pass

                if transport_context:
                    try:
                        await asyncio.wait_for(
                            transport_context.__aexit__(None, None, None),
                            timeout=CONNECTION_CLEANUP_TIMEOUT
                        )
                    except (Exception, asyncio.TimeoutError):
                        pass
            else:
                if self.session:
                    try:
                        await asyncio.wait_for(
                            self.session.__aexit__(None, None, None),
                            timeout=CONNECTION_CLEANUP_TIMEOUT
                        )
                    except (Exception, asyncio.TimeoutError):
                        pass
                    finally:
                        self.session = None

                await self._cleanup_transport()
                self._read_stream = None
                self._write_stream = None

        except Exception as e:
            logger.warning(f"清理资源时出错: {e}")
            self.session = None
            self._transport_context = None
            self._read_stream = None
            self._write_stream = None

    # ------------------------------------------------------------------ #
    # 内部：重试辅助                                                        #
    # ------------------------------------------------------------------ #

    def _is_retryable_error(self, error: Exception) -> bool:
        """判断错误是否可重试"""
        error_str = str(error).lower()
        error_type = type(error).__name__

        retryable = [
            "timeout" in error_str,
            "connection" in error_str,
            "network" in error_str,
            "unreachable" in error_str,
            "npm error" in error_str,
            "idletimeout" in error_str,
            "sigterm" in error_str,
            "process terminated" in error_str,
            "temporary" in error_str,
            "503" in error_str,
            "502" in error_str,
            "504" in error_str,
            error_type in ("TimeoutError", "asyncio.TimeoutError", "ConnectionError", "OSError"),
        ]
        return any(retryable)

    async def _wait_before_retry(self, attempt: int) -> None:
        """指数退避等待，加入随机抖动"""
        delay = self.retry_delay * (2 ** attempt) + random.uniform(0, 1)
        logger.debug(f"等待 {delay:.2f} 秒后重试连接 MCP 服务器 '{self.config.name}'...")
        await asyncio.sleep(delay)

    # ------------------------------------------------------------------ #
    # 上下文管理器支持                                                      #
    # ------------------------------------------------------------------ #

    async def __aenter__(self) -> 'MCPClient':
        if await self.connect():
            return self
        raise RuntimeError(f"无法连接到 MCP 服务器 '{self.config.name}'")

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        await self.disconnect()

    def __str__(self) -> str:
        status = "已连接" if self.session else "未连接"
        return f"MCPClient(server='{self.config.name}', type={self.config.type.value}, status={status})"
