"""
OpenTelemetry span utilities for Langfuse integration

Provides helper functions for enriching spans with Langfuse-specific attributes
such as user_id, session_id, and other metadata.

Reference: https://langfuse.com/docs/observability/features/users
"""

import logging
from typing import Optional
from opentelemetry.trace import Span

from .constants import LangfuseAttributes, OpenTelemetryAttributes

# Import MetadataUtil conditionally to handle import errors
try:
    from agentlang.utils.metadata import MetadataUtil, MetadataError
    METADATA_AVAILABLE = True
except ImportError:
    METADATA_AVAILABLE = False
    MetadataError = Exception

_logger = logging.getLogger(__name__)


def enrich_span_with_user_context(span: Span) -> None:
    """
    Enrich a span with user context from metadata

    Extracts user_id and other user-related information from metadata
    and adds them as Langfuse attributes to the span.

    According to Langfuse documentation:
    - Attribute name: "langfuse.user.id"
    - Value must be string ≤200 characters
    - Should be called early in trace to ensure all observations are covered

    Args:
        span: OpenTelemetry span to enrich

    Reference:
        https://langfuse.com/docs/observability/features/users
    """
    if not span or not span.is_recording():
        return

    if not METADATA_AVAILABLE:
        _logger.debug("MetadataUtil not available, skipping user context enrichment")
        return

    try:
        metadata = MetadataUtil.get_metadata()

        # Extract user_id for Langfuse user tracking
        user_id = metadata.get("user_id")
        if user_id:
            user_id_str = str(user_id)

            # Langfuse expects user_id as string ≤200 characters
            if len(user_id_str) <= 200:
                span.set_attribute(LangfuseAttributes.USER_ID, user_id_str)
                _logger.debug(f"Set {LangfuseAttributes.USER_ID}: {user_id_str}")
            else:
                _logger.warning(
                    f"user_id too long ({len(user_id_str)} chars), "
                    f"max 200 chars allowed. Truncating."
                )
                span.set_attribute(LangfuseAttributes.USER_ID, user_id_str[:200])

        # Optional: Extract organization_code if available
        organization_code = metadata.get("organization_code")
        if organization_code:
            span.set_attribute("organization.code", str(organization_code))
            _logger.debug(f"Set organization.code: {organization_code}")

        # Optional: Extract session information
        # Note: Langfuse also supports session tracking with "langfuse.session.id"
        session_id = metadata.get("chat_topic_id") or metadata.get("topic_id")
        if session_id:
            span.set_attribute(LangfuseAttributes.SESSION_ID, str(session_id))
            _logger.debug(f"Set {LangfuseAttributes.SESSION_ID}: {session_id}")

    except MetadataError as e:
        _logger.debug(f"Could not load metadata for user context: {e}")
    except Exception as e:
        _logger.warning(f"Unexpected error enriching span with user context: {e}")


def enrich_span_with_trace_correlation(span: Span) -> Optional[str]:
    """
    Enrich a span with an external trace_id from metadata, for cross-system correlation.

    The FastAPI root span attaches "external.trace_id" / "request.correlation_id" from
    either metadata or HTTP headers (see fastapi_integration.py). Child spans created
    later in the request lifecycle (e.g. "openai.chat", "tool.*") have no access to the
    original HTTP headers, but the metadata file (init_client_message.json) is still
    readable, so we can at least carry the same trace_id sourced from there.

    Args:
        span: OpenTelemetry span to enrich

    Returns:
        The trace_id found in metadata, or None if unavailable.
    """
    if not span or not span.is_recording():
        return None

    if not METADATA_AVAILABLE:
        return None

    try:
        metadata = MetadataUtil.get_metadata()
        trace_id = metadata.get("trace_id")
        if trace_id:
            trace_id_str = str(trace_id)
            span.set_attribute("trace.source", "metadata.trace_id")
            span.set_attribute("external.trace_id", trace_id_str)
            span.set_attribute("request.correlation_id", trace_id_str)
            return trace_id_str
    except MetadataError as e:
        _logger.debug(f"Could not load metadata for trace correlation: {e}")
    except Exception as e:
        _logger.warning(f"Unexpected error enriching span with trace correlation: {e}")
    return None


