"""
PyInstaller 资源提取命令模块
"""
import sys
from agentlang.logger import get_logger

# 获取日志记录器
logger = get_logger(__name__)

def extract_pyinstaller_resources():
    """提取 PyInstaller 打包的资源文件并退出应用
    
    直接打印日志并退出
    """
    print("只解压 PyInstaller 资源文件，不启动应用")
    logger.info("只解压 PyInstaller 资源文件，不启动应用")
