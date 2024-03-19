"""
OpenTelemetry span utilities for Langfuse integration

Provides helper functions for enriching spans with Langfuse-specific attributes
such as user_id, session_id, and other metadata.

Reference: https://langfuse.com/docs/observability/features/users
"""

import logging
from typing import Optional
from opentelemetry.trace import Span

from .constants import LangfuseAttributes

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

    _logger.debug(f"Set span name: {name}")
