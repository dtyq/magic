"""
FastAPI integration for OpenTelemetry

Provides automatic instrumentation for FastAPI applications
with minimal code changes and enhanced error tracking.
"""

from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import StreamingResponse
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode, SpanContext, TraceFlags
from opentelemetry.sdk.trace import SpanProcessor
from agentlang.utils.metadata import MetadataUtil, MetadataError
from .telemetry import is_telemetry_enabled
from .constants import LangfuseAttributes
from .span_utils import enrich_span_with_user_context
import time
import json
import logging

_logger = logging.getLogger(__name__)

# Try to import FastAPI instrumentor, but make it optional
try:
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

    FASTAPI_INSTRUMENTATION_AVAILABLE = True
except ImportError:
    FASTAPI_INSTRUMENTATION_AVAILABLE = False
    import logging

    logging.warning(
        "opentelemetry-instrumentation-fastapi not available. "
        "Install it with: pip install opentelemetry-instrumentation-fastapi"
    )


def _server_request_hook(span, scope):
    """
    Hook to enhance server request spans with additional attributes

    This adds more detailed information to the span, including:
    - Full HTTP URL with query parameters
    - Route template (e.g., /api/users/{user_id})
    - Query parameters
    - Updates span name to include HTTP method + full path
    - Extracts trace_id with priority: metadata.trace_id > header.trace_id > request-id > auto-generated
    """
    if not span or not span.is_recording():
        return

    # =====================================================================
    # Priority 1: Extract trace_id from metadata and enrich with user context
    # =====================================================================
    external_trace_id = None

    # Enrich span with user context (user_id, session_id, etc.) for Langfuse
    enrich_span_with_user_context(span)

    try:
        metadata = MetadataUtil.get_metadata()

        # Extract trace_id
        if "trace_id" in metadata and metadata["trace_id"]:
            external_trace_id = metadata["trace_id"]
            span.set_attribute("trace.source", "metadata.trace_id")
            _logger.debug(f"Using trace_id from metadata: {external_trace_id}")
    except MetadataError as e:
        _logger.debug(f"Could not load metadata: {e}")
    except Exception as e:
        _logger.warning(f"Unexpected error loading metadata: {e}")

    # =====================================================================
    # Priority 2: Extract trace_id from headers (if not found in metadata)
    # Priority: "trace_id" header > "trace-id" header > "request-id" header
    # =====================================================================
    if not external_trace_id:
        headers = dict(scope.get("headers", []))

        # Convert header keys from bytes to strings (lowercase for comparison)
        header_dict = {}
        for key, value in headers.items():
            if isinstance(key, bytes):
                key = key.decode("utf-8").lower()
            if isinstance(value, bytes):
                value = value.decode("utf-8")
            header_dict[key] = value

        # Try to get trace_id from headers (priority order)
        if "trace_id" in header_dict:
            external_trace_id = header_dict["trace_id"]
            span.set_attribute("trace.source", "header.trace_id")
            _logger.debug(f"Using trace_id from header: {external_trace_id}")
        elif "trace-id" in header_dict:
            external_trace_id = header_dict["trace-id"]
            span.set_attribute("trace.source", "header.trace-id")
            _logger.debug(f"Using trace-id from header: {external_trace_id}")
        elif "request-id" in header_dict:
            external_trace_id = header_dict["request-id"]
            span.set_attribute("trace.source", "header.request-id")
            _logger.debug(f"Using request-id from header: {external_trace_id}")

    # =====================================================================
    # If no trace_id found from any source, mark as auto-generated
    # =====================================================================
    if not external_trace_id:
        span.set_attribute("trace.source", "auto-generated")

    # If we have an external trace_id, record it as an attribute
    if external_trace_id:
        span.set_attribute("external.trace_id", external_trace_id)
        span.set_attribute("request.correlation_id", external_trace_id)

    # Get HTTP method
    method = scope.get("method", "HTTP")

    # Get query string first (we'll need it for the span name)
    query_string_bytes = scope.get("query_string")
    query_string = ""
    if query_string_bytes:
        query_string = query_string_bytes.decode("utf-8")
        span.set_attribute("http.query_string", query_string)

    # Build full URL for http.request attribute
    # Get scheme (http/https)
    scheme = scope.get("scheme", "http")
    # Get host and port from headers
    headers = dict(scope.get("headers", []))
    host_header = None
    for key, value in headers.items():
        if isinstance(key, bytes) and key.lower() == b"host":
            host_header = value.decode("utf-8") if isinstance(value, bytes) else value
            break
    # Get path
    path = scope.get("path", "")
    # Construct full URL
    if host_header:
        full_url = f"{scheme}://{host_header}{path}"
        if query_string:
            full_url += f"?{query_string}"
        # Add combined attribute: "POST https://api.example.com/path"
        span.set_attribute("http.request", f"{method} {full_url}")

    # Try to get route template first (for parametrized routes)
    route = scope.get("route")
    if route and hasattr(route, "path"):
        # Add the route path template for better span grouping
        route_path = route.path
        span.set_attribute("http.route", route_path)
        span.set_attribute("http.route_name", route.name if hasattr(route, "name") else "")

        # Build full path with query string
        if query_string:
            full_path = f"{route_path}?{query_string}"
        else:
            full_path = route_path

        # Build span name: METHOD PATH
        span_name = f"{method} {full_path}"

        # Update span name
        span.update_name(span_name)

        # Set Langfuse name attribute for better display
        span.set_attribute(LangfuseAttributes.NAME, span_name)

    else:
        # Fallback: use the actual path if route is not available
        # This handles static files, WebSocket upgrades, and unmatched routes
        path = scope.get("path", "")
        if path:
            # Build full path with query string
            if query_string:
                full_path = f"{path}?{query_string}"
            else:
                full_path = path

            # Build span name: METHOD PATH
            span_name = f"{method} {full_path}"

            # Update span name
            span.update_name(span_name)

            # Set Langfuse name attribute for better display
            span.set_attribute(LangfuseAttributes.NAME, span_name)
        else:
            # Last resort: at least update with method
            span.update_name(method)
            span.set_attribute(LangfuseAttributes.NAME, method)

    # Add path parameters if available
    path_params = scope.get("path_params", {})
    if path_params:
        for key, value in path_params.items():
            span.set_attribute(f"http.path_param.{key}", str(value))


