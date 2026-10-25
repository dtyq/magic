from __future__ import annotations

import base64
from pathlib import Path

import pytest
from PIL import Image

from agentlang.chat_history.chat_history_models import UserMessage, UserMessageContentPart
from app.service.multimodal_message_renderer import LLMMessageRenderer


class _URLFileService:
    calls = []

    async def get_workspace_file_url(self, file_path: Path, **kwargs) -> str:
        self.calls.append((file_path, kwargs))
        return f"https://workspace.example/{len(self.calls)}.png"


@pytest.mark.asyncio
async def test_renderer_keeps_only_first_five_images_without_inline_overflow_prompt(
    tmp_path,
    monkeypatch,
):
    """数量超限由 Horizon 预先提示，渲染器不得污染用户消息。"""
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    for index in range(6):
        (workspace / f"image-{index}.png").write_bytes(b"image")

    async def fake_base64(self, *args, **kwargs):
        return "data:image/png;base64," + base64.b64encode(b"image").decode()

    monkeypatch.setattr(
        "app.service.multimodal_message_renderer.ImageCompressionService.get_base64",
        fake_base64,
    )
    monkeypatch.setattr(
        "app.service.multimodal_message_renderer.config.get",
        lambda key, default=None: 5
        if key == "llm.native_visual_max_image_refs"
        else default,
    )
    parts = [UserMessageContentPart.text_part("Inspect these images.")]
    parts.extend(UserMessageContentPart.image_ref(f"image-{index}.png") for index in range(6))
    renderer = LLMMessageRenderer(workspace_dir=workspace)

    result = await renderer.render_messages_with_horizon_hint(
        [UserMessage(content="Inspect these images.", content_parts=parts)],
        supports_multimodal=True,
    )

    content = result.messages[0]["content"]
    assert sum(item["type"] == "image_url" for item in content) == 5
    assert content[1]["type"] == "image_url"
    assert len(content) == 6
    assert result.horizon_hint is None


@pytest.mark.asyncio
async def test_renderer_limits_each_user_message_without_changing_visual_history(
    tmp_path,
    monkeypatch,
):
    """图片上限按消息独立计算，历史视觉参数必须保持稳定。"""
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    for index in range(4):
        (workspace / f"image-{index}.png").write_bytes(b"image")

    async def fake_base64(self, image_path, *args, **kwargs):
        encoded_path = base64.b64encode(image_path.encode()).decode()
        return f"data:image/png;base64,{encoded_path}"

    monkeypatch.setattr(
        "app.service.multimodal_message_renderer.ImageCompressionService.get_base64",
        fake_base64,
    )
    monkeypatch.setattr(
        "app.service.multimodal_message_renderer.config.get",
        lambda key, default=None: 2
        if key == "llm.native_visual_max_image_refs"
        else default,
    )
    history_parts = [
        UserMessageContentPart.image_ref(f"image-{index}.png")
        for index in range(3)
    ]
    current_parts = [UserMessageContentPart.image_ref("image-3.png")]
    renderer = LLMMessageRenderer(workspace_dir=workspace)

    history_message = UserMessage(content="History", content_parts=history_parts)
    initial_rendered = await renderer.render_messages(
        [history_message],
        supports_multimodal=True,
    )
    rendered = await renderer.render_messages(
        [
            history_message,
            UserMessage(
                content="Inspect the current image",
                content_parts=current_parts,
            ),
            UserMessage(
                content="<system_injected_context />",
                show_in_ui=False,
                source="horizon",
            ),
            UserMessage(
                content="<project_instructions />",
                show_in_ui=False,
                source="project_instruction_index:test",
            ),
        ],
        supports_multimodal=True,
    )

    assert rendered[0] == initial_rendered[0]
    assert sum(item["type"] == "image_url" for item in rendered[0]["content"]) == 2
    assert sum(item["type"] == "image_url" for item in rendered[1]["content"]) == 1
    assert rendered[1]["content"][0]["type"] == "image_url"
    assert "image-3.png" in base64.b64decode(
        rendered[1]["content"][0]["image_url"]["url"].split(",", 1)[1]
    ).decode()


