"""
Base Service Class with Auto-Tracing

All services should inherit from this base class to automatically
get tracing capabilities without any explicit imports.
"""
import asyncio
import functools
import inspect
from typing import Optional, Set
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode


class ServiceMeta(type):
    """
    Metaclass that automatically adds tracing to all service methods

    Any class using this metaclass will have all its methods automatically traced.
    No need to import or use decorators!
    """

    def __new__(mcs, name, bases, namespace, **kwargs):
        # Create the class first
        cls = super().__new__(mcs, name, bases, namespace)

        # Skip tracing if telemetry is disabled
        try:
            from app.infrastructure.observability.telemetry import is_telemetry_enabled
            if not is_telemetry_enabled():
                return cls
        except ImportError:
            return cls

        # Get tracer for this class
        module_name = namespace.get('__module__', __name__)
        tracer = trace.get_tracer(module_name)

        # Get service type from class attributes or use class name
        service_type = getattr(cls, 'SERVICE_TYPE', name.replace('Service', '').lower())

        # Methods to exclude from tracing
        exclude_methods = {
            '__init__', '__new__', '__del__', '__repr__', '__str__',
            '__dict__', '__getattribute__', '__setattr__', '__delattr__',
            '__hash__', '__eq__', '__ne__', 'get_instance'
        }

        # Add custom exclusions from class
        if hasattr(cls, 'TRACE_EXCLUDE_METHODS'):
            exclude_methods.update(cls.TRACE_EXCLUDE_METHODS)

        # Wrap all methods
        for attr_name in dir(cls):
            # Skip excluded methods
            if attr_name in exclude_methods:
                continue

            # Skip private methods unless explicitly included
            if attr_name.startswith('_') and not attr_name.startswith('__'):
                include_private = getattr(cls, 'TRACE_INCLUDE_PRIVATE', False)
                if not include_private:
                    continue

            # Skip magic methods
            if attr_name.startswith('__') and attr_name.endswith('__'):
                continue

            try:
                attr = getattr(cls, attr_name)

                # Only wrap callable methods
                if not callable(attr):
                    continue

                # Skip class methods and static methods (they're already wrapped)
                if isinstance(inspect.getattr_static(cls, attr_name), (classmethod, staticmethod)):
                    continue

                # Check if it's an async method
                if asyncio.iscoroutinefunction(attr):
                    wrapped = mcs._wrap_async_method(attr, attr_name, name, service_type, tracer)
                    setattr(cls, attr_name, wrapped)
                elif inspect.isfunction(attr) or inspect.ismethod(attr):
                    wrapped = mcs._wrap_sync_method(attr, attr_name, name, service_type, tracer)
                    setattr(cls, attr_name, wrapped)

            except (AttributeError, TypeError):
                # Skip attributes that can't be wrapped
                continue

        return cls

    @staticmethod
    def _wrap_async_method(method, method_name, class_name, service_type, tracer):
        """Wrap an async method with tracing"""
        @functools.wraps(method)
        async def wrapper(self, *args, **kwargs):
            span_name = f"{class_name}.{method_name}"
            with tracer.start_as_current_span(span_name) as span:
                # Add service metadata
                span.set_attribute("service.type", service_type)
                span.set_attribute("method.name", method_name)
                span.set_attribute("method.class", class_name)

                try:
                    result = await method(self, *args, **kwargs)
                    span.set_status(Status(StatusCode.OK))
                    return result
                except Exception as e:
                    span.set_status(Status(StatusCode.ERROR, str(e)))
                    span.record_exception(e)
                    raise

        return wrapper

    @staticmethod
    def _wrap_sync_method(method, method_name, class_name, service_type, tracer):
        """Wrap a sync method with tracing"""
        @functools.wraps(method)
        def wrapper(self, *args, **kwargs):
            span_name = f"{class_name}.{method_name}"
            with tracer.start_as_current_span(span_name) as span:
                # Add service metadata
                span.set_attribute("service.type", service_type)
                span.set_attribute("method.name", method_name)
                span.set_attribute("method.class", class_name)

                try:
                    result = method(self, *args, **kwargs)
                    span.set_status(Status(StatusCode.OK))
                    return result
                except Exception as e:
                    span.set_status(Status(StatusCode.ERROR, str(e)))
                    span.record_exception(e)
                    raise

        return wrapper


class Base(metaclass=ServiceMeta):
    """
    Base service class with automatic tracing

    All services should inherit from this class to automatically
    get tracing capabilities.

    Usage:
        class AgentService(Base):
            SERVICE_TYPE = "agent"  # Optional: custom service type

            async def init_workspace(self):
                # Automatically traced!
                pass

    Configuration attributes:
        SERVICE_TYPE: str - Custom service type (default: class name without 'Service')
        TRACE_EXCLUDE_METHODS: Set[str] - Additional methods to exclude from tracing
        TRACE_INCLUDE_PRIVATE: bool - Whether to trace private methods (default: False)

    Example with custom config:
        class MyService(Base):
            SERVICE_TYPE = "custom"
            TRACE_EXCLUDE_METHODS = {"_internal_helper"}
            TRACE_INCLUDE_PRIVATE = True
    """

    # Default service type (can be overridden in subclasses)
    SERVICE_TYPE: Optional[str] = None

    # Methods to exclude from tracing (can be extended in subclasses)
    TRACE_EXCLUDE_METHODS: Set[str] = set()

    # Whether to trace private methods (can be overridden in subclasses)
    TRACE_INCLUDE_PRIVATE: bool = False

    def __init_subclass__(cls, **kwargs):
        """Called when a class inherits from Base"""
        super().__init_subclass__(**kwargs)

        # Auto-set SERVICE_TYPE if not specified
        if not hasattr(cls, 'SERVICE_TYPE') or cls.SERVICE_TYPE is None:
            cls.SERVICE_TYPE = cls.__name__.replace('Service', '').lower()
