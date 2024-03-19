"""
WebSocket connection and error tracking

Provides utilities to track WebSocket connections, messages, and errors.
"""

from contextlib import nullcontext
from typing import Optional
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode, SpanKind
from agentlang.utils.metadata import MetadataUtil, MetadataError
from .telemetry import is_telemetry_enabled, get_tracer
import time
import logging

_logger = logging.getLogger(__name__)


def track_websocket_connection(
    client_id: str, connection_type: str = "websocket", additional_attributes: Optional[dict] = None
):
    """
    Start tracking a WebSocket connection

    Args:
        client_id: Unique client identifier
        connection_type: Type of connection (e.g., "websocket", "agent_ws")
        additional_attributes: Additional attributes to add

    Returns:
        Span object (should be used as context manager)

    Usage:
        with track_websocket_connection(client_id, "agent_ws") as span:
            # Handle WebSocket connection
            pass
    """
    if not is_telemetry_enabled():
        # Return a no-op context manager
        return nullcontext()

    tracer = get_tracer(__name__)

    span = tracer.start_span(name=f"ws.connection.{connection_type}", kind=SpanKind.SERVER)

    span.set_attribute("ws.client_id", client_id)
    span.set_attribute("ws.connection_type", connection_type)
    span.set_attribute("ws.connection_start", time.time())

    # Try to get trace_id from metadata
    try:
        metadata = MetadataUtil.get_metadata()
        if "trace_id" in metadata and metadata["trace_id"]:
            span.set_attribute("ws.trace_id", metadata["trace_id"])
            span.set_attribute("trace.source", "metadata.trace_id")
            _logger.debug(f"Using trace_id from metadata: {metadata['trace_id']}")
    except MetadataError as e:
        _logger.debug(f"Could not load metadata: {e}")
    except Exception as e:
        _logger.warning(f"Unexpected error loading metadata: {e}")

    if additional_attributes:
        for key, value in additional_attributes.items():
            span.set_attribute(f"ws.{key}", value)

    return span


def track_websocket_message(
    message_type: str,
    direction: str = "inbound",
    message_size: Optional[int] = None,
    additional_attributes: Optional[dict] = None,
):
    """
    Track a WebSocket message

    Args:
        message_type: Type of message (e.g., "init", "chat", "heartbeat")
        direction: "inbound" or "outbound"
        message_size: Size of message in bytes
        additional_attributes: Additional attributes

    Usage:
        track_websocket_message("chat", "inbound", len(message), {"user_id": user_id})
    """
    if not is_telemetry_enabled():
        return

    span = trace.get_current_span()
    if not span or not span.is_recording():
        return

    # Add message event
    attributes = {
        "ws.message.type": message_type,
        "ws.message.direction": direction,
    }

    if message_size is not None:
        attributes["ws.message.size_bytes"] = message_size

    if additional_attributes:
        for key, value in additional_attributes.items():
            attributes[f"ws.message.{key}"] = value

    span.add_event(name=f"ws.message.{direction}", attributes=attributes)


def track_websocket_error(
    error: Exception, error_context: Optional[str] = None, additional_attributes: Optional[dict] = None
):
    """
    Track a WebSocket error

    Args:
        error: The exception that occurred
        error_context: Additional context about the error
        additional_attributes: Additional attributes

    Usage:
        try:
            await websocket.send_json(data)
        except Exception as e:
            track_websocket_error(e, "Failed to send message", {"client_id": client_id})
            raise
    """
    if not is_telemetry_enabled():
        return

    span = trace.get_current_span()
    if not span or not span.is_recording():
        return

    # Mark span as error
    span.set_status(Status(StatusCode.ERROR, str(error)))

    # Record exception
    span.record_exception(error)

    # Add error attributes
    span.set_attribute("ws.error", True)
    span.set_attribute("ws.error.type", type(error).__name__)

    if error_context:
        span.set_attribute("ws.error.context", error_context)

    if additional_attributes:
        for key, value in additional_attributes.items():
            span.set_attribute(f"ws.error.{key}", value)


