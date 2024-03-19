"""
可执行命令相关的工具函数
"""
import os
import sys
from agentlang.logger import get_logger

logger = get_logger(__name__)

def get_executable_command():
    """获取可执行命令，兼容冻结程序和非冻结程序
    
    Returns:
        list: 可执行命令列表，冻结程序返回[可执行文件路径]，非冻结程序返回[python解释器路径, 脚本路径]
    """
    # 检查是否是PyInstaller打包的程序
    is_frozen = getattr(sys, 'frozen', False)
    
    if is_frozen:
        # 如果是冻结程序，直接使用程序自身作为可执行文件
        logger.info(f"当前是冻结程序，直接使用程序自身作为可执行文件: {sys.executable}")
        return [sys.executable]
    else:
        # 如果是非冻结程序，使用sys.argv[0]获取当前正在执行的脚本
        current_script = os.path.abspath(sys.argv[0])
        logger.info(f"当前是非冻结程序，使用sys.argv[0]获取当前正在执行的脚本: {current_script}")
        return [sys.executable, current_script] 