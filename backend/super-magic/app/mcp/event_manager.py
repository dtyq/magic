"""MCP 事件管理模块

专门处理 MCP 扩展安装事件的触发、过滤和状态管理功能。
"""

import json
import uuid
from typing import Dict, List, Any, Optional, Set
from pathlib import Path
from datetime import datetime
from dataclasses import dataclass, asdict
from agentlang.logger import get_logger
from app.paths import PathManager

logger = get_logger(__name__)

# 全局已触发扩展文件路径
_triggered_extensions_file_path: Optional[Path] = None
# 当前正在处理的扩展（用于before和after事件的配对）
_current_processing_extensions: Set[str] = set()


@dataclass
class MCPServerInitResult:
    """MCP服务器初始化结果"""
    name: str
    status: str  # "success", "failed", "timeout"
    duration: float  # 初始化耗时（秒）
    tools: List[str]  # 工具名称列表
    tool_count: int  # 工具数量
    error: Optional[str] = None  # 错误信息（如果有）
    label_name: str = ""  # 显示名称

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return asdict(self)


def initialize_event_manager() -> None:
    """初始化事件管理器，设置已触发扩展文件路径"""
    global _triggered_extensions_file_path, _current_processing_extensions
    _triggered_extensions_file_path = PathManager.get_mcp_config_dir() / "triggered_extensions.json"
    _current_processing_extensions = set()


