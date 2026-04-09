"""
SDK 代码片段执行工具（Code Mode 执行器）

执行模型生成的 Python 代码片段，代码通过 sdk.tool / sdk.mcp 调用底层工具，
中间结果在执行环境内部流转，不进入模型上下文。
与 run_python_snippet 的区别：
1. should_trigger_events() 返回 False，不触发工具调用事件
2. 自动注入 agent_context 到子进程环境变量，供 SDK 请求精确路由
"""


import asyncio

import aiofiles
from pathlib import Path
from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.path_manager import PathManager
from app.tools.core import BaseToolParams, tool
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.snippet_timeout_registry import SdkSnippetTimeoutRegistry
from app.utils.process_executor import ProcessExecutor

logger = get_logger(__name__)


class RunSdkSnippetParams(BaseToolParams):
    """SDK 代码片段执行参数"""
    python_code: str = Field(
        ...,
        description="""<!--zh: 要执行的 Python 代码，通过 sdk.tool / sdk.mcp 调用工具-->
Python code to execute; use sdk.tool / sdk.mcp to call tools or MCP primitives"""
    )
    timeout: int = Field(
        120,
        description="""<!--zh: 代码执行超时时间（秒），默认120秒，按预期执行时长调整-->
Code execution timeout in seconds, default 120. Adjust based on expected operation duration."""
    )


@tool()
class RunSdkSnippet(AbstractFileTool[RunSdkSnippetParams]):
    """<!--zh
    Code Mode 执行器：运行模型生成的 Python 代码片段，代码通过 sdk.tool / sdk.mcp 调用底层工具。
    中间结果在执行环境内流转，不进入模型上下文，适合多步编排和复杂逻辑。
    常与 Skill 配合使用——Skill 描述工作流，此工具负责执行。

    适用场景：
    - 需要编程方式组合多个工具调用
    - 需要进行数据处理、转换、分析
    - 需要实现条件判断、循环等复杂逻辑
    - 需要调用外部 Python 库

    使用示例：
    ```python
    {
        "python_code": "from sdk.tool import tool\\n\\nresult = tool.call('create_canvas', {\\n    \\\"project_path\\\": \\\"my-design\\\"\\n})\\nprint(result)"
    }
    ```
    -->
    Code Mode executor: runs model-generated Python code that calls tools via sdk.tool / sdk.mcp.
    Intermediate results stay in the execution environment and do not flow through model context,
    making it efficient for multi-step orchestration and complex logic.
    Commonly used in Skills — Skills describe the workflow, this tool handles execution.

    Use cases:
    - Programmatically combine multiple tool calls
    - Data processing, transformation, or analysis
    - Conditional logic, loops, or complex control flow
    - Use external Python libraries

    Usage example:
    ```python
    {
        "python_code": "from sdk.tool import tool\\n\\nresult = tool.call('create_canvas', {\\n    \\\"project_path\\\": \\\"my-design\\\"\\n})\\nprint(result)"
    }
    ```
    """

    def should_trigger_events(self) -> bool:
        """Code Mode 执行不触发工具调用事件，对对话透明"""
        return False

    @staticmethod
    def _build_snippet_extra_env(project_root: Path) -> dict[str, str]:
        import os

        project_root_str = str(project_root)
        path_parts = [
            part for part in os.environ.get("PYTHONPATH", "").split(os.pathsep)
            if part
        ]
        if project_root_str in path_parts:
            path_parts = [part for part in path_parts if part != project_root_str]

        return {
            "PYTHONPATH": os.pathsep.join([project_root_str, *path_parts]),
            "SUPER_MAGIC_PROJECT_ROOT": project_root_str,
        }

    async def execute(self, tool_context: ToolContext, params: RunSdkSnippetParams) -> ToolResult:
        import uuid

        script_file_path = None

        try:
            script_filename = f"temp_sdk_{uuid.uuid4().hex[:8]}.py"

            project_root = PathManager.get_project_root()

            runtime_dir = project_root / ".runtime" / "sdk_scripts"
            runtime_dir.mkdir(parents=True, exist_ok=True)

            script_file_path = runtime_dir / script_filename

            logger.info(f"创建 SDK 代码片段脚本: {script_file_path}")

            try:
                async with aiofiles.open(script_file_path, 'w', encoding='utf-8') as f:
                    await f.write(params.python_code)
                logger.debug(f"成功写入代码到: {script_file_path}")
            except Exception as e:
                logger.exception(f"写入 SDK 代码片段失败: {e}")
                return ToolResult.error(f"写入 SDK 代码片段失败: {e}")

            command = f"python {script_filename}"
            effective_timeout = SdkSnippetTimeoutRegistry.get_effective_timeout(
                params.python_code, params.timeout
            )
            if effective_timeout != params.timeout:
                logger.info(
                    f"run_sdk_snippet 超时自动提升: "
                    f"requested={params.timeout}s, effective={effective_timeout}s"
                )

            # 将调用方 AgentContext 的 context_id 注入子进程，供 SDK 请求带回服务端，
            # 使服务端能精确路由到正确的 Agent 上下文。
            extra_env = self._build_snippet_extra_env(project_root)
            agent_ctx = tool_context.get_extension("agent_context")
            if agent_ctx is None:
                raise RuntimeError(
                    "run_sdk_snippet: tool_context 中不存在 agent_context，"
                    "无法确定调用方 Agent 标识"
                )
            extra_env["SUPER_MAGIC_AGENT_CONTEXT_ID"] = agent_ctx.context_id

            # 每次 Code Mode 执行生成唯一标识，用于精确取消本轮发起的服务端请求
            sdk_execution_id = uuid.uuid4().hex
            extra_env["SUPER_MAGIC_SDK_EXECUTION_ID"] = sdk_execution_id

            # 注册 cleanup：主 run 中断时先取消本轮服务端 in-flight 请求，
            # 再由 ProcessExecutor 中断子进程
            from app.service.sdk_call_registry import SdkCallRegistry
            registry = SdkCallRegistry.get_instance()
            cleanup_key = f"sdk_execution_{sdk_execution_id}"

            async def _cancel_inflight() -> None:
                registry.cancel_by_execution(agent_ctx.context_id, sdk_execution_id)

            agent_ctx.register_run_cleanup(cleanup_key, _cancel_inflight)

            try:
                terminal_result = await ProcessExecutor.execute_command(
                    command=command,
                    cwd=runtime_dir,
                    timeout=effective_timeout,
                    enable_python_rewrite=True,
                    extra_env=extra_env,
                    interruption_event=agent_ctx.get_interruption_event(),
                )
            finally:
                # 正常完成后清理残留的 in-flight 记录（容错）
                registry.cancel_by_execution(agent_ctx.context_id, sdk_execution_id)

            if terminal_result.ok:
                return ToolResult(content=terminal_result.content)
            else:
                return ToolResult.error(terminal_result.content)

        except asyncio.CancelledError:
            # 中断信号，直接向上传播，不要降级为普通错误
            raise

        except Exception as e:
            logger.exception(f"执行 SDK 代码片段时出错: {e}")
            return ToolResult.error(f"执行 SDK 代码片段时出错: {e}")
