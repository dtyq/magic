"""
OpenTelemetry telemetry initialization and configuration

Provides non-intrusive telemetry setup with automatic instrumentation
"""
import os
import logging
from typing import Optional
from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader, ConsoleMetricExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.instrumentation.logging import LoggingInstrumentor

from agentlang.utils.metadata import MetadataUtil

from .constants import (
    LangfuseEndpoints,
    DefaultConfig,
)

logger = logging.getLogger(__name__)

# Try to import OTLP exporters, but make them optional
# gRPC exporters
try:
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter as GrpcOTLPSpanExporter
    OTLP_GRPC_TRACE_EXPORTER_AVAILABLE = True
except ImportError:
    OTLP_GRPC_TRACE_EXPORTER_AVAILABLE = False
    GrpcOTLPSpanExporter = None

try:
    from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter as GrpcOTLPMetricExporter
    OTLP_GRPC_METRIC_EXPORTER_AVAILABLE = True
except ImportError:
    OTLP_GRPC_METRIC_EXPORTER_AVAILABLE = False
    GrpcOTLPMetricExporter = None

# HTTP exporters
try:
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter as HttpOTLPSpanExporter
    OTLP_HTTP_TRACE_EXPORTER_AVAILABLE = True
except ImportError:
    OTLP_HTTP_TRACE_EXPORTER_AVAILABLE = False
    HttpOTLPSpanExporter = None

try:
    from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter as HttpOTLPMetricExporter
    OTLP_HTTP_METRIC_EXPORTER_AVAILABLE = True
except ImportError:
    OTLP_HTTP_METRIC_EXPORTER_AVAILABLE = False
    HttpOTLPMetricExporter = None

# Initialize global providers
_tracer_provider: Optional[TracerProvider] = None
_meter_provider: Optional[MeterProvider] = None
_initialized = False


def is_telemetry_enabled() -> bool:
    """Check if telemetry is enabled via environment variable"""
    return os.getenv("ENABLE_TELEMETRY", "false").lower() in ("true", "1", "yes")


def get_otlp_protocol() -> str:
    """
    Get OTLP protocol from environment variable

    Returns:
        Protocol string: 'http' or 'grpc' (defaults to 'http')
    """
    protocol = os.getenv("OTEL_EXPORTER_OTLP_PROTOCOL", "http").lower()
    # Normalize protocol names
    if protocol in ("http", "http/protobuf"):
        return "http"
    return "grpc"


def get_otlp_headers() -> dict:
    """
    Get OTLP headers from environment variables

    Supports both OTEL_EXPORTER_OTLP_HEADERS and MAGIC_AUTHORIZATION

    Returns:
        Dictionary of headers
    """
    headers = {}

    # Parse OTEL_EXPORTER_OTLP_HEADERS (format: key1=value1,key2=value2)
    otlp_headers = os.getenv("OTEL_EXPORTER_OTLP_HEADERS", "")
    if otlp_headers:
        for header_pair in otlp_headers.split(","):
            if "=" in header_pair:
                key, value = header_pair.split("=", 1)
                headers[key.strip()] = value.strip()

    # Add Magic-Authorization and User-Authorization if available
    MetadataUtil.add_magic_and_user_authorization_headers(headers)

    return headers


