import json

import pytest

from sdk import llm


def _write_mock_credentials(project_root):
    credentials_dir = project_root / ".credentials"
    credentials_dir.mkdir(parents=True)
    (credentials_dir / "init_client_message.json").write_text(
        json.dumps(
            {
                "magic_service_host": "https://mock-llm.example",
                "metadata": {"authorization": "mock-authorization"},
            }
        ),
        encoding="utf-8",
    )


def test_resolve_credentials_prefers_super_magic_project_root(monkeypatch, tmp_path):
    project_root = tmp_path / "mock_app"
    workspace = tmp_path / "mounted_workspace"
    workspace.mkdir()
    _write_mock_credentials(project_root)

    monkeypatch.chdir(workspace)
    monkeypatch.setenv("SUPER_MAGIC_PROJECT_ROOT", str(project_root))
    monkeypatch.delenv("PROJECT_ROOT", raising=False)

    base_url, api_key = llm._resolve_credentials_sync()

    assert base_url == "https://mock-llm.example/v1"
    assert api_key == "mock-authorization"


def test_find_project_root_uses_project_root_env_fallback(monkeypatch, tmp_path):
    project_root = tmp_path / "mock_app"
    workspace = tmp_path / "mounted_workspace"
    workspace.mkdir()
    _write_mock_credentials(project_root)

    monkeypatch.chdir(workspace)
    monkeypatch.delenv("SUPER_MAGIC_PROJECT_ROOT", raising=False)
    monkeypatch.setenv("PROJECT_ROOT", str(project_root))

    assert llm._find_project_root() == project_root.resolve()


def test_find_project_root_falls_back_to_cwd_ancestors(monkeypatch, tmp_path):
    project_root = tmp_path / "mock_app"
    nested_dir = project_root / ".workspace" / "nested"
    nested_dir.mkdir(parents=True)
    _write_mock_credentials(project_root)

    monkeypatch.chdir(nested_dir)
    monkeypatch.delenv("SUPER_MAGIC_PROJECT_ROOT", raising=False)
    monkeypatch.delenv("PROJECT_ROOT", raising=False)

    assert llm._find_project_root() == project_root.resolve()


def test_find_project_root_ignores_invalid_env_and_uses_cwd_ancestor(
    monkeypatch, tmp_path
):
    project_root = tmp_path / "mock_app"
    nested_dir = project_root / ".workspace" / "nested"
    invalid_root = tmp_path / "invalid_app"
    nested_dir.mkdir(parents=True)
    _write_mock_credentials(project_root)

    monkeypatch.chdir(nested_dir)
    monkeypatch.setenv("SUPER_MAGIC_PROJECT_ROOT", str(invalid_root))
    monkeypatch.delenv("PROJECT_ROOT", raising=False)

    assert llm._find_project_root() == project_root.resolve()


def test_find_project_root_reports_invalid_env_candidates(monkeypatch, tmp_path):
    workspace = tmp_path / "mounted_workspace"
    invalid_root = tmp_path / "invalid_app"
    workspace.mkdir()

    monkeypatch.chdir(workspace)
    monkeypatch.setenv("SUPER_MAGIC_PROJECT_ROOT", str(invalid_root))
    monkeypatch.delenv("PROJECT_ROOT", raising=False)

    with pytest.raises(RuntimeError) as exc_info:
        llm._find_project_root()

    error = str(exc_info.value)
    assert "SUPER_MAGIC_PROJECT_ROOT" in error
    assert str(invalid_root) in error
    assert str(workspace.resolve()) in error
