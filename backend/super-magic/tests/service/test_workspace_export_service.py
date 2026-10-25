from unittest.mock import AsyncMock

import pytest

from app.service import workspace_export_service


@pytest.mark.asyncio
async def test_workspace_export_dispatches_slides_template_creator(monkeypatch, tmp_path):
    template_dir = tmp_path / "templates" / "SLIDE-business-report"
    template_dir.mkdir(parents=True)
    export_mock = AsyncMock(
        return_value={
            "file_key": "private/SLIDE-business-report.zip",
            "metadata": {"code": "SLIDE-business-report"},
        }
    )

    monkeypatch.setattr(
        workspace_export_service.PathManager,
        "get_workspace_dir",
        lambda: tmp_path,
    )
    monkeypatch.setattr(workspace_export_service, "export_slides_template", export_mock)

    result = await workspace_export_service.export_workspace(
        export_type="slides_template_creator",
        code="SLIDE-business-report",
        upload_config={"dir": "private"},
        public_upload_config={"dir": "public"},
        source_path="templates/SLIDE-business-report",
        archive_root="SLIDE-business-report",
        file_name="SLIDE-business-report.zip",
    )

    assert result["file_key"] == "private/SLIDE-business-report.zip"
    export_mock.assert_awaited_once_with(
        workspace_dir=template_dir.resolve(),
        code="SLIDE-business-report",
        private_upload_config={"dir": "private"},
        public_upload_config={"dir": "public"},
        archive_root="SLIDE-business-report",
        file_name="SLIDE-business-report.zip",
    )


@pytest.mark.asyncio
async def test_workspace_export_requires_public_upload_config_for_slides_template(tmp_path, monkeypatch):
    template_dir = tmp_path / "templates" / "SLIDE-business-report"
    template_dir.mkdir(parents=True)
    monkeypatch.setattr(
        workspace_export_service.PathManager,
        "get_workspace_dir",
        lambda: tmp_path,
    )

    with pytest.raises(ValueError, match="public_upload_config is required"):
        await workspace_export_service.export_workspace(
            export_type="slides_template_creator",
            code="SLIDE-business-report",
            upload_config={"dir": "private"},
            source_path="templates/SLIDE-business-report",
            archive_root="SLIDE-business-report",
            file_name="SLIDE-business-report.zip",
        )


@pytest.mark.asyncio
@pytest.mark.parametrize("valid_hash", [True, False])
async def test_async_export_preserves_reference_options_and_progress(tmp_path, monkeypatch, valid_hash):
    import hashlib
    import zipfile
    from types import SimpleNamespace

    from app.infrastructure.storage import types, volcengine
    from app.service.sandbox_task import workspace_export_capability
    from app.service.sandbox_task.models import SandboxTaskStatus

    (tmp_path / "SKILLS.md").write_text("---\nmarket_skills: []\n---\n")
    for name in ("bound", "manual"):
        directory = tmp_path / "skills" / name
        directory.mkdir(parents=True)
        (directory / "SKILL.md").write_text(name)
    digest = hashlib.sha256((tmp_path / "SKILLS.md").read_bytes()).hexdigest()
    events = []
    archive_files = []

    async def update_status(status):
        events.append(status)

    class Uploader:
        def set_credentials(self, credentials):
            pass

        async def upload(self, file, key):
            events.append("upload")
            with zipfile.ZipFile(file) as archive:
                archive_files.extend(archive.namelist())

    monkeypatch.setattr(workspace_export_service.PathManager, "get_workspace_dir", lambda: tmp_path)
    monkeypatch.setattr(volcengine, "VolcEngineUploader", Uploader)
    monkeypatch.setattr(types, "VolcEngineCredentials", lambda **kwargs: kwargs)
    task = SimpleNamespace(payload={
        "type": "agent_creator",
        "code": "SMA-test",
        "upload_config": {"platform": "tos"},
        "exclude_paths": ["skills/bound"],
        "skills_md_hash": digest if valid_hash else "0" * 64,
    })
    if not valid_hash:
        with pytest.raises(ValueError):
            await workspace_export_capability.run_workspace_export(task, update_status)
        assert events == [SandboxTaskStatus.PREPARING, SandboxTaskStatus.RUNNING]
        return

    result = await workspace_export_capability.run_workspace_export(task, update_status)
    assert result["file_key"].endswith(".zip")
    assert "SMA-test/skills/manual/SKILL.md" in archive_files
    assert "SMA-test/skills/bound/SKILL.md" not in archive_files
    assert "SMA-test/SKILLS.md" in archive_files
    assert events == [
        SandboxTaskStatus.PREPARING,
        SandboxTaskStatus.RUNNING,
        SandboxTaskStatus.FINALIZING,
        "upload",
    ]
