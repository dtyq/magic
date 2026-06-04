from pathlib import Path

import pytest

from app.api.http_dto.knowledge_source_file_download_dto import KnowledgeSourceFileDownloadItem
from app.service.knowledge_source_file_download_service import KnowledgeSourceFileDownloadService


class FakeConfig:
    api_base_url = "http://magic.test/"


class FakeStorage:
    def __init__(self):
        self.credentials = object()
        self.uploads = []

    async def upload(self, file, key):
        self.uploads.append((file, key))

    async def exists(self, key):
        raise AssertionError(f"direct storage exists should not be called: {key}")

    async def download(self, key, options=None):
        raise AssertionError(f"direct storage download should not be called: {key}")


class FakeAgentContext:
    def __init__(self, metadata):
        self._metadata = metadata

    def get_metadata(self):
        if isinstance(self._metadata, Exception):
            raise self._metadata
        return self._metadata


@pytest.mark.asyncio
async def test_register_downloaded_workspace_file_creates_directory_and_saves_project_file(
    monkeypatch,
    tmp_path,
):
    target_file = tmp_path / "ES搜索技术方案 - 后端.md"
    target_file.write_text("content", encoding="utf-8")
    storage = FakeStorage()
    requests = []

    service = KnowledgeSourceFileDownloadService(
        FakeAgentContext(
            {
                "project_id": "918511599620259841",
                "topic_id": "918513319985348610",
                "super_magic_task_id": "918528274134532097",
            }
        )
    )
    service.storage_service = storage

    async def fake_request(method, api_url, payload=None):
        requests.append((method, api_url, payload))
        if api_url.endswith("/api/v1/super-agent/file"):
            return {"code": 1000, "data": {"file_id": "dir_1"}}
        if api_url.endswith("/api/v1/super-agent/file/project/save"):
            return {
                "code": 1000,
                "data": {
                    "file_id": "file_1",
                    "relative_file_path": "知识库下载验证/ES搜索技术方案 - 后端.md",
                },
            }
        raise AssertionError(f"unexpected request url: {api_url}")

    monkeypatch.setattr(
        "app.service.knowledge_source_file_download_service.get_remote_workspace_dir",
        lambda credentials: "DT001/project_1/workspace/",
    )
    monkeypatch.setattr(
        "app.service.knowledge_source_file_download_service.MagicServiceConfigLoader.load_with_fallback",
        lambda: FakeConfig(),
    )
    monkeypatch.setattr(service, "request_magic_service_json", fake_request)

    result = await service.register_downloaded_workspace_file(
        "知识库下载验证/ES搜索技术方案 - 后端.md",
        target_file,
        target_file.stat().st_size,
    )

    assert result is not None
    assert result.workspace_file_key == "DT001/project_1/workspace/知识库下载验证/ES搜索技术方案 - 后端.md"
    assert result.project_file_id == "file_1"
    assert result.relative_path == "知识库下载验证/ES搜索技术方案 - 后端.md"
    assert storage.uploads == [
        (str(target_file), "DT001/project_1/workspace/知识库下载验证/ES搜索技术方案 - 后端.md")
    ]
    assert requests[0][2] == {
        "project_id": "918511599620259841",
        "parent_id": "",
        "file_name": "知识库下载验证",
        "is_directory": True,
        "ignore_duplicate": True,
        "pre_file_id": -1,
    }
    assert requests[1][2]["parent_id"] == "dir_1"
    assert requests[1][2]["file_key"] == "DT001/project_1/workspace/知识库下载验证/ES搜索技术方案 - 后端.md"
    assert requests[1][2]["file_name"] == "ES搜索技术方案 - 后端.md"


@pytest.mark.asyncio
async def test_register_downloaded_workspace_file_skips_without_metadata():
    service = KnowledgeSourceFileDownloadService(FakeAgentContext(RuntimeError("missing metadata")))

    result = await service.register_downloaded_workspace_file(
        "知识库下载验证/report.md",
        Path("/tmp/report.md"),
        1,
    )

    assert result is None


