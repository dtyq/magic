import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
AGENTLANG_ROOT = PROJECT_ROOT / "agentlang"

for path in (PROJECT_ROOT, AGENTLANG_ROOT):
    path_str = str(path)
    if path_str not in sys.path:
        sys.path.insert(0, path_str)
