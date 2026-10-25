"""Resolve product requests from the active chat, never from a saved INIT identity."""

from __future__ import annotations

from dataclasses import dataclass

from agentlang.context.tool_context import ToolContext
from app.core.context.agent_context import AgentContext
from app.infrastructure.sdk.magic_service.factory import create_magic_service_sdk
from app.infrastructure.sdk.magic_service.kernel.magic_service_parameter import MagicServiceAuthConfig
from app.infrastructure.sdk.magic_service.magic_service import MagicService


class ProductContextError(ValueError):
    pass


class ProductConfigurationError(ValueError):
    pass


@dataclass(frozen=True)
class ProductContext:
    sdk: MagicService
    auth: MagicServiceAuthConfig
    agent: AgentContext


def current_product_context(tool_context: ToolContext) -> ProductContext:
    agent = tool_context.get_extension_typed("agent_context", AgentContext)
    if agent is None:
        raise ProductContextError("Current chat identity is unavailable.")
    auth = agent.get_user_context_auth()
    host = agent.get_user_context_host()
    if auth is None or not host or not agent.is_user_context_config_loaded():
        raise ProductContextError("Current chat identity is unavailable. Refresh the chat and retry.")
    return ProductContext(sdk=create_magic_service_sdk(base_url=host), auth=auth, agent=agent)
