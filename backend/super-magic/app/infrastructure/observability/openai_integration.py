"""
OpenAI SDK library integration for OpenTelemetry

Provides automatic instrumentation for OpenAI SDK (which uses httpx internally).
This ensures all LLM API calls are properly traced.
"""
import logging
import os

from .constants import (
    Currency,
    LangfuseAttributes,
    OpenTelemetryAttributes,
)
from .telemetry import is_telemetry_enabled
from .span_utils import set_observation_io, enrich_span_with_user_context, enrich_span_with_trace_correlation

# Try to import Langfuse SDK, but make it optional
try:
    from langfuse import get_client
    LANGFUSE_AVAILABLE = True
except ImportError:
    LANGFUSE_AVAILABLE = False
    get_client = None
    logging.debug(
        "langfuse not available. Cost tracking will be skipped. "
        "Install it with: pip install langfuse"
    )

# Import token usage tracking and pricing
try:
    from agentlang.llms.token_usage.models import OpenAIParser
    TOKEN_TRACKING_AVAILABLE = True
except ImportError as e:
    TOKEN_TRACKING_AVAILABLE = False
    logging.warning(f"Token tracking modules not available: {e}")

# Try to import OpenAI instrumentor, but make it optional
try:
    from opentelemetry.instrumentation.openai import OpenAIInstrumentor
    OPENAI_INSTRUMENTATION_AVAILABLE = True
except ImportError:
    OPENAI_INSTRUMENTATION_AVAILABLE = False
    logging.warning(
        "opentelemetry-instrumentation-openai not available. "
        "Install it with: pip install opentelemetry-instrumentation-openai"
    )

# Track if already instrumented
_openai_instrumented = False

_logger = logging.getLogger(__name__)

# Initialize Langfuse client and pricing calculator (lazy initialization)
_langfuse_client = None
_model_pricing = None


def _get_langfuse_client():
    """Get or create Langfuse client instance"""
    global _langfuse_client
    if _langfuse_client is None and LANGFUSE_AVAILABLE:
        try:
            _langfuse_client = get_client()
        except Exception as e:
            # Log error without exposing sensitive configuration details
            _logger.warning("Failed to initialize Langfuse client", exc_info=True)
    return _langfuse_client


def _get_model_pricing():
    """Get or create ModelPricing instance"""
    global _model_pricing
    if _model_pricing is not None:
        return _model_pricing
    if not TOKEN_TRACKING_AVAILABLE:
        return None

    try:
        from agentlang.llms.factory import LLMFactory

        _model_pricing = LLMFactory.pricing
    except ImportError as e:
        _logger.debug("LLMFactory module not available: %s", e)
    except Exception:
        # Log error without exposing configuration details
        _logger.warning("Failed to initialize ModelPricing", exc_info=True)
    return _model_pricing


def enrich_finished_openai_span(span) -> bool:
    """Add Langfuse input/output and cost to a finished OpenAI chat span."""
    if getattr(span, "name", None) != "openai.chat":
        return False

    attributes = getattr(span, "_attributes", None)
    if attributes is None:
        return True

    input_messages = attributes.get(OpenTelemetryAttributes.GEN_AI_INPUT_MESSAGES)
    output_messages = attributes.get(OpenTelemetryAttributes.GEN_AI_OUTPUT_MESSAGES)
    if input_messages and not attributes.get(LangfuseAttributes.OBSERVATION_INPUT):
        attributes[LangfuseAttributes.OBSERVATION_INPUT] = input_messages
    if output_messages and not attributes.get(LangfuseAttributes.OBSERVATION_OUTPUT):
        attributes[LangfuseAttributes.OBSERVATION_OUTPUT] = output_messages

    model_name = (
        attributes.get(OpenTelemetryAttributes.GEN_AI_RESPONSE_MODEL)
        or attributes.get(OpenTelemetryAttributes.GEN_AI_REQUEST_MODEL)
    )
    input_tokens = attributes.get(OpenTelemetryAttributes.GEN_AI_USAGE_INPUT_TOKENS, 0)
    output_tokens = attributes.get(OpenTelemetryAttributes.GEN_AI_USAGE_OUTPUT_TOKENS, 0) or attributes.get(
        OpenTelemetryAttributes.GEN_AI_USAGE_COMPLETION_TOKENS,
        0,
    )
    if model_name and (input_tokens or output_tokens):
        model_pricing = _get_model_pricing()
        if model_pricing:
            pricing = model_pricing.get_model_pricing(str(model_name))
            total_cost = (
                (int(input_tokens or 0) * pricing.get("input_price", 0.0))
                + (int(output_tokens or 0) * pricing.get("output_price", 0.0))
            ) / 1000
            currency = pricing.get("currency", Currency.USD.value)
            if currency == Currency.CNY.value and total_cost and model_pricing.exchange_rate:
                total_cost /= model_pricing.exchange_rate
            if total_cost > 0:
                attributes[OpenTelemetryAttributes.GEN_AI_USAGE_COST] = float(total_cost)

    attributes.setdefault(LangfuseAttributes.NAME, "openai.chat")
    return True


