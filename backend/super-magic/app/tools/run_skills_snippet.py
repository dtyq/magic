"""
Skill 代码片段执行工具

专门用于执行 Skill 中的 Python 代码片段
与 run_python_snippet 的主要区别：
1. should_trigger_events() 返回 False，不触发工具调用事件
2. 自动注入 agent_context 到子进程环境变量，供 Skill SDK 使用
"""


import aiofiles
from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.path_manager import PathManager
from app.tools.core import BaseToolParams, tool
from app.tools.abstract_file_tool import AbstractFileTool
from app.utils.process_executor import ProcessExecutor

logger = get_logger(__name__)


class RunSkillsSnippetParams(BaseToolParams):
    """Skill 代码片段执行参数"""
    python_code: str = Field(
        ...,
        description="""<!--zh: 在 Skill 中执行的 Python 代码-->
Python code to execute in Skills"""
    )
    timeout: int = Field(
        60,
        description="""<!--zh: 代码执行超时时间（秒），默认60秒-->
Code execution timeout (seconds), default 60 seconds"""
    )


@tool()
class RunSkillsSnippet(AbstractFileTool[RunSkillsSnippetParams]):
    """<!--zh
    Skill 代码执行工具，用于运行 Skill 中的 Python 代码

    适用场景：
    - Skill 需要编程方式组合多个工具调用
    - Skill 需要进行数据处理、转换、分析
    - Skill 需要实现条件判断、循环等复杂逻辑
    - Skill 需要调用外部 Python 库

    使用示例：
    ```python
    {
        "python_code": "from sdk.tool import tool\\n\\nresult = tool.call('create_design_project', {\\n    \\\"project_path\\\": \\\"my-design\\\"\\n})\\nprint(result)"
    }
    ```
    -->
    Skill code execution tool for running Python code in Skills

    Use cases:
    - Skills need to programmatically combine multiple tool calls
    - Skills need data processing, transformation, or analysis
    - Skills need conditional logic, loops, or complex control flow
    - Skills need to use external Python libraries

    Usage example:
    ```python
    {
        "python_code": "from sdk.tool import tool\\n\\nresult = tool.call('create_design_project', {\\n    \\\"project_path\\\": \\\"my-design\\\"\\n})\\nprint(result)"
    }
    ```
    """

    def should_trigger_events(self) -> bool:
        """Skill 代码执行不触发工具调用事件

        Returns:
            bool: False，不触发事件
        """
        return False

    async def execute(self, tool_context: ToolContext, params: RunSkillsSnippetParams) -> ToolResult:
        """执行 Skill Python 代码片段

        Args:
            tool_context: 工具上下文
            params: 参数对象

        Returns:
            ToolResult: 执行结果
        """
        import uuid
        from pathlib import Path

        script_file_path = None

        try:
            # 自动生成临时脚本文件名（使用 UUID 确保唯一性）
            script_filename = f"temp_skill_{uuid.uuid4().hex[:8]}.py"

            # 使用项目根目录下的 .runtime/skills_scripts 目录
            project_root = PathManager.get_project_root()

            runtime_dir = project_root / ".runtime" / "skills_scripts"
            runtime_dir.mkdir(parents=True, exist_ok=True)

            # 构建完整的脚本文件路径
            script_file_path = runtime_dir / script_filename

            logger.info(f"创建 Skill Python 脚本: {script_file_path}")

            # 第一步：写入Python代码到文件
            try:
                async with aiofiles.open(script_file_path, 'w', encoding='utf-8') as f:
                    await f.write(params.python_code)
                logger.debug(f"成功写入 Skill Python 代码到: {script_file_path}")
            except Exception as e:
                logger.exception(f"写入 Skill Python 脚本失败: {e}")
                return ToolResult.error(f"写入 Skill Python 脚本失败: {e}")

            # 第二步：使用 ProcessExecutor 执行Python脚本
            command = f"python {script_filename}"

            # 在 .runtime/skills_scripts 目录中执行脚本
            # 启用 Python 命令重写，使其可以使用打包的依赖
            terminal_result = await ProcessExecutor.execute_command(
                command=command,
                cwd=runtime_dir,
                timeout=params.timeout,
                enable_python_rewrite=True
            )

            # 转换为简单的 ToolResult
            if terminal_result.ok:
                return ToolResult(content=terminal_result.content)
            else:
                return ToolResult.error(terminal_result.content)

        except Exception as e:
            logger.exception(f"执行 Skill Python 代码片段时出错: {e}")
            return ToolResult.error(f"执行 Skill Python 代码片段时出错: {e}")
