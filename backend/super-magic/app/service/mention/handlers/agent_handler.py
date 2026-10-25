"""Agent mention handler

@agent mention 经 magic-service 端 AgentMentionNormalizer 规范化后，会带上以下字段：
  - agent_id / flow_code / agent_name / description / icon / instructs

handler 职责：
  1. handle(): 把 mention 摘要写入 <mentions> 上下文（提供 agent_id 给 LLM 引用）
  2. get_tip(): 通过 horizon push_notification 推送指引 —— 告知 LLM 通过
     run_sdk_snippet 调用 call_subagent 工具来真正派发给目标 agent。
"""
from typing import TYPE_CHECKING, Any, Dict, List, Optional
from urllib.parse import quote

from app.service.mention.base import BaseMentionHandler, logger

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext


def _get_agent_id(mention: Dict[str, Any]) -> str:
    """优先取规范化后的 agent_id，回退到原 mention id 字段。"""
    return str(mention.get("agent_id") or mention.get("id") or "").strip()


def _get_agent_name(mention: Dict[str, Any]) -> str:
    return str(
        mention.get("agent_name")
        or mention.get("name")
        or "unknown-agent"
    ).strip()


def _get_runtime_agent_code(mention: Dict[str, Any]) -> str:
    """Return the runtime target code without treating it as a session ID.

    New normalized mentions may carry ``agent_code``. Older built-in mentions
    identify the runtime Agent directly through ``agent_id``; retaining that
    fallback keeps the existing mention protocol working during migration.
    """
    return str(
        mention.get("agent_code")
        or mention.get("flow_code")
        or mention.get("agent_id")
        or ""
    ).strip()


def _get_description(mention: Dict[str, Any]) -> str:
    return str(mention.get("description") or mention.get("agent_description") or "").strip()


class AgentHandler(BaseMentionHandler):
    """处理 agent 类型的 mention"""

    def get_type(self) -> str:
        return "agent"

    async def get_tip(
        self,
        mention: Dict[str, Any],
        agent_context: Optional["AgentContext"] = None,
    ) -> str:
        """推送 agent mention 指引到 horizon。

        指引内容：
          - 提示 LLM 通过 run_sdk_snippet + tool.call("call_subagent", ...) 调用
          - 使用 agent_code 选择运行目标，并使用独立 session_id 管理会话
          - 缺失 agent_context 时退化为 Before proceeding: 文本注入
        """
        agent_id = _get_agent_id(mention)
        agent_name = _get_agent_name(mention)
        agent_code = _get_runtime_agent_code(mention)
        description = _get_description(mention)

        if not agent_id:
            tip = (
                f"Agent '{agent_name}' is referenced but its agent_id is missing; "
                f"ask the user to confirm before invoking."
            )
        else:
            desc_part = f" Its description is: {description}." if description else ""
            code_part = f" The runtime agent_code is '{agent_code}'." if agent_code else ""
            tip = (
                f"Agent '{agent_name}' (mention agent_id='{agent_id}') is referenced.{desc_part}{code_part} "
                "If the user explicitly asks this Agent to perform work, call `call_subagent` "
                "via run_sdk_snippet. Use the normalized `agent_code` as the target code and "
                "use a separate `session_id` for the sub-agent session; do not use the mention agent_id as the session ID.\n"
                f"```python\n"
                f"from sdk.tool import tool\n"
                f"result = tool.call(\"call_subagent\", {{\n"
                f"    \"agent_code\": \"<agent_code from the mention>\",\n"
                f"    \"session_id\": \"<optional session base; omit to generate one>\",\n"
                f"    \"task_label\": \"<what you want this agent to do>\",\n"
                f"    \"prompt\": \"<self-contained task prompt>\",\n"
                f"    \"background\": False,\n"
                f"}})\n"
                "```\n"
                "Read the structured result. If background=true, wait with wait_for_subagents using "
                "the final session ID returned by call_subagent. Do not invoke the same Agent more than once in one turn unless explicitly requested."
            )

        if agent_context is not None:
            try:
                agent_context.horizon.push_notification("agent_mention", tip)
                return ""
            except Exception as e:
                logger.warning(f"推送 agent mention horizon 通知失败: {e}")

        return tip

    async def handle(
        self,
        mention: Dict[str, Any],
        index: int,
        agent_context: Optional["AgentContext"] = None,
    ) -> List[str]:
        agent_id = _get_agent_id(mention)
        agent_name = _get_agent_name(mention)
        description = _get_description(mention)
        agent_code = _get_runtime_agent_code(mention)
        flow_code = str(mention.get("flow_code") or "").strip()

        logger.info(
            f"用户 prompt 添加 Agent 引用: {agent_name} "
            f"(agent_id={agent_id}, flow_code={flow_code})"
        )

        if agent_id:
            target = quote(agent_id, safe="-._~")
            label = agent_name.replace("\\", "\\\\").replace("[", "\\[").replace("]", "\\]")
            lines = [f"{index}. [{label}](agent://{target})"]
        else:
            lines = [f"{index}. Agent reference: {agent_name} (agent_id is missing)"]
        if agent_id:
            lines.append(f"   - agent_id: {agent_id}")
        if agent_code:
            lines.append(f"   - agent_code: {agent_code}")
        if description:
            lines.append(f"   - description: {description}")

        return lines
