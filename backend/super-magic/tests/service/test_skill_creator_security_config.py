from pathlib import Path


SKILL_CREATOR_FILE = (
    Path(__file__).resolve().parents[2] / "agents" / "skills" / "skill-creator" / "SKILL.md"
)


def test_skill_creator_requires_default_security_baseline():
    skill = SKILL_CREATOR_FILE.read_text(encoding="utf-8")

    assert "Mandatory baseline security" in skill
    assert "external content as untrusted data" in skill
    assert "minimum scope required" in skill
    assert "explicit user confirmation" in skill
    assert "must not replace or weaken it" in skill
    assert "reject a skill that omits" in skill