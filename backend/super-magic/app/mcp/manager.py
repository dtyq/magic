"""MCP 全局管理器

提供全局单例的 MCP 服务器管理功能。负责整合配置加载和连接生命周期，
是外部调用的主要入口。

配置加工逻辑在 config/loader.py，连接管理在 connection/server_manager.py。
"""

import re
from typing import Any, Dict, List, Optional, Tuple

from agentlang.logger import get_logger

from .config.loader import (
    filter_changed_servers,
    load_global_mcp_config,
    merge_mcp_configurations,
)
from .config.models import MCPConfigSource, MCPServerConfig
from .connection.server_manager import MCPServerManager
from .tool.models import MCPServerResult, MCPToolInfo

logger = get_logger(__name__)

# 全局 MCP 管理器单例
_global_manager: Optional[MCPServerManager] = None

# MCP 工具名称格式：mcp_{letter}_{original_name}
_MCP_TOOL_PATTERN = re.compile(r'^mcp_[a-z]+_')


async def initialize_global_mcp_manager(
    mcp_servers: Optional[List[Dict[str, Any]]] = None,
    max_retries: int = 1,
    retry_delay: float = 1.0,
    append_mode: bool = False,
) -> bool:
    """初始化全局 MCP 管理器

    Args:
        mcp_servers: 可选的 MCP 服务器配置列表（原始 dict），会与 config/mcp.json 合并
        max_retries: 单个服务器的最大连接重试次数
        retry_delay: 重试基础延迟时间（秒）
        append_mode: 追加模式。为 True 时若管理器已存在则不关闭，
                     只处理新增或配置已变更的服务器

    Returns:
        bool: 初始化是否成功
    """
    global _global_manager

    if _global_manager is not None and not append_mode:
        logger.info("全局 MCP 管理器已存在，将先关闭现有管理器")
        await shutdown_global_mcp_manager()

    try:
        # 规范化入参：触发 Pydantic 校验器，无效配置提前分离为预失败结果
        raw_input = mcp_servers or []
        valid_input, pre_failed_results = _normalize_input_configs(raw_input)

        # 规范化后统一设置来源：未显式指定的标记为 client_config
        for config in valid_input:
            if config.source == MCPConfigSource.UNKNOWN:
                config.source = MCPConfigSource.CLIENT_CONFIG

        # 加载全局配置（已规范化为 MCPServerConfig）
        global_configs = await load_global_mcp_config()

        logger.debug(
            f"全局配置: {len(global_configs)} 个，"
            f"入参有效配置: {len(valid_input)} 个，"
            f"入参预失败: {len(pre_failed_results)} 个"
        )

        # 合并：入参优先覆盖全局配置
        merged_configs = merge_mcp_configurations(valid_input, global_configs)

        if not merged_configs and not pre_failed_results:
            logger.info("未提供 MCP 服务器配置且无现有配置，跳过初始化")
            return False

        if not merged_configs:
            logger.info("所有服务器都是预先失败的配置，跳过实际初始化")
            for r in pre_failed_results:
                logger.warning(f"预失败服务器: {r.name} - {r.error}")
            return True

        # 追加模式：仅保留新增或配置已变更的服务器
        if append_mode and _global_manager is not None:
            to_connect = filter_changed_servers(merged_configs, _global_manager.server_configs)
        else:
            to_connect = merged_configs

        logger.info(
            f"开始{'追加' if append_mode and _global_manager else '初始化'}全局 MCP 管理器，"
            f"配置 {len(to_connect)} 个服务器"
        )
        if pre_failed_results:
            logger.info(f"包含 {len(pre_failed_results)} 个预先失败的服务器")
        logger.debug(f"重试参数: max_retries={max_retries}, retry_delay={retry_delay}")

        if _global_manager is not None:
            logger.info(f"使用现有管理器，添加 {len(to_connect)} 个服务器配置")
            for config in to_connect:
                await _global_manager.add_server(config)
        else:
            logger.info(f"创建新管理器，配置 {len(to_connect)} 个服务器")
            _global_manager = MCPServerManager(
                {c.name: c for c in to_connect},
                max_retries=max_retries,
                retry_delay=retry_delay,
            )

        await _global_manager.discover()

        logger.info(f"全局 MCP 管理器初始化成功，注册了 {len(_global_manager.tools)} 个工具")
        return True

    except Exception as e:
        logger.warning(f"初始化全局 MCP 管理器失败: {e}")
        _global_manager = None
        return False


def get_global_mcp_manager() -> Optional[MCPServerManager]:
    """获取全局 MCP 管理器实例，未初始化时返回 None"""
    return _global_manager


def get_global_mcp_tools() -> Dict[str, MCPToolInfo]:
    """获取全局已注册的 MCP 工具字典

    调用方应确保在 discover() 完成后再调用此方法。
    """
    if _global_manager:
        return _global_manager.get_all_tools()
    return {}


def is_mcp_tool(tool_name: str) -> bool:
    """判断工具名称是否为 MCP 工具

    MCP 工具名称格式为 mcp_{letter}_{original_name}，
    使用正则精确匹配，避免误判其他以 mcp_ 开头的非 MCP 工具。
    """
    return bool(_MCP_TOOL_PATTERN.match(tool_name))


async def shutdown_global_mcp_manager() -> None:
    """关闭全局 MCP 管理器并清理所有资源"""
    global _global_manager

    if _global_manager:
        logger.debug("开始关闭全局 MCP 管理器")
        try:
            await _global_manager.shutdown()
            logger.debug("全局 MCP 管理器已关闭")
        except Exception as e:
            logger.warning(f"关闭全局 MCP 管理器时出错: {e}")
        finally:
            _global_manager = None


def _normalize_input_configs(
    servers: List[Dict[str, Any]],
) -> Tuple[List[MCPServerConfig], List[MCPServerResult]]:
    """将入参服务器配置规范化为 MCPServerConfig 对象，分离预失败项

    对每个配置尝试构建 MCPServerConfig，触发 Pydantic 校验器（env 变量扩展、
    列表转字典等）；构建失败时直接生成 MCPServerResult（预失败），不进入连接流程。

    已包含 error_message 字段的条目（调用方预先标记的失败项）直接转为
    MCPServerResult，不尝试构建 MCPServerConfig。

    Args:
        servers: 原始服务器配置字典列表

    Returns:
        Tuple[List[MCPServerConfig], List[MCPServerResult]]:
            - 有效配置列表
            - 预失败结果列表
    """
    valid: List[MCPServerConfig] = []
    pre_failed: List[MCPServerResult] = []

    for server in servers:
        name = server.get("name", "unknown")
        label_name = _extract_label_name(server)

        # 调用方预先标记的失败项
        if "error_message" in server:
            pre_failed.append(MCPServerResult(
                name=name,
                status="failed",
                duration=0.0,
                tools=[],
                tool_count=0,
                error=server["error_message"],
                label_name=label_name,
            ))
            continue

        try:
            valid.append(MCPServerConfig(**server))
        except Exception as e:
            pre_failed.append(MCPServerResult(
                name=name,
                status="failed",
                duration=0.0,
                tools=[],
                tool_count=0,
                error=str(e),
                label_name=label_name,
            ))
            logger.warning(f"MCP 服务器配置格式无效: {name} - {e}")

    return valid, pre_failed


def _extract_label_name(server: Dict[str, Any]) -> str:
    """从服务器配置字典中提取 label_name"""
    opts = server.get("server_options", {})
    if isinstance(opts, dict):
        return opts.get("label_name", "")
    return ""
