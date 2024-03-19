"""
Design 工具测试的共享配置和 fixtures

这个文件会在运行 tests/tools/design/ 目录下的所有测试时自动加载
"""

import os
import sys
from pathlib import Path

# 获取项目根目录
project_root = Path(__file__).resolve().parent.parent.parent.parent
sys.path.insert(0, str(project_root))

# 设置项目根目录
from app.paths import PathManager
PathManager.set_project_root(project_root)
