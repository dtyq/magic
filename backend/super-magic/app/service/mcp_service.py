"""
MCP 服务模块

负责 MCP (Model Context Protocol) 的初始化和配置管理
"""
import traceback
from typing import Dict, Any, Optional

from agentlang.logger import get_logger
from app.core.context.agent_context import AgentContext

logger = get_logger(__name__)


class MCPService:
    """MCP 服务类，提供 MCP 初始化相关功能"""

    @staticmethod
    async def initialize_from_config(
        mcp_config: Optional[Dict[str, Any]],
        agent_context: AgentContext
    ) -> None:
        """
        从配置初始化 MCP 管理器

        Args:
            mcp_config: MCP 配置字典，可能包含 mcpServers 等配置
            agent_context: Agent 上下文
        """
        try:
            from app.mcp.manager import initialize_global_mcp_manager

            # 解析客户端 MCP 配置，组装为 server_configs
            server_configs = MCPService._parse_mcp_config(mcp_config)

            # 判断是否为追加模式：检查 agent 是否加载了 using-mcp skill
            append_mode = agent_context.has_skill("using-mcp")

            # 统一调用一次 initialize_global_mcp_manager
            # server_configs 为 None 时使用全局配置，否则使用客户端配置
            logger.info("开始初始化 MCP 配置...")
            await initialize_global_mcp_manager(
                server_configs,
                agent_context=agent_context,
                append_mode=append_mode
            )

        except Exception as e:
            logger.error(f"初始化 MCP 配置时出错: {e}")
            logger.error(f"错误详情: {traceback.format_exc()}")
            # 不抛出异常，允许聊天处理继续进行

    @staticmethod
    async def initialize_from_global_config(
        agent_context: Optional[AgentContext] = None
    ) -> bool:
        """
        仅从全局配置初始化 MCP 管理器（不使用客户端配置）

        Args:
            agent_context: Agent 上下文（可选）

        Returns:
            bool: 初始化是否成功
        """
        try:
            from app.mcp.manager import initialize_global_mcp_manager

            # 判断是否为追加模式：检查 agent 是否加载了 using-mcp skill
            append_mode = False
            if agent_context:
                append_mode = agent_context.has_skill("using-mcp")

            # 直接调用全局管理器初始化，它会自动读取 config/mcp.json
            success = await initialize_global_mcp_manager(
                agent_context=agent_context,
                append_mode=append_mode
            )
            if success:
                logger.info("全局 MCP 管理器初始化成功")
            else:
                logger.debug("全局 MCP 管理器初始化跳过（无配置或初始化失败）")

            return success
        except Exception as e:
            logger.error(f"初始化 MCP 管理器时出错: {e}")
            logger.error(f"错误详情: {traceback.format_exc()}")
            return False

    @staticmethod
    def _parse_mcp_config(mcp_config: Optional[Dict[str, Any]]) -> Optional[list]:
        """
        解析 MCP 配置，转换为 server_configs 列表

        Args:
            mcp_config: MCP 配置字典

        Returns:
            Optional[list]: 服务器配置列表，None 表示使用全局配置
        """
        # 如果没有客户端配置，返回 None（表示使用全局配置）
        if not mcp_config:
            return None

        # 提取 mcpServers 配置
        mcp_servers_raw = mcp_config.get("mcpServers", {})

        # 处理 mcpServers 可能是列表或字典的情况，列表静默转换为空字典
        if isinstance(mcp_servers_raw, list):
            mcp_servers_config = {}
        elif isinstance(mcp_servers_raw, dict):
            mcp_servers_config = mcp_servers_raw
        else:
            mcp_servers_config = {}

        # 转换为 server_configs 列表
        server_configs = []

        for key, config in mcp_servers_config.items():
            # 跳过被禁用的服务器
            if not config.get("enabled", True):
                continue

            # 确定服务器名称：优先使用 config 中的 name，如果没有或为空则使用 key
            server_name = config.get("name")
            if not server_name or not server_name.strip():
                server_name = key

            # 创建服务器配置（保留所有原始字段）
            server_config = {
                "name": server_name,
                **config  # 保留所有原始配置字段
            }

            # 检查配置是否有效，如果无效则添加错误消息
            config_type = config.get("type", "").lower()

            if config_type == "stdio" or (config.get("command") and not config.get("url")):
                # Stdio 服务器配置有效
                # 补全 type 字段（MCPServerConfig 必需，client 配置可能未显式指定）
                if "type" not in server_config or str(server_config.get("type", "")).lower() not in ("http", "stdio"):
                    server_config["type"] = "stdio"
                server_configs.append(server_config)
            elif config_type == "http" or (config.get("url") and config.get("url", "").strip()):
                # HTTP 服务器配置有效
                # 补全 type 字段（MCPServerConfig 必需，client 配置可能未显式指定）
                if "type" not in server_config or str(server_config.get("type", "")).lower() not in ("http", "stdio"):
                    server_config["type"] = "http"
                server_configs.append(server_config)
            else:
                # 配置无效，添加错误消息
                logger.warning(f"服务器 {server_name} 配置无效：无法确定类型或缺少必要参数")
                # 如果config中已经有error_message，使用它；否则使用默认错误消息
                if "error_message" not in server_config:
                    server_config["error_message"] = "配置无效：无法确定类型或缺少必要参数"
                server_configs.append(server_config)

        # 如果解析后配置为空，返回 None（表示使用全局配置）
        if not server_configs:
            return None

        return server_configs
