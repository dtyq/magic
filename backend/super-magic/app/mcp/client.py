"""MCP 客户端实现

基于官方 MCP Python SDK 的客户端封装，支持 HTTP/SSE 和 Stdio 两种连接方式。
"""

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from typing import Dict, List, Optional, Any, Tuple
import asyncio
import time
import random

from agentlang.logger import get_logger
from .server_config import MCPServerConfig, MCPServerType

logger = get_logger(__name__)

# 连接清理超时时间（秒）
CONNECTION_CLEANUP_TIMEOUT = 2.0


class MCPClient:
    """基于官方 SDK 的 MCP 客户端封装

    提供统一的接口来连接不同类型的 MCP 服务器，支持工具列表获取、工具调用和健康检查。
    """

    def __init__(self, config: MCPServerConfig, max_retries: int = 1, retry_delay: float = 1.0):
        """初始化 MCP 客户端

        Args:
            config: MCP 服务器配置
            max_retries: 最大重试次数
            retry_delay: 重试基础延迟时间（秒）
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
                # 验证配置
                self.config.validate_config()

                # 根据类型建立传输层连接
                if self.config.type == MCPServerType.HTTP:
                    success = await self._connect_http()
                elif self.config.type == MCPServerType.STDIO:
                    success = await self._connect_stdio()
                else:
                    logger.warning(f"不支持的 MCP 服务器类型: {self.config.type}")
                    return False

                if not success:
                    logger.warning(f"传输层连接失败: {self.config.name}")
                    if attempt < self.max_retries:
                        await self._wait_before_retry(attempt)
                        continue
                    return False

                # 创建会话并初始化
                session_result = await self._create_session()
                if session_result:
                    return True

                if attempt < self.max_retries:
                    await self._wait_before_retry(attempt)
                    continue
                return False

            except Exception as e:
                logger.warning(f"连接 MCP 服务器 '{self.config.name}' 失败 (尝试 {attempt + 1}/{self.max_retries + 1}): {type(e).__name__}: {e}")
                await self._cleanup_on_error()

                if attempt < self.max_retries and self._is_retryable_error(e):
                    await self._wait_before_retry(attempt)
                    continue
                else:
                    return False

        return False

    def _is_retryable_error(self, error: Exception) -> bool:
        """判断错误是否可重试

        Args:
            error: 异常对象

        Returns:
            bool: 是否可重试
        """
        error_str = str(error).lower()
        error_type = type(error).__name__

        # 可重试的错误类型
        retryable_indicators = [
            # 网络相关错误
            "timeout" in error_str,
            "connection" in error_str,
            "network" in error_str,
            "unreachable" in error_str,

            # npm 相关错误
            "npm error" in error_str,
            "idletimeout" in error_str,
            "sigterm" in error_str,
            "process terminated" in error_str,

            # 临时性错误
            "temporary" in error_str,
            "503" in error_str,
            "502" in error_str,
            "504" in error_str,

            # 异步相关错误
            error_type == "TimeoutError",
            error_type == "asyncio.TimeoutError",
            error_type == "ConnectionError",
            error_type == "OSError",
        ]

        return any(retryable_indicators)

    async def _wait_before_retry(self, attempt: int) -> None:
        """在重试前等待（使用指数退避）

        Args:
            attempt: 当前尝试次数（从0开始）
        """
        # 指数退避：基础延迟 * (2 ^ attempt) + 随机抖动
        delay = self.retry_delay * (2 ** attempt) + random.uniform(0, 1)
        logger.debug(f"等待 {delay:.2f} 秒后重试连接 MCP 服务器 '{self.config.name}'...")
        await asyncio.sleep(delay)

    async def _connect_http(self) -> bool:
        """建立 HTTP 连接

        Returns:
            bool: 传输层连接是否成功
        """
        if not self.config.url:
            raise ValueError("HTTP 服务器 URL 不能为空")

        headers = self._prepare_headers()

        # 先尝试 Streamable HTTP
        streamable_success, streamable_error = await self._try_streamable_http(headers)
        if streamable_success:
            return True

        # 回退到 SSE
        sse_success, sse_error = await self._try_sse(headers)
        if sse_success:
            return True

        # 两种方式都失败
        error_msg = f"无法建立 HTTP 连接 (Streamable: {streamable_error}, SSE: {sse_error})"
        raise RuntimeError(error_msg)

    async def _connect_stdio(self) -> bool:
        """建立 Stdio 连接（带重试逻辑）

        Returns:
            bool: 传输层连接是否成功
        """
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
            # 清理失败的连接
            await self._cleanup_transport()
            return False

    def _prepare_headers(self) -> Dict[str, str]:
        """准备 HTTP 认证头

        Returns:
            Dict[str, str]: 认证头字典
        """
        headers = {}

        # 先添加配置文件中的自定义 headers
        if self.config.headers:
            headers.update(self.config.headers)
            logger.debug(f"添加自定义 HTTP 头: {list(self.config.headers.keys())}")

        # 再添加 token 认证头（如果存在），可能会覆盖自定义 headers 中的 Authorization
        if self.config.token:
            headers["Authorization"] = f"Bearer {self.config.token}"
            logger.debug("添加 token 认证头")

        return headers

    async def _try_streamable_http(self, headers: Dict[str, str]) -> Tuple[bool, Optional[Exception]]:
        """尝试 Streamable HTTP 连接

        Args:
            headers: HTTP 头

        Returns:
            Tuple[bool, Optional[Exception]]: (是否成功, 错误信息)
        """
        try:
            from mcp.client.streamable_http import streamablehttp_client

            # 创建传输层连接
            self._transport_context = self._create_transport_client(streamablehttp_client, headers)
            self._read_stream, self._write_stream, _ = await self._transport_context.__aenter__()

            return True, None

        except Exception as e:
            await self._cleanup_transport()
            return False, e

    async def _try_sse(self, headers: Dict[str, str]) -> Tuple[bool, Optional[Exception]]:
        """尝试 SSE 连接

        Args:
            headers: HTTP 头

        Returns:
            Tuple[bool, Optional[Exception]]: (是否成功, 错误信息)
        """
        try:
            from mcp.client.sse import sse_client

            # 创建传输层连接
            self._transport_context = self._create_transport_client(sse_client, headers)
            self._read_stream, self._write_stream = await self._transport_context.__aenter__()

            return True, None

        except Exception as e:
            await self._cleanup_transport()
            return False, e

    def _create_transport_client(self, client_factory, headers: Dict[str, str]):
        """创建传输层客户端

        Args:
            client_factory: 客户端工厂函数
            headers: HTTP 头

        Returns:
            传输层客户端
        """
        if headers:
            try:
                return client_factory(self.config.url, headers=headers)
            except TypeError:
                logger.warning(f"{client_factory.__name__} 不支持 headers 参数，使用基础连接")
                return client_factory(self.config.url)
        else:
            return client_factory(self.config.url)

    async def _create_session(self) -> bool:
        """创建 MCP 会话并初始化

        Returns:
            bool: 会话创建是否成功
        """
        if not self._read_stream or not self._write_stream:
            raise RuntimeError("传输流创建失败")

        try:
            # 创建会话
            self.session = ClientSession(self._read_stream, self._write_stream)
            await self.session.__aenter__()

            # 初始化会话
            await self.session.initialize()

            logger.debug(f"MCP 服务器 '{self.config.name}' 连接成功")
            return True

        except (Exception, asyncio.CancelledError) as init_error:
            # 尝试 SSE 回退（仅对 HTTP 连接）
            if self._should_try_sse_fallback(init_error):
                logger.debug(f"检测到协议不匹配，回退到 SSE 连接: {self.config.name}")
                try:
                    fallback_result = await self._try_sse_fallback(init_error)
                    return fallback_result
                except Exception as fallback_error:
                    logger.warning(f"SSE 回退失败: {type(fallback_error).__name__}: {fallback_error}")
                    await self._cleanup_on_error()
                    return False
            else:
                await self._cleanup_on_error()
                return False

    def _should_try_sse_fallback(self, error: BaseException) -> bool:
        """判断是否应该尝试 SSE 回退

        Args:
            error: 初始化错误

        Returns:
            bool: 是否应该回退
        """
        if self.config.type != MCPServerType.HTTP:
            return False

        error_str = str(error)
        error_type = type(error).__name__

        # anyio cancel scope 冲突不是协议协商失败，强行 SSE 回退只会在紊乱的
        # cancel scope 环境中创建更多 zombie，导致 TaskGroup 异常
        if "cancel scope" in error_str.lower():
            return False

        # 检查常见的需要回退的错误条件
        fallback_indicators = [
            "405" in error_str,
            "Method Not Allowed" in error_str,
            "streamablehttp" in error_type.lower(),
            "HTTPStatusError" in error_type,
            "McpError" in error_type,
            "Session terminated" in error_str,
            "session initialization failed" in error_str.lower(),
            "CancelledError" in error_type
        ]

        return any(fallback_indicators)

    async def _try_sse_fallback(self, original_error: BaseException) -> bool:
        """尝试 SSE 回退

        Args:
            original_error: 原始错误

        Returns:
            bool: 回退是否成功
        """
        try:
            # 清理当前失败的连接
            await self._cleanup_on_error_synchronous()

            # 重新建立 SSE 连接
            headers = self._prepare_headers()

            sse_success, sse_error = await self._try_sse(headers)

            if not sse_success:
                raise RuntimeError(f"SSE 回退失败: {sse_error}")

            # 重新创建会话
            session_result = await self._create_session_without_fallback()
            return session_result

        except Exception as fallback_error:
            error_msg = (f"无法建立 MCP 连接到 '{self.config.name}' "
                        f"(原始错误: {type(original_error).__name__}: {original_error}, "
                        f"SSE回退错误: {type(fallback_error).__name__}: {fallback_error})")
            raise RuntimeError(error_msg)

    async def _create_session_without_fallback(self) -> bool:
        """创建会话（不进行回退尝试）

        Returns:
            bool: 会话创建是否成功
        """
        if not self._read_stream or not self._write_stream:
            raise RuntimeError("传输流创建失败")

        try:
            # 创建会话
            self.session = ClientSession(self._read_stream, self._write_stream)
            await self.session.__aenter__()

            # 初始化会话
            await self.session.initialize()

            logger.debug(f"MCP 服务器 '{self.config.name}' 通过 SSE 回退连接成功")
            return True

        except (Exception, asyncio.CancelledError) as e:
            # 在 SSE 回退期间，如果仍然失败，不要再次尝试回退
            logger.warning(f"SSE 回退期间会话初始化失败: {type(e).__name__}: {e}")

            # 清理失败的会话
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

            # 抛出异常，让上层处理
            raise RuntimeError(f"SSE 回退期间会话初始化失败: {e}")

    async def _cleanup_transport(self) -> None:
        """清理传输层连接"""
        if self._transport_context:
            try:
                # 添加超时，避免长时间阻塞
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

    async def disconnect(self) -> None:
        """断开连接"""
        cancel_scope_conflict = False
        try:
            if self.session:
                try:
                    # 添加超时，避免长时间阻塞
                    await asyncio.wait_for(
                        self.session.__aexit__(None, None, None),
                        timeout=CONNECTION_CLEANUP_TIMEOUT
                    )
                except asyncio.TimeoutError:
                    logger.warning(f"MCP 会话关闭超时: {self.config.name}")
                except asyncio.CancelledError:
                    logger.debug(f"MCP 会话关闭被取消: {self.config.name}")
                except Exception as e:
                    logger.warning(f"关闭 MCP 会话时出错: {self.config.name}: {e}")
                    # 跨 task 调用 __aexit__ 会触发 anyio cancel scope 冲突，
                    # transport 与 session 共享相同的 zombie 状态，后续不能再调 __aexit__
                    if "cancel scope" in str(e).lower():
                        cancel_scope_conflict = True
                finally:
                    self.session = None

            if cancel_scope_conflict:
                # 直接丢弃引用，避免对 zombie transport context 再次调用 __aexit__
                # zombie 的后台 task 会自行超时结束，不会影响主流程
                self._transport_context = None
                self._read_stream = None
                self._write_stream = None
            else:
                await self._cleanup_transport()

            logger.info(f"MCP 服务器 '{self.config.name}' 连接已断开")

        except Exception as e:
            logger.warning(f"断开 MCP 服务器 '{self.config.name}' 连接时出错: {e}")

    async def list_tools(self) -> List[Dict[str, Any]]:
        """列出可用工具

        Returns:
            List[Dict[str, Any]]: 工具列表

        Raises:
            RuntimeError: 当未连接到服务器时
        """
        if not self.session:
            raise RuntimeError(f"未连接到 MCP 服务器 '{self.config.name}'")

        try:
            result = await self.session.list_tools()
            tools = []

            for tool in result.tools:
                # 检查工具是否在允许列表中
                if self.config.allowed_tools and tool.name not in self.config.allowed_tools:
                    continue

                tool_info = {
                    "name": tool.name,
                    "description": tool.description or "",
                    "inputSchema": tool.inputSchema or {}
                }
                tools.append(tool_info)

            logger.debug(f"从 MCP 服务器 '{self.config.name}' 获取到 {len(tools)} 个工具")
            return tools

        except Exception as e:
            logger.warning(f"从 MCP 服务器 '{self.config.name}' 获取工具列表失败: {e}")
            raise

    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """调用工具（带自动重连）

        Args:
            name: 工具名称
            arguments: 工具参数

        Returns:
            Dict[str, Any]: 工具调用结果，包含 content 和 isError 字段
        """
        # 检查连接状态，如果未连接或连接失效则尝试重连
        if not self.session or not await self.ping():
            logger.warning(f"MCP 服务器 '{self.config.name}' 连接失效，尝试重连")

            # 先清理旧连接
            await self.disconnect()

            # 尝试重连
            if not await self.connect():
                error_msg = f"无法连接到 MCP 服务器 '{self.config.name}'"
                logger.error(error_msg)
                return {
                    "content": [{"type": "text", "text": error_msg}],
                    "isError": True
                }

            logger.info(f"成功重连到 MCP 服务器 '{self.config.name}'")

        try:
            result = await self.session.call_tool(name, arguments)

            # 构建返回结果
            response = {
                "content": result.content if hasattr(result, 'content') else [],
                "isError": result.isError if hasattr(result, 'isError') else False
            }

            return response

        except Exception as e:
            logger.warning(f"调用 MCP 工具 '{name}' 失败: {e}")
            # 返回错误结果而不是抛出异常，让上层的错误分类逻辑来处理
            return {
                "content": [{"type": "text", "text": str(e)}],
                "isError": True
            }

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

    async def _cleanup_on_error(self) -> None:
        """错误时清理资源"""
        try:
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

            # 重置流引用
            self._read_stream = None
            self._write_stream = None

        except Exception as e:
            logger.warning(f"清理资源时出错: {e}")
            # 确保即使清理失败也重置所有引用
            self.session = None
            self._transport_context = None
            self._read_stream = None
            self._write_stream = None

    async def _cleanup_on_error_synchronous(self) -> None:
        """错误时清理资源（同步版本，避免跨task的异步上下文管理器问题）"""
        try:
            # 首先重置所有引用，避免在清理过程中出现状态不一致
            session = self.session
            transport_context = self._transport_context

            # 立即重置引用
            self.session = None
            self._transport_context = None
            self._read_stream = None
            self._write_stream = None

            # 然后尝试清理，但不让清理失败影响状态重置
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

        except Exception as e:
            logger.warning(f"同步清理资源时出错: {e} - {self.config.name}")
            # 确保即使清理失败也重置所有引用
            self.session = None
            self._transport_context = None
            self._read_stream = None
            self._write_stream = None

    async def __aenter__(self) -> 'MCPClient':
        """异步上下文管理器入口"""
        if await self.connect():
            return self
        else:
            raise RuntimeError(f"无法连接到 MCP 服务器 '{self.config.name}'")

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """异步上下文管理器出口"""
        await self.disconnect()

    def __str__(self) -> str:
        """字符串表示"""
        status = "已连接" if self.session else "未连接"
        return f"MCPClient(server='{self.config.name}', type={self.config.type.value}, status={status})"
