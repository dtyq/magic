"""
Search Knowledge Result

Result class for knowledge search API response.
"""

import math
from typing import Any, Dict, List

from app.infrastructure.sdk.base import AbstractResult

KNOWLEDGE_SEARCH_DETAIL_SCHEMA_VERSION = 1
KNOWLEDGE_SEARCH_DETAIL_MAX_DOCUMENTS = 20
KNOWLEDGE_SEARCH_DETAIL_MAX_SNIPPETS = 50
KNOWLEDGE_SEARCH_DETAIL_MAX_SNIPPET_CHARS = 2000
KNOWLEDGE_SEARCH_DETAIL_MAX_TOTAL_CHARS = 60000

KNOWLEDGE_SEARCH_EMPTY_MESSAGE = "没有检索到相关知识库内容"


class SearchKnowledgeResult(AbstractResult):
    """Result for knowledge similarity search."""

    def __init__(self, data: Dict[str, Any], query: str = ""):
        self._query_override = query
        super().__init__(data)

    def _parse_data(self) -> None:
        self.query = str(self.get("query") or self.get("query_used") or self._query_override or "")
        documents = self.get("documents", [])
        if isinstance(documents, list):
            self.documents = [
                self._normalize_document(document)
                for document in documents
                if isinstance(document, dict)
            ]
        else:
            self.documents = []

        self.hit_count = sum(len(document["snippets"]) for document in self.documents)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "query": self.query,
            "hit_count": self.hit_count,
            "documents": self.documents,
        }

    def to_tool_detail_data(self) -> Dict[str, Any]:
        """Build structured detail data for the knowledge search tool card."""

        if len(self.documents) == 0:
            return build_knowledge_search_detail_data(
                query=self.query,
                documents=[],
                status="empty",
                message=KNOWLEDGE_SEARCH_EMPTY_MESSAGE,
            )
        return build_knowledge_search_detail_data(
            query=self.query,
            documents=self.documents,
            status="success",
            message=f"已检索到 {len(self.documents)} 个文档、{self.hit_count} 个片段",
        )

    def get_hits(self) -> List[Dict[str, Any]]:
        return self.get_snippets()

    def get_snippets(self) -> List[Dict[str, Any]]:
        return [
            snippet
            for document in self.documents
            for snippet in document["snippets"]
            if isinstance(snippet, dict)
        ]

    def get_documents(self) -> List[Dict[str, Any]]:
        return [document for document in self.documents if isinstance(document, dict)]

    def _normalize_document(self, document: Dict[str, Any]) -> Dict[str, Any]:
        knowledge_code = str(document.get("knowledge_code") or document.get("knowledge_base_code") or "")
        document_file_key = str(document.get("file_key") or "")
        snippets = document.get("snippets", [])
        if isinstance(snippets, list):
            normalized_snippets = [
                self._normalize_snippet(snippet, document_file_key)
                for snippet in snippets
                if isinstance(snippet, dict)
            ]
        else:
            normalized_snippets = []
        if document_file_key == "":
            document_file_key = next(
                (
                    snippet["file_key"]
                    for snippet in normalized_snippets
                    if snippet.get("file_key")
                ),
                "",
            )
        return {
            "knowledge_code": knowledge_code,
            "knowledge_base_id": knowledge_code,
            "knowledge_base_name": str(document.get("knowledge_base_name") or ""),
            "document_code": str(document.get("document_code") or ""),
            "document_name": str(document.get("document_name") or ""),
            "file_key": document_file_key,
            "snippets": normalized_snippets,
        }

    def _normalize_snippet(self, snippet: Dict[str, Any], document_file_key: str = "") -> Dict[str, Any]:
        return {
            "score": _safe_float(snippet.get("score")),
            "word_count": _safe_int(snippet.get("word_count")),
            "text": str(snippet.get("text") or ""),
            "file_key": str(snippet.get("file_key") or document_file_key or ""),
        }


def build_knowledge_search_error_detail_data(
    query: str,
    message: str,
    code: str = "knowledge_search_failed",
) -> Dict[str, Any]:
    return build_knowledge_search_detail_data(
        query=query,
        documents=[],
        status="error",
        message=message,
        error={"code": code, "message": message},
    )


