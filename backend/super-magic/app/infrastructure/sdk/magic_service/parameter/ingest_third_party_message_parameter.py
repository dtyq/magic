"""
Ingest Third Party Message Parameter

Parameter class for third-party IM inbound message persistence API.
"""

from typing import Any, Dict, Optional

from ..kernel.magic_service_parameter import MagicServiceAbstractParameter


class IngestThirdPartyMessageParameter(MagicServiceAbstractParameter):
    """Parameter for ingest-third-party-message API."""

    def __init__(
        self,
        *,
        authorization: str,
        project_id: str,
        topic_id: str,
        rich_text_content: str,
        topic_pattern: str,
        model_id: str,
        enable_web_search: bool,
        image_model_id: str,
        source_channel: str,
        source_message_id: str,
        source_conversation_id: Optional[str] = None,
        source_sender_id: Optional[str] = None,
    ):
        super().__init__()
        self.authorization = authorization
        self.project_id = project_id
        self.topic_id = topic_id
        self.rich_text_content = rich_text_content
        self.topic_pattern = topic_pattern
        self.model_id = model_id
        self.enable_web_search = enable_web_search
        self.image_model_id = image_model_id
        self.source_channel = source_channel
        self.source_message_id = source_message_id
        self.source_conversation_id = source_conversation_id
        self.source_sender_id = source_sender_id

    def to_body(self) -> Dict[str, Any]:
        body: Dict[str, Any] = {
            "project_id": self.project_id,
            "topic_id": self.topic_id,
            "message_type": "rich_text",
            "message_content": {
                "content": self.rich_text_content,
                "instructs": [{"value": "normal"}],
                "extra": {
                    "super_agent": {
                        "mentions": [],
                        "chat_mode": "normal",
                        "topic_pattern": self.topic_pattern,
                        "model": {"model_id": self.model_id},
                        "enable_web_search": self.enable_web_search,
                        "image_model": {"model_id": self.image_model_id},
                        "source": {
                            "channel": self.source_channel,
                            "message_id": self.source_message_id,
                        },
                    }
                },
            },
        }
        # TODO: sync conversation_id and sender_id when magic-service starts consuming them
        # source = body["message_content"]["extra"]["super_agent"]["source"]
        # if self.source_conversation_id:
        #     source["conversation_id"] = self.source_conversation_id
        # if self.source_sender_id:
        #     source["sender_id"] = self.source_sender_id
        return body

    def to_query_params(self) -> Dict[str, Any]:
        return {}

    def to_headers(self) -> Dict[str, str]:
        headers = {
            "Accept": "*/*",
            "Connection": "keep-alive",
            "Authorization": self.authorization,
        }
        if self._request_id:
            headers["request-id"] = self._request_id
        return headers

    def validate(self) -> None:
        required_fields = {
            "authorization": self.authorization,
            "project_id": self.project_id,
            "topic_id": self.topic_id,
            "rich_text_content": self.rich_text_content,
            "topic_pattern": self.topic_pattern,
            "model_id": self.model_id,
            "image_model_id": self.image_model_id,
            "source_channel": self.source_channel,
            "source_message_id": self.source_message_id,
        }
        for field_name, value in required_fields.items():
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"{field_name} is required")
        if not isinstance(self.enable_web_search, bool):
            raise ValueError("enable_web_search must be a boolean")
