"""call_simple_agent 工具

把 magic-service 中"agent"以本地工具的形态暴露给 super-magic：
LLM 通过 mention 拿到 `agent_id`/`agent_name`/`description` 后，
通过 `run_sdk_snippet` 调 `tool.call("call_simple_agent", {"agent_id": ..., "message": ...})`。

后端复用 [MagicFlowExecuteAppService::apiChatByMCPTool](../../../../magic-service/app/Application/Flow/Service/MagicFlowExecuteAppService.php)
通道，调用路径：POST /api/v1/open-api/sandbox/agents/agent-execute。
"""

from typing import Any, Dict, List, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.infrastructure.sdk.magic_service.factory import get_magic_service_sdk
from app.infrastructure.sdk.magic_service.parameter.agent_execute_parameter import (
    AgentExecuteParameter,
)
from app.tools.core import BaseTool, BaseToolParams, tool

logger = get_logger(__name__)


class CallSimpleAgentParams(BaseToolParams):
    agent_id: str = Field(
        ...,
        description=(
            "<!--zh: 目标 agent 的 ID（即 mention 中 @agent 携带的 agent_id）；"
            "必须与用户 mention 中的值完全一致。 -->"
            "Target agent id (the `agent_id` field carried by the user's @agent mention). "
            "MUST equal the value from the mention; do not invent or substitute it."
        ),
    )
    message: str = Field(
        ...,
        description=(
            "<!--zh: 发送给该 agent 的本轮用户消息文本。 -->"
            "User message to send to the agent for this turn."
        ),
    )
    conversation_id: Optional[str] = Field(
        default=None,
        description=(
            "<!--zh: 可选。复用同一会话上下文时传入上一次返回的 conversation_id；"
            "为空则新开会话。 -->"
            "Optional. Reuse the conversation_id returned by a previous call to keep "
            "context; leave empty to start a new conversation."
        ),
    )
    instruction: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description=(
            "<!--zh: 可选。指令开关列表，元素形如 {\"name\": \"...\", \"value\": \"...\"}，"
            "用于触发 agent 配置中的指令；通常无需传入。 -->"
            "Optional. List of instruction toggles in the form "
            "{\"name\": \"...\", \"value\": \"...\"} to activate agent-side instructions. "
            "Usually unnecessary."
        ),
    )


@tool(name="call_simple_agent")
class CallSimpleAgent(BaseTool[CallSimpleAgentParams]):
    """<!--zh
    通用 agent 派发器：根据用户 @agent mention 中的 agent_id 调用 magic-service 上的 agent
    进行一轮对话，返回 reply messages 与 conversation_id。复用 conversation_id 即可保持上下文。
    使用前提：mention 已下发并通过 horizon push_notification 给出 agent 的 description / 调用建议。
    -->
    Generic agent dispatcher: trigger one chat round against a magic-service
    agent identified by `agent_id` from the user's @agent mention. Returns the
    agent's reply messages and a `conversation_id` you can reuse to keep
    context across turns. Use this only after the corresponding mention/horizon
    notification has surfaced the agent description.
    """

    def get_prompt_hint(self) -> str:
        return """<!--zh
当用户消息里出现 @agent mention 并且 horizon 推送了对应提示时，使用 `call_simple_agent` 调用该 agent：

调用形态（仅在 run_sdk_snippet 中）：
```python
from sdk.tool import tool
result = tool.call("call_simple_agent", {
    "agent_id": "<mention 中的 agent_id>",
    "message": "<本轮要让 agent 处理的内容>",
    # 可选：传 conversation_id 复用上一次返回的会话上下文
    # "conversation_id": "...",
    # 可选：传 instruction 触发 agent 端配置的指令开关
    # "instruction": [{"name": "...", "value": "..."}],
})
```

要点：
- `agent_id` 取自 mention 的 agent_id 字段，不要用 mention 的 name
- 第一次调用不传 `conversation_id`，后续若想保持上下文，请传上一次返回的 conversation_id
- agent 调用结果会作为 messages 数组返回；正文已被压平拼接，可直接作为本轮回答的素材
- 不要在同一轮里多次调用同一个 agent；除非用户显式要求
-->
When the user message contains an @agent mention and a horizon notification has
surfaced its description, use `call_simple_agent` to invoke that agent:

```python
from sdk.tool import tool
result = tool.call("call_simple_agent", {
    "agent_id": "<agent_id from the mention>",
    "message": "<what you want the agent to do this turn>",
    # Optional: keep context across turns
    # "conversation_id": "...",
    # Optional: trigger configured instruction toggles
    # "instruction": [{"name": "...", "value": "..."}],
})
```

Rules:
- `agent_id` MUST be the `agent_id` from the mention. Do NOT use the mention name
  or invent an id.
- For the first call, omit `conversation_id`. To keep context for follow-up
  rounds, pass the `conversation_id` returned by the previous call.
- The reply messages come back as an array; their text is flattened and joined
  so you can use it directly as evidence for the user-facing answer.
- Do NOT invoke the same agent multiple times within one turn unless the user
  explicitly asks for it.
"""

    def is_visible_in_ui(self) -> bool:
        return False

    async def execute(
        self, tool_context: ToolContext, params: CallSimpleAgentParams
    ) -> ToolResult:
        agent_id = (params.agent_id or "").strip()
        message = (params.message or "").strip()
        if not agent_id:
            return ToolResult.error("agent_id must not be empty.")
        if not message:
            return ToolResult.error("message must not be empty.")

        try:
            magic_service = get_magic_service_sdk()
            result = await magic_service.agent.execute_agent_async(
                AgentExecuteParameter(
                    agent_id=agent_id,
                    message=message,
                    conversation_id=params.conversation_id,
                    instruction=params.instruction,
                )
            )
            content = result.to_string()
            tool_result = ToolResult(content=content)
            tool_result.data = {
                "conversation_id": result.get_conversation_id(),
                "messages": result.get_messages(),
            }
            return tool_result
        except Exception as exc:
            logger.error(f"call_simple_agent failed (agent_id={agent_id}): {exc}")
            return ToolResult.error(f"call_simple_agent failed: {exc}")