@pytest.mark.asyncio
async def test_renderer_selects_native_visual_message_before_horizon_update(tmp_path, monkeypatch):
    """视觉工具追加消息不受 Chat 数量配置限制，也不应被 Horizon 遮蔽。"""
    for image_name in ("image-1.png", "image-2.png"):
        (tmp_path / image_name).write_bytes(b"image")

    async def fake_base64(self, *args, **kwargs):
        return "data:image/webp;base64,aW1hZ2U="

    monkeypatch.setattr(
        "app.service.multimodal_message_renderer.ImageCompressionService.get_base64",
        fake_base64,
    )
    monkeypatch.setattr(
        "app.service.multimodal_message_renderer.config.get",
        lambda key, default=None: 1
        if key == "llm.native_visual_max_image_refs"
        else default,
    )
    renderer = LLMMessageRenderer(workspace_dir=tmp_path)

    rendered = await renderer.render_messages(
        [
            UserMessage(content="Initial request"),
            UserMessage(
                content="Inspect the image",
                show_in_ui=False,
                source="native_visual",
                content_parts=[
                    UserMessageContentPart.image_ref("image-1.png"),
                    UserMessageContentPart.image_ref("image-2.png"),
                ],
            ),
            UserMessage(
                content="<system_injected_context />",
                show_in_ui=False,
                source="horizon",
            ),
        ],
        supports_multimodal=True,
    )

    assert sum(item["type"] == "image_url" for item in rendered[1]["content"]) == 2


@pytest.mark.asyncio
async def test_renderer_preserves_history_image_for_current_text_message(
    tmp_path,
    monkeypatch,
):
    """当前用户只发文字时，历史消息的视觉参数仍应保持不变。"""
    image_path = tmp_path / "history.png"
    image_path.write_bytes(b"image")

    async def fake_base64(self, *args, **kwargs):
        return "data:image/webp;base64,aW1hZ2U="

    monkeypatch.setattr(
        "app.service.multimodal_message_renderer.ImageCompressionService.get_base64",
        fake_base64,
    )
    renderer = LLMMessageRenderer(workspace_dir=tmp_path)

    rendered = await renderer.render_messages(
        [
            UserMessage(
                content="History image",
                content_parts=[
                    UserMessageContentPart.text_part("History image"),
                    UserMessageContentPart.image_ref("history.png"),
                ],
            ),
            UserMessage(content="Current text only"),
        ],
        supports_multimodal=True,
    )

    assert rendered[0]["content"][0]["text"] == "History image"
    assert rendered[0]["content"][1]["type"] == "image_url"
    assert rendered[1]["content"] == "Current text only"


@pytest.mark.asyncio
async def test_renderer_falls_back_when_image_is_missing(tmp_path):
    renderer = LLMMessageRenderer(workspace_dir=tmp_path)

    result = await renderer.render_messages_with_horizon_hint(
        [UserMessage(content="Read it", content_parts=[UserMessageContentPart.image_ref("removed.png")])],
        supports_multimodal=True,
    )

    assert result.messages[0]["content"] == "Read it"
    assert result.horizon_hint is not None
    assert 'path="removed.png"' in result.horizon_hint
    assert 'reason="the image file was removed"' in result.horizon_hint


@pytest.mark.asyncio
async def test_renderer_uses_text_path_for_non_multimodal_models(tmp_path):
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    (workspace / "image.png").write_bytes(b"image")
    renderer = LLMMessageRenderer(workspace_dir=workspace)

    result = await renderer.render_messages_with_horizon_hint(
        [UserMessage(content="Read it", content_parts=[UserMessageContentPart.image_ref("image.png")])],
        supports_multimodal=False,
    )

    assert result.messages[0]["content"] == "Read it"
    assert result.horizon_hint is not None
    assert (
        'reason="the current model does not support native visual input"'
        in result.horizon_hint
    )


@pytest.mark.asyncio
async def test_renderer_drops_native_visual_instruction_when_falling_back(tmp_path):
    """非多模态模型回退时应保留用户问题，移除原生视觉专用提示。"""
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    (workspace / "image.png").write_bytes(b"image")
    parts = [
        UserMessageContentPart.text_part("Read it"),
        UserMessageContentPart.text_part(
            "Answer directly from the native image.",
            include_in_fallback=False,
        ),
        UserMessageContentPart.image_ref("image.png"),
    ]
    renderer = LLMMessageRenderer(workspace_dir=workspace)

    result = await renderer.render_messages_with_horizon_hint(
        [UserMessage(content="Read it", content_parts=parts)],
        supports_multimodal=False,
    )

    assert result.messages[0]["content"] == "Read it"
    assert result.horizon_hint is not None
    assert "Answer directly from the native image." not in result.horizon_hint


