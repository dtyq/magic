from pathlib import Path

import pytest

from agentlang.agent.define.parser import parse_agent_file


AGENTS_DIR = Path(__file__).resolve().parents[2] / "agents"
CANVAS_MANAGER_DIR = AGENTS_DIR / "skills" / "canvas-manager"


def _load_agent(agent_name: str):
    """读取并解析指定的内置 Agent 配置。"""
    content = (AGENTS_DIR / f"{agent_name}.agent").read_text(encoding="utf-8")
    return parse_agent_file(content)[0]


@pytest.mark.parametrize(
    ("agent_name", "absent_tools"),
    [
        ("design", {"generate_videos_to_canvas", "generate_canvas_videos"}),
    ],
)
def test_video_tools_are_not_directly_mounted(agent_name, absent_tools):
    """视频业务工具不应直接挂载到设计 Agent。"""
    agent_define = _load_agent(agent_name)
    tool_names = set(agent_define.tools_config.keys())
    assert tool_names.isdisjoint(absent_tools)


def test_design_agent_preloads_canvas_manager_image_references():
    """设计 Agent 应预加载统一 Canvas Skill 和图片设计 reference。"""
    agent_define = _load_agent("design")

    assert agent_define.skills_config is not None
    assert len(agent_define.skills_config.preload) == 1
    entry = agent_define.skills_config.preload[0]
    assert entry.name == "canvas-manager"
    assert entry.files == [
        "SKILL.md",
        "references/image-generation.md",
        "references/image-search.md",
        "references/prompt-library.md",
    ]


def test_magic_and_video_agents_do_not_reference_canvas_designer():
    """所有运行时 Agent 配置都应切换到 canvas-manager。"""
    legacy_skill_name = "canvas" + "-designer"
    for agent_name in ("magic", "design", "video-production"):
        source = (AGENTS_DIR / f"{agent_name}.agent").read_text(encoding="utf-8")
        assert legacy_skill_name not in source


def test_canvas_manager_image_references_exist():
    """设计 Agent preload 的 reference 文件必须存在。"""
    for relative_path in (
        "SKILL.md",
        "references/image-generation.md",
        "references/image-search.md",
        "references/prompt-library.md",
    ):
        assert (CANVAS_MANAGER_DIR / relative_path).is_file()


def test_canvas_manager_replaces_legacy_canvas_tool_names_in_design_guidance():
    """统一 Skill 应使用当前 Canvas 工具名称。"""
    skill = (CANVAS_MANAGER_DIR / "SKILL.md").read_text(encoding="utf-8")
    for tool_name in (
        "initialize_canvas",
        "query_canvas_overview",
        "query_canvas_element_details",
        "add_canvas_elements",
        "add_canvas_contents",
        "search_canvas_image_candidates",
        "search_canvas_image_prompts",
    ):
        assert tool_name in skill

    for legacy_name in (
        "create_canvas",
        "get_canvas_overview",
        "query_canvas_elements",
        "generate_canvas_images",
        "search_canvas_images",
    ):
        assert legacy_name not in skill
