from pathlib import Path

from agentlang.agent.define.parser import parse_agent_file
from app.core.entity.message.client_message import AgentMode


AGENTS_DIR = Path(__file__).resolve().parents[2] / "agents"
CANVAS_MANAGER_DIR = AGENTS_DIR / "skills" / "canvas-manager"


def _load_agent(agent_name: str):
    """读取并解析指定的内置 Agent 配置。"""
    content = (AGENTS_DIR / f"{agent_name}.agent").read_text(encoding="utf-8")
    return parse_agent_file(content)[0]


def test_video_production_agent_preloads_canvas_manager_video_references():
    """视频制作 Agent 应预加载统一 Canvas Skill 和视频 reference。"""
    agent_define = _load_agent("video-production")

    assert agent_define.skills_config is not None
    assert len(agent_define.skills_config.preload) == 1
    entry = agent_define.skills_config.preload[0]
    assert entry.name == "canvas-manager"
    assert entry.files == [
        "SKILL.md",
        "references/professional-video-production.md",
        "references/video-generation.md",
    ]


def test_design_agent_preloads_canvas_manager_instead_of_video_skill():
    """设计 Agent 与视频制作 Agent 应共享统一 Canvas Skill。"""
    agent_define = _load_agent("design")

    assert agent_define.skills_config is not None
    assert agent_define.skills_config.preload[0].name == "canvas-manager"
    assert "video-production" not in [
        entry.name for entry in agent_define.skills_config.preload
    ]


def test_video_production_agent_uses_code_mode_for_business_tools():
    """Canvas 业务工具通过 Code Mode 调用，不直接挂载旧工具。"""
    agent_define = _load_agent("video-production")
    direct_tool_names = set(agent_define.tools_config.keys())

    assert direct_tool_names.isdisjoint(
        {
            "generate_canvas_images",
            "generate_canvas_videos",
            "generate_video_production_images",
            "generate_video_production_videos",
            "upsert_storyboard",
            "configure_video_edit",
            "compose_canvas_video",
        }
    )


def test_video_production_agent_points_to_existing_canvas_manager_references():
    """视频制作 Agent preload 的 reference 文件必须存在。"""
    for relative_path in (
        "SKILL.md",
        "references/professional-video-production.md",
        "references/video-generation.md",
    ):
        assert (CANVAS_MANAGER_DIR / relative_path).is_file()


def test_professional_video_reference_propagates_no_facial_expression_constraints():
    """专业视频规则应将无表情约束贯穿分镜图和镜头视频提示词。"""
    reference = (
        CANVAS_MANAGER_DIR / "references" / "professional-video-production.md"
    ).read_text(encoding="utf-8")

    for phrase in (
        "hard cross-stage visual constraint",
        "saved storyboard",
        "shot reference-image prompt",
        "shot-video prompt",
        "completely neutral, expressionless face",
        "do not assume that a reference image is expressionless",
    ):
        assert phrase in reference


def test_video_production_agent_mode_routes_to_new_agent():
    """视频制作模式仍然路由到 video-production.agent。"""
    assert AgentMode.VIDEO_PRODUCTION.value == "video-production"
    assert AgentMode.VIDEO_PRODUCTION.get_agent_type() == "video-production"
    assert AgentMode.resolve_agent_type("video-production") == "video-production"
