"""
进程执行工具类

提供统一的异步子进程执行功能，包括：
- 命令执行和超时控制
- 进程终止管理（优雅终止 -> 强制杀死 -> 系统级清理）
- 环境变量过滤
- 输出格式化
- 流式写文件模式（后台运行 + prompt 检测）
"""

import asyncio
import os
import re
import shlex
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, Union

from dotenv import dotenv_values

from agentlang.logger import get_logger
from app.core.entity.tool.tool_result_types import TerminalToolResult
from app.path_manager import PathManager
from app.tools.shell_exec_utils.bg_task_models import BackgroundStartResult, PROMPT_QUIET_SECS, PROMPT_QUIET_SECS_SYNC
from app.tools.shell_exec_utils.bg_prompt_detector import extract_last_line, looks_like_prompt, scan_chunk_for_prompt

logger = get_logger(__name__)

# ── 输出截断常量（防止超大输出打爆 LLM 上下文）─────────────────────────────
# 返回给 LLM 的最大字符数
_LLM_OUTPUT_MAX_CHARS: int = 20_000
# 超限时头部保留字符数
_LLM_OUTPUT_HEAD_CHARS: int = 5_000
# 超限时尾部保留字符数（尾部更重要：最新输出 / 交互式 prompt 在末尾）
_LLM_OUTPUT_TAIL_CHARS: int = 13_000


