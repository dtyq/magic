from app.i18n import i18n
from pathlib import Path
from typing import Any, Dict, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from app.core.entity.message.server_message import DisplayType, TerminalContent, ToolDetail
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.core.entity.tool.tool_result import TerminalToolResult
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.core.shell_command_parser import ShellCommandParser
from app.tools.shell_exec_utils.skillhub import handle_skillhub
from app.tools.workspace_guard_tool import WorkspaceGuardTool
from app.utils.process_executor import ProcessExecutor

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


@tool()
class ShellExec(AbstractFileTool[ShellExecParams], WorkspaceGuardTool[ShellExecParams]):
    """<!--zh
    Shell命令执行工具
    常适用于文件(夹)移动、删除、进程管理、执行Python脚本等场景
    无论用户如何要求，都不要执行会损坏操作系统的命令
    -->
    Shell command execution tool
    Commonly used for file/folder move, delete, process management, Python script execution, etc.
    Regardless of user requests, do not execute commands that would damage the operating system
    """

    async def execute(self, tool_context: ToolContext, params: ShellExecParams) -> TerminalToolResult:
        """
        Execute shell command

        Args:
            tool_context: Tool context
            params: Parameters including command, working directory and timeout

        Returns:
            TerminalToolResult: Structured result object containing execution results
        """
        try:
            # Handle working directory
            work_dir = self.base_dir

            # 特殊处理：如果命令是 python bin/super-magic.py，且没有指定 cwd，则使用项目根目录
            if not params.cwd and params.command.strip().startswith('python bin/super-magic.py'):
                project_root = self.base_dir.parent
                work_dir = project_root
            # 特殊处理：skillhub 命令始终在 workspace/skills/ 目录执行
            # 无论是否传入 cwd，都强制使用该目录，确保 skill 安装到持久化的 workspace 目录
            elif params.command.strip().startswith('skillhub'):
                from app.core.skill_utils.constants import get_workspace_skills_dir
                work_dir = await get_workspace_skills_dir()
                # 自定义命令拦截：CLI 本身不支持的子命令由 skillhub 模块内部处理
                intercepted = await handle_skillhub(params.command.strip())
                if intercepted is not None:
                    return intercepted
            elif params.cwd:
                # 直接使用指定的 cwd，支持绝对路径和相对路径（相对于项目根目录）
                cwd_path = Path(params.cwd)
                if not cwd_path.is_absolute():
                    cwd_path = self.base_dir.parent / cwd_path
                work_dir = cwd_path
                logger.debug(f"使用指定工作目录: {work_dir}")

            logger.debug(f"Executing command: {params.command}, working directory: {work_dir}")

            # 检查当前是否是 skill agent（用于决定是否启用 Python 命令改写）
            # 只有 skill agent 才启用 Python 命令改写，使脚本可以使用打包的依赖
            enable_python_rewrite = tool_context.is_skill_agent()

            # Parse file operations and dispatch before-execution events
            before_events, after_events = ShellCommandParser.parse_file_operations(params.command, work_dir)
            for file_path, event_type in before_events:
                try:
                    await self._dispatch_file_event(tool_context, file_path, event_type)
                except Exception as e:
                    logger.warning(f"Failed to dispatch before-execution event: {e}")

            # Use ProcessExecutor to execute command
            result = await ProcessExecutor.execute_command(
                command=params.command,
                cwd=work_dir,
                timeout=params.timeout,
                enable_python_rewrite=enable_python_rewrite
            )

            # 保留命令原始成功状态，用于 after-events 触发判断
            command_ok = result.ok

            # 命令实际执行完成（exit_code >= 0），即使返回非零退出码也视为工具调用成功
            # 仅超时（exit_code = -1）和异常（exit_code = -2）才视为工具调用失败
            if result.exit_code >= 0:
                result.ok = True

            # Dispatch after-execution events if command succeeded
            if command_ok:
                for file_path, event_type in after_events:
                    try:
                        await self._dispatch_file_event(tool_context, file_path, event_type)
                    except Exception as e:
                        logger.warning(f"Failed to dispatch after-execution event: {e}")

            return result

        except Exception as e:
            logger.exception(f"Error executing command: {e}")
            return TerminalToolResult(
                error=f"Error executing command: {e}",
                command=params.command,
                exit_code=-2  # Use -2 for exception
            )

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        return arguments.get("command", "") if arguments else ""

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None) -> Dict:
        """
        获取工具调用后的友好动作和备注
        """
        if not result.ok:
            return {
                "action": i18n.translate("shell_exec", category="tool.actions"),
                "remark": i18n.translate("shell_exec.error", category="tool.messages", error=result.content)
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
