"""
Tool Execution Monitoring

Provides comprehensive monitoring for tool execution including:
- Success/failure metrics
- Error rate calculation
- Full error stack trace reporting
- Execution time tracking
- Batch collection and reporting
"""

import traceback
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from contextlib import contextmanager
from opentelemetry import trace, metrics
from opentelemetry.trace import Status, StatusCode

from .telemetry import is_telemetry_enabled, get_tracer, get_meter
from agentlang.tools.tool_result import ToolResult


@dataclass
class ToolExecutionRecord:
    """Record of a single tool execution for batch reporting"""

    tool_name: str
    result: ToolResult
    execution_time: float
    error: Optional[Exception] = None
    error_stack: Optional[str] = None
    additional_attributes: Optional[Dict[str, Any]] = None


class ToolExecutionCollector:
    """
    Collector for batch tool execution monitoring

    Collects tool execution records and reports them in batch to reduce overhead
    """

    def __init__(self):
        """Initialize the collector"""
        self._records: List[ToolExecutionRecord] = []
        self._active = False

    def start_collection(self):
        """Start collecting tool execution records"""
        self._records.clear()
        self._active = True

    def collect(
        self,
        tool_name: str,
        result: ToolResult,
        execution_time: float,
        error: Optional[Exception] = None,
        error_stack: Optional[str] = None,
        additional_attributes: Optional[Dict[str, Any]] = None,
    ):
        """
        Collect a tool execution record

        Args:
            tool_name: Name of the tool
            result: Tool execution result
            execution_time: Execution time in seconds
            error: Exception if execution failed
            error_stack: Full error stack trace
            additional_attributes: Additional attributes
        """
        if not self._active:
            return

        record = ToolExecutionRecord(
            tool_name=tool_name,
            result=result,
            execution_time=execution_time,
            error=error,
            error_stack=error_stack,
            additional_attributes=additional_attributes,
        )
        self._records.append(record)

    def get_records(self) -> List[ToolExecutionRecord]:
        """Get all collected records"""
        return self._records.copy()

    def clear(self):
        """Clear all collected records"""
        self._records.clear()
        self._active = False

    def is_active(self) -> bool:
        """Check if collection is active"""
        return self._active