def truncate_output_for_llm(text: str, max_chars: int = _LLM_OUTPUT_MAX_CHARS) -> str:
    """
    对发往 LLM 的输出文本做头尾截断。

    超过 max_chars 时，保留头部 _LLM_OUTPUT_HEAD_CHARS + 尾部 _LLM_OUTPUT_TAIL_CHARS，
    中间插入截断标记。不截断 extra_info / 前端展示用的 stdout 字段。
    """
    if len(text) <= max_chars:
        return text
    removed = len(text) - _LLM_OUTPUT_HEAD_CHARS - _LLM_OUTPUT_TAIL_CHARS
    marker = f"\n... [{removed} chars truncated, showing head and tail] ...\n"
    return text[:_LLM_OUTPUT_HEAD_CHARS] + marker + text[-_LLM_OUTPUT_TAIL_CHARS:]


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
    def _rewrite_single_python_command(command: str, cwd: Optional[Path]) -> str:
        """
        改写单个不含链式操作符的 python 命令。

        在 PyInstaller 环境下将 `python script.py` 改写为
        `{script_runner} script.py`，使脚本使用打包的依赖而非系统 Python。

        Args:
            command: 单条命令（不含 &&、||、; 等操作符）
            cwd: 解析相对路径所用的工作目录

        Returns:
            str: 改写后的命令，无需改写则返回原命令
        """
        try:
            parts = shlex.split(command)
        except ValueError:
            return command

        if not parts or parts[0] not in ('python', 'python3', 'python3.11'):
            return command

        if len(parts) < 2:
            return command

        script_path = parts[1]
        script_args = parts[2:]

        script_path_obj = Path(script_path)
        if not script_path_obj.is_absolute() and cwd:
            script_path_obj = cwd / script_path_obj

        # 脚本文件不存在时可能是 python -c "..." 等形式，保持原样
        if not script_path_obj.exists():
            return command

        # script_runner 与主可执行文件在同一目录
        main_executable = Path(sys.executable)
        script_runner_path = main_executable.parent / 'script_runner'

        new_parts = [str(script_runner_path), script_path] + script_args
        return shlex.join(new_parts)

    @staticmethod
    def _rewrite_python_command(
        command: str,
        cwd: Optional[Path] = None,
        enable_rewrite: bool = False
    ) -> str:
        """
        在 PyInstaller 环境下，将命令中的 `python script.py` 改写为
        `{script_runner} script.py`，支持 &&、||、; 链式命令。

        链式命令处理逻辑：
        - 按 &&、||、; 分割命令，逐段处理
        - 遇到 cd 时更新虚拟工作目录，用于解析后续子命令的相对路径
        - 遇到 python 命令时执行改写

        注意：不处理引号内出现操作符的极端情况（如 python -c "a && b"），
        此类命令无需改写，分割后也不会匹配 python 命令头，会原样返回。

        Args:
            command: 原始命令（可以是单命令或链式命令）
            cwd: 工作目录，用于解析相对路径
            enable_rewrite: 是否启用命令改写，默认为 False

        Returns:
            str: 改写后的命令，无需改写则返回原命令
        """
        if not enable_rewrite or not getattr(sys, 'frozen', False):
            return command

        # 按链式操作符分割，使用捕获组保留分隔符
        shell_op_re = re.compile(r'(\s*(?:&&|\|\||;)\s*)')
        segments = shell_op_re.split(command)

        if len(segments) <= 1:
            # 无链式操作符，单命令处理
            rewritten = ProcessExecutor._rewrite_single_python_command(command, cwd)
            if rewritten != command:
                logger.info(f"命令改写: {command} -> {rewritten}")
            return rewritten

        # 链式命令：跟踪 cd 引起的目录变化
        current_cwd = cwd
        result_parts: List[str] = []

        for i, segment in enumerate(segments):
            if i % 2 == 1:
                # 奇数位是分隔符，直接保留
                result_parts.append(segment)
                continue

            stripped = segment.strip()
            if not stripped:
                result_parts.append(segment)
                continue

            # 检查是否是 cd 命令，更新虚拟工作目录
            try:
                cmd_parts = shlex.split(stripped)
                if cmd_parts and cmd_parts[0] == 'cd' and len(cmd_parts) >= 2:
                    cd_target = cmd_parts[1]
                    if os.path.isabs(cd_target):
                        current_cwd = Path(cd_target)
                    elif current_cwd:
                        current_cwd = (current_cwd / cd_target).resolve()
                    else:
                        current_cwd = Path(cd_target).resolve()
            except ValueError:
                pass

            # 尝试改写 python 命令
            rewritten = ProcessExecutor._rewrite_single_python_command(stripped, current_cwd)
            result_parts.append(rewritten)

        rewritten_command = ''.join(result_parts)
        if rewritten_command != command:
            logger.info(f"链式命令改写: {command} -> {rewritten_command}")
        return rewritten_command

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
            return truncate_output_for_llm(content), True
        else:
            # 失败情况 - 提供清晰的错误信息
            content = f"Execution failed (exit code: {exit_code})"
            if stderr_str:
                content += f"\n\nError details:\n{stderr_str}"
            if stdout_str:
                content += f"\n\nStandard output:\n{stdout_str}"
            return truncate_output_for_llm(content), False

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
        background_on_timeout: bool = False,
    ) -> Union[TerminalToolResult, BackgroundStartResult]:
        """
        执行命令并返回结果。

        Args:
            command: 要执行的命令
            cwd: 工作目录，默认为 None
            timeout: 超时时间（秒），默认 60 秒
            extra_env: 仅对当前子进程附加的环境变量，优先级高于默认环境
            interruption_event: 中断事件，被 set 时终止子进程并抛出 asyncio.CancelledError
            background_on_timeout: True 时进入流式缓存模式并启用 Prompt 检测；
                超时或 prompt 检测命中时不 kill 进程，返回 BackgroundStartResult；
                False（默认）保持原有行为，任何情况都返回 TerminalToolResult。

        Returns:
            TerminalToolResult: 普通模式，或后台模式下进程在 timeout 内完成时
            BackgroundStartResult: background_on_timeout=True 且超时或 prompt 检测命中时

        Raises:
            asyncio.CancelledError: 当 interruption_event 触发时抛出，表示 run 已中断
        """
        original_command = command
        try:
            executed_command = ProcessExecutor._rewrite_python_command(
                original_command, cwd, True
            )

            env_vars = ProcessExecutor._build_filtered_env()
            if extra_env:
                env_vars.update(extra_env)

            bash_path = '/bin/bash' if os.path.exists('/bin/bash') else '/bin/sh'
            shell_command = f'{bash_path} -c {shlex.quote(executed_command)}'

            if interruption_event and interruption_event.is_set():
                raise asyncio.CancelledError()

            # ── 后台缓存模式 ──────────────────────────────────────────────────
            if background_on_timeout:
                return await ProcessExecutor._execute_streaming(
                    original_command=original_command,
                    executed_command=executed_command,
                    shell_command=shell_command,
                    cwd=cwd,
                    env_vars=env_vars,
                    timeout=timeout,
                    interruption_event=interruption_event,
                )

            # ── 普通模式 ──────────────────────────────────────────────────────
            sr = await _run_streaming_race(
                shell_command=shell_command,
                cwd=cwd,
                env_vars=env_vars,
                timeout=timeout,
                interruption_event=interruption_event,
                prompt_quiet_secs=PROMPT_QUIET_SECS_SYNC,
                open_stdin=False,
            )

            if sr.outcome == "interrupted":
                raise asyncio.CancelledError()

            if sr.outcome == "prompt":
                sr.readers_task.cancel()
                await ProcessExecutor._terminate_process_gracefully(sr.process)
                partial_out = truncate_output_for_llm(sr.buf_all())
                content = f"Interactive prompt detected.\n\nOutput before prompt:\n{partial_out}" if partial_out else "Interactive prompt detected."
                # ok=True：prompt 检测提前退出是预期行为，不是工具失败，避免触发"工具逻辑执行失败"告警
                result = TerminalToolResult(command=original_command, content=content, ok=True)
                result.set_exit_code(-1)
                result.horizon_hint = (
                    f"The command `{original_command}` detected an interactive prompt and was terminated early. "
                    f"To run interactive or long-running commands, use allow_background=True:\n"
                    f'  shell_exec(command="{original_command}", allow_background=True)\n'
                    f"Then use shell_await to send input (input_text) or wait for more output."
                )
                result.extra_info = {
                    "command": original_command,
                    "cwd": str(cwd) if cwd else "",
                    "stdout": truncate_output_for_llm(sr.buf_stdout()),
                    "stderr": truncate_output_for_llm(sr.buf_stderr()),
                    "exit_code": -1,
                }
                return result

            if sr.outcome == "timeout":
                sr.readers_task.cancel()
                await ProcessExecutor._terminate_process_gracefully(sr.process)
                partial_out = truncate_output_for_llm(sr.buf_all())
                content = f"Command timed out ({timeout}s).\n\nOutput before timeout:\n{partial_out}" if partial_out else f"Command timed out ({timeout}s)."
                result = TerminalToolResult(command=original_command, content=content, ok=False)
                result.horizon_hint = (
                    f"The command `{original_command}` timed out after {timeout}s. "
                    f"If this is a long-running or interactive command, consider re-running with allow_background=True:\n"
                    f'  shell_exec(command="{original_command}", allow_background=True)'
                )
                result.set_exit_code(-1)
                result.extra_info = {
                    "command": original_command,
                    "cwd": str(cwd) if cwd else "",
                    "stdout": truncate_output_for_llm(sr.buf_stdout()),
                    "stderr": truncate_output_for_llm(sr.buf_stderr()),
                    "exit_code": -1,
                    "execution_time": timeout,
                }
                return result

            # outcome == "completed"
            stdout_str = sr.buf_stdout()
            stderr_str = sr.buf_stderr()
            content, is_success = ProcessExecutor._format_process_output(
                stdout_str, stderr_str, sr.exit_code
            )
            result = TerminalToolResult(command=original_command, content=content, ok=is_success)
            result.set_exit_code(sr.exit_code)
            result.extra_info = {
                "command": original_command,
                "cwd": str(cwd) if cwd else "",
                "stdout": truncate_output_for_llm(stdout_str),
                "stderr": truncate_output_for_llm(stderr_str),
                "exit_code": sr.exit_code,
                "execution_time": timeout,
            }
            if executed_command != original_command:
                result.extra_info["executed_command"] = executed_command
            return result

        except asyncio.CancelledError:
            raise

        except Exception as e:
            logger.exception(f"执行命令时出错: {e}")
            return TerminalToolResult.error(
                f"Command execution failed: {e}",
                command=original_command,
                exit_code=-2,
            )

    @staticmethod
    async def _execute_streaming(
        original_command: str,
        executed_command: str,
        shell_command: str,
        cwd: Optional[Path],
        env_vars: Dict[str, str],
        timeout: int,
        interruption_event: Optional[asyncio.Event],
    ) -> Union[TerminalToolResult, BackgroundStartResult]:
        """
        后台缓存模式（buffer-then-flush 设计）。

        执行期间所有 stdout/stderr 只写入内存 buf，不做任何磁盘 I/O。
        仅当真正触发转后台（超时或 prompt 检测命中）时，才生成 task_id / log_path，
        写 header，并启动 file_writer 协程将 buf 持续 drain 到日志文件。
        若进程在 timeout 内正常完成，直接从 buf 构建 TerminalToolResult，无任何文件产生。
        """
        import uuid
        from app.tools.shell_exec_utils.bg_output_store import BgOutputStore

        sr = await _run_streaming_race(
            shell_command=shell_command,
            cwd=cwd,
            env_vars=env_vars,
            timeout=timeout,
            interruption_event=interruption_event,
            prompt_quiet_secs=PROMPT_QUIET_SECS,
            open_stdin=True,
        )

        if sr.outcome == "interrupted":
            raise asyncio.CancelledError()

        def _start_file_writer(store: "BgOutputStore", task_id: str) -> asyncio.Task:
            """将 buf 内容持续 drain 到日志文件，readers_task 结束后做最终 drain。"""
            async def _writer() -> None:
                i = 0
                while True:
                    while i < len(sr.buf):
                        s_name, data = sr.buf[i]
                        await store.append_output(task_id, s_name, data)
                        i += 1
                    if sr.readers_task.done():
                        while i < len(sr.buf):
                            s_name, data = sr.buf[i]
                            await store.append_output(task_id, s_name, data)
                            i += 1
                        break
                    await asyncio.sleep(0.05)
            return asyncio.ensure_future(_writer())

        async def _go_background(trigger: str) -> BackgroundStartResult:
            task_id = uuid.uuid4().hex[:12]
            log_path = PathManager.get_bg_shell_log_file(task_id)
            store = BgOutputStore(log_path.parent)
            await store.write_header(task_id, original_command, str(cwd) if cwd else "", sr.process.pid)
            file_writer_task = _start_file_writer(store, task_id)
            return BackgroundStartResult(
                process=sr.process,
                log_path=log_path,
                current_output=sr.buf_all(),
                trigger=trigger,
                file_writer_task=file_writer_task,
            )

        if sr.outcome in ("timeout", "prompt"):
            return await _go_background(sr.outcome)

        # outcome == "completed"
        stdout_str = sr.buf_stdout()
        stderr_str = sr.buf_stderr()
        content, is_success = ProcessExecutor._format_process_output(
            stdout_str, stderr_str, sr.exit_code
        )
        result = TerminalToolResult(command=original_command, content=content, ok=is_success)
        result.set_exit_code(sr.exit_code)
        result.extra_info = {
            "command": original_command,
            "cwd": str(cwd) if cwd else "",
            "stdout": truncate_output_for_llm(stdout_str),
            "stderr": truncate_output_for_llm(stderr_str),
            "exit_code": sr.exit_code,
            "execution_time": timeout,
        }
        if executed_command != original_command:
            result.extra_info["executed_command"] = executed_command
        return result


