"""Resolve knowledge source file references returned by search_knowledge."""

import json
from dataclasses import dataclass
from typing import Any

from app.core.context.agent_context import AgentContext

_RUNTIME_INDEX_ATTR = "_knowledge_source_file_reference_index"


class KnowledgeSourceFileReferenceError(ValueError):
    """Base error for knowledge source file reference resolution."""


class KnowledgeSourceFileReferenceNotFound(KnowledgeSourceFileReferenceError):
    """Raised when a file_key is not found in recent knowledge search results."""


class KnowledgeSourceFileReferenceAmbiguous(KnowledgeSourceFileReferenceError):
    """Raised when a file_key maps to multiple knowledge documents."""


@dataclass(frozen=True)
class KnowledgeSourceFileReference:
    file_key: str
    knowledge_code: str
    document_code: str
    document_name: str = ""


class KnowledgeSourceFileReferenceIndex:
    """Latest search_knowledge source-file references."""

    def __init__(self) -> None:
        self._references_by_file_key: dict[str, list[KnowledgeSourceFileReference]] = {}

    @classmethod
    def from_documents(cls, documents: list[dict[str, Any]]) -> "KnowledgeSourceFileReferenceIndex":
        index = cls()
        for document in documents:
            if not isinstance(document, dict):
                continue
            file_key = str(document.get("file_key") or "").strip()
            knowledge_code = str(document.get("knowledge_code") or "").strip()
            document_code = str(document.get("document_code") or "").strip()
            if not file_key or not knowledge_code or not document_code:
                continue
            index.add(
                KnowledgeSourceFileReference(
                    file_key=file_key,
                    knowledge_code=knowledge_code,
                    document_code=document_code,
                    document_name=str(document.get("document_name") or "").strip(),
                )
            )
        return index

    @classmethod
    def from_search_result_content(cls, content: str) -> "KnowledgeSourceFileReferenceIndex | None":
        try:
            payload = json.loads(content)
        except (TypeError, json.JSONDecodeError):
            return None
        if not isinstance(payload, dict):
            return None
        documents = payload.get("documents")
        if not isinstance(documents, list):
            return None
        return cls.from_documents(documents)

    def add(self, reference: KnowledgeSourceFileReference) -> None:
        references = self._references_by_file_key.setdefault(reference.file_key, [])
        if any(_same_reference(existing, reference) for existing in references):
            return
        references.append(reference)

    def resolve(self, file_key: str) -> KnowledgeSourceFileReference:
        normalized = file_key.strip()
        references = self._references_by_file_key.get(normalized) or []
        if not references:
            raise KnowledgeSourceFileReferenceNotFound(
                "未找到 file_key 对应的知识库检索结果，请先调用 search_knowledge 后再下载知识库源文件。"
            )
        if len(references) > 1:
            raise KnowledgeSourceFileReferenceAmbiguous(
                "file_key 对应多个知识库文档，请重新调用 search_knowledge 并选择更明确的结果。"
            )
        return references[0]


def remember_knowledge_source_file_references(
    agent_context: AgentContext,
    documents: list[dict[str, Any]],
) -> KnowledgeSourceFileReferenceIndex:
    """Store the latest search_knowledge source-file references on the agent context."""

    index = KnowledgeSourceFileReferenceIndex.from_documents(documents)
    setattr(agent_context, _RUNTIME_INDEX_ATTR, index)
    return index


def clear_knowledge_source_file_references(agent_context: AgentContext) -> None:
    """Clear latest search_knowledge source-file references."""

    setattr(agent_context, _RUNTIME_INDEX_ATTR, KnowledgeSourceFileReferenceIndex())


def resolve_knowledge_source_file_reference(
    agent_context: AgentContext,
    file_key: str,
) -> KnowledgeSourceFileReference:
    """Resolve file_key from runtime memory, then from persisted chat history."""

    normalized = file_key.strip()
    index = getattr(agent_context, _RUNTIME_INDEX_ATTR, None)
    if isinstance(index, KnowledgeSourceFileReferenceIndex):
        return index.resolve(normalized)

    recovered_index = recover_latest_knowledge_source_file_index(agent_context)
    if recovered_index is not None:
        setattr(agent_context, _RUNTIME_INDEX_ATTR, recovered_index)
        return recovered_index.resolve(normalized)

    raise KnowledgeSourceFileReferenceNotFound(
        "未找到 file_key 对应的知识库检索结果，请先调用 search_knowledge 后再下载知识库源文件。"
    )


def recover_latest_knowledge_source_file_index(
    agent_context: AgentContext,
) -> KnowledgeSourceFileReferenceIndex | None:
    chat_history = getattr(agent_context, "chat_history", None)
    messages = getattr(chat_history, "messages", None)
    if not isinstance(messages, list) or not messages:
        return None

    search_tool_call_ids = _collect_search_knowledge_tool_call_ids(messages)
    if not search_tool_call_ids:
        return None

    for message in reversed(messages):
        if _message_role(message) != "tool":
            continue
        tool_call_id = _message_tool_call_id(message)
        if tool_call_id not in search_tool_call_ids:
            continue
        return KnowledgeSourceFileReferenceIndex.from_search_result_content(_message_content(message))
    return None


def _collect_search_knowledge_tool_call_ids(messages: list[Any]) -> set[str]:
    tool_call_ids: set[str] = set()
    for message in messages:
        if _message_role(message) != "assistant":
            continue
        for tool_call in _message_tool_calls(message):
            tool_call_id = _tool_call_id(tool_call)
            if tool_call_id and _tool_call_name(tool_call) == "search_knowledge":
                tool_call_ids.add(tool_call_id)
    return tool_call_ids


def _message_role(message: Any) -> str:
    if isinstance(message, dict):
        return str(message.get("role") or "")
    return str(getattr(message, "role", "") or "")


def _message_content(message: Any) -> str:
    if isinstance(message, dict):
        return str(message.get("content") or "")
    return str(getattr(message, "content", "") or "")


def _message_tool_call_id(message: Any) -> str:
    if isinstance(message, dict):
        return str(message.get("tool_call_id") or "")
    return str(getattr(message, "tool_call_id", "") or "")


def _message_tool_calls(message: Any) -> list[Any]:
    if isinstance(message, dict):
        tool_calls = message.get("tool_calls")
    else:
        tool_calls = getattr(message, "tool_calls", None)
    return tool_calls if isinstance(tool_calls, list) else []


def _tool_call_id(tool_call: Any) -> str:
    if isinstance(tool_call, dict):
        return str(tool_call.get("id") or "")
    return str(getattr(tool_call, "id", "") or "")


def _tool_call_name(tool_call: Any) -> str:
    if isinstance(tool_call, dict):
        function = tool_call.get("function")
    else:
        function = getattr(tool_call, "function", None)
    if isinstance(function, dict):
        return str(function.get("name") or "")
    return str(getattr(function, "name", "") or "")


def _same_reference(
    left: KnowledgeSourceFileReference,
    right: KnowledgeSourceFileReference,
) -> bool:
    return (
        left.knowledge_code == right.knowledge_code
        and left.document_code == right.document_code
        and left.file_key == right.file_key
    )