@pytest.mark.asyncio
async def test_renderer_keeps_generic_non_fallback_text_when_an_image_is_rendered(
    tmp_path,
    monkeypatch,
):
    """渲染器仍兼容通用的仅原生载荷文本部件。"""
    image_path = tmp_path / "image.png"
    image_path.write_bytes(b"image")
    async def fake_base64(self, *args, **kwargs):
        return "data:image/webp;base64,aW1hZ2U="

    monkeypatch.setattr(
        "app.service.multimodal_message_renderer.ImageCompressionService.get_base64",
        fake_base64,
    )
    parts = [
        UserMessageContentPart.text_part("Read it"),
        UserMessageContentPart.text_part(
            "Answer directly from the native image.",
            include_in_fallback=False,
        ),
        UserMessageContentPart.image_ref(str(image_path)),
    ]
    renderer = LLMMessageRenderer(workspace_dir=tmp_path)

    rendered = await renderer.render_messages(
        [UserMessage(content="Read it", content_parts=parts)],
        supports_multimodal=True,
    )

    assert rendered[0]["content"][0]["text"] == "Read it"
    assert rendered[0]["content"][1]["text"] == "Answer directly from the native image."
    assert rendered[0]["content"][2]["type"] == "image_url"


@pytest.mark.asyncio
async def test_renderer_downgrades_when_budget_is_exceeded(tmp_path, monkeypatch):
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    (workspace / "a.png").write_bytes(b"a")
    (workspace / "b.png").write_bytes(b"b")

    budget = 10 * 1024 * 1024

    async def fake_base64(self, path, *args, **kwargs):
        return "data:image/webp;base64," + ("x" * (budget - 100))

    monkeypatch.setattr(
        "app.service.multimodal_message_renderer.ImageCompressionService.get_base64",
        fake_base64,
    )
    monkeypatch.setattr(
        "app.service.multimodal_message_renderer.config.get",
        lambda key, default=None: budget
        if key == "llm.native_visual_max_image_bytes"
        else default,
    )
    parts = [
        UserMessageContentPart.image_ref("a.png"),
        UserMessageContentPart.image_ref("b.png"),
    ]
    renderer = LLMMessageRenderer(workspace_dir=workspace)

    result = await renderer.render_messages_with_horizon_hint(
        [UserMessage(content="Read them", content_parts=parts)],
        supports_multimodal=True,
    )

    assert result.messages[0]["content"][0]["type"] == "image_url"
    assert len(result.messages[0]["content"]) == 1
    assert result.horizon_hint is not None
    assert "the request image budget was exceeded" in result.horizon_hint


@pytest.mark.asyncio
async def test_renderer_uses_webp_base64_for_workspace_image(tmp_path, monkeypatch):
    """工作区图片应直接使用 WebP Base64，不调用工作区 URL。"""
    _URLFileService.calls = []
    image_path = tmp_path / "image.png"
    image_path.write_bytes(b"image")
    base64_calls = []

    async def fake_base64(self, *args, **kwargs):
        base64_calls.append(args[0])
        return "data:image/webp;base64,aW1hZ2U="

    monkeypatch.setattr(
        "app.service.multimodal_message_renderer.ImageCompressionService.get_base64",
        fake_base64,
    )
    monkeypatch.setattr(
        "app.service.file_service.FileService",
        _URLFileService,
    )
    renderer = LLMMessageRenderer(workspace_dir=tmp_path)

    rendered = await renderer.render_messages(
        [UserMessage(content="Read it", content_parts=[UserMessageContentPart.image_ref("image.png")])],
        supports_multimodal=True,
    )

    assert rendered[0]["content"][0]["image_url"]["url"].startswith("data:image/webp")
    assert base64_calls == [str(image_path)]
    assert _URLFileService.calls == []


@pytest.mark.asyncio
async def test_renderer_uses_webp_base64_for_large_workspace_image(tmp_path, monkeypatch):
    """工作区大图应通过 WebP Base64 缩放后传输。"""
    _URLFileService.calls = []
    image_path = tmp_path / "large.png"
    image = Image.new("RGB", (4000, 3000), color="white")
    image.save(image_path, format="PNG")
    image.close()

    renderer = LLMMessageRenderer(workspace_dir=tmp_path)

    rendered = await renderer.render_messages(
        [UserMessage(content="Read it", content_parts=[UserMessageContentPart.image_ref("large.png")])],
        supports_multimodal=True,
    )

    assert rendered[0]["content"][0]["type"] == "image_url"
    assert rendered[0]["content"][0]["image_url"]["url"].startswith("data:image/webp")
    assert _URLFileService.calls == []


