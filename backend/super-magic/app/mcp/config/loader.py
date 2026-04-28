"""MCP 配置加载与合并

负责从文件系统加载 mcp.json 配置、合并多来源配置、以及追加模式下的差量比对。
所有函数以 MCPServerConfig 对象为操作单元，不再使用裸 Dict。
所有文件 I/O 使用异步方式。
"""

import json
from typing import Dict, List

from agentlang.logger import get_logger

from app.path_manager import PathManager
from app.utils.async_file_utils import async_exists, async_try_read_json

from .models import MCPConfigSource, MCPServerConfig, MCPServerType

logger = get_logger(__name__)


async def load_global_mcp_config() -> List[MCPServerConfig]:
    """从 config/mcp.json 读取全局 MCP 配置并规范化为 MCPServerConfig 对象列表

    跳过未启用（enabled=false）的服务器，解析失败的条目记录日志后跳过。

    Returns:
        List[MCPServerConfig]: 启用的 MCP 服务器配置列表
    """
    try:
        mcp_config_path = PathManager.get_project_root() / "config" / "mcp.json"

        if not await async_exists(mcp_config_path):
            logger.debug(f"未找到全局 MCP 配置文件: {mcp_config_path}")
            return []

        config_data = await async_try_read_json(mcp_config_path)
        if config_data is None:
            logger.warning(f"MCP 配置文件读取或解析失败: {mcp_config_path}")
            return []

        if "mcpServers" not in config_data:
            logger.warning("MCP 配置文件格式不正确，缺少 'mcpServers' 字段")
            return []

        configs: List[MCPServerConfig] = []
        total = 0
        enabled = 0

        for server_name, raw in config_data["mcpServers"].items():
            total += 1
            if not raw.get("enabled", False):
                logger.debug(f"跳过未启用的 MCP 服务器: {server_name}")
                continue

            enabled += 1
            raw["name"] = server_name
            raw["type"] = MCPServerType.HTTP if "url" in raw else MCPServerType.STDIO
            raw["source"] = MCPConfigSource.GLOBAL_CONFIG
            raw.pop("enabled", None)

            try:
                configs.append(MCPServerConfig(**raw))
            except Exception as e:
                logger.warning(f"全局配置中的服务器 '{server_name}' 格式无效，已跳过: {e}")

        logger.debug(
            f"成功加载全局 MCP 配置文件: {mcp_config_path}，"
            f"总共 {total} 个服务器，启用 {enabled} 个，有效 {len(configs)} 个"
        )
        return configs

    except Exception as e:
        logger.warning(f"加载全局 MCP 配置文件失败: {e}")
        return []


def merge_mcp_configurations(
    new_servers: List[MCPServerConfig],
    existing_servers: List[MCPServerConfig],
) -> List[MCPServerConfig]:
    """合并 MCP 服务器配置，新配置优先（同名时覆盖旧配置）

    Args:
        new_servers: 新传入的服务器配置列表（优先级高）
        existing_servers: 现有的服务器配置列表（优先级低）

    Returns:
        List[MCPServerConfig]: 合并后的去重列表
    """
    merged: Dict[str, MCPServerConfig] = {}

    for server in existing_servers:
        merged[server.name] = server
        logger.debug(f"恢复现有 MCP 服务器配置: {server.name} (来源: {server.source})")

    for server in new_servers:
        if server.name in merged:
            old_source = merged[server.name].source
            logger.debug(f"新配置覆盖现有 MCP 服务器配置: {server.name} ({server.source} -> {old_source})")
        else:
            logger.debug(f"添加新 MCP 服务器配置: {server.name} (来源: {server.source})")
        merged[server.name] = server

    result = list(merged.values())
    logger.debug(f"配置合并完成，共 {len(result)} 个 MCP 服务器")
    return result


def filter_changed_servers(
    valid_servers: List[MCPServerConfig],
    existing_configs: Dict[str, MCPServerConfig],
) -> List[MCPServerConfig]:
    """过滤出新增或配置已变更的服务器（追加模式使用）

    Args:
        valid_servers: 待检查的服务器配置列表
        existing_configs: 现有的 MCPServerConfig 字典（server_name -> config）

    Returns:
        List[MCPServerConfig]: 仅包含新增或已变更的服务器配置
    """
    logger.info(f"追加模式：比对 {len(valid_servers)} 个配置与现有配置")
    filtered: List[MCPServerConfig] = []

    for server in valid_servers:
        if server.name not in existing_configs:
            logger.info(f"追加模式-新增服务器: {server.name}")
            filtered.append(server)
        elif _is_config_changed(existing_configs[server.name], server):
            logger.info(f"追加模式-服务器配置已变更: {server.name}")
            filtered.append(server)
        else:
            logger.debug(f"追加模式-服务器配置未变化，跳过: {server.name}")

    logger.info(f"追加模式：过滤后需要处理 {len(filtered)} 个服务器")
    return filtered


def _is_config_changed(existing: MCPServerConfig, new: MCPServerConfig) -> bool:
    """比对两个 MCPServerConfig 的关键字段是否有差异

    Args:
        existing: 现有的服务器配置
        new: 新传入的服务器配置

    Returns:
        bool: 配置是否发生变化
    """
    for field in ('type', 'command', 'args', 'env', 'url', 'server_options'):
        existing_val = getattr(existing, field, None)
        new_val = getattr(new, field, None)
        if existing_val != new_val:
            logger.debug(f"配置字段 '{field}' 发生变化: {existing_val} -> {new_val}")
            return True
    return False
