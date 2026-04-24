"""
SDK 代码片段执行工具（Code Mode 执行器）

执行模型生成的 Python 代码片段，代码通过 sdk.tool / sdk.mcp 调用底层工具。
与 run_python_snippet 的区别：
1. 自动注入 agent_context 到子进程环境变量，供 SDK 请求精确路由
2. 子进程内的每次 tool.call() / mcp.call() 会触发独立的 before/after_tool_call 事件，
   在 v2 消息模式下对应各自一组 assistant + tool 消息

注意：should_trigger_events() 返回 False 仅影响 v1 消息模式；
v2 消息模式由 StreamListenerService 统一跳过该限制，事件正常发出。
"""


import asyncio
import json
import re
import time
import uuid

import aiofiles
from pathlib import Path
from pydantic import Field

from typing import Any, Dict

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.core.context.agent_context import AgentContext
from app.i18n import i18n
from app.path_manager import PathManager
from app.tools.core import BaseToolParams, tool
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.snippet_timeout_registry import SdkSnippetTimeoutRegistry
from app.utils.process_executor import ProcessExecutor

# 匹配 tool.call('tool_name', ...) 或 tool.call("tool_name", ...) 中的工具名
_TOOL_CALL_PATTERN = re.compile(r'tool\.call\s*\(\s*[\'"](\w+)[\'"]')

# v2 提前 after 使用的占位 content（与真实终端输出区分，用于选择 remark 文案）
_EARLY_AFTER_FAKE_CONTENT = "Script dispatched, executing inner tool calls."

logger = get_logger(__name__)


class RunSdkSnippetParams(BaseToolParams):
    """SDK 代码片段执行参数"""
    python_code: str = Field(
        ...,
        description="""<!--zh: 要执行的 Python 代码，通过 sdk.tool / sdk.mcp 调用工具-->
Python code to execute that calls tools via sdk.tool / sdk.mcp"""
    )
    timeout: int = Field(
        120,
        description="""<!--zh: 超时秒数，默认120，按预期时长调整-->
Timeout in seconds, default 120. Increase for long-running scripts."""
    )


