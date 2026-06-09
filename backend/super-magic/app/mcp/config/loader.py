"""MCP 配置加载

负责从文件系统加载 config/mcp.json 全局配置。
所有函数以 MCPServerConfig 对象为操作单元，不再使用裸 Dict。
所有文件 I/O 使用异步方式。
"""

from typing import List

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
