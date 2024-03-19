"""
Auto-tracing decorator for classes

Provides a class decorator that automatically adds tracing to all methods
without manually decorating each method.
"""
import asyncio
import functools
import inspect
from typing import Callable, List, Optional, Set
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode
from .telemetry import is_telemetry_enabled


def auto_trace(
    include_private: bool = False,
    include_magic: bool = False,
    exclude_methods: Optional[Set[str]] = None,
    span_name_prefix: Optional[str] = None,
    attributes: Optional[dict] = None
):
    """
    Class decorator to automatically add tracing to all methods

    Args:
        include_private: Whether to trace private methods (starting with _)
        include_magic: Whether to trace magic methods (starting with __)
        exclude_methods: Set of method names to exclude from tracing
        span_name_prefix: Custom prefix for span names (default: class name)
        attributes: Static attributes to add to all spans

    Usage:
        @auto_trace()
        class MyService:
            async def process(self):
                # Automatically traced!
                pass

        @auto_trace(exclude_methods={"_internal_helper"})
        class AgentService:
            async def init_workspace(self):
                # Traced
                pass

            def _internal_helper(self):
                # Not traced
                pass

    Example with custom config:
        @auto_trace(
            include_private=True,
            exclude_methods={"__init__", "__del__"},
            attributes={"service.type": "agent"}
        )
        class MyService:
            pass
    """
    def decorator(cls):
        # Skip if telemetry is disabled
        if not is_telemetry_enabled():
            return cls

        # Get tracer for this class
        tracer = trace.get_tracer(cls.__module__)

        # Get class name for span naming
        class_name = span_name_prefix or cls.__name__

        # Default exclude set
        if exclude_methods is None:
            default_excludes = {
                "__init__", "__new__", "__del__",
                "__repr__", "__str__", "__dict__",
                "__getattribute__", "__setattr__", "__delattr__"
            }
        else:
            default_excludes = exclude_methods

        # Get all methods from the class
        for name, method in inspect.getmembers(cls, predicate=inspect.isfunction):
            # Skip excluded methods
            if name in default_excludes:
                continue

            # Skip private methods if not included
            if name.startswith('_') and not name.startswith('__'):
                if not include_private:
                    continue

            # Skip magic methods if not included
            if name.startswith('__') and name.endswith('__'):
                if not include_magic:
                    continue

            # Check if it's an async method
            if asyncio.iscoroutinefunction(method):
                # Wrap async method
                @functools.wraps(method)
                async def async_wrapper(self, *args, _original_method=method, _method_name=name, **kwargs):
                    span_name = f"{class_name}.{_method_name}"
                    with tracer.start_as_current_span(span_name) as span:
                        # Add static attributes
                        if attributes:
                            for key, value in attributes.items():
                                span.set_attribute(key, value)

                        # Add method metadata
                        span.set_attribute("method.name", _method_name)
                        span.set_attribute("method.class", class_name)
                        span.set_attribute("method.module", cls.__module__)

                        try:
                            result = await _original_method(self, *args, **kwargs)
                            span.set_status(Status(StatusCode.OK))
                            return result
                        except Exception as e:
                            span.set_status(Status(StatusCode.ERROR, str(e)))
                            span.record_exception(e)
                            raise

                setattr(cls, name, async_wrapper)

            else:
                # Wrap sync method
                @functools.wraps(method)
                def sync_wrapper(self, *args, _original_method=method, _method_name=name, **kwargs):
                    span_name = f"{class_name}.{_method_name}"
                    with tracer.start_as_current_span(span_name) as span:
                        # Add static attributes
                        if attributes:
                            for key, value in attributes.items():
                                span.set_attribute(key, value)

                        # Add method metadata
                        span.set_attribute("method.name", _method_name)
                        span.set_attribute("method.class", class_name)
                        span.set_attribute("method.module", cls.__module__)

                        try:
                            result = _original_method(self, *args, **kwargs)
                            span.set_status(Status(StatusCode.OK))
                            return result
                        except Exception as e:
                            span.set_status(Status(StatusCode.ERROR, str(e)))
                            span.record_exception(e)
                            raise

                setattr(cls, name, sync_wrapper)

        return cls

    return decorator


def trace_all_services(
    base_path: str = "app.service",
    exclude_patterns: Optional[List[str]] = None
):
    """
    Automatically trace all service classes in a module

    This is an advanced feature that uses import hooks to automatically
    add tracing to all services. Use with caution.

    Args:
        base_path: Base module path to scan for services
        exclude_patterns: List of patterns to exclude (e.g., ["__pycache__", "test_"])

    Usage:
        # In your main.py or startup
        from app.infrastructure.observability.auto_trace import trace_all_services
        trace_all_services("app.service")
    """
    # This would require import hooks implementation
    # For now, we'll document it but not implement it
    # to avoid complexity
    raise NotImplementedError(
        "Automatic module-level tracing is not implemented. "
        "Please use @auto_trace() decorator on individual classes."
    )
