"""
Shared bootstrap module for skill scripts.

Provides project-root discovery and runtime initialization for scripts under
agents/skills/<skill>/scripts/.
"""
from __future__ import annotations

import importlib
import io
import os
import sys
from pathlib import Path

# Redirect any runtime log directory to safe system location rather than workspace cwd
os.environ.setdefault("LOG_DIR", "/app/logs" if Path("/app/logs").exists() else "/tmp/logs")

_project_root: Path | None = None


def get_project_root() -> Path:
    """
    Return the project root, add it to sys.path on first use, then reuse the cache.
    The .super-magic-project-root marker exists in both development and production.
    """
    global _project_root
    if _project_root is not None:
        return _project_root
    current = Path(__file__).resolve().parent
    for _ in range(10):
        if (current / ".super-magic-project-root").exists():
            sys.path.insert(0, str(current))
            _project_root = current
            return current
        current = current.parent
    raise RuntimeError("Cannot locate project root (.super-magic-project-root not found)")


def get_workspace_dir() -> Path:
    """Workspace directory: project_root/.workspace, aligned with PathManager and agentlang."""
    return get_project_root() / ".workspace"


def get_personal_env_file() -> Path:
    """Personal environment file path: ~/.magic/super-magic.env."""
    return Path.home() / ".magic" / "super-magic.env"


def get_workspace_env_file() -> Path:
    """Workspace environment file path: .workspace/.magic/.env."""
    return get_workspace_dir() / ".magic" / ".env"


def init_environment() -> Path:
    """
    Initialize the skill-script runtime environment and return the project root.

    1. Locate the project root and add it to sys.path.
    2. Initialize PathManager so path inference is stable even when cwd is elsewhere.
    3. Initialize agentlang early and quiet loguru to WARNING to reduce startup noise.
    """
    root = get_project_root()

    try:
        from app.path_manager import PathManager as _PathManager
        if not _PathManager._initialized:
            _PathManager.set_project_root(root)
    except Exception:
        pass

    try:
        _old_stderr = sys.stderr
        sys.stderr = io.StringIO()
        try:
            importlib.import_module("agentlang.config.config")
            importlib.import_module("agentlang.logger")
        finally:
            sys.stderr = _old_stderr
        from loguru import logger as _loguru_logger
        _loguru_logger.remove()
        _loguru_logger.add(sys.stderr, level="WARNING")
    except Exception:
        pass

    return root


# Run on import so individual scripts do not need an explicit bootstrap call.
init_environment()