def _request_hook(span, request):
    """Hook to enhance OpenAI request spans with better naming

    Args:
        span: OpenTelemetry span
        request: OpenAI request object (dict or object with attributes)
    """
    if not span or not span.is_recording():
        return

    # Enrich with user context (user.id/session.id/organization.code) and trace
    # correlation (external.trace_id/request.correlation_id), matching the FastAPI
    # root span so this child span can be correlated across systems in Langfuse.
    enrich_span_with_user_context(span)
    enrich_span_with_trace_correlation(span)

    try:
        # Extract model and method from request
        # Request can be a dict or an object
        if isinstance(request, dict):
            model = request.get('model', 'unknown')
            method = request.get('method', 'chat.completions.create')
        else:
            model = getattr(request, 'model', None) or getattr(request, 'get', lambda k, d: d)('model', 'unknown')
            method = getattr(request, 'method', None) or 'chat.completions.create'

        # Update span name to include model and method
        span_name = f"openai.{method}"
        if model and model != 'unknown':
            span_name = f"{span_name} ({model})"

        # Update span name for both OpenTelemetry and Langfuse
        span.update_name(span_name)
        span.set_attribute(LangfuseAttributes.NAME, span_name)

        # Add model as attribute
        if model and model != 'unknown':
            span.set_attribute(OpenTelemetryAttributes.GEN_AI_SYSTEM, "openai")
            span.set_attribute(OpenTelemetryAttributes.GEN_AI_REQUEST_MODEL, str(model))

        # Fill the observation Input column with the request messages/prompt (Langfuse).
        try:
            if isinstance(request, dict):
                input_payload = request.get("messages") or request.get("input") or request.get("prompt")
            else:
                input_payload = getattr(request, "messages", None)
            if input_payload is not None:
                set_observation_io(span, input_value=input_payload)
        except Exception:
            _logger.debug("Failed to set OpenAI observation input", exc_info=True)

        _logger.debug(f"Set OpenAI span name: {span_name}")

    except Exception as e:
        # Log error without exposing request details
        _logger.debug("Error in OpenAI request hook", exc_info=True)


def _response_hook(span, request, response):
    """
    Hook to enhance OpenAI response spans with response metadata

    Args:
        span: OpenTelemetry span
        request: OpenAI request object
        response: OpenAI response object
    """
    if not span or not span.is_recording():
        return

    try:
        # Extract usage information if available
        if hasattr(response, 'usage'):
            usage = response.usage
            if usage:
                if hasattr(usage, 'prompt_tokens'):
                    span.set_attribute("gen_ai.token_count.prompt", usage.prompt_tokens)
                    span.set_attribute(OpenTelemetryAttributes.GEN_AI_USAGE_INPUT_TOKENS, usage.prompt_tokens)
                if hasattr(usage, 'completion_tokens'):
                    span.set_attribute("gen_ai.token_count.completion", usage.completion_tokens)
                    span.set_attribute(OpenTelemetryAttributes.GEN_AI_USAGE_OUTPUT_TOKENS, usage.completion_tokens)
                    span.set_attribute(OpenTelemetryAttributes.GEN_AI_USAGE_COMPLETION_TOKENS, usage.completion_tokens)
                if hasattr(usage, 'total_tokens'):
                    span.set_attribute("gen_ai.token_count.total", usage.total_tokens)
                    span.set_attribute(OpenTelemetryAttributes.GEN_AI_USAGE_TOTAL_TOKENS, usage.total_tokens)

        # Extract model from response if available
        if hasattr(response, 'model'):
            span.set_attribute(OpenTelemetryAttributes.GEN_AI_RESPONSE_MODEL, str(response.model))

        # Mark as successful
        span.set_attribute(OpenTelemetryAttributes.HTTP_SUCCESS, True)

        # Fill the observation Output column with the completion (Langfuse).
        try:
            output_payload = _extract_openai_output(response)
            if output_payload is not None:
                set_observation_io(span, output_value=output_payload)
        except Exception:
            _logger.debug("Failed to set OpenAI observation output", exc_info=True)

        # Report usage and cost to Langfuse
        _report_to_langfuse(span, request, response)

    except Exception as e:
        # Log error without exposing response details
        _logger.debug("Error in OpenAI response hook", exc_info=True)


