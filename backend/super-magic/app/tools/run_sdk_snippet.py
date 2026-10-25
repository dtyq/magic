"""
SDK 代码片段执行工具（Code Mode 执行器）

执行模型生成的 Python 代码片段，代码通过 sdk.tool 调用底层工具（MCP 能力作为 mcp_xxx 工具接入）。
与 run_python_snippet 的区别：
1. 自动注入 agent_context 到子进程环境变量，供 SDK 请求精确路由
2. 子进程内的每次 tool.call() 会触发独立的 before/after_tool_call 事件，
   在 v2 消息模式下对应各自一组 assistant + tool 消息

注意：should_trigger_events() 返回 False 仅影响 v1 消息模式；
v2 消息模式由 StreamListenerService 统一跳过该限制，事件正常发出。
"""


import asyncio
import json
import re
import shlex
import uuid
from pathlib import Path
from typing import Any, Dict

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import (
    TOOL_RESULT_SYSTEM_DISPATCHED,
    TOOL_RESULT_SYSTEM_EARLY_AFTER,
    ToolResult,
)
from app.core.context.agent_context import AgentContext
from app.i18n import i18n
from app.path_manager import PathManager
from app.service.sdk_call_registry import SdkCallRegistry, SdkCallStatus, SdkCallSummary
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import AutoMount, BaseToolParams, tool
from app.tools.core.base_tool import ToolForwardRequest
from app.tools.python_snippet_repair import prepare_python_code
from app.tools.snippet_environment import SnippetEnvironment
from app.tools.snippet_timeout_registry import SdkSnippetTimeoutRegistry
from app.utils.process_executor import ProcessExecutor

# 匹配 tool.call('tool_name', ...) 或 tool.call("tool_name", ...) 中的工具名
_TOOL_CALL_PATTERN = re.compile(r'tool\.call\s*\(\s*[\'"](\w+)[\'"]')

# v2 提前 after 使用的占位 content（与真实终端输出区分，用于选择 remark 文案）
_EARLY_AFTER_FAKE_CONTENT = "Script dispatched, executing inner tool calls."

_PLAIN_PYTHON_FALLBACK_WARNING = (
    "WARNING: run_sdk_snippet received plain Python code without sdk.tool usage, "
    "so it was automatically executed with run_python_snippet. "
    "Use run_python_snippet for plain Python. "
    "Use run_sdk_snippet only for Code Mode scripts that call tools through sdk.tool."
)

logger = get_logger(__name__)


class RunSdkSnippetParams(BaseToolParams):
    """SDK 代码片段执行参数"""
    python_code: str = Field(
        ...,
        description="""<!--zh: 要执行的 Code Mode Python 代码，必须通过 sdk.tool 调用工具；普通 Python 请使用 run_python_snippet。-->
Code Mode Python code that calls tools via sdk.tool. Use run_python_snippet for plain Python."""
    )
    timeout: int = Field(
        120,
        description="""<!--zh: 超时秒数，默认120，按预期时长调整-->
Timeout in seconds, default 120. Increase for long-running scripts."""
    )
    cwd: str | None = Field(
        None,
        description="""<!--zh: 脚本执行工作目录；默认使用当前工作空间，相对路径基于工作空间解析，绝对路径直接使用。-->
Script working directory. Defaults to the current workspace. Relative paths resolve from the workspace; absolute paths are used as provided."""
    )


