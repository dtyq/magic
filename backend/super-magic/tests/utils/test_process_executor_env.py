import sys
import types


def _import_process_executor(monkeypatch):
    tools_pkg = types.ModuleType("app.tools")
    tools_pkg.__path__ = []
    shell_pkg = types.ModuleType("app.tools.shell_exec_utils")
    shell_pkg.__path__ = []

    bg_task_models = types.ModuleType("app.tools.shell_exec_utils.bg_task_models")

    class BackgroundStartResult:
        pass

    bg_task_models.BackgroundStartResult = BackgroundStartResult
    bg_task_models.PROMPT_QUIET_SECS = 2.0
    bg_task_models.PROMPT_QUIET_SECS_SYNC = 2.0

    bg_prompt_detector = types.ModuleType("app.tools.shell_exec_utils.bg_prompt_detector")
    bg_prompt_detector.extract_last_line = lambda text: text
    bg_prompt_detector.looks_like_prompt = lambda text: False
    bg_prompt_detector.scan_chunk_for_prompt = lambda text: False

    monkeypatch.setitem(sys.modules, "app.tools", tools_pkg)
    monkeypatch.setitem(sys.modules, "app.tools.shell_exec_utils", shell_pkg)
    monkeypatch.setitem(sys.modules, "app.tools.shell_exec_utils.bg_task_models", bg_task_models)
    monkeypatch.setitem(sys.modules, "app.tools.shell_exec_utils.bg_prompt_detector", bg_prompt_detector)

    from app.path_manager import PathManager
    from app.utils.process_executor import ProcessExecutor

    return ProcessExecutor, PathManager


def test_build_filtered_env_loads_env_paths_in_order(tmp_path, monkeypatch):
    process_executor, path_manager = _import_process_executor(monkeypatch)
    project_root = tmp_path / "project"
    project_root.mkdir()
    (project_root / ".env").write_text("MOCK_FILTERED_FROM_OS=mock-project-value\n", encoding="utf-8")

    workspace_skill_env = tmp_path / "workspace-skill.env"
    workspace_root_env = tmp_path / "workspace-root.env"
    workspace_magic_env = tmp_path / "workspace-magic.env"
    personal_env = tmp_path / "personal.env"

    workspace_skill_env.write_text(
        "MOCK_SHARED=mock-skill-default\nMOCK_SKILL_ONLY=mock-skill-only\n",
        encoding="utf-8",
    )
    workspace_root_env.write_text("MOCK_SHARED=mock-root-value\n", encoding="utf-8")
    workspace_magic_env.write_text(
        "MOCK_SHARED=mock-workspace-value\nMOCK_WORKSPACE_ONLY=mock-workspace-only\n",
        encoding="utf-8",
    )
    personal_env.write_text(
        "MOCK_SHARED=mock-personal-value\nMOCK_PERSONAL_ONLY=mock-personal-only\n",
        encoding="utf-8",
    )

    monkeypatch.setenv("MOCK_FROM_OS", "mock-os-value")
    monkeypatch.setenv("MOCK_FILTERED_FROM_OS", "mock-os-secret")
    monkeypatch.setattr(path_manager, "get_project_root", lambda: project_root)
    monkeypatch.setattr(
        path_manager,
        "get_process_env_paths",
        lambda: [workspace_skill_env, workspace_root_env, workspace_magic_env, personal_env],
    )

    env = process_executor._build_filtered_env()

    assert env["MOCK_FROM_OS"] == "mock-os-value"
    assert "MOCK_FILTERED_FROM_OS" not in env
    assert env["MOCK_SHARED"] == "mock-personal-value"
    assert env["MOCK_SKILL_ONLY"] == "mock-skill-only"
    assert env["MOCK_WORKSPACE_ONLY"] == "mock-workspace-only"
    assert env["MOCK_PERSONAL_ONLY"] == "mock-personal-only"