def _extract_openai_output(response):
    """Best-effort extraction of the assistant message(s) from an OpenAI response."""
    try:
        choices = getattr(response, "choices", None)
        if choices is None and isinstance(response, dict):
            choices = response.get("choices")
        if not choices:
            return None

        messages = []
        for choice in choices:
            message = getattr(choice, "message", None)
            if message is None and isinstance(choice, dict):
                message = choice.get("message")
            if message is None:
                continue
            content = getattr(message, "content", None)
            if content is None and isinstance(message, dict):
                content = message.get("content")
            tool_calls = getattr(message, "tool_calls", None)
            if tool_calls is None and isinstance(message, dict):
                tool_calls = message.get("tool_calls")
            entry = {"content": content}
            if tool_calls:
                # tool_calls objects are not JSON-serializable; stringify defensively.
                entry["tool_calls"] = str(tool_calls)
            messages.append(entry)

        if not messages:
            return None
        return messages[0] if len(messages) == 1 else messages
    except Exception:
        return None


def _report_to_langfuse(span, request, response):
    """
    Report token usage and cost to Langfuse

    Args:
        span: OpenTelemetry span
        request: OpenAI request object
        response: OpenAI response object
    """
    # Check if Langfuse and token tracking are available
    if not LANGFUSE_AVAILABLE or not TOKEN_TRACKING_AVAILABLE:
        return

    try:
        langfuse_client = _get_langfuse_client()
        model_pricing = _get_model_pricing()

        if not langfuse_client or not model_pricing:
            return

        # Extract model name from response or request
        model_name = None
        if hasattr(response, 'model'):
            model_name = str(response.model)
        elif isinstance(request, dict):
            model_name = request.get('model')
        elif hasattr(request, 'model'):
            model_name = getattr(request, 'model', None)

        if not model_name:
            _logger.debug("Cannot report to Langfuse: model name not found")
            return

        # Extract usage data from response
        if not hasattr(response, 'usage') or not response.usage:
            _logger.debug("Cannot report to Langfuse: usage data not found")
            return

        # Convert response to dict format for OpenAIParser
        usage_dict = {}
        usage = response.usage

        if hasattr(usage, 'prompt_tokens'):
            usage_dict['prompt_tokens'] = usage.prompt_tokens
        if hasattr(usage, 'completion_tokens'):
            usage_dict['completion_tokens'] = usage.completion_tokens
        if hasattr(usage, 'total_tokens'):
            usage_dict['total_tokens'] = usage.total_tokens

        # Extract prompt_tokens_details if available
        # Handle both dict and object formats
        prompt_details = None
        if hasattr(usage, 'prompt_tokens_details') and usage.prompt_tokens_details:
            details = usage.prompt_tokens_details
            if isinstance(details, dict):
                prompt_details = details
            else:
                # Convert object to dict
                prompt_details = {}
                if hasattr(details, 'cached_tokens'):
                    prompt_details['cached_tokens'] = details.cached_tokens
                if hasattr(details, 'cache_read_input_tokens'):
                    prompt_details['cache_read_input_tokens'] = details.cache_read_input_tokens
                if hasattr(details, 'cache_write_input_tokens'):
                    prompt_details['cache_write_input_tokens'] = details.cache_write_input_tokens

        if prompt_details:
            usage_dict['prompt_tokens_details'] = prompt_details

        # Parse usage data using OpenAIParser
        token_usage = OpenAIParser.parse(usage_dict)
        if not token_usage or token_usage.total_tokens == 0:
            _logger.debug("Cannot report to Langfuse: invalid token usage data")
            return

        # Get pricing for the model
        pricing = model_pricing.get_model_pricing(model_name)

        # Build cost_details dictionary
        cost_details = {}
        input_price = pricing.get("input_price", 0.0)
        output_price = pricing.get("output_price", 0.0)
        currency = pricing.get("currency", Currency.USD.value)

        if token_usage.input_tokens > 0 and input_price > 0:
            # Cost per 1000 tokens
            cost_details["input"] = (token_usage.input_tokens * input_price) / 1000

        if token_usage.output_tokens > 0 and output_price > 0:
            cost_details["output"] = (token_usage.output_tokens * output_price) / 1000

        # Add cache costs if available
        if token_usage.input_tokens_details:
            if token_usage.input_tokens_details.cached_tokens:
                cache_hit_price = pricing.get("cache_hit_price", 0.0)
                if cache_hit_price > 0:
                    cost_details["cache_read_input_tokens"] = (
                        token_usage.input_tokens_details.cached_tokens * cache_hit_price
                    ) / 1000

            if token_usage.input_tokens_details.cache_write_tokens:
                cache_write_price = pricing.get("cache_write_price", 0.0)
                if cache_write_price > 0:
                    cost_details["cache_write_input_tokens"] = (
                        token_usage.input_tokens_details.cache_write_tokens * cache_write_price
                    ) / 1000

        # Convert cost to USD if needed (Langfuse expects USD)
        if currency != Currency.USD.value and cost_details:
            exchange_rate = model_pricing.exchange_rate
            if currency == Currency.CNY.value and exchange_rate:
                # Convert CNY to USD
                for key in cost_details:
                    cost_details[key] = cost_details[key] / exchange_rate

        # Attach usage and cost to the existing OpenAI span instead of creating or marking
        # a separate generation observation.
        total_cost = sum(cost_details.values()) if cost_details else 0.0

        # Preferred OTEL usage attributes
        span.set_attribute(OpenTelemetryAttributes.GEN_AI_USAGE_INPUT_TOKENS, int(token_usage.input_tokens))
        span.set_attribute(OpenTelemetryAttributes.GEN_AI_USAGE_OUTPUT_TOKENS, int(token_usage.output_tokens))
        span.set_attribute(OpenTelemetryAttributes.GEN_AI_USAGE_COMPLETION_TOKENS, int(token_usage.output_tokens))
        span.set_attribute(OpenTelemetryAttributes.GEN_AI_USAGE_TOTAL_TOKENS, int(token_usage.total_tokens))

        # Preferred OTEL cost attribute (USD)
        if total_cost > 0:
            span.set_attribute(OpenTelemetryAttributes.GEN_AI_USAGE_COST, float(total_cost))

        _logger.debug(
            f"Reported to Langfuse: model={model_name}, "
            f"input_tokens={token_usage.input_tokens}, "
            f"output_tokens={token_usage.output_tokens}, "
            f"cost={total_cost:.6f} {Currency.USD.value}"
        )

    except Exception as e:
        # Don't fail if Langfuse reporting fails
        # Log error without exposing sensitive information
        _logger.warning("Failed to report to Langfuse", exc_info=True)