def track_websocket_disconnect(
    reason: str = "normal", connection_duration: Optional[float] = None, message_count: Optional[int] = None
):
    """
    Track WebSocket disconnection

    Args:
        reason: Reason for disconnection (e.g., "normal", "timeout", "error")
        connection_duration: How long the connection lasted (seconds)
        message_count: Total messages sent/received

    Usage:
        track_websocket_disconnect("normal", duration, total_messages)
    """
    if not is_telemetry_enabled():
        return

    span = trace.get_current_span()
    if not span or not span.is_recording():
        return

    # Add disconnect event
    attributes = {
        "ws.disconnect.reason": reason,
    }

    if connection_duration is not None:
        attributes["ws.connection.duration_seconds"] = round(connection_duration, 2)

    if message_count is not None:
        attributes["ws.connection.message_count"] = message_count

    span.add_event(name="ws.disconnect", attributes=attributes)

    # Set final status
    if reason == "error":
        span.set_status(Status(StatusCode.ERROR, "Connection closed with error"))
    else:
        span.set_status(Status(StatusCode.OK))


class WebSocketTracker:
    """
    Helper class to track WebSocket connection lifecycle

    Usage:
        tracker = WebSocketTracker(client_id)

        # Connection established
        tracker.connect()

        # Message received
        tracker.track_message("chat", "inbound", len(message))

        # Error occurred
        tracker.track_error(exception)

        # Connection closed
        tracker.disconnect("normal")
    """

    def __init__(self, client_id: str, connection_type: str = "websocket"):
        self.client_id = client_id
        self.connection_type = connection_type
        self.start_time = None
        self.message_count = 0
        self.span = None

    def connect(self, **attributes):
        """Mark connection start"""
        self.start_time = time.time()
        self.message_count = 0

        if is_telemetry_enabled():
            tracer = get_tracer(__name__)
            self.span = tracer.start_span(name=f"ws.connection.{self.connection_type}", kind=SpanKind.SERVER)
            self.span.set_attribute("ws.client_id", self.client_id)
            self.span.set_attribute("ws.connection_type", self.connection_type)

            # Try to get trace_id from metadata
            try:
                metadata = MetadataUtil.get_metadata()
                if "trace_id" in metadata and metadata["trace_id"]:
                    self.span.set_attribute("ws.trace_id", metadata["trace_id"])
                    self.span.set_attribute("trace.source", "metadata.trace_id")
                    _logger.debug(f"Using trace_id from metadata: {metadata['trace_id']}")
            except MetadataError as e:
                _logger.debug(f"Could not load metadata: {e}")
            except Exception as e:
                _logger.warning(f"Unexpected error loading metadata: {e}")

            for key, value in attributes.items():
                self.span.set_attribute(f"ws.{key}", value)

    def track_message(
        self, message_type: str, direction: str = "inbound", message_size: Optional[int] = None, **attributes
    ):
        """Track a message"""
        self.message_count += 1

        if not is_telemetry_enabled() or not self.span:
            return

        event_attributes = {
            "ws.message.type": message_type,
            "ws.message.direction": direction,
            "ws.message.number": self.message_count,
        }

        if message_size is not None:
            event_attributes["ws.message.size_bytes"] = message_size

        for key, value in attributes.items():
            event_attributes[f"ws.message.{key}"] = value

        self.span.add_event(name=f"ws.message.{direction}", attributes=event_attributes)

    def track_error(self, error: Exception, context: Optional[str] = None):
        """Track an error"""
        if not is_telemetry_enabled() or not self.span:
            return

        self.span.set_status(Status(StatusCode.ERROR, str(error)))
        self.span.record_exception(error)
        self.span.set_attribute("ws.error", True)

        if context:
            self.span.set_attribute("ws.error.context", context)

    def disconnect(self, reason: str = "normal"):
        """Mark connection end"""
        if not is_telemetry_enabled() or not self.span:
            return

        duration = time.time() - self.start_time if self.start_time else 0

        self.span.set_attribute("ws.connection.duration_seconds", round(duration, 2))
        self.span.set_attribute("ws.connection.message_count", self.message_count)
        self.span.set_attribute("ws.disconnect.reason", reason)

        if reason == "error":
            self.span.set_status(Status(StatusCode.ERROR, "Connection closed with error"))
        else:
            self.span.set_status(Status(StatusCode.OK))

        self.span.end()
        self.span = None
