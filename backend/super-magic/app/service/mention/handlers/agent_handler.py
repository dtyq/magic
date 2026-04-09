"""Agent mention handler"""
from typing import Dict, List, Any
from app.service.mention.base import BaseMentionHandler, logger


class AgentHandler(BaseMentionHandler):
    """处理Agent类型的mention"""

    def get_type(self) -> str:
        return "agent"

    async def get_tip(self, mention: Dict[str, Any]) -> str:
        return "Use the referenced agent as needed"

    async def handle(self, mention: Dict[str, Any], index: int) -> List[str]:
        agent_name = mention.get("name") or mention.get("agent_name", "unknown-agent")

        logger.info(f"用户prompt添加Agent引用: {agent_name}")

        return [f"{index}. [@agent:{agent_name}]"]
