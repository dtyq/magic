"""
OpenTelemetry decorators for non-intrusive tracing

Provides decorators that can be applied to functions and methods
to automatically create spans and track metrics with minimal code changes.

Includes specialized decorators for Langfuse integration, such as
tool call tracking for success/failure metrics.
"""
import functools
import asyncio
import time
from typing import Callable, Any, Optional, Dict
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode
from .span_utils import enrich_span_with_user_context
from .constants import (
    ObservationType,
    ToolStatus,
    LogLevel,
    LangfuseAttributes,
    LangfuseSpanMetadata,
    OpenTelemetryAttributes,
)


def traced(
    span_name: Optional[str] = None,
    attributes: Optional[dict] = None,
    record_exception: bool = True
):
    """
    Decorator to automatically trace function execution

    Args:
        span_name: Custom span name (default: function name)
        attributes: Static attributes to add to the span
        record_exception: Whether to record exceptions in the span

    Usage:
        @traced()
        def my_function():
            pass

        @traced(span_name="custom_name", attributes={"key": "value"})
        async def my_async_function():
            pass
    """
    def decorator(func: Callable) -> Callable:
        # Get tracer for the function's module
        tracer = trace.get_tracer(func.__module__)
        name = span_name or f"{func.__module__}.{func.__name__}"

        if asyncio.iscoroutinefunction(func):
            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                with tracer.start_as_current_span(name) as span:
                    # Enrich span with user context from metadata (for Langfuse)
                    enrich_span_with_user_context(span)

                    # Add static attributes
                    if attributes:
                        for key, value in attributes.items():
                            span.set_attribute(key, value)

                    # Add function metadata
                    span.set_attribute("function.name", func.__name__)
                    span.set_attribute("function.module", func.__module__)

                    try:
                        result = await func(*args, **kwargs)
                        span.set_status(Status(StatusCode.OK))
                        return result
                    except Exception as e:
                        span.set_status(Status(StatusCode.ERROR, str(e)))
                        if record_exception:
                            span.record_exception(e)
                        raise

            return async_wrapper
        else:
            @functools.wraps(func)
            def sync_wrapper(*args, **kwargs):
                with tracer.start_as_current_span(name) as span:
                    # Enrich span with user context from metadata (for Langfuse)
                    enrich_span_with_user_context(span)

                    # Add static attributes
                    if attributes:
                        for key, value in attributes.items():
                            span.set_attribute(key, value)

                    # Add function metadata
                    span.set_attribute("function.name", func.__name__)
                    span.set_attribute("function.module", func.__module__)

                    try:
                        result = func(*args, **kwargs)
                        span.set_status(Status(StatusCode.OK))
                        return result
                    except Exception as e:
                        span.set_status(Status(StatusCode.ERROR, str(e)))
                        if record_exception:
                            span.record_exception(e)
                        raise

            return sync_wrapper

    return decorator


