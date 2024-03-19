"""
Constants for observability and telemetry

Centralized constants for OpenTelemetry and Langfuse integration to avoid
magic strings and improve maintainability.
"""
from enum import Enum


class ObservationType(str, Enum):
    """Observation type constants for Langfuse"""
    GENERATION = "generation"
    TOOL = "tool"
    EMBEDDING = "embedding"
    SPAN = "span"


class ToolStatus(str, Enum):
    """Tool execution status constants"""
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    EXCEPTION = "exception"


class LogLevel(str, Enum):
    """Log level constants for span attributes"""
    INFO = "INFO"
    ERROR = "ERROR"
    WARNING = "WARNING"
    DEBUG = "DEBUG"


class Currency(str, Enum):
    """Currency constants"""
    USD = "USD"
    CNY = "CNY"


class LangfuseAttributes:
    """Langfuse-specific span attribute keys"""
    NAME = "langfuse.name"
    OBSERVATION_TYPE = "langfuse.observation.type"
    USER_ID = "langfuse.user.id"
    SESSION_ID = "langfuse.session.id"
    TAGS = "langfuse.tags"
    # Prefix for promoting attributes to top-level metadata (filterable)
    TRACE_METADATA_PREFIX = "langfuse.trace.metadata"


class LangfuseTraceMetadata:
    """
    Langfuse trace metadata keys (promoted to trace-level for filtering).

    IMPORTANT: Langfuse OTEL integration ONLY supports 'langfuse.trace.metadata.*' prefix.
    - These attributes are promoted to the TRACE's top-level metadata (not observation's)
    - They can be filtered using Langfuse's trace filter, NOT observation filter
    - Observation-level metadata filtering is NOT supported by Langfuse OTEL integration

    Note: Use underscore in key names (not dots) to avoid nested JSON structure.

    See: https://langfuse.com/docs/opentelemetry/get-started
    """
    # Trace-level metadata (appears in trace.metadata, filterable via trace filters)
    OBSERVATION_TYPE = "langfuse.trace.metadata.observation_type"
    TOOL_NAME = "langfuse.trace.metadata.tool_name"
    TOOL_SUCCESS = "langfuse.trace.metadata.tool_success"
    TOOL_RESULT_OK = "langfuse.trace.metadata.tool_result_ok"


# Alias for backward compatibility
LangfuseSpanMetadata = LangfuseTraceMetadata


class OpenTelemetryAttributes:
    """OpenTelemetry standard attribute keys"""
    OBSERVATION_TYPE = "observation.type"
    TOOL_STATUS = "tool.status"
    TOOL_NAME = "tool.name"
    TOOL_SUCCESS = "tool.success"
    TOOL_EXECUTION_TIME = "tool.execution_time"
    TOOL_EXECUTION_TIME_MS = "tool.execution_time_ms"
    TOOL_RESULT_OK = "tool.result.ok"
    TOOL_RESULT_PREVIEW = "tool.result.preview"
    TOOL_ERROR_DETAILS = "tool.error.details"
    TOOL_COMPLETED_AT = "tool.completed_at"

    # GenAI attributes
    GEN_AI_SYSTEM = "gen_ai.system"
    GEN_AI_REQUEST_MODEL = "gen_ai.request.model"
    GEN_AI_RESPONSE_MODEL = "gen_ai.response.model"
    GEN_AI_USAGE_INPUT_TOKENS = "gen_ai.usage.input_tokens"
    GEN_AI_USAGE_COMPLETION_TOKENS = "gen_ai.usage.completion_tokens"
    GEN_AI_USAGE_TOTAL_TOKENS = "gen_ai.usage.total_tokens"
    GEN_AI_USAGE_COST = "gen_ai.usage.cost"

    # HTTP attributes
    HTTP_SUCCESS = "http.success"

    # Error attributes
    ERROR = "error"
    ERROR_TYPE = "error.type"
    ERROR_MESSAGE = "error.message"

    # Log attributes
    LOG_LEVEL = "log.level"
    LOG_LOGGER = "log.logger"
    LOG_MESSAGE = "log.message"
    LOG_FILENAME = "log.filename"
    LOG_LINENO = "log.lineno"
    LOG_EXCEPTION = "log.exception"

    # Level attribute (for filtering)
    LEVEL = "level"


class LangfuseEndpoints:
    """Langfuse endpoint patterns"""
    CLOUD_BASE_URL = "https://cloud.langfuse.com"
    OTEL_ENDPOINT_PATH = "/api/public/otel"
    CLOUD_OTEL_ENDPOINT = f"{CLOUD_BASE_URL}{OTEL_ENDPOINT_PATH}"

    @staticmethod
    def is_langfuse_endpoint(endpoint: str) -> bool:
        """Check if an endpoint is a Langfuse endpoint"""
        if not endpoint:
            return False
        return (
            "langfuse.com" in endpoint or
            LangfuseEndpoints.OTEL_ENDPOINT_PATH in endpoint
        )


class CredentialPrefixes:
    """Credential key prefixes for validation"""
    LANGFUSE_PUBLIC_KEY_PREFIX = "pk-lf-"
    LANGFUSE_SECRET_KEY_PREFIX = "sk-lf-"

    @staticmethod
    def validate_public_key(key: str) -> bool:
        """Validate Langfuse public key format"""
        return key and key.startswith(CredentialPrefixes.LANGFUSE_PUBLIC_KEY_PREFIX)

    @staticmethod
    def validate_secret_key(key: str) -> bool:
        """Validate Langfuse secret key format"""
        return key and key.startswith(CredentialPrefixes.LANGFUSE_SECRET_KEY_PREFIX)

    @staticmethod
    def validate_credentials(public_key: str, secret_key: str) -> tuple[bool, str]:
        """Validate both credentials and return (is_valid, error_message)"""
        if not public_key:
            return False, "Public key cannot be empty"
        if not secret_key:
            return False, "Secret key cannot be empty"
        if not CredentialPrefixes.validate_public_key(public_key):
            return False, f"Public key must start with '{CredentialPrefixes.LANGFUSE_PUBLIC_KEY_PREFIX}'"
        if not CredentialPrefixes.validate_secret_key(secret_key):
            return False, f"Secret key must start with '{CredentialPrefixes.LANGFUSE_SECRET_KEY_PREFIX}'"
        return True, ""


class DefaultConfig:
    """Default configuration values"""
    DEFAULT_SERVICE_NAME = "super-magic"
    DEFAULT_SERVICE_VERSION = "unknown"
    DEFAULT_ENVIRONMENT = "production"
    DEFAULT_OTLP_PROTOCOL = "http"
    DEFAULT_CURRENCY = Currency.USD.value
