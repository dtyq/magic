"""call_simple_tool 工具

把 magic-service 中"工具流"以本地工具的形态暴露给 super-magic：
LLM 通过 mention 拿到 `tool_id`（即 tool flow code）与 `json_schema` 后，
通过 `run_sdk_snippet` 调 `tool.call("call_simple_tool", {"tool_id": ..., "arguments": {...}})`。

之所以不复用 [RemoteTool](file:///app/tools/remote/remote_tool.py)：
- RemoteTool 是基于 agent 启动期 schema 列表反查动态注册的，schema 各异
- 本工具是静态 schema（tool_id + arguments），定位更接近"通用工具流派发器"
- 校验由远端执行；本地仅作必填校验与转发
"""

import json
from typing import Any, Dict, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.infrastructure.sdk.magic_service.factory import get_magic_service_sdk
from app.infrastructure.sdk.magic_service.parameter.tool_execute_parameter import (
    ToolExecuteParameter,
)
from app.tools.core import BaseTool, BaseToolParams, tool
from app.tools.snippet_timeout_registry import SdkSnippetTimeoutRegistry

logger = get_logger(__name__)

# 工具流远端可能涉及多步骤聚合（外部 API、AI 推理等），把超时放宽到 2 分钟，
# 仅对本工具的单次请求生效，不影响 SDK client 默认 30s 配置。
_CALL_SIMPLE_TOOL_TIMEOUT_SECONDS = 120.0

# 注册最小超时供 run_sdk_snippet 自动提升，避免 snippet 外层在单次远程调用前提前超时
SdkSnippetTimeoutRegistry.register(
    ["call_simple_tool"],
    min_timeout=int(_CALL_SIMPLE_TOOL_TIMEOUT_SECONDS),
)


class CallSimpleToolParams(BaseToolParams):
    tool_id: str = Field(
        ...,
        description=(
            "<!--zh: 目标工具流的 ID（即 mention 中 @tool 携带的 id / tool flow code）；"
            "必须与用户 mention 中的 id 完全一致。 -->"
            "Target tool flow id. MUST equal the `id` carried by the user's @tool mention "
            "(also referred to as tool flow code). Do not invent it."
        ),
    )
    arguments: Optional[Dict[str, Any]] = Field(
        default=None,
        description=(
            "<!--zh: 传给该工具流的参数对象，必须满足 mention 携带的 json_schema；"
            "无参数时传 {} 或省略。 -->"
            "Arguments object forwarded to the tool flow. MUST satisfy the `json_schema` "
            "carried by the mention. Pass {} or omit when the tool needs no input."
        ),
    )


