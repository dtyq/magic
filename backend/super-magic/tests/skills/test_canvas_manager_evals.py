"""Canvas Manager Skill eval 场景清单的契约测试。"""

from __future__ import annotations

import json
from pathlib import Path


SKILL_ROOT = Path(__file__).parents[2] / "agents" / "skills" / "canvas-manager"
PUBLIC_TOOLS = {
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
}


def test_canvas_manager_evals_are_complete_and_refer_to_existing_assets() -> None:
    """所有 eval 场景都必须可加载，并且只能引用新 Canvas 链路。"""
    eval_files = sorted((SKILL_ROOT / "evals").glob("*.json"))

    assert len(eval_files) == 19
    identifiers: set[str] = set()
    for path in eval_files:
        payload = json.loads(path.read_text(encoding="utf-8"))
        identifier = payload.get("id")
        assert isinstance(identifier, str) and identifier
        assert identifier not in identifiers
        identifiers.add(identifier)
        assert isinstance(payload.get("prompt"), str) and payload["prompt"]

        expected_tools = payload.get("expected_tools", [])
        assert set(expected_tools) <= PUBLIC_TOOLS
        forbidden_tools = payload.get("forbidden_tools", [])
        assert set(forbidden_tools) <= PUBLIC_TOOLS | {
            "read_files",
            "write_file",
            "edit_file",
            "delete_files",
            "shell_exec",
            "edit_canvas_nodes",
        }
        assert (
            payload.get("constraints")
            or payload.get("expected_behavior")
            or payload.get("forbidden_behavior")
            or payload.get("forbidden_tools")
        )

        reference = payload.get("expected_reference")
        if reference:
            assert (SKILL_ROOT / reference).is_file()

    assert identifiers == {
        "asset-reconciliation-routing",
        "async-generation-lifecycle",
        "basic-canvas",
        "connection-direction",
        "design-candidate-workflow",
        "detailed-video-production",
        "frame-cross-tool",
        "frame-hierarchy-lifecycle",
        "managed-field-guard",
        "media-reference-routing",
        "multi-content-lifecycle",
        "ordinary-video-workflow",
        "storyboard-first-frame-flow",
        "tool-chaining",
        "project-boundary",
        "prompt-inspiration-routing",
        "point-estimate-lifecycle",
        "video-composition-lifecycle",
        "image-search-import",
    }


def test_canvas_manager_evals_cover_generation_frame_and_safety_boundaries() -> None:
    """eval 清单必须覆盖生成、Frame、删除边界和协议隔离。"""
    payloads = [
        json.loads(path.read_text(encoding="utf-8"))
        for path in sorted((SKILL_ROOT / "evals").glob("*.json"))
    ]
    text = json.dumps(payloads, ensure_ascii=False)

    for expected in (
        "wait_canvas_generation",
        "frame_canvas_elements",
        "add_canvas_contents",
        "retry_canvas_content_generation",
        "Never delete Canvas Elements or Content",
        "Do not append Content or create a generation task for the Frame",
        "video-edit Content",
        "final MP4",
        "row_incremental",
        "dependency layout",
        "byte-for-byte",
        "asset://virtual-human-asset-id",
    ):
        assert expected in text
