"""Agent mention handler

@agent mention 经 magic-service 端 AgentMentionNormalizer 规范化后，会带上以下字段：
  - agent_id / flow_code / agent_name / description / icon / instructs

handler 职责：
  1. handle(): 把 mention 摘要写入 <mentions> 上下文（提供 agent_id 给 LLM 引用）
  2. get_tip(): 通过 horizon push_notification 推送指引 —— 告知 LLM 通过
     run_sdk_snippet 调用 call_simple_agent 工具来真正派发给目标 agent。
"""
from typing import TYPE_CHECKING, Any, Dict, List, Optional

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
          - 提示 LLM 通过 run_sdk_snippet + tool.call("call_simple_agent", ...) 调用
          - 复用 conversation_id 维持多轮上下文
          - 缺失 agent_context 时退化为 Before proceeding: 文本注入
        """
        agent_id = _get_agent_id(mention)
        agent_name = _get_agent_name(mention)
        description = str(mention.get("description") or "").strip()

        if not agent_id:
            tip = (
                f"Agent '{agent_name}' is referenced but its agent_id is missing; "
                f"ask the user to confirm before invoking."
            )
        else:
            desc_part = f" Its purpose: {description}." if description else ""
            tip = (
                f"Agent '{agent_name}' (agent_id='{agent_id}') is referenced.{desc_part} "
                f"To delegate work to it, call `call_simple_agent` via run_sdk_snippet, e.g.:\n"
                f"```python\n"
                f"from sdk.tool import tool\n"
                f"result = tool.call(\"call_simple_agent\", {{\n"
                f"    \"agent_id\": \"{agent_id}\",\n"
                f"    \"message\": \"<what you want this agent to do this turn>\",\n"
                f"    # Optional: reuse conversation_id from the previous result to keep context\n"
                f"    # \"conversation_id\": \"...\",\n"
                f"}})\n"
                f"```\n"
                f"Read result.data['messages'] for the agent's reply and "
                f"result.data['conversation_id'] to continue the same session."
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
        description = str(mention.get("description") or "").strip()
        flow_code = str(mention.get("flow_code") or "").strip()

        logger.info(
            f"用户 prompt 添加 Agent 引用: {agent_name} "
            f"(agent_id={agent_id}, flow_code={flow_code})"
        )

        lines = [f"{index}. [@agent:{agent_name}]"]
        if agent_id:
            lines.append(f"   - agent_id: {agent_id}")
        if description:
            lines.append(f"   - description: {description}")

        return lines