@pytest.mark.asyncio
async def test_download_source_file_uses_sandbox_knowledge_source_endpoint(monkeypatch, tmp_path):
    service = KnowledgeSourceFileDownloadService(
        FakeAgentContext(
            {
                "project_id": "project_1",
                "topic_id": "topic_1",
                "super_magic_task_id": "task_1",
            }
        )
    )
    service.storage_service = FakeStorage()
    requests = []

    monkeypatch.setattr(
        "app.service.knowledge_source_file_download_service.PathManager.get_workspace_dir",
        lambda: tmp_path,
    )

    async def fake_request(method, api_url, payload=None):
        requests.append((method, api_url, payload))
        assert api_url.endswith("/go/api/v1/knowledge-bases/KB1/documents/DOC1/source-file-link")
        return {
            "code": 1000,
            "data": {
                "available": True,
                "url": "https://download.test/source.pdf",
                "name": "source.pdf",
                "file_key": "ORG/files/source.pdf",
                "type": "external",
            },
        }

    async def fake_download_url_to_path(download_url, target_path):
        assert download_url == "https://download.test/source.pdf"
        target_path.write_bytes(b"source")
        return 6

    async def fake_build_success_result(file_key, location, target_path, file_size):
        assert target_path == tmp_path / "知识库下载验证/source.pdf"
        assert file_size == 6
        from app.api.http_dto.knowledge_source_file_download_dto import KnowledgeSourceFileDownloadResult

        return KnowledgeSourceFileDownloadResult(file_key=file_key, location=location, success=True, file_size=file_size)

    monkeypatch.setattr(
        "app.service.knowledge_source_file_download_service.MagicServiceConfigLoader.load_with_fallback",
        lambda: FakeConfig(),
    )
    monkeypatch.setattr(service, "request_magic_service_json", fake_request)
    monkeypatch.setattr(service, "download_url_to_path", fake_download_url_to_path)
    monkeypatch.setattr(service, "build_success_result", fake_build_success_result)

    result = await service.download_source_file(
        file_key="ORG/files/source.pdf",
        location="知识库下载验证/source.pdf",
        knowledge_code="KB1",
        document_code="DOC1",
    )

    assert result.success
    assert requests == [
        (
            "POST",
            "http://magic.test/go/api/v1/knowledge-bases/KB1/documents/DOC1/source-file-link",
            {
                "file_key": "ORG/files/source.pdf",
            },
        )
    ]


@pytest.mark.asyncio
async def test_download_source_file_does_not_fallback_after_source_endpoint_failure(monkeypatch, tmp_path):
    service = KnowledgeSourceFileDownloadService(FakeAgentContext({"project_id": "project_1"}))
    service.storage_service = FakeStorage()
    requests = []

    monkeypatch.setattr(
        "app.service.knowledge_source_file_download_service.PathManager.get_workspace_dir",
        lambda: tmp_path,
    )
    monkeypatch.setattr(
        "app.service.knowledge_source_file_download_service.MagicServiceConfigLoader.load_with_fallback",
        lambda: FakeConfig(),
    )

    async def fake_request(method, api_url, payload=None):
        requests.append((method, api_url, payload))
        raise RuntimeError("permission denied")

    monkeypatch.setattr(service, "request_magic_service_json", fake_request)

    result = await service.download_source_file(
        file_key="ORG/files/source.pdf",
        location="知识库下载验证/source.pdf",
        knowledge_code="KB1",
        document_code="DOC1",
    )

    assert not result.success
    assert "permission denied" in result.error_message
    assert len(requests) == 1
    assert requests[0][1].endswith("/go/api/v1/knowledge-bases/KB1/documents/DOC1/source-file-link")


def test_download_item_requires_knowledge_source_fields():
    with pytest.raises(ValueError):
        KnowledgeSourceFileDownloadItem(
            knowledge_code="KB1",
            document_code="",
            file_key="ORG/files/source.pdf",
            location="知识库下载验证/source.pdf",
        )


def test_safe_target_path_rejects_workspace_prefix_sibling(monkeypatch, tmp_path):
    workspace_dir = tmp_path / "workspace"
    workspace_dir.mkdir()
    (tmp_path / "workspace_evil").mkdir()
    service = KnowledgeSourceFileDownloadService(FakeAgentContext({}))

    monkeypatch.setattr(
        "app.service.knowledge_source_file_download_service.PathManager.get_workspace_dir",
        lambda: workspace_dir,
    )

    with pytest.raises(ValueError):
        service._get_safe_target_path("../workspace_evil/source.pdf")


def test_build_magic_service_headers_includes_user_auth_and_organization(monkeypatch):
    service = KnowledgeSourceFileDownloadService(FakeAgentContext({}))

    monkeypatch.setattr(
        "app.service.knowledge_source_file_download_service.InitClientMessageUtil.get_full_config",
        lambda: {
            "message_subscription_config": {
                "headers": {
                    "token": "message-token",
                },
            },
            "metadata": {
                "authorization": "user-token",
                "organization_code": "DT001",
                "user_id": "usi_1",
            },
        },
    )

    headers = service.build_magic_service_headers()

    assert headers["token"] == "message-token"
    assert headers["Organization-Code"] == "DT001"
    assert headers["user-id"] == "usi_1"
    assert headers["user-authorization"] == "user-token"
    assert headers["Authorization"] == "user-token"
