"""
skill-creator 下脚本的共享初始化：项目根目录、PathManager、冗余日志抑制。
在 import app.* 或 SDK 之前执行。
"""
import sys
from pathlib import Path

# agents/skills/_shared/ 对所有 skill 脚本均在 parents[2] 下
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import _shared.bootstrap  # noqa: F401 — 触发环境初始化
