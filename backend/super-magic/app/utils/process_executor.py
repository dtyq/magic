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
from pathlib import Path
from typing import Dict, Optional, Set, Tuple

from dotenv import dotenv_values

from agentlang.logger import get_logger
from app.core.entity.tool.tool_result_types import TerminalToolResult
from app.path_manager import PathManager

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

        # 按优先级从低到高叠加用户持久化环境变量，后者覆盖前者
        try:
            for env_path in PathManager.get_process_env_paths():
                if env_path.exists():
                    user_env = dotenv_values(dotenv_path=str(env_path))
                    env_vars.update({k: v for k, v in user_env.items() if v is not None})
                    logger.debug(f"已加载用户持久化环境变量，共 {len(user_env)} 个: {env_path}")
        except Exception as e:
            logger.warning(f"加载用户持久化环境变量失败: {e}")

        return env_vars

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
            if stdout_str:
                content = stdout_str
                if stderr_str:
                    content += f"\n\nWarnings/errors:\n{stderr_str}"
            elif stderr_str:
                content = stderr_str
            else:
                content = "No output"
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
        extra_env: Optional[Dict[str, str]] = None,
        interruption_event: Optional[asyncio.Event] = None,
    ) -> TerminalToolResult:
        """
        执行命令并返回结果

        Args:
            command: 要执行的命令
            cwd: 工作目录，默认为None
            timeout: 超时时间（秒），默认60秒
            extra_env: 仅对当前子进程附加的环境变量，优先级高于默认环境
            interruption_event: 中断事件，被 set 时终止子进程并抛出 asyncio.CancelledError

        Returns:
            TerminalToolResult: 执行结果

        Raises:
            asyncio.CancelledError: 当 interruption_event 触发时抛出，表示 run 已中断
        """
        try:
            # 构建过滤后的环境变量
            env_vars = ProcessExecutor._build_filtered_env()
            if extra_env:
                env_vars.update(extra_env)

            # Use bash to execute command for bash features support (like brace expansion)
            # Use shlex.quote to ensure command is safely quoted
            # Prefer /bin/bash, fallback to /bin/sh if not exists
            bash_path = '/bin/bash' if os.path.exists('/bin/bash') else '/bin/sh'
            shell_command = f'{bash_path} -c {shlex.quote(command)}'

            # 启动前检查：如果中断信号已经到达，直接抛出，避免多余的子进程创建
            if interruption_event and interruption_event.is_set():
                raise asyncio.CancelledError()

            # 创建子进程
            process = await asyncio.create_subprocess_shell(
                shell_command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(cwd) if cwd else None,
                env=env_vars,
            )

            try:
                if interruption_event is not None:
                    # 并行等待进程完成与中断信号，先到先处理
                    stdout, stderr = await ProcessExecutor._communicate_with_interruption(
                        process, timeout, interruption_event
                    )
                else:
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

            except asyncio.CancelledError:
                # 中断信号触发，终止子进程后向上传播
                await ProcessExecutor._terminate_process_gracefully(process)
                raise

            except asyncio.TimeoutError:
                # 超时，渐进式终止进程
                await ProcessExecutor._terminate_process_gracefully(process)

                return TerminalToolResult.error(
                    f"Command timed out ({timeout}s)",
                    command=command,
                    exit_code=-1,
                )

        except asyncio.CancelledError:
            raise

        except Exception as e:
            logger.exception(f"执行命令时出错: {e}")
            return TerminalToolResult.error(
                f"Command execution failed: {e}",
                command=command,
                exit_code=-2,
            )

    @staticmethod
    async def _communicate_with_interruption(
        process: asyncio.subprocess.Process,
        timeout: int,
        interruption_event: asyncio.Event,
    ) -> Tuple[bytes, bytes]:
        """并行等待 process.communicate() 与 interruption_event。

        中断信号先到则终止进程并抛 CancelledError；
        超时先到则由外层 TimeoutError 处理。

        Raises:
            asyncio.CancelledError: 中断信号触发
            asyncio.TimeoutError: 超时
        """
        comm_task = asyncio.ensure_future(process.communicate())
        interrupt_task = asyncio.ensure_future(interruption_event.wait())

        try:
            done, pending = await asyncio.wait(
                [comm_task, interrupt_task],
                timeout=timeout,
                return_when=asyncio.FIRST_COMPLETED,
            )
        except BaseException:
            comm_task.cancel()
            interrupt_task.cancel()
            raise

        # 超时：两个 task 都还在 pending
        if not done:
            comm_task.cancel()
            interrupt_task.cancel()
            raise asyncio.TimeoutError()

        if interrupt_task in done:
            # 中断信号先到：取消 communicate，终止进程，抛 CancelledError
            comm_task.cancel()
            await ProcessExecutor._terminate_process_gracefully(process)
            raise asyncio.CancelledError()

        # 进程正常结束
        interrupt_task.cancel()
        return comm_task.result()
