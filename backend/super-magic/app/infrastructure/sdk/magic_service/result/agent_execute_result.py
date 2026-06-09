"""
Agent Execute Result

Result wrapper for agent execute API response.
"""

import json
from typing import Any, Dict, List, Optional

from app.infrastructure.sdk.base import AbstractResult


class AgentExecuteResult(AbstractResult):
    """Result for agent execute API"""

    def __init__(self, data: Dict[str, Any]):
        super().__init__(data)

    def _parse_data(self) -> None:
        """Parse raw API response into structured fields.

        Magic Service standard envelope:
            { "code": 1000, "message": "ok", "data": { "messages": [...], "conversation_id": "..." } }
        AbstractResult.get(...) reads from data.* automatically.
        """
        messages = self.get('messages')
        self.messages: List[Dict[str, Any]] = messages if isinstance(messages, list) else []
        self.conversation_id: str = self.get('conversation_id') or ''

    def get_messages(self) -> List[Dict[str, Any]]:
        return self.messages

    def get_conversation_id(self) -> str:
        return self.conversation_id

    def has_messages(self) -> bool:
        return len(self.messages) > 0

    def to_string(self) -> str:
        """Render messages into a single string for LLM tool result.

        Each message keeps the original raw structure; for human-readable
        downstream usage (LLM context), join all `content` fields when present.
        Falls back to the full JSON dump otherwise.
        """
        if not self.messages:
            return ''

        text_parts: List[str] = []
        for msg in self.messages:
            if not isinstance(msg, dict):
                continue
            content = msg.get('content')
            if isinstance(content, str) and content:
                text_parts.append(content)
                continue
            # nested {"content": {"text": ...}} or other shapes — dump as JSON
            text_parts.append(json.dumps(msg, ensure_ascii=False))

        return '\n'.join(text_parts)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'messages': self.messages,
            'conversation_id': self.conversation_id,
        }

    def __str__(self) -> str:
        if self.has_messages():
            preview = self.to_string()
            if len(preview) > 80:
                preview = preview[:80] + '...'
            return f"AgentExecuteResult(conversation_id={self.conversation_id}, preview={preview})"
        return "AgentExecuteResult: No messages"
