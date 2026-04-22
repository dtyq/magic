"""
后台任务相关的统一错误信息构建器。

所有面向大模型的错误返回格式：
    [ERROR] <描述>

    Suggestions:
    - <建议 1>
    - <建议 2>

目标：让大模型在读到错误后立即知道下一步该做什么，不陷入循环重试。
"""

from app.tools.shell_exec_utils.bg_task_models import BackgroundTask


def _build(description: str, suggestions: list[str]) -> str:
    """拼装标准错误消息。"""
    sugg_lines = "\n".join(f"- {s}" for s in suggestions)
    return f"[ERROR] {description}\n\nSuggestions:\n{sugg_lines}"


def err_task_not_found(task_id: str) -> str:
    return _build(
        f"Task `{task_id}` not found. It may have never existed or the agent was restarted.",
        [
            "Check whether the task_id is correct.",
            "If the agent was restarted, the process handle is lost. Re-run the command to start a new task.",
        ],
    )


def err_task_limit_reached(running_tasks: list[BackgroundTask]) -> str:
    """并发上限错误，附带当前所有 RUNNING 任务的摘要列表。"""
    import time
    now = time.time()
    task_lines = "\n".join(
        f"- task_id: {t.task_id} | command: {t.command[:60]} | running for: {int(now - t.created_at)}s"
        for t in running_tasks
    )
    body = (
        f"Background task limit reached (max {len(running_tasks)} running tasks are already active).\n\n"
        f"Current running tasks:\n{task_lines}"
    )
    return _build(
        body,
        [
            'Kill a task you no longer need: shell_await(task_id="<id>", timeout=0)',
            'Wait for a task to finish: shell_await(task_id="<id>", timeout=60)',
            "Run without background mode by removing allow_background=True",
        ],
    )


def err_orphan_task(task_id: str) -> str:
    return _build(
        f"Task `{task_id}` was recovered from log file but the process handle is lost (agent restarted). "
        "Log output is still readable.",
        [
            f'Read remaining log: shell_await(task_id="{task_id}", timeout=5)',
            "If you need to continue execution, re-run the original command.",
        ],
    )


def err_stdin_to_finished_task(task_id: str, status: str) -> str:
    return _build(
        f"Task `{task_id}` has already finished (status: {status}). stdin input was ignored.",
        [
            "Read the `output` field to check what the command has already produced.",
            "If the command needs to run again, re-execute it with shell_exec.",
        ],
    )


def err_invalid_pattern(pattern: str, regex_error: str) -> str:
    return _build(
        f"Invalid pattern `{pattern}`: {regex_error}.",
        [
            "Check the regex syntax (Python `re` module standard).",
            "Fix the pattern and call shell_await again.",
        ],
    )


def err_log_file_missing(task_id: str) -> str:
    return _build(
        f"Log file for task `{task_id}` is missing.",
        [
            "The log may have been cleaned up or disk write failed.",
            "Re-run the original command to start a new task.",
        ],
    )


def err_kill_on_finished_task(task_id: str, status: str) -> str:
    return _build(
        f"Task `{task_id}` is already in terminal state (status: {status}). No kill performed.",
        [
            "Read the `output` field to get the task result.",
        ],
    )