def set_langfuse_tags(span: Span, *tags: str) -> None:
    """
    Set Langfuse tags on a span

    Tags help categorize and filter traces in Langfuse.

    Args:
        span: OpenTelemetry span to add tags to
        *tags: Variable number of tag strings

    Reference:
        https://langfuse.com/docs/observability/features/tags
    """
    if not span or not span.is_recording():
        return

    if tags:
        # Langfuse expects tags as an array
        # We use a JSON-like format for the attribute
        tags_list = list(tags)
        span.set_attribute(LangfuseAttributes.TAGS, tags_list)
        _logger.debug(f"Set {LangfuseAttributes.TAGS}: {tags_list}")


def set_langfuse_metadata(span: Span, **metadata_items) -> None:
    """
    Set custom metadata on a span for Langfuse

    Metadata can store any additional context information.

    Args:
        span: OpenTelemetry span to add metadata to
        **metadata_items: Key-value pairs to add as metadata

    Reference:
        https://langfuse.com/docs/observability/features/metadata
    """
    if not span or not span.is_recording():
        return

    for key, value in metadata_items.items():
        # Use langfuse.metadata.* prefix for custom metadata
        attr_key = f"langfuse.metadata.{key}"
        span.set_attribute(attr_key, str(value))
        _logger.debug(f"Set {attr_key}: {value}")


def get_user_id_from_metadata() -> Optional[str]:
    """
    Get user_id from metadata without setting it on a span

    Useful for conditional logic based on user_id.

    Returns:
        Optional[str]: user_id if available, None otherwise
    """
    if not METADATA_AVAILABLE:
        return None

    try:
        metadata = MetadataUtil.get_metadata()
        user_id = metadata.get("user_id")
        return str(user_id) if user_id else None
    except (MetadataError, Exception) as e:
        _logger.debug(f"Could not get user_id from metadata: {e}")
        return None


# Header names whose values must never be recorded (case-insensitive).
_SENSITIVE_HEADERS = frozenset({
    "authorization",
    "proxy-authorization",
    "cookie",
    "set-cookie",
    "x-api-key",
    "api-key",
    "x-auth-token",
    "token",
    "magic-authorization",
})


def redact_headers(headers) -> dict:
    """
    Convert an HTTP headers object to a plain dict, masking sensitive values.

    Accepts anything dict-like or iterable of (key, value) pairs (httpx.Headers,
    requests headers, aiohttp CIMultiDict, etc.). Sensitive header values are
    replaced with "<redacted>" to avoid leaking credentials into traces.

    Args:
        headers: Headers object or iterable of key/value pairs

    Returns:
        Plain dict with sensitive values masked
    """
    result = {}
    try:
        items = headers.items() if hasattr(headers, "items") else headers
        for key, value in items:
            key_str = key.decode() if isinstance(key, bytes) else str(key)
            if key_str.lower() in _SENSITIVE_HEADERS:
                result[key_str] = "<redacted>"
            else:
                result[key_str] = value.decode() if isinstance(value, bytes) else str(value)
    except Exception as e:
        _logger.debug(f"Failed to redact headers: {e}")
    return result


def _to_langfuse_io_value(value, max_length: int = 10000) -> Optional[str]:
    """
    Serialize an input/output value to a string suitable for Langfuse.

    Langfuse reads observation/trace input/output from string attributes. Dicts/lists
    are JSON-encoded; other types are stringified. Oversized payloads are truncated to
    keep span attributes bounded.

    Args:
        value: The value to serialize (dict/list/str/etc.)
        max_length: Max length of the resulting string before truncation

    Returns:
        Serialized string, or None if serialization fails or value is None
    """
    if value is None:
        return None

    try:
        if isinstance(value, (dict, list)):
            import json
            text = json.dumps(value, ensure_ascii=False, default=str)
        else:
            text = str(value)
    except Exception as e:
        _logger.debug(f"Failed to serialize Langfuse IO value: {e}")
        return None

    if len(text) > max_length:
        text = text[:max_length] + "...<truncated>"
    return text