@pytest.mark.asyncio
async def test_renderer_uses_webp_base64_without_workspace_url(tmp_path, monkeypatch):
    """工作区 URL 不可用时也不应影响 WebP Base64 传输。"""
    image_path = tmp_path / "image.png"
    image_path.write_bytes(b"image")

    async def fake_base64(self, *args, **kwargs):
        return "data:image/webp;base64,aW1hZ2U="

    class _FailingURLFileService:
        async def get_workspace_file_url(self, file_path: Path) -> str:
            raise RuntimeError("mock url failure")

    monkeypatch.setattr(
        "app.service.multimodal_message_renderer.ImageCompressionService.get_base64",
        fake_base64,
    )
    monkeypatch.setattr(
        "app.service.file_service.FileService",
        _FailingURLFileService,
    )
    renderer = LLMMessageRenderer(workspace_dir=tmp_path)

    rendered = await renderer.render_messages(
        [UserMessage(content="Read it", content_parts=[UserMessageContentPart.image_ref("image.png")])],
        supports_multimodal=True,
    )

    assert rendered[0]["content"][0]["image_url"]["url"].startswith("data:image/webp")


@pytest.mark.asyncio
async def test_renderer_uses_base64_for_external_file_even_when_url_mode_enabled(tmp_path, monkeypatch):
    """工作区外绝对路径不能生成 URL，应直接使用 base64。"""
    _URLFileService.calls = []
    external_image = tmp_path / "external.png"
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    external_image.write_bytes(b"image")

    async def fake_base64(self, *args, **kwargs):
        return "data:image/webp;base64,aW1hZ2U="

    monkeypatch.setattr(
        "app.service.multimodal_message_renderer.ImageCompressionService.get_base64",
        fake_base64,
    )
    monkeypatch.setattr(
        "app.service.file_service.FileService",
        _URLFileService,
    )
    renderer = LLMMessageRenderer(workspace_dir=workspace)

    rendered = await renderer.render_messages(
        [UserMessage(content="Read it", content_parts=[UserMessageContentPart.image_ref(str(external_image))])],
        supports_multimodal=True,
    )

    assert rendered[0]["content"][0]["image_url"]["url"].startswith("data:image/webp")
    assert _URLFileService.calls == []


@pytest.mark.asyncio
async def test_renderer_disables_url_mode_with_environment_variable(tmp_path, monkeypatch):
    """VISUAL_URL_MODE_ENABLED=false 时工作区图片直接使用 base64。"""
    _URLFileService.calls = []
    image_path = tmp_path / "image.png"
    image_path.write_bytes(b"image")

    async def fake_base64(self, *args, **kwargs):
        return "data:image/webp;base64,aW1hZ2U="

    monkeypatch.setenv("VISUAL_URL_MODE_ENABLED", "false")
    monkeypatch.setattr(
        "app.service.multimodal_message_renderer.ImageCompressionService.get_base64",
        fake_base64,
    )
    monkeypatch.setattr(
        "app.service.file_service.FileService",
        _URLFileService,
    )
    renderer = LLMMessageRenderer(workspace_dir=tmp_path)

    rendered = await renderer.render_messages(
        [UserMessage(content="Read it", content_parts=[UserMessageContentPart.image_ref("image.png")])],
        supports_multimodal=True,
    )

    assert rendered[0]["content"][0]["image_url"]["url"].startswith("data:image/webp")
    assert _URLFileService.calls == []


@pytest.mark.asyncio
async def test_renderer_rejects_relative_path_escape(tmp_path):
    """相对图片引用不能借助父目录跳出工作区。"""
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    (tmp_path / "external.png").write_bytes(b"image")
    renderer = LLMMessageRenderer(workspace_dir=workspace)

    result = await renderer.render_messages_with_horizon_hint(
        [UserMessage(content="Read it", content_parts=[UserMessageContentPart.image_ref("../external.png")])],
        supports_multimodal=True,
    )

    assert result.messages[0]["content"] == "Read it"
    assert result.horizon_hint is not None
    assert "the image path is outside the workspace" in result.horizon_hint


def test_user_message_positional_arguments_remain_compatible():
    message = UserMessage("content", "user", "2026-09-01 00:00:00", True, "legacy")
    assert message.source == "legacy"
    assert message.content_parts is None


def test_default_processing_limit_keeps_bounded_expanded_caches():
    """默认每批只处理前 10 张图片，内存缓存仍应保持扩大的硬上限。"""
    assert LLMMessageRenderer.MAX_NATIVE_IMAGE_REFS == 10
    assert LLMMessageRenderer.MAX_HISTORY_NATIVE_IMAGE_REFS == 20
    assert LLMMessageRenderer.MAX_NATIVE_IMAGE_BYTES == -1
    assert LLMMessageRenderer.MAX_CACHE_ENTRIES == 32
    assert LLMMessageRenderer.MAX_CACHE_BYTES == 128 * 1024 * 1024


