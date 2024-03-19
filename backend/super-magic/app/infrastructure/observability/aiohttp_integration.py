"""
aiohttp integration for OpenTelemetry

Provides automatic instrumentation for aiohttp client requests.
"""
import logging
import json
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode
from .telemetry import is_telemetry_enabled
from .constants import LangfuseAttributes

# Import aiohttp library first to ensure dependency check passes
# Then import TraceConfig for custom trace configuration
try:
    import aiohttp  # noqa: F401
    from aiohttp import TraceConfig
    AIOHTTP_TRACE_CONFIG_AVAILABLE = True
except ImportError:
    AIOHTTP_TRACE_CONFIG_AVAILABLE = False
    TraceConfig = None

# Try to import aiohttp instrumentor, but make it optional
try:
    from opentelemetry.instrumentation.aiohttp_client import AioHttpClientInstrumentor
    AIOHTTP_INSTRUMENTATION_AVAILABLE = True
except ImportError:
    AIOHTTP_INSTRUMENTATION_AVAILABLE = False
    logging.warning(
        "opentelemetry-instrumentation-aiohttp-client not available. "
        "Install it with: pip install opentelemetry-instrumentation-aiohttp-client"
    )

# Track if already instrumented
_aiohttp_instrumented = False

_logger = logging.getLogger(__name__)


async def _on_request_start(session, trace_config_ctx, params):
    """
    Hook for aiohttp client request start - updates span name

    params is a SimpleNamespace with:
    - method: HTTP method
    - url: yarl.URL object
    - headers: request headers
    """
    span = trace.get_current_span()
    if not span or not span.is_recording():
        return

    try:
        # Get method (params.method is a string like 'GET', 'POST')
        method = str(params.method)

        # Get URL (params.url is a yarl.URL object)
        url = params.url

        # Get path from URL
        path = url.path or "/"

        # Get query string (yarl.URL uses .query_string attribute)
        # Note: yarl.URL.query_string returns decoded string
        query_string = url.query_string if hasattr(url, 'query_string') else ""

        # Ensure we have a valid path
        if not path or path == "":
            path = "/"

        # Build full path with query string
        if query_string:
            full_path = f"{path}?{query_string}"
        else:
            full_path = path

        # Build span name: "METHOD /path"
        span_name = f"{method} {full_path}"

        # Update span name for both OpenTelemetry and Langfuse
        span.update_name(span_name)
        span.set_attribute(LangfuseAttributes.NAME, span_name)

        # Add combined attribute for easier viewing in Langfuse: "POST https://..."
        span.set_attribute("http.request", f"{method} {url}")

        _logger.debug(f"Set aiohttp client span name: {span_name} (path={path}, url={url})")

    except Exception as e:
        # Fallback: log the error and use basic name
        _logger.debug(f"Failed to update aiohttp span name: {e}")
        try:
            method = str(params.method) if hasattr(params, 'method') else 'HTTP'
            span.update_name(method)
        except Exception:
            pass


