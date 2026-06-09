from copy import deepcopy

import pytest

from agentlang.config.models.model_config import ModelConfig
from agentlang.config.models.model_config_manager import model_config_manager
from agentlang.llms.factory import ENABLE_MODEL_FALLBACK_ENV, LLMFactory


def _model_config(
    name: str,
    api_key: str = "mock-key",
    api_base_url: str = "https://mock.example.com/v1",
    metadata: dict | None = None,
) -> dict:
    config = {
        "name": name,
        "provider": "openai",
        "api_key": api_key,
        "api_base_url": api_base_url,
        "type": "llm",
        "supports_tool_use": True,
        "max_output_tokens": 4096,
        "max_context_tokens": 8192,
        "temperature": 0.7,
    }
    if metadata is not None:
        config["metadata"] = metadata
    return config


def _model(model_id: str, provider_source: str, config: dict) -> ModelConfig:
    return ModelConfig.from_dict(model_id, config, provider_source=provider_source)


@pytest.fixture(autouse=True)
def restore_model_registry(monkeypatch):
    saved_models = deepcopy(model_config_manager._models)
    saved_configs = deepcopy(LLMFactory._configs)
    saved_clients = deepcopy(LLMFactory._clients)
    monkeypatch.delenv(ENABLE_MODEL_FALLBACK_ENV, raising=False)

    yield

    model_config_manager._models = saved_models
    LLMFactory._configs = saved_configs
    LLMFactory._clients = saved_clients


def test_llm_factory_fallback_prefers_magic_service_auto_label_over_local_auto():
    model_config_manager._models = {
        "auto": _model("auto", "config.yaml", _model_config("Local Auto")),
        "magic-auto-id": _model(
            "magic-auto-id",
            "magic-service",
            _model_config("Magic Dynamic", metadata={"label": "Auto"}),
        ),
        "magic-regular": _model("magic-regular", "magic-service", _model_config("Magic Regular")),
    }

    config = LLMFactory.get_model_config("missing-model")

    assert config.model_id == "magic-auto-id"
    assert config.name == "Magic Dynamic"


def test_llm_factory_fallback_is_enabled_by_default():
    model_config_manager._models = {
        "magic-auto-id": _model(
            "magic-auto-id",
            "magic-service",
            _model_config("Magic Dynamic", metadata={"label": "Auto"}),
        ),
    }

    config = LLMFactory.get_model_config("missing-model")

    assert config.model_id == "magic-auto-id"


def test_llm_factory_fallback_can_be_disabled_by_environment(monkeypatch):
    monkeypatch.setenv(ENABLE_MODEL_FALLBACK_ENV, "false")
    model_config_manager._models = {
        "magic-auto-id": _model(
            "magic-auto-id",
            "magic-service",
            _model_config("Magic Dynamic", metadata={"label": "Auto"}),
        ),
    }

    with pytest.raises(ValueError, match="找不到模型 ID 为 missing-model 的配置"):
        LLMFactory.get_model_config("missing-model")


def test_llm_factory_fallback_prefers_magic_service_auto_label_over_exact_auto_id():
    model_config_manager._models = {
        "auto": _model("auto", "magic-service", _model_config("Magic Auto")),
        "magic-auto-id": _model(
            "magic-auto-id",
            "magic-service",
            _model_config("Magic Dynamic", metadata={"label": "Auto"}),
        ),
    }

    config = LLMFactory.get_model_config("missing-model")

    assert config.model_id == "magic-auto-id"
    assert config.name == "Magic Dynamic"


def test_llm_factory_fallback_prefers_auto_name_over_exact_auto_id():
    model_config_manager._models = {
        "auto": _model("auto", "config.yaml", _model_config("Local Auto")),
        "named-auto-id": _model(
            "named-auto-id",
            "config.yaml",
            _model_config("Auto"),
        ),
    }

    config = LLMFactory.get_model_config("missing-model")

    assert config.model_id == "named-auto-id"
    assert config.name == "Auto"


def test_llm_factory_fallback_uses_first_runnable_magic_service_model_when_auto_missing():
    model_config_manager._models = {
        "local-valid": _model("local-valid", "config.yaml", _model_config("Local Valid")),
        "magic-invalid": _model(
            "magic-invalid",
            "magic-service",
            _model_config("Magic Invalid", api_key=""),
        ),
        "magic-valid": _model("magic-valid", "magic-service", _model_config("Magic Valid")),
    }

    config = LLMFactory.get_model_config("missing-model")

    assert config.model_id == "magic-valid"
    assert config.name == "Magic Valid"
