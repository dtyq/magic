"""全局 MCP 管理器模块

提供全局单例的 MCP 服务器管理功能，支持配置持久化和连接池管理。
"""

import json
from typing import Dict, List, Any, Optional
from agentlang.logger import get_logger
from app.path_manager import PathManager
from app.mcp.event_manager import (
    initialize_event_manager,
    cleanup_event_manager,
    trigger_before_mcp_init_event,
    trigger_after_mcp_init_event,
    MCPServerInitResult
)
from .server_manager import MCPServerManager, MCPToolInfo, MCPServerConfig

logger = get_logger(__name__)

# 全局 MCP 管理器实例
_global_manager: Optional[MCPServerManager] = None

async def initialize_global_mcp_manager(mcp_servers: Optional[List[Dict[str, Any]]] = None,
                                       max_retries: int = 1,
                                       retry_delay: float = 1.0,
                                       agent_context: Optional[Any] = None,
                                       append_mode: bool = False) -> bool:
    """初始化全局 MCP 管理器

    Args:
        mcp_servers: 可选的 MCP 服务器配置列表，合并 config/mcp.json
        max_retries: 最大重试次数
        retry_delay: 重试基础延迟时间（秒）
        agent_context: 智能体上下文（可选，用于事件触发）
        append_mode: 追加模式，默认 False。为 True 时，如果管理器已存在则不关闭，
                    而是比对配置差异，只添加/更新变化的服务器

    Returns:
        bool: 初始化是否成功
    """
    global _global_manager

    # 非追加模式：关闭现有管理器
    if _global_manager is not None and not append_mode:
        logger.info("全局 MCP 管理器已存在，将先关闭现有管理器")
        await shutdown_global_mcp_manager()

    try:
        # 初始化事件管理器
        initialize_event_manager()

        # 从 config/mcp.json 读取全局配置
        global_config_servers = await _load_global_mcp_config()

        # 如果没有提供参数配置，则使用空列表
        if mcp_servers is None:
            mcp_servers = []

        # 为参数传入的配置标记为client_config来源
        for server in mcp_servers:
            if "source" not in server:
                server["source"] = "client_config"

        # 两层合并：全局配置 -> 参数配置（后者优先）
        merged_servers = _merge_mcp_configurations(mcp_servers, global_config_servers)

        if not merged_servers:
            logger.info("未提供 MCP 服务器配置且无现有配置，跳过初始化")
            return False

        # 分离预先失败的配置和正常配置
        valid_servers, pre_failed_results = _separate_failed_configs(merged_servers)

        # 如果所有服务器都是预先失败的，则跳过实际的初始化
        if not valid_servers:
            logger.info("所有服务器都是预先失败的配置，跳过实际初始化")

            # 仍然触发事件，包含预先失败的结果
            await trigger_before_mcp_init_event(agent_context, merged_servers)
            await trigger_after_mcp_init_event(agent_context, True, 0, merged_servers, None, pre_failed_results)

            return True

        # 追加模式：检查配置是否变更，移除未变更的配置
        if append_mode and _global_manager is not None:
            valid_servers = _filter_changed_servers(valid_servers, _global_manager)

        # 触发 MCP 初始化前事件（内部会过滤client_config扩展并管理状态）
        await trigger_before_mcp_init_event(agent_context, valid_servers)

        logger.info(f"开始{'追加' if append_mode and _global_manager else '初始化'}全局 MCP 管理器，配置 {len(valid_servers)} 个服务器")
        if pre_failed_results:
            logger.info(f"包含 {len(pre_failed_results)} 个预先失败的服务器")
        logger.debug(f"重试参数: max_retries={max_retries}, retry_delay={retry_delay}")
        logger.debug(f"全局配置: {len(global_config_servers)} 个，参数配置: {len(mcp_servers)} 个")

        # 判断是使用 add_server 还是创建新管理器
        if _global_manager is not None:
            # 使用 add_server 添加配置
            logger.info(f"使用现有管理器，添加 {len(valid_servers)} 个服务器配置")
            for config in valid_servers:
                server_config_obj = MCPServerConfig(**config)
                await _global_manager.add_server(server_config_obj)
        else:
            # 创建新管理器
            logger.info(f"创建新管理器，配置 {len(valid_servers)} 个服务器")
            server_configs_dict = {
                config['name']: MCPServerConfig(**config)
                for config in valid_servers
            }
            _global_manager = MCPServerManager(server_configs_dict, max_retries=max_retries, retry_delay=retry_delay)

        # 统一发现并注册工具
        discovery_results = await _global_manager.discover()

        # 转换为 MCPServerInitResult
        server_results = [
            MCPServerInitResult(
                name=result.name,
                status=result.status,
                duration=result.duration,
                tools=result.tools,
                tool_count=result.tool_count,
                error=result.error,
                label_name=result.label_name
            )
            for result in discovery_results
        ]

        # 合并预先失败的结果
        server_results.extend(pre_failed_results)

        logger.info(f"全局 MCP 管理器初始化成功，注册了 {len(_global_manager.tools)} 个工具")

        # 触发 MCP 初始化后事件（内部会过滤client_config扩展并保存MCP信息）
        await trigger_after_mcp_init_event(agent_context, True, len(_global_manager.clients), merged_servers, _global_manager, server_results)

        return True

    except Exception as e:
        logger.warning(f"初始化全局 MCP 管理器失败: {e}")

        # 收集失败时的结果信息
        server_results = []
        if 'discovery_results' in locals():
            server_results = [
                MCPServerInitResult(
                    name=result.name,
                    status=result.status,
                    duration=result.duration,
                    tools=result.tools,
                    tool_count=result.tool_count,
                    error=result.error,
                    label_name=result.label_name
                )
                for result in discovery_results
            ]

        # 合并预先失败的结果
        if 'pre_failed_results' in locals():
            server_results.extend(pre_failed_results)

        # 触发 MCP 初始化后事件（失败）
        merged_servers = merged_servers if 'merged_servers' in locals() else []
        await trigger_after_mcp_init_event(agent_context, False, 0, merged_servers, None, server_results, str(e))

        # 清理失败的管理器
        _global_manager = None
        return False

