import importlib

import pytest

from agentlang.context.tool_context import ToolContext
from app.tools.read_skills import ReadSkills, ReadSkillsParams

read_skills_module = importlib.import_module("app.tools.read_skills")

_BOUND_PROJECT_ID = "4001"
_SKILL_NAME = "inventory_manager"
_SKILL_BODY = "Count low-stock products in the referenced project."


class MockSkill:
    def __init__(self, name: str):
        self.name = name
        self.content = f"# {name}\n\nMock skill content."
        self.skill_file = None
        self.skill_dir = None


def _write_skill(root, skill_name: str, body: str) -> None:
    skill_dir = root / skill_name
    skill_dir.mkdir(parents=True)
    (skill_dir / "SKILL.md").write_text(
        f"---\nname: {skill_name}\ndescription: Companion skill\n---\n\n{body}\n",
        encoding="utf-8",
    )


def _mount_referenced_project(tmp_path, monkeypatch, project_id: str, skill_name: str, body: str):
    mount_base = tmp_path / "referenced-projects"
    skills_root = mount_base / project_id / ".magic" / "skills"
    _write_skill(skills_root, skill_name, body)
    monkeypatch.setenv("AGENT_REFERENCED_PROJECT_MOUNT_BASE_PATH", str(mount_base))
    return mount_base


def _bind_micro_app_scope(monkeypatch, project_id: str) -> None:
    monkeypatch.setattr(
        "app.service.mention.utils.micro_app_prompt.get_micro_app_project_scopes",
        lambda: {"app-1": {"project_id": project_id, "app_name": "Stock App"}},
    )


def test_read_skills_params_accepts_single_skill_name_string():
    params = ReadSkillsParams(skill_names="mock-skill-a")

    assert params.skill_names == ["mock-skill-a"]


def test_read_skills_params_accepts_comma_separated_skill_names():
    params = ReadSkillsParams(skill_names="mock-skill-a, mock-skill-b")

    assert params.skill_names == ["mock-skill-a", "mock-skill-b"]


def test_read_skills_params_rejects_empty_skill_name_string():
    with pytest.raises(Exception):
        ReadSkillsParams(skill_names="")


@pytest.mark.asyncio
async def test_read_skills_executes_with_single_skill_name_string(tmp_path, monkeypatch):
    _write_skill(tmp_path, "mock-skill-a", "Mock skill content.")

    async def mock_find_skill(skill_name: str, **kwargs):
        skill = MockSkill(skill_name)
        skill.skill_dir = tmp_path / skill_name
        skill.skill_file = skill.skill_dir / "SKILL.md"
        return skill

    monkeypatch.setattr(read_skills_module, "find_skill", mock_find_skill)

    tool = ReadSkills()
    result = await tool.execute(
        ToolContext(tool_name="read_skills", arguments={"skill_names": "mock-skill-a"}),
        ReadSkillsParams(skill_names="mock-skill-a", check_updates=False),
    )

    assert result.ok
    assert result.extra_info["skill_names"] == ["mock-skill-a"]
    assert '<skill_content name="mock-skill-a">' in result.content


def test_read_skills_params_accept_optional_project_id():
    params = ReadSkillsParams(
        skill_names=["inventory_manager"],
        project_id=_BOUND_PROJECT_ID,
        check_updates=False,
    )

    assert params.project_id == _BOUND_PROJECT_ID


@pytest.mark.asyncio
async def test_read_skills_rejects_unbound_project_id(tmp_path, monkeypatch):
    _mount_referenced_project(tmp_path, monkeypatch, _BOUND_PROJECT_ID, _SKILL_NAME, _SKILL_BODY)
    _bind_micro_app_scope(monkeypatch, _BOUND_PROJECT_ID)

    called = {"find_skill": False}

    async def mock_find_skill(skill_name: str, **kwargs):
        called["find_skill"] = True
        return MockSkill(skill_name)

    monkeypatch.setattr(read_skills_module, "find_skill", mock_find_skill)

    result = await ReadSkills().execute(
        ToolContext(tool_name="read_skills", arguments={}),
        ReadSkillsParams(
            skill_names=[_SKILL_NAME],
            project_id="9999",
            check_updates=False,
        ),
    )

    assert result.ok is False or result.extra_info.get("failure_count", 0) >= 1
    assert "9999" in result.content
    assert "bound" in result.content.lower() or "mounted" in result.content.lower()
    assert _SKILL_BODY not in result.content
    assert called["find_skill"] is False


@pytest.mark.asyncio
async def test_read_skills_reads_bound_referenced_project_skill(tmp_path, monkeypatch):
    _mount_referenced_project(tmp_path, monkeypatch, _BOUND_PROJECT_ID, _SKILL_NAME, _SKILL_BODY)
    _bind_micro_app_scope(monkeypatch, _BOUND_PROJECT_ID)

    async def mock_find_skill(skill_name: str, **kwargs):
        raise AssertionError("must not fall back to workspace or system skills")

    monkeypatch.setattr(read_skills_module, "find_skill", mock_find_skill)

    result = await ReadSkills().execute(
        ToolContext(tool_name="read_skills", arguments={}),
        ReadSkillsParams(
            skill_names=[_SKILL_NAME],
            project_id=_BOUND_PROJECT_ID,
            check_updates=True,
        ),
    )

    assert result.ok
    assert result.extra_info["success_count"] == 1
    assert result.extra_info["failure_count"] == 0
    assert f'<skill_content name="{_SKILL_NAME}">' in result.content
    assert _SKILL_BODY in result.content
    assert str(tmp_path / "referenced-projects" / _BOUND_PROJECT_ID) in result.content