def setup_telemetry(
    service_name: Optional[str] = None,
    service_version: Optional[str] = None,
    environment: Optional[str] = None,
) -> tuple[Optional[TracerProvider], Optional[MeterProvider]]:
    """
    Initialize OpenTelemetry SDK with minimal configuration

    Args:
        service_name: Service name for telemetry (default: from env or 'super-magic')
        service_version: Service version (default: from GIT_COMMIT_ID env)
        environment: Deployment environment (default: from ENVIRONMENT env)

    Returns:
        Tuple of (TracerProvider, MeterProvider) or (None, None) if disabled

    Note:
        This function is idempotent - calling it multiple times is safe.
    """
    global _tracer_provider, _meter_provider, _initialized

    # Idempotent: if already initialized, just return existing providers
    if _initialized:
        return _tracer_provider, _meter_provider

    if not is_telemetry_enabled():
        return None, None

    # Get configuration from environment with defaults
    service_name = service_name or os.getenv("OTEL_SERVICE_NAME", DefaultConfig.DEFAULT_SERVICE_NAME)
    service_version = service_version or os.getenv("GIT_COMMIT_ID", DefaultConfig.DEFAULT_SERVICE_VERSION)
    environment = environment or os.getenv("ENVIRONMENT", DefaultConfig.DEFAULT_ENVIRONMENT)

    # Support separate endpoints for traces and metrics (OpenTelemetry standard)
    # Priority: specific endpoint > general endpoint
    # Ensure endpoints are not empty strings
    otlp_traces_endpoint = (
        os.getenv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT") or
        os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT") or
        None
    )
    otlp_metrics_endpoint = (
        os.getenv("OTEL_EXPORTER_OTLP_METRICS_ENDPOINT") or
        os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT") or
        None
    )

    # Normalize empty strings to None
    if otlp_traces_endpoint == "":
        otlp_traces_endpoint = None
    if otlp_metrics_endpoint == "":
        otlp_metrics_endpoint = None

    otlp_protocol = get_otlp_protocol()
    otlp_headers = get_otlp_headers()

    # Create resource with service information
    resource = Resource.create({
        "service.name": service_name,
        "service.version": service_version,
        "deployment.environment": environment,
    })

    # Setup Tracing
    _tracer_provider = TracerProvider(resource=resource)

    # Choose exporter based on configuration
    if otlp_traces_endpoint:
        # Use OTLP exporter based on protocol
        if otlp_protocol == "http":
            if OTLP_HTTP_TRACE_EXPORTER_AVAILABLE and HttpOTLPSpanExporter is not None:
                if otlp_headers:
                    logger.info(f"[OpenTelemetry] Custom headers: {list(otlp_headers.keys())}")
                span_exporter = HttpOTLPSpanExporter(
                    endpoint=otlp_traces_endpoint,
                    headers=otlp_headers if otlp_headers else None
                )
            else:
                logger.warning("[OpenTelemetry] HTTP exporter not available, falling back to console")
                span_exporter = ConsoleSpanExporter()
        else:  # grpc
            if OTLP_GRPC_TRACE_EXPORTER_AVAILABLE and GrpcOTLPSpanExporter is not None:
                span_exporter = GrpcOTLPSpanExporter(endpoint=otlp_traces_endpoint)
            else:
                logger.warning("[OpenTelemetry] gRPC exporter not available, falling back to console")
                span_exporter = ConsoleSpanExporter()
    else:
        # Use console exporter for development/debugging
        logger.warning("[OpenTelemetry] No traces endpoint configured, using console exporter")
        span_exporter = ConsoleSpanExporter()

    _tracer_provider.add_span_processor(BatchSpanProcessor(span_exporter))
    trace.set_tracer_provider(_tracer_provider)

    # Install non-invasive LLM cost tracking (best-effort)
    try:
        from .llm_cost_tracking import install_llm_cost_tracking

        install_llm_cost_tracking()
    except Exception as e:
        # Never block telemetry setup, but log the error
        logger.warning("[OpenTelemetry] Failed to install LLM cost tracking", exc_info=True)

    # Setup Metrics
    # Note: Langfuse only supports traces, not metrics. Detect and handle appropriately.
    disable_metrics_export = os.getenv("OTEL_DISABLE_METRICS_EXPORT", "false").lower() in ("true", "1", "yes")

    if disable_metrics_export:
        # Metrics export is disabled - don't create any metric exporter or reader
        logger.warning("[OpenTelemetry] Metrics export disabled via OTEL_DISABLE_METRICS_EXPORT")
        # Create a minimal MeterProvider without any readers (no export)
        _meter_provider = MeterProvider(resource=resource, metric_readers=[])
        metrics.set_meter_provider(_meter_provider)
    elif otlp_metrics_endpoint:
        # Check if this is a Langfuse endpoint (which doesn't support metrics)
        is_langfuse = LangfuseEndpoints.is_langfuse_endpoint(otlp_metrics_endpoint)

        if is_langfuse:
            logger.warning("[OpenTelemetry] ⚠️  Langfuse detected - Langfuse only supports TRACES, not metrics")
            logger.warning("[OpenTelemetry] Using console exporter for metrics")
            metric_exporter = ConsoleMetricExporter()
        elif otlp_protocol == "http":
            if OTLP_HTTP_METRIC_EXPORTER_AVAILABLE and HttpOTLPMetricExporter is not None:
                metric_exporter = HttpOTLPMetricExporter(
                    endpoint=otlp_metrics_endpoint,
                    headers=otlp_headers if otlp_headers else None
                )
            else:
                logger.warning("[OpenTelemetry] HTTP metric exporter not available, falling back to console")
                metric_exporter = ConsoleMetricExporter()
        else:  # grpc
            if OTLP_GRPC_METRIC_EXPORTER_AVAILABLE and GrpcOTLPMetricExporter is not None:
                metric_exporter = GrpcOTLPMetricExporter(endpoint=otlp_metrics_endpoint)
            else:
                logger.warning("[OpenTelemetry] gRPC metric exporter not available, falling back to console")
                metric_exporter = ConsoleMetricExporter()

        metric_reader = PeriodicExportingMetricReader(metric_exporter)
        _meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
        metrics.set_meter_provider(_meter_provider)
    else:
        # No metrics endpoint configured, use console exporter
        logger.warning("[OpenTelemetry] No metrics endpoint configured, using console exporter")
        metric_exporter = ConsoleMetricExporter()
        metric_reader = PeriodicExportingMetricReader(metric_exporter)
        _meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
        metrics.set_meter_provider(_meter_provider)

    # Instrument logging to add trace context
    LoggingInstrumentor().instrument(set_logging_format=False)

    _initialized = True
    return _tracer_provider, _meter_provider


def get_tracer(name: str):
    """Get a tracer for the given name"""
    return trace.get_tracer(name)


def get_meter(name: str):
    """Get a meter for the given name"""
    return metrics.get_meter(name)


def shutdown_telemetry():
    """Shutdown telemetry providers"""
    global _tracer_provider, _meter_provider, _initialized

    if _tracer_provider:
        _tracer_provider.shutdown()
    if _meter_provider:
        _meter_provider.shutdown()

    _initialized = False
