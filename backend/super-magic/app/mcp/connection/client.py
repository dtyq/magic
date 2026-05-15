"""MCP 客户端

基于官方 MCP Python SDK 的单连接生命周期管理，支持：
- HTTP（Streamable HTTP 优先，自动回退 SSE）
- Stdio
- 连接失败时的指数退避重试
- 工具列表获取和工具调用
"""

import asyncio
import random
from typing import Any, Dict, List, Optional

from agentlang.logger import get_logger
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from ..config.models import MCPServerConfig, MCPServerType

logger = get_logger(__name__)

# 断开连接时等待后台 task 退出的最长时间（秒）
CONNECTION_CLEANUP_TIMEOUT = 5.0


async def _read_error_body_hook(response) -> None:
    """httpx response hook：对 4xx/5xx 响应预读 body。

    MCP SDK 的 streamable HTTP 传输层用 client.stream() 发送请求，
    response body 在 raise_for_status() 被调用时尚未读取，
    导致 HTTPStatusError.response.text 不可用。
    通过此 hook 提前 aread()，确保 body 在异常抛出后仍可访问。
    """
    if response.status_code >= 400:
        try:
            await response.aread()
        except Exception:
            pass


def _mcp_http_client_factory_with_error_body(
    headers=None,
    timeout=None,
    auth=None,
):
    """与 create_mcp_http_client 相同，但额外注册了 error body 预读 hook。"""
    import httpx as _httpx

    kwargs = {
        "follow_redirects": True,
        "timeout": timeout if timeout is not None else _httpx.Timeout(30.0),
        "event_hooks": {"response": [_read_error_body_hook]},
    }
    if headers is not None:
        kwargs["headers"] = headers
    if auth is not None:
        kwargs["auth"] = auth
    return _httpx.AsyncClient(**kwargs)


