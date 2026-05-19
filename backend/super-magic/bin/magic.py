#!/usr/bin/env python
"""
命令行界面，用于调用 Agent 类

使用方法:
    python -m bin.magic [--agent-name AGENT_NAME] [--clean] [--clean-chat] [--clean-workspace] [--clean-mcp] [--mount DIRECTORY_PATH] [--mode MODE] [查询文本]
    或者直接执行: ./bin/magic.py [--agent-name AGENT_NAME] [--clean] [--clean-chat] [--clean-workspace] [--clean-mcp] [--mount DIRECTORY_PATH] [--mode MODE] [查询文本]

参数:
    --agent-name: 指定要使用的 agent 名称，默认根据 mode 确定 (normal 模式为 "magic"，super 模式为 "super-magic")
    --clean, -c: 清理历史对话记录、工作空间文件和 MCP 缓存文件
    --clean-chat, -cc: 仅清理历史对话记录文件
    --clean-workspace, -cw: 仅清理工作空间文件
    --clean-mcp, -cm: 仅清理 MCP 缓存文件
    --mount, -m: 挂载指定目录中的内容到.workspace目录
    --mode: 运行模式，可选值为 "normal" 或 "super"，默认为 "super"。normal 模式使用 magic.agent，super 模式使用 super-magic.agent
    查询文本: 可选，直接向代理发送的消息。如果提供，将执行单次查询并退出；否则进入交互模式。

MCP 配置:
    系统会自动读取 config/mcp.json 文件中的 MCP 服务器配置。如果文件不存在，将跳过 MCP 初始化。
    支持断线重启后从 .chat_history/mcp_manifest.json 自动恢复连接。
"""
# 先导入基础Python库
import os
import sys
import traceback
from pathlib import Path
import inspect
import asyncio
import argparse
import shutil

# 设置正确的工作目录
# 获取项目根目录，使用文件所在位置的父目录
project_root = Path(__file__).resolve().parent.parent

# 添加项目根目录到 Python 路径
sys.path.append(str(project_root))

# 加载环境变量 - 在设置Python路径后导入
from dotenv import load_dotenv
load_dotenv(override=True)

# 初始化步骤 - 所有项目内模块导入都放到sys.path设置后
from app.path_manager import PathManager
PathManager.set_project_root(project_root)
from agentlang.context.application_context import ApplicationContext
ApplicationContext.set_path_manager(PathManager())

from agentlang.logger import setup_logger, get_logger, configure_logging_intercept
from agentlang.utils.file import clear_directory_contents

# 导入其他项目模块
import aiofiles # 导入 aiofiles
import aiofiles.os # 导入 aiofiles.os
from app.core.context.agent_context import AgentContext

# 使用agentlang.logger模块的配置函数，从环境变量获取日志级别，默认为INFO
log_level = os.getenv("LOG_LEVEL", "INFO")
# 设置logger并自动保存到ApplicationContext中
logger = setup_logger(log_name="app", console_level=log_level)
configure_logging_intercept()

# 获取为当前模块命名的日志记录器
logger = get_logger(__name__)

async def clean_chat_history():
    """
    异步清理.chat_history目录中的文件
    但保留目录本身

    Returns:
        bool: 操作是否成功
    """
    result = await clear_directory_contents(PathManager.get_chat_history_dir())
    if not result:
        logger.error("清理 chat history 失败")
    return result

async def clean_workspace():
    """
    异步清理.workspace目录中的文件
    但保留目录本身

    Returns:
        bool: 操作是否成功
    """
    result = await clear_directory_contents(PathManager.get_workspace_dir())
    if not result:
        logger.error("清理 workspace 失败")
    return result

async def clean_mcp():
    """
    异步清理.mcp目录中的文件
    但保留目录本身

    Returns:
        bool: 操作是否成功
    """
    mcp_dir = PathManager.get_mcp_config_dir()
    result = await clear_directory_contents(mcp_dir)
    if not result:
        logger.error("清理 .mcp 目录失败")
    return result

