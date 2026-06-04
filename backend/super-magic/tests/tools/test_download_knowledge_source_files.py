import json
from types import SimpleNamespace

import pytest

import app.tools  # noqa: F401
from agentlang.context.tool_context import ToolContext
from app.api.http_dto.knowledge_source_file_download_dto import (
    KnowledgeSourceFileDownloadResponse,
    KnowledgeSourceFileDownloadResult,
)
from app.core.context.agent_context import AgentContext
from app.service.knowledge_source_file_reference_resolver import remember_knowledge_source_file_references
from app.tools.core import tool_factory
from app.tools.download_knowledge_source_files import (
    DownloadKnowledgeSourceFileItem,
    DownloadKnowledgeSourceFiles,
    DownloadKnowledgeSourceFilesParams,
)

tool_factory.register_tool(DownloadKnowledgeSourceFiles)


def test_download_knowledge_source_files_tool_definition():
    tool = DownloadKnowledgeSourceFiles()
    tool_definition = tool.to_param()

    assert tool_definition["function"]["name"] == "download_knowledge_source_files"
    assert "file_key" in tool_definition["function"]["description"]
    file_properties = tool_definition["function"]["parameters"]["properties"]["files"]["items"]["properties"]
    assert set(file_properties) == {"file_key", "file_path"}
    assert tool_definition["function"]["parameters"]["properties"]["files"]["items"]["required"] == ["file_key"]
    assert "search_knowledge" in tool_factory.get_tool_prompt_hint_light("download_knowledge_source_files")


@pytest.mark.asyncio
async def test_download_knowledge_source_files_downloads_to_default_target_dir(monkeypatch):
    calls = []

    class RecordingKnowledgeSourceFileDownloadService:
        def __init__(self, agent_context):
            self.agent_context = agent_context

        async def download_source_files_batch(self, files):
            calls.extend(files)
            return KnowledgeSourceFileDownloadResponse(
                total_count=len(files),
                success_count=1,
                failed_count=0,
                results=[
                    KnowledgeSourceFileDownloadResult(
                        file_key=files[0].file_key,
                        location=files[0].location,
                        success=True,
                        file_size=128,
                    )
                ],
            )

    monkeypatch.setattr(
        "app.tools.download_knowledge_source_files.KnowledgeSourceFileDownloadService",
        RecordingKnowledgeSourceFileDownloadService,
    )

    tool_context = ToolContext()
    agent_context = AgentContext(isolated=True)
    agent_context.set_agent_code("SMA-1")
    remember_knowledge_source_file_references(
        agent_context,
        [
            {
                "file_key": "ORG/files/report.pdf",
                "knowledge_code": "KB1",
                "document_code": "DOC1",
                "document_name": "report.pdf",
            }
        ],
    )
    tool_context.register_extension("agent_context", agent_context)
    result = await DownloadKnowledgeSourceFiles().execute(
        tool_context,
        DownloadKnowledgeSourceFilesParams(
            files=[
                DownloadKnowledgeSourceFileItem(
                    file_key="ORG/files/report.pdf",
                )
            ],
            target_dir="知识库下载验证",
        ),
    )

    assert result.ok
    assert len(calls) == 1
    assert calls[0].file_key == "ORG/files/report.pdf"
    assert calls[0].location == "知识库下载验证/report.pdf"
    assert calls[0].knowledge_code == "KB1"
    assert calls[0].document_code == "DOC1"

    payload = json.loads(result.content)
    assert payload["summary"] == {"total": 1, "success": 1, "failed": 0}
    assert payload["results"][0]["file_path"] == "知识库下载验证/report.pdf"
    assert result.extra_info["success_count"] == 1


@pytest.mark.asyncio
async def test_download_knowledge_source_files_deduplicates_default_same_file_names(monkeypatch):
    calls = []

    class RecordingKnowledgeSourceFileDownloadService:
        def __init__(self, agent_context):
            self.agent_context = agent_context

        async def download_source_files_batch(self, files):
            calls.extend(files)
            return KnowledgeSourceFileDownloadResponse(
                total_count=len(files),
                success_count=len(files),
                failed_count=0,
                results=[
                    KnowledgeSourceFileDownloadResult(
                        file_key=file.file_key,
                        location=file.location,
                        success=True,
                    )
                    for file in files
                ],
            )

    monkeypatch.setattr(
        "app.tools.download_knowledge_source_files.KnowledgeSourceFileDownloadService",
        RecordingKnowledgeSourceFileDownloadService,
    )

    tool_context = ToolContext()
    agent_context = AgentContext(isolated=True)
    agent_context.set_agent_code("SMA-1")
    remember_knowledge_source_file_references(
        agent_context,
        [
            {
                "file_key": "ORG/a/source.pdf",
                "knowledge_code": "KB1",
                "document_code": "DOC1",
            },
            {
                "file_key": "ORG/b/source.pdf",
                "knowledge_code": "KB1",
                "document_code": "DOC2",
            },
        ],
    )
    tool_context.register_extension("agent_context", agent_context)

    result = await DownloadKnowledgeSourceFiles().execute(
        tool_context,
        DownloadKnowledgeSourceFilesParams(
            files=[
                DownloadKnowledgeSourceFileItem(file_key="ORG/a/source.pdf"),
                DownloadKnowledgeSourceFileItem(file_key="ORG/b/source.pdf"),
            ],
            target_dir="知识库下载验证",
        ),
    )

    assert result.ok
    assert [item.location for item in calls] == [
        "知识库下载验证/source.pdf",
        "知识库下载验证/source (2).pdf",
    ]


