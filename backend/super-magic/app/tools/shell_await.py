"""
shell_await 工具：查询后台任务输出、等待进程结束、向进程发送 stdin、或强制 kill。
"""

import asyncio
import json
import re
from typing import Any, Dict, Optional

from pydantic import Field, model_validator

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.i18n import i18n
from app.core.entity.message.server_message import DisplayType, TerminalContent, ToolDetail
from app.core.entity.tool.tool_result_types import TerminalToolResult
from app.tools.core import BaseTool, BaseToolParams, tool
from app.utils.process_executor import truncate_output_for_llm
from app.tools.shell_exec_utils.bg_errors import (
    err_invalid_pattern,
    err_kill_on_finished_task,
    err_log_file_missing,
    err_task_not_found,
)
from app.tools.shell_exec_utils.bg_process_manager import BackgroundProcessManager
from app.tools.shell_exec_utils.bg_task_models import TaskStatus

logger = get_logger(__name__)


class ShellAwaitParams(BaseToolParams):
    task_id: Optional[str] = Field(
        None,
        description="""<!--zh
后台任务 ID（由 shell_exec allow_background=True 返回）。
不传时工具进入纯 sleep 模式，等待 timeout 秒后返回。
-->
Background task ID returned by shell_exec with allow_background=True.
If omitted, the tool simply sleeps for timeout seconds (useful as an async alternative to `sleep N`)."""
    )
    timeout: int = Field(
        description="""<!--zh
等待超时秒数。含义取决于 task_id 是否提供：
- 无 task_id：sleep 时长
- 有 task_id，timeout > 0：最长等待时间
- 有 task_id，timeout = 0：立即 kill 该任务并返回已有输出
-->
Timeout in seconds.
- No task_id: sleep duration.
- With task_id and timeout > 0: max wait time for output or process completion.
- With task_id and timeout = 0: immediately kill the task and return its current output."""
    )

    pattern: Optional[str] = Field(
        None,
        description="""<!--zh
正则表达式（Python re 模块语法）；新输出中匹配到即提前返回。
仅 timeout > 0 且 task_id 有值时有效。
-->
Regex pattern (Python re syntax). If matched in new output, returns early.
Only effective when task_id is provided and timeout > 0."""
    )
    input_text: Optional[str] = Field(
        None,
        description="""<!--zh
向进程 stdin 写入的文本（交互命令场景）。末尾须含换行符 \\n 才能触发命令行读取。
仅 timeout > 0 且 task_id 有值时有效；kill 模式（timeout=0）下忽略。
-->
Text to write to the process stdin (for interactive commands).
Must end with \\n to trigger readline. Ignored in kill mode (timeout=0)."""
    )

    @model_validator(mode="before")
    @classmethod
    def _default_timeout(cls, values: Any) -> Any:
        if isinstance(values, dict) and "timeout" not in values:
            values["timeout"] = 30
        return values