def build_knowledge_search_detail_data(
    query: str,
    documents: List[Dict[str, Any]],
    status: str,
    message: str,
    error: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    shown_documents: List[Dict[str, Any]] = []
    shown_snippet_count = 0
    total_chars = 0
    truncated = False
    snippet_count = sum(
        len(document.get("snippets", []))
        for document in documents
        if isinstance(document, dict) and isinstance(document.get("snippets"), list)
    )

    for document_index, document in enumerate(documents, start=1):
        if len(shown_documents) >= KNOWLEDGE_SEARCH_DETAIL_MAX_DOCUMENTS:
            truncated = True
            break
        if not isinstance(document, dict):
            continue

        shown_snippets: List[Dict[str, Any]] = []
        snippets = document.get("snippets", [])
        if isinstance(snippets, list):
            for snippet_index, snippet in enumerate(snippets, start=1):
                if shown_snippet_count >= KNOWLEDGE_SEARCH_DETAIL_MAX_SNIPPETS:
                    truncated = True
                    break
                if not isinstance(snippet, dict):
                    continue

                text, snippet_truncated = _truncate_detail_text(
                    str(snippet.get("text") or ""),
                    total_chars,
                )
                if snippet_truncated:
                    truncated = True
                if text:
                    total_chars += len(text)
                shown_snippets.append(
                    {
                        "rank": snippet_index,
                        "score": _safe_float(snippet.get("score")),
                        "word_count": _safe_int(snippet.get("word_count")),
                        "text": text,
                        "file_key": str(snippet.get("file_key") or document.get("file_key") or ""),
                        "truncated": snippet_truncated,
                    }
                )
                shown_snippet_count += 1
                if total_chars >= KNOWLEDGE_SEARCH_DETAIL_MAX_TOTAL_CHARS:
                    truncated = True
                    break

        shown_documents.append(
            {
                "rank": document_index,
                "knowledge_code": str(document.get("knowledge_code") or ""),
                "knowledge_base_id": str(document.get("knowledge_code") or ""),
                "knowledge_base_name": str(document.get("knowledge_base_name") or ""),
                "document_code": str(document.get("document_code") or ""),
                "document_name": str(document.get("document_name") or ""),
                "file_key": str(document.get("file_key") or ""),
                "snippets": shown_snippets,
            }
        )
        if shown_snippet_count >= KNOWLEDGE_SEARCH_DETAIL_MAX_SNIPPETS:
            truncated = True
            break
        if total_chars >= KNOWLEDGE_SEARCH_DETAIL_MAX_TOTAL_CHARS:
            truncated = True
            break

    return {
        "schema_version": KNOWLEDGE_SEARCH_DETAIL_SCHEMA_VERSION,
        "status": status,
        "query": str(query or ""),
        "summary": {
            "document_count": len(documents),
            "snippet_count": snippet_count,
            "shown_document_count": len(shown_documents),
            "shown_snippet_count": shown_snippet_count,
            "message": message,
        },
        "documents": shown_documents,
        "truncated": truncated,
        "limits": {
            "max_documents": KNOWLEDGE_SEARCH_DETAIL_MAX_DOCUMENTS,
            "max_snippets": KNOWLEDGE_SEARCH_DETAIL_MAX_SNIPPETS,
            "max_snippet_chars": KNOWLEDGE_SEARCH_DETAIL_MAX_SNIPPET_CHARS,
            "max_total_chars": KNOWLEDGE_SEARCH_DETAIL_MAX_TOTAL_CHARS,
        },
        "error": error,
    }


def _truncate_detail_text(text: str, current_total_chars: int) -> tuple[str, bool]:
    stripped = text.strip()
    truncated = False
    if len(stripped) > KNOWLEDGE_SEARCH_DETAIL_MAX_SNIPPET_CHARS:
        stripped = stripped[:KNOWLEDGE_SEARCH_DETAIL_MAX_SNIPPET_CHARS]
        truncated = True

    remaining = KNOWLEDGE_SEARCH_DETAIL_MAX_TOTAL_CHARS - current_total_chars
    if remaining <= 0:
        return "", True
    if len(stripped) > remaining:
        return stripped[:remaining], True
    return stripped, truncated


def _safe_int(value: Any) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _safe_float(value: Any) -> float:
    try:
        parsed = float(value or 0)
    except (TypeError, ValueError, OverflowError):
        return 0.0
    if not math.isfinite(parsed):
        return 0.0
    return parsed
