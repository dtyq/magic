import pytest

from agentlang.config.config import config
from agentlang.llms.factory import LLMFactory


@pytest.fixture(autouse=True)
def restore_auth_header_base_urls():
    original = config.get("llm.auth_header_base_urls")
    yield
    config.set("llm.auth_header_base_urls", original)


def _patch_header_sources(monkeypatch):
    monkeypatch.setattr(LLMFactory, "_parse_custom_headers", classmethod(lambda cls: {}))
    monkeypatch.setattr(
        "agentlang.llms.factory.MetadataUtil.get_full_config",
        classmethod(lambda cls: {}),
    )
    monkeypatch.setattr(
        "agentlang.llms.factory.MetadataUtil.get_llm_request_headers",
        classmethod(lambda cls: {}),
    )

    def add_magic_headers(cls, headers, magic_authorization=None):
        headers["Magic-Authorization"] = "mock-magic"

    monkeypatch.setattr(
        "agentlang.llms.factory.MetadataUtil.add_magic_and_user_authorization_headers",
        classmethod(add_magic_headers),
    )


def test_llm_factory_only_adds_magic_auth_headers_for_magic_api_base_url(monkeypatch):
    monkeypatch.setenv("MAGIC_API_BASE_URL", "https://i-magic-service.letsmagic.cn/v1")
    config.set("llm.auth_header_base_urls", None)
    _patch_header_sources(monkeypatch)

    assert "Magic-Authorization" not in LLMFactory._build_default_headers("https://api.deepseek.com/v1")
    assert (
        LLMFactory._build_default_headers("https://i-magic-service.letsmagic.cn/v1")["Magic-Authorization"]
        == "mock-magic"
    )


def test_llm_factory_uses_configured_auth_header_base_urls(monkeypatch):
    monkeypatch.delenv("MAGIC_API_BASE_URL", raising=False)
    config.set("llm.auth_header_base_urls", "https://allowed.example.com/v1, https://another.example.com")
    _patch_header_sources(monkeypatch)

    assert (
        LLMFactory._build_default_headers("https://allowed.example.com/v1")["Magic-Authorization"]
        == "mock-magic"
    )
    assert "Magic-Authorization" not in LLMFactory._build_default_headers("https://api.deepseek.com/v1")


def test_llm_factory_allows_init_client_magic_service_host(monkeypatch):
    monkeypatch.delenv("MAGIC_API_BASE_URL", raising=False)
    config.set("llm.auth_header_base_urls", None)
    _patch_header_sources(monkeypatch)
    monkeypatch.setattr(
        "agentlang.llms.factory.MetadataUtil.get_full_config",
        classmethod(lambda cls: {"magic_service_host": "https://runtime-magic.example.com"}),
    )

    assert (
        LLMFactory._build_default_headers("https://runtime-magic.example.com/v1")["Magic-Authorization"]
        == "mock-magic"
    )


def test_llm_factory_does_not_trust_magic_like_domain_without_allowlist(monkeypatch):
    monkeypatch.setenv("MAGIC_API_BASE_URL", "https://configured.example.com/v1")
    config.set("llm.auth_header_base_urls", None)
    _patch_header_sources(monkeypatch)

    assert "Magic-Authorization" not in LLMFactory._build_default_headers(
        "https://i-magic-service.letsmagic.cn/v1"
    )


def test_llm_factory_keeps_internal_magic_gateway_allowed(monkeypatch):
    monkeypatch.delenv("MAGIC_API_BASE_URL", raising=False)
    config.set("llm.auth_header_base_urls", None)
    _patch_header_sources(monkeypatch)

    assert LLMFactory._build_default_headers("http://magic-gateway/v1")["Magic-Authorization"] == "mock-magic"


def test_llm_factory_supports_host_only_auth_header_allowlist(monkeypatch):
    monkeypatch.delenv("MAGIC_API_BASE_URL", raising=False)
    config.set("llm.auth_header_base_urls", ["allowed-host"])
    _patch_header_sources(monkeypatch)

    assert LLMFactory._build_default_headers("http://allowed-host/v1")["Magic-Authorization"] == "mock-magic"


def test_llm_factory_ignores_invalid_auth_header_allowlist(monkeypatch):
    monkeypatch.delenv("MAGIC_API_BASE_URL", raising=False)
    config.set("llm.auth_header_base_urls", 123)
    _patch_header_sources(monkeypatch)

    assert "Magic-Authorization" not in LLMFactory._build_default_headers("https://allowed.example.com/v1")


def test_llm_factory_keeps_metadata_and_custom_headers_for_official_providers(monkeypatch):
    monkeypatch.setenv("MAGIC_API_BASE_URL", "https://magic.example.com/v1")
    config.set("llm.auth_header_base_urls", None)
    monkeypatch.setattr(LLMFactory, "_parse_custom_headers", classmethod(lambda cls: {"X-Custom": "1"}))
    monkeypatch.setattr(
        "agentlang.llms.factory.MetadataUtil.get_llm_request_headers",
        classmethod(lambda cls: {"Magic-Task-Id": "task-1"}),
    )

    monkeypatch.setattr(
        "agentlang.llms.factory.MetadataUtil.add_magic_and_user_authorization_headers",
        classmethod(lambda cls, headers, magic_authorization=None: headers.update({"Magic-Authorization": "mock"})),
    )

    headers = LLMFactory._build_default_headers("https://api.deepseek.com/v1")

    assert headers == {"Magic-Task-Id": "task-1", "X-Custom": "1"}


@pytest.mark.parametrize("token", ["x" * 64, "x" * 19, "Bearer arbitrary-valid-token"])
def test_auth_diagnostics_preserve_credentials_and_only_log_lengths(monkeypatch, token):
    from agentlang.utils.metadata import MetadataUtil

    messages = []
    monkeypatch.setattr("agentlang.utils.metadata.logger.info", messages.append)
    monkeypatch.setattr(MetadataUtil, "get_user_authorization", classmethod(lambda cls: token))
    monkeypatch.setattr(MetadataUtil, "get_magic_authorization", classmethod(lambda cls: "gateway-secret"))
    original_forward = config.get("sandbox.forward_user_authorization")
    config.set("sandbox.forward_user_authorization", "true")
    try:
        headers = {}
        MetadataUtil.add_magic_and_user_authorization_headers(headers, "gateway-secret")
        before = headers.copy()
        MetadataUtil.log_authorization_header_diagnostics(headers, "test")
        assert headers == before == {"Magic-Authorization": "gateway-secret", "User-Authorization": token}
        assert any(f"user_length={len(token)}" in message for message in messages)
        assert all(token not in message and "gateway-secret" not in message for message in messages)
    finally:
        config.set("sandbox.forward_user_authorization", original_forward)


def test_final_custom_auth_headers_are_preserved_and_diagnosed(monkeypatch):
    from agentlang.utils.metadata import MetadataUtil

    config.set("llm.auth_header_base_urls", ["magic.example.test"])
    _patch_header_sources(monkeypatch)
    custom = {"User-Authorization": "custom-token", "X-Custom": "value"}
    monkeypatch.setattr(LLMFactory, "_parse_custom_headers", classmethod(lambda cls: custom))
    diagnostics = []
    monkeypatch.setattr(MetadataUtil, "log_authorization_header_diagnostics",
                        classmethod(lambda cls, headers, source: diagnostics.append((headers.copy(), source))))
    headers = LLMFactory._build_default_headers("https://magic.example.test/v1")
    assert headers["User-Authorization"] == "custom-token"
    assert custom == {"User-Authorization": "custom-token", "X-Custom": "value"}
    assert diagnostics == [(headers, "custom_headers")]
