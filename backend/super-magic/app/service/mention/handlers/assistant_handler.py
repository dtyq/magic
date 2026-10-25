"""Assistant mention handler."""

from typing import TYPE_CHECKING, Any, Dict, List, Optional
from urllib.parse import quote

from app.service.mention.base import BaseMentionHandler, logger

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext


def _assistant_id(mention: Dict[str, Any]) -> str:
    return str(mention.get("assistant_id") or mention.get("id") or "").strip()


def _assistant_name(mention: Dict[str, Any]) -> str:
    return str(mention.get("assistant_name") or mention.get("name") or "unknown-assistant").strip()


def _assistant_description(mention: Dict[str, Any]) -> str:
    return str(mention.get("description") or mention.get("assistant_description") or "").strip()


class AssistantHandler(BaseMentionHandler):
    """Handle legacy business assistant mentions."""

    def get_type(self) -> str:
        return "assistant"

    async def get_tip(
        self,
        mention: Dict[str, Any],
        agent_context: Optional["AgentContext"] = None,
    ) -> str:
        assistant_id = _assistant_id(mention)
        assistant_name = _assistant_name(mention)
        description = _assistant_description(mention)

        if not assistant_id:
            tip = (
                f"Assistant '{assistant_name}' is referenced but its assistant_id is missing; "
                "ask the user to clarify before invoking it."
            )
        else:
            desc_part = f" Its description is: {description}." if description else ""
            tip = (
                f"Assistant '{assistant_name}' (assistant_id='{assistant_id}') is referenced.{desc_part} "
                "If the user explicitly asks this Assistant to perform work, call `call_assistant` "
                "via run_sdk_snippet using the exact assistant_id from the mention. "
                "For a follow-up, reuse only the conversation_id returned by the previous call. "
                "Do not invoke the same Assistant more than once in one turn unless explicitly requested."
            )

        if agent_context is not None:
            try:
                agent_context.horizon.push_notification("assistant_mention", tip)
                return ""
            except Exception as exc:
                logger.warning(f"推送 assistant mention horizon 通知失败: {exc}")
        return tip

    async def handle(
        self,
        mention: Dict[str, Any],
        index: int,
        agent_context: Optional["AgentContext"] = None,
    ) -> List[str]:
        assistant_id = _assistant_id(mention)
        assistant_name = _assistant_name(mention)
        description = _assistant_description(mention)

        if assistant_id:
            target = quote(assistant_id, safe="-._~")
            label = assistant_name.replace("\\", "\\\\").replace("[", "\\[").replace("]", "\\]")
            lines = [f"{index}. [{label}](assistant://{target})"]
            lines.append(f"   - assistant_id: {assistant_id}")
        else:
            lines = [f"{index}. Assistant reference: {assistant_name} (assistant_id is missing)"]
        if description:
            lines.append(f"   - description: {description}")
        return lines
