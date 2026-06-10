"""
List Agents Result

Result class for list agents (featured) API response.
"""

from typing import Dict, Any, List
from app.infrastructure.sdk.base import AbstractResult


class AgentListItem:
    """A single agent in the featured list"""

    def __init__(self, data: Dict[str, Any]):
        mode = data.get("mode") or {}
        agent = data.get("agent") or {}
        self.code: str = mode.get("identifier", "") or mode.get("id", "")
        self.name: str = mode.get("name", "")
        self.description: str = mode.get("description", "")
        self.icon: str = mode.get("icon_url", "") or mode.get("icon", "")
        self.color: str = mode.get("color", "")
        self.type: str = agent.get("type", "")  # official / custom / public
        self.category: str = agent.get("category", "")  # frequent / all

    def to_dict(self) -> Dict[str, Any]:
        return {
            "code": self.code,
            "name": self.name,
            "description": self.description,
            "icon": self.icon,
            "type": self.type,
        }


class ListAgentsResult(AbstractResult):
    """Result for list agents API"""

    def __init__(self, data: Dict[str, Any]):
        self._agents: List[AgentListItem] = []
        super().__init__(data)

    def _parse_data(self) -> None:
        data = self._raw_data
        # Response: {total: N, list: [{mode: {...}, agent: {...}, groups: [...]}], models: {...}}
        items = data.get("list") or []
        for item in items:
            if not isinstance(item, dict):
                continue
            self._agents.append(AgentListItem(item))

    def get_agents(self) -> List[AgentListItem]:
        return self._agents

    def get_total(self) -> int:
        return len(self._agents)