def set_observation_io(span: Span, input_value=None, output_value=None) -> None:
    """
    Set observation-level input/output on a span for Langfuse.

    Fills the Input/Output columns of the observation in the Langfuse UI. Also
    writes the OpenTelemetry GenAI semantic-convention attributes
    (gen_ai.input.messages / gen_ai.output.messages) so that OTEL-native
    backends such as Guance (观测云), which do not parse Langfuse's private
    langfuse.observation.* keys, can still populate their Input/Output panels.

    Args:
        span: OpenTelemetry span to enrich
        input_value: Value for the Input column (dict/list/str). Skipped if None.
        output_value: Value for the Output column (dict/list/str). Skipped if None.
    """
    if not span or not span.is_recording():
        return

    if input_value is not None:
        text = _to_langfuse_io_value(input_value)
        if text is not None:
            span.set_attribute(LangfuseAttributes.OBSERVATION_INPUT, text)
            span.set_attribute(OpenTelemetryAttributes.GEN_AI_INPUT_MESSAGES, text)
            span.set_attribute(OpenTelemetryAttributes.GEN_AI_PROMPT, text)

    if output_value is not None:
        text = _to_langfuse_io_value(output_value)
        if text is not None:
            span.set_attribute(LangfuseAttributes.OBSERVATION_OUTPUT, text)
            span.set_attribute(OpenTelemetryAttributes.GEN_AI_OUTPUT_MESSAGES, text)
            span.set_attribute(OpenTelemetryAttributes.GEN_AI_COMPLETION, text)


def set_trace_io(span: Span, input_value=None, output_value=None) -> None:
    """
    Set trace-level input/output on the ROOT span for Langfuse.

    Fills the Input/Output columns of the trace in the Langfuse UI. Only meaningful
    on the root span of a trace (e.g. the FastAPI server span). Also writes the
    OpenTelemetry GenAI semantic-convention attributes
    (gen_ai.input.messages / gen_ai.output.messages) so that OTEL-native backends
    such as Guance (观测云) can populate their Input/Output panels.

    Args:
        span: Root OpenTelemetry span to enrich
        input_value: Value for the trace Input column. Skipped if None.
        output_value: Value for the trace Output column. Skipped if None.
    """
    if not span or not span.is_recording():
        return

    if input_value is not None:
        text = _to_langfuse_io_value(input_value)
        if text is not None:
            span.set_attribute(LangfuseAttributes.TRACE_INPUT, text)
            span.set_attribute(LangfuseAttributes.OBSERVATION_INPUT, text)
            span.set_attribute(OpenTelemetryAttributes.GEN_AI_INPUT_MESSAGES, text)
            span.set_attribute(OpenTelemetryAttributes.GEN_AI_PROMPT, text)

    if output_value is not None:
        text = _to_langfuse_io_value(output_value)
        if text is not None:
            span.set_attribute(LangfuseAttributes.TRACE_OUTPUT, text)
            span.set_attribute(LangfuseAttributes.OBSERVATION_OUTPUT, text)
            span.set_attribute(OpenTelemetryAttributes.GEN_AI_OUTPUT_MESSAGES, text)
            span.set_attribute(OpenTelemetryAttributes.GEN_AI_COMPLETION, text)


def set_span_name(span: Span, name: str) -> None:
    """
    Set both the OpenTelemetry span name and Langfuse name attribute

    This ensures the span name is properly displayed in both
    OpenTelemetry-compatible tools and Langfuse UI.

    Args:
        span: OpenTelemetry span to update
        name: The name to set (e.g., "POST /api/v1/messages")

    Example:
        ```python
        from opentelemetry import trace
        from app.infrastructure.observability import set_span_name

        tracer = trace.get_tracer(__name__)
        with tracer.start_as_current_span("operation") as span:
            # Set a more descriptive name
            set_span_name(span, "POST /api/users")
        ```
    """
    if not span or not span.is_recording():
        return

    # Update OpenTelemetry span name
    span.update_name(name)

    # Set Langfuse name attribute for better display
    span.set_attribute(LangfuseAttributes.NAME, name)
    span.set_attribute(LangfuseAttributes.OBSERVATION_NAME, name)

    _logger.debug(f"Set span name: {name}")


def set_trace_name(span: Span, name: str) -> None:
    """
    Set the Langfuse trace-level name on the ROOT span.

    The trace Name column in the Langfuse UI is derived from ``langfuse.trace.name``
    (or the root span). Setting only ``langfuse.name`` or the span name is NOT enough
    to populate the trace Name column, so call this on the root span (e.g. the FastAPI
    server span).

    Args:
        span: Root OpenTelemetry span
        name: The trace name (e.g. "POST /api/v1/messages")
    """
    if not span or not span.is_recording():
        return

    span.set_attribute(LangfuseAttributes.TRACE_NAME, name)
    _logger.debug(f"Set trace name: {name}")
