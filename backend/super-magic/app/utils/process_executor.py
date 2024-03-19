"""
进程执行工具类

提供统一的异步子进程执行功能，包括：
- 命令执行和超时控制
- 进程终止管理（优雅终止 -> 强制杀死 -> 系统级清理）
- 环境变量过滤
- 输出格式化
"""

import asyncio
import os
import shlex
import subprocess
import sys
from pathlib import Path
from typing import Dict, Optional, Set, Tuple

from dotenv import dotenv_values

from agentlang.logger import get_logger
from app.core.entity.tool.tool_result import TerminalToolResult
from app.paths import PathManager

logger = get_logger(__name__)


class ProcessExecutor:
    """异步进程执行器"""

    @staticmethod
    def _load_env_variable_names(env_file_path: Path) -> Set[str]:
        """
        使用 python-dotenv 读取 .env 文件并提取所有环境变量名

        Args:
            env_file_path: .env 文件路径

        Returns:
            Set[str]: 环境变量名集合
        """
        env_var_names = set()

        if not env_file_path.exists():
            return env_var_names

        try:
            # 使用 dotenv_values 读取 .env 文件
            env_values = dotenv_values(dotenv_path=str(env_file_path))
            env_var_names.update(env_values.keys())

        except Exception as e:
            logger.warning(f"读取 .env 文件时出错: {e}")

        return env_var_names

    @staticmethod
    def _build_filtered_env() -> Dict[str, str]:
        """
        构建过滤后的环境变量字典

        Returns:
            Dict[str, str]: 过滤掉 .env 文件中定义的环境变量、并叠加用户持久化环境变量后的字典
        """
        # Filter the environment variable names in the .env file, although there is no sensitive information in sandbox, but it will interfere with the understanding of LLM.
        project_root = PathManager.get_project_root()
        env_file_path = project_root / ".env"
        env_var_names_to_filter = ProcessExecutor._load_env_variable_names(env_file_path)

        # 构建过滤后的环境变量
        env_vars = {}
        for key, value in os.environ.items():
            if key not in env_var_names_to_filter:
                env_vars[key] = value

        # 叠加用户持久化的环境变量（workspace/.skills/.env），覆盖同名系统变量
        # 该文件在容器重启后依然存在，是 skill 运行所需 API key 等配置的持久化存储
        try:
            user_env_file = PathManager.get_workspace_dir() / ".magic" / "skills" / ".env"
            if user_env_file.exists():
                user_env = dotenv_values(dotenv_path=str(user_env_file))
                env_vars.update({k: v for k, v in user_env.items() if v is not None})
                logger.debug(f"已加载用户持久化环境变量，共 {len(user_env)} 个: {user_env_file}")
        except Exception as e:
            logger.warning(f"加载用户持久化环境变量失败: {e}")

        return env_vars

    @staticmethod
    def _rewrite_python_command(
        command: str,
        cwd: Optional[Path] = None,
        enable_rewrite: bool = False
    ) -> str:
        """
        在 PyInstaller 环境下，将 `python script.py` 改写为 `{executable} exec-script script.py`
        这样脚本就可以使用打包的依赖，而不是系统 Python 环境

        Args:
            command: 原始命令
            cwd: 工作目录（用于解析相对路径）
            enable_rewrite: 是否启用命令改写，默认为 False

        Returns:
            str: 改写后的命令（如果不需要改写则返回原命令）
        """
        # 只在 PyInstaller 环境下且明确启用时才改写
        if not enable_rewrite or not getattr(sys, 'frozen', False):
            return command

        # 解析命令
        try:
            parts = shlex.split(command)
        except ValueError:
            # 无法解析的命令，保持原样
            return command

        # 检查是否是 python 命令
        if not parts or parts[0] not in ('python', 'python3', 'python3.11'):
            return command

        # 至少需要有脚本路径
        if len(parts) < 2:
            return command

        script_path = parts[1]
        script_args = parts[2:]

        # 检查脚本文件是否存在（支持相对路径）
        script_path_obj = Path(script_path)
        if not script_path_obj.is_absolute() and cwd:
            script_path_obj = cwd / script_path_obj

        # 如果脚本不存在，可能是参数（如 python -c "..."），保持原样
        if not script_path_obj.exists():
            return command

        # 改写命令：使用 script_runner 可执行文件
        # script_runner 与 main 在同一目录
        main_executable = Path(sys.executable)
        script_runner_path = main_executable.parent / 'script_runner'

        new_parts = [str(script_runner_path), script_path] + script_args
        new_command = shlex.join(new_parts)

        logger.info(f"命令改写: {command} -> {new_command}")
        return new_command

    @staticmethod
    def _format_process_output(
        stdout_str: str,
        stderr_str: str,
        exit_code: int
    ) -> Tuple[str, bool]:
        """
        格式化进程输出为人性化的内容

        Args:
            stdout_str: 标准输出内容
            stderr_str: 标准错误内容
            exit_code: 退出码

        Returns:
            Tuple[str, bool]: (格式化的内容, 是否成功)
        """
        if exit_code == 0:
            # 成功情况 - 提供更详细的人性化信息
            if stdout_str:
                content = f"Execution successful, output:\n{stdout_str}"
                if stderr_str:
                    content += f"\n\nWarnings/errors:\n{stderr_str}"
            elif stderr_str:
                content = f"Execution successful, but with warnings:\n{stderr_str}"
            else:
                content = f"Execution successful, no output"
            return content, True
        else:
            # 失败情况 - 提供清晰的错误信息
            content = f"Execution failed (exit code: {exit_code})"
            if stderr_str:
                content += f"\n\nError details:\n{stderr_str}"
            if stdout_str:
                content += f"\n\nStandard output:\n{stdout_str}"
            return content, False

    @staticmethod
    async def _terminate_process_gracefully(process: asyncio.subprocess.Process) -> None:
        """
        优雅地终止进程，使用渐进式策略

        Args:
            process: 要终止的进程
        """
        if process.returncode is not None:
            return  # 进程已经结束

        pid = process.pid
        try:
            # 第一步：优雅终止 (SIGTERM)
            logger.debug(f"尝试优雅终止进程 PID {pid}")
            process.terminate()
            try:
                # 等待 5 秒让进程优雅退出
                await asyncio.wait_for(process.wait(), timeout=5.0)
                logger.debug(f"进程 PID {pid} 已优雅退出")
                return
            except asyncio.TimeoutError:
                # 第二步：强制杀死 (SIGKILL)
                logger.debug(f"优雅终止失败，强制杀死进程 PID {pid}")
                process.kill()
                try:
                    # 等待 1 秒，SIGKILL 应该立即生效
                    await asyncio.wait_for(process.wait(), timeout=1.0)
                    logger.debug(f"进程 PID {pid} 已被强制杀死")
                    return
                except asyncio.TimeoutError:
                    # 第三步：兜底使用系统 kill -9 处理进程组
                    logger.warning(f"process.kill() 失败，使用系统命令 kill -9 处理进程组 PID {pid}")
                    try:
                        # 杀死整个进程组，确保子进程也被清理
                        subprocess.run(['kill', '-9', f'-{pid}'], check=False, timeout=5)
                        await asyncio.sleep(1)  # 给系统时间清理
                        logger.debug(f"已使用 kill -9 处理进程组 {pid}")
                    except Exception as e:
                        logger.error(f"系统 kill -9 也失败了: {e}")
        except Exception as e:
            logger.exception(f"终止进程时出错: {e}")

    @staticmethod
    async def execute_command(
        command: str,
        cwd: Optional[Path] = None,
        timeout: int = 60,
        enable_python_rewrite: bool = False
    ) -> TerminalToolResult:
        """
        执行命令并返回结果

        Args:
            command: 要执行的命令
            cwd: 工作目录，默认为None
            timeout: 超时时间（秒），默认60秒
            enable_python_rewrite: 是否启用 Python 命令改写（仅在特定场景如 skills 执行时启用），默认为 False

        Returns:
            TerminalToolResult: 执行结果
        """
        try:
            # 在 PyInstaller 环境下且明确启用时改写 python 命令
            command = ProcessExecutor._rewrite_python_command(command, cwd, enable_python_rewrite)

            # 构建过滤后的环境变量
            env_vars = ProcessExecutor._build_filtered_env()

            # Use bash to execute command for bash features support (like brace expansion)
            # Use shlex.quote to ensure command is safely quoted
            # Prefer /bin/bash, fallback to /bin/sh if not exists
            bash_path = '/bin/bash' if os.path.exists('/bin/bash') else '/bin/sh'
            shell_command = f'{bash_path} -c {shlex.quote(command)}'

            # 创建子进程
            process = await asyncio.create_subprocess_shell(
                shell_command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(cwd) if cwd else None,
                env=env_vars,
            )

            try:
                # 等待进程完成，带超时
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(), timeout=timeout
                )
                stdout_str = stdout.decode().strip() if stdout else ""
                stderr_str = stderr.decode().strip() if stderr else ""
                exit_code = process.returncode

                # 格式化输出内容
                content, is_success = ProcessExecutor._format_process_output(
                    stdout_str, stderr_str, exit_code
                )

                # 构建结果
                result = TerminalToolResult(
                    command=command,
                    content=content,
                    ok=is_success
                )
                result.set_exit_code(exit_code)

                # 将结构化信息保存到extra_info字段，供系统内部使用
                result.extra_info = {
                    "command": command,
                    "cwd": str(cwd) if cwd else "",
                    "stdout": stdout_str,
                    "stderr": stderr_str,
                    "exit_code": exit_code,
                    "execution_time": timeout,
                }

                return result

            except asyncio.TimeoutError:
                # 超时，渐进式终止进程
                await ProcessExecutor._terminate_process_gracefully(process)

                return TerminalToolResult(
                    error=f"命令执行超时 ({timeout}秒)",
                    command=command,
                    exit_code=-1  # 使用-1表示超时
                )

        except Exception as e:
            logger.exception(f"执行命令时出错: {e}")
            return TerminalToolResult(
                error=f"执行命令时出错: {e}",
                command=command,
                exit_code=-2  # 使用-2表示异常
            )
