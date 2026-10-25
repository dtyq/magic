"""Compatibility import for the Assistant remote tool.

The model-visible tool is now registered as ``call_assistant``. This module
exists only for Python integrations that still import the old class path; it
does not register a second tool.
"""

from app.tools.remote.call_assistant import CallAssistant, CallAssistantParams

CallSimpleAgent = CallAssistant
CallSimpleAgentParams = CallAssistantParams

__all__ = ["CallSimpleAgent", "CallSimpleAgentParams"]
