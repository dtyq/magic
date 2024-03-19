"""
测试配置文件 - 在所有测试运行前自动加载环境变量
"""

import os
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

def pytest_configure(config):
    """pytest 配置钩子 - 在测试会话开始前调用"""
    # 设置正确的项目根目录给PathManager
    try:
        from agentlang.paths import PathManager
        PathManager.set_project_root(project_root)
        print(f"✓ PathManager项目根目录已强制设置: {project_root}")
        print(f"✓ 聊天历史目录: {PathManager.get_chat_history_dir()}")
    except ImportError:
        print("⚠️  无法导入PathManager，跳过项目根目录设置")

    try:
        from dotenv import load_dotenv

        # 查找 .env 文件路径（支持多级目录查找）
        env_paths = [
            project_root / '.env',
            project_root / '.env.local',
            project_root / '.env.test'
        ]

        loaded_files = []
        for env_path in env_paths:
            if env_path.exists():
                load_dotenv(env_path, override=False)  # 不覆盖已存在的环境变量
                loaded_files.append(str(env_path))

        if loaded_files:
            print(f"✓ 环境变量已加载: {', '.join(loaded_files)}")
        else:
            print(f"⚠️  未找到环境变量文件: {', '.join(str(p) for p in env_paths)}")

    except ImportError:
        print("⚠️  python-dotenv 未安装，请运行: pip install python-dotenv")
        print("   或将其添加到项目依赖中")
