"""
Error Tracking and Monitoring

Automatically track errors in logs and application code.
"""
import logging
from typing import Optional
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode
from .telemetry import is_telemetry_enabled


class ErrorTrackingHandler(logging.Handler):
    """
    Logging handler that automatically adds errors to current span

    This handler will:
    1. Add ERROR and CRITICAL level logs to the current span
    2. Mark the span as error if ERROR/CRITICAL is logged
    3. Add log details as span events
    """

    def __init__(self, level=logging.ERROR):
        super().__init__(level)

    def emit(self, record: logging.LogRecord):
        """Emit a log record to the current span"""
        if not is_telemetry_enabled():
            return

        try:
            # Get current span
            span = trace.get_current_span()
            if not span or not span.is_recording():
                return

            # Add log as span event
            attributes = {
                "log.level": record.levelname,
                "log.logger": record.name,
                "log.message": record.getMessage(),
                "log.filename": record.filename,
                "log.lineno": record.lineno,
            }

            # Add exception info if available
            if record.exc_info:
                attributes["log.exception"] = self.format(record)

            # Add event to span
            span.add_event(
                name=f"log.{record.levelname.lower()}",
                attributes=attributes
            )

            # Mark span as error for ERROR/CRITICAL
            if record.levelno >= logging.ERROR:
                span.set_status(Status(StatusCode.ERROR, record.getMessage()))

                # Record exception if available
                if record.exc_info:
                    span.record_exception(record.exc_info[1])

        except Exception:
            # Don't let handler errors break the application
            pass


def install_error_tracking():
    """
    Install error tracking handler to root logger

    This will automatically track all ERROR and CRITICAL logs
    across the entire application.

    Note:
        This function is idempotent - calling it multiple times is safe.
        It checks if the handler is already installed.

    Usage:
        # In your application startup (main.py or ws_server.py)
        from app.infrastructure.observability.error_tracking import install_error_tracking
        install_error_tracking()
    """
    if not is_telemetry_enabled():
        return

    # Get root logger
    root_logger = logging.getLogger()

    # Check if handler already installed (idempotent)
    for handler in root_logger.handlers:
        if isinstance(handler, ErrorTrackingHandler):
            return

    # Add error tracking handler
    handler = ErrorTrackingHandler(level=logging.ERROR)
    handler.setFormatter(logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    ))
    root_logger.addHandler(handler)


def track_error(
    error: Exception,
    error_type: Optional[str] = None,
    additional_attributes: Optional[dict] = None
):
    """
    Manually track an error in the current span

    Args:
        error: The exception to track
        error_type: Custom error type classification
        additional_attributes: Additional attributes to add

    Usage:
        try:
            risky_operation()
        except ValueError as e:
            track_error(e, error_type="validation_error",
                       additional_attributes={"user_id": user_id})
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

    # Add custom attributes
    if error_type:
        span.set_attribute("error.type", error_type)

    if additional_attributes:
        for key, value in additional_attributes.items():
            span.set_attribute(f"error.{key}", value)


def mark_span_error(message: str, error_code: Optional[str] = None):
    """
    Mark current span as error without exception

    Args:
        message: Error message
        error_code: Optional error code

    Usage:
        if invalid_state:
            mark_span_error("Invalid state detected", error_code="INVALID_STATE")
            return error_response
    """
    if not is_telemetry_enabled():
        return

    span = trace.get_current_span()
    if not span or not span.is_recording():
        return

    span.set_status(Status(StatusCode.ERROR, message))

    if error_code:
        span.set_attribute("error.code", error_code)

    span.set_attribute("error.message", message)