def instrument_openai() -> None:
    """
    Automatically instrument OpenAI SDK with OpenTelemetry

    This will automatically:
    - Trace all API calls made with OpenAI SDK (AsyncOpenAI, OpenAI)
    - Add request/response metadata to spans
    - Track errors (API errors, connection errors, timeouts)
    - Integrate with existing traces
    - Add LLM-specific attributes (model, token usage, etc.)

    Note:
        This function is idempotent - calling it multiple times is safe.

    Usage:
        # In your application startup (ws_server.py)
        from app.infrastructure.observability import instrument_openai
        instrument_openai()

        # Then all OpenAI SDK calls will be automatically traced
        from openai import AsyncOpenAI
        client = AsyncOpenAI()
        response = await client.chat.completions.create(...)
    """
    global _openai_instrumented

    # Idempotent: if already instrumented, just return
    if _openai_instrumented:
        return

    if not is_telemetry_enabled():
        return

    if not OPENAI_INSTRUMENTATION_AVAILABLE:
        _logger.info("OpenAI instrumentation skipped (package not installed)")
        return

    try:
        # OpenLLMetry only emits prompt/completion content when this is enabled.
        # Respect an explicit deployment override (for example, privacy-sensitive envs).
        os.environ.setdefault("TRACELOOP_TRACE_CONTENT", "true")
        OpenAIInstrumentor().instrument(
            request_hook=_request_hook,
            response_hook=_response_hook,
        )
        _openai_instrumented = True
        _logger.info("OpenAI SDK instrumentation enabled (with LLM-specific tracking)")
    except Exception as e:
        # Don't fail if instrumentation fails
        _logger.warning(f"Failed to instrument OpenAI SDK: {e}")


def uninstrument_openai() -> None:
    """Remove OpenAI SDK instrumentation"""
    global _openai_instrumented

    if not _openai_instrumented:
        return

    if not OPENAI_INSTRUMENTATION_AVAILABLE:
        return

    try:
        OpenAIInstrumentor().uninstrument()
        _openai_instrumented = False
        _logger.info("OpenAI SDK instrumentation disabled")
    except Exception as e:
        _logger.warning(f"Failed to uninstrument OpenAI SDK: {e}")
