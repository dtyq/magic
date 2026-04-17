"""
skill 脚本公共引导模块。

提供项目根目录定位与运行环境初始化，供所有 agents/skills/<skill>/scripts/ 下的脚本使用。
"""
from __future__ import annotations

import io
import sys
from pathlib import Path


_project_root: Path | None = None


def get_project_root() -> Path:
    """
    返回项目根目录，首次调用时定位并加入 sys.path，后续返回缓存值。
    以 .super-magic-project-root 文件作为标志，本地开发和生产环境均存在。
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


def init_environment() -> Path:
    """
    完整初始化 skill 脚本运行环境，返回项目根目录 Path。

    1. 定位项目根目录并加入 sys.path
    2. 初始化 PathManager（避免 cwd 不在根目录时路径推断有误）
    3. 提前触发 agentlang 初始化并将 loguru 静音至 WARNING（避免启动噪音）
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


# 模块导入时自动执行，无需外部显式调用
init_environment()
