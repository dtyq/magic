import asyncio

import pytest

from app.core.skill_utils import referenced_project_skills as skills
from app.utils.async_file_utils import async_mkdir, async_write_text


@pytest.mark.asyncio
async def test_lists_nested_companion_skills_and_ignores_hidden_directories(tmp_path, monkeypatch):
    monkeypatch.setenv("AGENT_REFERENCED_PROJECT_MOUNT_BASE_PATH", str(tmp_path))
    root = tmp_path / "42" / ".workspace" / ".magic" / "skills"
    for relative in ("zebra/SKILL.md", "alpha/package/SKILL.md", ".hidden/SKILL.md"):
        file = root / relative
        await async_mkdir(file.parent, parents=True)
        await async_write_text(file, "# Companion instructions", encoding="utf-8")
    await async_mkdir(root / "empty")

    assert await skills.is_referenced_project_bound("42")
    assert await skills.format_referenced_project_skill_lines("42") == [
        "   - project_id: 42",
        "   - skills: alpha, zebra",
    ]
    assert await skills.format_referenced_project_skill_lines("../42") == []


def test_referenced_project_skill_tip_forbids_runtime_workspace_search():
    assert "runtime project" in skills.REFERENCED_PROJECT_SKILL_TIP
    assert "first" in skills.REFERENCED_PROJECT_SKILL_TIP
    assert "companion skill" in skills.REFERENCED_PROJECT_SKILL_TIP
    assert "list_dir" in skills.REFERENCED_PROJECT_SKILL_TIP
    assert "current workspace" in skills.REFERENCED_PROJECT_SKILL_TIP
    assert "use-magicbase" in skills.REFERENCED_PROJECT_SKILL_TIP
    assert "omit project_id" in skills.REFERENCED_PROJECT_SKILL_TIP


@pytest.mark.asyncio
async def test_missing_workspace_skill_hint_includes_bound_project_id_for_listed_skill(
    tmp_path, monkeypatch
):
    mount_base = tmp_path / "referenced-projects"
    skill_dir = mount_base / "4001" / ".magic" / "skills" / "inventory_manager"
    skill_dir.mkdir(parents=True)
    await async_write_text(skill_dir / "SKILL.md", "# Companion instructions", encoding="utf-8")
    monkeypatch.setenv("AGENT_REFERENCED_PROJECT_MOUNT_BASE_PATH", str(mount_base))
    monkeypatch.setattr(
        "app.service.mention.utils.micro_app_prompt.get_micro_app_project_scopes",
        lambda: {"app-1": {"project_id": "4001", "app_name": "Stock App"}},
    )
    hint = await skills.missing_workspace_skill_hint("inventory_manager")
    assert "inventory_manager" in hint
    assert "4001" in hint
    assert "project_id" in hint
    assert "runtime project" in hint
    assert "list_dir" in hint


@pytest.mark.asyncio
async def test_missing_workspace_skill_hint_does_not_force_project_id_for_other_skills(
    tmp_path, monkeypatch
):
    mount_base = tmp_path / "referenced-projects"
    skill_dir = mount_base / "4001" / ".magic" / "skills" / "inventory_manager"
    skill_dir.mkdir(parents=True)
    await async_write_text(skill_dir / "SKILL.md", "# Companion instructions", encoding="utf-8")
    monkeypatch.setenv("AGENT_REFERENCED_PROJECT_MOUNT_BASE_PATH", str(mount_base))
    monkeypatch.setattr(
        "app.service.mention.utils.micro_app_prompt.get_micro_app_project_scopes",
        lambda: {"app-1": {"project_id": "4001", "app_name": "Stock App"}},
    )
    hint = await skills.missing_workspace_skill_hint("creating-slides")
    assert "creating-slides" in hint
    assert "bound project_id" not in hint
    assert "do not pass project_id" in hint


@pytest.mark.asyncio
async def test_missing_workspace_skill_hint_stays_plain_without_micro_app_scope(monkeypatch):
    monkeypatch.setattr(
        "app.service.mention.utils.micro_app_prompt.get_micro_app_project_scopes",
        lambda: {},
    )
    hint = await skills.missing_workspace_skill_hint("creating-slides")
    assert hint == "Skill 'creating-slides' was not found"


@pytest.mark.asyncio
async def test_slow_mount_lookup_yields_and_preserves_cancellation(monkeypatch):
    started = asyncio.Event()
    release = asyncio.Event()

    async def slow_is_dir(path):
        started.set()
        await release.wait()
        return True

    monkeypatch.setattr(skills, "async_is_dir", slow_is_dir)
    task = asyncio.create_task(skills.format_referenced_project_skill_lines("42"))
    try:
        await asyncio.wait_for(started.wait(), timeout=1)
        assert not task.done()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
    finally:
        task.cancel()


@pytest.mark.asyncio
async def test_directory_iteration_stays_off_event_loop(tmp_path, monkeypatch):
    import threading

    from app.utils import async_file_utils

    expected = tmp_path / "SKILL.md"
    await async_write_text(expected, "# Skill", encoding="utf-8")
    loop_thread = threading.get_ident()
    original_scandir = async_file_utils.os.scandir

    class CheckedScan:
        def __init__(self, path):
            self.entries = original_scandir(path)

        def __enter__(self):
            return self

        def __exit__(self, *args):
            self.entries.close()

        def __iter__(self):
            # 返回扫描器还不够：迭代时也会执行 readdir，必须留在线程内。
            assert threading.get_ident() != loop_thread
            return iter(self.entries)

    with monkeypatch.context() as patch:
        patch.setattr(async_file_utils.os, "scandir", CheckedScan)
        assert await async_file_utils.async_iterdir(tmp_path) == [expected]


@pytest.mark.asyncio
async def test_cancel_does_not_wait_for_blocked_directory_iterator(tmp_path, monkeypatch):
    import threading

    from app.utils import async_file_utils

    loop = asyncio.get_running_loop()
    started = asyncio.Event()
    release = threading.Event()
    closed = asyncio.Event()

    class SlowScan:
        def __init__(self, path):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            loop.call_soon_threadsafe(closed.set)

        def __iter__(self):
            loop.call_soon_threadsafe(started.set)
            release.wait(timeout=5)
            return iter(())

    with monkeypatch.context() as patch:
        patch.setattr(async_file_utils.os, "scandir", SlowScan)
        task = asyncio.create_task(async_file_utils.async_iterdir(tmp_path))
        try:
            await asyncio.wait_for(started.wait(), timeout=1)
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await asyncio.wait_for(task, timeout=1)
            assert not release.is_set()
        finally:
            release.set()
            task.cancel()
            await asyncio.wait_for(closed.wait(), timeout=1)
