"""
获取当前会话上下文（topic_id 和 model_id）

- topic_id: 从 .credentials/init_client_message.json 的 metadata.topic_id 读取
- model_id:  从本地 .chat_history/magic<main>.session.json 的 current.model_id 读取
"""
import json
import os
import sys
from pathlib import Path
from typing import Optional, Tuple

def _setup_project_root() -> Path:
    """
    向上查找项目根目录，加入 sys.path 并返回根目录路径。
    支持以下标志文件：
    - setup.py：本地开发环境
    - script_runner：PyInstaller 编译后的生产环境（setup.py 不会被打包进镜像）
    """
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


_PROJECT_ROOT = _setup_project_root()

# PyInstaller 生产环境下，PathManager 会以 cwd 推断项目根目录，
# 而 script_runner 常从 skill 子目录调用，cwd 并非 /app，导致路径错误。
# 这里提前用已知的正确根目录初始化 PathManager，确保后续所有路径读取正确。
try:
    from app.paths import PathManager as _PathManager
    if not _PathManager._initialized:
        _PathManager.set_project_root(_PROJECT_ROOT)
except Exception:
    pass

# agentlang 框架在被 import 时会通过 Logger.setup() 将 loguru 重置为 INFO 级别，
# 并立即触发 Config() 单例初始化（module-level），打印 3 条 INFO 日志。
# 解决方案：主动提前 import，期间屏蔽 stderr，完成后重新配置 loguru 为 WARNING。
try:
    import io as _io
    _old_stderr = sys.stderr
    sys.stderr = _io.StringIO()
    try:
        import agentlang.config.config  # 触发 Config() 初始化
        import agentlang.logger         # 触发 Logger.setup()（重置 loguru 为 INFO）
    finally:
        sys.stderr = _old_stderr

    from loguru import logger as _loguru_logger
    _loguru_logger.remove()
    _loguru_logger.add(sys.stderr, level="WARNING")
except Exception:
    pass


def _get_topic_id() -> Optional[str]:
    """从 init_client_message.json 读取 topic_id"""
    try:
        from app.utils.init_client_message_util import InitClientMessageUtil
        metadata = InitClientMessageUtil.get_metadata()
        return metadata.get("topic_id")
    except Exception:
        return None


def _get_project_id() -> Optional[str]:
    """从 init_client_message.json 读取 project_id"""
    try:
        from app.utils.init_client_message_util import InitClientMessageUtil
        metadata = InitClientMessageUtil.get_metadata()
        return metadata.get("project_id")
    except Exception:
        return None


def get_project_id() -> Optional[str]:
    """返回当前会话的 project_id，供 list 等脚本使用"""
    return _get_project_id()


def _get_model_id() -> Optional[str]:
    """从本地 session 文件读取 model_id"""
    try:
        from app.paths import PathManager
        chat_history_dir = str(PathManager.get_chat_history_dir())
        session_file = os.path.join(chat_history_dir, "magic<main>.session.json")
        if not os.path.exists(session_file):
            return None
        with open(session_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        # 优先取 current，其次取 last
        current = data.get("current") or {}
        model_id = current.get("model_id")
        if not model_id:
            last = data.get("last") or {}
            model_id = last.get("model_id")
        return model_id or None
    except Exception:
        return None


def get_context() -> Tuple[Optional[str], Optional[str]]:
    """
    返回 (topic_id, model_id)

    两者均可能为 None（文件不存在或字段缺失时）。
    """
    return _get_topic_id(), _get_model_id()
