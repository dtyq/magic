#!/usr/bin/env python
"""Super Magic CLI 入口文件

使用方法:
    python bin/super-magic.py --help
    python bin/super-magic.py tool list
    python bin/super-magic.py skill list
"""
import sys
from pathlib import Path

# 添加项目根目录和 bin 目录到 Python 路径
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "bin"))

from super_magic.cli import cli

if __name__ == '__main__':
    cli()