async def _wait_future(fut: asyncio.Future) -> None:
    """等待一个 Future/Task 完成（用于将其包装成可 cancel 的竞态任务）。"""
    await fut


# ── 流式执行共享基础设施 ────────────────────────────────────────────────────────

class _StreamingOutcome:
    """
    `_run_streaming_race` 的返回值。

    outcome 取值：
    - "completed"   进程在 timeout 内正常结束，exit_code 有效
    - "prompt"      检测到交互式 prompt，进程仍在运行，readers_task 仍在运行
    - "timeout"     超时，进程仍在运行，readers_task 仍在运行
    - "interrupted" 中断信号触发，进程已被 kill，readers_task 已被 cancel
    """
    __slots__ = ("process", "buf", "readers_task", "outcome", "exit_code")

    def __init__(
        self,
        process: asyncio.subprocess.Process,
        buf: "list[tuple[str, str]]",
        readers_task: asyncio.Task,
        outcome: str,
        exit_code: int = -2,
    ) -> None:
        self.process = process
        self.buf = buf
        self.readers_task = readers_task
        self.outcome = outcome
        self.exit_code = exit_code

    def buf_stdout(self) -> str:
        return "".join(d for s, d in self.buf if s == "stdout").strip()

    def buf_stderr(self) -> str:
        return "".join(d for s, d in self.buf if s == "stderr").strip()

    def buf_all(self) -> str:
        return "".join(d for _, d in self.buf).strip()


