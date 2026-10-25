"""
把一个启动任务作为普通后台 shell 任务运行。

复用 shell_exec 的后台设施：日志、进程回收、并发上限、shell_await 查看输出都是现成的，
Agent 已经会用。运行分两段，方便试跑时尽快拿到后台任务 ID：

| 阶段 | 函数 | 耗时 |
| --- | --- | --- |
| 启动并观察 | launch | 最多 background_after_seconds；期间结束就直接给出结果 |
| 等待结束 | wait_until_finished | 直到进程退出，或到达任务自己的 timeout_seconds 后终止 |
"""

from __future__ import annotations

import asyncio
import shlex
import time
from pathlib import Path

from agentlang.logger import get_logger
from app.path_manager import PathManager
from app.service.startup_task.models import StartupTask, StartupTaskRunState, StartupTaskRunStatus, StartupTaskSettings
from app.tools.shell_exec_utils.bg_process_manager import BackgroundProcessManager, TooManyBackgroundTasksError
from app.tools.shell_exec_utils.bg_task_models import BackgroundStartResult
from app.utils.async_file_utils import async_is_dir, async_realpath
from app.utils.process_executor import ProcessExecutor, truncate_output_for_display

logger = get_logger(__name__)


async def resolve_task_workdir(workdir: str) -> Path | None:
    """workdir 相对 .workspace；解析软链后仍在工作区内且是目录才返回，否则 None。"""
    workspace_dir = await async_realpath(PathManager.get_workspace_dir())
    resolved = await async_realpath(workspace_dir / workdir)
    if not resolved.is_relative_to(workspace_dir) or not await async_is_dir(resolved):
        return None
    return resolved


async def launch(
    task: StartupTask,
    state: StartupTaskRunState,
    settings: StartupTaskSettings,
) -> BackgroundStartResult | None:
    """启动任务并原地更新 state；仍在运行时返回后台句柄，已结束（含启动失败）时返回 None。"""
    state.status = StartupTaskRunStatus.RUNNING
    state.background_task_id = None
    state.exit_code = None
    state.output_tail = ""
    state.started_at = time.time()
    state.finished_at = None

    cwd = await resolve_task_workdir(task.workdir)
    if cwd is None:
        _finish(state, StartupTaskRunStatus.FAILED, None, f"Working directory {task.workdir} does not exist inside .workspace.")
        return None

    command = f"bash -c {shlex.quote(task.script)}"
    try:
        raw = await ProcessExecutor.execute_command(
            command=command,
            cwd=cwd,
            timeout=settings.background_after_seconds,
            background_on_timeout=True,
            detect_interactive_prompt=False,
        )
    except Exception as error:
        logger.exception(f"startup_task: 启动失败 task_id={task.task_id}")
        _finish(state, StartupTaskRunStatus.FAILED, None, f"Failed to start: {error}")
        return None

    if not isinstance(raw, BackgroundStartResult):
        status = StartupTaskRunStatus.SUCCEEDED if raw.exit_code == 0 else StartupTaskRunStatus.FAILED
        _finish(state, status, raw.exit_code, truncate_output_for_display(raw.content or ""))
        return None

    manager = await BackgroundProcessManager.get_instance()
    try:
        await manager.register(
            task_id=raw.task_id,
            command=command,
            cwd=str(cwd),
            pid=raw.process.pid,
            process=raw.process,
            file_writer_task=raw.file_writer_task,
        )
    except TooManyBackgroundTasksError as error:
        # 与 shell_exec 一致：注册不上就杀掉刚启动的进程，避免出现无人管理的后台进程
        raw.process.kill()
        if raw.file_writer_task is not None:
            raw.file_writer_task.cancel()
        _finish(
            state,
            StartupTaskRunStatus.FAILED,
            None,
            f"Too many background tasks are running ({error.current_count}); the startup task was not started.",
        )
        return None

    state.background_task_id = raw.task_id
    logger.info(f"startup_task: 已转为后台任务 task_id={task.task_id} background_task_id={raw.task_id}")
    return raw


async def wait_until_finished(
    task: StartupTask,
    state: StartupTaskRunState,
    background: BackgroundStartResult,
) -> None:
    """等待后台进程结束；超过任务时长就终止，记为 TIMED_OUT。输出留在后台任务日志里，用 shell_await 查看。"""
    started_at = state.started_at if state.started_at is not None else time.time()
    remaining = max(task.timeout_seconds - (time.time() - started_at), 0)
    try:
        await asyncio.wait_for(background.process.wait(), timeout=remaining)
    except TimeoutError:
        manager = await BackgroundProcessManager.get_instance()
        await manager.kill_task(background.task_id)
        _finish(state, StartupTaskRunStatus.TIMED_OUT, None, "")
        return
    exit_code = background.process.returncode
    status = StartupTaskRunStatus.SUCCEEDED if exit_code == 0 else StartupTaskRunStatus.FAILED
    _finish(state, status, exit_code, "")


async def run_to_completion(task: StartupTask, state: StartupTaskRunState, settings: StartupTaskSettings) -> None:
    background = await launch(task, state, settings)
    if background is not None:
        await wait_until_finished(task, state, background)
    logger.info(
        f"startup_task: 运行结束 task_id={task.task_id} status={state.status} "
        f"exit_code={state.exit_code} background_task_id={state.background_task_id}"
    )


def _finish(
    state: StartupTaskRunState,
    status: StartupTaskRunStatus,
    exit_code: int | None,
    output_tail: str,
) -> None:
    state.status = status
    state.exit_code = exit_code
    state.output_tail = output_tail
    state.finished_at = time.time()