async def _load_global_mcp_config() -> List[Dict[str, Any]]:
    """从 config/mcp.json 读取全局 MCP 配置

    Returns:
        List[Dict[str, Any]]: 全局 MCP 服务器配置列表
    """
    try:
        mcp_config_path = PathManager.get_project_root() / "config" / "mcp.json"

        if not mcp_config_path.exists():
            logger.debug(f"未找到全局 MCP 配置文件: {mcp_config_path}")
            return []

        with open(mcp_config_path, 'r', encoding='utf-8') as f:
            config_data = json.load(f)

        mcp_servers = []
        total_servers = 0
        enabled_servers = 0

        # 转换配置格式：从 {"mcpServers": {...}} 转换为列表格式
        if "mcpServers" in config_data:
            for server_name, server_config in config_data["mcpServers"].items():
                total_servers += 1

                # 检查是否启用，默认为 false
                enabled = server_config.get("enabled", False)
                if not enabled:
                    logger.debug(f"跳过未启用的 MCP 服务器: {server_name}")
                    continue

                enabled_servers += 1

                # 为每个服务器添加 name 字段
                server_config["name"] = server_name
                # 设置默认类型：URL 类型（包括 SSE）统一归类为 http
                if "url" in server_config:
                    server_config["type"] = "http"
                else:
                    server_config["type"] = "stdio"

                # 标记配置来源
                server_config["source"] = "global_config"

                # 移除 enabled 字段，避免传递给 MCPServerConfig
                server_config.pop("enabled", None)

                mcp_servers.append(server_config)

            logger.debug(f"成功加载全局 MCP 配置文件: {mcp_config_path}，总共 {total_servers} 个服务器，启用 {enabled_servers} 个")
        else:
            logger.warning(f"MCP 配置文件格式不正确，缺少 'mcpServers' 字段")

        return mcp_servers

    except Exception as e:
        logger.warning(f"加载全局 MCP 配置文件失败: {e}")
        return []