async def _run_streaming_race(
    shell_command: str,
    cwd: Optional[Path],
    env_vars: Dict[str, str],
    timeout: int,
    interruption_event: Optional[asyncio.Event],
    prompt_quiet_secs: float,
    open_stdin: bool,
) -> _StreamingOutcome:
    """
    启动子进程，用 streaming reader 读取 stdout/stderr，同时做 prompt 检测。

    通过 asyncio.wait 竞争以下事件：
    - readers 全部 EOF（进程正常结束）
    - prompt 静默窗口到期（交互式 prompt 检测命中）
    - interruption_event（中断信号）
    - timeout

    返回 _StreamingOutcome，调用方根据 outcome 决定后续行为（kill/go-background/…）。

    注意：
    - "prompt" / "timeout" 时进程和 readers_task 仍在运行，调用方自行决定是否 kill。
    - "interrupted" 时进程已被 kill，readers_task 已被 cancel。
    - asyncio.shield 保护 readers_task 不被 asyncio.wait 超时后的 cancel 传播影响，
      确保后台模式下进程后续输出仍可被收集。
    """
    buf: list[tuple[str, str]] = []
    last_write_at: list[float] = [time.monotonic()]
    prompt_candidate_at: list[Optional[float]] = [None]
    prompt_event = asyncio.Event()

    subprocess_kwargs: Dict[str, Any] = {
        "stdout": asyncio.subprocess.PIPE,
        "stderr": asyncio.subprocess.PIPE,
        "cwd": str(cwd) if cwd else None,
        "env": env_vars,
    }
    if open_stdin:
        subprocess_kwargs["stdin"] = asyncio.subprocess.PIPE

    process = await asyncio.create_subprocess_shell(shell_command, **subprocess_kwargs)

    async def _stream_reader(stream: asyncio.StreamReader, stream_name: str) -> None:
        """读取流追加到 buf，同时更新 prompt 检测状态。不做任何文件 I/O。

        使用 read(4096) 而非 readline()：readline() 在无换行符时会一直 block，
        导致交互式 prompt（如 "Continue? (y/n) "）无法被捕获和检测。

        检测策略：
        - scan_chunk_for_prompt(data)：对整块 chunk 扫描固定子串，命中 QR 码等
          可能出现在 chunk 中间而非末尾的特征
        - looks_like_prompt(last_line)：对末尾行做正则匹配，避免历史输出误触
        两者任一命中即设置 prompt_candidate_at。
        """
        while True:
            chunk = await stream.read(4096)
            if not chunk:
                break
            data = chunk.decode("utf-8", errors="replace")
            buf.append((stream_name, data))
            last_write_at[0] = time.monotonic()
            last_line = extract_last_line(data)
            if scan_chunk_for_prompt(data) or looks_like_prompt(last_line):
                if prompt_candidate_at[0] is None:
                    prompt_candidate_at[0] = time.monotonic()
            else:
                prompt_candidate_at[0] = None

    async def _quiet_checker() -> None:
        """每 0.5s 轮询一次，静默窗口到期后触发 prompt_event。"""
        while True:
            await asyncio.sleep(0.5)
            if (
                prompt_candidate_at[0] is not None
                and time.monotonic() - last_write_at[0] >= prompt_quiet_secs
            ):
                prompt_event.set()
                return

    # 两个 reader 必须并发，防止任一侧 pipe buffer（默认 64 KB）写满导致进程永久阻塞
    readers_task = asyncio.ensure_future(
        asyncio.gather(
            _stream_reader(process.stdout, "stdout"),
            _stream_reader(process.stderr, "stderr"),
        )
    )
    # 防止 cancel 时 _GatheringFuture 的 CancelledError 触发 "exception was never retrieved" 日志：
    # cancel 后 asyncio 将 CancelledError 存为 future 的 exception，若从未 await/result()，
    # GC 时会打印噪音 ERROR。在此挂 done callback 提前消费掉。
    def _consume_readers_exc(t: asyncio.Task) -> None:
        try:
            t.result()
        except BaseException:
            pass
    readers_task.add_done_callback(_consume_readers_exc)

    quiet_task = asyncio.ensure_future(_quiet_checker())

    # asyncio.shield 阻止 readers_done_task 被 cancel 时传播到 readers_task
    readers_done_task = asyncio.ensure_future(_wait_future(asyncio.shield(readers_task)))
    prompt_wait_task = asyncio.ensure_future(prompt_event.wait())
    race_tasks: list[asyncio.Task] = [readers_done_task, prompt_wait_task]
    interrupt_wait_task: Optional[asyncio.Task] = None
    if interruption_event is not None:
        interrupt_wait_task = asyncio.ensure_future(interruption_event.wait())
        race_tasks.append(interrupt_wait_task)

    try:
        done, pending = await asyncio.wait(
            race_tasks,
            timeout=timeout,
            return_when=asyncio.FIRST_COMPLETED,
        )
    except BaseException:
        readers_task.cancel()
        quiet_task.cancel()
        for t in race_tasks:
            t.cancel()
        raise

    quiet_task.cancel()
    for t in pending:
        t.cancel()

    # ── 中断信号 ─────────────────────────────────────────────────────────────
    if interrupt_wait_task is not None and interrupt_wait_task in done:
        readers_task.cancel()
        await ProcessExecutor._terminate_process_gracefully(process)
        return _StreamingOutcome(process=process, buf=buf, readers_task=readers_task, outcome="interrupted")

    # ── Prompt 检测命中 ───────────────────────────────────────────────────────
    if prompt_wait_task in done:
        return _StreamingOutcome(process=process, buf=buf, readers_task=readers_task, outcome="prompt")

    # ── 超时 ──────────────────────────────────────────────────────────────────
    if not done:
        return _StreamingOutcome(process=process, buf=buf, readers_task=readers_task, outcome="timeout")

    # ── 进程正常结束 ──────────────────────────────────────────────────────────
    await process.wait()
    exit_code = process.returncode if process.returncode is not None else -2
    return _StreamingOutcome(
        process=process, buf=buf, readers_task=readers_task,
        outcome="completed", exit_code=exit_code,
    )