class HTTPErrorTrackingMiddleware:
    """
    Pure ASGI Middleware to track HTTP errors and capture response bodies

    This middleware adds:
    - Request details (method, path, headers)
    - Response status codes
    - Error tracking for 4xx and 5xx responses
    - Response body capture for error responses (by intercepting ASGI messages)
    - Response time metrics
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not is_telemetry_enabled():
            await self.app(scope, receive, send)
            return

        # Get current span
        span = trace.get_current_span()

        # Set span name early to ensure it's not overwritten
        # Build span name: METHOD PATH
        method = scope.get("method", "HTTP")
        path = scope.get("path", "")
        route = scope.get("route")

        if route and hasattr(route, "path"):
            # Use route template for better grouping
            route_path = route.path
            span_name = f"{method} {route_path}"
        elif path:
            # Fallback to actual path
            span_name = f"{method} {path}"
        else:
            span_name = method

        # Set span name with both OpenTelemetry and Langfuse attributes
        if span and span.is_recording():
            span.update_name(span_name)
            span.set_attribute(LangfuseAttributes.NAME, span_name)
            _logger.debug(f"Set span name in middleware: {span_name}")

        # Record start time
        start_time = time.time()

        # Variables to capture response data
        status_code = None
        response_body_parts = []

        async def send_wrapper(message):
            nonlocal status_code

            if message["type"] == "http.response.start":
                status_code = message["status"]

            elif message["type"] == "http.response.body":
                # Capture response body
                body = message.get("body", b"")
                if body:
                    response_body_parts.append(body)

                # CRITICAL: Process error BEFORE sending (while span is still recording)
                more_body = message.get("more_body", False)
                if not more_body and status_code and status_code >= 400:
                    await self._process_error_response(span, status_code, response_body_parts, start_time, scope)

                # Now send the message (span attributes already set)
                await send(message)
                return

            # Send the message
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)

            # Add success status if 2xx/3xx
            if status_code and status_code < 400 and span and span.is_recording():
                span.set_status(Status(StatusCode.OK))
                span.set_attribute("http.success", True)
                response_time = (time.time() - start_time) * 1000
                span.set_attribute("http.response_time_ms", round(response_time, 2))

                # Re-confirm span name after request completes
                # (FastAPI instrumentor might have overwritten it)
                method = scope.get("method", "HTTP")
                route = scope.get("route")
                path = scope.get("path", "")

                if route and hasattr(route, "path"):
                    span_name = f"{method} {route.path}"
                elif path:
                    span_name = f"{method} {path}"
                else:
                    span_name = method

                span.update_name(span_name)
                span.set_attribute(LangfuseAttributes.NAME, span_name)
                _logger.debug(f"Re-confirmed span name after completion: {span_name}")

        except Exception as e:
            # Exception occurred
            response_time = (time.time() - start_time) * 1000

            if span and span.is_recording():
                span.set_status(Status(StatusCode.ERROR, str(e)))
                span.record_exception(e)
                span.set_attribute("http.response_time_ms", round(response_time, 2))
                span.set_attribute("error.type", "exception")
                span.set_attribute("error.exception_type", type(e).__name__)

            raise

    async def _process_error_response(self, span, status_code, body_parts, start_time, scope=None):
        """Process error response and add span attributes"""
        if not span or not span.is_recording():
            return

        # Ensure span name is still set correctly even in error cases
        # FastAPI instrumentor might have overwritten it
        if scope:
            method = scope.get("method", "HTTP")
            path = scope.get("path", "")
            route = scope.get("route")

            if route and hasattr(route, "path"):
                route_path = route.path
                span_name = f"{method} {route_path}"
            elif path:
                span_name = f"{method} {path}"
            else:
                span_name = method

            span.update_name(span_name)
            span.set_attribute(LangfuseAttributes.NAME, span_name)

        # Calculate response time
        response_time = (time.time() - start_time) * 1000

        # Add basic attributes
        span.set_attribute("http.status_code", status_code)
        span.set_attribute("http.response_time_ms", round(response_time, 2))

        # Combine body parts
        try:
            response_body_bytes = b"".join(body_parts)
            response_body = response_body_bytes.decode("utf-8")
        except UnicodeDecodeError:
            response_body = f"<binary data, {len(response_body_bytes)} bytes>"
        except Exception as e:
            _logger.debug(f"Failed to decode response body: {e}")
            response_body = ""

        error_msg = f"HTTP {status_code}"

        # Mark as error
        if status_code >= 500:
            # Server errors - critical
            span.set_status(Status(StatusCode.ERROR, error_msg))
            span.set_attribute("error.type", "server_error")
            span.set_attribute("error.category", "5xx")
        elif status_code >= 400:
            # Client errors - warning (still mark as ERROR for APM)
            span.set_status(Status(StatusCode.ERROR, error_msg))
            span.set_attribute("http.error", True)
            span.set_attribute("error.type", "client_error")
            span.set_attribute("error.category", "4xx")

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
                    "http.response.body": response_body[:5000],  # Limit event body to 5000 chars
                    "error.message": f"HTTP {status_code}: {body_preview}",
                },
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


def instrument_fastapi(app: FastAPI, track_errors: bool = True) -> None:
    """
    Automatically instrument FastAPI application with OpenTelemetry

    This will automatically:
    - Trace all HTTP requests
    - Add request/response metadata to spans
    - Track errors (4xx, 5xx, exceptions)
    - Add response time metrics
    - Integrate with existing traces

    Args:
        app: FastAPI application instance
        track_errors: Whether to add error tracking middleware (default: True)

    Usage:
        app = FastAPI()
        instrument_fastapi(app)
    """
    if not is_telemetry_enabled():
        return

    # Add error tracking middleware first (so it wraps everything)
    if track_errors:
        app.add_middleware(HTTPErrorTrackingMiddleware)

    # Add standard instrumentation
    if not FASTAPI_INSTRUMENTATION_AVAILABLE:
        _logger.info("FastAPI instrumentation skipped (package not installed)")
        return

    try:
        # Configure FastAPI instrumentor with better span names
        FastAPIInstrumentor.instrument_app(
            app,
            # Use more detailed span names (include HTTP method + route)
            server_request_hook=_server_request_hook,
            client_request_hook=None,  # Not needed for server instrumentation
        )
        _logger.info("FastAPI instrumentation enabled with detailed span names")
    except Exception as e:
        # Don't fail if instrumentation fails
        _logger.warning(f"Failed to instrument FastAPI: {e}")


def uninstrument_fastapi(app: FastAPI) -> None:
    """Remove FastAPI instrumentation"""
    if not FASTAPI_INSTRUMENTATION_AVAILABLE:
        return

    try:
        FastAPIInstrumentor.uninstrument_app(app)
    except Exception:
        pass
