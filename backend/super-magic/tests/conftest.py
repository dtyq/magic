"""pytest 测试启动时补齐项目导入路径。"""

from pathlib import Path
import sys


PROJECT_ROOT = Path(__file__).resolve().parent.parent
AGENTLANG_ROOT = PROJECT_ROOT / "agentlang"


def _prepend_sys_path(path: Path) -> None:
    path_str = str(path)
    if path_str not in sys.path:
        sys.path.insert(0, path_str)


_prepend_sys_path(PROJECT_ROOT)
_prepend_sys_path(AGENTLANG_ROOT)
