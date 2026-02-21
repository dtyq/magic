"""
skill-creator 下脚本的共享初始化：项目根目录、PathManager、冗余日志抑制。
在 import app.* 或 SDK 之前执行。
"""

from __future__ import annotations

import io
import sys
from pathlib import Path


def setup_project_root() -> Path:
    """向上查找项目根目录，加入 sys.path 并返回根目录路径。"""
    current = Path(__file__).resolve().parent
    markers = {"setup.py", "script_runner"}
    for _ in range(10):
        if any((current / marker).exists() for marker in markers):
            root = str(current)
            if root not in sys.path:
                sys.path.insert(0, root)
            return current
        current = current.parent
    raise RuntimeError("无法定位项目根目录（未找到 setup.py 或 script_runner）")


def init_skill_script_environment() -> Path:
    """初始化脚本运行环境，返回项目根目录 Path。"""
    root = setup_project_root()

    try:
        from app.paths import PathManager as _PathManager
        if not _PathManager._initialized:
            _PathManager.set_project_root(root)
    except Exception:
        pass

    try:
        _old_stderr = sys.stderr
        sys.stderr = io.StringIO()
        try:
            import agentlang.config.config  # noqa: F401
            import agentlang.logger  # noqa: F401
        finally:
            sys.stderr = _old_stderr
        from loguru import logger as _loguru_logger
        _loguru_logger.remove()
        _loguru_logger.add(sys.stderr, level="WARNING")
    except Exception:
        pass

    return root


# 模块导入时执行一次，供 package_skill / upload_skill 共用
PROJECT_ROOT = init_skill_script_environment()
