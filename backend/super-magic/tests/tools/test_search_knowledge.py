import json

import app.tools  # noqa: F401
import pytest

from app.infrastructure.sdk.magic_service.api.agent_api import AgentApi
from app.infrastructure.sdk.magic_service.parameter import SearchKnowledgeParameter
from app.infrastructure.sdk.magic_service.result import SearchKnowledgeResult
from app.tools.core import tool_factory
from app.tools.search_knowledge import SearchKnowledge


def test_search_knowledge_tool_definition_uses_knowledge_wording():
    tool = SearchKnowledge()
    tool_definition = tool.to_param()

    assert tool_definition["function"]["name"] == "search_knowledge"

    description = tool_definition["function"]["description"]
    query_description = tool_definition["function"]["parameters"]["properties"]["query"]["description"]

    assert "Search the knowledge base for knowledge and related context" in description
    assert "Query used for knowledge search." in query_description
    assert "digital employee" not in description
    assert "memory" not in query_description


def test_search_knowledge_prompt_hint_covers_trigger_and_fallback_rules():
    hint = tool_factory.get_tool_prompt_hint_light("search_knowledge")

    assert hint
    assert "Use `search_knowledge` when you are unsure" in hint
    assert "If the user says" in hint
    assert "No relevant knowledge context was found." in hint
    assert "related knowledge context may help" in hint
    assert '"知识库现在有哪些 bug"' in hint
    assert '"写一个 Go 并发示例"' in hint


@pytest.mark.asyncio
async def test_search_knowledge_sdk_uses_get_path_and_query_params():
    class RecordingAgentApi(AgentApi):
        def __init__(self):
            self.call = None

        async def request_by_parameter_async(self, parameter, method: str, endpoint_path: str):
            self.call = (parameter, method, endpoint_path)
            return {
                "hit_count": 0,
                "documents": [],
            }

    api = RecordingAgentApi()
    parameter = SearchKnowledgeParameter(agent_code="SMA/a b?", query="hello")

    result = await api.search_knowledge_async(parameter)

    assert result.to_dict() == {
        "hit_count": 0,
        "documents": [],
    }
    assert api.call == (
        parameter,
        "GET",
        "/api/v1/open-api/sandbox/knowledge/agents/SMA%2Fa%20b%3F/similarity",
    )
    assert parameter.to_query_params() == {"query": "hello"}
    assert parameter.to_body() == {}


def test_search_knowledge_result_uses_documents_shape():
    result = SearchKnowledgeResult(
        {
            "hit_count": 99,
            "context_text": "should not be returned",
            "documents": [
                {
                    "knowledge_code": "KB",
                    "document_code": "DOC",
                    "document_name": "demo.md",
                    "citation_id": "ignored",
                    "metadata": {"ignored": True},
                    "snippets": [
                        {
                            "score": 0.55,
                            "text": "hello",
                            "citation_id": "ignored",
                            "metadata": {"ignored": True},
                        },
                        {
                            "score": 0.45,
                            "text": "world",
                        },
                    ],
                }
            ],
        }
    )

    payload = result.to_dict()

    assert payload == {
        "hit_count": 2,
        "documents": [
            {
                "knowledge_code": "KB",
                "document_code": "DOC",
                "document_name": "demo.md",
                "snippets": [
                    {
                        "score": 0.55,
                        "text": "hello",
                    },
                    {
                        "score": 0.45,
                        "text": "world",
                    },
                ],
            }
        ],
    }
    serialized = result.to_string()
    serialized_payload = json.loads(serialized)

    assert "snippets" not in serialized_payload
    assert "query_used" not in serialized
    assert "context_text" not in serialized
    assert '"hits"' not in serialized
    assert "metadata" not in serialized
    assert "citation_id" not in serialized


def test_search_knowledge_result_ignores_legacy_flat_snippets():
    result = SearchKnowledgeResult(
        {
            "hit_count": 99,
            "snippets": [
                {
                    "knowledge_code": "KB",
                    "document_code": "DOC",
                    "document_name": "demo.md",
                    "score": 0.55,
                    "text": "ignored legacy flat snippet",
                }
            ],
        }
    )

    assert result.to_dict() == {
        "hit_count": 0,
        "documents": [],
    }
