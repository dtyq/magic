from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from PIL import Image

from agentlang.chat_history.chat_history_models import UserMessage
from app.service.native_visual_message_builder import NativeVisualMessageBuilder
from app.tools.visual_understanding import VisualUnderstanding, VisualUnderstandingParams
from app.tools.visual_understanding_utils.models import BatchImageProcessingResults


@pytest.mark.asyncio
async def test_visual_understanding_reports_request_entity_too_large(monkeypatch):
    async def fake_call_with_fallback(*args, **kwargs):
        raise RuntimeError("413 Request Entity Too Large")

    monkeypatch.setattr(
        "app.tools.visual_understanding.LLMRequestHandler.call_with_fallback",
        fake_call_with_fallback,
    )
    tool = VisualUnderstanding()

    result = await tool._call_llm_for_visual_understanding(
        query="分析图片",
        batch_results=BatchImageProcessingResults(),
        model_id="qwen3.5-flash",
        images=["page-1.png", "page-2.png"],
    )

    assert not result.ok
    assert "request too large" in result.content
    assert "reduce the image count" in result.content


@pytest.mark.asyncio
async def test_native_visual_prompt_uses_horizon_instead_of_user_message(
    tmp_path,
    monkeypatch,
):
    """原生视觉说明和图片元数据只能进入 Horizon 提示。"""
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    image_path = workspace / "chart.png"
    image = Image.new("RGB", (100, 50), color="blue")
    image.save(image_path, format="PNG")
    image.close()

    messages = []
    agent_context = SimpleNamespace(
        model_context=SimpleNamespace(
            resolve_text_model=lambda: SimpleNamespace(
                config=SimpleNamespace(supports_multimodal=True),
            )
        ),
        horizon=SimpleNamespace(push_user_message=messages.append),
    )
    tool_context = SimpleNamespace(get_extension=lambda name: agent_context)
    monkeypatch.setattr(
        "app.tools.visual_understanding.PathManager.get_workspace_dir",
        classmethod(lambda cls: workspace),
    )

    tool = VisualUnderstanding.__new__(VisualUnderstanding)
    injected = await tool._inject_native_visual_user_message(
        tool_context,
        ["chart.png"],
        "分析图表",
        provide_native_visual=True,
    )

    assert injected is True
    assert len(messages) == 1
    message = messages[0]
    assert isinstance(message, UserMessage)
    assert [part.type for part in message.content_parts] == ["text", "image_ref"]
    assert message.content_parts[0].text == "分析图表"

    hint = await NativeVisualMessageBuilder(workspace).build_horizon_hint(["chart.png"])

    assert "already available as native visual input" in hint
    assert "## Image dimensions" in hint
    assert "100×50 pixels" in hint


@pytest.mark.asyncio
async def test_native_visual_tool_result_keeps_minimal_read_instruction():
    """原生视觉工具结果不能为空，也不应重复解释机制。"""
    tool = VisualUnderstanding.__new__(VisualUnderstanding)
    tool._image_processor = SimpleNamespace(
        smart_download_enabled=False,
        copied_files=[],
    )
    tool._inject_native_visual_user_message = AsyncMock(return_value=True)

    result = await tool.execute_purely(
        VisualUnderstandingParams(images=["chart.png"], query="分析图表"),
        tool_context=SimpleNamespace(),
        provide_native_visual=True,
    )

    assert result.content == "Please read the image(s)."
    assert "visual_understanding" not in result.content
    assert "native visual" not in result.content
