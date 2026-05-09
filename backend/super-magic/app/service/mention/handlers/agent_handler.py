"""Agent mention handler"""
from typing import TYPE_CHECKING, Any, Dict, List, Optional
from app.service.mention.base import BaseMentionHandler, logger

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext


class AgentHandler(BaseMentionHandler):
    """处理Agent类型的mention"""

    def get_type(self) -> str:
        return "agent"

    async def get_tip(self, mention: Dict[str, Any], agent_context: Optional["AgentContext"] = None) -> str:
        return "Use the referenced agent as needed"

    async def handle(self, mention: Dict[str, Any], index: int, agent_context: Optional["AgentContext"] = None) -> List[str]:
        agent_name = mention.get("name") or mention.get("agent_name", "unknown-agent")

        logger.info(f"用户prompt添加Agent引用: {agent_name}")

        return [f"{index}. [@agent:{agent_name}]"]
