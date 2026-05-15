"""
Agent Execute Parameter

Parameter class for agent execute API (POST /api/v1/open-api/sandbox/agents/agent-execute).
"""

from typing import Any, Dict, List, Optional

from ..kernel.magic_service_parameter import MagicServiceAbstractParameter


class AgentExecuteParameter(MagicServiceAbstractParameter):
    """Parameter for agent execute API"""

    def __init__(
        self,
        agent_id: str,
        message: str,
        conversation_id: Optional[str] = None,
        instruction: Optional[List[Dict[str, Any]]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
    ):
        """
        Initialize agent execute parameter.

        Args:
            agent_id: Magic agent id (the same id transmitted in mention).
            message: User input message to feed the agent.
            conversation_id: Optional conversation id; reuse to keep context.
            instruction: Optional list of instructions, each item: {"name": str, "value": str}.
            attachments: Optional list of attachment descriptors, mirroring magic-service raw schema.
        """
        super().__init__()
        self.agent_id = agent_id
        self.message = message
        self.conversation_id = conversation_id
        self.instruction = instruction or []
        self.attachments = attachments or []

    def get_agent_id(self) -> str:
        return self.agent_id

    def get_message(self) -> str:
        return self.message

    def get_conversation_id(self) -> Optional[str]:
        return self.conversation_id

    def get_instruction(self) -> List[Dict[str, Any]]:
        return self.instruction

    def get_attachments(self) -> List[Dict[str, Any]]:
        return self.attachments

    def to_body(self) -> Dict[str, Any]:
        body: Dict[str, Any] = {
            'agent_id': self.agent_id,
            'message': self.message,
        }
        if self.conversation_id:
            body['conversation_id'] = self.conversation_id
        if self.instruction:
            body['instruction'] = self.instruction
        if self.attachments:
            body['attachments'] = self.attachments
        return body

    def to_query_params(self) -> Dict[str, Any]:
        return {}

    def validate(self) -> None:
        super().validate()  # token check from base class

        if not self.agent_id or not isinstance(self.agent_id, str):
            raise ValueError("agent_id must be a non-empty string")
        if not self.message or not isinstance(self.message, str):
            raise ValueError("message must be a non-empty string")
        if self.conversation_id is not None and not isinstance(self.conversation_id, str):
            raise ValueError("conversation_id must be a string")
        if self.instruction is not None and not isinstance(self.instruction, list):
            raise ValueError("instruction must be a list of dicts")
        if self.attachments is not None and not isinstance(self.attachments, list):
            raise ValueError("attachments must be a list of dicts")