@tool()
class RunSdkSnippet(AbstractFileTool[RunSdkSnippetParams]):
    """<!--zh: 执行 Python 脚本，脚本可通过 SDK 调用任意工具和 MCP，print 的内容作为结果返回。-->
    Run a Python script that can call any tool or MCP via SDK. Whatever the script prints becomes the result.
    """

    def should_trigger_events(self) -> bool:
        """Code Mode 执行不触发工具调用事件，对对话透明"""
        return False

    def get_prompt_hint(self) -> str:
        return """\
<!--zh
写一段 Python 脚本来编排工具调用。脚本里可以串联多个工具、加入判断和循环，
中间结果留在脚本内部，不进入你的上下文——只有 print 的内容会回到你手里。

适用场景：需要多步工具编排、逻辑处理，或调用仅通过 Code Mode 可用的工具。
常与 Skill 搭配：Skill 告诉你做什么，这个工具负责怎么做。

示例——搜索关键词，再批量读取匹配的文件：

```python
from sdk.tool import tool

hits = tool.call("grep_search", {"query": "def handle_error", "file_pattern": "*.py"})
print(hits.content)
```

也可以调 MCP：

```python
from sdk.mcp import mcp

result = mcp.call("server_name", "tool_name", {"key": "value"})
print(result.content)
```

参数和你平时直接调工具完全一样。
result.content 是工具返回的文本结果，直接 print 即可。
timeout 默认 120 秒，跑得久就传大一点。
-->
Write a Python script to orchestrate tool calls. You can chain multiple tools, add conditionals and loops — intermediate results stay inside the script and never enter your context. Only what you print comes back.

Use when you need multi-step tool orchestration, logic processing, or tools that are only available via Code Mode.
Often paired with Skills: the Skill tells you what to do, this tool handles how.

Example — search for a pattern and print results:

```python
from sdk.tool import tool

hits = tool.call("grep_search", {"query": "def handle_error", "file_pattern": "*.py"})
print(hits.content)
```

MCP calls work the same way:

```python
from sdk.mcp import mcp

result = mcp.call("server_name", "tool_name", {"key": "value"})
print(result.content)
```

Arguments are exactly the same as calling tools directly.
result.content is the tool's text output — just print it.
timeout defaults to 120s. Increase it for longer-running scripts.
"""

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

    @staticmethod
    def _check_code_mode_compatibility(python_code: str) -> list[str]:
        """扫描代码中所有 tool.call() 调用，返回不允许 Code Mode 的工具名列表。"""
        from app.tools.core.tool_factory import tool_factory

        blocked: list[str] = []
        for tool_name in _TOOL_CALL_PATTERN.findall(python_code):
            try:
                instance = tool_factory.get_tool_instance(tool_name)
                if not instance.allow_code_mode():
                    blocked.append(tool_name)
            except Exception:
                # 工具不存在或实例化失败时跳过，不影响执行
                pass
        return blocked

    async def execute(self, tool_context: ToolContext, params: RunSdkSnippetParams) -> ToolResult:
        # 检查是否包含不允许在 Code Mode 中调用的工具
        blocked_tools = self._check_code_mode_compatibility(params.python_code)
        if blocked_tools:
            names = ", ".join(blocked_tools)
            return ToolResult.error(
                f"The following tool(s) cannot be called via Code Mode (run_sdk_snippet): {names}. "
                f"Call '{blocked_tools[0]}' directly as a standalone tool call instead."
            )

        # v2 模式下在脚本执行前是否已提前触发 after_tool_call
        early_after_sent = False

        try:
            script_filename = f"temp_sdk_{int(time.time() * 1000)}.py"

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
            agent_ctx: AgentContext = tool_context.get_extension("agent_context")
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

            # v2 模式：在脚本执行前提前触发 after_tool_call，保证消息顺序为：
            # assistant(run_sdk_snippet before) → tool(run_sdk_snippet after) → 内层工具消息对
            # 外层 tool_call_executor 触发的 after_tool_call 通过 SDK_SNIPPET_DISPATCHED 屏蔽。
            if agent_ctx.get_message_version() == "v2":
                from app.tools.core.tool_call_event_manager import ToolCallEventManager
                early_tool_call = ToolCallEventManager.create_openai_tool_call(
                    tool_context.tool_call_id,
                    "function",
                    tool_context.tool_name,
                    json.dumps(tool_context.arguments, ensure_ascii=False),
                )
                await ToolCallEventManager.trigger_after_tool_call(
                    agent_ctx,
                    early_tool_call,
                    tool_context,
                    tool_context.tool_name,
                    tool_context.arguments,
                    ToolResult(content=_EARLY_AFTER_FAKE_CONTENT),
                    0.0,
                )
                early_after_sent = True

            try:
                terminal_result = await ProcessExecutor.execute_command(
                    command=command,
                    cwd=runtime_dir,
                    timeout=effective_timeout,
                    extra_env=extra_env,
                    interruption_event=agent_ctx.get_interruption_event(),
                )
            finally:
                # 正常完成后清理残留的 in-flight 记录（容错）
                registry.cancel_by_execution(agent_ctx.context_id, sdk_execution_id)

            # early_after_sent=True 时外层 after_tool_call 应被屏蔽（已提前发出）
            system = "SDK_SNIPPET_DISPATCHED" if early_after_sent else None
            if terminal_result.ok:
                return ToolResult(content=terminal_result.content, system=system)
            else:
                return ToolResult.error(terminal_result.content, system=system)

        except asyncio.CancelledError:
            # 中断信号，直接向上传播，不要降级为普通错误
            raise

        except Exception as e:
            logger.exception(f"执行 SDK 代码片段时出错: {e}")
            system = "SDK_SNIPPET_DISPATCHED" if early_after_sent else None
            return ToolResult.error(f"执行 SDK 代码片段时出错: {e}", system=system)

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        if not result.ok:
            return {
                "action": i18n.translate("run_sdk_snippet", category="tool.actions"),
                "remark": i18n.translate(
                    "run_sdk_snippet.error",
                    category="tool.messages",
                    error=result.content,
                ),
            }
        if result.content == _EARLY_AFTER_FAKE_CONTENT:
            remark_key = "run_sdk_snippet.after_dispatched"
        else:
            remark_key = "run_sdk_snippet.after_completed"
        return {
            "action": i18n.translate("run_sdk_snippet", category="tool.actions"),
            "remark": i18n.translate(remark_key, category="tool.messages"),
        }
