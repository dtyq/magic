"""
终端工具详情生成器

提供统一的终端工具详情生成功能，用于在UI中显示命令执行结果。
"""

from typing import Dict, Any, Optional

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, TerminalContent, ToolDetail


class TerminalToolDetailGenerator:
    """终端工具详情生成器"""

    @staticmethod
    async def get_tool_detail(
        tool_context: ToolContext,
        result: ToolResult,
        arguments: Dict[str, Any] = None
    ) -> Optional[ToolDetail]:
        """
        根据工具执行结果获取对应的ToolDetail

        Args:
            tool_context: 工具上下文
            result: 工具执行的结果
            arguments: 工具执行的参数字典

        Returns:
            Optional[ToolDetail]: 工具详情对象，可能为None
        """
        # 获取命令
        command = result.command if hasattr(result, 'command') else arguments.get("command", "")

        # 获取退出码
        exit_code = result.exit_code if hasattr(result, 'exit_code') else 0

        # 从 extra_info 中获取结构化信息
        stdout = result.extra_info.get('stdout', '') if hasattr(result, 'extra_info') else ''
        stderr = result.extra_info.get('stderr', '') if hasattr(result, 'extra_info') else ''

        # 检查是否是 Python 代码执行，如果是则显示代码内容
        python_code = arguments.get("python_code", "") if arguments else ""

        # 根据成功/失败状态构建输出内容
        if result.ok:
            # 成功情况：优先显示stdout，如果有stderr也显示
            if stdout:
                output = stdout
                if stderr:
                    output += f"\n\n[Warnings/Errors]\n{stderr}"
            elif stderr:
                output = stderr
            else:
                output = "✅ Execution successful, no output"
        else:
            # 失败情况：优先显示stderr，如果没有stderr显示stdout
            if stderr:
                output = stderr
                if stdout:
                    output += f"\n\n[Standard Output]\n{stdout}"
            elif stdout:
                output = stdout
            else:
                output = "❌ Execution failed, no output"

        # 如果有 Python 代码，伪装成命令行执行的形式
        if python_code:
            # 将多行代码格式化为命令行友好的形式
            if '\n' in python_code.strip():
                # 多行代码使用 heredoc 风格
                formatted_code = f"$ python -c \"\n{python_code}\n\"\n\n{output}"
            else:
                # 单行代码直接显示
                formatted_code = f"$ python -c \"{python_code}\"\n\n{output}"
            output = formatted_code

        # 创建终端内容对象
        terminal_content = TerminalContent(
            command=command,
            output=output,
            exit_code=exit_code
        )

        # 返回工具详情
        return ToolDetail(
            type=DisplayType.TERMINAL,
            data=terminal_content
        )
