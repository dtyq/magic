"""The product Skill is reachable from each supported Agent template."""

from pathlib import Path

import pytest

from agentlang.agent.define.parser import parse_agent_file
from agentlang.skills import SkillLoader

AGENTS = Path(__file__).resolve().parents[3] / "agents"


@pytest.mark.parametrize("agent_file", ["magic.agent", "crew.template.agent"])
def test_explicit_agent_templates_register_product_skill(agent_file):
    definition = parse_agent_file((AGENTS / agent_file).read_text(encoding="utf-8"))[0]
    assert "super-magic" in definition.skills_config.get_system_skill_names()
    assert "read_topic_messages" not in definition.tools_config


def test_claw_wildcard_includes_product_skill():
    definition = parse_agent_file((AGENTS / "claw.template.agent").read_text(encoding="utf-8"))[0]
    assert definition.skills_config.system_skills == "*"
    assert "super-magic" not in definition.skills_config.excluded_skills


@pytest.mark.asyncio
async def test_product_skill_and_references_load():
    skill_dir = AGENTS / "skills" / "super-magic"
    skill = await SkillLoader().load_from_file(skill_dir / "SKILL.md")
    assert skill.name == "super-magic"
    assert "references/messages.md" in skill.content
    assert "references/contacts.md" in skill.content
    assert all((skill_dir / "references" / f"{name}.md").is_file() for name in (
        "workspaces", "projects", "topics", "messages", "files", "tasks", "data-schema", "contacts",
    ))