async def load_triggered_extensions() -> Set[str]:
    """加载已触发过事件的MCP扩展名列表

    Returns:
        Set[str]: 已触发过的扩展名集合
    """
    if not _triggered_extensions_file_path or not _triggered_extensions_file_path.exists():
        return set()

    try:
        with open(_triggered_extensions_file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return set(data.get("triggered_extensions", []))
    except Exception as e:
        logger.warning(f"加载已触发扩展列表失败: {e}")
        return set()


async def save_triggered_extensions(triggered_extensions: Set[str]) -> None:
    """保存已触发过事件的MCP扩展名列表

    Args:
        triggered_extensions: 已触发过的扩展名集合
    """
    if not _triggered_extensions_file_path:
        return

    try:
        # 确保目录存在
        _triggered_extensions_file_path.parent.mkdir(parents=True, exist_ok=True)

        data = {
            "triggered_extensions": list(triggered_extensions),
            "last_updated": str(datetime.now())
        }

        with open(_triggered_extensions_file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        logger.debug(f"已保存触发扩展列表到: {_triggered_extensions_file_path}")

    except Exception as e:
        logger.warning(f"保存已触发扩展列表失败: {e}")


def filter_client_config_extensions(server_configs: List[Dict[str, Any]], triggered_extensions: Set[str]) -> List[Dict[str, Any]]:
    """过滤出需要触发事件的client_config扩展

    Args:
        server_configs: 服务器配置列表
        triggered_extensions: 已触发过的扩展名集合

    Returns:
        List[Dict[str, Any]]: 需要触发事件的扩展配置列表
    """
    client_configs = []
    for config in server_configs:
        source = config.get("source")
        name = config.get("name")

        # 只处理client_config来源的配置
        if source == "client_config" and name and name not in triggered_extensions:
            client_configs.append(config)

    return client_configs


async def trigger_before_mcp_init_event(agent_context: Optional[Any], server_configs: List[Dict[str, Any]]) -> None:
    """触发 MCP 初始化前事件

    Args:
        agent_context: 智能体上下文
        server_configs: 完整的服务器配置列表（内部会过滤client_config来源的新扩展）
    """
    global _current_processing_extensions

    if not agent_context:
        logger.debug("未提供 agent_context，跳过 MCP 初始化前事件触发")
        return

    # 内部加载已触发扩展列表
    triggered_extensions = await load_triggered_extensions()

    # 过滤出需要触发before事件的client_config扩展
    before_event_configs = filter_client_config_extensions(server_configs, triggered_extensions)

    if not before_event_configs:
        logger.debug("没有需要触发before事件的client_config扩展，跳过 MCP 初始化前事件触发")
        _current_processing_extensions = set()
        return


    # 提取扩展名列表
    extension_names = []
    for config in before_event_configs:
        name = config.get("name")
        if name:
            extension_names.append(name)

    if not extension_names:
        logger.debug("扩展名列表为空，跳过 MCP 初始化前事件触发")
        _current_processing_extensions = set()
        return

    # 记录当前正在处理的扩展
    _current_processing_extensions = set(extension_names)

    # 构建安装消息
    extensions_text = ", ".join(extension_names)
    logger.info(f"[MCP 事件] 正在安装扩展: {extensions_text}")

    # 注意：不在这里更新已触发扩展列表，应该在初始化成功后再更新

    # 发送"正在安装扩展"消息到客户端
    try:
        from app.core.entity.event.event import McpServerConfigSummary, BeforeMcpInitEventData
        from agentlang.event.event import Event, EventType

        # 使用过滤后的配置创建摘要，只包含需要触发事件的新扩展
        server_config_summaries = []
        for config in before_event_configs:
            # 从 server_options 中提取 label_name 和 label_names
            label_name = ""
            label_names = []
            server_options = config.get("server_options")
            if server_options and isinstance(server_options, dict):
                label_name = server_options.get("label_name", "")
                label_names = server_options.get("label_names", [])

            server_config_summaries.append(McpServerConfigSummary(
                name=config.get("name", "unknown"),
                type=config.get("type", "unknown"),
                source=config.get("source", "unknown"),
                label_name=label_name,
                label_names=label_names
            ))

        # 创建 before 事件数据
        event_data = BeforeMcpInitEventData(
            agent_context=agent_context,
            server_count=len(before_event_configs),
            server_configs=server_config_summaries
        )
        # 通过事件分发器触发事件
        await agent_context.dispatch_event(EventType.BEFORE_TOOL_CALL, event_data)
    except Exception as e:
        logger.warning(f"触发 MCP 初始化前事件失败: {e}")


async def trigger_after_mcp_init_event(agent_context: Optional[Any], success: bool, initialized_count: int, server_configs: List[Dict[str, Any]], mcp_manager: Optional[Any] = None, server_results: Optional[List[MCPServerInitResult]] = None, error: Optional[str] = None) -> None:
    """触发 MCP 初始化后事件

    Args:
        agent_context: 智能体上下文
        success: 是否成功
        initialized_count: 成功初始化的服务器数量
        server_configs: 完整的服务器配置列表
        mcp_manager: MCP管理器实例（用于保存MCP信息）
        server_results: 每个服务器的详细初始化结果
        error: 错误信息（可选）
    """
    global _current_processing_extensions

    if not agent_context:
        logger.debug("未提供 agent_context，跳过 MCP 初始化后事件触发")
        return

    # 使用before事件记录的正在处理的扩展
    if not _current_processing_extensions:
        logger.debug("没有正在处理的扩展，跳过 MCP 初始化后事件触发")
        return

    # 构建结果消息
    extension_names = list(_current_processing_extensions)
    extensions_text = ", ".join(extension_names)

    if success:
        logger.info(f"[MCP 事件] 安装 {extensions_text} 扩展成功")

        # 详细展示每个服务器的初始化结果
        if server_results:
            _log_server_results(server_results, _current_processing_extensions)

        # 更新已触发扩展列表并保存（只有成功时才更新）
        try:
            triggered_extensions = await load_triggered_extensions()
            triggered_extensions.update(_current_processing_extensions)
            await save_triggered_extensions(triggered_extensions)
            logger.debug(f"已将成功安装的扩展标记为已触发: {extensions_text}")
        except Exception as e:
            logger.warning(f"更新已触发扩展列表失败: {e}")

    else:
        logger.warning(f"[MCP 事件] 安装 {extensions_text} 扩展失败: {error}")

        # 即使失败也展示每个服务器的尝试结果
        if server_results:
            _log_server_results(server_results, _current_processing_extensions)

    # 发送"安装成功/失败"消息到客户端
    try:
        from app.core.entity.event.event import McpServerConfigSummary, AfterMcpInitEventData
        from agentlang.event.event import Event, EventType

        # 只包含当前正在处理的扩展的配置
        current_processing_configs = [
            config for config in server_configs
            if config.get("name") in extension_names
        ]

        server_config_summaries = []
        for config in current_processing_configs:
            # 从 server_options 中提取 label_name 和 label_names
            label_name = ""
            label_names = []
            server_options = config.get("server_options")
            if server_options and isinstance(server_options, dict):
                label_name = server_options.get("label_name", "")
                label_names = server_options.get("label_names", [])

            server_config_summaries.append(McpServerConfigSummary(
                name=config.get("name", "unknown"),
                type=config.get("type", "unknown"),
                source=config.get("source", "unknown"),
                label_name=label_name,
                label_names=label_names
            ))

        # 只包含当前正在处理的扩展的结果，但总是包含预先失败的结果
        filtered_server_results = None
        current_processing_initialized_count = 0
        if server_results:
            filtered_server_results = []
            for result in server_results:
                # 包含当前正在处理的扩展的结果
                if result.name in extension_names:
                    filtered_server_results.append(result)
                # 也包含预先失败的结果（duration为0.0且状态为failed，说明是预先失败的）
                elif result.status == 'failed' and result.duration == 0.0 and result.error:
                    filtered_server_results.append(result)

            # 计算当前正在处理的扩展中成功初始化的数量
            current_processing_initialized_count = len([
                result for result in filtered_server_results
                if result.status == 'success'
            ])

        # 创建 after 事件数据
        event_data = AfterMcpInitEventData(
            agent_context=agent_context,
            success=success,
            initialized_count=current_processing_initialized_count,
            total_count=len(current_processing_configs),
            server_configs=server_config_summaries,
            server_results=filtered_server_results,
            error=error
        )
        # 通过事件分发器触发事件
        await agent_context.dispatch_event(EventType.AFTER_TOOL_CALL, event_data)
    except Exception as e:
        logger.warning(f"触发 MCP 初始化后事件失败: {e}")

    # 在事件发送完成后清空当前处理的扩展
    _current_processing_extensions = set()


def _log_server_results(server_results: List[MCPServerInitResult], processing_extensions: Set[str]) -> None:
    """记录服务器初始化结果的详细日志

    Args:
        server_results: 服务器初始化结果列表
        processing_extensions: 正在处理的扩展名集合
    """
    # 只显示正在处理的扩展的结果
    relevant_results = [result for result in server_results if result.name in processing_extensions]

    if not relevant_results:
        return

    logger.debug(f"[MCP 初始化详情] 共处理 {len(relevant_results)} 个扩展:")

    for result in relevant_results:
        status_emoji = "✅" if result.status == "success" else "❌" if result.status == "failed" else "⏱️"

        if result.status == "success":
            logger.debug(f"  {status_emoji} {result.name}: 成功 ({result.duration:.2f}s, {result.tool_count} 个工具)")
            if result.tools:
                tools_preview = result.tools[:3]  # 只显示前3个工具
                tools_text = ", ".join(tools_preview)
                if len(result.tools) > 3:
                    tools_text += f" 等 {len(result.tools)} 个工具"
                logger.debug(f"    工具: {tools_text}")
        else:
            error_info = f" - {result.error}" if result.error else ""
            logger.warning(f"  {status_emoji} {result.name}: {result.status} ({result.duration:.2f}s){error_info}")


def cleanup_event_manager() -> None:
    """清理事件管理器"""
    global _triggered_extensions_file_path, _current_processing_extensions
    _triggered_extensions_file_path = None
    _current_processing_extensions = set()
