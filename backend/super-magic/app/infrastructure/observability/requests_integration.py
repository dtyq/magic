"""
Requests library integration for OpenTelemetry

Provides automatic instrumentation for requests (synchronous HTTP client).
"""
import logging
import json
from urllib.parse import urlparse
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode
from .telemetry import is_telemetry_enabled
from .constants import LangfuseAttributes

# Import requests library first to ensure dependency check passes
try:
    import requests  # noqa: F401
except ImportError:
    pass

# Try to import requests instrumentor, but make it optional
try:
    from opentelemetry.instrumentation.requests import RequestsInstrumentor
    REQUESTS_INSTRUMENTATION_AVAILABLE = True
except ImportError:
    REQUESTS_INSTRUMENTATION_AVAILABLE = False
    logging.warning(
        "opentelemetry-instrumentation-requests not available. "
        "Install it with: pip install opentelemetry-instrumentation-requests"
    )

# Track if already instrumented
_requests_instrumented = False

_logger = logging.getLogger(__name__)


def _request_hook(span, request_obj):
    """Hook to enhance requests spans with better naming"""
    if not span or not span.is_recording():
        return

    # Add request details
    method = request_obj.method
    url = request_obj.url

    span.set_attribute("http.request.method", method)
    span.set_attribute("http.request.url", url)
    # Combined attribute for easier viewing in Langfuse: "POST https://..."
    span.set_attribute("http.request", f"{method} {url}")

    # Update span name to include method + URL path
    # Parse URL to get path
    try:
        parsed = urlparse(url)
        path = parsed.path

        # Ensure we have a valid path
        if not path or path == "":
            path = "/"

        # Include query string if present
        if parsed.query:
            full_path = f"{path}?{parsed.query}"
        else:
            full_path = path

        # Build span name: "METHOD /path"
        span_name = f"{method} {full_path}"

        # Update span name for both OpenTelemetry and Langfuse
        span.update_name(span_name)
        span.set_attribute(LangfuseAttributes.NAME, span_name)

        _logger.debug(f"Set requests client span name: {span_name} (path={path}, url={url})")
    except Exception as e:
        # Fallback: just use method + full URL
        _logger.warning(f"Failed to extract path from requests URL: {e}, using full URL")
        span_name = f"{method} {url}"
        span.update_name(span_name)
        span.set_attribute(LangfuseAttributes.NAME, span_name)


def _response_hook(span, request_obj, response_obj):
    """
    Hook to enhance requests response spans and mark errors

    This hook ensures that:
    - Span name is set correctly from method + URL
    - 4xx errors are marked as errors (for visibility)
    - 5xx errors are marked as errors
    - Response body is captured for error responses
    - Both are visible in APM platforms
    """
    if not span or not span.is_recording():
        return

    # =========================================================================
    # CRITICAL: Set span name from method and URL
    # This ensures span name is set even if request hook failed
    # =========================================================================
    try:
        method = request_obj.method if hasattr(request_obj, 'method') else None
        url = request_obj.url if hasattr(request_obj, 'url') else None

        if method and url:
            # Parse path from URL
            from urllib.parse import urlparse
            parsed = urlparse(url)
            path = parsed.path if parsed.path else "/"

            # Build span name
            span_name = f"{method} {path}"

            # Set span name (this will override any incorrect name)
            span.update_name(span_name)
            span.set_attribute(LangfuseAttributes.NAME, span_name)

            _logger.debug(f"[Response Hook] Re-confirmed requests span name: {span_name}")
    except Exception as e:
        _logger.debug(f"Could not set span name in requests response hook: {e}")

    status_code = response_obj.status_code

    # Add response details
    span.set_attribute("http.response.status_code", status_code)

    # Mark errors based on status code and capture response body
    if status_code >= 400:
        # Capture response body for error responses
        response_body = ""
        try:
            # Try to get text content
            response_body = response_obj.text
        except Exception as e:
            _logger.debug(f"Failed to capture response body: {e}")
            # Try to get binary content
            try:
                content = response_obj.content
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
    # FINAL: Re-confirm span name at the very end (after all processing)
    # This is the LAST chance to set it correctly before span finishes
    # =========================================================================
    try:
        method = request_obj.method if hasattr(request_obj, 'method') else None
        url = request_obj.url if hasattr(request_obj, 'url') else None

        if method and url:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            path = parsed.path if parsed.path else "/"

            span_name = f"{method} {path}"
            span.update_name(span_name)
            span.set_attribute(LangfuseAttributes.NAME, span_name)

            _logger.debug(f"[FINAL requests] Span name set to: {span_name}")
    except Exception as e:
        _logger.warning(f"Could not set final requests span name: {e}")


def instrument_requests() -> None:
    """
    Automatically instrument requests library with OpenTelemetry

    This will automatically:
    - Trace all HTTP requests made with requests.get/post/put/delete/patch
    - Add request/response metadata to spans
    - Track errors (connection errors, timeouts, HTTP errors)
    - Integrate with existing traces

    Note:
        This function is idempotent - calling it multiple times is safe.

    Usage:
        # In your application startup (ws_server.py)
        from app.infrastructure.observability import instrument_requests
        instrument_requests()

        # Then all requests calls will be automatically traced
        import requests
        response = requests.get("https://api.example.com/data")
    """
    global _requests_instrumented

    # Idempotent: if already instrumented, just return
    if _requests_instrumented:
        return

    if not is_telemetry_enabled():
        return

    if not REQUESTS_INSTRUMENTATION_AVAILABLE:
        _logger.info("requests instrumentation skipped (package not installed)")
        return

    try:
        RequestsInstrumentor().instrument(
            request_hook=_request_hook,
            response_hook=_response_hook,
        )
        _requests_instrumented = True
        _logger.info("requests library instrumentation enabled (with error tracking)")
    except Exception as e:
        # Don't fail if instrumentation fails
        _logger.warning(f"Failed to instrument requests: {e}")


def uninstrument_requests() -> None:
    """Remove requests instrumentation"""
    global _requests_instrumented

    if not REQUESTS_INSTRUMENTATION_AVAILABLE:
        return

    try:
        RequestsInstrumentor().uninstrument()
        _requests_instrumented = False
    except Exception:
        pass
