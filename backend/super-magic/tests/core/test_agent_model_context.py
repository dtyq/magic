from types import SimpleNamespace

import pytest

from agentlang.chat_history.chat_history_models import CompactionConfig
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

    context.activate_compact_text_model("mock-compact-text-alt")
    assert context.current_text_model_id == "mock-compact-text-alt"

    assert context.restore_pre_compact_text_model()
    assert context.current_text_model_id == "mock-runtime-text"
    assert not context.has_active_compact_text_model()


def test_compaction_config_does_not_read_model_config_on_init(monkeypatch):
    calls = []

    def fake_get_max_context_tokens(model_id, default=0):
        calls.append(("max", model_id))
        return 120_000

    def fake_get_model_config(model_id):
        calls.append(("config", model_id))
        return SimpleNamespace(name="Mock Text Model", provider="mock-provider", metadata={})

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
    assert config.resolve_token_threshold("mock-runtime-text") == 108_000
    assert calls == [("max", "mock-runtime-text"), ("config", "mock-runtime-text")]