def test_renderer_loads_native_visual_limits_from_config(tmp_path, monkeypatch):
    """渲染器应从统一配置中加载图片和缓存限额。"""
    values = {
        "llm.native_visual_max_image_refs": 6,
        "llm.native_visual_max_history_image_refs": 20,
        "llm.native_visual_max_image_bytes": 8_000_000,
        "llm.native_visual_cache_max_entries": 12,
        "llm.native_visual_cache_max_bytes": 64_000_000,
    }
    monkeypatch.setattr(
        "app.service.multimodal_message_renderer.config.get",
        lambda key, default=None: values.get(key, default),
    )

    renderer = LLMMessageRenderer(workspace_dir=tmp_path)

    assert renderer.max_native_image_refs == 6
    assert renderer.max_history_image_refs == 20
    assert renderer.max_native_image_bytes == 8_000_000
    assert renderer.max_cache_entries == 12
    assert renderer.max_cache_bytes == 64_000_000


def test_renderer_limits_persisted_native_image_refs(tmp_path, monkeypatch):
    """写入原生视觉消息前应按配置去重并截断图片引用。"""
    monkeypatch.setattr(
        "app.service.multimodal_message_renderer.config.get",
        lambda key, default=None: 3
        if key == "llm.native_visual_max_image_refs"
        else default,
    )
    renderer = LLMMessageRenderer(workspace_dir=tmp_path)

    selected = renderer.limit_chat_native_image_refs(
        ["a.png", "b.png", "a.png", "c.png", "d.png"]
    )

    assert selected == ["a.png", "b.png", "c.png"]


def test_renderer_falls_back_for_invalid_native_visual_config(tmp_path, monkeypatch):
    """非法配置不应关闭缓存边界或改变默认请求策略。"""
    values = {
        "llm.native_visual_max_image_refs": -2,
        "llm.native_visual_max_history_image_refs": -3,
        "llm.native_visual_max_image_bytes": "invalid",
        "llm.native_visual_cache_max_entries": 0,
        "llm.native_visual_cache_max_bytes": -1,
    }
    monkeypatch.setattr(
        "app.service.multimodal_message_renderer.config.get",
        lambda key, default=None: values.get(key, default),
    )

    renderer = LLMMessageRenderer(workspace_dir=tmp_path)

    assert renderer.max_native_image_refs == LLMMessageRenderer.MAX_NATIVE_IMAGE_REFS
    assert renderer.max_history_image_refs == LLMMessageRenderer.MAX_HISTORY_NATIVE_IMAGE_REFS
    assert renderer.max_native_image_bytes == LLMMessageRenderer.MAX_NATIVE_IMAGE_BYTES
    assert renderer.max_cache_entries == LLMMessageRenderer.MAX_CACHE_ENTRIES
    assert renderer.max_cache_bytes == LLMMessageRenderer.MAX_CACHE_BYTES


@pytest.mark.asyncio
async def test_renderer_skips_messages_marked_out_of_native_visual(
    tmp_path,
    monkeypatch,
):
    """已经关闭原生视觉的历史消息不应再把图片送进请求。"""
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    (workspace / "old.png").write_bytes(b"image")
    (workspace / "new.png").write_bytes(b"image")

    async def fake_base64(self, image_path, *args, **kwargs):
        encoded_path = base64.b64encode(str(image_path).encode()).decode()
        return f"data:image/png;base64,{encoded_path}"

    monkeypatch.setattr(
        "app.service.multimodal_message_renderer.ImageCompressionService.get_base64",
        fake_base64,
    )
    renderer = LLMMessageRenderer(workspace_dir=workspace)
    old_message = UserMessage(
        content="old",
        content_parts=[
            UserMessageContentPart.text_part("old"),
            UserMessageContentPart.image_ref("old.png"),
        ],
        include_in_native_visual=False,
    )
    current = UserMessage(
        content="new",
        content_parts=[
            UserMessageContentPart.text_part("new"),
            UserMessageContentPart.image_ref("new.png"),
        ],
    )

    result = await renderer.render_messages_with_horizon_hint(
        [old_message, current],
        supports_multimodal=True,
    )

    assert result.messages[0]["content"] == "old"
    assert isinstance(result.messages[1]["content"], list)
    assert sum(item["type"] == "image_url" for item in result.messages[1]["content"]) == 1
