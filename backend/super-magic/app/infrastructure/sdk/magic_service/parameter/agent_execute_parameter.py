"""Backward-compatible import path for the legacy Assistant API parameters."""

from .assistant_execute_parameter import AssistantExecuteParameter

# Keep the old symbol for integrations compiled against the previous SDK.
AgentExecuteParameter = AssistantExecuteParameter

__all__ = ["AssistantExecuteParameter", "AgentExecuteParameter"]