@tool()
class ShellAwait(BaseTool[ShellAwaitParams]):
    """<!--zh
    查询后台 shell 任务的输出，或向其发送 stdin 输入，或强制终止。
    也可不传 task_id，纯粹作为异步 sleep 使用（替代 shell_exec sleep N）。
    -->
    Query background shell task output, send stdin input, or force-kill a running task.
    Can also be used without task_id as an async sleep (alternative to shell_exec sleep N).
    """

    def get_prompt_hint(self) -> str:
        return """\
<!--zh
shell_await 使用规则：
- 无 task_id 时为纯 sleep，等待 timeout 秒，适合替代 `sleep N` 命令
- pattern 为 Python 正则，匹配到新输出即提前返回，适合等待特定日志行出现
- input_text 末尾必须含 \\n 才能触发交互命令的 readline
- timeout=0 且有 task_id 时为 kill 语义，立即终止后台任务并返回已有输出；对已结束任务无副作用
- 对 waiting_for_input 状态的任务：先用 ask_user 向用户收集输入，再通过 input_text 参数发送；不要直接 kill
- ask_user 类型选择（根据命令输出中的提示内容判断）：
  - 输出含 (y/n)、(yes/no) → 用 confirm 类型或带 y/n 选项的 select 类型
  - 输出含 Password:、Enter token: 等密码/凭证类提示 → 用 input 类型（placeholder 写明含义）
  - 输出含多个选项编号（如 1) ... 2) ...）→ 用 select 类型，每个 option 对应一个选项
  - 其他自由输入 → 用 input 类型
-->
Rules for shell_await:
- Without task_id: pure sleep for timeout seconds (use instead of `sleep N`)
- pattern: Python regex; matched against new output, triggers early return when found
- input_text MUST end with \\n to trigger readline in interactive commands
- timeout=0 with task_id: kills the task immediately; safe to call on already-finished tasks
- For waiting_for_input tasks: collect input via ask_user first, then send via input_text; do not kill
- Choosing the ask_user question type (infer from the prompt text in command output):
  - Output contains (y/n) or (yes/no) → use confirm type or select with y/n options
  - Output contains Password:, Enter token:, or similar credential prompts → use input type (describe in placeholder)
  - Output lists numbered options (e.g. 1) ... 2) ...) → use select type, one option per item
  - Any other free-text input → use input type
"""

    async def execute(self, tool_context: ToolContext, params: ShellAwaitParams) -> TerminalToolResult:
        """
        Execute shell_await.
        """
        try:
            # ── 纯 sleep 模式 ─────────────────────────────────────────────────
            if params.task_id is None:
                await asyncio.sleep(params.timeout)
                content = json.dumps({"status": "slept", "seconds": params.timeout})
                result = TerminalToolResult(command="shell_await(sleep)", content=content, ok=True)
                result.set_exit_code(0)
                return result

            # ── 有 task_id 的模式 ─────────────────────────────────────────────
            manager = await BackgroundProcessManager.get_instance()
            task = manager.get_task(params.task_id)

            if task is None:
                content = err_task_not_found(params.task_id)
                result = TerminalToolResult(command="shell_await", content=content, ok=False)
                result.set_exit_code(-1)
                return result

            # ── kill 模式（timeout=0）────────────────────────────────────────
            if params.timeout == 0:
                if task.status != TaskStatus.RUNNING:
                    content = err_kill_on_finished_task(params.task_id, task.status.value)
                    output = truncate_output_for_llm(await manager._store.read_full(params.task_id))
                    payload = json.dumps({
                        "task_id": params.task_id,
                        "status": task.status.value,
                        "exit_code": task.exit_code,
                        "output": output,
                        "message": content,
                    }, ensure_ascii=False)
                    result = TerminalToolResult(command="shell_await", content=payload, ok=True)
                    result.set_exit_code(task.exit_code or 0)
                    return result

                await manager.kill_task(params.task_id)
                output = truncate_output_for_llm(await manager._store.read_full(params.task_id))
                payload = json.dumps({
                    "task_id": params.task_id,
                    "status": "killed",
                    "exit_code": None,
                    "output": output,
                }, ensure_ascii=False)
                result = TerminalToolResult(command="shell_await", content=payload, ok=True)
                result.set_exit_code(0)
                return result

            # ── 等待模式（timeout > 0）───────────────────────────────────────
            # 编译 pattern（如果有）
            compiled_pattern: Optional[re.Pattern] = None
            if params.pattern:
                try:
                    compiled_pattern = re.compile(params.pattern)
                except re.error as e:
                    content = err_invalid_pattern(params.pattern, str(e))
                    result = TerminalToolResult(command="shell_await", content=content, ok=False)
                    result.set_exit_code(-1)
                    return result

            # 向 stdin 写入（如果有）
            if params.input_text:
                if task.status != TaskStatus.RUNNING:
                    # 静默记录，继续返回当前状态
                    logger.warning(
                        "shell_await: input_text ignored, task %s is not RUNNING (status=%s)",
                        params.task_id, task.status.value,
                    )
                else:
                    try:
                        await manager.write_stdin(params.task_id, params.input_text)
                    except Exception as e:
                        logger.warning("shell_await: write_stdin failed for %s: %s", params.task_id, e)

            # 轮询等待
            output, reason, exit_code = await manager.wait_for_pattern(
                task_id=params.task_id,
                pattern=compiled_pattern,
                timeout=float(params.timeout),
            )

            # 检查日志文件是否存在（极端情况：被手动删除）
            if not output and reason not in ("completed", "killed", "error"):
                from app.utils.async_file_utils import async_exists
                log_path = manager._store.log_path(params.task_id)
                if not await async_exists(log_path):
                    content = err_log_file_missing(params.task_id)
                    result = TerminalToolResult(command="shell_await", content=content, ok=False)
                    result.set_exit_code(-1)
                    return result

            payload = json.dumps({
                "task_id": params.task_id,
                "status": reason,
                "exit_code": exit_code,
                "output": truncate_output_for_llm(output),
            }, ensure_ascii=False)
            result = TerminalToolResult(command="shell_await", content=payload, ok=True)
            result.set_exit_code(exit_code if exit_code is not None else 0)
            return result

        except Exception as e:
            logger.exception(f"shell_await error: {e}")
            result = TerminalToolResult(command="shell_await", content=f"shell_await failed: {e}", ok=False)
            result.set_exit_code(-2)
            return result

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        if not result.ok:
            content = result.content or ""
            exit_code = getattr(result, "exit_code", None)

            if exit_code == -2:
                remark_key = "shell_await.error_exception"
            elif "not found" in content:
                remark_key = "shell_await.error_task_not_found"
            elif "Invalid pattern" in content:
                remark_key = "shell_await.error_invalid_pattern"
            elif "Log file for task" in content:
                remark_key = "shell_await.error_log_missing"
            else:
                remark_key = "shell_await.error_failed"

            result.use_custom_remark = True
            return {
                "action": i18n.translate("shell_await", category="tool.actions"),
                "remark": i18n.translate(remark_key, category="tool.messages"),
            }

        task_id = (arguments or {}).get("task_id", "")
        try:
            payload = json.loads(result.content)
            status = payload.get("status", "")
            remark = f"task_id={task_id} status={status}" if task_id else status
        except Exception:
            remark = task_id or ""

        return {
            "action": i18n.translate("shell_await", category="tool.actions"),
            "remark": remark,
        }

    async def get_tool_detail(
        self,
        tool_context: ToolContext,
        result: ToolResult,
        arguments: Dict[str, Any] = None,
    ) -> Optional[ToolDetail]:
        task_id = (arguments or {}).get("task_id", "")
        try:
            payload = json.loads(result.content)
            output = payload.get("output", result.content)
            status = payload.get("status", "")
            exit_code = payload.get("exit_code", 0) or 0
        except Exception:
            output = result.content
            status = ""
            exit_code = 0

        cmd_label = f"shell_await task_id={task_id}" if task_id else "shell_await(sleep)"
        terminal_content = TerminalContent(command=cmd_label, output=output, exit_code=exit_code)
        return ToolDetail(type=DisplayType.TERMINAL, data=terminal_content)