@tool(auto_mount=AutoMount.CODE_EXECUTION)
class RunSdkSnippet(AbstractFileTool[RunSdkSnippetParams]):
    """<!--zh: 执行通过 SDK 调用工具或 MCP 的 Code Mode Python 脚本，普通 Python 请使用 run_python_snippet。-->
    Run a Code Mode Python script that calls tools or MCP via SDK. Use run_python_snippet for plain Python.
    """

    def should_trigger_events(self) -> bool:
        """Code Mode 执行不触发工具调用事件，对对话透明"""
        return False

    def is_visible_in_ui(self) -> bool:
        """隐藏 Code Mode 外层卡片，只展示内部真实工具调用。"""
        return False

    def get_prompt_hint(self) -> str:
        return """\
    <!--zh
    根据执行过程应该如何展示给用户来选择工具：
    - 只有脚本的主要目的是通过 sdk.tool 导入 tool 并调用 tool.call() 时，才使用 run_sdk_snippet。run_sdk_snippet 的外层包装卡片会由前端隐藏；脚本内每次 tool.call() 仍会分别展示真实工具卡片。
    - 普通 Python 计算、数据处理、校验、文件操作，或不使用 tool.call() 的库与 SDK 调用，应使用 run_python_snippet。它的 Python 执行卡片保持可见，用户可以检查实际执行的代码。
    - 不要把 run_sdk_snippet 当作普通 Python 运行器。脚本没有导入 sdk.tool 并调用 tool.call() 时，应选择 run_python_snippet。

    写一段 Python 脚本来编排工具调用。脚本里可以串联多个工具、加入判断和循环，
中间结果留在脚本内部，不进入你的上下文——只有 print 的内容会回到你手里。

适用场景：需要多步工具编排、逻辑处理，或调用仅通过 Code Mode 可用的工具。
常与 Skill 搭配：Skill 告诉你做什么，这个工具负责怎么做。

示例——搜索关键词：

```python
from sdk.tool import tool

hits = tool.call("grep_search", {"query": "def handle_error", "file_pattern": "*.py"})
print(hits.content)
```

需要调 MCP 时，也是走 tool.call，具体用法参考 using-mcp skill：

```python
from sdk.tool import tool

result = tool.call("mcp_call_tool", {
    "server_name": "server_name",
    "tool_name": "tool_name",
    "tool_params": '{"key": "value"}',  # JSON string, not a dict
})
print(result.content)
```

参数和你平时直接调工具完全一样。
result.content 是工具返回的文本结果，直接 print 即可。
timeout 默认 120 秒，跑得久就传大一点。

务必检查 result.ok 再使用数据：

```python
result = tool.call("some_tool", {"param": "value"})
if not result.ok:
    print(f"Failed: {result.content}")
else:
    # 使用 result.content 或 result.data
```

输出的本质问题是"结果给谁用"。
你自己要继续分析，print() 最直接——结果立刻回到你的上下文，没有中间环节。
用户需要交付物（报告、数据集、CSV），才值得写入文件。
当数据量大到 print 会被截断时，文件的价值不是"保存"，而是变成可操作的数据源——
基于"一切皆文件"的理念，你可以对它搜索、读取片段、按行过滤，
比试图一次性塞进上下文有效得多。
反过来说，不需要文件的场景去写文件，既污染用户工作空间，又多一步读取才能拿回内容。

```python
from sdk.tool import tool

result = tool.call("some_tool", {"param": "value"})
if not result.ok:
    print(f"Failed: {result.content}")
else:
    print(result.content)  # 自己分析：直接 print
    # 用户要导出时：
    # tool.call("write_file", {"file_path": "output.md", "content": result.content})
```

脚本中执行具体操作时，优先通过 tool.call() 调已有工具。
因为每次 tool.call() 在前端渲染为可视化的工具调用卡片，用户能直观看到脚本在做什么——
这是 Code Mode 的核心体验优势。只有已有工具覆盖不到的能力，才用 Python 原生代码补齐。

result.data["data_view"] 是结构化原始数据——提取你需要的字段，按需求重组后输出。
不要原样 dump 整个 data_view。

```python
from sdk.tool import tool

result = tool.call("some_data_tool", {"query": "..."})
if not result.ok:
    print(f"Failed: {result.content}")
else:
    data = result.data.get("data_view", {})
    items = data.get("items", [])

    lines = [f"# Results ({len(items)} items)\n"]
    for item in items:
        title = item.get("title", "Untitled")
        stats = item.get("stats", {})
        lines.append(f"## {title}")
        lines.append(f"- Likes: {stats.get('liked_count', 'N/A')}")
        lines.append(f"- Comments: {stats.get('comment_count', 'N/A')}\n")

    print("\\n".join(lines))
    # 用户要导出时，换成 write_file；也可导出为 CSV/JSON 等任意格式
```

    也可以链式串联多个工具：从一个工具取 ID，传给另一个工具，再合并输出。
    -->
    Choose this tool based on how the execution should appear to the user:
    - Use run_sdk_snippet only for Code Mode scripts whose primary purpose is to import tool from sdk.tool and call tool.call(). The frontend hides the run_sdk_snippet wrapper card, while each inner tool.call() is shown as its own tool card.
    - Use run_python_snippet for plain Python computation, data processing, validation, file operations, or direct library and SDK calls that do not use tool.call(). Its Python execution card remains visible so the user can inspect the code that ran.
    - Do not use run_sdk_snippet merely as a Python runner. If the script does not import sdk.tool and call tool.call(), choose run_python_snippet.

    Write a Python script to orchestrate tool calls. You can chain multiple tools, add conditionals and loops — intermediate results stay inside the script and never enter your context. Only what you print comes back.

Use when you need multi-step tool orchestration, logic processing, or tools that are only available via Code Mode.
Often paired with Skills: the Skill tells you what to do, this tool handles how.

Example — search for a pattern and print results:

```python
from sdk.tool import tool

hits = tool.call("grep_search", {"query": "def handle_error", "file_pattern": "*.py"})
print(hits.content)
```

MCP capabilities are also accessed via tool.call (see the using-mcp skill for details):

```python
from sdk.tool import tool

result = tool.call("mcp_call_tool", {
    "server_name": "server_name",
    "tool_name": "tool_name",
    "tool_params": '{"key": "value"}',  # JSON string, not a dict
})
print(result.content)
```

Arguments are exactly the same as calling tools directly.
result.content is the tool's text output — just print it.
timeout defaults to 120s. Increase it for longer-running scripts.

Always check result.ok before using the data:

```python
result = tool.call("some_tool", {"param": "value"})
if not result.ok:
    print(f"Failed: {result.content}")
else:
    # use result.content or result.data
```

The fundamental question for output is "who consumes this result?"
When you need data for your own reasoning, print() is the most direct path — results land in your context immediately with zero overhead.
When the user needs a deliverable (report, dataset, CSV), that's when writing to a file is worthwhile.
When data is large enough that print would truncate it, the file becomes an operable data source —
you can search it, read sections, filter lines, which is far more effective than trying to fit everything into context at once.
Conversely, writing files when unnecessary pollutes the user's workspace and adds an extra read step to get the content back.

```python
from sdk.tool import tool

result = tool.call("some_tool", {"param": "value"})
if not result.ok:
    print(f"Failed: {result.content}")
else:
    print(result.content)  # For your own analysis: print directly
    # When user wants an export:
    # tool.call("write_file", {"file_path": "output.md", "content": result.content})
```

Inside scripts, prefer tool.call() with existing tools for concrete operations.
Each tool.call() renders as a visual tool-call card in the frontend — the user sees what the script is doing.
This is a core UX advantage of Code Mode. Use plain Python only for capabilities not covered by existing tools.

result.data["data_view"] contains structured raw data — extract the fields you need and reshape them.
Do not dump data_view as-is.

```python
from sdk.tool import tool

result = tool.call("some_data_tool", {"query": "..."})
if not result.ok:
    print(f"Failed: {result.content}")
else:
    data = result.data.get("data_view", {})
    items = data.get("items", [])

    lines = [f"# Results ({len(items)} items)\n"]
    for item in items:
        title = item.get("title", "Untitled")
        stats = item.get("stats", {})
        lines.append(f"## {title}")
        lines.append(f"- Likes: {stats.get('liked_count', 'N/A')}")
        lines.append(f"- Comments: {stats.get('comment_count', 'N/A')}\n")

    print("\\n".join(lines))
    # For user export, switch to write_file; can also export as CSV/JSON/any format
```

You can also chain multiple tool results: fetch IDs from one tool, pass to another, combine outputs.
"""

    @staticmethod
    def _build_snippet_extra_env(project_root: Path) -> dict[str, str]:
        """构建 SDK 代码片段子进程的基础环境变量。"""
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

    async def resolve_forwarded_tool(
        self,
        tool_context: ToolContext,
        arguments: Dict[str, Any],
    ) -> ToolForwardRequest | None:
        params = RunSdkSnippetParams(**arguments)
        python_code = self._prepare_python_code(params.python_code)
        if SnippetEnvironment.looks_like_code_mode(python_code):
            return None

        from app.tools.run_python_snippet import RunPythonSnippet, RunPythonSnippetParams

        fallback_purpose = i18n.translate(
            "run_sdk_snippet.fallback_purpose",
            category="tool.messages",
        )
        return ToolForwardRequest(
            target_tool=RunPythonSnippet,
            params=RunPythonSnippetParams(
                purpose=fallback_purpose,
                python_code=python_code,
                timeout=params.timeout,
                cwd=params.cwd,
            ),
            warning=_PLAIN_PYTHON_FALLBACK_WARNING,
        )

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

    @staticmethod
    def _prepare_python_code(python_code: str) -> str:
        return prepare_python_code(python_code, logger=logger, caller="run_sdk_snippet")

    async def execute(self, tool_context: ToolContext, params: RunSdkSnippetParams) -> ToolResult:
        python_code = self._prepare_python_code(params.python_code)

        # 检查是否包含不允许在 Code Mode 中调用的工具
        blocked_tools = self._check_code_mode_compatibility(python_code)
        if blocked_tools:
            names = ", ".join(blocked_tools)
            return ToolResult.error(
                f"The following tool(s) cannot be called via Code Mode (run_sdk_snippet): {names}. "
                f"Call '{blocked_tools[0]}' directly as a standalone tool call instead."
            )

        # v2 模式下在脚本执行前是否已提前触发 after_tool_call
        early_after_sent = False
        script_file_path: Path | None = None

        try:
            project_root = PathManager.get_project_root()
            agent_ctx = tool_context.get_extension_typed("agent_context", AgentContext)
            if agent_ctx is None:
                raise RuntimeError(
                    "run_sdk_snippet requires agent_context in tool_context to identify "
                    "the calling Agent."
                )

            try:
                script_file_path = await SnippetEnvironment.create_temporary_script(
                    python_code,
                    "run_sdk",
                )
            except Exception as e:
                logger.exception(f"Failed to prepare temporary SDK script: {e}")
                return ToolResult.error(
                    SnippetEnvironment.format_execution_error(
                        "Failed to prepare the temporary SDK script.",
                        e,
                    )
                )

            logger.info(f"创建 SDK 代码片段脚本: {script_file_path}")

            command = f"python {shlex.quote(str(script_file_path))}"
            effective_timeout = SdkSnippetTimeoutRegistry.get_effective_timeout(
                python_code, params.timeout
            )
            if effective_timeout != params.timeout:
                logger.info(
                    f"run_sdk_snippet 超时自动提升: "
                    f"requested={params.timeout}s, effective={effective_timeout}s"
                )

            # 将调用方 AgentContext 的 context_id 注入子进程，供 SDK 请求带回服务端，
            # 使服务端能精确路由到正确的 Agent 上下文。
            extra_env = self._build_snippet_extra_env(project_root)
            extra_env["SUPER_MAGIC_AGENT_CONTEXT_ID"] = agent_ctx.context_id
            extra_env["PYTHONUNBUFFERED"] = "1"
            # i18n 使用 ContextVar，子进程与后续 SDK HTTP 请求不会自动继承。
            extra_env["SUPER_MAGIC_LANGUAGE"] = i18n.get_language()
            SnippetEnvironment.apply_current_model(extra_env, agent_ctx)

            # 每次 Code Mode 执行生成唯一标识，用于精确取消本轮发起的服务端请求
            sdk_execution_id = uuid.uuid4().hex
            extra_env["SUPER_MAGIC_SDK_EXECUTION_ID"] = sdk_execution_id

            # 注册 cleanup：主 run 中断时先取消本轮服务端 in-flight 请求，
            # 再由 ProcessExecutor 中断子进程
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
                    ToolResult(content=_EARLY_AFTER_FAKE_CONTENT, system=TOOL_RESULT_SYSTEM_EARLY_AFTER),
                    0.0,
                )
                early_after_sent = True

            timeout_status = ""
            try:
                terminal_result = await ProcessExecutor.execute_command(
                    command=command,
                    cwd=SnippetEnvironment.resolve_working_dir(
                        agent_ctx.get_workspace_dir(),
                        params.cwd,
                    ),
                    timeout=effective_timeout,
                    extra_env=extra_env,
                    interruption_event=agent_ctx.get_interruption_event(),
                    detect_interactive_prompt=False,
                )
                if terminal_result.extra_info.get("timed_out") is True:
                    before_cancel = registry.snapshot_execution(agent_ctx.context_id, sdk_execution_id)
                    registry.cancel_by_execution(agent_ctx.context_id, sdk_execution_id)
                    after_cancel = registry.snapshot_execution(agent_ctx.context_id, sdk_execution_id)
                    timeout_status = self._format_timeout_status(before_cancel, after_cancel)
            finally:
                # 展示来源估算失败也不能阻断既有取消与清理。
                from agentlang.chat_history.chat_history_models import ContextSource
                context_source = ContextSource.MIXED
                try:
                    context_source = registry.context_source(agent_ctx.context_id, sdk_execution_id)
                except Exception as source_error:
                    logger.warning(f"SDK context source unavailable: {type(source_error).__name__}")
                # 正常完成后清理残留的 in-flight 记录（容错）
                try:
                    registry.cancel_by_execution(agent_ctx.context_id, sdk_execution_id)
                except Exception as cleanup_error:
                    logger.warning(
                        f"Failed to clean up SDK in-flight calls: "
                        f"execution_id={sdk_execution_id}, error={cleanup_error}"
                    )
                finally:
                    registry.clear_execution(agent_ctx.context_id, sdk_execution_id)

            # early_after_sent=True 时外层 after_tool_call 应被屏蔽（已提前发出）
            system = TOOL_RESULT_SYSTEM_DISPATCHED if early_after_sent else None
            content = terminal_result.content
            if timeout_status:
                content = f"{content}\n\n{timeout_status}"
            if terminal_result.ok:
                return ToolResult(content=content, system=system, extra_info={"context_source": context_source})
            else:
                return ToolResult.error(content, system=system, extra_info={"context_source": context_source})

        except asyncio.CancelledError:
            # 中断信号，直接向上传播，不要降级为普通错误
            raise

        except Exception as e:
            logger.exception(f"SDK snippet execution failed: {e}")
            system = TOOL_RESULT_SYSTEM_DISPATCHED if early_after_sent else None
            return ToolResult.error(
                SnippetEnvironment.format_execution_error(
                    "SDK snippet execution failed.",
                    e,
                ),
                system=system,
            )

        finally:
            if script_file_path is not None:
                try:
                    await SnippetEnvironment.delete_temporary_script(script_file_path)
                    logger.debug(f"已删除 SDK 代码片段脚本: {script_file_path}")
                except Exception as cleanup_error:
                    logger.warning(
                        f"Failed to delete temporary SDK script: "
                        f"path={script_file_path}, error={cleanup_error}"
                    )

    @classmethod
    def _format_timeout_status(
        cls,
        before_cancel: tuple[SdkCallSummary, ...],
        after_cancel: tuple[SdkCallSummary, ...],
    ) -> str:
        if not before_cancel:
            return "SDK call status at timeout: no inner tool call reached the server."
        lines = ["SDK call status at timeout:"]
        for item in before_cancel:
            lines.append(cls._format_call_summary(item))
        cancelled_ids = {
            item.tool_call_id
            for item in after_cancel
            if item.status is SdkCallStatus.CANCELLED
        }
        if cancelled_ids:
            lines.append("Cancelled after timeout: " + ", ".join(sorted(cancelled_ids)))
        return "\n".join(lines)

    @staticmethod
    def _format_call_summary(item: SdkCallSummary) -> str:
        started = item.started_at.strftime("%Y-%m-%d %H:%M:%S UTC")
        finished = (
            item.finished_at.strftime("%Y-%m-%d %H:%M:%S UTC")
            if item.finished_at is not None
            else "not finished"
        )
        details = f"; {item.summary}" if item.summary else ""
        error = f"; error_code={item.error_code}" if item.error_code else ""
        return (
            f"- {item.tool_name} ({item.tool_call_id}): status={item.status.value}, "
            f"started={started}, finished={finished}{error}{details}"
        )

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