def _merge_mcp_configurations(new_servers: List[Dict[str, Any]], existing_servers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """合并 MCP 服务器配置，新配置优先

    Args:
        new_servers: 新传入的服务器配置列表
        existing_servers: 现有的服务器配置列表

    Returns:
        List[Dict[str, Any]]: 合并后的服务器配置列表
    """
    # 使用字典来去重，以 name 为键
    merged_configs = {}

    # 先添加现有配置
    for server in existing_servers:
        server_name = server.get("name")
        if server_name:
            merged_configs[server_name] = server
            source = server.get("source", "existing_manifest")
            logger.debug(f"恢复现有 MCP 服务器配置: {server_name} (来源: {source})")

    # 再添加新配置，覆盖同名的现有配置
    for server in new_servers:
        server_name = server.get("name")
        if server_name:
            source = server.get("source", "unknown")
            if server_name in merged_configs:
                old_source = merged_configs[server_name].get("source", "unknown")
                logger.debug(f"新配置覆盖现有 MCP 服务器配置: {server_name} (来源: {source} -> {old_source})")
            else:
                logger.debug(f"添加新 MCP 服务器配置: {server_name} (来源: {source})")
            merged_configs[server_name] = server

    result = list(merged_configs.values())
    logger.debug(f"配置合并完成，共 {len(result)} 个 MCP 服务器")

    return result

def _separate_failed_configs(merged_servers: List[Dict[str, Any]]) -> tuple[List[Dict[str, Any]], List[MCPServerInitResult]]:
    """分离预先失败的配置和正常配置

    Args:
        merged_servers: 合并后的服务器配置列表

    Returns:
        tuple: (正常的服务器配置列表, 预先失败的结果列表)
    """
    pre_failed_results = []
    valid_servers = []

    for server_config in merged_servers:
        # 检查是否有 error_message 字段
        if "error_message" in server_config:
            # 这是一个预先失败的服务器配置，创建失败结果
            error_message = server_config.get("error_message", "配置错误")
            server_name = server_config.get("name", "unknown")

            # 从 server_options 中提取 label_name
            label_name = ""
            server_options = server_config.get("server_options", {})
            if isinstance(server_options, dict):
                label_name = server_options.get("label_name", "")

            pre_failed_result = MCPServerInitResult(
                name=server_name,
                status="failed",
                duration=0.0,
                tools=[],
                tool_count=0,
                error=error_message,
                label_name=label_name
            )
            pre_failed_results.append(pre_failed_result)
            logger.info(f"预先失败的MCP服务器: {server_name} - {error_message}")
        else:
            # 正常的服务器配置
            valid_servers.append(server_config)

    return valid_servers, pre_failed_results

def _filter_changed_servers(valid_servers: List[Dict[str, Any]], manager: MCPServerManager) -> List[Dict[str, Any]]:
    """过滤出新增或配置已变更的服务器

    Args:
        valid_servers: 待检查的服务器配置列表
        manager: 现有的 MCP 管理器实例

    Returns:
        List[Dict[str, Any]]: 过滤后的服务器配置列表（仅包含新增或配置已变更的）
    """
    logger.info(f"追加模式：比对 {len(valid_servers)} 个配置与现有配置")
    filtered_servers = []
    existing_configs = manager.server_configs

    for server_config in valid_servers:
        server_name = server_config.get('name')
        if server_name not in existing_configs:
            # 新增服务器
            logger.info(f"追加模式-新增服务器: {server_name}")
            filtered_servers.append(server_config)
        else:
            # 检查配置是否变更
            if _is_config_changed(existing_configs[server_name], server_config):
                logger.info(f"追加模式-服务器配置已变更: {server_name}")
                filtered_servers.append(server_config)
            else:
                logger.debug(f"追加模式-服务器配置未变化，跳过: {server_name}")

    logger.info(f"追加模式：过滤后需要处理 {len(filtered_servers)} 个服务器")
    return filtered_servers

def _is_config_changed(existing_config: MCPServerConfig, new_config: Dict[str, Any]) -> bool:
    """比对服务器配置是否发生变化

    Args:
        existing_config: 现有的服务器配置对象
        new_config: 新传入的配置字典

    Returns:
        bool: 配置是否发生变化
    """
    # 通过构建 MCPServerConfig 来规范化新配置，确保 Pydantic validator（如 [] -> {} 转换）
    # 与现有配置保持一致，避免因原始格式差异导致误判
    try:
        new_server_config = MCPServerConfig(**new_config)
    except Exception:
        # 若无法构建配置对象，保守认为配置已变更
        return True

    # 比对关键字段
    key_fields = ['type', 'command', 'args', 'env', 'url', 'server_options']

    for field in key_fields:
        existing_value = getattr(existing_config, field, None)
        new_value = getattr(new_server_config, field, None)

        # 统一处理 None 和空值
        if existing_value is None and new_value is None:
            continue

        if existing_value != new_value:
            logger.debug(f"配置字段 '{field}' 发生变化: {existing_value} -> {new_value}")
            return True

    return False

def get_global_mcp_manager() -> Optional[MCPServerManager]:
    """获取全局 MCP 管理器实例

    Returns:
        Optional[MCPServerManager]: 全局管理器实例，如果未初始化则返回 None
    """
    return _global_manager

async def get_global_mcp_tools() -> Dict[str, MCPToolInfo]:
    """获取全局 MCP 工具列表

    Returns:
        Dict[str, MCPToolInfo]: 工具名称到工具信息对象的映射
    """
    if _global_manager:
        return await _global_manager.get_all_tools()
    return {}

def is_mcp_tool(tool_name: str) -> bool:
    """检查工具是否为 MCP 工具

    Args:
        tool_name: 工具名称

    Returns:
        bool: 是否为 MCP 工具
    """
    return tool_name.startswith("mcp_")

async def shutdown_global_mcp_manager() -> None:
    """关闭全局 MCP 管理器"""
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
            # 清理事件管理器
            cleanup_event_manager()
