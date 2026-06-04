import importlib

import pytest

from agentlang.context.tool_context import ToolContext
from app.tools.read_skills import ReadSkills, ReadSkillsParams

read_skills_module = importlib.import_module("app.tools.read_skills")


class MockSkill:
    def __init__(self, name: str):
        self.name = name
        self.content = f"# {name}\n\nMock skill content."
        self.skill_file = None
        self.skill_dir = None


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
async def test_read_skills_executes_with_single_skill_name_string(monkeypatch):
    async def mock_find_skill(skill_name: str):
        return MockSkill(skill_name)

    monkeypatch.setattr(read_skills_module, "find_skill", mock_find_skill)

    tool = ReadSkills()
    result = await tool.execute(
        ToolContext(tool_name="read_skills", arguments={"skill_names": "mock-skill-a"}),
        ReadSkillsParams(skill_names="mock-skill-a", check_updates=False),
    )

    assert result.ok
    assert result.extra_info["skill_names"] == ["mock-skill-a"]
    assert '<skill_content name="mock-skill-a">' in result.content
