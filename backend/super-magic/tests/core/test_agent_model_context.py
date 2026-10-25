from types import SimpleNamespace

import pytest

from agentlang.chat_history.chat_history_models import CompactionConfig, resolve_user_facing_max_context_tokens
from agentlang.config.models.model_config_manager import model_config_manager
from agentlang.llms.factory import LLMClientConfig
from app.core.models.agent_model_context import AgentModelContext
from app.core.models.media_model import ImageModelSpec, VideoModelSpec
from app.core.models.model_selection_policy import ModelSelectionInput, ModelSelectionPolicy


def test_model_selection_prefers_request_then_session_then_agent_default():
    selection = ModelSelectionPolicy.resolve(ModelSelectionInput(
        configured_text_model_id="mock-default-text",
        request_text_model_id="mock-request-text",
        session_text_model_id="mock-session-text",
        request_image_model=ImageModelSpec.from_values(
            model_id="mock-request-image",
            sizes=[{"value": "1:1"}],
        ),
        session_image_model=ImageModelSpec.from_values(model_id="mock-session-image"),
        session_video_model=VideoModelSpec.from_values(
            model_id="mock-session-video",
            video_generation_config={"sizes": [{"value": "mock-size"}]},
        ),
    ))

    assert selection.text_model_id == "mock-request-text"
    assert selection.image_model_id == "mock-request-image"
    assert selection.image_model_sizes == [{"value": "1:1"}]
    assert selection.video_model_id == "mock-session-video"
    assert selection.video_generation_config == {"sizes": [{"value": "mock-size"}]}


def test_model_selection_falls_back_to_session_and_agent_default():
    selection = ModelSelectionPolicy.resolve(ModelSelectionInput(
        configured_text_model_id="mock-default-text",
        session_text_model_id="mock-session-text",
    ))
    assert selection.text_model_id == "mock-session-text"

    selection = ModelSelectionPolicy.resolve(ModelSelectionInput(
        configured_text_model_id="mock-default-text",
    ))
    assert selection.text_model_id == "mock-default-text"


def test_model_selection_requires_configured_text_model():
    with pytest.raises(ValueError, match="configured_text_model_id is required"):
        ModelSelectionPolicy.resolve(ModelSelectionInput(
            configured_text_model_id=None,
        ))


def test_model_selection_keeps_session_media_capability_when_request_only_has_same_model_id():
    selection = ModelSelectionPolicy.resolve(ModelSelectionInput(
        configured_text_model_id="mock-default-text",
        request_image_model=ImageModelSpec.from_values(model_id="mock-image-model"),
        session_image_model=ImageModelSpec.from_values(
            model_id="mock-image-model",
            sizes=[{"value": "mock-image-size"}],
        ),
        request_video_model=VideoModelSpec.from_values(model_id="mock-video-model"),
        session_video_model=VideoModelSpec.from_values(
            model_id="mock-video-model",
            video_generation_config={"sizes": [{"value": "mock-video-size"}]},
        ),
    ))

    assert selection.image_model_sizes == [{"value": "mock-image-size"}]
    assert selection.video_generation_config == {"sizes": [{"value": "mock-video-size"}]}


def test_agent_model_context_defers_config_lookup_until_runtime_resolve(monkeypatch):
    calls = []

    def fake_get_model_config(model_id, *args, **kwargs):
        calls.append(model_id)
        return LLMClientConfig(
            model_id=model_id,
            api_key="mock-key",
            name="Mock Text Model",
            provider="mock-provider",
            max_output_tokens=2048,
            max_context_tokens=8192,
            resolved_model_id="mock-resolved-text",
        )

    monkeypatch.setattr("app.core.models.agent_model_context.LLMFactory.get_model_config", fake_get_model_config)

    context = AgentModelContext()
    context.set_configured_text_model("mock-default-text")
    context.apply_selection(ModelSelectionPolicy.resolve(ModelSelectionInput(
        configured_text_model_id="mock-default-text",
        request_text_model_id="mock-runtime-text",
    )))

    assert calls == []

    state = context.resolve_text_model()

    assert calls == ["mock-runtime-text"]
    assert state.model_id == "mock-runtime-text"
    assert state.display_model_id == "mock-resolved-text"
    assert context.resolve_text_model() is state
    assert calls == ["mock-runtime-text"]


def test_agent_model_context_disables_current_model_config_in_memory(monkeypatch):
    disabled_model_ids: list[str] = []
    monkeypatch.setattr(
        "app.core.models.agent_model_context.LLMFactory.get_model_config",
        lambda model_id, *args, **kwargs: LLMClientConfig(
            model_id=model_id,
            api_key="mock-key",
            name="Mock Vision Model",
            provider="mock-provider",
            supports_multimodal=True,
        ),
    )
    monkeypatch.setattr(model_config_manager, "disable_multimodal", disabled_model_ids.append)

    context = AgentModelContext()
    context.apply_selection(ModelSelectionPolicy.resolve(ModelSelectionInput(
        configured_text_model_id="mock-default-text",
        request_text_model_id="mock-vision-text",
    )))
    state = context.resolve_text_model()

    context.disable_multimodal_for_model(state.model_id)

    assert disabled_model_ids == ["mock-vision-text"]
    assert state.config.supports_multimodal is False


