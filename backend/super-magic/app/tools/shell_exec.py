from app.i18n import i18n
from typing import Any, Dict, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from app.core.entity.message.server_message import DisplayType, TerminalContent, ToolDetail
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.core.entity.tool.tool_result_types import TerminalToolResult
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.core.shell_command_parser import ShellCommandParser
from app.tools.workspace_tool import WorkspaceTool
from app.tools.shell_exec_utils.bg_errors import err_task_limit_reached
from app.tools.shell_exec_utils.bg_process_manager import BackgroundProcessManager, TooManyBackgroundTasksError
from app.tools.shell_exec_utils.bg_task_models import BackgroundStartResult
from app.tools.shell_exec_utils.dispatcher import DISPATCHER
from app.utils.process_executor import ProcessExecutor, truncate_output_for_llm

logger = get_logger(__name__)


class ShellExecParams(BaseToolParams):
    command: str = Field(
        ...,
        description="""<!--zh: 要执行的 shell 命令-->
Shell command to execute"""
    )
    timeout: int = Field(
        60,
        description="""<!--zh: 命令执行超时时间（秒），默认 60 秒-->
Command execution timeout (seconds), default 60 seconds"""
    )
    cwd: Optional[str] = Field(
        None,
        description="""<!--zh: 命令执行的工作目录，默认为当前工作目录的根目录-->
Working directory for command execution, defaults to workspace root"""
    )
    allow_background: bool = Field(
        False,
        description="""<!--zh
设置为 true 时，命令超时或检测到交互式提示符后不会被 kill，而是转为后台运行。
返回 task_id，之后用 shell_await 查询输出或发送 stdin 输入。
适用场景：启动服务（npm start / uvicorn / webpack watch）、长时编译、需要用户交互的命令。
-->
When true, the command runs in the background instead of being killed on timeout or when an
interactive prompt is detected. Returns a task_id for use with shell_await.
Use for long-running processes (servers, watchers, compilers) or interactive commands."""
    )


