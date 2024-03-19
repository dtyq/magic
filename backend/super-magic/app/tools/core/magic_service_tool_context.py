"""
Magic Service 工具上下文帮助方法

用于在工具执行时统一完成：
- 加载 Magic Service 配置
- 从 ToolContext 中提取 AgentContext，并拿到 metadata（认证信息）

这样可以避免在多个工具中重复同一段样板代码。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Protocol, Union

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult

from app.core.context.agent_context import AgentContext
from app.infrastructure.magic_service.config import MagicServiceConfig, MagicServiceConfigLoader


class _LoggerLike(Protocol):
    def debug(self, message: str, *args: Any, **kwargs: Any) -> Any: ...

    def info(self, message: str, *args: Any, **kwargs: Any) -> Any: ...

    def error(self, message: str, *args: Any, **kwargs: Any) -> Any: ...


@dataclass(frozen=True)
class MagicServiceToolContext:
    config: MagicServiceConfig
    metadata: Dict[str, Any]


MagicServiceToolContextOrError = Union[MagicServiceToolContext, ToolResult]


def get_magic_service_tool_context(
    tool_context: ToolContext,
    *,
    logger: _LoggerLike,
    config_path: str = ".credentials/init_client_message.json",
) -> MagicServiceToolContextOrError:
    """统一获取 MagicServiceConfig + metadata；失败时返回 ToolResult.error。"""
    # 加载 Magic Service 配置
    try:
        config = MagicServiceConfigLoader.load_with_fallback(config_path)
        logger.debug(f"Magic Service 配置加载成功: {config.api_base_url}")
    except Exception as e:
        error_msg = "无法加载 Magic Service 配置，请检查配置文件是否存在"
        logger.error(f"Magic Service 配置加载失败: {e}", exc_info=True)
        return ToolResult.error(error_msg)

    # 获取 metadata（认证信息）
    agent_context = tool_context.get_extension_typed("agent_context", AgentContext)
    if not agent_context:
        error_msg = "无法获取用户上下文信息，请稍后重试"
        logger.error("无法获取agent context，缺少必要的metadata信息")
        return ToolResult.error(error_msg)

    metadata = agent_context.get_metadata()
    if not metadata:
        error_msg = "无法获取用户认证信息，请稍后重试"
        logger.error("无法获取metadata信息")
        return ToolResult.error(error_msg)

    return MagicServiceToolContext(config=config, metadata=metadata)
