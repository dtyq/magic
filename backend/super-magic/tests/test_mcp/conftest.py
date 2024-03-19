"""MCP 测试配置文件

统一处理测试初始化，避免工具工厂的重复初始化
"""

import os
import sys
from pathlib import Path
import pytest
from unittest.mock import patch, MagicMock
import logging

# 设置环境变量禁用工具工厂初始化
os.environ["SKIP_TOOL_FACTORY_INIT"] = "1"

# 获取项目根目录
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(project_root))

# 初始化路径管理器 - 只在整个测试会话中初始化一次
from app.paths import PathManager
PathManager.set_project_root(project_root)
from agentlang.context.application_context import ApplicationContext
ApplicationContext.set_path_manager(PathManager())

# 全局变量来标记是否已经初始化过
_initialized = False


def pytest_configure(config):
    """pytest 配置阶段，在所有测试开始前执行一次"""
    global _initialized
    if not _initialized:
        # 设置日志级别，减少不必要的输出
        logging.getLogger('app.tools.core.tool_factory').setLevel(logging.WARNING)
        _initialized = True


@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    """会话级别的自动 fixture，在整个测试会话中只执行一次"""
    # 设置日志级别，减少不必要的输出
    logging.getLogger('app.tools.core.tool_factory').setLevel(logging.WARNING)

    yield

    # 清理逻辑（如果需要）
    pass


@pytest.fixture(scope="function", autouse=True)
def disable_tool_factory_logs():
    """禁用工具工厂相关的日志输出"""
    # 临时禁用工具工厂相关的日志
    logging.getLogger('app.tools.core.tool_factory').setLevel(logging.CRITICAL)
    yield
    # 恢复日志级别
    logging.getLogger('app.tools.core.tool_factory').setLevel(logging.WARNING)