@pytest.mark.asyncio
async def test_download_knowledge_source_files_rejects_duplicate_explicit_file_paths(monkeypatch):
    calls = []

    class RecordingKnowledgeSourceFileDownloadService:
        def __init__(self, agent_context):
            calls.append(agent_context)

        async def download_source_files_batch(self, files):
            raise AssertionError("download service should not be called")

    monkeypatch.setattr(
        "app.tools.download_knowledge_source_files.KnowledgeSourceFileDownloadService",
        RecordingKnowledgeSourceFileDownloadService,
    )

    tool_context = ToolContext()
    agent_context = AgentContext(isolated=True)
    agent_context.set_agent_code("SMA-1")
    remember_knowledge_source_file_references(
        agent_context,
        [
            {
                "file_key": "ORG/a/source.pdf",
                "knowledge_code": "KB1",
                "document_code": "DOC1",
            },
            {
                "file_key": "ORG/b/source.pdf",
                "knowledge_code": "KB1",
                "document_code": "DOC2",
            },
        ],
    )
    tool_context.register_extension("agent_context", agent_context)

    result = await DownloadKnowledgeSourceFiles().execute(
        tool_context,
        DownloadKnowledgeSourceFilesParams(
            files=[
                DownloadKnowledgeSourceFileItem(
                    file_key="ORG/a/source.pdf",
                    file_path="知识库下载验证/source.pdf",
                ),
                DownloadKnowledgeSourceFileItem(
                    file_key="ORG/b/source.pdf",
                    file_path="/知识库下载验证/source.pdf",
                ),
            ],
        ),
    )

    assert not result.ok
    assert "相同的 file_path" in result.content
    assert calls == []


@pytest.mark.asyncio
async def test_download_knowledge_source_files_reports_failed_items(monkeypatch):
    class FailingKnowledgeSourceFileDownloadService:
        def __init__(self, agent_context):
            self.agent_context = agent_context

        async def download_source_files_batch(self, files):
            return KnowledgeSourceFileDownloadResponse(
                total_count=len(files),
                success_count=0,
                failed_count=1,
                results=[
                    KnowledgeSourceFileDownloadResult(
                        file_key=files[0].file_key,
                        location=files[0].location,
                        success=False,
                        error_message="not found",
                    )
                ],
            )

    monkeypatch.setattr(
        "app.tools.download_knowledge_source_files.KnowledgeSourceFileDownloadService",
        FailingKnowledgeSourceFileDownloadService,
    )

    tool_context = ToolContext()
    agent_context = AgentContext(isolated=True)
    agent_context.set_agent_code("SMA-1")
    remember_knowledge_source_file_references(
        agent_context,
        [
            {
                "file_key": "missing-key",
                "knowledge_code": "KB1",
                "document_code": "DOC1",
                "document_name": "missing.md",
            }
        ],
    )
    tool_context.register_extension("agent_context", agent_context)
    result = await DownloadKnowledgeSourceFiles().execute(
        tool_context,
        DownloadKnowledgeSourceFilesParams(
            files=[
                DownloadKnowledgeSourceFileItem(
                    file_key="missing-key",
                    file_path="知识库下载验证/missing.md",
                )
            ],
        ),
    )

    assert result.ok
    payload = json.loads(result.content)
    assert payload["summary"] == {"total": 1, "success": 0, "failed": 1}
    assert payload["results"][0]["status"] == "failed"
    assert payload["results"][0]["error"] == "not found"


def test_download_knowledge_source_files_only_requires_file_key():
    item = DownloadKnowledgeSourceFileItem(file_key=" ORG/files/report.pdf ")

    assert item.file_key == "ORG/files/report.pdf"

    with pytest.raises(ValueError):
        DownloadKnowledgeSourceFileItem(file_key=" ")


