"""call_simple_tool 工具

把 magic-service 中"工具流"以本地工具的形态暴露给 super-magic：
LLM 通过 mention 拿到 `tool_id`（即 tool flow code）与 `json_schema` 后，
通过 `run_sdk_snippet` 调 `tool.call("call_simple_tool", {"tool_id": ..., "arguments": {...}})`。

之所以不复用 [RemoteTool](file:///app/tools/remote/remote_tool.py)：
- RemoteTool 是基于 agent 启动期 schema 列表反查动态注册的，schema 各异
- 本工具是静态 schema（tool_id + arguments），定位更接近"通用工具流派发器"
- 校验由远端执行；本地仅作必填校验与转发
"""

from typing import Any, Dict, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.infrastructure.sdk.magic_service.factory import get_magic_service_sdk
from app.infrastructure.sdk.magic_service.parameter.tool_execute_parameter import (
    ToolExecuteParameter,
)
from app.tools.core import BaseTool, BaseToolParams, tool

logger = get_logger(__name__)


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
                ToolExecuteParameter(code=tool_id, arguments=arguments)
            )
            return ToolResult(content=result.to_string())
        except Exception as exc:
            logger.error(f"call_simple_tool failed (tool_id={tool_id}): {exc}")
            return ToolResult.error(f"call_simple_tool failed: {exc}")
