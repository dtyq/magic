from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
CREW_CREATOR_AGENT = PROJECT_ROOT / "agents" / "crew-creator.agent"
SKILL_CREATOR = PROJECT_ROOT / "agents" / "skills" / "skill-creator" / "SKILL.md"


def test_skill_drafts_are_allowed_before_workflow_confirmation():
    agent = CREW_CREATOR_AGENT.read_text(encoding="utf-8")
    skill = SKILL_CREATOR.read_text(encoding="utf-8")

    assert "确认前可以创建供用户审阅的 skill 草稿" in agent
    assert "you may create a reviewable skill draft" in agent
    assert "you may create files as a reviewable draft" in skill
    assert "用户确认前禁止创建任何 skill 文件" not in agent
    assert "do not create any skill files before confirmation" not in agent
    assert "do not write any skill files" not in skill