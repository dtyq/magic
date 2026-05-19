"""
Search Knowledge Parameter

Parameter class for knowledge search API.
"""

from typing import Any, Dict

from ..kernel.magic_service_parameter import MagicServiceAbstractParameter


class SearchKnowledgeParameter(MagicServiceAbstractParameter):
    """Parameter for knowledge similarity search."""

    def __init__(self, agent_code: str, query: str):
        super().__init__()
        self.agent_code = agent_code
        self.query = query

    def get_agent_code(self) -> str:
        """Get agent code."""
        return self.agent_code

    def to_body(self) -> Dict[str, Any]:
        return {}

    def to_query_params(self) -> Dict[str, Any]:
        return {
            "query": self.query,
        }

    def validate(self) -> None:
        super().validate()
        if not isinstance(self.agent_code, str) or not self.agent_code.strip():
            raise ValueError("Agent code is required")
        if not isinstance(self.query, str) or not self.query.strip():
            raise ValueError("Query is required")
