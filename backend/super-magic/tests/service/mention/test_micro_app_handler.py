from unittest.mock import patch

import pytest

from app.service.mention.handlers.micro_app_handler import MicroAppHandler


@pytest.mark.asyncio
async def test_micro_app_mention_uses_app_id_only():
    handler = MicroAppHandler()
    with patch(
        "app.service.mention.handlers.micro_app_handler.get_micro_app_project_scopes",
        return_value={},
    ):
        assert await handler.handle(
            {"type": "micro_app", "app_id": "app-1", "app_name": "Ignored"}, 1
        ) == ["1. [Ignored](micro-app://app-1)"]


@pytest.mark.asyncio
async def test_micro_app_mention_prints_project_id_and_companion_skills(tmp_path, monkeypatch):
    mount_base = tmp_path / "referenced-projects"
    skill_dir = mount_base / "4001" / ".magic" / "skills" / "inventory_manager"
    skill_dir.mkdir(parents=True)
    (skill_dir / "SKILL.md").write_text(
        "---\nname: inventory_manager\ndescription: Stock skill\n---\n\nCount stock.\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("AGENT_REFERENCED_PROJECT_MOUNT_BASE_PATH", str(mount_base))

    handler = MicroAppHandler()
    with patch(
        "app.service.mention.handlers.micro_app_handler.get_micro_app_project_scopes",
        return_value={},
    ):
        lines = await handler.handle(
            {
                "type": "micro_app",
                "app_id": "app-1",
                "app_name": "库存助手",
                "project_id": "4001",
            },
            1,
        )

    assert lines[0] == "1. [库存助手](micro-app://app-1)"
    assert "   - project_id: 4001" in lines
    assert "   - skills: inventory_manager" in lines


@pytest.mark.asyncio
async def test_micro_app_mention_tip_tells_agent_to_read_skills_with_project_id():
    handler = MicroAppHandler()
    with (
        patch(
            "app.service.mention.handlers.micro_app_handler.has_bound_micro_app_project_scope",
            return_value=True,
        ),
        patch(
            "app.service.mention.handlers.micro_app_handler.get_micro_app_project_scopes",
            return_value={"app-1": {"project_id": "4001", "app_name": "App One"}},
        ),
    ):
        tip = await handler.get_tip({"type": "micro_app", "app_id": "app-1", "project_id": "4001"})

    assert "read_skills" in tip
    assert "project_id" in tip
    assert "use-magicbase" in tip
    assert "Only load" in tip
    assert "mounted read-only" in tip
    assert "Do not create, edit, delete, move, or rename files" in tip
    assert "runtime project" in tip
    assert "first" in tip
    assert "list_dir" in tip
    assert "current workspace" in tip
    assert "omit project_id" in tip


@pytest.mark.asyncio
async def test_micro_app_mention_without_app_id_is_rejected():
    handler = MicroAppHandler()

    assert "app_id is missing" in await handler.get_tip({"type": "micro_app"})


@pytest.mark.asyncio
async def test_micro_app_mention_tip_requires_bound_scope():
    handler = MicroAppHandler()
    with (
        patch(
            "app.service.mention.handlers.micro_app_handler.has_bound_micro_app_project_scope",
            return_value=True,
        ),
        patch(
            "app.service.mention.handlers.micro_app_handler.get_micro_app_project_scopes",
            return_value={"app-1": {"project_id": "project-1", "app_name": "App One"}},
        ),
    ):
        tip = await handler.get_tip({"type": "micro_app", "app_id": "app-1"})
    assert "app-1" in tip
    assert "use-magicbase" in tip
    assert "built-in system skill" in tip
    assert "read_skills" in tip
    assert "Only load" in tip
    assert "source project or another writable workspace" in tip
    assert "runtime project" in tip
    assert "omit project_id" in tip


@pytest.mark.asyncio
async def test_micro_app_mention_tip_lists_multiple_bound_scopes():
    handler = MicroAppHandler()
    with (
        patch(
            "app.service.mention.handlers.micro_app_handler.has_bound_micro_app_project_scope",
            return_value=True,
        ),
        patch(
            "app.service.mention.handlers.micro_app_handler.get_micro_app_project_scopes",
            return_value={
                "app-1": {"project_id": "project-1", "app_name": "App One"},
                "app-2": {"project_id": "project-2", "app_name": "App Two"},
            },
        ),
    ):
        tip = await handler.get_tip({"type": "micro_app", "app_id": "app-1"})
    assert "Pass app_id" in tip
    assert "micro-app://app-1" in tip
    assert "micro-app://app-2" in tip


@pytest.mark.asyncio
async def test_micro_app_mention_without_bound_scope_returns_empty_tip():
    handler = MicroAppHandler()
    with patch(
        "app.service.mention.handlers.micro_app_handler.has_bound_micro_app_project_scope",
        return_value=False,
    ):
        tip = await handler.get_tip(
            {
                "type": "micro_app",
                "app_id": "app-1",
                "project_id": "project-1",
            }
        )
    assert tip == ""


@pytest.mark.asyncio
async def test_micro_app_mention_tip_skips_unresolved_app_id():
    handler = MicroAppHandler()
    with (
        patch(
            "app.service.mention.handlers.micro_app_handler.has_bound_micro_app_project_scope",
            return_value=True,
        ),
        patch(
            "app.service.mention.handlers.micro_app_handler.get_micro_app_project_scopes",
            return_value={"app-1": {"project_id": "project-1", "app_name": "App One"}},
        ),
    ):
        tip = await handler.get_tip({"type": "micro_app", "app_id": "app-2"})
    assert tip == ""
