import pytest

from app.mcp.config.env_resolver import MCPEnvResolutionError, MCPEnvVarResolver, redact_config_values
from app.mcp.config.models import MCPServerConfig


@pytest.fixture()
def env_paths(tmp_path, monkeypatch):
    from app.mcp.config import env_resolver

    workspace_env = tmp_path / "workspace.env"
    personal_env = tmp_path / "personal.env"

    monkeypatch.setattr(env_resolver.PathManager, "get_personal_env_file", lambda: personal_env)
    monkeypatch.setattr(
        env_resolver.PathManager,
        "get_process_env_paths",
        lambda: [workspace_env, personal_env],
    )
    return {
        "workspace_env": workspace_env,
        "personal_env": personal_env,
    }


def test_config_model_preserves_env_placeholders(monkeypatch):
    monkeypatch.setenv("MOCK_TOKEN", "mock-real-secret")

    config = MCPServerConfig(
        name="mock-stdio",
        type="stdio",
        command="npx",
        args=["mock-package"],
        env={"TOKEN": "${MOCK_TOKEN}"},
        headers={"x-api-key": "${MOCK_TOKEN}"},
    )

    assert config.env == {"TOKEN": "${MOCK_TOKEN}"}
    assert config.headers == {"x-api-key": "${MOCK_TOKEN}"}


def test_resolver_replaces_url_headers_token_and_env_from_effective_env(env_paths, monkeypatch):
    monkeypatch.setenv("MOCK_OS_ONLY", "mock-os-secret")
    monkeypatch.setenv("MOCK_SHARED", "mock-os-shared")
    env_paths["workspace_env"].write_text(
        "MOCK_SHARED=mock-workspace-shared\nMOCK_STDIO_TOKEN=mock-stdio-token\n",
        encoding="utf-8",
    )
    env_paths["personal_env"].write_text(
        "MOCK_AMAP_KEY=mock-amap-secret\n"
        "MOCK_VOUCHER_KEY=mock-voucher-secret\n"
        "MOCK_SHARED=mock-personal-shared\n",
        encoding="utf-8",
    )
    config = MCPServerConfig(
        name="mock-http",
        type="http",
        url="https://mcp.example.test/sse?key=${MOCK_AMAP_KEY}&os=${MOCK_OS_ONLY}",
        token="${MOCK_VOUCHER_KEY}",
        headers={
            "x-api-key": "Bearer ${MOCK_VOUCHER_KEY}",
            "x-shared": "${MOCK_SHARED}",
        },
        env={"TOKEN": "${MOCK_STDIO_TOKEN}"},
    )

    resolved = MCPEnvVarResolver().resolve_config(config)

    assert resolved.url == "https://mcp.example.test/sse?key=mock-amap-secret&os=mock-os-secret"
    assert resolved.token == "mock-voucher-secret"
    assert resolved.headers == {
        "x-api-key": "Bearer mock-voucher-secret",
        "x-shared": "mock-personal-shared",
    }
    assert resolved.env == {"TOKEN": "mock-stdio-token"}
    assert config.url == "https://mcp.example.test/sse?key=${MOCK_AMAP_KEY}&os=${MOCK_OS_ONLY}"
    assert config.headers["x-api-key"] == "Bearer ${MOCK_VOUCHER_KEY}"


def test_resolver_treats_corrupt_env_as_missing(env_paths):
    env_paths["personal_env"].write_text("MOCK_BAD=smenc:v1:not-valid\n", encoding="utf-8")
    config = MCPServerConfig(
        name="mock-http",
        type="http",
        url="https://mcp.example.test/sse",
        headers={"x-api-key": "${MOCK_BAD}"},
    )

    with pytest.raises(MCPEnvResolutionError) as exc_info:
        MCPEnvVarResolver().resolve_config(config)

    assert exc_info.value.missing_names == ("MOCK_BAD",)
    assert str(exc_info.value) == "Missing environment variable(s): MOCK_BAD"


def test_redact_config_values_hides_resolved_url_and_header_secrets():
    config = MCPServerConfig(
        name="mock-http",
        type="http",
        url="https://mcp.example.test/sse?key=mock-url-secret",
        token="mock-token-secret",
        headers={"x-api-key": "Bearer mock-header-secret"},
        env={"TOKEN": "mock-env-secret"},
    )

    text = (
        "Request failed for https://mcp.example.test/sse?key=mock-url-secret "
        "with mock-token-secret, Bearer mock-header-secret, mock-header-secret "
        "and mock-env-secret"
    )
    redacted = redact_config_values(config, text)

    assert "mock-url-secret" not in redacted
    assert "mock-token-secret" not in redacted
    assert "mock-header-secret" not in redacted
    assert "mock-env-secret" not in redacted
    assert "key=<redacted>" in redacted
    assert "<redacted>" in redacted
