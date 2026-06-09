"""MCP 服务器连接管理

负责管理多个 MCP 服务器的连接生命周期：按需连接、工具注册、调用路由和关闭。
数据模型定义在 tool/models.py。
"""

import asyncio
import json
import time
from typing import Any, Dict, List, Optional

from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult

from ..config.env_resolver import MCPEnvResolutionError, MCPEnvVarResolver, redact_config_values
from ..config.models import MCPServerConfig
from ..tool.models import MCPServerResult, MCPToolInfo, UnavailableToolInfo
from ..tool.schema_validator import validate_mcp_schema
from .client import MCPClient

logger = get_logger(__name__)


class MCPServerManager:
    """MCP 服务器连接管理器

    职责边界：
    - 维护 server_name -> MCPClient 的连接映射
    - 按需连接服务器并注册工具
    - 路由工具调用到对应的服务器客户端
    - 关闭时清理所有连接和注册的工具
    """

    # 连接重试配置
    MAX_RETRIES: int = 1
    RETRY_DELAY: float = 1.0

    def __init__(self):
        self.server_configs: Dict[str, MCPServerConfig] = {}
        self.clients: Dict[str, MCPClient] = {}
        self.tools: Dict[str, List[MCPToolInfo]] = {}  # server_name → 可用工具列表
        self.unavailable_tools: Dict[str, List[UnavailableToolInfo]] = {}  # server_name → 不可用工具列表

        logger.debug("初始化 MCP 服务器管理器")

    # ------------------------------------------------------------------ #
    # 查询接口                                                              #
    # ------------------------------------------------------------------ #

    def has_server(self, server_name: str) -> bool:
        return server_name in self.clients

    def get_connected_servers(self) -> List[str]:
        return list(self.clients.keys())

    def get_server_tools(self, server_name: str) -> List[MCPToolInfo]:
        """获取指定服务器的可用工具信息列表"""
        return self.tools.get(server_name, [])

    def get_unavailable_tools(self, server_name: str) -> List[UnavailableToolInfo]:
        """获取指定服务器的不可用工具列表"""
        return self.unavailable_tools.get(server_name, [])

    def get_server_config(self, server_name: str) -> Optional[MCPServerConfig]:
        return self.server_configs.get(server_name)

    # ------------------------------------------------------------------ #
    # 生命周期                                                              #
    # ------------------------------------------------------------------ #

    async def add_server(self, server_config: MCPServerConfig, connect: bool = True) -> Optional[MCPServerResult]:
        """添加或更新服务器配置

        若同名服务器已连接，先断开旧连接再更新配置。

        Args:
            server_config: 服务器配置
            connect: 是否立即建立连接并发现工具，默认 True

        Returns:
            连接结果（connect=True 时），或 None（connect=False 时）
        """
        if self.has_server(server_config.name):
            logger.info(f"检测到同名服务器 '{server_config.name}' 已连接，先清理旧连接")
            await self.remove_server(server_config.name, remove_config=False)

        is_update = server_config.name in self.server_configs
        self.server_configs[server_config.name] = server_config
        logger.info(f"已{'更新' if is_update else '添加'}服务器配置: {server_config.name}")

        if connect:
            return await self.ensure_server_connected(server_config.name)
        return None

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
            await self.disconnect_server(server_name)
            removed = True

        if remove_config and server_name in self.server_configs:
            self.server_configs.pop(server_name)
            logger.info(f"已从配置列表中移除服务器: {server_name}")
            removed = True

        if not removed:
            logger.warning(f"服务器 '{server_name}' 不存在（既未连接也不在配置中）")
        return removed

    async def shutdown(self) -> None:
        """关闭所有 MCP 连接并清理内部工具索引"""
        logger.debug("开始关闭 MCP 服务器管理器")

        for server_name, client in self.clients.items():
            try:
                await client.disconnect()
            except Exception as e:
                logger.warning(f"关闭 MCP 服务器 {server_name} 连接时出错: {e}")

        self.tools.clear()
        self.unavailable_tools.clear()
        self.clients.clear()

        logger.debug("所有 MCP 连接已关闭，工具已清理")

    # ------------------------------------------------------------------ #
    # 按需连接 / 断开 / 调用                                                 #
    # ------------------------------------------------------------------ #

    async def ensure_server_connected(self, server_name: str) -> MCPServerResult:
        """按需连接指定 MCP 服务器。

        - 若已连接，直接返回成功结果（tools 为当前已注册工具的 original name）
        - 若配置不存在，返回 failed 结果
        - 若配置存在但未连接，尝试建立连接并注册 tools 到 self.tools

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
            tool_names = [info.original_name for info in self.tools.get(server_name, [])]
            return MCPServerResult(
                name=server_name,
                status="success",
                duration=0.0,
                tools=tool_names,
                tool_count=len(tool_names),
                error=None,
                label_name=label_name,
            )

        config = self.server_configs[server_name]
        start_time = time.time()

        try:
            resolved_config = MCPEnvVarResolver().resolve_config(config)
        except MCPEnvResolutionError as e:
            return MCPServerResult(
                name=server_name,
                status="failed",
                duration=time.time() - start_time,
                tools=[],
                tool_count=0,
                error=str(e),
                label_name=label_name,
            )

        client = MCPClient(resolved_config, max_retries=self.MAX_RETRIES, retry_delay=self.RETRY_DELAY)
        timeout = 30.0 + (self.MAX_RETRIES * 10.0)
        try:
            connected = await asyncio.wait_for(client.connect(), timeout=timeout)
            if not connected:
                error_detail = client.last_error or "Connection failed"
                await client.disconnect()
                return MCPServerResult(
                    name=server_name,
                    status="failed",
                    duration=time.time() - start_time,
                    tools=[],
                    tool_count=0,
                    error=f"Connection failed: {error_detail}",
                    label_name=label_name,
                )

            tools_raw = await asyncio.wait_for(client.list_tools(), timeout=20.0)
        except asyncio.TimeoutError:
            await client.disconnect()
            return MCPServerResult(
                name=server_name,
                status="timeout",
                duration=time.time() - start_time,
                tools=[],
                tool_count=0,
                error=f"Connection timeout ({timeout}s)",
                label_name=label_name,
            )
        except asyncio.CancelledError:
            error_detail = client.last_error or "connection was cancelled"
            try:
                await client.disconnect()
            except (Exception, asyncio.CancelledError):
                pass
            return MCPServerResult(
                name=server_name,
                status="failed",
                duration=time.time() - start_time,
                tools=[],
                tool_count=0,
                error=f"CancelledError: {error_detail}",
                label_name=label_name,
            )
        except Exception as e:
            await client.disconnect()
            error_detail = redact_config_values(resolved_config, f"{type(e).__name__}: {e}")
            return MCPServerResult(
                name=server_name,
                status="failed",
                duration=time.time() - start_time,
                tools=[],
                tool_count=0,
                error=error_detail,
                label_name=label_name,
            )

        self.clients[server_name] = client
        tool_names = self._register_tools_to_manager(config, tools_raw)

        return MCPServerResult(
            name=server_name,
            status="success",
            duration=time.time() - start_time,
            tools=tool_names,
            tool_count=len(tool_names),
            error=None,
            label_name=label_name,
        )

    async def disconnect_server(self, server_name: str) -> bool:
        """断开指定 MCP 服务器的连接，保留配置。

        清理该服务器在 self.tools 中的条目。
        已处于未连接状态时返回 False。
        """
        if not self.has_server(server_name):
            return False

        removed_tools = self.tools.pop(server_name, [])
        self.unavailable_tools.pop(server_name, None)

        client = self.clients.pop(server_name, None)
        if client:
            try:
                await client.disconnect()
            except Exception as e:
                logger.warning(f"断开服务器 {server_name} 连接失败: {e}")

        logger.info(
            f"已断开 MCP 服务器 '{server_name}' 连接（保留配置），清理 {len(removed_tools)} 个工具"
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
        未建立连接时返回 error，由调用方（通常是 app/tools/mcp/call_tool）
        自行决定是否先触发 ensure_server_connected。
        """
        client = self.clients.get(server_name)
        if not client:
            return ToolResult.error(
                f"MCP server '{server_name}' is not connected"
            )  # type: ignore

        # 检查工具是否在不可用列表中
        for info in self.unavailable_tools.get(server_name, []):
            if info.name == original_tool_name:
                return ToolResult.error(
                    f"Tool '{original_tool_name}' on server '{server_name}' is unavailable: {info.error}"
                )  # type: ignore

        try:
            raw = await client.call_tool(original_tool_name, arguments)
            return self._parse_tool_result(raw)
        except Exception as e:
            error_text = redact_config_values(client.config, str(e))
            logger.warning(
                f"调用 MCP 工具 '{server_name}.{original_tool_name}' 失败: {error_text}"
            )
            return ToolResult.error(f"MCP 工具调用失败: {error_text}")  # type: ignore

    def _get_label_name(self, server_name: str) -> str:
        config = self.server_configs.get(server_name)
        if config and config.server_options and isinstance(config.server_options, dict):
            return config.server_options.get("label_name", "")
        return ""

    # ------------------------------------------------------------------ #
    # 内部：工具注册                                                        #
    # ------------------------------------------------------------------ #

    def _register_tools_to_manager(
        self,
        config: MCPServerConfig,
        tools: List[Dict[str, Any]],
    ) -> List[str]:
        """将工具信息注册到 self.tools，返回可用工具的原始名称列表"""
        desc_prefix = f"MCP server [{config.name}] - "

        available: List[str] = []
        registered: List[MCPToolInfo] = []
        unavailable: List[UnavailableToolInfo] = []

        for tool in tools:
            tool_name = tool["name"]
            input_schema = tool.get("inputSchema", {})
            is_valid, error = validate_mcp_schema(input_schema, tool_name)
            if not is_valid:
                reason = error or "Schema validation failed"
                logger.warning(f"跳过不可用的 MCP 工具: {config.name}/{tool_name} ({reason})")
                unavailable.append(UnavailableToolInfo(
                    name=tool_name,
                    server_name=config.name,
                    description=tool.get("description", ""),
                    error=reason,
                ))
                continue

            tool_info = MCPToolInfo(
                name=tool_name,
                original_name=tool_name,
                description=desc_prefix + tool["description"],
                inputSchema=input_schema,
                server_name=config.name,
                server_options=config.server_options,
            )
            registered.append(tool_info)
            available.append(tool_name)

        self.tools[config.name] = registered
        self.unavailable_tools[config.name] = unavailable

        logger.info(
            f"从 MCP 服务器 '{config.name}' 注册了 {len(available)}/{len(tools)} 个工具到管理器"
            + (f"，{len(unavailable)} 个工具不可用" if unavailable else "")
        )
        return available

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
