"""
OpenTelemetry observability infrastructure

Provides non-intrusive telemetry with decorators and automatic instrumentation.

Usage:
    # In your application startup (e.g., main.py or ws_server.py):
    from app.infrastructure.observability import setup_telemetry, instrument_fastapi

    setup_telemetry()  # Initialize once at startup
    app = FastAPI()
    instrument_fastapi(app)  # Auto-instrument FastAPI

    # In your business logic:
    from app.infrastructure.observability import traced, traced_method

    @traced()
    async def my_function():
        pass

    class MyService:
        @traced_method()
        async def process(self):
            pass
"""

import logging

# 1. First define and install the logging filter to catch any early initialization errors
class DependencyConflictFilter(logging.Filter):
    """
    Filter to suppress non-critical OpenTelemetry dependency conflict errors.
    """

    def filter(self, record):
        if record.name == "opentelemetry.instrumentation.instrumentor" and record.levelno == logging.ERROR:
            if "DependencyConflict" in str(record.msg):
                return False
        return True


_otel_logger = logging.getLogger("opentelemetry.instrumentation.instrumentor")
_otel_logger.addFilter(DependencyConflictFilter())


# 2. CRITICAL: Import HTTP libraries BEFORE instrumentation packages
# This ensures OpenTelemetry dependency checks pass when instrumentation packages are imported
try:
    import aiohttp  # noqa: F401
except ImportError:
    pass

try:
    import requests  # noqa: F401
except ImportError:
    pass

try:
    import httpx  # noqa: F401
except ImportError:
    pass


# 3. Import submodules and unify symbols
from .aiohttp_integration import (
    instrument_aiohttp,
    uninstrument_aiohttp,
)
from .auto_trace import (
    auto_trace,
)
from .decorators import (
    add_span_attributes,
    trace_tool,
    traced,
    traced_method,
)
from .error_tracking import (
    install_error_tracking,
    mark_span_error,
    track_error,
)
from .fastapi_integration import (
    instrument_fastapi,
    uninstrument_fastapi,
)
from .httpx_integration import (
    instrument_httpx,
    uninstrument_httpx,
)
from .openai_integration import (
    instrument_openai,
    uninstrument_openai,
)
from .requests_integration import (
    instrument_requests,
    uninstrument_requests,
)
from .span_utils import (
    enrich_span_with_user_context,
    get_user_id_from_metadata,
    set_langfuse_metadata,
    set_langfuse_tags,
    set_span_name,
)
from .telemetry import (
    get_meter,
    get_tracer,
    is_telemetry_enabled,
    setup_telemetry,
    shutdown_telemetry,
)
from .tool_monitoring import (
    ToolMonitor,
    get_tool_monitor,
    track_tool_execution,
)
from .tool_monitoring_listener import (
    ToolMonitoringListener,
    get_tool_monitoring_listener,
    install_tool_monitoring_listener,
)
from .websocket_tracking import (
    WebSocketTracker,
    track_websocket_connection,
    track_websocket_disconnect,
    track_websocket_error,
    track_websocket_message,
)

__all__ = [
    # Telemetry setup
    "get_meter",
    "get_tracer",
    "is_telemetry_enabled",
    "setup_telemetry",
    "shutdown_telemetry",
    # Decorators
    "add_span_attributes",
    "trace_tool",
    "traced",
    "traced_method",
    # Auto-tracing
    "auto_trace",
    # FastAPI integration
    "instrument_fastapi",
    "uninstrument_fastapi",
    # HTTP client integrations
    "instrument_aiohttp",
    "instrument_httpx",
    "instrument_openai",
    "instrument_requests",
    "uninstrument_aiohttp",
    "uninstrument_httpx",
    "uninstrument_openai",
    "uninstrument_requests",
    # Error tracking
    "install_error_tracking",
    "mark_span_error",
    "track_error",
    # WebSocket tracking
    "track_websocket_connection",
    "track_websocket_disconnect",
    "track_websocket_error",
    "track_websocket_message",
    "WebSocketTracker",
    # Span utilities (Langfuse integration)
    "enrich_span_with_user_context",
    "get_user_id_from_metadata",
    "set_langfuse_metadata",
    "set_langfuse_tags",
    "set_span_name",
    # Tool monitoring
    "ToolMonitor",
    "ToolMonitoringListener",
    "get_tool_monitor",
    "get_tool_monitoring_listener",
    "install_tool_monitoring_listener",
    "track_tool_execution",
]