class MCPClient:
    """基于官方 SDK 的 MCP 客户端封装

    连接生命周期运行在独立的后台 asyncio Task 中，并使用标准嵌套
    async with 模式（streamablehttp_client → ClientSession）管理资源。

    这样可以让 anyio TaskGroup 在边界正确地将内部后台任务的真实异常
    （如 McpError/HTTP 500）重新抛出，而不是被 CancelledError 遮盖。
    """

    def __init__(self, config: MCPServerConfig, max_retries: int = 1, retry_delay: float = 1.0):
        self.config = config
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.session: Optional[ClientSession] = None
        self.last_error: Optional[str] = None

        # 连接生命周期后台任务及协调事件
        self._conn_task: Optional[asyncio.Task] = None
        self._init_event: Optional[asyncio.Event] = None
        self._disconnect_event: Optional[asyncio.Event] = None
        self._init_error: Optional[BaseException] = None

        logger.debug(f"初始化 MCP 客户端: {config.name} ({config.type.value}), 最大重试次数: {max_retries}")

    # ------------------------------------------------------------------ #
    # 公开接口                                                             #
    # ------------------------------------------------------------------ #

    async def connect(self) -> bool:
        """连接到 MCP 服务器（带重试机制）"""
        logger.debug(f"连接到 MCP 服务器: {self.config.name} ({self.config.type.value})")

        for attempt in range(self.max_retries + 1):
            try:
                self.config.validate_config()
                if await self._connect_once():
                    return True
            except asyncio.CancelledError:
                raise  # 外部真实取消，直接上抛
            except Exception as e:
                self.last_error = self._format_error(e)
                logger.warning(
                    f"连接 MCP 服务器 '{self.config.name}' 失败 "
                    f"(尝试 {attempt + 1}/{self.max_retries + 1}): {self.last_error}"
                )
                if attempt < self.max_retries and self._is_retryable_error(e):
                    await self._wait_before_retry(attempt)
                    continue
                return False

        return False

    async def disconnect(self) -> None:
        """断开连接：通知后台 lifecycle task 退出，并等待其完成"""
        if self._disconnect_event:
            self._disconnect_event.set()

        if self._conn_task and not self._conn_task.done():
            done, _ = await asyncio.wait(
                [self._conn_task], timeout=CONNECTION_CLEANUP_TIMEOUT
            )
            if not done:
                self._conn_task.cancel()
                try:
                    await self._conn_task
                except (asyncio.CancelledError, Exception):
                    pass

        self._conn_task = None
        self._init_event = None
        self._disconnect_event = None
        logger.info(f"MCP 服务器 '{self.config.name}' 连接已断开")

    async def list_tools(self) -> List[Dict[str, Any]]:
        """列出当前连接服务器上的可用工具"""
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
        """调用工具（连接失效时自动重连）"""
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
        """健康检查"""
        try:
            if self.session:
                await self.session.send_ping()
                return True
            return False
        except Exception as e:
            logger.debug(f"MCP 服务器 '{self.config.name}' ping 失败: {e}")
            return False

    # ------------------------------------------------------------------ #
    # 连接生命周期（后台 task）                                             #
    # ------------------------------------------------------------------ #

    async def _connect_once(self) -> bool:
        """启动连接 lifecycle 后台 task，等待初始化完成后返回。

        初始化成功返回 True；失败则 raise 初始化阶段收到的异常（由调用方
        的 connect() 决定是否重试）。
        """
        self._init_event = asyncio.Event()
        self._disconnect_event = asyncio.Event()
        self._init_error = None

        task = asyncio.create_task(
            self._connection_lifecycle(),
            name=f"mcp-{self.config.name}"
        )

        try:
            await self._init_event.wait()
        except asyncio.CancelledError:
            # 外部取消：终止 lifecycle task 后透传
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass
            raise

        if self._init_error:
            # 等待 task 完成清理（它在存储 _init_error 后就会退出）
            done, _ = await asyncio.wait([task], timeout=CONNECTION_CLEANUP_TIMEOUT)
            if not done:
                task.cancel()
                try:
                    await task
                except (asyncio.CancelledError, Exception):
                    pass
            raise self._init_error

        self._conn_task = task
        return True

    async def _connection_lifecycle(self) -> None:
        """连接生命周期后台 task 的入口。

        捕获规则：
        - CancelledError → 正常断开（由 disconnect() 取消 task 触发），静默退出
        - Exception      → 若初始化尚未完成，存入 _init_error 并触发 _init_event；
                           若已完成则记录意外断开日志
        """
        try:
            if self.config.type == MCPServerType.HTTP:
                await self._http_lifecycle()
            elif self.config.type == MCPServerType.STDIO:
                await self._stdio_lifecycle()
            else:
                raise ValueError(f"不支持的 MCP 服务器类型: {self.config.type}")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            actual_error = self._unwrap_exception_group(e)
            if self._init_event and not self._init_event.is_set():
                self._init_error = actual_error
                self._init_event.set()
            else:
                logger.warning(
                    f"MCP 服务器 '{self.config.name}' 连接意外中断: "
                    f"{type(e).__name__}: {e}"
                )
        finally:
            self.session = None

    async def _http_lifecycle(self) -> None:
        """HTTP 连接生命周期：Streamable HTTP 优先，失败时自动回退 SSE。

        使用嵌套 async with，确保 session.initialize() 内的真实 HTTP 错误
        （McpError/HTTPStatusError）能由 anyio TaskGroup 在上下文管理器边界
        正确重新抛出，而不是被替换为 CancelledError。
        """
        if not self.config.url:
            raise ValueError("HTTP 服务器 URL 不能为空")

        headers = self._prepare_headers()

        from mcp.client.streamable_http import streamablehttp_client
        streamable_cm = self._create_transport_cm(
            streamablehttp_client, headers,
            httpx_client_factory=_mcp_http_client_factory_with_error_body,
        )

        try:
            async with streamable_cm as streams:
                await self._session_lifecycle(streams[0], streams[1])
        except Exception as streamable_error:
            actual_error = self._unwrap_exception_group(streamable_error)
            if not self._should_try_sse_fallback(actual_error):
                raise actual_error

            logger.debug(
                f"Streamable HTTP 失败，回退到 SSE: {self.config.name} "
                f"({type(actual_error).__name__}: {actual_error})"
            )
            from mcp.client.sse import sse_client
            sse_cm = self._create_transport_cm(sse_client, headers)
            try:
                async with sse_cm as streams:
                    await self._session_lifecycle(streams[0], streams[1])
            except Exception as sse_error:
                actual_sse_error = self._unwrap_exception_group(sse_error)
                raise RuntimeError(
                    f"Streamable HTTP 和 SSE 均连接失败 "
                    f"(streamable: {actual_error}, sse: {actual_sse_error})"
                ) from actual_sse_error

    async def _stdio_lifecycle(self) -> None:
        """Stdio 连接生命周期"""
        if not self.config.command or not self.config.args:
            raise ValueError("Stdio 服务器命令和参数不能为空")

        server_params = StdioServerParameters(
            command=self.config.command,
            args=self.config.args,
            env=self.config.env or {}
        )
        logger.debug(f"尝试建立 Stdio 连接: {self.config.command} {' '.join(self.config.args)}")
        async with stdio_client(server_params) as (r, w):
            await self._session_lifecycle(r, w)

    async def _session_lifecycle(self, read_stream, write_stream) -> None:
        """会话生命周期：初始化、信号通知、保活、清理。

        session.initialize() 在此处调用，位于嵌套的 async with 上下文内。
        当 HTTP 500 等错误在 anyio 后台任务中发生时，anyio TaskGroup 会在
        async with streamablehttp_client 边界将真实的 McpError 重新抛出，
        而不是停留在 CancelledError，从而让调用方获得准确的错误信息。
        """
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            self.session = session
            logger.debug(f"MCP 服务器 '{self.config.name}' 连接成功")
            if self._init_event:
                self._init_event.set()
            try:
                if self._disconnect_event:
                    await self._disconnect_event.wait()
            finally:
                self.session = None

    def _create_transport_cm(self, client_factory, headers: Dict[str, str], **extra_kwargs):
        """创建传输层 context manager，不支持 headers 参数时降级为无头版本"""
        if headers:
            try:
                return client_factory(self.config.url, headers=headers, **extra_kwargs)
            except TypeError:
                logger.warning(f"{client_factory.__name__} 不支持 headers 参数，使用基础连接")
                return client_factory(self.config.url, **extra_kwargs)
        return client_factory(self.config.url, **extra_kwargs)

    # ------------------------------------------------------------------ #
    # 辅助方法                                                             #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _unwrap_exception_group(exc: BaseException) -> BaseException:
        """拆包 anyio/Python 3.11 的 ExceptionGroup，提取内部真实异常。

        anyio TaskGroup 在背景任务失败时会将异常包装成 ExceptionGroup。
        当组内只有一个子异常时，直接返回该子异常；有多个时保持原样。
        """
        while True:
            if type(exc).__name__ in ("ExceptionGroup", "BaseExceptionGroup"):
                inner = getattr(exc, "exceptions", None)
                if inner and len(inner) == 1:
                    exc = inner[0]
                    continue
            break
        return exc

    @staticmethod
    def _format_error(exc: BaseException) -> str:
        """格式化异常为人类可读的字符串。

        对 httpx.HTTPStatusError 额外提取响应体，使错误信息包含服务器返回的具体原因。
        """
        response = getattr(exc, "response", None)
        if response is not None:
            try:
                body = response.json()
                first_line = str(exc).split("\n")[0]
                # HTTP 4xx/5xx 是服务器端配置错误，明确告知 LLM 不要在客户端做修复尝试
                hint = (
                    "(This error originates from the remote MCP server and indicates a "
                    "server-side configuration issue. Inform the user to fix the MCP server "
                    "configuration directly. Do not attempt to resolve this by setting local "
                    "environment variables.)"
                )
                return f"{type(exc).__name__}: {first_line} | body: {body} {hint}"
            except Exception:
                try:
                    text = response.text
                    if text:
                        first_line = str(exc).split("\n")[0]
                        hint = (
                            "(This error originates from the remote MCP server and indicates a "
                            "server-side configuration issue. Inform the user to fix the MCP server "
                            "configuration directly. Do not attempt to resolve this by setting local "
                            "environment variables.)"
                        )
                        return f"{type(exc).__name__}: {first_line} | body: {text[:300]} {hint}"
                except Exception:
                    pass
        return f"{type(exc).__name__}: {exc}"

    def _prepare_headers(self) -> Dict[str, str]:
        """准备 HTTP 认证头，token 优先级高于自定义 headers"""
        headers: Dict[str, str] = {}
        if self.config.headers:
            headers.update(self.config.headers)
        if self.config.token:
            headers["Authorization"] = f"Bearer {self.config.token}"
        return headers

    def _should_try_sse_fallback(self, error: BaseException) -> bool:
        """判断是否应尝试 SSE 协议回退（仅当服务器明确返回 405 时）"""
        if self.config.type != MCPServerType.HTTP:
            return False
        error_str = str(error)
        return "405" in error_str or "method not allowed" in error_str.lower()

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
