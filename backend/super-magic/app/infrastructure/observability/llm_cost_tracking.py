"""
LLM cost tracking integration (non-invasive).

This module monkey-patches TokenUsageTracker.record_llm_usage at runtime to create a
Langfuse-compatible `generation` span with gen_ai.usage.* and gen_ai.usage.cost.

Key design:
- Creates a new span named 'openai.chat' to match OpenAI SDK instrumentation style
- Minimal code invasion - all logic is in the observability layer
"""

import logging
from typing import Any, Callable, Optional

from opentelemetry import trace as otel_trace
from opentelemetry.trace import SpanKind

from .constants import (
    ObservationType,
    LangfuseAttributes,
    OpenTelemetryAttributes,
    Currency,
)

logger = logging.getLogger(__name__)

# Guard to ensure idempotent installation
_installed = False

# Lazy singletons
_model_pricing = None


def _get_model_pricing():
    global _model_pricing
    if _model_pricing is not None:
        return _model_pricing

    try:
        from agentlang.config import config
        from agentlang.llms.token_usage.pricing import ModelPricing

        models_config = config.get("models", {})
        _model_pricing = ModelPricing(models_config=models_config)
    except ImportError as e:
        logger.debug("ModelPricing module not available: %s", e)
        _model_pricing = None
    except Exception as e:
        logger.warning("Failed to initialize ModelPricing for cost tracking", exc_info=True)
        _model_pricing = None

    return _model_pricing


def _safe_int(v: Any) -> int:
    """Safely convert value to int, returning 0 on failure"""
    try:
        return int(v or 0)
    except (ValueError, TypeError):
        return 0


def install_llm_cost_tracking() -> None:
    """
    Install cost tracking by patching TokenUsageTracker.record_llm_usage.

    This avoids changing LLM call sites (e.g. LLMFactory) and keeps the integration
    in the observability layer.
    """
    global _installed
    if _installed:
        return

    try:
        from agentlang.llms.token_usage.tracker import TokenUsageTracker
    except ImportError as e:
        logger.debug("TokenUsageTracker module not available: %s", e)
        return
    except Exception as e:
        logger.warning("Failed to import TokenUsageTracker for cost tracking", exc_info=True)
        return

    original: Optional[Callable[..., Any]] = getattr(TokenUsageTracker, "record_llm_usage", None)
    if not original:
        return

    def patched(self: Any, response_usage: Any, model_id: str, user_id: Optional[str] = None, model_name: Optional[str] = None, resolved_model_id: Optional[str] = None):
        # Call original logic first
        result = original(self, response_usage, model_id, user_id=user_id, model_name=model_name, resolved_model_id=resolved_model_id)

        try:
            # Get the last recorded TokenUsage (includes cache details & model info)
            token_usage = self.get_last_recorded_usage() if hasattr(self, "get_last_recorded_usage") else None
            if not token_usage:
                return result

            tracer = otel_trace.get_tracer(__name__)

            # Create span with OpenAI SDK instrumentation style naming
            # Example: "openai.chat (gpt-4o)" or "openai.chat (claude-4.5)"
            model_label = str(model_name or model_id or "").strip()
            span_name = f"openai.chat ({model_label})" if model_label else "openai.chat"

            span = tracer.start_span(name=span_name, kind=SpanKind.CLIENT)
            with otel_trace.use_span(span, end_on_exit=True):
                # Mark as generation for Langfuse dashboards
                span.set_attribute(OpenTelemetryAttributes.OBSERVATION_TYPE, ObservationType.GENERATION.value)
                span.set_attribute(LangfuseAttributes.OBSERVATION_TYPE, ObservationType.GENERATION.value)
                span.set_attribute(LangfuseAttributes.NAME, span_name)

                # Model identifiers
                span.set_attribute(OpenTelemetryAttributes.GEN_AI_SYSTEM, "openai")
                span.set_attribute(OpenTelemetryAttributes.GEN_AI_REQUEST_MODEL, str(model_name or model_id))
                span.set_attribute(OpenTelemetryAttributes.GEN_AI_RESPONSE_MODEL, str(model_name or model_id))

                # Usage attributes
                span.set_attribute(OpenTelemetryAttributes.GEN_AI_USAGE_INPUT_TOKENS, _safe_int(getattr(token_usage, "input_tokens", 0)))
                span.set_attribute(OpenTelemetryAttributes.GEN_AI_USAGE_COMPLETION_TOKENS, _safe_int(getattr(token_usage, "output_tokens", 0)))
                span.set_attribute(OpenTelemetryAttributes.GEN_AI_USAGE_TOTAL_TOKENS, _safe_int(getattr(token_usage, "total_tokens", 0)))

                # Cost (USD)
                pricing = _get_model_pricing()
                if pricing is not None:
                    try:
                        cost, currency_code = pricing.calculate_cost(model_id, token_usage)
                        if currency_code and currency_code != Currency.USD.value:
                            cost = pricing.convert_currency(cost, currency_code, Currency.USD.value)
                        if cost and cost > 0:
                            span.set_attribute(OpenTelemetryAttributes.GEN_AI_USAGE_COST, float(cost))
                    except (ValueError, TypeError, AttributeError) as e:
                        logger.debug("Failed to calculate cost for model %s: %s", model_id, e)
                    except Exception as e:
                        logger.warning("Unexpected error calculating cost", exc_info=True)

        except Exception as e:
            # Never break main flow, but log unexpected errors
            logger.warning("Unexpected error in LLM cost tracking", exc_info=True)

        return result

    # Patch the method
    TokenUsageTracker.record_llm_usage = patched  # type: ignore[assignment]
    _installed = True
