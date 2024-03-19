"""
PyInstaller 运行时钩子
用于在打包后的环境中将不加密的 SDK 目录添加到模块搜索路径
同时设置 PYTHONPATH 环境变量，确保子进程也能找到 sdk 和其他模块
"""
import sys
import os

# 仅在 PyInstaller 打包环境中执行
if getattr(sys, 'frozen', False):
    # 获取 PyInstaller 解压的临时目录
    base_path = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))

    # 将 base_path 添加到 sys.path，使得 sdk 可以被导入
    if base_path not in sys.path:
        sys.path.insert(0, base_path)

    # 设置 PYTHONPATH 环境变量，确保通过 subprocess 启动的 Python 进程也能找到 sdk
    # 这对于 agents/skills 中的 scripts 执行至关重要
    current_pythonpath = os.environ.get('PYTHONPATH', '')
    if current_pythonpath:
        # 如果已有 PYTHONPATH，则在前面添加 base_path
        os.environ['PYTHONPATH'] = f"{base_path}{os.pathsep}{current_pythonpath}"
    else:
        # 如果没有 PYTHONPATH，直接设置为 base_path
        os.environ['PYTHONPATH'] = base_path
