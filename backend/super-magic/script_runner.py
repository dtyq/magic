#!/usr/bin/env python3
"""
轻量级 Python 脚本运行器

这是一个独立的可执行文件，只用于执行 Python 脚本，不加载项目的任何启动逻辑。
主要用于 skill scripts 的执行，避免主应用的启动开销和日志输出。

用法：
    script_runner.py <script_path> [args...]
"""

import sys
import runpy
from pathlib import Path

def main():
    """主函数：执行指定的 Python 脚本"""
    if len(sys.argv) < 2:
        print("用法: script_runner.py <script_path> [args...]", file=sys.stderr)
        sys.exit(1)

    script_path = sys.argv[1]
    script_args = sys.argv[2:] if len(sys.argv) > 2 else []

    # 解析脚本路径
    script_path_obj = Path(script_path)
    if not script_path_obj.is_absolute():
        script_path_obj = Path.cwd() / script_path_obj

    # 检查脚本是否存在
    if not script_path_obj.exists():
        print(f"错误: 脚本文件不存在: {script_path_obj}", file=sys.stderr)
        sys.exit(1)

    # 设置 sys.argv（脚本路径 + 参数）
    sys.argv = [str(script_path_obj)] + script_args

    # 将脚本所在目录插入 sys.path 首位，保证同目录下的 _context 等模块可被导入
    # runpy.run_path 不像直接执行脚本那样自动将脚本目录加入 sys.path
    script_dir = str(script_path_obj.parent)
    if script_dir not in sys.path:
        sys.path.insert(0, script_dir)

    try:
        # 使用 runpy 执行脚本
        runpy.run_path(str(script_path_obj), init_globals={}, run_name="__main__")
    except SystemExit:
        # 脚本正常退出
        raise
    except Exception as e:
        # 脚本执行出错
        import traceback
        print(f"错误: 执行脚本时发生错误: {e}", file=sys.stderr)
        print(traceback.format_exc(), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
