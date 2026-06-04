from copy import deepcopy

import pytest
import yaml

from agentlang.config.config import config
from agentlang.config.models.model_config import ModelConfig
from agentlang.config.models.model_config_manager import model_config_manager
from agentlang.config.models.providers.config_yaml_provider import ConfigYamlProvider
from app.api.routes.models import _append_local_text_models


def _write_yaml(path, data):
    path.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")


def _model_config(name, api_key="default-key", api_base_url="https://example.com/v1"):
    return {
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


@pytest.fixture(autouse=True)
def restore_config_state():
    saved_state = {
        "_config": deepcopy(config._config),
        "_raw_config": deepcopy(config._raw_config),
        "_model_aliases": deepcopy(config._model_aliases),
        "_model": config._model,
        "_config_loaded": config._config_loaded,
        "_config_path": config._config_path,
        "_manager_models": deepcopy(model_config_manager._models),
    }

    yield

    config._config = saved_state["_config"]
    config._raw_config = saved_state["_raw_config"]
    config._model_aliases = saved_state["_model_aliases"]
    config._model = saved_state["_model"]
    config._config_loaded = saved_state["_config_loaded"]
    config._config_path = saved_state["_config_path"]
    model_config_manager._models = saved_state["_manager_models"]


def test_load_config_without_local_file_keeps_default_models(tmp_path):
    config_path = tmp_path / "config.yaml"
    _write_yaml(
        config_path,
        {
            "models": {
                "default-model": _model_config("default-model"),
            },
        },
    )

    config.load_config(str(config_path))

    assert config._config_path == str(config_path)
    assert set(config.get("models").keys()) == {"default-model"}
    assert config.get("models.default-model.name") == "default-model"


def test_load_config_merges_local_models_and_overrides_same_model_id(tmp_path, monkeypatch):
    monkeypatch.setenv("LOCAL_MODEL_KEY", "secret-local-key")
    config_path = tmp_path / "config.yaml"
    local_config_path = tmp_path / "config.local.yaml"

    _write_yaml(
        config_path,
        {
            "models": {
                "default-model": _model_config("default-model"),
                "shared-model": _model_config("default-shared", api_key="default-key"),
            },
            "model_aliases": {
                "main_llm": "default-model",
            },
        },
    )
    _write_yaml(
        local_config_path,
        {
            "models": {
                "local-model": _model_config("local-model", api_key="${LOCAL_MODEL_KEY}"),
                "shared-model": _model_config("local-shared", api_key="local-key"),
            },
            "model_aliases": {
                "main_llm": "local-model",
            },
        },
    )

    config.load_config(str(config_path))

    models = config.get("models")
    assert set(models.keys()) == {"default-model", "local-model", "shared-model"}
    assert models["local-model"]["api_key"] == "secret-local-key"
    assert models["shared-model"]["name"] == "local-shared"
    assert models["shared-model"]["api_key"] == "local-key"
    assert config.get("model_aliases.main_llm") == "default-model"


def test_load_config_ignores_invalid_local_config(tmp_path):
    config_path = tmp_path / "config.yaml"
    local_config_path = tmp_path / "config.local.yaml"

    _write_yaml(
        config_path,
        {
            "models": {
                "default-model": _model_config("default-model"),
            },
        },
    )
    local_config_path.write_text("models:\n  local-model: [broken", encoding="utf-8")

    config.load_config(str(config_path))

    assert set(config.get("models").keys()) == {"default-model"}


@pytest.mark.asyncio
async def test_config_yaml_provider_reads_merged_local_models(tmp_path):
    config_path = tmp_path / "config.yaml"
    local_config_path = tmp_path / "config.local.yaml"

    _write_yaml(
        config_path,
        {
            "models": {
                "default-model": _model_config("default-model"),
            },
        },
    )
    _write_yaml(
        local_config_path,
        {
            "models": {
                "local-model": _model_config("local-model", api_key="local-key"),
            },
        },
    )

    config.load_config(str(config_path))

    models = await ConfigYamlProvider().load()
    by_id = {model.model_id: model for model in models}

    assert set(by_id.keys()) == {"default-model", "local-model"}
    assert by_id["local-model"].name == "local-model"
    assert by_id["local-model"].api_key == "local-key"
    assert by_id["local-model"].provider_source == "config.yaml"


def test_models_route_appends_local_text_models_without_credentials():
    model_config_manager._models = {
        "remote-model": ModelConfig.from_dict(
            "remote-model",
            _model_config("local-remote-model", api_key="secret", api_base_url="https://local.example.com/v1"),
            provider_source="config.yaml",
        ),
        "local-model": ModelConfig.from_dict(
            "local-model",
            _model_config("local-model", api_key="secret", api_base_url="https://local.example.com/v1"),
            provider_source="config.yaml",
        ),
        "local-embedding": ModelConfig.from_dict(
            "local-embedding",
            {
                **_model_config("local-embedding", api_key="secret"),
                "type": "embedding",
            },
            provider_source="config.yaml",
        ),
    }

    remote_models = [
        {
            "id": "remote-model",
            "object": "model",
            "info": {
                "options": {
                    "chat": True,
                    "function_call": True,
                },
            },
        },
        {
            "id": "remote-image",
            "object": "image",
        },
    ]

    models = _append_local_text_models(remote_models)
    by_id = {item["id"]: item for item in models}

    assert list(by_id.keys()) == ["remote-model", "remote-image", "local-model"]
    assert by_id["remote-model"] is remote_models[0]
    assert by_id["local-model"]["object"] == "model"
    assert by_id["local-model"]["info"]["options"]["chat"] is True
    assert by_id["local-model"]["info"]["options"]["function_call"] is True
    assert "api_key" not in str(by_id["local-model"])
    assert "api_base_url" not in str(by_id["local-model"])