def traced_method(
    span_name: Optional[str] = None,
    attributes: Optional[dict] = None,
    include_class_name: bool = True,
    record_exception: bool = True
):
    """
    Decorator to automatically trace class method execution

    Similar to @traced but optimized for class methods, can include class name

    Args:
        span_name: Custom span name (default: ClassName.method_name)
        attributes: Static attributes to add to the span
        include_class_name: Include class name in span name
        record_exception: Whether to record exceptions in the span

    Usage:
        class MyService:
            @traced_method()
            async def process(self, data):
                pass
    """
    def decorator(func: Callable) -> Callable:
        tracer = trace.get_tracer(func.__module__)

        if asyncio.iscoroutinefunction(func):
            @functools.wraps(func)
            async def async_wrapper(self, *args, **kwargs):
                # Build span name with class name
                if span_name:
                    name = span_name
                elif include_class_name:
                    name = f"{self.__class__.__name__}.{func.__name__}"
                else:
                    name = func.__name__

                with tracer.start_as_current_span(name) as span:
                    # Enrich span with user context from metadata (for Langfuse)
                    enrich_span_with_user_context(span)

                    # Add static attributes
                    if attributes:
                        for key, value in attributes.items():
                            span.set_attribute(key, value)

                    # Add method metadata
                    span.set_attribute("method.name", func.__name__)
                    span.set_attribute("method.class", self.__class__.__name__)
                    span.set_attribute("method.module", func.__module__)

                    try:
                        result = await func(self, *args, **kwargs)
                        span.set_status(Status(StatusCode.OK))
                        return result
                    except Exception as e:
                        span.set_status(Status(StatusCode.ERROR, str(e)))
                        if record_exception:
                            span.record_exception(e)
                        raise

            return async_wrapper
        else:
            @functools.wraps(func)
            def sync_wrapper(self, *args, **kwargs):
                # Build span name with class name
                if span_name:
                    name = span_name
                elif include_class_name:
                    name = f"{self.__class__.__name__}.{func.__name__}"
                else:
                    name = func.__name__

                with tracer.start_as_current_span(name) as span:
                    # Enrich span with user context from metadata (for Langfuse)
                    enrich_span_with_user_context(span)

                    # Add static attributes
                    if attributes:
                        for key, value in attributes.items():
                            span.set_attribute(key, value)

                    # Add method metadata
                    span.set_attribute("method.name", func.__name__)
                    span.set_attribute("method.class", self.__class__.__name__)
                    span.set_attribute("method.module", func.__module__)

                    try:
                        result = func(self, *args, **kwargs)
                        span.set_status(Status(StatusCode.OK))
                        return result
                    except Exception as e:
                        span.set_status(Status(StatusCode.ERROR, str(e)))
                        if record_exception:
                            span.record_exception(e)
                        raise

            return sync_wrapper

    return decorator