def test_agent_model_context_delegates_missing_model_fallback_to_llm_factory(monkeypatch):
    calls: list[dict[str, object]] = []

    def fake_get_model_config(model_id, *args, **kwargs):
        calls.append({
            "model_id": model_id,
            "expected_type": kwargs.get("expected_type"),
            "allow_fallback": kwargs.get("allow_fallback"),
        })
        assert model_id == "missing-runtime-text"
        return LLMClientConfig(
            model_id="auto",
            api_key="mock-key",
            name="Mock Auto Model",
            provider="mock-provider",
            max_output_tokens=2048,
            max_context_tokens=8192,
        )

    monkeypatch.setattr("app.core.models.agent_model_context.LLMFactory.get_model_config", fake_get_model_config)

    context = AgentModelContext()
    context.set_configured_text_model("mock-default-text")
    context.apply_selection(ModelSelectionPolicy.resolve(ModelSelectionInput(
        configured_text_model_id="mock-default-text",
        request_text_model_id="missing-runtime-text",
    )))

    state = context.resolve_text_model()

    assert calls == [{
        "model_id": "missing-runtime-text",
        "expected_type": None,
        "allow_fallback": None,
    }]
    assert state.model_id == "auto"
    assert context.current_text_model_id == "auto"


def test_agent_model_context_restores_pre_compact_text_model(monkeypatch):
    monkeypatch.setattr(
        "app.core.models.agent_model_context.LLMFactory.get_model_config",
        lambda model_id, *args, **kwargs: LLMClientConfig(
            model_id=model_id,
            api_key="mock-key",
            name=f"Mock {model_id}",
            provider="mock-provider",
        ),
    )

    context = AgentModelContext()
    context.set_configured_text_model("mock-default-text")
    context.apply_selection(ModelSelectionPolicy.resolve(ModelSelectionInput(
        configured_text_model_id="mock-default-text",
        request_text_model_id="mock-runtime-text",
    )))

    context.activate_compact_text_model("mock-compact-text")
    assert context.current_text_model_id == "mock-compact-text"
    assert context.has_active_compact_text_model()
    assert context.consume_compact_text_model_fallback()
    assert not context.consume_compact_text_model_fallback()

    context.activate_compact_text_model("mock-compact-text-alt")
    assert context.current_text_model_id == "mock-compact-text-alt"
    assert not context.consume_compact_text_model_fallback()

    assert context.restore_pre_compact_text_model()
    assert context.current_text_model_id == "mock-runtime-text"
    assert not context.has_active_compact_text_model()
    assert not context.consume_compact_text_model_fallback()

    context.activate_compact_text_model("mock-compact-text")
    assert context.consume_compact_text_model_fallback()


def test_compaction_config_does_not_read_model_config_on_init(monkeypatch):
    calls = []

    def fake_get_max_context_tokens(model_id, default=0):
        calls.append(("max", model_id))
        return 120_000

    def fake_get_model_config(model_id):
        calls.append(("config", model_id))
        return SimpleNamespace(
            model_id=model_id,
            name="Mock Text Model",
            provider="mock-provider",
            resolved_model_id="",
            metadata={},
        )

    monkeypatch.setattr(
        "agentlang.chat_history.chat_history_models.model_config_utils.get_max_context_tokens",
        fake_get_max_context_tokens,
    )
    monkeypatch.setattr(
        "agentlang.chat_history.chat_history_models.model_config_utils.get_model_config",
        fake_get_model_config,
    )

    config = CompactionConfig(agent_model_id="mock-text")

    assert calls == []
    assert config.resolve_compaction_threshold_tokens("mock-runtime-text") == 108_000
    assert calls == [("max", "mock-runtime-text"), ("config", "mock-runtime-text")]


@pytest.mark.parametrize("model_id", ["deepseek-v4-flash", "qwen3.7-plus"])
def test_compaction_threshold_uses_256k_rule_for_current_magic_models(monkeypatch, model_id):
    monkeypatch.setattr(
        "agentlang.chat_history.chat_history_models.model_config_utils.get_max_context_tokens",
        lambda requested_model_id, default=0: 1_000_000,
    )
    monkeypatch.setattr(
        "agentlang.chat_history.chat_history_models.model_config_utils.get_model_config",
        lambda requested_model_id: SimpleNamespace(
            model_id=requested_model_id,
            name=requested_model_id,
            provider="mock-provider",
            resolved_model_id="",
            metadata={},
        ),
    )

    config = CompactionConfig(agent_model_id=model_id)

    result = config.resolve_threshold_for_model(model_id)
    config.compaction_threshold_tokens = result.compaction_threshold_tokens

    assert result.compaction_threshold_tokens == 230_400
    assert result.matched_rule_name == "context_window_256k"
    assert result.max_context_tokens == 1_000_000
    assert config.early_compact_threshold == 184_320


def test_user_facing_context_tokens_parse_pricing_interval(monkeypatch):
    monkeypatch.setattr(
        "agentlang.chat_history.chat_history_models.model_config_utils.get_model_config",
        lambda requested_model_id: SimpleNamespace(
            model_id=requested_model_id,
            name=requested_model_id,
            provider="mock-provider",
            resolved_model_id="",
            metadata={},
        ),
    )

    assert resolve_user_facing_max_context_tokens("qwen3.7-plus") == 256_000