async def clean_debug_logs():
    """
    异步删除调试日志文件

    读取 STDOUT_MESSAGE_DEBUG_FILE 和 STDOUT_STREAM_DEBUG_FILE 环境变量指定的文件路径，
    若文件存在则删除。路径解析方式与 StdoutStream 一致，基于当前工作目录。

    Returns:
        bool: 操作是否成功
    """
    env_keys = ["STDOUT_MESSAGE_DEBUG_FILE", "STDOUT_STREAM_DEBUG_FILE"]
    success = True
    for key in env_keys:
        path_str = os.environ.get(key)
        if not path_str:
            continue
        abs_path = Path(os.path.abspath(path_str))
        try:
            if await aiofiles.os.path.exists(abs_path):
                await aiofiles.os.remove(abs_path)
                logger.info(f"已删除调试日志文件: {abs_path}")
        except Exception as e:
            logger.error(f"删除调试日志文件 {abs_path} 失败: {e}")
            success = False
    return success


async def clean_directories():
    """
    异步清理.chat_history、.workspace和.mcp目录中的文件
    但保留目录本身

    Returns:
        bool: 操作是否成功
    """
    # 并发执行四个清理任务
    chat_result, workspace_result, mcp_result, debug_logs_result = await asyncio.gather(
        clean_chat_history(),
        clean_workspace(),
        clean_mcp(),
        clean_debug_logs()
    )

    return chat_result and workspace_result and mcp_result and debug_logs_result


def print_banner(mode='super'):
    """打印欢迎横幅"""
    mode_display = "NORMAL" if mode == 'normal' else "SUPER"
    banner = f"""
    ========================================================
                MAGIC CLI - v6 [{mode_display} MODE]
    ========================================================
    使用此命令行工具与 AI 代理进行交互
    输入您的问题，或输入 'exit' 退出
    ========================================================
    """
    logger.info(banner)


async def initialize_mcp_manager(agent_context=None):
    """初始化全局 MCP 管理器"""
    from app.service.mcp_service import MCPService

    try:
        # 通过 MCPService 初始化全局管理器，它会自动读取 config/mcp.json
        success = await MCPService.initialize_from_global_config(agent_context=agent_context)
        return success
    except Exception as e:
        logger.error(f"初始化 MCP 管理器时出错: {e}")
        return False


async def mount_directory(source_dir: str):
    """
    异步将指定目录中的内容复制到 .workspace 目录。

    Args:
        source_dir: 源目录路径，可以是相对路径或绝对路径

    Returns:
        bool: 操作是否成功
    """
    copied_count = 0
    try:
        # 确保源目录存在且是目录 (使用 aiofiles.os)
        # 注意：Path.resolve() 本身是同步的，但通常非常快
        source_path = Path(source_dir).resolve()
        if not await aiofiles.os.path.exists(source_path):
            logger.error(f"源目录不存在: {source_path}")
            return False

        if not await aiofiles.os.path.isdir(source_path):
            logger.error(f"指定的路径不是目录: {source_path}")
            return False

        # 确保 workspace 目录存在 (使用 aiofiles.os)
        await aiofiles.os.makedirs(PathManager.get_workspace_dir(), exist_ok=True)

        # 异步复制目录内容
        copy_tasks = []
        # 遍历目录结构 (glob 是同步的，但在循环内处理 IO)
        for item in source_path.glob('**/*'):
            relative_path = item.relative_to(source_path)
            target_path = PathManager.get_workspace_dir() / relative_path

            if item.is_dir(): # is_dir 是同步的，但很快
                # 异步创建目标目录
                await aiofiles.os.makedirs(target_path, exist_ok=True)
            else:
                # 异步确保父目录存在
                await aiofiles.os.makedirs(target_path.parent, exist_ok=True)
                # 使用 asyncio.to_thread 异步执行 shutil.copy2
                copy_tasks.append(
                    asyncio.create_task(asyncio.to_thread(shutil.copy2, item, target_path))
                )
                # copied_count 可以在 gather 后统计成功的文件数

        # 等待所有复制任务完成
        results = await asyncio.gather(*copy_tasks, return_exceptions=True)

        # 统计成功和失败的复制
        successful_copies = 0
        failed_copies = 0
        for i, result in enumerate(results):
            # 注意：需要一种方式将 result 映射回原始 item/target_path 以便记录详细错误
            # 为了简化，我们暂时只计数
            if isinstance(result, Exception):
                logger.error(f"异步复制文件时出错: {result}", exc_info=result)
                failed_copies += 1
            else:
                successful_copies += 1

        if failed_copies == 0:
            logger.info(f"成功将 {source_path} 中的 {successful_copies} 个文件异步挂载到 {PathManager.get_workspace_dir()}")
            return True
        else:
            logger.error(f"异步挂载 {source_path} 目录时出错：成功 {successful_copies} 个文件，失败 {failed_copies} 个文件")
            return False

    except Exception as e:
        logger.error(f"挂载目录时发生意外错误: {e}", exc_info=True)
        return False