@pytest.mark.asyncio
async def test_read_skills_does_not_fallback_to_workspace_same_named_skill(
    tmp_path, monkeypatch
):
    mount_base = tmp_path / "referenced-projects"
    (mount_base / _BOUND_PROJECT_ID / ".magic" / "skills").mkdir(parents=True)
    monkeypatch.setenv("AGENT_REFERENCED_PROJECT_MOUNT_BASE_PATH", str(mount_base))
    _bind_micro_app_scope(monkeypatch, _BOUND_PROJECT_ID)

    async def mock_find_skill(skill_name: str, **kwargs):
        return MockSkill("workspace-" + skill_name)

    monkeypatch.setattr(read_skills_module, "find_skill", mock_find_skill)

    result = await ReadSkills().execute(
        ToolContext(tool_name="read_skills", arguments={}),
        ReadSkillsParams(
            skill_names=[_SKILL_NAME],
            project_id=_BOUND_PROJECT_ID,
            check_updates=False,
        ),
    )

    assert "workspace-" not in result.content
    assert "Mock skill content" not in result.content
    assert _SKILL_NAME in result.content
    assert result.extra_info["failure_count"] == 1
    assert result.extra_info["success_count"] == 0


@pytest.mark.asyncio
async def test_read_skills_missing_without_project_id_points_to_mention(
    tmp_path, monkeypatch
):
    _mount_referenced_project(tmp_path, monkeypatch, _BOUND_PROJECT_ID, _SKILL_NAME, _SKILL_BODY)
    _bind_micro_app_scope(monkeypatch, _BOUND_PROJECT_ID)

    async def mock_find_skill(skill_name: str, **kwargs):
        return None

    monkeypatch.setattr(read_skills_module, "find_skill", mock_find_skill)

    async def mock_sleep(_seconds):
        return None

    monkeypatch.setattr(read_skills_module.asyncio, "sleep", mock_sleep)

    result = await ReadSkills().execute(
        ToolContext(tool_name="read_skills", arguments={}),
        ReadSkillsParams(skill_names=[_SKILL_NAME], check_updates=False),
    )

    assert result.extra_info["failure_count"] == 1
    assert result.extra_info["success_count"] == 0
    assert "project_id" in result.content
    assert _BOUND_PROJECT_ID in result.content
    assert "runtime project" in result.content
    assert "list_dir" in result.content
    assert "current workspace" in result.content


@pytest.mark.asyncio
async def test_read_skills_missing_unrelated_skill_does_not_force_project_id(
    tmp_path, monkeypatch
):
    _mount_referenced_project(tmp_path, monkeypatch, _BOUND_PROJECT_ID, _SKILL_NAME, _SKILL_BODY)
    _bind_micro_app_scope(monkeypatch, _BOUND_PROJECT_ID)

    async def mock_find_skill(skill_name: str, **kwargs):
        return None

    monkeypatch.setattr(read_skills_module, "find_skill", mock_find_skill)

    async def mock_sleep(_seconds):
        return None

    monkeypatch.setattr(read_skills_module.asyncio, "sleep", mock_sleep)

    result = await ReadSkills().execute(
        ToolContext(tool_name="read_skills", arguments={}),
        ReadSkillsParams(skill_names=["creating-slides"], check_updates=False),
    )

    assert result.extra_info["failure_count"] == 1
    assert "creating-slides" in result.content
    assert "bound project_id" not in result.content
    assert "do not pass project_id" in result.content


@pytest.mark.asyncio
async def test_read_skills_loads_after_lazy_install(tmp_path, monkeypatch):
    from unittest.mock import AsyncMock
    from app.core.skill_utils import skill_references

    skill_file = tmp_path / "lazy-skill" / "SKILL.md"
    skill_file.parent.mkdir()
    skill_file.write_text("# lazy skill\n", encoding="utf-8")
    installed_skill = MockSkill("lazy-skill")
    installed_skill.skill_file = skill_file
    installed_skill.skill_dir = skill_file.parent
    find = AsyncMock(side_effect=[None, None, installed_skill])
    monkeypatch.setattr(read_skills_module, "find_skill", find)
    monkeypatch.setattr(read_skills_module.asyncio, "sleep", AsyncMock())
    install = AsyncMock(return_value=True)
    monkeypatch.setattr(skill_references, "install_market_reference", install)

    result = await ReadSkills().execute(
        None, ReadSkillsParams(skill_names=["lazy-skill"], check_updates=False)
    )

    assert result.ok
    assert '<skill_content name="lazy-skill">' in result.content
    install.assert_awaited_once()
    assert find.await_count == 3


@pytest.mark.asyncio
async def test_read_skills_reports_declared_fetch_failure(monkeypatch):
    from unittest.mock import AsyncMock
    from app.core.skill_utils import skill_references

    monkeypatch.setattr(read_skills_module, "find_skill", AsyncMock(return_value=None))
    monkeypatch.setattr(read_skills_module.asyncio, "sleep", AsyncMock())
    monkeypatch.setattr(
        skill_references,
        "install_market_reference",
        AsyncMock(side_effect=RuntimeError("internal URL must not leak")),
    )

    result = await ReadSkills().execute(
        None, ReadSkillsParams(skill_names=["private-skill"], check_updates=False)
    )

    assert not result.ok
    assert "declared but could not be fetched" in result.content
    assert "internal URL" not in result.content