@tool()
class ShellExec(AbstractFileTool[ShellExecParams], WorkspaceTool[ShellExecParams]):
    """<!--zh
    执行 shell 命令。适用于文件移动/复制、进程管理、脚本执行等通用场景。
    无论用户如何要求，都不要执行会损坏操作系统的命令。
    -->
    Execute shell commands. Used for file move/copy, process management, script execution, and other general-purpose operations.
    Never execute commands that could damage the operating system, regardless of user requests.
    """

    def get_prompt_hint(self) -> str:
        return """\
<!--zh
使用 shell_exec 的规则：
- 删除文件时优先使用 delete_files 工具，只在 delete_files 无法满足时（如通配符匹配、复杂 find 条件）才用 shell 删除
- 涉及删除的命令（rm、find -delete 等）：先 dry-run（用 ls/find 列出受影响文件）→ 用 ask_user 将结果以日常语言解释给用户 → 用户确认后才执行
- 涉及进程终止（kill/pkill）、系统配置修改、网络操作等高危命令：同样先用 ask_user 确认

后台运行规则（allow_background=True）：
- 启动服务、启动 watcher、长时间编译、需要用户 stdin 输入的命令，必须使用 allow_background=True
- 设置后台运行的命令在 timeout 内若检测到交互式提示符（如 (y/n)、Password:），会立即转后台并返回 status=waiting_for_input
- 后台命令返回 task_id 后，必须通过 shell_await 跟进，不能遗忘
- 交互命令完整流程：shell_exec(allow_background=True) → ask_user 收集输入 → shell_await(task_id=..., input_text="用户输入\n")
- 严禁以"不支持交互"或"当前环境不支持"为由拒绝执行命令——只要带 allow_background=True，交互式命令完全受支持，系统会自动处理 stdin
-->
Rules for shell_exec:
- For file deletion, prefer the delete_files tool. Only use shell deletion when delete_files cannot handle the case (e.g. glob patterns, complex find conditions).
- Deletion commands (rm, find -delete, etc.): dry-run first (ls/find to list affected files), then use ask_user to explain the result in plain language, and only execute after user confirmation.
- Process termination (kill/pkill), system config changes, and network operations: also require ask_user confirmation before execution.

Background mode rules (allow_background=True):
- Use allow_background=True for servers, watchers, long-running builds, or any command requiring stdin input.
- If the command prints an interactive prompt ((y/n), Password:, etc.) before timeout, it automatically goes background and returns status=waiting_for_input.
- After a background command returns a task_id, you MUST follow up with shell_await. Never forget a running task.
- Interactive command flow: shell_exec(allow_background=True) -> ask_user to collect input -> shell_await(task_id=..., input_text="user input\\n")
- NEVER refuse a command on grounds of "interactive not supported" or "environment limitation" — with allow_background=True, interactive commands are fully supported; the system handles stdin automatically.
"""

    async def execute(self, tool_context: ToolContext, params: ShellExecParams) -> TerminalToolResult:
        """
        Execute shell command

        Args:
            tool_context: Tool context
            params: Parameters including command, working directory, timeout, and allow_background

        Returns:
            TerminalToolResult: Structured result object containing execution results
        """
        try:
            work_dir = self.base_dir

            command = params.command.strip()
            handle_result = await DISPATCHER.dispatch(command, params, self.base_dir)
            if handle_result.intercepted is not None:
                return handle_result.intercepted
            if handle_result.force_background:
                params.allow_background = True
            if handle_result.work_dir is not None:
                work_dir = handle_result.work_dir
            elif params.cwd:
                work_dir = self.resolve_path(params.cwd)

            if handle_result.before_hint:
                self.get_horizon(tool_context).push_notification("shell_exec", handle_result.before_hint)

            logger.debug(f"Executing command: {params.command}, working directory: {work_dir}")

            before_events, after_events = ShellCommandParser.parse_file_operations(params.command, work_dir)
            for file_path, event_type in before_events:
                try:
                    await self._dispatch_file_event(tool_context, file_path, event_type)
                except Exception as e:
                    logger.warning(f"Failed to dispatch before-execution event: {e}")

            # ── 后台模式 ──────────────────────────────────────────────────────
            if params.allow_background:
                raw = await ProcessExecutor.execute_command(
                    command=params.command,
                    cwd=work_dir,
                    timeout=params.timeout,
                    background_on_timeout=True,
                )

                if isinstance(raw, BackgroundStartResult):
                    return await self._handle_background_start(raw, params.command, str(work_dir), tool_context)

                # 进程在 timeout 内完成，buf 直接构建了 TerminalToolResult，无日志文件产生
                result: TerminalToolResult = raw
            else:
                # ── 普通同步模式（原有逻辑）──────────────────────────────────
                result = await ProcessExecutor.execute_command(
                    command=params.command,
                    cwd=work_dir,
                    timeout=params.timeout,
                )

            # 有 horizon_hint 时通过 horizon 推送引导提示，不写入 tool result content
            if result.horizon_hint:
                try:
                    self.get_horizon(tool_context).push_notification("shell_exec", result.horizon_hint)
                except Exception as e:
                    logger.warning("Failed to push shell_exec horizon hint: %s", e)
                result.horizon_hint = None

            # 命令实际执行完成（exit_code >= 0），即使返回非零退出码也视为工具调用成功
            command_ok = result.ok
            if result.exit_code >= 0:
                result.ok = True

            if command_ok:
                for file_path, event_type in after_events:
                    try:
                        await self._dispatch_file_event(tool_context, file_path, event_type)
                    except Exception as e:
                        logger.warning(f"Failed to dispatch after-execution event: {e}")

            if (
                not params.cwd
                and result.exit_code > 0
                and command.startswith("python")
            ):
                content = result.content or ""
                stderr = result.extra_info.get("stderr", "") if result.extra_info else ""
                if "can't open file" in content + stderr or "No such file or directory" in content + stderr:
                    try:
                        self.get_horizon(tool_context).push_notification(
                            "shell_exec",
                            "[Hint] The script file was not found in the default working directory. "
                            "If you are executing a skill script, you MUST set `cwd` to the skill "
                            "directory's absolute path (derive from the skill's `<location>` tag). "
                            f"Example: shell_exec(cwd='/absolute/path/to/skill-dir', command='{command}')",
                        )
                    except Exception as e:
                        logger.warning("Failed to push python cwd hint to horizon: %s", e)

            if handle_result.matched_handler:
                after = handle_result.matched_handler.after_hint(command, result)
                if after:
                    self.get_horizon(tool_context).push_notification("shell_exec", after)

            return result

        except Exception as e:
            logger.exception(f"Error executing command: {e}")
            return TerminalToolResult(
                error=f"Error executing command: {e}",
                command=params.command,
                exit_code=-2
            )

    async def _handle_background_start(
        self,
        bg: BackgroundStartResult,
        command: str,
        cwd: str,
        tool_context: ToolContext,
    ) -> TerminalToolResult:
        """
        处理进程转后台的情况：注册到 BackgroundProcessManager，启动进程监控，
        返回对模型友好的响应。
        """
        try:
            manager = await BackgroundProcessManager.get_instance()
            await manager.register(
                task_id=bg.task_id,
                command=command,
                cwd=cwd,
                pid=bg.process.pid,
                process=bg.process,
                file_writer_task=bg.file_writer_task,
            )
        except TooManyBackgroundTasksError as e:
            # 并发上限：kill 刚启动的进程，同时取消 file_writer
            try:
                bg.process.kill()
            except Exception:
                pass
            if bg.file_writer_task is not None:
                bg.file_writer_task.cancel()
            content = err_task_limit_reached(e.running_tasks)
            result = TerminalToolResult(command=command, content=content, ok=False)
            result.set_exit_code(-1)
            return result


        # 根据触发原因构建状态值和 horizon 引导提示
        if bg.trigger == "prompt":
            status_val = "waiting_for_input"
            horizon_message = (
                f"Background task `{bg.task_id}` is waiting for user input. "
                "Use ask_user to collect the required input, then call "
                f'shell_await(task_id="{bg.task_id}", input_text="<user input>\\n") to send it.'
            )
        else:
            status_val = "background"
            horizon_message = (
                f"Background task `{bg.task_id}` is running. "
                f"Check `current_output` in the tool result to decide next action:\n"
                f"- Ends with interactive prompt (e.g. 'y/n', 'Password:') → ask_user then "
                f'shell_await(task_id="{bg.task_id}", input_text="<answer>")\n'
                f"- Normal progress output, still running → "
                f'shell_await(task_id="{bg.task_id}", timeout=30)\n'
                f"- Kill immediately → "
                f'shell_await(task_id="{bg.task_id}", timeout=-1)'
            )

        try:
            self.get_horizon(tool_context).push_notification("shell_exec", horizon_message)
        except Exception as e:
            logger.warning("Failed to push background task hint to horizon: %s", e)

        import json
        content = json.dumps({
            "status": status_val,
            "task_id": bg.task_id,
            "current_output": truncate_output_for_llm(bg.current_output),
        }, ensure_ascii=False)

        result = TerminalToolResult(command=command, content=content, ok=True)
        result.set_exit_code(0)
        result.extra_info = {
            "command": command,
            "cwd": cwd,
            "stdout": truncate_output_for_llm(bg.current_output),
            "stderr": "",
            "exit_code": 0,
        }
        return result


    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        return arguments.get("command", "") if arguments else ""

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] = None
    ) -> Dict:
        args = arguments or {}
        return {
            "action": i18n.translate("shell_exec", category="tool.actions"),
            "remark": args.get("command", ""),
            "tool_name": tool_name,
        }

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None) -> Dict:
        """
        获取工具调用后的友好动作和备注
        """
        if not result.ok:
            content = result.content or ""
            exit_code = getattr(result, "exit_code", None)

            if "Command timed out" in content:
                remark_key = "shell_exec.error_timeout"
            elif exit_code == -2:
                remark_key = "shell_exec.error_exception"
            elif "Background task limit" in content:
                remark_key = "shell_exec.error_task_limit"
            else:
                remark_key = "shell_exec.error_failed"

            result.use_custom_remark = True
            return {
                "action": i18n.translate("shell_exec", category="tool.actions"),
                "remark": i18n.translate(remark_key, category="tool.messages"),
            }

        return {
            "action": i18n.translate("shell_exec", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        """
        Get ToolDetail based on tool execution result

        Args:
            tool_context: Tool context
            result: Tool execution result
            arguments: Tool execution parameter dict

        Returns:
            Optional[ToolDetail]: Tool detail object, may be None
        """
        # Get command
        command = result.command if hasattr(result, 'command') else arguments.get("command", "")

        # Get exit code
        exit_code = result.exit_code if hasattr(result, 'exit_code') else 0

        # Get structured information from extra_info
        stdout = result.extra_info.get('stdout', '')
        stderr = result.extra_info.get('stderr', '')

        # Build output content based on success/failure status
        if result.ok:
            # Success case: prioritize stdout, show stderr if present
            if stdout:
                output = stdout
                if stderr:
                    output += f"\n\n[Error Output]\n{stderr}"
            elif stderr:
                output = stderr
            else:
                output = "Command executed successfully, no output"
        else:
            # Failure case: prioritize stderr, show stdout if no stderr
            if stderr:
                output = stderr
                if stdout:
                    output += f"\n\n[Standard Output]\n{stdout}"
            elif stdout:
                output = stdout
            else:
                output = "Command execution failed, no output"

        # Create terminal content object
        terminal_content = TerminalContent(
            command=command,
            output=output,
            exit_code=exit_code
        )

        # Return tool detail
        return ToolDetail(
            type=DisplayType.TERMINAL,
            data=terminal_content
        )