async def cleanup_resources():
    """Clean up all async resources before exit"""
    try:
        # Import the global MCP manager shutdown function
        from app.mcp.manager import shutdown_global_mcp_manager

        logger.info("正在清理异步资源...")
        await shutdown_global_mcp_manager()
        logger.info("异步资源清理完成")

    except Exception as e:
        logger.warning(f"清理资源时出错: {e}")


async def main():
    """主函数，解析命令行参数并调用 Agent 类"""
    # 创建参数解析器
    parser = argparse.ArgumentParser(description='命令行界面，用于调用 Agent 类')

    # 添加参数
    parser.add_argument('--agent-name', type=str, default=None,
                        help='agent 名称，默认根据 mode 参数确定')
    parser.add_argument('--agent-display-name', type=str, default=None,
                        help='自定义 Agent 显示名称，如：小智、财务助手等')
    parser.add_argument('--agent-display-description', type=str, default=None,
                        help='自定义 Agent 介绍，如：是一个专业的AI助手。')
    parser.add_argument('--clean', '-c', action='store_true',
                        help='清理历史对话记录、工作空间文件和 MCP 缓存文件')
    parser.add_argument('--clean-chat', '-cc', action='store_true',
                        help='仅清理历史对话记录文件')
    parser.add_argument('--clean-workspace', '-cw', action='store_true',
                        help='仅清理工作空间文件')
    parser.add_argument('--clean-mcp', '-cm', action='store_true',
                        help='仅清理 MCP 缓存文件')
    parser.add_argument('--mount', '-m', type=str,
                        help='挂载指定目录中的内容到.workspace目录')
    parser.add_argument('--mode', type=str, choices=['normal', 'super'], default='super',
                        help='运行模式：normal 使用 magic.agent，super 使用 super-magic.agent，默认为 super')
    parser.add_argument('--message-version', type=str, choices=['v1', 'v2'], default='v2',
                        help='消息版本：v1 使用标准消息格式，v2 使用 super_magic_message 格式，默认为 v1')
    parser.add_argument('query', nargs='?', type=str, default=None,
                        help='要发送给 agent 的查询文本。如果提供，则执行单次查询并退出')

    # 解析参数
    args = parser.parse_args()

    # 处理清理选项
    cleaned = False

    # 如果指定了清理选项，先异步清理目录
    if args.clean:
        if await clean_directories():
            logger.info("目录清理完成")
            cleaned = True
        else:
            logger.error("目录清理失败")

    # 如果指定了仅清理历史对话记录选项
    elif args.clean_chat:
        if await clean_chat_history():
            logger.info("历史对话记录清理完成")
            cleaned = True
        else:
            logger.error("历史对话记录清理失败")

    # 如果指定了仅清理工作空间选项
    elif args.clean_workspace:
        if await clean_workspace():
            logger.info("工作空间清理完成")
            cleaned = True
        else:
            logger.error("工作空间清理失败")

    # 如果指定了仅清理 MCP 缓存选项
    elif args.clean_mcp:
        if await clean_mcp():
            logger.info("MCP 缓存清理完成")
            cleaned = True
        else:
            logger.error("MCP 缓存清理失败")

    # 如果只是清理而没有查询，则直接退出
    if cleaned and not args.query and not args.mount:
        return

    # 如果指定了挂载选项，异步挂载目录
    if args.mount:
        if not await mount_directory(args.mount):
            logger.error("挂载目录失败，程序退出")
            return

    try:
        # 根据 mode 确定默认的 agent_name
        agent_name = args.agent_name
        if agent_name is None:
            if args.mode == 'normal':
                agent_name = 'magic'
                logger.info(f"使用 normal 模式，agent_name 设置为 {agent_name}")
            else:  # args.mode == 'super'
                agent_name = 'super-magic'
                logger.info(f"使用 super 模式，agent_name 设置为 {agent_name}")
        else:
            logger.info(f"使用指定的 agent_name: {agent_name}")

        # 使用 AgentDispatcher 模式避免循环导入
        from app.service.agent_dispatcher import AgentDispatcher
        from app.core.entity.message.client_message import AgentMode

        dispatcher = AgentDispatcher.get_instance()
        await dispatcher.setup()

        # 将 CLI 指定的消息版本写入 agent_context（生产路径由 set_chat_client_message 负责）
        if args.message_version != 'v2':
            dispatcher.agent_context.shared_context.update_field("message_version", args.message_version)
            logger.info(f"CLI: 消息版本设置为 {args.message_version}")

        # 设置自定义 Agent Profile（如果提供）
        if args.agent_display_name or args.agent_display_description:
            from app.core.entity.agent_profile import AgentProfile, DEFAULT_AGENT_PROFILE

            agent_profile = AgentProfile(
                name=args.agent_display_name or DEFAULT_AGENT_PROFILE.name,
                description=args.agent_display_description or DEFAULT_AGENT_PROFILE.description
            )
            dispatcher.agent_context.set_agent_profile(agent_profile)
            logger.info(f"CLI: 设置 Agent Profile - name={agent_profile.name}")

        # 初始化全局 MCP 管理器
        await initialize_mcp_manager(dispatcher.agent_context)

        # 根据 agent_name 确定 agent_mode（完整映射）
        if agent_name == 'magic':
            agent_mode = AgentMode.GENERAL
        elif agent_name == 'slider':
            agent_mode = AgentMode.PPT
        elif agent_name == 'data-analyst':
            agent_mode = AgentMode.DATA_ANALYSIS
        elif agent_name == 'summary' or agent_name == 'audio':  # 兼容旧名称summary和新文件名audio
            agent_mode = AgentMode.SUMMARY
        elif agent_name == 'summary-chat' or agent_name == 'audio-chat':  # 兼容旧名称和新文件名
            agent_mode = AgentMode.SUMMARY_CHAT
        elif agent_name == 'summary-video' or agent_name == 'video':  # 兼容summary-video和video
            agent_mode = AgentMode.SUMMARY_VIDEO
        elif agent_name == 'super-magic':
            agent_mode = AgentMode.GENERAL  # 或者可以设置一个新的模式
        elif agent_name == 'test':
            agent_mode = AgentMode.TEST
        else:
            # 直接传 agent_name 字符串，由 switch_agent 检查本地文件或调用 API
            agent_mode = agent_name

        # 使用 switch_agent 延迟创建 Agent（避免循环导入）
        agent = await dispatcher.switch_agent(agent_mode)
        # 检查 run 方法是否已实现
        run_method = getattr(agent, 'run')
        run_source = inspect.getsource(run_method)

        if "pass" in run_source and len(run_source.strip().splitlines()) <= 2:
            logger.warning("\n警告: Agent 类的 run 方法尚未实现，无法处理查询。")
            return

        # 如果提供了查询文本，则执行单次查询并退出
        if args.query:
            response = await agent.run(args.query)
            logger.info(f"\n{response}")
            return

        # 否则进入交互模式并打印欢迎横幅
        print_banner(args.mode)

        # 提供交互界面
        while True:
            try:
                query = input("\n请输入问题 (输入 'exit' 退出): ")
                if query.lower() in ('exit', 'quit', 'q'):
                    break

                response = await agent.run(query)
                logger.info(f"\n{response}")
            except KeyboardInterrupt:
                logger.info("\n程序已终止")
                break
            except Exception as e:
                logger.error(f"处理查询时出错: {e}", exc_info=True)
                logger.error(f"Traceback: {traceback.format_exc()}")
    except Exception as e:
        # 打印堆栈
        logger.error(f"初始化时出错: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return
    finally:
        # Add cleanup logic before exit
        await cleanup_resources()


if __name__ == "__main__":
    asyncio.run(main())
