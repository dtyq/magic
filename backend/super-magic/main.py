# AI警告: 环境变量加载必须放在所有导入之前
from dotenv import load_dotenv
load_dotenv(override=True)

import os
import sys
from pathlib import Path
import multiprocessing
import asyncio
import time
from typing import Optional

# 记录程序真正的启动时间
PROGRAM_START_TIME = time.time()

# 获取项目根目录，使用文件所在位置的父目录
project_root = Path(__file__).resolve().parent

# 添加项目根目录到 Python 路径
sys.path.append(str(project_root))

# 初始化 PathManager
from app.paths import PathManager
PathManager.set_project_root(project_root)
from agentlang.context.application_context import ApplicationContext
ApplicationContext.set_path_manager(PathManager)

import traceback
import typer

from agentlang.logger import setup_logger, get_logger, configure_logging_intercept
from agentlang.context.application_context import ApplicationContext
from app.command.ws_server import start_ws_server
from app.command.extract_pyinstaller import extract_pyinstaller_resources
from app.command.storage_uploader_tool import start_storage_uploader_watcher
from app.command.tool_generator import generate_tool_definitions, validate_tool_definitions, show_tool_definitions_stats
from agentlang.utils.file import clear_directory_contents
from app.infrastructure.git.git import GitService

# 初始化日志配置
os.makedirs("logs", exist_ok=True)
# 使用agentlang.logger模块的配置函数，从环境变量获取日志级别，默认为INFO
log_level = os.getenv("LOG_LEVEL", "INFO")
# 设置logger并自动保存到ApplicationContext中
logger = setup_logger(log_name="app", console_level=log_level)
configure_logging_intercept()


# 获取为当前模块命名的日志记录器
logger = get_logger(__name__)

cli = typer.Typer(help="SuperMagic CLI", no_args_is_help=True)

app_cmds = typer.Typer(help="启动相关命令")
cli.add_typer(app_cmds, name="start")

storage_uploader_cmds = typer.Typer(help="通用存储上传工具命令")
cli.add_typer(storage_uploader_cmds, name="storage-uploader")

tool_cmds = typer.Typer(help="工具管理相关命令")
cli.add_typer(tool_cmds, name="tools")

# 清理相关函数 (from HEAD)
async def clean_chat_history():
    """
    异步清理.chat_history目录中的文件
    但保留目录本身
    """
    result = await clear_directory_contents(PathManager.get_chat_history_dir())
    if not result:
        logger.error("清理 chat history 失败")
    return result

async def clean_workspace():
    """
    异步清理.workspace目录中的文件
    但保留目录本身
    """
    result = await clear_directory_contents(PathManager.get_workspace_dir())
    if not result:
        logger.error("清理 workspace 失败")
    return result

async def clean_directories():
    """
    异步清理.chat_history和.workspace目录中的文件
    但保留目录本身
    """
    chat_result, workspace_result = await asyncio.gather(
        clean_chat_history(),
        clean_workspace()
    )
    return chat_result and workspace_result

@cli.command("clean", help="清理历史对话记录和工作空间文件") # from HEAD
def clean_command(
    clean_all: bool = typer.Option(False, "--all", "-a", help="清理历史对话记录和工作空间文件"), # Changed -c to -a to avoid conflict
    clean_chat: bool = typer.Option(False, "--chat", "-cc", help="仅清理历史对话记录文件"),
    clean_workspace: bool = typer.Option(False, "--workspace", "-cw", help="仅清理工作空间文件")
):
    """清理项目相关目录的命令封装"""
    try:
        cleaned = False
        if not (clean_all or clean_chat or clean_workspace):
            clean_all = True

        if clean_all:
            result = asyncio.run(clean_directories())
            if result:
                logger.info("历史对话记录和工作空间文件清理完成")
                cleaned = True
            else:
                logger.error("历史对话记录和工作空间文件清理失败")
        elif clean_chat:
            result = asyncio.run(clean_chat_history())
            if result:
                logger.info("历史对话记录清理完成")
                cleaned = True
            else:
                logger.error("历史对话记录清理失败")
        elif clean_workspace:
            result = asyncio.run(clean_workspace())
            if result:
                logger.info("工作空间文件清理完成")
                cleaned = True
            else:
                logger.error("工作空间文件清理失败")

        return cleaned
    except Exception as e:
        logger.error(f"清理过程中发生错误: {e}")
        logger.error(f"堆栈信息: {traceback.format_exc()}")
        return False

@app_cmds.command("ws-server", help="启动WebSocket服务器")
def ws_server_command(
    clean_all: bool = typer.Option(False, "--clean", "-c", help="启动前清理历史对话记录和工作空间文件"),
    clean_chat: bool = typer.Option(False, "--clean-chat", "-cc", help="启动前仅清理历史对话记录文件"),
    clean_workspace: bool = typer.Option(False, "--clean-workspace", "-cw", help="启动前仅清理工作空间文件")
):
    """启动WebSocket服务器命令封装"""

    try:
        if clean_all or clean_chat or clean_workspace:
            clean_command(clean_all=clean_all, clean_chat=clean_chat, clean_workspace=clean_workspace)

        if not os.getenv("SANDBOX_ID"):
            os.environ["SANDBOX_ID"] = "default"

        # 设置程序启动时间到环境变量，供 start_ws_server 使用
        os.environ["STARTUP_START_TIME"] = str(PROGRAM_START_TIME)

        # 启动WebSocket服务器
        start_ws_server()
    except Exception as e:
        logger.error(f"启动WebSocket服务器时发生错误: {e}")
        logger.error(f"堆栈信息: {traceback.format_exc()}")