@pytest.mark.asyncio
async def test_download_knowledge_source_files_recovers_reference_from_chat_history(monkeypatch):
    calls = []

    class RecordingKnowledgeSourceFileDownloadService:
        def __init__(self, agent_context):
            self.agent_context = agent_context

        async def download_source_files_batch(self, files):
            calls.extend(files)
            return KnowledgeSourceFileDownloadResponse(
                total_count=len(files),
                success_count=1,
                failed_count=0,
                results=[
                    KnowledgeSourceFileDownloadResult(
                        file_key=files[0].file_key,
                        location=files[0].location,
                        success=True,
                    )
                ],
            )

    monkeypatch.setattr(
        "app.tools.download_knowledge_source_files.KnowledgeSourceFileDownloadService",
        RecordingKnowledgeSourceFileDownloadService,
    )

    tool_context = ToolContext()
    agent_context = AgentContext(isolated=True)
    agent_context.set_agent_code("SMA-1")
    agent_context.chat_history = SimpleNamespace(
        messages=[
            {
                "role": "assistant",
                "tool_calls": [
                    {
                        "id": "call-search-1",
                        "type": "function",
                        "function": {"name": "search_knowledge", "arguments": "{}"},
                    }
                ],
            },
            {
                "role": "tool",
                "tool_call_id": "call-search-1",
                "content": json.dumps(
                    {
                        "hit_count": 1,
                        "documents": [
                            {
                                "file_key": "ORG/files/recovered.pdf",
                                "knowledge_code": "KB-HISTORY",
                                "document_code": "DOC-HISTORY",
                                "document_name": "recovered.pdf",
                                "snippets": [],
                            }
                        ],
                    }
                ),
            },
        ]
    )
    tool_context.register_extension("agent_context", agent_context)

    result = await DownloadKnowledgeSourceFiles().execute(
        tool_context,
        DownloadKnowledgeSourceFilesParams(
            files=[DownloadKnowledgeSourceFileItem(file_key="ORG/files/recovered.pdf")]
        ),
    )

    assert result.ok
    assert len(calls) == 1
    assert calls[0].knowledge_code == "KB-HISTORY"
    assert calls[0].document_code == "DOC-HISTORY"


@pytest.mark.asyncio
async def test_download_knowledge_source_files_fails_without_recent_search(monkeypatch):
    calls = []

    class RecordingKnowledgeSourceFileDownloadService:
        def __init__(self, agent_context):
            calls.append(agent_context)

        async def download_source_files_batch(self, files):
            raise AssertionError("download service should not be called")

    monkeypatch.setattr(
        "app.tools.download_knowledge_source_files.KnowledgeSourceFileDownloadService",
        RecordingKnowledgeSourceFileDownloadService,
    )

    tool_context = ToolContext()
    agent_context = AgentContext(isolated=True)
    agent_context.set_agent_code("SMA-1")
    tool_context.register_extension("agent_context", agent_context)

    result = await DownloadKnowledgeSourceFiles().execute(
        tool_context,
        DownloadKnowledgeSourceFilesParams(
            files=[DownloadKnowledgeSourceFileItem(file_key="ORG/files/missing.pdf")]
        ),
    )

    assert not result.ok
    assert "search_knowledge" in result.content
    assert calls == []


@pytest.mark.asyncio
async def test_download_knowledge_source_files_does_not_recover_from_stale_history(monkeypatch):
    calls = []

    class RecordingKnowledgeSourceFileDownloadService:
        def __init__(self, agent_context):
            calls.append(agent_context)

        async def download_source_files_batch(self, files):
            raise AssertionError("download service should not be called")

    monkeypatch.setattr(
        "app.tools.download_knowledge_source_files.KnowledgeSourceFileDownloadService",
        RecordingKnowledgeSourceFileDownloadService,
    )

    tool_context = ToolContext()
    agent_context = AgentContext(isolated=True)
    agent_context.set_agent_code("SMA-1")
    agent_context.chat_history = SimpleNamespace(
        messages=[
            {
                "role": "assistant",
                "tool_calls": [
                    {
                        "id": "call-search-old",
                        "type": "function",
                        "function": {"name": "search_knowledge", "arguments": "{}"},
                    }
                ],
            },
            {
                "role": "tool",
                "tool_call_id": "call-search-old",
                "content": json.dumps(
                    {
                        "documents": [
                            {
                                "file_key": "ORG/files/stale.pdf",
                                "knowledge_code": "KB-OLD",
                                "document_code": "DOC-OLD",
                            }
                        ],
                    }
                ),
            },
            {
                "role": "assistant",
                "tool_calls": [
                    {
                        "id": "call-search-new",
                        "type": "function",
                        "function": {"name": "search_knowledge", "arguments": "{}"},
                    }
                ],
            },
            {
                "role": "tool",
                "tool_call_id": "call-search-new",
                "content": "Knowledge search failed",
            },
        ]
    )
    tool_context.register_extension("agent_context", agent_context)

    result = await DownloadKnowledgeSourceFiles().execute(
        tool_context,
        DownloadKnowledgeSourceFilesParams(
            files=[DownloadKnowledgeSourceFileItem(file_key="ORG/files/stale.pdf")]
        ),
    )

    assert not result.ok
    assert "search_knowledge" in result.content
    assert calls == []


