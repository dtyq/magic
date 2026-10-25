"""Parameters for the legacy business Assistant execute API."""

from typing import Any, Dict, List, Optional

from ..kernel.magic_service_parameter import MagicServiceAbstractParameter


class AssistantExecuteParameter(MagicServiceAbstractParameter):
    """Parameter for one chat round against a legacy business Assistant."""

    def __init__(
        self,
        assistant_id: str,
        message: str,
        conversation_id: Optional[str] = None,
        instruction: Optional[List[Dict[str, Any]]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        timeout: Optional[float] = None,
    ):
        super().__init__()
        self.assistant_id = assistant_id
        self.message = message
        self.conversation_id = conversation_id
        self.instruction = instruction or []
        self.attachments = attachments or []
        self.timeout = timeout

    def get_assistant_id(self) -> str:
        return self.assistant_id

    def get_agent_id(self) -> str:
        """Backward-compatible accessor for callers using the old name."""
        return self.assistant_id

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
            "assistant_id": self.assistant_id,
            "message": self.message,
        }
        if self.conversation_id:
            body["conversation_id"] = self.conversation_id
        if self.instruction:
            body["instruction"] = self.instruction
        if self.attachments:
            body["attachments"] = self.attachments
        return body

    def to_query_params(self) -> Dict[str, Any]:
        return {}

    def to_options(self, method: str) -> Dict[str, Any]:
        options = super().to_options(method)
        if self.timeout is not None:
            options["timeout"] = self.timeout
        return options

    def validate(self) -> None:
        super().validate()
        if not self.assistant_id or not isinstance(self.assistant_id, str):
            raise ValueError("assistant_id must be a non-empty string")
        if not self.message or not isinstance(self.message, str):
            raise ValueError("message must be a non-empty string")
        if self.conversation_id is not None and not isinstance(self.conversation_id, str):
            raise ValueError("conversation_id must be a string")
        if self.instruction is not None and not isinstance(self.instruction, list):
            raise ValueError("instruction must be a list of dicts")
        if self.attachments is not None and not isinstance(self.attachments, list):
            raise ValueError("attachments must be a list of dicts")


__all__ = ["AssistantExecuteParameter"]
