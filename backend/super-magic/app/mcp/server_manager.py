"""MCP 服务器管理器

参考 Odin 框架设计，提供统一的 MCP 服务器管理功能。
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
import asyncio
import json
import time
import anyio
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.tools.core.tool_factory import tool_factory
from .client import MCPClient
from .mcp_tool import MCPTool
from .server_config import MCPServerConfig

logger = get_logger(__name__)


@dataclass
class ServerDiscoveryResult:
    """服务器发现结果"""
    name: str
    status: str  # "success", "failed", "timeout"
    duration: float
    tools: List[str]
    tool_count: int
    error: Optional[str] = None
    label_name: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return asdict(self)


@dataclass
class ConnectionResult:
    """单个服务器的连接结果（内部使用）"""
    config: MCPServerConfig
    client: Optional[MCPClient]
    tools: Optional[List[Dict[str, Any]]]
    error: Optional[str]
    duration: float
    label_name: str
    status: str  # "success", "failed", "timeout"


@dataclass
class MCPToolInfo:
    """MCP 工具信息"""
    name: str  # 完整工具名称（带前缀，如 mcp_a_tool1）
    original_name: str  # 原始工具名称（不带前缀）
    description: str  # 工具描述
    inputSchema: Dict[str, Any]  # 输入参数 schema
    server_name: str  # 所属服务器名称
    session_letter: str  # 会话字母标识
    server_options: Optional[Dict[str, Any]] = None  # 服务器选项

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return asdict(self)

    def to_mcp_tool(self, manager: 'MCPServerManager') -> 'MCPTool':
        """转换为 MCPTool 对象

        Args:
            manager: MCPServerManager 实例

        Returns:
            MCPTool: MCP 工具对象
        """
        from .mcp_tool import MCPTool
        return MCPTool(self.to_dict(), manager)


class SessionIndexManager:
    """管理服务器 session 索引的分配和回收"""

    def __init__(self):
        """初始化 session 索引管理器"""
        self.server_indices: Dict[str, int] = {}  # server_name -> index
        self.free_indices: List[int] = []  # 空闲的索引列表

    def allocate(self, server_name: str) -> int:
        """为服务器分配 session 索引

        Args:
            server_name: 服务器名称

        Returns:
            int: 分配的索引
        """
        # 如果服务器已存在，返回现有索引
        if server_name in self.server_indices:
            return self.server_indices[server_name]

        # 优先使用空闲位置
        if self.free_indices:
            index = self.free_indices.pop(0)
        else:
            # 否则使用最大值+1
            if self.server_indices:
                index = max(self.server_indices.values()) + 1
            else:
                index = 0

        self.server_indices[server_name] = index
        return index

    def release(self, server_name: str) -> bool:
        """释放服务器的 session 索引

        Args:
            server_name: 服务器名称

        Returns:
            bool: 是否成功释放
        """
        if server_name not in self.server_indices:
            return False

        index = self.server_indices.pop(server_name)
        # 将索引加入空闲列表，保持有序
        self.free_indices.append(index)
        self.free_indices.sort()
        return True

    def get_index(self, server_name: str) -> Optional[int]:
        """获取服务器的 session 索引

        Args:
            server_name: 服务器名称

        Returns:
            Optional[int]: 索引，如果不存在则返回 None
        """
        return self.server_indices.get(server_name)

    def get_letter(self, server_name: str) -> Optional[str]:
        """获取服务器的 session 字母

        Args:
            server_name: 服务器名称

        Returns:
            Optional[str]: 字母标识，如果不存在则返回 None
        """
        index = self.get_index(server_name)
        if index is None:
            return None
        return self.index_to_letter(index)

    @staticmethod
    def index_to_letter(index: int) -> str:
        """将索引转换为字母表示（类似 Excel 列名：a-z, aa-az, ba-bz...）

        Args:
            index: 索引 (0, 1, 2, ...)

        Returns:
            str: 字母表示 ('a', 'b', ..., 'z', 'aa', 'ab', ...)
        """
        result = ''
        index += 1  # 转换为 1-based，因为 Excel 列名是 A=1, Z=26, AA=27

        while index > 0:
            index -= 1  # 调整为 0-based 以便取模
            result = chr(97 + (index % 26)) + result
            index //= 26

        return result

    def clear(self) -> None:
        """清空所有索引"""
        self.server_indices.clear()
        self.free_indices.clear()


class MCPServerManager:
    """MCP 服务器管理器"""

    def __init__(self, server_configs: Dict[str, MCPServerConfig], max_retries: int = 1, retry_delay: float = 1.0):
        """初始化 MCP 服务器管理器

        Args:
            server_configs: MCP 服务器配置字典 (server_name -> MCPServerConfig)
            max_retries: 最大重试次数
            retry_delay: 重试基础延迟时间（秒）
        """
        self.server_configs = server_configs
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.clients: Dict[str, MCPClient] = {}
        self.tools: Dict[str, MCPToolInfo] = {}  # tool_name -> tool_info
        self.session_index_manager = SessionIndexManager()  # session 索引管理器
        self.failed_servers: set[str] = set()  # 记录连接失败的服务器名称

        logger.debug(f"初始化 MCP 服务器管理器，配置 {len(self.server_configs)} 个服务器，最大重试次数: {max_retries}")

    def has_server(self, server_name: str) -> bool:
        """检查服务器是否已连接

        Args:
            server_name: 服务器名称

        Returns:
            bool: 服务器是否已连接
        """
        return server_name in self.clients

    def get_connected_servers(self) -> List[str]:
        """获取所有已连接的服务器名称列表

        Returns:
            List[str]: 已连接的服务器名称列表
        """
        return list(self.clients.keys())

    def get_failed_servers(self) -> List[str]:
        """获取所有连接失败的服务器名称列表

        Returns:
            List[str]: 连接失败的服务器名称列表
        """
        return list(self.failed_servers)

    def clear_failed_servers(self) -> None:
        """清空所有失败服务器记录，允许下次 discover 时重新尝试连接"""
        cleared_count = len(self.failed_servers)
        self.failed_servers.clear()
        logger.info(f"已清空 {cleared_count} 个失败服务器记录")

    async def retry_failed_server(self, server_name: str) -> Optional[ServerDiscoveryResult]:
        """重试连接指定的失败服务器

        Args:
            server_name: 要重试的服务器名称

        Returns:
            Optional[ServerDiscoveryResult]: 如果服务器在失败列表中则返回重试结果，否则返回 None
        """
        if server_name not in self.failed_servers:
            logger.warning(f"服务器 '{server_name}' 不在失败列表中，无需重试")
            return None

        if server_name not in self.server_configs:
            logger.warning(f"服务器 '{server_name}' 不在配置列表中")
            return None

        # 从失败列表中移除，允许重新连接
        self.failed_servers.remove(server_name)
        logger.info(f"开始重试连接服务器: {server_name}")

        # 调用 discover 重新连接
        results = await self.discover()

        # 查找该服务器的结果
        for result in results:
            if result.name == server_name:
                return result

        return None

    def get_server_tools(self, server_name: str) -> List[str]:
        """获取指定服务器的工具列表

        Args:
            server_name: 服务器名称

        Returns:
            List[str]: 工具的原始名称列表（不带前缀）
        """
        server_tools = []
        for tool_name, tool_info in self.tools.items():
            if tool_info.server_name == server_name:
                server_tools.append(tool_info.original_name)
        return server_tools

    def get_server_config(self, server_name: str) -> Optional[MCPServerConfig]:
        """获取指定服务器的配置

        Args:
            server_name: 服务器名称

        Returns:
            Optional[MCPServerConfig]: 服务器配置，如果不存在则返回 None
        """
        return self.server_configs.get(server_name)

    async def add_server(self, server_config: MCPServerConfig) -> bool:
        """添加单个 MCP 服务器配置，如果同名服务器已存在则先移除

        注意：此方法只添加配置，不会立即连接服务器。
        需要调用 discover() 方法来实际连接和注册工具。

        Args:
            server_config: 服务器配置

        Returns:
            bool: 是否成功添加配置
        """
        # 如果已连接的服务器中存在同名服务，先移除连接（但不移除配置）
        if self.has_server(server_config.name):
            logger.info(f"检测到同名服务器 '{server_config.name}' 已连接，先清理旧连接")
            await self.remove_server(server_config.name, remove_config=False)

        is_update = server_config.name in self.server_configs
        self.server_configs[server_config.name] = server_config

        if is_update:
            logger.info(f"已更新服务器配置: {server_config.name}")
        else:
            logger.info(f"已添加服务器配置: {server_config.name}")

        return True

    async def remove_server(self, server_name: str, remove_config: bool = True) -> bool:
        """移除单个 MCP 服务器及其所有工具

        Args:
            server_name: 服务器名称
            remove_config: 是否同时从配置列表中移除，默认为 True

        Returns:
            bool: 是否成功移除
        """
        removed_anything = False

        # 移除已连接的服务器
        if self.has_server(server_name):
            # 移除所有该服务器的工具
            tools_to_remove = [
                tool_name for tool_name, tool_info in self.tools.items()
                if tool_info.server_name == server_name
            ]

            for tool_name in tools_to_remove:
                # 从 tool_factory 移除
                try:
                    tool_factory.unregister_tool(tool_name)
                except Exception as e:
                    logger.warning(f"从 tool_factory 移除工具 {tool_name} 失败: {e}")

                # 从 self.tools 移除
                self.tools.pop(tool_name, None)

            # 断开客户端连接
            client = self.clients.pop(server_name, None)
            if client:
                try:
                    await client.disconnect()
                except Exception as e:
                    logger.warning(f"断开服务器 {server_name} 连接失败: {e}")

            # 释放 session 索引
            self.session_index_manager.release(server_name)

            logger.info(f"已移除 MCP 服务器 '{server_name}' 及其 {len(tools_to_remove)} 个工具")
            removed_anything = True

        # 从配置字典中移除
        if remove_config:
            if server_name in self.server_configs:
                self.server_configs.pop(server_name)
                logger.info(f"已从配置列表中移除服务器: {server_name}")
                removed_anything = True

        if not removed_anything:
            logger.warning(f"服务器 '{server_name}' 不存在（既未连接也不在配置中）")
            return False

        return True

    async def discover(self) -> List[ServerDiscoveryResult]:
        """发现并注册所有 MCP 工具

        每次调用都会检查哪些服务配置还没有被连接，只连接未连接的服务器
        已经连接失败的服务器会被跳过，除非手动调用 retry_failed_server 重试

        Returns:
            List[ServerDiscoveryResult]: 每个服务器的发现结果
        """
        # 找出还没有连接且未失败的服务器配置
        unconnected_configs = []

        for server_name, config in self.server_configs.items():
            # 跳过已连接的服务器
            if self.has_server(server_name):
                continue
            # 跳过已失败的服务器
            if server_name in self.failed_servers:
                logger.debug(f"跳过已失败的服务器: {server_name}")
                continue
            unconnected_configs.append(config)

        if not unconnected_configs:
            if self.failed_servers:
                logger.debug(f"所有配置的服务器都已连接或失败，失败的服务器: {', '.join(self.failed_servers)}")
            else:
                logger.debug("所有配置的服务器都已连接")
            return []

        logger.debug(f"开始发现 MCP 工具，发现 {len(unconnected_configs)} 个未连接的服务器")

        # 阶段1：并发连接所有服务器（不修改共享状态）
        connection_results: List[ConnectionResult] = []
        try:
            async with anyio.create_task_group() as tg:
                for config in unconnected_configs:
                    tg.start_soon(self._connect_server_task, config, connection_results)
        except Exception as e:
            logger.warning(f"MCP 任务组执行过程中出现异常: {type(e).__name__}: {e}")

        # 阶段2：统一处理连接结果，修改共享状态（串行）
        discovery_results: List[ServerDiscoveryResult] = []
        for conn_result in connection_results:
            result = ServerDiscoveryResult(
                name=conn_result.config.name,
                status=conn_result.status,
                duration=conn_result.duration,
                tools=[],
                tool_count=0,
                error=conn_result.error,
                label_name=conn_result.label_name
            )

            # 如果连接成功，分配 session 索引并注册客户端和工具
            if conn_result.client and conn_result.tools:
                # 为成功连接的服务器分配 session 索引
                session_index = self.session_index_manager.allocate(conn_result.config.name)

                self.clients[conn_result.config.name] = conn_result.client
                tool_names = self._register_tools_to_manager(
                    conn_result.config,
                    conn_result.tools,
                    session_index
                )
                result.tools = tool_names
                result.tool_count = len(tool_names)
            else:
                # 连接失败，记录失败状态
                self.failed_servers.add(conn_result.config.name)
                logger.debug(f"服务器 '{conn_result.config.name}' 连接失败，已添加到失败列表")

            discovery_results.append(result)

        # 阶段3：注册新发现的工具到 tool_factory
        self._register_tools_to_factory()

        total_servers = len(self.server_configs)
        success_rate = len(self.clients) / total_servers * 100 if total_servers > 0 else 0
        logger.info(f"MCP 工具发现完成！本次连接 {len(discovery_results)} 个服务器，共注册 {len(self.tools)} 个工具，成功连接 {len(self.clients)}/{total_servers} 个服务器 ({success_rate:.1f}%)")

        return discovery_results

    def get_tool_info(self, tool_name: str) -> Optional[MCPToolInfo]:
        """获取指定工具的信息

        Args:
            tool_name: 工具名称（完整名称，带前缀）

        Returns:
            Optional[MCPToolInfo]: 工具信息，如果不存在则返回 None
        """
        return self.tools.get(tool_name)

    async def get_all_tools(self) -> Dict[str, MCPToolInfo]:
        """获取所有可用工具

        Returns:
            Dict[str, MCPToolInfo]: 工具名称到工具信息对象的映射
        """
        await self.discover()
        return self.tools.copy()

    def get_full_tool_name(self, server_name: str, original_tool_name: str) -> Optional[str]:
        """根据服务器名称和原始工具名称获取完整的工具名称

        Args:
            server_name: MCP 服务器名称
            original_tool_name: 工具的原始名称（不带前缀）

        Returns:
            Optional[str]: 完整的工具名称（格式：mcp_{letter}_{original_name}），如果未找到则返回 None
        """
        # 获取 session_letter
        session_letter = self.session_index_manager.get_letter(server_name)
        if not session_letter:
            logger.warning(f"未找到服务器 '{server_name}' 的 session letter")
            return None

        # 构造完整工具名称
        full_tool_name = f"mcp_{session_letter}_{original_tool_name}"

        # 验证工具是否存在
        if full_tool_name not in self.tools:
            logger.warning(f"工具 '{full_tool_name}' 不存在于工具列表中")
            return None

        return full_tool_name

    async def call_mcp_tool(self, tool_name: str, arguments: Dict[str, Any]) -> ToolResult:
        """调用 MCP 工具

        Args:
            tool_name: 工具名称 (格式: mcp_{letter}_{original_name})
            arguments: 工具参数

        Returns:
            ToolResult: 工具执行结果
        """
        await self.discover()

        # 解析工具名称格式: mcp_{letter}_{original_name}
        if not tool_name.startswith("mcp_"):
            return ToolResult(error=f"无效的 MCP 工具名称格式: {tool_name}")  # type: ignore

        tool_info = self.tools.get(tool_name)
        if not tool_info:
            return ToolResult(error=f"未找到 MCP 工具: {tool_name}")  # type: ignore

        server_name = tool_info.server_name
        original_name = tool_info.original_name

        client = self.clients.get(server_name)
        if not client:
            return ToolResult(error=f"MCP 服务器 '{server_name}' 不可用")  # type: ignore

        try:
            # 调用工具（客户端内部会自动处理连接检测和重连）
            result = await client.call_tool(original_name, arguments)

            # 将结果转换为 ToolResult 格式
            if isinstance(result, dict):
                content = result.get("content", [])
                is_error = result.get("isError", False)

                if is_error:
                    # 处理错误结果 - 从 content 中提取文本
                    if isinstance(content, list) and content:
                        error_texts = []
                        for item in content:
                            if hasattr(item, 'text'):
                                # TextContent 对象
                                error_texts.append(item.text)
                            elif isinstance(item, dict) and item.get("type") == "text":
                                # 字典格式
                                error_texts.append(item.get("text", ""))
                        error_msg = "\n".join(error_texts) if error_texts else "MCP 工具执行失败"
                    else:
                        error_msg = str(content) if content else "MCP 工具执行失败"

                    # 区分网络/协议错误和业务逻辑错误
                    # 只有网络错误或者500错误才算工具调用失败，业务逻辑错误应该返回给大模型处理
                    if self._is_system_error(error_msg):
                        return ToolResult(error=error_msg)  # type: ignore
                    else:
                        # 业务逻辑错误，作为正常内容返回给大模型
                        return ToolResult(content=error_msg)

                if isinstance(content, list) and content:
                    # 合并多个内容项 - 处理 TextContent 对象和字典格式
                    text_contents = []
                    for item in content:
                        if hasattr(item, 'text') and hasattr(item, 'type'):
                            # TextContent 对象
                            if item.type == "text":
                                text_contents.append(item.text)
                        elif isinstance(item, dict) and item.get("type") == "text":
                            # 字典格式
                            text_contents.append(item.get("text", ""))

                    # 尝试将每个 text 解析为 JSON，若全是对象则用 list 包裹并 encode
                    decoded_objs: List[Dict[str, Any]] = []
                    all_json_objects = True
                    for t in text_contents:
                        if not t:
                            continue
                        try:
                            obj = json.loads(t)
                            if isinstance(obj, dict):
                                decoded_objs.append(obj)
                            else:
                                all_json_objects = False
                                break
                        except (json.JSONDecodeError, TypeError):
                            all_json_objects = False
                            break

                    if all_json_objects and decoded_objs:
                        text_content = json.dumps(decoded_objs, ensure_ascii=False)
                    else:
                        text_content = "\n".join(text_contents)
                    return ToolResult(content=text_content or str(result))
                else:
                    return ToolResult(content=str(result))
            else:
                return ToolResult(content=str(result))

        except Exception as e:
            logger.warning(f"调用 MCP 工具 '{tool_name}' 失败: {e}")
            return ToolResult(error=f"MCP 工具调用失败: {e}")  # type: ignore

    async def shutdown(self) -> None:
        """关闭所有 MCP 连接并清理注册的工具"""
        logger.debug("开始关闭 MCP 服务器管理器")

        # 从工具工厂中移除 MCP 工具
        for tool_name in self.tools.keys():
            try:
                tool_factory.unregister_tool(tool_name)
            except Exception as e:
                logger.warning(f"移除 MCP 工具 {tool_name} 时出错: {e}")

        # 关闭所有客户端连接
        for server_name, client in self.clients.items():
            try:
                await client.disconnect()
            except Exception as e:
                logger.warning(f"关闭 MCP 服务器 {server_name} 连接时出错: {e}")

        # 清理状态
        self.tools.clear()
        self.clients.clear()
        self.session_index_manager.clear()
        self.failed_servers.clear()

        logger.debug("所有 MCP 连接已关闭，工具已清理")

    async def _connect_server_task(
        self,
        config: MCPServerConfig,
        results: List[ConnectionResult]
    ):
        """安全的服务器连接任务包装器，确保异常不会传播到任务组

        此方法在 TaskGroup 中并发运行，只负责连接和获取数据，不修改管理器的共享状态。
        连接结果会添加到 results 列表中，供后续统一处理。
        """
        start_time = time.time()

        # 从 server_options 中获取 label_name
        label_name = ""
        if config.server_options and isinstance(config.server_options, dict):
            label_name = config.server_options.get("label_name", "")

        conn_result = ConnectionResult(
            config=config,
            client=None,
            tools=None,
            error=None,
            duration=0.0,
            label_name=label_name,
            status="failed"
        )

        try:
            await self._connect_server(config, conn_result)
        except (Exception, asyncio.CancelledError, BaseException) as e:
            error_type = type(e).__name__
            conn_result.error = f"{error_type}: {e}"
            conn_result.status = "failed"
            logger.warning(f"连接 MCP 服务器 '{config.name}' 时出现 {error_type}: {e}")

            if "cancel scope" in str(e).lower() or "Attempted to exit cancel scope" in str(e):
                logger.warning(f"检测到 cancel scope 冲突，服务器 '{config.name}' 连接失败但不影响其他服务器")
        finally:
            conn_result.duration = time.time() - start_time
            # 直接 append，Python 的 list.append() 是线程安全的
            results.append(conn_result)

    async def _connect_server(
        self,
        config: MCPServerConfig,
        result: ConnectionResult
    ):
        """尝试连接单个服务器并获取工具列表

        连接结果会保存在 result 对象中，供调用者后续处理。
        """
        client = MCPClient(config, max_retries=self.max_retries, retry_delay=self.retry_delay)
        connection_success = False

        try:
            connection_timeout = 30.0 + (self.max_retries * 10.0)
            try:
                connected = await asyncio.wait_for(client.connect(), timeout=connection_timeout)

                if connected:
                    logger.debug(f"成功连接到 MCP 服务器: {config.name}")

                    tools = await asyncio.wait_for(client.list_tools(), timeout=20.0)

                    # 保存连接结果，不修改共享状态
                    result.client = client
                    result.tools = tools
                    result.status = "success"
                    connection_success = True
                else:
                    result.error = "连接失败"
                    logger.warning(f"无法连接到 MCP 服务器: {config.name}")

            except asyncio.TimeoutError:
                result.error = f"连接超时 ({connection_timeout}s)"
                result.status = "timeout"
                logger.warning(f"连接 MCP 服务器 {config.name} 超时 (包括重试)")

        except Exception as e:
            result.error = f"{type(e).__name__}: {e}"
            logger.warning(f"处理 MCP 服务器 {config.name} 时出错: {type(e).__name__}: {e}")
        finally:
            if not connection_success:
                await client.disconnect()

    def _register_tools_to_manager(
        self,
        config: MCPServerConfig,
        tools: List[Dict[str, Any]],
        session_index: int
    ) -> List[str]:
        """注册工具到管理器的 self.tools，不注册到 tool_factory

        Returns:
            List[str]: 可用工具的原始名称列表（用于显示，不带前缀）
        """
        session_letter = SessionIndexManager.index_to_letter(session_index)

        name_prefix = f"mcp_{session_letter}_"
        description_prefix = f"MCP server [{config.name}] - "

        available_tools = []
        skipped_tools = []

        for tool in tools:
            tool_name = name_prefix + tool["name"]
            tool_info = MCPToolInfo(
                name=tool_name,
                original_name=tool["name"],
                description=description_prefix + tool["description"],
                inputSchema=tool["inputSchema"],
                server_name=config.name,
                session_letter=session_letter,
                server_options=config.server_options
            )

            mcp_tool = tool_info.to_mcp_tool(self)

            if not mcp_tool.is_available():
                logger.warning(f"跳过不可用的 MCP 工具: {tool_name} (schema 验证失败)")
                skipped_tools.append(tool["name"])
                continue

            self.tools[tool_name] = tool_info
            available_tools.append(tool["name"])

        total_tools = len(tools)
        available_count = len(available_tools)
        skipped_count = len(skipped_tools)

        logger.info(f"从 MCP 服务器 '{config.name}' 注册了 {available_count}/{total_tools} 个工具到管理器，跳过 {skipped_count} 个不可用工具: {skipped_tools}")

        return available_tools

    def _register_tools_to_factory(self) -> None:
        """将 self.tools 中的工具注册到 tool_factory，跳过已注册的工具"""
        registered_count = 0
        skipped_count = 0

        for tool_name, tool_info in self.tools.items():
            # 检查工具是否已经注册
            if tool_factory.get_tool(tool_name) is not None:
                skipped_count += 1
                continue

            mcp_tool = tool_info.to_mcp_tool(self)
            tool_factory.register_tool_instance(tool_name, mcp_tool)
            registered_count += 1

        if registered_count > 0:
            logger.info(f"已将 {registered_count} 个新 MCP 工具注册到 tool_factory")
        if skipped_count > 0:
            logger.debug(f"跳过 {skipped_count} 个已注册的 MCP 工具")

    def _is_system_error(self, error_msg: str) -> bool:
        """判断是否为系统错误（网络错误、500错误等）

        Args:
            error_msg: 错误消息

        Returns:
            bool: 是否为系统错误
        """
        error_msg_lower = error_msg.lower()

        # 系统错误的关键词
        system_error_indicators = [
            # 网络相关错误
            "connection", "network", "timeout", "unreachable", "dns",
            "socket", "ssl", "tls", "certificate", "handshake",

            # HTTP协议错误
            "500", "502", "503", "504", "internal server error",
            "bad gateway", "service unavailable", "gateway timeout",

            # 系统级错误
            "system error", "server error", "fatal error", "crash",
            "out of memory", "disk full", "permission denied",

            # MCP协议错误
            "mcp protocol", "session", "transport", "stream",
            "jsonrpc", "protocol error", "parse error"
        ]

        # 如果包含系统错误关键词，则认为是系统错误
        return any(indicator in error_msg_lower for indicator in system_error_indicators)