@pytest.mark.asyncio
async def test_download_knowledge_source_files_does_not_use_history_when_runtime_index_exists(monkeypatch):
    calls = []

    class RecordingKnowledgeSourceFileDownloadService:
        def __init__(self, agent_context):
            calls.append(agent_context)

        async def download_source_files_batch(self, files):
            raise AssertionError("download service should not be called")

    monkeypatch.setattr(
        "app.tools.download_knowledge_source_files.KnowledgeSourceFileDownloadService",
        RecordingKnowledgeSourceFileDownloadService,
    )

    tool_context = ToolContext()
    agent_context = AgentContext(isolated=True)
    agent_context.set_agent_code("SMA-1")
    remember_knowledge_source_file_references(
        agent_context,
        [
            {
                "file_key": "ORG/files/current.pdf",
                "knowledge_code": "KB-CURRENT",
                "document_code": "DOC-CURRENT",
            }
        ],
    )
    agent_context.chat_history = SimpleNamespace(
        messages=[
            {
                "role": "assistant",
                "tool_calls": [
                    {
                        "id": "call-search-old",
                        "type": "function",
                        "function": {"name": "search_knowledge", "arguments": "{}"},
                    }
                ],
            },
            {
                "role": "tool",
                "tool_call_id": "call-search-old",
                "content": json.dumps(
                    {
                        "documents": [
                            {
                                "file_key": "ORG/files/stale.pdf",
                                "knowledge_code": "KB-OLD",
                                "document_code": "DOC-OLD",
                            }
                        ],
                    }
                ),
            },
        ]
    )
    tool_context.register_extension("agent_context", agent_context)

    result = await DownloadKnowledgeSourceFiles().execute(
        tool_context,
        DownloadKnowledgeSourceFilesParams(
            files=[DownloadKnowledgeSourceFileItem(file_key="ORG/files/stale.pdf")]
        ),
    )

    assert not result.ok
    assert "search_knowledge" in result.content
    assert calls == []


@pytest.mark.asyncio
async def test_download_knowledge_source_files_fails_on_ambiguous_file_key(monkeypatch):
    calls = []

    class RecordingKnowledgeSourceFileDownloadService:
        def __init__(self, agent_context):
            calls.append(agent_context)

        async def download_source_files_batch(self, files):
            raise AssertionError("download service should not be called")

    monkeypatch.setattr(
        "app.tools.download_knowledge_source_files.KnowledgeSourceFileDownloadService",
        RecordingKnowledgeSourceFileDownloadService,
    )

    tool_context = ToolContext()
    agent_context = AgentContext(isolated=True)
    agent_context.set_agent_code("SMA-1")
    remember_knowledge_source_file_references(
        agent_context,
        [
            {
                "file_key": "ORG/files/shared.pdf",
                "knowledge_code": "KB1",
                "document_code": "DOC1",
            },
            {
                "file_key": "ORG/files/shared.pdf",
                "knowledge_code": "KB2",
                "document_code": "DOC2",
            },
        ],
    )
    tool_context.register_extension("agent_context", agent_context)

    result = await DownloadKnowledgeSourceFiles().execute(
        tool_context,
        DownloadKnowledgeSourceFilesParams(
            files=[DownloadKnowledgeSourceFileItem(file_key="ORG/files/shared.pdf")]
        ),
    )

    assert not result.ok
    assert "多个知识库文档" in result.content
    assert calls == []


@pytest.mark.asyncio
async def test_download_knowledge_source_files_requires_agent_context():
    result = await DownloadKnowledgeSourceFiles().execute(
        ToolContext(),
        DownloadKnowledgeSourceFilesParams(
            files=[
                DownloadKnowledgeSourceFileItem(
                    file_key="ORG/files/report.pdf",
                )
            ]
        ),
    )

    assert not result.ok
    assert "not supported" in result.content