@cli.command("extract-pyinstaller", help="只提取 PyInstaller 打包的资源文件，不启动应用")
def extract_pyinstaller_command():
    """提取 PyInstaller 打包的资源文件并退出命令封装"""
    extract_pyinstaller_resources()

@storage_uploader_cmds.command("watch", help="监控目录变化并自动上传到由环境变量 STORAGE_PLATFORM 配置的存储后端")
def storage_uploader_watch_command(
    # Parameters from feature/support-aliyun-oss
    sandbox: Optional[str] = typer.Option(None, "--sandbox", help="沙盒ID，默认为None"),
    dir: str = typer.Option(".workspace", "--dir", help="要监控的目录路径，默认为.workspace"),
    once: bool = typer.Option(False, "--once", help="只扫描一次已有文件后退出，不持续监控"),
    refresh: bool = typer.Option(False, "--refresh", help="强制刷新所有文件"),
    credentials: Optional[str] = typer.Option(None, "--credentials", "-c", help="指定凭证文件路径。如果提供，将覆盖 --use-context。"), # -c was for clean in HEAD, ensure no conflict or choose different short opts
    use_context: bool = typer.Option(False, "--use-context", help="尝试使用 'config/upload_credentials.json' 作为凭证文件，除非提供了 --credentials。"),
    task_id: Optional[str] = typer.Option(None, "--task-id", help="任务ID (用于文件注册)"),
    organization_code: Optional[str] = typer.Option(None, "--organization-code", help="组织编码"),
    log_level: str = typer.Option("INFO", "--log-level", help="设置日志级别 (DEBUG, INFO, WARNING, ERROR)"),
    # Clean parameters from HEAD
    clean_all_storage: bool = typer.Option(False, "--clean-storage-all", "-csa", help="启动监控前清理历史对话记录和工作空间文件"), # Renamed to avoid conflict with -c for credentials
    clean_chat_storage: bool = typer.Option(False, "--clean-storage-chat", "-csc", help="启动监控前仅清理历史对话记录文件"),
    clean_workspace_storage: bool = typer.Option(False, "--clean-storage-workspace", "-csw", help="启动监控前仅清理工作空间文件")
):
    """监控目录变化并自动上传到由环境变量 STORAGE_PLATFORM 配置的存储后端的命令封装"""
    try:

        logger.info("Initiating git service.")
        # 初始化 git 服务开始===============================
        git_service = GitService()
        # 初始化 git 服务结束===============================
        logger.info("git service initiated.")


        # Handle clean options first (from HEAD)
        if clean_all_storage or clean_chat_storage or clean_workspace_storage:
            logger.info("storage_uploader_watch_command: Initiating pre-watch cleanup.")
            clean_command(
                clean_all=clean_all_storage,
                clean_chat=clean_chat_storage,
                clean_workspace=clean_workspace_storage
            )

        # Proceed with uploader logic (from feature/support-aliyun-oss)
        logger.info(f"CLI (main.py): storage-uploader watch called. Log: {log_level}. UseContext: {use_context}. STORAGE_PLATFORM by env.")
        start_storage_uploader_watcher( # Call the new uploader function
            sandbox_id=sandbox,
            workspace_dir=dir,
            once=once,
            refresh=refresh,
            credentials_file=credentials,
            use_context=use_context,
            task_id=task_id,
            organization_code=organization_code,
            log_level=log_level
        )

    except Exception as e:
        logger.error(f"监控目录并上传时发生错误: {e}") # Generic error message
        logger.error(f"堆栈信息: {traceback.format_exc()}")

@tool_cmds.command("generate", help="生成工具定义文件")
def generate_tools_command():
    """生成工具定义文件到 config/tool_definitions.json"""
    try:
        success = generate_tool_definitions()
        if success:
            logger.info("工具定义文件生成完成")
        else:
            logger.error("工具定义文件生成失败")
            raise typer.Exit(code=1)
    except Exception as e:
        logger.error(f"生成工具定义文件时发生错误: {e}")
        logger.error(f"堆栈信息: {traceback.format_exc()}")
        raise typer.Exit(code=1)

@tool_cmds.command("validate", help="验证工具定义文件")
def validate_tools_command():
    """验证工具定义文件 config/tool_definitions.json"""
    try:
        valid = validate_tool_definitions()
        if valid:
            logger.info("工具定义文件验证通过")
        else:
            logger.error("工具定义文件验证失败")
            raise typer.Exit(code=1)
    except Exception as e:
        logger.error(f"验证工具定义文件时发生错误: {e}")
        logger.error(f"堆栈信息: {traceback.format_exc()}")
        raise typer.Exit(code=1)

@tool_cmds.command("stats", help="显示工具定义统计信息")
def stats_tools_command():
    """显示工具定义统计信息 config/tool_definitions.json"""
    try:
        show_tool_definitions_stats()
    except Exception as e:
        logger.error(f"显示工具统计信息时发生错误: {e}")
        logger.error(f"堆栈信息: {traceback.format_exc()}")
        raise typer.Exit(code=1)

if __name__ == "__main__":
    multiprocessing.freeze_support()
    try:
        cli()
    except KeyboardInterrupt:
        logger.info("程序通过 KeyboardInterrupt 退出")
    except Exception as e:
        # traceback import is already at the top
        traceback.print_exc()
        logger.error(f"程序异常退出: {e}")
    finally:
        logger.info("程序已完全退出")