class ToolMonitor:
    """
    Monitor for tool execution with metrics and error tracking

    This class provides:
    1. Metrics for tool execution (success/failure counts, execution time)
    2. Error rate calculation
    3. Full error stack trace reporting to spans
    4. Comprehensive error attributes
    5. Batch reporting support
    """

    def __init__(self):
        """Initialize the tool monitor"""
        self._initialized = False
        self._tracer = None
        self._meter = None

        # Metrics
        self._tool_execution_counter = None
        self._tool_execution_duration = None
        self._tool_error_counter = None

        # Batch collector
        self._collector = ToolExecutionCollector()

        if is_telemetry_enabled():
            self._initialize()

    def _initialize(self):
        """Initialize OpenTelemetry components"""
        if self._initialized:
            return

        try:
            self._tracer = get_tracer(__name__)
            self._meter = get_meter(__name__)

            # Create metrics
            self._tool_execution_counter = self._meter.create_counter(
                name="tool.execution.count", description="Total number of tool executions", unit="1"
            )

            self._tool_execution_duration = self._meter.create_histogram(
                name="tool.execution.duration", description="Tool execution duration in seconds", unit="s"
            )

            self._tool_error_counter = self._meter.create_counter(
                name="tool.execution.errors", description="Number of tool execution errors", unit="1"
            )

            self._initialized = True
        except Exception as e:
            # Don't fail if telemetry setup fails
            import logging

            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to initialize tool monitoring: {e}")

    def track_tool_execution(
        self,
        tool_name: str,
        result: ToolResult,
        execution_time: float,
        error: Optional[Exception] = None,
        error_stack: Optional[str] = None,
        additional_attributes: Optional[Dict[str, Any]] = None,
    ):
        """
        Track a tool execution with metrics and error reporting

        Args:
            tool_name: Name of the tool
            result: Tool execution result
            execution_time: Execution time in seconds
            error: Exception if execution failed (optional)
            error_stack: Full error stack trace (optional, will be generated if error provided)
            additional_attributes: Additional attributes to add to span
        """
        if not is_telemetry_enabled() or not self._initialized:
            return

        # Get or create span for this tool execution
        span = trace.get_current_span()
        if not span or not span.is_recording():
            # Create a new span if no current span exists
            span = self._tracer.start_span(f"tool.execute.{tool_name}")
            should_end_span = True
        else:
            should_end_span = False

        try:
            # Set basic tool attributes
            span.set_attribute("tool.name", tool_name)
            span.set_attribute("tool.execution_time", execution_time)

            # Add additional attributes if provided
            if additional_attributes:
                for key, value in additional_attributes.items():
                    span.set_attribute(f"tool.{key}", value)

            # Record metrics
            self._record_metrics(tool_name, result, execution_time)

            # Handle success case
            if result and result.ok:
                span.set_status(Status(StatusCode.OK))
                span.set_attribute("tool.result.status", "success")
            else:
                # Handle failure case
                self._record_error(
                    span=span,
                    tool_name=tool_name,
                    result=result,
                    error=error,
                    error_stack=error_stack,
                    execution_time=execution_time,
                )

        finally:
            if should_end_span:
                span.end()

    def start_batch_collection(self):
        """Start batch collection mode"""
        self._collector.start_collection()

    def collect_tool_execution(
        self,
        tool_name: str,
        result: ToolResult,
        execution_time: float,
        error: Optional[Exception] = None,
        error_stack: Optional[str] = None,
        additional_attributes: Optional[Dict[str, Any]] = None,
    ):
        """
        Collect a tool execution for batch reporting

        Args:
            tool_name: Name of the tool
            result: Tool execution result
            execution_time: Execution time in seconds
            error: Exception if execution failed
            error_stack: Full error stack trace
            additional_attributes: Additional attributes
        """
        self._collector.collect(
            tool_name=tool_name,
            result=result,
            execution_time=execution_time,
            error=error,
            error_stack=error_stack,
            additional_attributes=additional_attributes,
        )

    def report_batch(self):
        """
        Report all collected tool executions in batch

        This method should be called after all tools in a batch have been executed
        """
        if not self._collector.is_active():
            return

        records = self._collector.get_records()
        if not records:
            self._collector.clear()
            return

        # Report all records
        for record in records:
            self.track_tool_execution(
                tool_name=record.tool_name,
                result=record.result,
                execution_time=record.execution_time,
                error=record.error,
                error_stack=record.error_stack,
                additional_attributes=record.additional_attributes,
            )

        # Clear collected records
        self._collector.clear()

    @contextmanager
    def batch_collection(self):
        """
        Context manager for batch collection

        Usage:
            with tool_monitor.batch_collection():
                # Execute multiple tools
                result1 = await tool1.execute(...)
                result2 = await tool2.execute(...)
            # All tools are reported in batch when exiting context
        """
        self.start_batch_collection()
        try:
            yield
        finally:
            self.report_batch()

    def _record_metrics(self, tool_name: str, result: ToolResult, execution_time: float):
        """Record metrics for tool execution"""
        if not self._tool_execution_counter:
            return

        # Common attributes for all metrics
        attributes = {"tool.name": tool_name, "tool.result.status": "success" if (result and result.ok) else "failure"}

        # Record execution count
        self._tool_execution_counter.add(1, attributes=attributes)

        # Record execution duration
        if self._tool_execution_duration:
            self._tool_execution_duration.record(execution_time, attributes=attributes)

        # Record error count if failed
        if not (result and result.ok):
            if self._tool_error_counter:
                error_attributes = {"tool.name": tool_name, "tool.error.type": self._get_error_type(result, None)}
                self._tool_error_counter.add(1, attributes=error_attributes)

    def _record_error(
        self,
        span: Any,
        tool_name: str,
        result: ToolResult,
        error: Optional[Exception],
        error_stack: Optional[str],
        execution_time: float,
    ):
        """
        Record error details to span with full stack trace

        Args:
            span: OpenTelemetry span
            tool_name: Name of the tool
            result: Tool execution result
            error: Exception if available
            error_stack: Full error stack trace
            execution_time: Execution time
        """
        # Mark span as error
        error_message = "Tool execution failed"
        if result and not result.ok and result.content:
            error_message = result.content
        elif error:
            error_message = str(error)

        span.set_status(Status(StatusCode.ERROR, error_message))
        span.set_attribute("tool.result.status", "failure")
        span.set_attribute("tool.error", True)

        # Get or generate error stack trace
        stack_trace = error_stack
        if not stack_trace and error:
            stack_trace = traceback.format_exc()
        elif not stack_trace and result and not result.ok and result.content:
            # If we only have error message, create a basic stack trace
            stack_trace = f"Tool Error: {result.content}"

        # Record full stack trace
        if stack_trace:
            span.set_attribute("tool.error.stack_trace", stack_trace)
            # Also record as exception event for better visibility
            span.add_event(
                name="tool.error.stack_trace",
                attributes={
                    "tool.error.stack_trace": stack_trace,
                    "tool.name": tool_name,
                    "tool.execution_time": execution_time,
                },
            )

        # Record exception if available
        if error:
            span.record_exception(error)
            span.set_attribute("tool.error.type", type(error).__name__)
            span.set_attribute("tool.error.message", str(error))

        # Record error details from result
        if result:
            if not result.ok and result.content:
                span.set_attribute("tool.error.result_error", result.content)
            if result.content:
                # Truncate content if too long
                content = str(result.content)
                if len(content) > 1000:
                    content = content[:1000] + "... (truncated)"
                span.set_attribute("tool.error.result_content", content)

    def _get_error_type(self, result: ToolResult, error: Optional[Exception]) -> str:
        """Determine error type from result or exception"""
        if error:
            return type(error).__name__
        if result and not result.ok and result.content:
            # Try to infer error type from error message (error is stored in content when ok=False)
            error_msg = result.content.lower()
            if "validation" in error_msg or "参数" in error_msg:
                return "ValidationError"
            elif "not found" in error_msg or "不存在" in error_msg:
                return "NotFoundError"
            elif "permission" in error_msg or "权限" in error_msg:
                return "PermissionError"
            elif "timeout" in error_msg or "超时" in error_msg:
                return "TimeoutError"
            elif "connection" in error_msg or "连接" in error_msg:
                return "ConnectionError"
            else:
                return "UnknownError"
        return "UnknownError"

    def track_tool_start(self, tool_name: str, tool_context: Any) -> Any:
        """
        Start tracking a tool execution

        Args:
            tool_name: Name of the tool
            tool_context: Tool context object

        Returns:
            OpenTelemetry span for the tool execution
        """
        if not is_telemetry_enabled() or not self._initialized:
            return None

        span = self._tracer.start_span(f"tool.execute.{tool_name}")
        span.set_attribute("tool.name", tool_name)

        # Add context information if available
        if tool_context:
            if hasattr(tool_context, "tool_call_id") and tool_context.tool_call_id:
                span.set_attribute("tool.call_id", str(tool_context.tool_call_id))
            if hasattr(tool_context, "agent_id") and tool_context.agent_id:
                span.set_attribute("tool.agent_id", str(tool_context.agent_id))

        return span

    def track_tool_end(
        self, span: Any, tool_name: str, result: ToolResult, execution_time: float, error: Optional[Exception] = None
    ):
        """
        End tracking a tool execution

        Args:
            span: OpenTelemetry span
            tool_name: Name of the tool
            result: Tool execution result
            execution_time: Execution time in seconds
            error: Exception if execution failed
        """
        if not span or not is_telemetry_enabled():
            return

        try:
            span.set_attribute("tool.execution_time", execution_time)

            if result and result.ok:
                span.set_status(Status(StatusCode.OK))
                span.set_attribute("tool.result.status", "success")
            else:
                # Generate error stack trace
                error_stack = None
                if error:
                    error_stack = traceback.format_exc()
                elif result and not result.ok and result.content:
                    error_stack = f"Tool Error: {result.content}"

                self._record_error(
                    span=span,
                    tool_name=tool_name,
                    result=result,
                    error=error,
                    error_stack=error_stack,
                    execution_time=execution_time,
                )

            # Record metrics
            self._record_metrics(tool_name, result, execution_time)

        finally:
            span.end()


# Global tool monitor instance
_tool_monitor: Optional[ToolMonitor] = None


def get_tool_monitor() -> ToolMonitor:
    """Get the global tool monitor instance"""
    global _tool_monitor
    if _tool_monitor is None:
        _tool_monitor = ToolMonitor()
    return _tool_monitor


def track_tool_execution(
    tool_name: str,
    result: ToolResult,
    execution_time: float,
    error: Optional[Exception] = None,
    error_stack: Optional[str] = None,
    additional_attributes: Optional[Dict[str, Any]] = None,
):
    """
    Convenience function to track tool execution

    Args:
        tool_name: Name of the tool
        result: Tool execution result
        execution_time: Execution time in seconds
        error: Exception if execution failed
        error_stack: Full error stack trace
        additional_attributes: Additional attributes to add to span
    """
    monitor = get_tool_monitor()
    monitor.track_tool_execution(
        tool_name=tool_name,
        result=result,
        execution_time=execution_time,
        error=error,
        error_stack=error_stack,
        additional_attributes=additional_attributes,
    )
