"""
OpenTelemetry telemetry initialization and configuration

Provides non-intrusive telemetry setup with automatic instrumentation
"""
import json
import logging
import os
import random
import time
from typing import Optional
from opentelemetry import trace, metrics
from opentelemetry.trace import StatusCode
from opentelemetry.sdk.trace import TracerProvider, SpanProcessor
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter, SpanExporter, SpanExportResult
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader, ConsoleMetricExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.instrumentation.logging import LoggingInstrumentor

from agentlang.utils.metadata import MetadataUtil

from .constants import (
    LangfuseEndpoints,
    LangfuseAttributes,
    OpenTelemetryAttributes,
    ObservationType,
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
_OTEL_EXPORT_WARNING_INTERVAL_SECONDS = 60
_NON_ERROR_IO_PREVIEW_LENGTH = 1200
_NOISE_PATHS = frozenset({
    "/api/health",
    "/api/v1/workspace/status",
})


def _span_request_path(span, attributes: dict, name: str) -> str:
    """Resolve the request path across old and new HTTP semantic conventions."""
    for key in ("http.route", "url.path", "http.target"):
        value = attributes.get(key)
        if value:
            return str(value).split("?", 1)[0]

    for key in ("url.full", "http.url"):
        value = attributes.get(key)
        if value:
            from urllib.parse import urlparse

            return urlparse(str(value)).path

    return name.split(" ", 1)[1].split("?", 1)[0] if " " in name else ""


def _shorten_non_error_io(attributes: dict) -> None:
    """Keep successful trace/observation payloads useful without exporting full bodies."""
    io_keys = (
        LangfuseAttributes.OBSERVATION_INPUT,
        LangfuseAttributes.OBSERVATION_OUTPUT,
        LangfuseAttributes.TRACE_INPUT,
        LangfuseAttributes.TRACE_OUTPUT,
        OpenTelemetryAttributes.GEN_AI_INPUT_MESSAGES,
        OpenTelemetryAttributes.GEN_AI_OUTPUT_MESSAGES,
        OpenTelemetryAttributes.GEN_AI_PROMPT,
        OpenTelemetryAttributes.GEN_AI_COMPLETION,
    )
    for key in io_keys:
        value = attributes.get(key)
        if not isinstance(value, str) or len(value) <= _NON_ERROR_IO_PREVIEW_LENGTH:
            continue
        attributes[key] = value[:_NON_ERROR_IO_PREVIEW_LENGTH] + "...<truncated>"


class _SafeSpanExporter(SpanExporter):
    """把遥测导出失败收敛成限频 warning，避免第三方超时栈淹没业务日志。"""

    def __init__(self, exporter) -> None:
        self._exporter = exporter
        self._last_warning_at = 0.0

    def export(self, spans):
        try:
            return self._exporter.export(spans)
        except Exception as e:
            now = time.monotonic()
            if now - self._last_warning_at >= _OTEL_EXPORT_WARNING_INTERVAL_SECONDS:
                self._last_warning_at = now
                logger.warning(f"[OpenTelemetry] Span export failed; telemetry is degraded: {e}")
            return SpanExportResult.FAILURE

    def shutdown(self):
        return self._exporter.shutdown()

    def force_flush(self, timeout_millis: int = 30000) -> bool:
        force_flush = getattr(self._exporter, "force_flush", None)
        if force_flush is None:
            return True
        return bool(force_flush(timeout_millis))


class _CredentialAwareSpanExporter(SpanExporter):
    """Rebuild the underlying OTLP exporter when auth headers change.

    In warm-pool sandboxes the Magic-Authorization token is written into
    .credentials/ by the gateway after telemetry has already been initialized,
    so headers captured at construction time stay empty and every export gets a
    401. Re-resolve headers on each export and rebuild the exporter only when the
    resolved header set actually changes (e.g. token finally mounted or rotated).

    export() runs in the BatchSpanProcessor worker thread, not the asyncio event
    loop, so the synchronous credential file read inside get_otlp_headers() is
    safe here and does not block the loop.
    """

    def __init__(self, build_exporter) -> None:
        self._build_exporter = build_exporter
        self._exporter = None
        self._headers_key = None

    def _resolve(self):
        headers = get_otlp_headers()
        headers_key = tuple(sorted(headers.items()))
        if self._exporter is None or headers_key != self._headers_key:
            new_exporter = self._build_exporter(headers)
            old_exporter = self._exporter
            self._exporter = new_exporter
            self._headers_key = headers_key
            if old_exporter is not None:
                try:
                    old_exporter.shutdown()
                except Exception:
                    pass
        return self._exporter

    def export(self, spans):
        return self._resolve().export(spans)

    def shutdown(self):
        if self._exporter is not None:
            return self._exporter.shutdown()

    def force_flush(self, timeout_millis: int = 30000) -> bool:
        if self._exporter is None:
            return True
        force_flush = getattr(self._exporter, "force_flush", None)
        if force_flush is None:
            return True
        return bool(force_flush(timeout_millis))


class _ErrorFirstSamplingProcessor(SpanProcessor):
    """Tail-based sampler: export error/exception spans at 100%, normal spans at sample_ratio.

    The sampling decision is deferred to on_end() so that the final span status (ERROR vs OK)
    is known before deciding whether to export.  This means every span is recorded in memory
    but only a fraction are forwarded to the inner BatchSpanProcessor for export.

    OTEL_SAMPLING_RATIO (env, default 0.1): fraction of non-error spans to keep.
    """

    def __init__(self, inner_processor: SpanProcessor, sample_ratio: float = 0.1) -> None:
        self._inner = inner_processor
        self._sample_ratio = sample_ratio

    def on_start(self, span, parent_context=None):
        self._inner.on_start(span, parent_context)

    def on_end(self, span):
        attributes = span.attributes or {}
        name = span.name or ""
        request_path = _span_request_path(span, attributes, name)
        mutable_attributes = getattr(span, "_attributes", None)

        if mutable_attributes is not None and name:
            mutable_attributes.setdefault(LangfuseAttributes.NAME, name)
            mutable_attributes.setdefault(LangfuseAttributes.OBSERVATION_NAME, name)

            trace_input = mutable_attributes.get(LangfuseAttributes.TRACE_INPUT)
            if (
                mutable_attributes.get(LangfuseAttributes.OBSERVATION_INPUT) in (None, "", "null")
                and trace_input not in (None, "", "null")
            ):
                mutable_attributes.setdefault(LangfuseAttributes.OBSERVATION_INPUT, trace_input)
                mutable_attributes.setdefault(OpenTelemetryAttributes.GEN_AI_INPUT_MESSAGES, trace_input)
                mutable_attributes.setdefault(OpenTelemetryAttributes.GEN_AI_PROMPT, trace_input)

            trace_output = mutable_attributes.get(LangfuseAttributes.TRACE_OUTPUT)
            output_fallback = trace_output
            if output_fallback in (None, "", "null"):
                output_fallback = mutable_attributes.get("message")
            if (
                mutable_attributes.get(LangfuseAttributes.OBSERVATION_OUTPUT) in (None, "", "null")
                and output_fallback not in (None, "", "null")
            ):
                mutable_attributes.setdefault(LangfuseAttributes.OBSERVATION_OUTPUT, output_fallback)
                mutable_attributes.setdefault(OpenTelemetryAttributes.GEN_AI_OUTPUT_MESSAGES, output_fallback)
                mutable_attributes.setdefault(OpenTelemetryAttributes.GEN_AI_COMPLETION, output_fallback)
            attributes = span.attributes or {}

        if name.startswith("openai.chat") and mutable_attributes is not None:
            native_input = attributes.get(OpenTelemetryAttributes.GEN_AI_INPUT_MESSAGES)
            native_output = attributes.get(OpenTelemetryAttributes.GEN_AI_OUTPUT_MESSAGES)
            if not native_input:
                native_input = {
                    key: value
                    for key, value in attributes.items()
                    if key.startswith("gen_ai.prompt.")
                } or None
            if not native_output:
                native_output = {
                    key: value
                    for key, value in attributes.items()
                    if key.startswith("gen_ai.completion.")
                } or None

            if native_input is not None or native_output is not None:
                mutable_attributes.setdefault(
                    LangfuseAttributes.OBSERVATION_TYPE,
                    ObservationType.GENERATION.value,
                )
                mutable_attributes.setdefault(
                    OpenTelemetryAttributes.OBSERVATION_TYPE,
                    ObservationType.GENERATION.value,
                )

            for attribute_key, value in (
                (LangfuseAttributes.OBSERVATION_INPUT, native_input),
                (LangfuseAttributes.OBSERVATION_OUTPUT, native_output),
            ):
                if value is None:
                    continue
                text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, default=str)
                bounded = text[:4000] + ("...<truncated>" if len(text) > 4000 else "")
                mutable_attributes[attribute_key] = bounded
                if attribute_key == LangfuseAttributes.OBSERVATION_INPUT:
                    mutable_attributes[OpenTelemetryAttributes.GEN_AI_INPUT_MESSAGES] = bounded
                    mutable_attributes[OpenTelemetryAttributes.GEN_AI_PROMPT] = bounded
                else:
                    mutable_attributes[OpenTelemetryAttributes.GEN_AI_OUTPUT_MESSAGES] = bounded
                    mutable_attributes[OpenTelemetryAttributes.GEN_AI_COMPLETION] = bounded
            attributes = span.attributes or {}

        if request_path in _NOISE_PATHS or name == "AgentDispatcher.setup":
            return
        if name.endswith(" http send") or name.endswith(" http receive"):
            return
        if "asgi.event.type" in attributes:
            return

        is_error = (
            bool(span.status and span.status.status_code == StatusCode.ERROR)
            or bool(span.events and any(event.name == "exception" for event in span.events))
        )
        if not is_error:
            _shorten_non_error_io(mutable_attributes if mutable_attributes is not None else attributes)
            attributes = span.attributes or {}

        # OpenAI spans contain their final messages and usage at this point, including
        # streaming responses, so cost enrichment must happen before export.
        is_openai_span = name == "openai.chat"
        try:
            from .openai_integration import enrich_finished_openai_span

            enrich_finished_openai_span(span)
        except Exception:
            logger.debug("Failed to enrich finished OpenAI span", exc_info=True)

        # Always export spans whose status was explicitly set to ERROR
        if span.status and span.status.status_code == StatusCode.ERROR:
            self._inner.on_end(span)
            return
        # Always export spans that recorded an exception event
        if span.events and any(e.name == "exception" for e in span.events):
            self._inner.on_end(span)
            return

        observation_type = (
            attributes.get(LangfuseAttributes.OBSERVATION_TYPE)
            or attributes.get(OpenTelemetryAttributes.OBSERVATION_TYPE)
        )
        if name.startswith("openai.chat (") and observation_type == ObservationType.GENERATION.value:
            return

        has_observation_io = any(
            attributes.get(key) not in (None, "", "null")
            for key in (
                LangfuseAttributes.OBSERVATION_INPUT,
                LangfuseAttributes.OBSERVATION_OUTPUT,
                OpenTelemetryAttributes.GEN_AI_INPUT_MESSAGES,
                OpenTelemetryAttributes.GEN_AI_OUTPUT_MESSAGES,
            )
        )
        if observation_type == ObservationType.GENERATION.value and not has_observation_io:
            return

        if is_openai_span:
            self._inner.on_end(span)
            return

        # Consistent per-trace sampling: derive the keep/drop decision from the trace_id
        # so that a trace's root span and all of its child spans share the same decision.
        # This prevents the common failure where the root span (which carries the trace
        # name and trace-level input/output) is dropped while a child span survives,
        # leaving the trace with an empty Name in Langfuse.
        if self._should_sample_trace(span):
            self._inner.on_end(span)

    def _should_sample_trace(self, span) -> bool:
        """Return True if this span's trace should be exported (deterministic per trace_id)."""
        if self._sample_ratio >= 1.0:
            return True
        if self._sample_ratio <= 0.0:
            return False
        try:
            trace_id = span.get_span_context().trace_id
        except Exception:
            # Fall back to independent random sampling if trace_id is unavailable
            return random.random() < self._sample_ratio
        # Map the low bits of trace_id to [0, 1) deterministically.
        bucket = (trace_id % 10000) / 10000.0
        return bucket < self._sample_ratio

    def shutdown(self, timeout_millis: int = 30000) -> bool:
        # BatchSpanProcessor.shutdown() takes no args; forward timeout only when supported.
        try:
            return bool(self._inner.shutdown(timeout_millis))
        except TypeError:
            self._inner.shutdown()
            return True

    def force_flush(self, timeout_millis: int = 30000) -> bool:
        return bool(self._inner.force_flush(timeout_millis))


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

    # Langfuse v4-compatible collectors require this header to enable their
    # real-time observation mapping, including Input/Output columns.
    headers["x-langfuse-ingestion-version"] = os.getenv(
        "LANGFUSE_INGESTION_VERSION",
        "4",
    )

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
                logger.info("[OpenTelemetry] HTTP trace exporter with dynamic auth headers enabled")
                span_exporter = _CredentialAwareSpanExporter(
                    build_exporter=lambda headers: HttpOTLPSpanExporter(
                        endpoint=otlp_traces_endpoint,
                        headers=headers or None,
                    ),
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

    sample_ratio = float(os.getenv("OTEL_SAMPLING_RATIO", "0.1"))
    batch_processor = BatchSpanProcessor(_SafeSpanExporter(span_exporter))
    _tracer_provider.add_span_processor(_ErrorFirstSamplingProcessor(batch_processor, sample_ratio))
    logger.info(f"[OpenTelemetry] Sampling: errors=100%, normal={sample_ratio * 100:.0f}% (OTEL_SAMPLING_RATIO={sample_ratio})")
    trace.set_tracer_provider(_tracer_provider)

    # Install non-invasive LLM cost tracking (best-effort)
    try:
        from .llm_cost_tracking import install_llm_cost_tracking

        install_llm_cost_tracking()
    except Exception:
        # Never block telemetry setup, but log the error
        logger.warning("[OpenTelemetry] Failed to install LLM cost tracking", exc_info=True)

    # Setup Metrics
    # Note: Langfuse only supports traces, not metrics. Detect and handle appropriately.
    disable_metrics_export = os.getenv("OTEL_DISABLE_METRICS_EXPORT", "false").lower() in ("true", "1", "yes")

    if disable_metrics_export:
        # Metrics export is disabled - don't create any metric exporter or reader
        logger.info("[OpenTelemetry] Metrics export disabled via OTEL_DISABLE_METRICS_EXPORT")
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
