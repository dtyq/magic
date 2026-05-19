"""
Tool Monitoring Event Listener

Non-intrusive tool execution monitoring using event listeners.
This approach doesn't require modifying agent.py or tool_executor.py.
"""

import traceback
from contextvars import ContextVar
from typing import Optional, Dict, Any
from dataclasses import dataclass, field

from agentlang.event.event import Event, EventType
from agentlang.event.data import BeforeToolCallEventData, AfterToolCallEventData
from agentlang.logger import get_logger
from .tool_monitoring import get_tool_monitor
from agentlang.tools.tool_result import TOOL_RESULT_SYSTEM_EARLY_AFTER

logger = get_logger(__name__)


@dataclass
class ToolCallBatch:
    """Represents a batch of tool calls"""

    expected_count: int = 0
    completed_count: int = 0
    started: bool = False
    tool_calls: Dict[str, Any] = field(default_factory=dict)


# Context variable to track current tool call batch
_current_batch: ContextVar[Optional[ToolCallBatch]] = ContextVar("tool_call_batch", default=None)


class ToolMonitoringListener:
    """
    Event listener for tool execution monitoring

    This listener monitors tool execution by listening to BEFORE_TOOL_CALL
    and AFTER_TOOL_CALL events, without requiring any modifications to
    agent.py or tool_executor.py.
    """

    def __init__(self):
        """Initialize the tool monitoring listener"""
        self._tool_monitor = get_tool_monitor()

    async def on_before_tool_call(self, event: Event[BeforeToolCallEventData]):
        """
        Handle BEFORE_TOOL_CALL event

        Args:
            event: Tool call event with BeforeToolCallEventData
        """
        try:
            data = event.data
            tool_name = data.tool_name
            tool_call_id = data.tool_call.id if hasattr(data.tool_call, "id") else None

            # Get or create batch
            batch = _current_batch.get()
            if batch is None or not batch.started:
                # Start new batch
                batch = ToolCallBatch(started=True)
                _current_batch.set(batch)
                # Start batch collection
                self._tool_monitor.start_batch_collection()
                logger.debug("Started new tool call batch collection")

            # Track this tool call
            batch.expected_count += 1
            if tool_call_id:
                batch.tool_calls[tool_call_id] = {"tool_name": tool_name, "started": True, "completed": False}

            logger.debug(f"Tool call started: {tool_name} (batch: {batch.expected_count} expected)")

        except Exception as e:
            logger.error(f"Error in on_before_tool_call: {e}", exc_info=True)

    async def on_after_tool_call(self, event: Event[AfterToolCallEventData]):
        """
        Handle AFTER_TOOL_CALL event

        Args:
            event: Tool call event with AfterToolCallEventData
        """
        try:
            data = event.data
            tool_name = data.tool_name
            result = data.result
            execution_time = data.execution_time if hasattr(data, "execution_time") else 0.0
            tool_call_id = data.tool_call.id if hasattr(data.tool_call, "id") else None

            # 仅用于保证消息顺序，不代表真实的工具执行完成，不应计入监控。
            if getattr(result, "system", None) == TOOL_RESULT_SYSTEM_EARLY_AFTER:
                logger.debug(f"Skipping early fake AFTER_TOOL_CALL for {tool_name} (EARLY_AFTER)")
                return

            # Get current batch
            batch = _current_batch.get()
            if batch is None:
                logger.warning(f"Received AFTER_TOOL_CALL for {tool_name} but no batch is active")
                return

            # Mark tool call as completed
            batch.completed_count += 1
            if tool_call_id and tool_call_id in batch.tool_calls:
                batch.tool_calls[tool_call_id]["completed"] = True

            # Collect tool execution data
            # Note: execution_time might be in result.execution_time if not in event data
            if hasattr(result, "execution_time") and result.execution_time:
                execution_time = result.execution_time

            # Determine if there's an error
            error = None
            error_stack = None
            if result and not result.ok:
                # Try to extract error information from content (error is stored in content when ok=False)
                if result.content:
                    error_stack = f"Tool Error: {result.content}"

            self._tool_monitor.collect_tool_execution(
                tool_name=tool_name,
                result=result,
                execution_time=execution_time,
                error=error,
                error_stack=error_stack,
                additional_attributes={
                    "call_id": tool_call_id,
                },
            )

            logger.debug(f"Tool call completed: {tool_name} (batch: {batch.completed_count}/{batch.expected_count})")

            # Check if batch is complete
            if batch.completed_count >= batch.expected_count:
                logger.debug(f"Batch complete, reporting {batch.completed_count} tool executions")
                self._tool_monitor.report_batch()
                # Reset batch
                _current_batch.set(None)

        except Exception as e:
            logger.error(f"Error in on_after_tool_call: {e}", exc_info=True)

    def register_listeners(self, agent_context):
        """
        Register event listeners to the agent context

        Args:
            agent_context: Agent context to register listeners to
        """
        # Get event dispatcher from agent context
        event_dispatcher = agent_context.get_event_dispatcher()

        event_dispatcher.add_listener(EventType.BEFORE_TOOL_CALL, self.on_before_tool_call)
        event_dispatcher.add_listener(EventType.AFTER_TOOL_CALL, self.on_after_tool_call)
        logger.info("Tool monitoring event listeners registered")


# Global listener instance
_listener: Optional[ToolMonitoringListener] = None


def get_tool_monitoring_listener() -> ToolMonitoringListener:
    """Get the global tool monitoring listener instance"""
    global _listener
    if _listener is None:
        _listener = ToolMonitoringListener()
    return _listener


def install_tool_monitoring_listener(agent_context):
    """
    Install tool monitoring listener to an agent context

    This is the main entry point for setting up non-intrusive tool monitoring.

    Args:
        agent_context: Agent context to install listener to

    Usage:
        # In application startup (e.g., ws_server.py or main.py)
        from app.infrastructure.observability.tool_monitoring_listener import install_tool_monitoring_listener

        # After creating agent
        install_tool_monitoring_listener(agent.agent_context)
    """
    listener = get_tool_monitoring_listener()
    listener.register_listeners(agent_context)
    logger.info("Tool monitoring listener installed")
