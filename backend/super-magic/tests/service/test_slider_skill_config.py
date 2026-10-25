from pathlib import Path

from agentlang.agent.define.parser import parse_agent_file


AGENTS_DIR = Path(__file__).resolve().parents[2] / "agents"


def test_slider_preloads_slide_template_replacement():
    source = (AGENTS_DIR / "slider.agent").read_text(encoding="utf-8")
    agent_define = parse_agent_file(source)[0]

    assert agent_define.skills_config is not None
    entries = agent_define.skills_config.preload
    assert any(
        entry.name == "slide-template-replacement" and entry.files == ["SKILL.md"]
        for entry in entries
    )
