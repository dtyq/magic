"""Canvas 生成反馈的纯 Mock 测试。"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import pytest

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import (
    DisplayType,
    OperationResultItem,
    OperationResultListContent,
    ToolDetail,
)
from app.i18n import I18nManager
from app.tools.canvas.presentation import (
    CanvasGenerationFeedback,
    CanvasToolDetailBuilder,
    batch_tool_result,
    canvas_result_remark,
    summarize_items,
)
from app.tools.canvas.tools.add_canvas_contents import AddCanvasContents
from app.tools.canvas.tools.add_canvas_elements import AddCanvasElements


def _arguments(*contents: tuple[str, str, str]) -> dict[str, object]:
    """构造不依赖真实项目的批量生成参数。"""
    return {
        "project_path": "Canvas/Mock",
        "items": [
            {
                "item_ref": item_ref,
                "content": {"source": source, "content_type": content_type},
            }
            for item_ref, source, content_type in contents
        ],
    }


def _result(*items: tuple[str, str]) -> ToolResult:
    """构造不依赖真实生成服务的批量结果。"""
    return ToolResult(
        content="mock",
        data={
            "project_path": "Canvas/Mock",
            "items": [
                {"item_ref": item_ref, "status": status, "element_id": f"element-{item_ref}"}
                for item_ref, status in items
            ],
        },
    )


def test_generation_feedback_separates_image_statuses() -> None:
    """图片生成反馈应正确区分完成、处理中和失败。"""
    arguments = _arguments(
        ("image-1", "generated", "image"),
        ("image-2", "generated", "image"),
        ("image-3", "generated", "image"),
    )
    summary = CanvasGenerationFeedback.from_result(
        _result(("image-1", "completed"), ("image-2", "processing"), ("image-3", "failed")),
        arguments,
    )

    I18nManager.set_language("zh_CN")
    try:
        assert CanvasGenerationFeedback.action_key(summary) == "canvas.generate_image"
        assert CanvasGenerationFeedback.remark(summary) == "已生成 1 个图片；1 个图片生成中；1 个图片生成失败"
    finally:
        I18nManager.reset_language()


def test_generation_detail_keeps_each_items_timing() -> None:
    """逐项结果必须携带自己的起止时间，供刷新后的行内百分比恢复。"""
    arguments = _arguments(
        ("image-1", "generated", "image"),
        ("image-2", "generated", "image"),
    )
    result = ToolResult(
        content="mock",
        data={
            "items": [
                {
                    "item_ref": "image-1",
                    "status": "processing",
                    "element_id": "element-1",
                    "started_at": "2026-10-05T10:00:00+08:00",
                    "expected_finished_at": "2026-10-05T10:00:45+08:00",
                },
                {
                    "item_ref": "image-2",
                    "status": "completed",
                    "element_id": "element-2",
                    "started_at": "2026-10-05T10:00:01+08:00",
                    "expected_finished_at": "2026-10-05T10:01:11+08:00",
                },
            ],
        },
    )

    detail = CanvasGenerationFeedback.operation_result_detail(result, arguments)

    assert detail is not None
    assert detail.data.items[0].started_at == "2026-10-05T10:00:00+08:00"
    assert detail.data.items[0].expected_finished_at == "2026-10-05T10:00:45+08:00"
    assert detail.data.items[1].started_at == "2026-10-05T10:00:01+08:00"
    assert detail.data.items[1].expected_finished_at == "2026-10-05T10:01:11+08:00"
    assert detail.data.items[0].is_processing is True
    assert detail.data.items[1].is_processing is False


@pytest.mark.asyncio
async def test_pending_detail_omits_unavailable_item_timing() -> None:
    """并发建单期间尚未返回的时间不能以 null 破坏整张逐项卡。"""
    agent_context = SimpleNamespace(
        context_id="context-1",
        update_activity_time=Mock(),
        dispatch_event=AsyncMock(),
    )
    tool_context = ToolContext(arguments={})
    tool_context.tool_call_id = "tool-1"
    tool_context.register_extension("agent_context", agent_context)
    tool = SimpleNamespace(
        name="generate_canvas_images",
        get_before_tool_call_friendly_action_and_remark=AsyncMock(
            return_value={"action": "Generating", "remark": "Two images"}
        ),
    )
    detail = ToolDetail(
        type=DisplayType.OPERATION_RESULT_LIST,
        data=OperationResultListContent(
            items=[
                OperationResultItem(
                    label="Ready",
                    kind="text",
                    status="success",
                    message="Generating",
                    started_at="2026-10-07T17:14:00+08:00",
                    expected_finished_at="2026-10-07T17:14:45+08:00",
                    is_processing=True,
                ),
                OperationResultItem(
                    label="Waiting",
                    kind="text",
                    status="success",
                    message="Generating",
                    is_processing=True,
                ),
            ]
        ),
    )

    with patch(
        "app.tools.canvas.presentation.generation_feedback.get_correlation_manager"
    ) as get_manager:
        get_manager.return_value.get_active_correlation_id.return_value = "correlation-1"
        await CanvasGenerationFeedback.report_pending_detail(
            tool, tool_context, tool_context.arguments, detail
        )

    event_data = agent_context.dispatch_event.await_args.args[1]
    items = event_data.arguments["detail"]["data"]["items"]
    assert items[0]["started_at"] == "2026-10-07T17:14:00+08:00"
    assert "started_at" not in items[1]
    assert "expected_finished_at" not in items[1]


def test_generation_feedback_ignores_imported_media() -> None:
    """导入素材不能被误报成生成任务。"""
    arguments = _arguments(("import-1", "imported", "image"))
    summary = CanvasGenerationFeedback.from_arguments(arguments)

    assert not CanvasGenerationFeedback.is_pure_generated_batch(arguments)
    assert not summary.is_supported


def test_generation_feedback_describes_whole_batch_failure() -> None:
    """整批调用失败时仍应保留图片/视频语义。"""
    arguments = _arguments(("video-1", "generated", "video"))
    summary = CanvasGenerationFeedback.from_arguments(arguments)

    I18nManager.set_language("zh_CN")
    try:
        assert CanvasGenerationFeedback.failure_remark(summary) == "1 个视频生成失败"
    finally:
        I18nManager.reset_language()


def test_batch_status_preserves_processing_and_partial_semantics() -> None:
    """批量状态聚合不能把处理中误报成失败。"""
    assert summarize_items([{"status": "pending"}]).status == "processing"
    partial = summarize_items([{"status": "completed"}, {"status": "failed"}])
    assert partial.status == "partial"
    assert not partial.ok


def test_batch_status_treats_reused_asset_as_success() -> None:
    """重复导入复用已有素材时不能被批量结果误报为失败。"""
    summary = summarize_items([{"status": "reused"}])

    assert summary.status == "succeeded"
    assert summary.ok


def test_batch_tool_result_and_detail_use_the_same_status() -> None:
    """ToolResult 与详情必须共同使用逐项聚合状态。"""
    result = batch_tool_result(
        "mock",
        {"items": [{"item_ref": "a", "status": "completed"}, {"item_ref": "b", "status": "failed"}]},
    )
    assert result.ok is False
    detail = CanvasToolDetailBuilder("mock", "elements_added", result).build()
    assert "部分完成" in detail.data.content


def test_canvas_tool_detail_builder_adds_markdown_extension() -> None:
    """Canvas Markdown 详情缺少后缀时应自动补齐。"""
    detail = CanvasToolDetailBuilder(
        "add_canvas_elements",
        "elements_added",
        ToolResult(content="mock", data={}),
    ).build()

    assert detail.data.file_name == "add_canvas_elements.md"


def test_canvas_tool_detail_builder_does_not_duplicate_markdown_extension() -> None:
    """Canvas Markdown 详情已有后缀时不应重复追加。"""
    detail = CanvasToolDetailBuilder(
        "add_canvas_elements.md",
        "elements_added",
        ToolResult(content="mock", data={}),
    ).build()

    assert detail.data.file_name == "add_canvas_elements.md"


def test_single_canvas_operation_does_not_use_batch_wording() -> None:
    """单个画布操作使用简洁结果，只有多个项目才展示批量统计。"""
    I18nManager.set_language("zh_CN")
    try:
        single = canvas_result_remark(summarize_items([{"status": "created"}]))
        multiple = canvas_result_remark(
            summarize_items([{"status": "created"}, {"status": "processing"}])
        )
    finally:
        I18nManager.reset_language()

    assert single == "已完成"
    assert "批量" not in single
    assert multiple.startswith("批量操作结果：")


def test_canvas_detail_renders_friendly_input_and_output_markdown() -> None:
    """详情应以小白用户可读的 Markdown 展示入参和出参。"""
    result = ToolResult(
        content="mock success",
        data={
            "project_path": "Canvas/Mock",
            "items": [{"item_ref": "image-1", "status": "completed"}],
            "elements": ["element-1", "element-2"],
        },
    )
    arguments = {
        "project_path": "Canvas/Mock",
        "prompt": "一张产品图",
        "items": [{"item_ref": "image-1", "content": {"source": "generated"}}],
        "api_key": "mock-secret",
    }

    I18nManager.set_language("zh_CN")
    try:
        content = CanvasToolDetailBuilder("mock", "elements_added", result, arguments).build().data.content
    finally:
        I18nManager.reset_language()

    assert "## 输入参数" in content
    assert "## 输出结果" in content
    assert "- 提示词: 一张产品图" in content
    assert "- 项目列表: 共 1 项" in content
    assert "mock-secret" not in content
    assert '"item_ref"' not in content


def test_canvas_detail_keeps_original_failure_reason_for_users() -> None:
    """失败详情应展示原始错误摘要，而不是只显示通用失败文案。"""
    result = ToolResult.error(
        "Canvas operation failed.\n- Error code: MODEL_NOT_SUPPORTED\n- Reason: model x is unsupported"
    )

    I18nManager.set_language("zh_CN")
    try:
        content = CanvasToolDetailBuilder("mock", "elements_added", result, {}).build().data.content
    finally:
        I18nManager.reset_language()

    assert "## 输出结果" in content
    assert "MODEL_NOT_SUPPORTED" in content
    assert "model x is unsupported" in content


@pytest.mark.asyncio
@pytest.mark.parametrize("tool_class", [AddCanvasElements, AddCanvasContents])
async def test_generation_tool_feedback_uses_specific_media_wording(tool_class: type) -> None:
    """新增节点和追加 Content 都应使用具体的图片生成反馈。"""
    arguments = _arguments(
        ("image-1", "generated", "image"),
        ("image-2", "generated", "image"),
    )
    tool = tool_class()
    context = ToolContext()

    I18nManager.set_language("zh_CN")
    try:
        before = await tool.get_before_tool_call_friendly_action_and_remark(tool.name, context, arguments)
        after = await tool.get_after_tool_call_friendly_action_and_remark(
            tool.name,
            context,
            _result(("image-1", "completed"), ("image-2", "completed")),
            0.1,
            arguments,
        )
    finally:
        I18nManager.reset_language()

    assert before["action"] == "正在画布中生成图像"
    assert before["remark"] == "image-1、image-2"
    assert after["action"] == "在画布中生成图像"
    assert after["remark"] == "image-1已生成；image-2已生成"