async def _on_request_end(session, trace_config_ctx, params):
    """
    Hook for aiohttp client response - marks HTTP errors and captures response body

    This ensures that:
    - Span name is set correctly from method + URL
    - 4xx and 5xx responses are marked as errors in spans
    - Response body is captured for error tracking
    """
    span = trace.get_current_span()
    if not span or not span.is_recording():
        return

    response = params.response if hasattr(params, 'response') else None
    if not response:
        return

    # =========================================================================
    # CRITICAL: Set span name from method and URL
    # This ensures span name is set even if request hook failed
    # =========================================================================
    try:
        method = str(params.method) if hasattr(params, 'method') else None
        url = params.url if hasattr(params, 'url') else None

        if method and url:
            # Get path from yarl.URL
            path = url.path if url.path else "/"

            # Build span name
            span_name = f"{method} {path}"

            # Set span name (this will override any incorrect name)
            span.update_name(span_name)
            span.set_attribute(LangfuseAttributes.NAME, span_name)

            _logger.debug(f"[Response Hook] Re-confirmed aiohttp span name: {span_name}")
    except Exception as e:
        _logger.debug(f"Could not set span name in aiohttp response hook: {e}")

    status_code = response.status

    # Add response status code
    span.set_attribute("http.response.status_code", status_code)

    # Mark errors based on status code and capture response body
    if status_code >= 400:
        # Capture response body for error responses
        response_body = ""
        try:
            # aiohttp response.text() is async
            response_body = await response.text()
        except Exception as e:
            _logger.debug(f"Failed to capture response body as text: {e}")
            # Try to get binary content
            try:
                content = await response.read()
                if content:
                    response_body = f"<binary data, {len(content)} bytes>"
            except Exception:
                pass

        if status_code >= 500:
            # Server errors (5xx) - mark as ERROR
            span.set_status(Status(StatusCode.ERROR, f"HTTP {status_code}"))
            span.set_attribute("error", True)
            span.set_attribute("error.type", "server_error")
            span.set_attribute("error.status_code", status_code)
            span.set_attribute("http.error.category", "5xx")
        elif status_code >= 400:
            # Client errors (4xx) - mark as ERROR too (for visibility in APM)
            span.set_status(Status(StatusCode.ERROR, f"HTTP {status_code}"))
            span.set_attribute("error", True)
            span.set_attribute("error.type", "client_error")
            span.set_attribute("error.status_code", status_code)
            span.set_attribute("http.error.category", "4xx")

        # Record response body as error details
        if response_body:
            # Add as span attribute (limited length)
            body_preview = response_body[:1000] if len(response_body) > 1000 else response_body
            span.set_attribute("http.response.body", body_preview)

            # Also add as an event with full body (better for stack traces)
            span.add_event(
                name="http.error.response",
                attributes={
                    "http.status_code": status_code,
                    "http.response.body": response_body,
                    "error.message": f"HTTP {status_code}: {response_body}",
                }
            )

            # Try to parse as JSON for better error messages
            try:
                body_json = json.loads(response_body)
                if isinstance(body_json, dict):
                    # Extract common error fields
                    if "error" in body_json:
                        span.set_attribute("error.message", str(body_json["error"]))
                    if "message" in body_json:
                        span.set_attribute("error.message", str(body_json["message"]))
                    if "detail" in body_json:
                        span.set_attribute("error.detail", str(body_json["detail"]))
            except (json.JSONDecodeError, TypeError):
                # Not JSON, use raw body as error message
                span.set_attribute("error.message", body_preview)
    else:
        # Success (2xx, 3xx)
        span.set_status(Status(StatusCode.OK))
        span.set_attribute("http.success", True)

    # =========================================================================
    # FINAL: Re-confirm span name at the very end (after all error handling)
    # This is the LAST chance to set it correctly before span finishes
    # =========================================================================
    try:
        method = str(params.method) if hasattr(params, 'method') else None
        url = params.url if hasattr(params, 'url') else None

        if method and url:
            path = url.path if url.path else "/"

            span_name = f"{method} {path}"
            span.update_name(span_name)
            span.set_attribute(LangfuseAttributes.NAME, span_name)

            _logger.debug(f"[FINAL aiohttp] Span name set to: {span_name}")
    except Exception as e:
        _logger.warning(f"Could not set final aiohttp span name: {e}")


def instrument_aiohttp():
    """
    Automatically instrument aiohttp client with OpenTelemetry

    This will automatically:
    - Trace all HTTP requests made with aiohttp.ClientSession
    - Add request/response metadata to spans
    - Track errors (4xx, 5xx, exceptions)
    - Add response time metrics

    Note:
        This function is idempotent - calling it multiple times is safe.

    Usage:
        # In your application startup (ws_server.py)
        from app.infrastructure.observability import instrument_aiohttp
        instrument_aiohttp()

        # Then all aiohttp requests will be automatically traced
        async with aiohttp.ClientSession() as session:
            async with session.get("https://api.example.com/data") as response:
                data = await response.json()
    """
    global _aiohttp_instrumented

    # Idempotent: if already instrumented, just return
    if _aiohttp_instrumented:
        return

    if not is_telemetry_enabled():
        return

    if not AIOHTTP_INSTRUMENTATION_AVAILABLE:
        _logger.info("aiohttp instrumentation skipped (package not installed)")
        return

    try:
        # Create trace config with hooks for span naming and error tracking
        if not AIOHTTP_TRACE_CONFIG_AVAILABLE or TraceConfig is None:
            _logger.warning("aiohttp TraceConfig not available, skipping custom trace config")
            AioHttpClientInstrumentor().instrument()
            _aiohttp_instrumented = True
            _logger.info("aiohttp client instrumentation enabled (without custom trace config)")
            return

        trace_config = TraceConfig()

        # Hook 1: Update span name on request start
        async def on_request_start_hook(session, trace_config_ctx, params):
            """Update span name with full path + query string"""
            await _on_request_start(session, trace_config_ctx, params)

        # Hook 2: Mark errors on request end
        async def on_request_end_hook(session, trace_config_ctx, params):
            """Mark 4xx/5xx as errors"""
            await _on_request_end(session, trace_config_ctx, params)

        trace_config.on_request_start.append(on_request_start_hook)
        trace_config.on_request_end.append(on_request_end_hook)

        # Instrument with trace config
        # Note: We need to pass trace_configs as a list
        AioHttpClientInstrumentor().instrument(
            tracer_provider=None,  # Use default tracer
            trace_configs=[trace_config],
        )
        _aiohttp_instrumented = True
        _logger.info("aiohttp client instrumentation enabled (with span naming and error tracking)")
    except Exception as e:
        # Don't fail if instrumentation fails
        _logger.warning(f"Failed to instrument aiohttp: {e}")


def uninstrument_aiohttp():
    """Remove aiohttp instrumentation"""
    global _aiohttp_instrumented

    if not AIOHTTP_INSTRUMENTATION_AVAILABLE:
        return

    try:
        AioHttpClientInstrumentor().uninstrument()
        _aiohttp_instrumented = False
    except Exception:
        pass