def add_span_attributes(**attrs):
    """
    Decorator to add attributes to the current span

    Usage:
        @traced()
        @add_span_attributes(user_id="123", action="create")
        def my_function():
            pass
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            span = trace.get_current_span()
            if span:
                for key, value in attrs.items():
                    span.set_attribute(key, value)
            return func(*args, **kwargs)
        return wrapper
    return decorator


def trace_tool(
    tool_name: Optional[str] = None,
    include_params: bool = True,
    include_result: bool = True,
    max_param_length: int = 200,
    max_result_length: int = 500
):
    """
    Decorator to trace tool execution with Langfuse-compatible metadata

    This decorator marks spans as "tool" type for Langfuse dashboard tracking,
    enabling success/failure rate metrics and tool usage monitoring.

    Features:
    - Automatic success/failure tracking
    - Parameter and result logging (with size limits)
    - Execution time measurement
    - Error handling and reporting
    - Level-based filtering (INFO for success, ERROR for failure)

    Args:
        tool_name: Custom tool name (default: function name)
        include_params: Whether to include function parameters in span
        include_result: Whether to include function result in span
        max_param_length: Maximum length for parameter values (truncated if longer)
        max_result_length: Maximum length for result preview (truncated if longer)

    Usage:
        @trace_tool(tool_name="weather_api")
        async def call_weather_api(location: str):
            # Your tool logic here
            return {"temperature": 25, "condition": "sunny"}

        # For functions that return ToolResult
        @trace_tool()
        async def my_tool_function(params):
            result = ToolResult(ok=True, content="Success")
            return result

    Langfuse Dashboard Integration:
    - Filter by observation type "tool" to see all tool calls
    - Filter by level "ERROR" to see failed tool calls
    - Use tool.success attribute for success/failure metrics
    - Group by tool.name to analyze individual tool performance
    """
    def decorator(func: Callable) -> Callable:
        tracer = trace.get_tracer(func.__module__)
        name = tool_name or func.__name__

        if asyncio.iscoroutinefunction(func):
            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                start_time = time.time()

                with tracer.start_as_current_span(f"tool.{name}") as span:
                    # Langfuse-specific: Mark as tool observation
                    span.set_attribute(OpenTelemetryAttributes.OBSERVATION_TYPE, ObservationType.TOOL.value)
                    span.set_attribute(LangfuseAttributes.OBSERVATION_TYPE, ObservationType.TOOL.value)

                    # Promote key attributes to top-level metadata for filtering (Langfuse requirement)
                    # These will appear at metadata.observation.type, metadata.tool.name, etc. (not nested in attributes)
                    span.set_attribute(LangfuseSpanMetadata.OBSERVATION_TYPE, ObservationType.TOOL.value)
                    span.set_attribute(LangfuseSpanMetadata.TOOL_NAME, name)

                    # Set basic tool attributes
                    span.set_attribute(OpenTelemetryAttributes.TOOL_NAME, name)
                    span.set_attribute("tool.function", func.__name__)
                    span.set_attribute("tool.module", func.__module__)
                    span.set_attribute(OpenTelemetryAttributes.TOOL_STATUS, ToolStatus.RUNNING.value)

                    # Add function docstring as description if available
                    if func.__doc__:
                        doc_str = func.__doc__.strip()[:500]
                        span.set_attribute("tool.description", doc_str)

                    # Add parameters
                    if include_params and kwargs:
                        span.set_attribute("tool.params.keys", ", ".join(kwargs.keys()))
                        span.set_attribute("tool.params.count", len(kwargs))

                        for key, value in kwargs.items():
                            try:
                                value_str = str(value)
                                if len(value_str) > max_param_length:
                                    value_str = value_str[:max_param_length] + "..."
                                span.set_attribute(f"tool.params.{key}", value_str)
                            except Exception:
                                pass

                    try:
                        result = await func(*args, **kwargs)
                        execution_time = time.time() - start_time

                        # Set execution time
                        span.set_attribute(OpenTelemetryAttributes.TOOL_EXECUTION_TIME, execution_time)
                        span.set_attribute(OpenTelemetryAttributes.TOOL_EXECUTION_TIME_MS, int(execution_time * 1000))

                        # Determine success based on result type
                        success = _determine_success(result)
                        span.set_attribute(OpenTelemetryAttributes.TOOL_SUCCESS, success)
                        span.set_attribute(OpenTelemetryAttributes.TOOL_RESULT_OK, success)

                        # Promote success attributes to top-level metadata for filtering
                        span.set_attribute(LangfuseSpanMetadata.TOOL_SUCCESS, success)
                        span.set_attribute(LangfuseSpanMetadata.TOOL_RESULT_OK, success)

                        if success:
                            span.set_attribute(OpenTelemetryAttributes.LEVEL, LogLevel.INFO.value)
                            span.set_attribute(OpenTelemetryAttributes.TOOL_STATUS, ToolStatus.SUCCESS.value)
                            span.set_status(Status(StatusCode.OK))

                            # Add result preview if requested
                            if include_result and result is not None:
                                result_str = _extract_result_preview(result, max_result_length)
                                if result_str:
                                    span.set_attribute(OpenTelemetryAttributes.TOOL_RESULT_PREVIEW, result_str)
                        else:
                            span.set_attribute(OpenTelemetryAttributes.LEVEL, LogLevel.ERROR.value)
                            span.set_attribute(OpenTelemetryAttributes.TOOL_STATUS, ToolStatus.FAILED.value)
                            error_msg = _extract_error_message(result)
                            span.set_status(Status(StatusCode.ERROR, error_msg))
                            span.set_attribute(OpenTelemetryAttributes.ERROR, True)
                            span.set_attribute(OpenTelemetryAttributes.ERROR_TYPE, "tool_execution_failed")
                            span.set_attribute(OpenTelemetryAttributes.ERROR_MESSAGE, error_msg)

                        return result

                    except Exception as e:
                        execution_time = time.time() - start_time
                        span.set_attribute(OpenTelemetryAttributes.TOOL_EXECUTION_TIME, execution_time)
                        span.set_attribute(OpenTelemetryAttributes.TOOL_EXECUTION_TIME_MS, int(execution_time * 1000))
                        span.set_attribute(OpenTelemetryAttributes.LEVEL, LogLevel.ERROR.value)
                        span.set_attribute(OpenTelemetryAttributes.TOOL_STATUS, ToolStatus.EXCEPTION.value)
                        span.set_attribute(OpenTelemetryAttributes.TOOL_SUCCESS, False)
                        span.set_attribute(OpenTelemetryAttributes.TOOL_RESULT_OK, False)
                        # Promote failure attributes to top-level metadata for filtering
                        span.set_attribute(LangfuseSpanMetadata.TOOL_SUCCESS, False)
                        span.set_attribute(LangfuseSpanMetadata.TOOL_RESULT_OK, False)
                        span.set_status(Status(StatusCode.ERROR, str(e)))
                        span.set_attribute(OpenTelemetryAttributes.ERROR, True)
                        span.set_attribute(OpenTelemetryAttributes.ERROR_TYPE, type(e).__name__)
                        span.set_attribute(OpenTelemetryAttributes.ERROR_MESSAGE, str(e))
                        span.record_exception(e)
                        raise

            return async_wrapper
        else:
            @functools.wraps(func)
            def sync_wrapper(*args, **kwargs):
                start_time = time.time()

                with tracer.start_as_current_span(f"tool.{name}") as span:
                    # Langfuse-specific: Mark as tool observation
                    span.set_attribute(OpenTelemetryAttributes.OBSERVATION_TYPE, ObservationType.TOOL.value)
                    span.set_attribute(LangfuseAttributes.OBSERVATION_TYPE, ObservationType.TOOL.value)

                    # Promote key attributes to top-level metadata for filtering (Langfuse requirement)
                    # These will appear at metadata.observation.type, metadata.tool.name, etc. (not nested in attributes)
                    span.set_attribute(LangfuseSpanMetadata.OBSERVATION_TYPE, ObservationType.TOOL.value)
                    span.set_attribute(LangfuseSpanMetadata.TOOL_NAME, name)

                    # Set basic tool attributes
                    span.set_attribute(OpenTelemetryAttributes.TOOL_NAME, name)
                    span.set_attribute("tool.function", func.__name__)
                    span.set_attribute("tool.module", func.__module__)
                    span.set_attribute(OpenTelemetryAttributes.TOOL_STATUS, ToolStatus.RUNNING.value)

                    # Add function docstring as description if available
                    if func.__doc__:
                        doc_str = func.__doc__.strip()[:500]
                        span.set_attribute("tool.description", doc_str)

                    # Add parameters
                    if include_params and kwargs:
                        span.set_attribute("tool.params.keys", ", ".join(kwargs.keys()))
                        span.set_attribute("tool.params.count", len(kwargs))

                        for key, value in kwargs.items():
                            try:
                                value_str = str(value)
                                if len(value_str) > max_param_length:
                                    value_str = value_str[:max_param_length] + "..."
                                span.set_attribute(f"tool.params.{key}", value_str)
                            except Exception:
                                pass

                    try:
                        result = func(*args, **kwargs)
                        execution_time = time.time() - start_time

                        # Set execution time
                        span.set_attribute(OpenTelemetryAttributes.TOOL_EXECUTION_TIME, execution_time)
                        span.set_attribute(OpenTelemetryAttributes.TOOL_EXECUTION_TIME_MS, int(execution_time * 1000))

                        # Determine success based on result type
                        success = _determine_success(result)
                        span.set_attribute(OpenTelemetryAttributes.TOOL_SUCCESS, success)
                        span.set_attribute(OpenTelemetryAttributes.TOOL_RESULT_OK, success)

                        # Promote success attributes to top-level metadata for filtering
                        span.set_attribute(LangfuseSpanMetadata.TOOL_SUCCESS, success)
                        span.set_attribute(LangfuseSpanMetadata.TOOL_RESULT_OK, success)

                        if success:
                            span.set_attribute(OpenTelemetryAttributes.LEVEL, LogLevel.INFO.value)
                            span.set_attribute(OpenTelemetryAttributes.TOOL_STATUS, ToolStatus.SUCCESS.value)
                            span.set_status(Status(StatusCode.OK))

                            # Add result preview if requested
                            if include_result and result is not None:
                                result_str = _extract_result_preview(result, max_result_length)
                                if result_str:
                                    span.set_attribute(OpenTelemetryAttributes.TOOL_RESULT_PREVIEW, result_str)
                        else:
                            span.set_attribute(OpenTelemetryAttributes.LEVEL, LogLevel.ERROR.value)
                            span.set_attribute(OpenTelemetryAttributes.TOOL_STATUS, ToolStatus.FAILED.value)
                            error_msg = _extract_error_message(result)
                            span.set_status(Status(StatusCode.ERROR, error_msg))
                            span.set_attribute(OpenTelemetryAttributes.ERROR, True)
                            span.set_attribute(OpenTelemetryAttributes.ERROR_TYPE, "tool_execution_failed")
                            span.set_attribute(OpenTelemetryAttributes.ERROR_MESSAGE, error_msg)

                        return result

                    except Exception as e:
                        execution_time = time.time() - start_time
                        span.set_attribute(OpenTelemetryAttributes.TOOL_EXECUTION_TIME, execution_time)
                        span.set_attribute(OpenTelemetryAttributes.TOOL_EXECUTION_TIME_MS, int(execution_time * 1000))
                        span.set_attribute(OpenTelemetryAttributes.LEVEL, LogLevel.ERROR.value)
                        span.set_attribute(OpenTelemetryAttributes.TOOL_STATUS, ToolStatus.EXCEPTION.value)
                        span.set_attribute(OpenTelemetryAttributes.TOOL_SUCCESS, False)
                        span.set_attribute(OpenTelemetryAttributes.TOOL_RESULT_OK, False)
                        # Promote failure attributes to top-level metadata for filtering
                        span.set_attribute(LangfuseSpanMetadata.TOOL_SUCCESS, False)
                        span.set_attribute(LangfuseSpanMetadata.TOOL_RESULT_OK, False)
                        span.set_status(Status(StatusCode.ERROR, str(e)))
                        span.set_attribute(OpenTelemetryAttributes.ERROR, True)
                        span.set_attribute(OpenTelemetryAttributes.ERROR_TYPE, type(e).__name__)
                        span.set_attribute(OpenTelemetryAttributes.ERROR_MESSAGE, str(e))
                        span.record_exception(e)
                        raise

            return sync_wrapper

    return decorator


def _determine_success(result: Any) -> bool:
    """
    Determine if tool execution was successful based on result

    Args:
        result: Function return value

    Returns:
        True if successful, False otherwise
    """
    # Check if result is a ToolResult-like object with 'ok' attribute
    if hasattr(result, 'ok'):
        return bool(result.ok)

    # Check if result is a dict with 'success' or 'ok' key
    if isinstance(result, dict):
        if 'success' in result:
            return bool(result['success'])
        if 'ok' in result:
            return bool(result['ok'])
        if 'error' in result:
            return False

    # If result is None, consider it a failure
    if result is None:
        return False

    # Otherwise, assume success if no exception was raised
    return True


def _extract_result_preview(result: Any, max_length: int) -> Optional[str]:
    """
    Extract a preview string from the result

    Args:
        result: Function return value
        max_length: Maximum length for preview

    Returns:
        Preview string or None
    """
    try:
        # For ToolResult-like objects with 'content' attribute
        if hasattr(result, 'content'):
            content = str(result.content)
            return content[:max_length] + "..." if len(content) > max_length else content

        # For dict results
        if isinstance(result, dict):
            import json
            content = json.dumps(result, ensure_ascii=False)
            return content[:max_length] + "..." if len(content) > max_length else content

        # For other types
        content = str(result)
        return content[:max_length] + "..." if len(content) > max_length else content
    except Exception:
        return None


def _extract_error_message(result: Any) -> str:
    """
    Extract error message from failed result

    Args:
        result: Function return value

    Returns:
        Error message string
    """
    # For ToolResult-like objects
    if hasattr(result, 'error') and result.error:
        return str(result.error)
    if hasattr(result, 'content') and not getattr(result, 'ok', True):
        return str(result.content)

    # For dict results
    if isinstance(result, dict):
        if 'error' in result:
            return str(result['error'])
        if 'message' in result:
            return str(result['message'])

    return "Tool execution failed"
