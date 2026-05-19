"""本地调试模式配置。"""

import os

LOCAL_DEBUG_MODE_ENV = "ENABLE_LOCAL_DEBUG_MODE"
TRUE_VALUES = {"1", "true", "yes", "on"}


def is_local_debug_mode_enabled() -> bool:
    """统一控制只允许本地调试客户端使用的能力。"""
    return os.getenv(LOCAL_DEBUG_MODE_ENV, "").lower() in TRUE_VALUES
