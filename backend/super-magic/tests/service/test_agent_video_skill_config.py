from pathlib import Path

import pytest

from agentlang.agent.define.parser import parse_agent_file


AGENTS_DIR = Path(__file__).resolve().parents[2] / "agents"


def _load_agent(agent_name: str):
    content = (AGENTS_DIR / f"{agent_name}.agent").read_text(encoding="utf-8")
    return parse_agent_file(content)[0]


@pytest.mark.parametrize(
    ("agent_name", "absent_tools"),
    [
        ("design", {"generate_videos_to_canvas", "generate_canvas_videos", "query_video_generation"}),
        ("magic", {"generate_video", "query_video_generation"}),
        ("slider", {"generate_video", "query_video_generation"}),
        ("audio-chat", {"generate_video", "query_video_generation"}),
    ],
)
def test_video_tools_not_directly_mounted(agent_name, absent_tools):
    """Video tools should not be directly mounted on agents; they go through skills or code mode."""
    agent_define = _load_agent(agent_name)
    tool_names = set(agent_define.tools_config.keys())
    for tool_name in absent_tools:
        assert tool_name not in tool_names


def test_design_agent_uses_canvas_designer_for_video():
    """Video capability is now part of the preloaded canvas-designer skill."""
    agent_define = _load_agent("design")

    assert agent_define.skills_config is not None
    preload_names = [e.name for e in agent_define.skills_config.preload]
    assert "canvas-designer" in preload_names
