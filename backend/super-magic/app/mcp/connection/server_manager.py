"""MCP 服务器连接池管理

负责管理多个 MCP 服务器的连接生命周期：并发发现、工具注册、调用路由和关闭。
数据模型定义在 tool/models.py，索引管理委托给 SessionIndexManager。
"""

import asyncio
import json
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, TYPE_CHECKING

import anyio
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult

from ..config.models import MCPServerConfig
from ..tool.models import MCPServerResult, MCPToolInfo
from .client import MCPClient
from .session_index import SessionIndexManager

if TYPE_CHECKING:
    from ..tool.mcp_tool import MCPTool

logger = get_logger(__name__)


@dataclass
class ConnectionResult:
    """单个服务器的连接结果（内部使用，不对外暴露）"""
    config: MCPServerConfig
    client: Optional[MCPClient]
    tools: Optional[List[Dict[str, Any]]]
    error: Optional[str]
    duration: float
    label_name: str
    status: str  # "success", "failed", "timeout"


class MCPServerManager:
    """MCP 服务器连接池管理器

    职责边界：
    - 维护 server_name -> MCPClient 的连接映射
    - 并发连接新服务器（discover）
    - 将发现的工具注册到 tool_factory
    - 路由工具调用到对应的服务器客户端
    - 关闭时清理所有连接和注册的工具
    """

    def __init__(
        self,
        server_configs: Dict[str, MCPServerConfig],
        max_retries: int = 1,
        retry_delay: float = 1.0
    ):
        """初始化 MCP 服务器管理器

        Args:
            server_configs: MCP 服务器配置字典 (server_name -> MCPServerConfig)
            max_retries: 单个服务器的最大连接重试次数
            retry_delay: 重试基础延迟时间（秒）
        """
        self.server_configs = server_configs
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.clients: Dict[str, MCPClient] = {}
        self.tools: Dict[str, MCPToolInfo] = {}        # tool_full_name -> MCPToolInfo
        self.session_index_manager = SessionIndexManager()
        self.failed_servers: set[str] = set()

        logger.debug(
            f"初始化 MCP 服务器管理器，配置 {len(self.server_configs)} 个服务器，"
            f"最大重试次数: {max_retries}"
        )

    # ------------------------------------------------------------------ #
    # 查询接口                                                              #
    # ------------------------------------------------------------------ #

    def has_server(self, server_name: str) -> bool:
        return server_name in self.clients

    def get_connected_servers(self) -> List[str]:
        return list(self.clients.keys())

    def get_failed_servers(self) -> List[str]:
        return list(self.failed_servers)

    def clear_failed_servers(self) -> None:
        """清空失败服务器记录，允许下次 discover 重新尝试"""
        cleared = len(self.failed_servers)
        self.failed_servers.clear()
        logger.info(f"已清空 {cleared} 个失败服务器记录")

    def get_server_tools(self, server_name: str) -> List[str]:
        """获取指定服务器的工具原始名称列表（不带前缀）"""
        return [
            info.original_name
            for info in self.tools.values()
            if info.server_name == server_name
        ]

    def get_server_config(self, server_name: str) -> Optional[MCPServerConfig]:
        return self.server_configs.get(server_name)

    def get_tool_info(self, tool_name: str) -> Optional[MCPToolInfo]:
        return self.tools.get(tool_name)

    def get_all_tools(self) -> Dict[str, MCPToolInfo]:
        """获取所有已注册的工具（不触发新的发现）

        调用方应确保在调用此方法前已经执行过 discover()。
        """
        return self.tools.copy()

    def get_full_tool_name(self, server_name: str, original_tool_name: str) -> Optional[str]:
        """根据服务器名称和原始工具名称获取完整工具名称（mcp_{letter}_{name}）"""
        session_letter = self.session_index_manager.get_letter(server_name)
        if not session_letter:
            logger.warning(f"未找到服务器 '{server_name}' 的 session letter")
            return None

        full_name = f"mcp_{session_letter}_{original_tool_name}"
        if full_name not in self.tools:
            logger.warning(f"工具 '{full_name}' 不存在于工具列表中")
            return None
        return full_name

    # ------------------------------------------------------------------ #
    # 生命周期                                                              #
    # ------------------------------------------------------------------ #

    async def add_server(self, server_config: MCPServerConfig) -> bool:
        """添加或更新服务器配置（仅更新配置，不立即连接）

        若同名服务器已连接，先断开旧连接再更新配置。
        需要随后调用 discover() 才会实际建立连接。

        Returns:
            bool: 是否成功更新配置
        """
        if self.has_server(server_config.name):
            logger.info(f"检测到同名服务器 '{server_config.name}' 已连接，先清理旧连接")
            await self.remove_server(server_config.name, remove_config=False)

        is_update = server_config.name in self.server_configs
        self.server_configs[server_config.name] = server_config
        logger.info(f"已{'更新' if is_update else '添加'}服务器配置: {server_config.name}")
        return True

    async def remove_server(self, server_name: str, remove_config: bool = True) -> bool:
        """移除服务器及其注册的工具

        Args:
            server_name: 服务器名称
            remove_config: 是否同时从配置列表中移除，默认 True

        Returns:
            bool: 是否成功移除
        """
        removed = False

        if self.has_server(server_name):
            tools_to_remove = [
                name for name, info in self.tools.items()
                if info.server_name == server_name
            ]
            for tool_name in tools_to_remove:
                self.tools.pop(tool_name, None)

            client = self.clients.pop(server_name, None)
            if client:
                try:
                    await client.disconnect()
                except Exception as e:
                    logger.warning(f"断开服务器 {server_name} 连接失败: {e}")

            self.session_index_manager.release(server_name)
            logger.info(f"已移除 MCP 服务器 '{server_name}' 及其 {len(tools_to_remove)} 个工具")
            removed = True

        if remove_config and server_name in self.server_configs:
            self.server_configs.pop(server_name)
            logger.info(f"已从配置列表中移除服务器: {server_name}")
            removed = True

        if not removed:
            logger.warning(f"服务器 '{server_name}' 不存在（既未连接也不在配置中）")
        return removed

    async def retry_failed_server(self, server_name: str) -> Optional[MCPServerResult]:
        """重试连接指定的失败服务器

        Returns:
            Optional[MCPServerResult]: 重试结果，服务器不在失败列表时返回 None
        """
        if server_name not in self.failed_servers:
            logger.warning(f"服务器 '{server_name}' 不在失败列表中，无需重试")
            return None
        if server_name not in self.server_configs:
            logger.warning(f"服务器 '{server_name}' 不在配置列表中")
            return None

        self.failed_servers.remove(server_name)
        logger.info(f"开始重试连接服务器: {server_name}")

        results = await self.discover()
        for result in results:
            if result.name == server_name:
                return result
        return None

    async def discover(self) -> List[MCPServerResult]:
        """发现并注册所有未连接的 MCP 服务器工具

        每次调用只处理"尚未连接且未标记为失败"的服务器配置，
        已连接的服务器会被跳过。

        Returns:
            List[MCPServerResult]: 本次发现操作涉及的服务器结果列表
        """
        unconnected = [
            config
            for name, config in self.server_configs.items()
            if not self.has_server(name) and name not in self.failed_servers
        ]

        if not unconnected:
            if self.failed_servers:
                logger.debug(
                    f"所有服务器都已连接或失败，失败的服务器: {', '.join(self.failed_servers)}"
                )
            else:
                logger.debug("所有配置的服务器都已连接")
            return []

        logger.debug(f"开始发现 MCP 工具，发现 {len(unconnected)} 个未连接的服务器")

        # 阶段 1：并发连接（不修改共享状态）
        connection_results: List[ConnectionResult] = []
        try:
            async with anyio.create_task_group() as tg:
                for config in unconnected:
                    tg.start_soon(self._connect_server_task, config, connection_results)
        except Exception as e:
            logger.warning(f"MCP 任务组执行过程中出现异常: {type(e).__name__}: {e}")

        # 阶段 2：串行处理结果，修改共享状态
        discovery_results: List[MCPServerResult] = []
        for conn in connection_results:
            result = MCPServerResult(
                name=conn.config.name,
                status=conn.status,
                duration=conn.duration,
                tools=[],
                tool_count=0,
                error=conn.error,
                label_name=conn.label_name,
            )

            if conn.client and conn.tools:
                session_index = self.session_index_manager.allocate(conn.config.name)
                self.clients[conn.config.name] = conn.client
                tool_names = self._register_tools_to_manager(conn.config, conn.tools, session_index)
                result.tools = tool_names
                result.tool_count = len(tool_names)
            else:
                self.failed_servers.add(conn.config.name)
                logger.debug(f"服务器 '{conn.config.name}' 连接失败，已添加到失败列表")

            discovery_results.append(result)

        total = len(self.server_configs)
        rate = len(self.clients) / total * 100 if total > 0 else 0
        logger.info(
            f"MCP 工具发现完成！本次连接 {len(discovery_results)} 个服务器，"
            f"共注册 {len(self.tools)} 个工具，"
            f"成功连接 {len(self.clients)}/{total} 个服务器 ({rate:.1f}%)"
        )

        return discovery_results

    async def shutdown(self) -> None:
        """关闭所有 MCP 连接并清理内部工具索引"""
        logger.debug("开始关闭 MCP 服务器管理器")

        for server_name, client in self.clients.items():
            try:
                await client.disconnect()
            except Exception as e:
                logger.warning(f"关闭 MCP 服务器 {server_name} 连接时出错: {e}")

        self.tools.clear()
        self.clients.clear()
        self.session_index_manager.clear()
        self.failed_servers.clear()

        logger.debug("所有 MCP 连接已关闭，工具已清理")

    # ------------------------------------------------------------------ #
    # 按需连接 / 断开 / 调用                                                 #
    # ------------------------------------------------------------------ #

    async def ensure_server_connected(self, server_name: str) -> MCPServerResult:
        """按需连接指定 MCP 服务器。

        - 若已连接，直接返回成功结果（tools 为当前已注册工具的 original name）
        - 若配置不存在，返回 failed 结果
        - 若配置存在但未连接，尝试建立连接并注册 tools 到 self.tools
          （不再向 tool_factory 挂载，挂载入口已下线）

        失败信息写入 MCPServerResult.error，调用方据此回显给模型。
        """
        label_name = self._get_label_name(server_name)

        if server_name not in self.server_configs:
            return MCPServerResult(
                name=server_name,
                status="failed",
                duration=0.0,
                tools=[],
                tool_count=0,
                error=f"Unknown MCP server: {server_name}",
                label_name=label_name,
            )

        if self.has_server(server_name):
            tool_names = [
                info.original_name
                for info in self.tools.values()
                if info.server_name == server_name
            ]
            return MCPServerResult(
                name=server_name,
                status="success",
                duration=0.0,
                tools=tool_names,
                tool_count=len(tool_names),
                error=None,
                label_name=label_name,
            )

        # 允许重试：按需连接场景不应被历史失败状态永久拦住
        self.failed_servers.discard(server_name)

        config = self.server_configs[server_name]
        conn_results: List[ConnectionResult] = []
        try:
            async with anyio.create_task_group() as tg:
                tg.start_soon(self._connect_server_task, config, conn_results)
        except Exception as e:
            logger.warning(
                f"ensure_server_connected 任务组异常 server={server_name}: {type(e).__name__}: {e}"
            )

        if not conn_results:
            self.failed_servers.add(server_name)
            return MCPServerResult(
                name=server_name,
                status="failed",
                duration=0.0,
                tools=[],
                tool_count=0,
                error="Connection task did not produce a result",
                label_name=label_name,
            )

        conn = conn_results[0]
        result = MCPServerResult(
            name=conn.config.name,
            status=conn.status,
            duration=conn.duration,
            tools=[],
            tool_count=0,
            error=conn.error,
            label_name=conn.label_name or label_name,
        )

        if conn.client and conn.tools:
            session_index = self.session_index_manager.allocate(conn.config.name)
            self.clients[conn.config.name] = conn.client
            tool_names = self._register_tools_to_manager(
                conn.config, conn.tools, session_index
            )
            result.tools = tool_names
            result.tool_count = len(tool_names)
        else:
            self.failed_servers.add(conn.config.name)
            logger.debug(
                f"按需连接 MCP 服务器 '{conn.config.name}' 失败: {conn.error}"
            )

        return result

    async def disconnect_server(self, server_name: str) -> bool:
        """断开指定 MCP 服务器的连接，保留配置。

        清理该服务器在 self.tools 中的条目并释放 session letter。
        已处于未连接状态时返回 False。
        """
        if not self.has_server(server_name):
            return False

        tools_to_remove = [
            name for name, info in self.tools.items()
            if info.server_name == server_name
        ]
        for tool_name in tools_to_remove:
            self.tools.pop(tool_name, None)

        client = self.clients.pop(server_name, None)
        if client:
            try:
                await client.disconnect()
            except Exception as e:
                logger.warning(f"断开服务器 {server_name} 连接失败: {e}")

        self.session_index_manager.release(server_name)
        logger.info(
            f"已断开 MCP 服务器 '{server_name}' 连接（保留配置），清理 {len(tools_to_remove)} 个工具"
        )
        return True

    async def call_tool(
        self,
        server_name: str,
        original_tool_name: str,
        arguments: Dict[str, Any],
    ) -> ToolResult:
        """通过 server_name + original_tool_name 直连调用 MCP 工具。

        不再依赖 mcp_{letter}_ 前缀与 tool_factory 挂载。
        未建立连接时返回 error，由调用方（通常是 /api/sdk/mcp/call）
        自行决定是否先触发 ensure_server_connected。
        """
        client = self.clients.get(server_name)
        if not client:
            return ToolResult.error(
                f"MCP server '{server_name}' is not connected"
            )  # type: ignore

        try:
            raw = await client.call_tool(original_tool_name, arguments)
            return self._parse_tool_result(raw)
        except Exception as e:
            logger.warning(
                f"调用 MCP 工具 '{server_name}.{original_tool_name}' 失败: {e}"
            )
            return ToolResult.error(f"MCP 工具调用失败: {e}")  # type: ignore

    def _get_label_name(self, server_name: str) -> str:
        config = self.server_configs.get(server_name)
        if config and config.server_options and isinstance(config.server_options, dict):
            return config.server_options.get("label_name", "")
        return ""

    # ------------------------------------------------------------------ #
    # 内部：工具注册                                                        #
    # ------------------------------------------------------------------ #

    def _build_mcp_tool(self, tool_info: MCPToolInfo) -> "MCPTool":
        """构建 MCPTool 实例（打断 tool/models.py 与 connection 层的循环依赖）"""
        from ..tool.mcp_tool import MCPTool
        return MCPTool(tool_info.to_dict(), self)

    def _register_tools_to_manager(
        self,
        config: MCPServerConfig,
        tools: List[Dict[str, Any]],
        session_index: int,
    ) -> List[str]:
        """将工具信息注册到 self.tools，返回可用工具的原始名称列表"""
        session_letter = SessionIndexManager.index_to_letter(session_index)
        name_prefix = f"mcp_{session_letter}_"
        desc_prefix = f"MCP server [{config.name}] - "

        available: List[str] = []
        skipped: List[str] = []

        for tool in tools:
            tool_name = name_prefix + tool["name"]
            tool_info = MCPToolInfo(
                name=tool_name,
                original_name=tool["name"],
                description=desc_prefix + tool["description"],
                inputSchema=tool["inputSchema"],
                server_name=config.name,
                session_letter=session_letter,
                server_options=config.server_options,
            )

            mcp_tool = self._build_mcp_tool(tool_info)
            if not mcp_tool.is_available():
                logger.warning(f"跳过不可用的 MCP 工具: {tool_name} (schema 验证失败)")
                skipped.append(tool["name"])
                continue

            self.tools[tool_name] = tool_info
            available.append(tool["name"])

        logger.info(
            f"从 MCP 服务器 '{config.name}' 注册了 {len(available)}/{len(tools)} 个工具到管理器，"
            f"跳过 {len(skipped)} 个不可用工具: {skipped}"
        )
        return available

    # ------------------------------------------------------------------ #
    # 内部：连接任务                                                        #
    # ------------------------------------------------------------------ #

    async def _connect_server_task(
        self,
        config: MCPServerConfig,
        results: List[ConnectionResult],
    ) -> None:
        """并发连接单个服务器的 TaskGroup 任务包装

        只负责连接和获取数据，不修改管理器的共享状态。
        结果追加到 results 列表，由调用方在阶段 2 串行处理。
        """
        start_time = time.time()
        label_name = ""
        if config.server_options and isinstance(config.server_options, dict):
            label_name = config.server_options.get("label_name", "")

        conn = ConnectionResult(
            config=config,
            client=None,
            tools=None,
            error=None,
            duration=0.0,
            label_name=label_name,
            status="failed",
        )

        try:
            await self._connect_server(config, conn)
        except (Exception, asyncio.CancelledError, BaseException) as e:
            error_type = type(e).__name__
            conn.error = f"{error_type}: {e}"
            conn.status = "failed"
            logger.warning(f"连接 MCP 服务器 '{config.name}' 时出现 {error_type}: {e}")

            if "cancel scope" in str(e).lower():
                logger.warning(
                    f"检测到 cancel scope 冲突，服务器 '{config.name}' 连接失败但不影响其他服务器"
                )
        finally:
            conn.duration = time.time() - start_time
            results.append(conn)  # list.append 在 CPython 中是原子操作

    async def _connect_server(
        self,
        config: MCPServerConfig,
        result: ConnectionResult,
    ) -> None:
        """尝试连接单个服务器并获取工具列表，结果写入 result"""
        client = MCPClient(config, max_retries=self.max_retries, retry_delay=self.retry_delay)
        connection_success = False

        try:
            timeout = 30.0 + (self.max_retries * 10.0)
            try:
                connected = await asyncio.wait_for(client.connect(), timeout=timeout)
                if connected:
                    logger.debug(f"成功连接到 MCP 服务器: {config.name}")
                    tools = await asyncio.wait_for(client.list_tools(), timeout=20.0)
                    result.client = client
                    result.tools = tools
                    result.status = "success"
                    connection_success = True
                else:
                    result.error = "连接失败"
                    logger.warning(f"无法连接到 MCP 服务器: {config.name}")
            except asyncio.TimeoutError:
                result.error = f"连接超时 ({timeout}s)"
                result.status = "timeout"
                logger.warning(f"连接 MCP 服务器 {config.name} 超时 (包括重试)")

        except Exception as e:
            result.error = f"{type(e).__name__}: {e}"
            logger.warning(f"处理 MCP 服务器 {config.name} 时出错: {type(e).__name__}: {e}")
        finally:
            if not connection_success:
                await client.disconnect()

    # ------------------------------------------------------------------ #
    # 内部：结果解析                                                        #
    # ------------------------------------------------------------------ #

    def _parse_tool_result(self, raw: Any) -> ToolResult:
        """将 MCP SDK 原始结果解析为 ToolResult

        处理 TextContent 对象和字典格式，对多个 JSON 对象结果进行合并。
        区分业务逻辑错误（返回给 LLM 处理）和系统错误（返回 error 状态）。
        """
        if not isinstance(raw, dict):
            return ToolResult(content=str(raw))

        content = raw.get("content", [])
        is_error = raw.get("isError", False)

        if is_error:
            error_msg = self._extract_text_content(content) or "MCP 工具执行失败"
            if self._is_system_error(error_msg):
                return ToolResult.error(error_msg)  # type: ignore
            # 业务逻辑错误作为正常内容返回给 LLM
            return ToolResult(content=error_msg)

        if isinstance(content, list) and content:
            text_contents = self._collect_text_items(content)
            merged = self._merge_text_contents(text_contents)
            return ToolResult(content=merged or str(raw))

        return ToolResult(content=str(raw))

    def _extract_text_content(self, content: Any) -> str:
        """从 content 列表中提取文本内容并拼接"""
        if not isinstance(content, list):
            return str(content) if content else ""
        texts = []
        for item in content:
            if hasattr(item, 'text'):
                texts.append(item.text)
            elif isinstance(item, dict) and item.get("type") == "text":
                texts.append(item.get("text", ""))
        return "\n".join(texts)

    def _collect_text_items(self, content: list) -> List[str]:
        """收集 content 列表中所有 text 类型的文本"""
        texts = []
        for item in content:
            if hasattr(item, 'text') and hasattr(item, 'type') and item.type == "text":
                texts.append(item.text)
            elif isinstance(item, dict) and item.get("type") == "text":
                texts.append(item.get("text", ""))
        return texts

    def _merge_text_contents(self, text_contents: List[str]) -> str:
        """尝试将多个 text 项合并为 JSON 数组，否则换行拼接"""
        decoded: List[Dict[str, Any]] = []
        all_json_objects = True

        for t in text_contents:
            if not t:
                continue
            try:
                obj = json.loads(t)
                if isinstance(obj, dict):
                    decoded.append(obj)
                else:
                    all_json_objects = False
                    break
            except (json.JSONDecodeError, TypeError):
                all_json_objects = False
                break

        if all_json_objects and decoded:
            return json.dumps(decoded, ensure_ascii=False)
        return "\n".join(text_contents)

    def _is_system_error(self, error_msg: str) -> bool:
        """判断是否为系统级错误（网络、协议、服务器内部错误等）

        系统错误应返回 ToolResult.error，业务逻辑错误应返回给 LLM 处理。
        """
        lower = error_msg.lower()
        indicators = [
            "connection", "network", "timeout", "unreachable", "dns",
            "socket", "ssl", "tls", "certificate", "handshake",
            "500", "502", "503", "504", "internal server error",
            "bad gateway", "service unavailable", "gateway timeout",
            "system error", "server error", "fatal error", "crash",
            "out of memory", "disk full", "permission denied",
            "mcp protocol", "session", "transport", "stream",
            "jsonrpc", "protocol error", "parse error",
        ]
        return any(ind in lower for ind in indicators)
