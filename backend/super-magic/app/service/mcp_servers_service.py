# -*- coding: utf-8 -*-
"""
MCP 服务器信息服务

为加载了 using-mcp skill 的 agent 提供可用 MCP 服务器信息
"""

import json
from typing import Any, Dict, List, Optional

from agentlang.logger import get_logger
from app.magic.agent import Agent
from app.mcp.manager import get_global_mcp_manager

logger = get_logger(__name__)


class MCPServersService:
    """MCP 服务器信息服务类"""

    @staticmethod
    def build_mcp_servers_context(servers_info: Dict[str, List[str]]) -> str:
        """构建 MCP 服务器信息的文本格式

        Args:
            servers_info: 服务器信息字典，格式为 {"server_name": ["tool1", "tool2", ...]}

        Returns:
            str: 格式化的服务器信息文本
        """
        if not servers_info:
            return ""

        # 构建服务器信息文本，使用大模型友好的格式
        lines = [
            "[System Note] Available MCP servers (only mention when user asks):",
            ""
        ]

        for server_name, tools in sorted(servers_info.items()):
            tool_count = len(tools) if tools else 0
            lines.append(f"\n- Server: {server_name} ({tool_count} tools)")

        return "\n".join(lines)

    @staticmethod
    async def append_mcp_servers_to_query(query: str, agent: Agent) -> str:
        """从全局 MCP manager 获取服务器信息并追加到 query

        Args:
            query: 原始查询内容
            agent: Agent 实例，用于获取上次的配置和检查加载的 skills

        Returns:
            str: 追加了服务器信息后的查询内容
        """
        try:
            # 检查是否加载了 using-mcp skill
            if not agent.agent_context or not agent.agent_context.has_skill("using-mcp"):
                logger.debug("未加载 using-mcp skill，跳过 MCP 服务器信息追加")
                return query

            # 获取全局 MCP manager
            manager = get_global_mcp_manager()
            if not manager:
                logger.debug("全局 MCP manager 未初始化，跳过 MCP 服务器信息追加")
                return query

            # 获取当前连接的服务器和工具信息
            servers_info: Dict[str, List[str]] = {}
            connected_servers = manager.get_connected_servers()

            for server_name in connected_servers:
                tools = manager.get_server_tools(server_name)
                servers_info[server_name] = tools

            if not servers_info:
                logger.debug("没有可用的 MCP 服务器，跳过追加")
                return query

            # 从 agent 的聊天历史中获取上次的会话配置
            last_session_config = agent.chat_history.get_last_session_config()
            last_mcp_servers = last_session_config.mcp_servers

            # 如果服务器信息未变化，跳过追加
            if last_mcp_servers is not None:
                # 比较服务器信息是否相同（使用 JSON 序列化比较）
                current_servers_json = json.dumps(servers_info, sort_keys=True, ensure_ascii=False)
                last_servers_json = json.dumps(last_mcp_servers, sort_keys=True, ensure_ascii=False)
                if current_servers_json == last_servers_json:
                    logger.debug("MCP 服务器信息未变化，跳过追加")
                    return query

            # 构建服务器信息的文本格式并追加到 query 中
            servers_text = MCPServersService.build_mcp_servers_context(servers_info)
            logger.info(f"追加 MCP 服务器信息到 query，共 {len(servers_info)} 个服务器")
            return f"{query}\n\n---\n\n{servers_text}"

        except Exception as e:
            logger.warning(f"处理 MCP 服务器信息时出错: {e}")
            # 失败不影响聊天主流程，返回原始 query
            return query
