"""
Search Knowledge Result

Result class for knowledge search API response.
"""

from typing import Any, Dict, List

from app.infrastructure.sdk.base import AbstractResult


class SearchKnowledgeResult(AbstractResult):
    """Result for knowledge similarity search."""

    def _parse_data(self) -> None:
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
            "hit_count": self.hit_count,
            "documents": self.documents,
        }

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
        snippets = document.get("snippets", [])
        if isinstance(snippets, list):
            normalized_snippets = [
                self._normalize_snippet(snippet)
                for snippet in snippets
                if isinstance(snippet, dict)
            ]
        else:
            normalized_snippets = []
        return {
            "knowledge_code": str(document.get("knowledge_code") or ""),
            "document_code": str(document.get("document_code") or ""),
            "document_name": str(document.get("document_name") or ""),
            "snippets": normalized_snippets,
        }

    def _normalize_snippet(self, snippet: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "score": float(snippet.get("score") or 0),
            "text": str(snippet.get("text") or ""),
        }