@tool(name="call_simple_tool")
class CallSimpleTool(BaseTool[CallSimpleToolParams]):
    """<!--zh
    通用工具流派发器：根据用户 @tool mention 中的 tool_id 调用 magic-service 上的工具流。
    使用前提：用户消息中已存在 @tool mention，并已通过 horizon push_notification 提示当前工具的
    json_schema/description；本工具仅负责把参数透传到 /api/v1/open-api/sandbox/agents/tool-execute。
    -->
    Generic tool-flow dispatcher: invoke a magic-service tool flow by `tool_id`
    that originates from the user's @tool mention. Forwards `arguments` to the
    open-api endpoint /api/v1/open-api/sandbox/agents/tool-execute. Use it
    only when the LLM has been told (via horizon notification) about the tool
    and its json_schema.
    """

    def get_prompt_hint(self) -> str:
        return """<!--zh
当用户消息里出现 @tool mention 并且 horizon 推送了对应提示时，使用 `call_simple_tool` 调用该工具：

调用形态（仅在 run_sdk_snippet 中）：
```python
from sdk.tool import tool
result = tool.call("call_simple_tool", {
    "tool_id": "<mention 中的 id>",
    "arguments": { ... 必须满足 mention 中的 json_schema ... }
})
```

要点：
- `tool_id` 取自 mention 的 id 字段；不要编造、不要替换为 name
- `arguments` 的字段必须严格匹配 mention 中携带的 json_schema（含 required/类型）
- 无入参时 `arguments` 传 {} 或省略
- 该工具仅做转发；执行错误会原样回到调用方
-->
When the user message contains an @tool mention and a horizon notification about
that tool has been delivered, use `call_simple_tool` to actually invoke the tool:

```python
from sdk.tool import tool
result = tool.call("call_simple_tool", {
    "tool_id": "<id from the mention>",
    "arguments": { ... must satisfy the json_schema carried by the mention ... }
})
```

Rules:
- `tool_id` MUST be the exact `id` from the mention (also called tool flow code).
  Do NOT invent it and do NOT substitute the mention `name`.
- `arguments` MUST conform to the json_schema carried by the mention (required
  fields and types).
- When the schema declares no input, pass `{}` or omit it.
- This tool is a thin forwarder; remote execution errors propagate back as-is.
"""

    def is_visible_in_ui(self) -> bool:
        return False

    async def get_before_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        return {
            "tool_name": tool_name,
            "action": i18n.translate("call_simple_tool", category="tool.actions"),
            "remark": i18n.translate("call_simple_tool.calling", category="tool.messages"),
        }

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        action = i18n.translate("call_simple_tool", category="tool.actions")
        remark_key = "call_simple_tool.called" if result.ok else "call_simple_tool.failed"
        return {
            "tool_name": tool_name,
            "action": action,
            "remark": i18n.translate(remark_key, category="tool.messages"),
        }

    async def get_tool_detail(
        self,
        tool_context: ToolContext,
        result: ToolResult,
        arguments: Dict[str, Any] = None,
    ) -> Optional[ToolDetail]:
        args = arguments or {}
        tool_id = str(args.get("tool_id") or "").strip() or "-"
        raw_arguments = args.get("arguments") or {}

        status_icon = "✅" if result.ok else "❌"
        sections: list[str] = [f"`{tool_id}` {status_icon}"]

        execution_time = getattr(result, "execution_time", None)
        if execution_time is not None:
            sections.append(f"> Latency {execution_time:.2f}s")

        sections.append(
            "#### 入参\n\n```json\n"
            + self._format_json(raw_arguments)
            + "\n```"
        )

        content_text = result.content or ""
        truncated = False
        if len(content_text) > 2000:
            content_text = content_text[:2000]
            truncated = True

        response_label = "#### 返回" if result.ok else "#### 错误"
        sections.append(f"{response_label}\n\n{self._render_content_block(content_text)}")
        if truncated:
            sections.append("_… 输出已截断_")

        md = "\n\n".join(sections)
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(file_name="call_simple_tool_result.md", content=md),
        )

    @staticmethod
    def _format_json(value: Any) -> str:
        """给前端展示的 JSON 美化；序列化失败时退化为 str()。"""
        try:
            return json.dumps(value, ensure_ascii=False, indent=2)
        except (TypeError, ValueError):
            return str(value)

    @staticmethod
    def _render_content_block(content: str) -> str:
        """输出可能是 JSON / 纯文本，能解析为 JSON 的就美化，
        其余一律作为 plain text 包裹，避免原文中的 markdown 字符干扰渲染。外层使用 4 个
        反引号 fence，容下内容本身包含 3 个反引号的场景。
        """
        text = (content or "").strip()
        if not text:
            return "_(empty)_"
        try:
            obj = json.loads(text)
        except (json.JSONDecodeError, TypeError):
            obj = None
        if isinstance(obj, (dict, list)):
            return f"```json\n{json.dumps(obj, ensure_ascii=False, indent=2)}\n```"
        return f"````text\n{text}\n````"

    async def execute(
        self, tool_context: ToolContext, params: CallSimpleToolParams
    ) -> ToolResult:
        tool_id = (params.tool_id or "").strip()
        if not tool_id:
            return ToolResult.error("tool_id must not be empty.")

        arguments = params.arguments or {}
        if not isinstance(arguments, dict):
            return ToolResult.error("arguments must be a JSON object (dict).")

        try:
            magic_service = get_magic_service_sdk()
            result = await magic_service.agent.execute_tool_async(
                ToolExecuteParameter(
                    code=tool_id,
                    arguments=arguments,
                    timeout=_CALL_SIMPLE_TOOL_TIMEOUT_SECONDS,
                )
            )
            return ToolResult(content=result.to_string())
        except Exception as exc:
            logger.error(f"call_simple_tool failed (tool_id={tool_id}): {exc}")
            return ToolResult.error(f"call_simple_tool failed: {exc}")
