"""
HTTPX library integration for OpenTelemetry

Provides automatic instrumentation for httpx (modern async/sync HTTP client).
"""
import logging
import json
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode
from .telemetry import is_telemetry_enabled
from .constants import LangfuseAttributes

# Import httpx library first to ensure dependency check passes
try:
    import httpx  # noqa: F401
except ImportError:
    pass

# Try to import httpx instrumentor, but make it optional
try:
    from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
    HTTPX_INSTRUMENTATION_AVAILABLE = True
except ImportError:
    HTTPX_INSTRUMENTATION_AVAILABLE = False
    logging.warning(
        "opentelemetry-instrumentation-httpx not available. "
        "Install it with: pip install opentelemetry-instrumentation-httpx"
    )

# Track if already instrumented
_httpx_instrumented = False

_logger = logging.getLogger(__name__)


def _request_hook(span, request):
    """Hook to enhance httpx request spans with better naming"""
    if not span or not span.is_recording():
        return

    # Add request details
    method = request.method
    url = str(request.url)

    span.set_attribute("http.request.method", method)
    span.set_attribute("http.request.url", url)
    # Combined attribute for easier viewing in Langfuse: "POST https://..."
    span.set_attribute("http.request", f"{method} {url}")

    # Update span name to include method + URL path
    try:
        # httpx.URL has direct access to path and query
        # Try multiple ways to get the path
        path = None

        # Method 1: Direct path attribute
        if hasattr(request.url, 'path') and request.url.path:
            path = request.url.path

        # Method 2: Try raw_path (bytes)
        if not path and hasattr(request.url, 'raw_path'):
            try:
                raw_path = request.url.raw_path
                if raw_path:
                    path = raw_path.decode('utf-8') if isinstance(raw_path, bytes) else str(raw_path)
            except Exception:
                pass

        # Method 3: Parse from full URL string
        if not path:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            path = parsed.path if parsed.path else "/"

        # Ensure we have a valid path
        if not path or path == "":
            path = "/"

        # Include query string if present
        query = ""
        if hasattr(request.url, 'query'):
            query = str(request.url.query) if request.url.query else ""

        if query:
            full_path = f"{path}?{query}"
        else:
            full_path = path

        # Build span name: "METHOD /path"
        span_name = f"{method} {full_path}"

        # Update span name for both OpenTelemetry and Langfuse
        span.update_name(span_name)
        span.set_attribute(LangfuseAttributes.NAME, span_name)

        _logger.debug(f"Set httpx client span name: {span_name} (path={path}, url={url})")
    except Exception as e:
        # Fallback: just use method + full URL
        _logger.warning(f"Failed to extract path from httpx URL: {e}, using full URL")
        span_name = f"{method} {url}"
        span.update_name(span_name)
        span.set_attribute(LangfuseAttributes.NAME, span_name)


def _response_hook(span, request, response):
    """
    Hook to enhance httpx response spans and mark errors

    This hook ensures that:
    - Span name is set correctly from http.method + http.url
    - 4xx errors are marked as errors
    - 5xx errors are marked as errors
    - Response body is captured for error responses
    - Both are visible in APM platforms
    """
    if not span or not span.is_recording():
        return

    # =========================================================================
    # CRITICAL: Set span name from http.method and http.url attributes
    # This is a backup in case request hook didn't set it properly
    # =========================================================================
    try:
        # Get current span context to read attributes
        span_context = span.get_span_context()

        # Try to read from span's attributes (if available)
        # Note: We can't directly read attributes from span, but we can infer from request
        method = request.method if hasattr(request, 'method') else None
        url_str = str(request.url) if hasattr(request, 'url') else None

        if method and url_str:
            # Parse path from URL
            from urllib.parse import urlparse
            parsed = urlparse(url_str)
            path = parsed.path if parsed.path else "/"

            # Build span name
            span_name = f"{method} {path}"

            # Set span name (this will override any incorrect name)
            span.update_name(span_name)
            span.set_attribute(LangfuseAttributes.NAME, span_name)

            _logger.debug(f"[Response Hook] Re-confirmed httpx span name: {span_name}")
    except Exception as e:
        _logger.debug(f"Could not set span name in response hook: {e}")

    status_code = response.status_code

    # Add response details
    span.set_attribute("http.response.status_code", status_code)

    # Mark errors based on status code and capture response body
    if status_code >= 400:
        # Capture response body for error responses
        response_body = ""
        try:
            # Try to get text content
            response_body = response.text
        except Exception as e:
            _logger.debug(f"Failed to capture response body: {e}")
            # Try to get binary content
            try:
                content = response.content
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

        # Re-confirm span name even in error cases
        try:
            method = request.method if hasattr(request, 'method') else None
            url = str(request.url) if hasattr(request, 'url') else None

            if method and url:
                from urllib.parse import urlparse
                parsed = urlparse(url)
                path = parsed.path if parsed.path else "/"

                span_name = f"{method} {path}"
                span.update_name(span_name)
                span.set_attribute(LangfuseAttributes.NAME, span_name)

                _logger.debug(f"[FINAL httpx ERROR] Span name set to: {span_name}")
        except Exception as e:
            _logger.warning(f"Could not set final httpx error span name: {e}")
    else:
        # Success (2xx, 3xx)
        span.set_status(Status(StatusCode.OK))
        span.set_attribute("http.success", True)

    # =========================================================================
    # FINAL: Re-confirm span name at the very end (after all processing)
    # This is the LAST chance to set it correctly before span finishes
    # =========================================================================
    try:
        method = request.method if hasattr(request, 'method') else None
        url = str(request.url) if hasattr(request, 'url') else None

        if method and url:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            path = parsed.path if parsed.path else "/"

            span_name = f"{method} {path}"
            span.update_name(span_name)
            span.set_attribute(LangfuseAttributes.NAME, span_name)

            _logger.debug(f"[FINAL httpx] Span name set to: {span_name}")
    except Exception as e:
        _logger.warning(f"Could not set final httpx span name: {e}")


def instrument_httpx() -> None:
    """
    Automatically instrument httpx library with OpenTelemetry

    This will automatically:
    - Trace all HTTP requests made with httpx.Client and httpx.AsyncClient
    - Add request/response metadata to spans
    - Track errors (connection errors, timeouts, HTTP errors)
    - Integrate with existing traces

    Note:
        This function is idempotent - calling it multiple times is safe.

    Usage:
        # In your application startup (ws_server.py)
        from app.infrastructure.observability import instrument_httpx
        instrument_httpx()

        # Then all httpx calls will be automatically traced
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get("https://api.example.com/data")
    """
    global _httpx_instrumented

    # Idempotent: if already instrumented, just return
    if _httpx_instrumented:
        return

    if not is_telemetry_enabled():
        return

    if not HTTPX_INSTRUMENTATION_AVAILABLE:
        _logger.info("httpx instrumentation skipped (package not installed)")
        return

    try:
        HTTPXClientInstrumentor().instrument(
            request_hook=_request_hook,
            response_hook=_response_hook,
        )
        _httpx_instrumented = True
        _logger.info("httpx library instrumentation enabled (with error tracking)")
    except Exception as e:
        # Don't fail if instrumentation fails
        _logger.warning(f"Failed to instrument httpx: {e}")


def uninstrument_httpx() -> None:
    """Remove httpx instrumentation"""
    global _httpx_instrumented

    if not HTTPX_INSTRUMENTATION_AVAILABLE:
        return

    try:
        HTTPXClientInstrumentor().uninstrument()
        _httpx_instrumented = False
    except Exception:
        pass
