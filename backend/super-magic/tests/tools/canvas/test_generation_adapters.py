"""Canvas 生成适配器的路径边界测试。"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.tools.canvas.application.commands import GenerationParameters
from app.tools.canvas.generation.adapters.generic_image_generation_port import GenericImageGenerationPort
from app.tools.canvas.generation.contracts.generation_request import GenerationRequest


@pytest.mark.asyncio
async def test_generic_image_generation_port_converts_project_reference_path(monkeypatch, tmp_path) -> None:
    """项目相对参考图必须转换为通用生图工具可解析的工作区相对路径。"""
    captured: dict[str, object] = {}

    class FakeGenerateImages:
        """捕获通用生图工具入参的 mock。"""

        def __init__(self, base_dir):
            self.base_dir = base_dir

        async def execute_purely(
            self,
            tool_context,
            params,
            *,
            model_id=None,
            on_task_created=None,
            report_progress=True,
        ):
            captured["task"] = params.tasks[0]
            captured["on_task_created"] = on_task_created
            captured["report_progress"] = report_progress
            return SimpleNamespace(
                ok=True,
                extra_info={"saved_images": [str(tmp_path / "Canvas" / "Demo" / "images" / "output.png")]},
            )

    monkeypatch.setattr("app.tools.generate_images.GenerateImages", FakeGenerateImages)

    async def on_task_created(task_id, expected_finished_at, started_at):
        """请求上的建单回调必须原样透传给生图工具。"""

    result = await GenericImageGenerationPort(tmp_path).submit(
        GenerationRequest(
            project_path="Canvas/Demo",
            element_id="element-1",
            content_id="content-1",
            element_type="image",
            parameters=GenerationParameters(
                prompt="mock prompt",
                size="1024x1024",
                name="产品/主视觉",
                reference_images=("./images/reference.png",),
            ),
            on_task_created=on_task_created,
        ),
        None,
    )

    assert captured["on_task_created"] is on_task_created
    assert captured["report_progress"] is False

    assert result.status == "completed"
    assert captured["task"].reference_images == ["Canvas/Demo/images/reference.png"]
    assert captured["task"].name.startswith("产品_主视觉_")
    assert captured["task"].name[-14:].isdigit()
    assert result.request_metadata["mode"] == "edit"
    assert result.request_metadata["image_id"] == "output"
    assert result.request_metadata["reference_images"] == ["./images/reference.png"]


@pytest.mark.asyncio
async def test_generic_image_generation_port_rejects_missing_model_name(tmp_path) -> None:
    """生成图片缺少模型命名时不得退化为 Content ID。"""
    with pytest.raises(ValueError, match="require a model-provided name"):
        await GenericImageGenerationPort(tmp_path).submit(
            GenerationRequest(
                project_path="Canvas/Demo",
                element_id="element-1",
                content_id="content-1",
                element_type="image",
                parameters=GenerationParameters(prompt="mock prompt"),
            ),
            None,
        )
