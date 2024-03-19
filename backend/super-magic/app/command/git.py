#!/usr/bin/env python3
"""
命令模块，用于存放CLI命令相关功能
"""
import os
import sys
import logging
import argparse
from pathlib import Path
from typing import Dict

# 添加项目根目录到 Python 路径
root_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(root_dir))

# 导入 git_service
from app.infrastructure.git.git import GitService

# 配置日志目录
root_dir = Path(__file__).parent.parent.parent
logs_dir = root_dir / 'logs'
logs_dir.mkdir(exist_ok=True)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(logs_dir / 'git_command.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

def main():
    """Git 命令的主入口点"""
    try:

        # 创建 GitService 实例，不指定目录将使用配置中的所有目录
        git_service = GitService()

        # results = git_service.commit_all_changes()

        # 打印提交结果
        # print("\n提交结果:")
        # print("-" * 50)
        # for directory, success in results.items():
        #     status = "成功" if success else "失败"
        #     print(f"{directory}: {status}")
        # print("-" * 50)

    except Exception as e:
        logger.error(f"主程序出错: {e}")

if __name__ == "__main__":
    main()
