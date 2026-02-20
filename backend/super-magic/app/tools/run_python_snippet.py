from app.i18n import i18n
from typing import Any, Dict, Optional

import aiofiles
from pydantic import Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.core.entity.tool.tool_result import TerminalToolResult
from app.tools.core import BaseToolParams, tool
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.workspace_tool import WorkspaceTool
from app.utils.process_executor import ProcessExecutor
from app.utils.terminal_tool_detail_generator import TerminalToolDetailGenerator

logger = get_logger(__name__)


class RunPythonSnippetParams(BaseToolParams):
    python_code: str = Field(
        ...,
        description="""<!--zh: 要执行的Python代码内容，应该是中小型的代码片段，不适用于复杂的大型脚本-->
Python code content to execute, should be small to medium code snippets, not suitable for complex large scripts"""
    )
    script_path: str = Field(
        ...,
        description="""<!--zh: Python脚本的运行路径（包含文件名），必须不与现有文件名重复。建议使用临时文件名如 temp_analysis_xxx.py-->
Python script path (including filename), must not duplicate existing filenames. Suggest using temp filenames like temp_analysis_xxx.py"""
    )
    timeout: int = Field(
        60,
        description="""<!--zh: 脚本执行超时时间（秒），默认60秒-->
Script execution timeout (seconds), default 60 seconds"""
    )
    cwd: Optional[str] = Field(
        None,
        description="""<!--zh: 脚本执行的工作目录，默认为当前工作目录的根目录-->
Script execution working directory, defaults to workspace root"""
    )

    @field_validator('script_path')
    @classmethod
    def validate_script_path(cls, v):
        if not v.endswith('.py'):
            raise ValueError("脚本路径必须以 .py 结尾")
        return v


@tool()
class RunPythonSnippet(AbstractFileTool[RunPythonSnippetParams], WorkspaceTool[RunPythonSnippetParams]):
    """<!--zh
    Python代码片段执行工具，适用于数据分析、处理、转换、快速计算、验证及文件操作和处理等场景

    重要提示：
    - 适用于中小型Python代码片段（<=200行）
    - 复杂脚本、会长期反复使用的脚本，应持久化到文件后再使用shell_exec工具执行
    - 工具会自动创建临时脚本文件、执行脚本、删除临时文件
    - 脚本运行后会自动删除脚本，无需额外处理，如删除临时文件

    使用示例：
    ```python
    {
        "python_code": "import pandas as pd\\nprint('Hello World')",
        "script_path": "temp_hello_world.py",
    }
    ```
    -->
    Python snippet execution tool for data analysis, processing, transformation, quick calculations, validation, file operations, etc.

    Important notes:
    - Suitable for small to medium Python snippets (<=200 lines)
    - Complex scripts or scripts for long-term repeated use should be persisted to files then executed with shell_exec tool
    - Tool automatically creates temp script file, executes script, deletes temp file
    - Script is auto-deleted after execution, no additional handling needed

    Usage example:
    ```python
    {
        "python_code": "import pandas as pd\\nprint('Hello World')",
        "script_path": "temp_hello_world.py",
    }
    ```
    """

    async def execute(self, tool_context: ToolContext, params: RunPythonSnippetParams) -> TerminalToolResult:
        """
        执行Python代码片段

        Args:
            tool_context: 工具上下文
            params: 参数对象

        Returns:
            TerminalToolResult: 执行结果
        """
        return await self.execute_purely(params)

    async def execute_purely(self, params: RunPythonSnippetParams) -> TerminalToolResult:
        """
        纯粹执行Python代码片段的核心逻辑

        Args:
            params: 参数对象

        Returns:
            TerminalToolResult: 执行结果
        """
        script_file_path = None

        try:
            # 处理工作目录
            work_dir = self.base_dir
            if params.cwd:
                # 使用父类方法获取安全的工作目录路径
                cwd_path = self.resolve_path(params.cwd)
                work_dir = cwd_path

            # 构建完整的脚本文件路径
            script_file_path = work_dir / params.script_path

            # 检查文件是否已存在
            if script_file_path.exists():
                return TerminalToolResult(
                    error=f"脚本文件已存在: {script_file_path}，请使用不同的文件名",
                    command=f"python {params.script_path}"
                )

            logger.debug(f"创建临时Python脚本: {script_file_path}")

            # 第一步：写入Python代码到临时文件
            try:
                async with aiofiles.open(script_file_path, 'w', encoding='utf-8') as f:
                    await f.write(params.python_code)
                logger.debug(f"成功写入Python代码到: {script_file_path}")
            except Exception as e:
                logger.exception(f"写入Python脚本失败: {e}")
                return TerminalToolResult(
                    error=f"写入Python脚本失败: {e}",
                    command=f"python {params.script_path}"
                )

            # 第二步：使用 ProcessExecutor 执行Python脚本
            command = f"python {params.script_path}"
            exec_cwd = work_dir

            logger.debug(f"执行Python脚本: {command}")
            result = await ProcessExecutor.execute_command(
                command=command,
                cwd=exec_cwd,
                timeout=params.timeout
            )

            return result

        except Exception as e:
            logger.exception(f"执行Python代码片段时出错: {e}")
            return TerminalToolResult(
                error=f"执行Python代码片段时出错: {e}",
                command=f"python {params.script_path}",
                exit_code=-2
            )
        finally:
            # 第三步：清理临时文件
            if script_file_path and script_file_path.exists():
                try:
                    await aiofiles.os.remove(script_file_path)
                    logger.debug(f"已删除临时Python脚本: {script_file_path}")
                except Exception as e:
                    logger.warning(f"删除临时Python脚本失败: {script_file_path}, 错误: {e}")

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        script_path = arguments.get("script_path", "Python脚本") if arguments else "Python脚本"
        return f"{script_path}"

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None) -> Dict:
        """
        获取工具调用后的友好动作和备注
        """
        if not result.ok:
            return {
                "action": i18n.translate("run_python_snippet", category="tool.actions"),
                "remark": i18n.translate("run_python_snippet.error", category="tool.messages", error=result.content)
            }

        return {
            "action": i18n.translate("run_python_snippet", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[Any]:
        """
        获取工具详情
        """
        return await TerminalToolDetailGenerator.get_tool_detail(tool_context, result, arguments)
