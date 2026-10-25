"""Canvas Manager Skill 的静态约束测试。"""

import re
from pathlib import Path

SKILL_PATH = Path(__file__).parents[2] / "agents" / "skills" / "canvas-manager" / "SKILL.md"
PUBLIC_TOOLS = (
    "initialize_canvas",
    "query_canvas_overview",
    "query_canvas_element_details",
    "add_canvas_elements",
    "frame_canvas_elements",
    "add_canvas_contents",
    "retry_canvas_content_generation",
    "select_canvas_main_content",
    "layout_canvas_elements",
    "manage_canvas_connections",
    "wait_canvas_generation",
    "estimate_canvas_content_points",
    "search_canvas_image_candidates",
    "search_canvas_image_prompts",
)


def test_skill_constrains_retry_and_connection_boundaries() -> None:
    """Skill 必须覆盖重试上限和受控 Connection 删除。"""
    content = SKILL_PATH.read_text(encoding="utf-8")

    assert "at most 2 times" in content
    assert "Never loop retries automatically" in content
    assert "replace_existing_connections=true" in content
    assert "remove_connection_ids" in content
    assert "asset_path" in content
    assert "Element and Content deletion are not available" in content


def test_skill_describes_frame_boundaries_and_follow_up_ids() -> None:
    """Skill 必须说明 Frame 的选区边界、局部坐标和后续真实 ID。"""
    content = SKILL_PATH.read_text(encoding="utf-8")

    assert "frame_canvas_elements" in content
    assert "frame_element_id" in content
    assert "child_element_ids" in content
    assert "local" in content
    assert "does not frame existing Frames/Groups" in content
    assert "unframing" in content


def test_skill_exposes_only_the_controlled_project_file_recovery_boundary() -> None:
    """Skill 只允许受控的项目文件恢复兜底，不暴露底层服务实现。"""
    content = SKILL_PATH.read_text(encoding="utf-8")

    assert "Canvas version" not in content
    assert "magic.project.js" in content
    assert "MAGICPROJECTDESIGNDATA://" in content
    assert "gzip + Base64" in content
    assert "magic-service" not in content


def test_canvas_agent_and_references_do_not_expose_storage_protocol_details() -> None:
    """Agent、Skill 和 reference 的模型可见文案不能泄露协议或驱动实现。"""
    root = SKILL_PATH.parent
    paths = [root.parent.parent / "canvas.agent", SKILL_PATH, *sorted((root / "references").glob("*.md"))]
    forbidden = ("Canvas version", "magic-service", "3.0.0")
    for path in paths:
        content = path.read_text(encoding="utf-8")
        assert all(value not in content for value in forbidden), path


def test_every_canvas_tool_has_an_independent_guide_and_code_mode_example() -> None:
    """全部公开工具都必须有独立标题、参数说明和 Code Mode 示例。"""
    content = SKILL_PATH.read_text(encoding="utf-8")

    for tool_name in PUBLIC_TOOLS:
        assert f"## `{tool_name}`" in content
        assert f'tool.call("{tool_name}"' in content

        section = content.split(f"## `{tool_name}`", maxsplit=1)[1]
        section = re.split(r"\n## `|\n# ", section, maxsplit=1)[0]
        assert "Parameters:" in section
        assert "print(result.content)" in section


def test_skill_covers_unified_design_and_video_production_workflows() -> None:
    """Skill 必须覆盖设计、图片、视频、分镜、Frame 和版本管理。"""
    content = SKILL_PATH.read_text(encoding="utf-8")

    for expected in (
        "Image design workflow",
        "Ordinary video workflow",
        "Detailed video production workflow",
        "Storyboard",
        "video-edit",
        "row_incremental",
        "dependency_flow",
        "explicit_position",
        "visual_understanding",
        "add_canvas_contents",
        "select_canvas_main_content",
        "frame_canvas_elements",
        "wait_canvas_generation",
    ):
        assert expected in content


def test_skill_states_current_production_capabilities() -> None:
    """Skill 必须描述已实现的合成、图片搜索和音频序列能力。"""
    content = SKILL_PATH.read_text(encoding="utf-8")

    assert 'task="compose"' in content
    assert "composition.videoSequence" in content
    assert "composition.audioSequence" in content
    assert "search_canvas_image_candidates" in content
    assert "audioSequence" in content
    assert "asset_path" in content


def test_skill_freezes_estimated_request_and_routes_provider_assets() -> None:
    """Skill 必须避免虚拟资产误走视觉理解，并锁定预估与生成请求。"""
    content = SKILL_PATH.read_text(encoding="utf-8")

    assert "Provider-managed asset URIs" in content
    assert "Never pass them to `visual_understanding`" in content
    assert "Freeze the complete generation request before estimating" in content
    assert "copy those parameters byte-for-byte" in content


def test_skill_allows_conditional_waiting_for_async_generation() -> None:
    """Skill 应允许根据后续依赖决定是否等待异步生成。"""
    content = SKILL_PATH.read_text(encoding="utf-8")

    assert "wait_canvas_generation only when the completed result is needed now" in content
    assert "preserve the exact `generation_task_id`" in content
    assert "continue without waiting" in content
    assert "never submit a duplicate generation request" in content


def test_canvas_agent_requires_estimate_before_generation_without_protocol_coupling() -> None:
    """Skill 必须要求生成前估算，但不能把估算凭证耦合到生成协议。"""
    agent = (SKILL_PATH.parent.parent.parent / "canvas.agent").read_text(encoding="utf-8")
    skill = SKILL_PATH.read_text(encoding="utf-8")
    video_reference = (SKILL_PATH.parent / "references" / "video-generation.md").read_text(encoding="utf-8")

    assert "estimate_canvas_content_points" in skill
    assert "estimate_canvas_content_points" in video_reference
    assert "point-estimation" in agent
    for content in (agent, skill, video_reference):
        assert "estimate ID" in content or "estimate result ID" in content or "estimate_id" in content
    assert "does not require or validate an estimate ID" in agent
    assert "does not receive or validate an `estimate_id`" in skill
