from pathlib import Path

import pytest

from agentlang.agent.define.parser import parse_agent_file


AGENTS_DIR = Path(__file__).resolve().parents[2] / "agents"


def _load_agent(agent_name: str):
    content = (AGENTS_DIR / f"{agent_name}.agent").read_text(encoding="utf-8")
    return parse_agent_file(content)[0]


@pytest.mark.parametrize(
    ("agent_name", "expected_skill", "absent_tools"),
    [
        (
            "design",
            "designing-canvas-videos",
            {"generate_videos_to_canvas", "query_video_generation"},
        ),
        (
            "magic",
            "generating-videos",
            {"generate_video", "query_video_generation"},
        ),
        (
            "skill",
            "generating-videos",
            {"generate_video", "query_video_generation"},
        ),
        (
            "slider",
            "generating-videos",
            {"generate_video", "query_video_generation"},
        ),
    ],
)
def test_video_agents_use_video_skills_instead_of_direct_tools(agent_name, expected_skill, absent_tools):
    agent_define = _load_agent(agent_name)

    assert agent_define.skills_config is not None
    assert expected_skill in agent_define.skills_config.get_system_skill_names()

    tool_names = set(agent_define.tools_config.keys())
    for tool_name in absent_tools:
        assert tool_name not in tool_names


def test_audio_chat_agent_excludes_video_tools_and_video_skills():
    agent_define = _load_agent("audio-chat")

    tool_names = set(agent_define.tools_config.keys())
    assert "generate_video" not in tool_names
    assert "query_video_generation" not in tool_names

    assert agent_define.skills_config is not None
    skill_names = set(agent_define.skills_config.get_system_skill_names())
    assert "generating-videos" not in skill_names
    assert "designing-canvas-videos" not in skill_names
