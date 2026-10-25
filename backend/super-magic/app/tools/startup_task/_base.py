"""启动任务工具共享的模型文案与错误结果构造；使用说明维护在 agents/skills/startup-manager/SKILL.md。"""

from __future__ import annotations

from dataclasses import asdict

from agentlang.tools.tool_result import ToolResult
from app.service.startup_task import StartupTask, StartupTaskError, StartupTaskRunStatus, StartupTaskView

# 每个错误码对应模型下一步该怎么做；content 只读这一段也能继续推理
_NEXT_STEPS: dict[str, str] = {
    "confirmation_required": (
        "Explain to the user that the script will run automatically every time the sandbox starts, "
        "ask for consent, and retry with confirmed=true only after the user agrees."
    ),
    "task_exists": "Use startup_task_update to change the existing task, or choose a different name.",
    "task_not_found": "Call startup_task_list to see the existing task IDs.",
    "invalid_name": "Pass a non-empty name.",
    "invalid_script": "Pass a non-empty, non-interactive shell script.",
    "invalid_workdir": "Pass an existing directory relative to .workspace, such as \".\" or \"my-app\".",
    "invalid_timeout": "Pass timeout_seconds within the allowed range.",
    "no_changes": "Pass at least one field to change.",
    "already_running": "Wait for the current run with shell_await on its background task ID instead of starting another run.",
    "untrusted": (
        "Ask the user to confirm this task for the current project, then call "
        "startup_task_update with enabled=true and confirmed=true before running it."
    ),
}


def error_result(exc: StartupTaskError) -> ToolResult:
    payload: dict[str, object] = {"error_code": exc.code, "error_context": dict(exc.context)}
    lines = [str(exc), f"error_code: {exc.code}"]
    lines.extend(f"{key}: {value}" for key, value in exc.context.items() if value is not None)
    next_step = _NEXT_STEPS.get(exc.code)
    if next_step:
        lines.append(f"next_step: {next_step}")
    return ToolResult.error("\n".join(lines), extra_info=payload, data=payload, use_custom_remark=True)


def describe_task(task: StartupTask) -> str:
    return (
        f"{task.name} ({task.task_id}): enabled={str(task.enabled).lower()}, workdir={task.workdir}, "
        f"timeout_seconds={task.timeout_seconds}"
    )


def describe_run_state(view: StartupTaskView) -> str:
    """把本进程内的运行状态翻成模型能直接行动的一句话。"""
    state = view.state
    log_hint = (
        f' Read its log with shell_await(task_id="{state.background_task_id}", timeout=0).'
        if state.background_task_id else ""
    )
    output = f"\nOutput:\n{state.output_tail}" if state.output_tail else ""
    match state.status:
        case StartupTaskRunStatus.NOT_STARTED:
            if not view.trusted:
                return "Not run: it was confirmed in a different project, so it will not run automatically."
            if not view.task.enabled:
                return "Not run: the task is disabled."
            return "Not run in this sandbox session yet."
        case StartupTaskRunStatus.RUNNING:
            if state.background_task_id:
                return (
                    f"Running as background task {state.background_task_id}. "
                    f'Wait for it with shell_await(task_id="{state.background_task_id}", timeout=60).'
                )
            return "Starting."
        case StartupTaskRunStatus.SUCCEEDED:
            return f"Succeeded with exit code 0.{log_hint}{output}"
        case StartupTaskRunStatus.FAILED:
            exit_code = f" with exit code {state.exit_code}" if state.exit_code is not None else ""
            return f"Failed{exit_code}.{log_hint}{output}"
        case StartupTaskRunStatus.TIMED_OUT:
            return f"Stopped after reaching timeout_seconds={view.task.timeout_seconds}.{log_hint}"
        case StartupTaskRunStatus.SKIPPED_DISABLED:
            return "Skipped at sandbox startup because the task is disabled."
        case StartupTaskRunStatus.SKIPPED_UNTRUSTED:
            return (
                "Skipped at sandbox startup because it was confirmed in a different project. "
                "Ask the user, then call startup_task_update with enabled=true and confirmed=true."
            )


def view_data(view: StartupTaskView) -> dict[str, object]:
    return {"task": asdict(view.task), "state": asdict(view.state), "trusted": view.trusted}
