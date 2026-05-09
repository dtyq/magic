import pytest

from app.tools.design.tools.generate_canvas_videos import VideoTaskSpec
from app.tools.generate_video import GenerateVideo, GenerateVideoParams


@pytest.mark.asyncio
async def test_resolve_input_uri_prefers_file_to_url_for_local_path(monkeypatch, tmp_path):
    tool = GenerateVideo(base_dir=str(tmp_path))
    calls = []

    def fake_file_to_url(path: str) -> str:
        calls.append(path)
        return "https://cdn.example.com/ref.jpg"

    monkeypatch.setattr("app.tools.generate_video.file_to_url", fake_file_to_url)

    result = await tool._resolve_input_uri("images/ref.jpg")

    assert result == "https://cdn.example.com/ref.jpg"
    assert calls == ["images/ref.jpg"]


@pytest.mark.asyncio
async def test_resolve_input_uri_falls_back_to_base64_when_file_to_url_fails(
    monkeypatch,
    tmp_path,
):
    image_path = tmp_path / "images" / "ref.jpg"
    image_path.parent.mkdir(parents=True)
    image_path.write_bytes(b"fake-image")

    tool = GenerateVideo(base_dir=str(tmp_path))
    base64_calls = []

    def fake_file_to_url(path: str) -> str:
        raise RuntimeError("download url service unavailable")

    async def fake_local_file_to_base64(path: str) -> str:
        base64_calls.append(path)
        return "data:image/jpeg;base64,ZmFrZS1pbWFnZQ=="

    monkeypatch.setattr("app.tools.generate_video.file_to_url", fake_file_to_url)
    monkeypatch.setattr("app.tools.generate_video.local_file_to_base64", fake_local_file_to_base64)

    result = await tool._resolve_input_uri("images/ref.jpg")

    assert result == "data:image/jpeg;base64,ZmFrZS1pbWFnZQ=="
    assert base64_calls == [str(image_path.resolve())]


@pytest.mark.asyncio
async def test_build_create_payload_uses_explicit_video_edit_mode_and_task(tmp_path):
    tool = GenerateVideo(base_dir=str(tmp_path))

    payload, _, _ = await tool._build_create_payload(
        GenerateVideoParams(
            prompt="把参考视频改成水彩风格",
            input_mode="video_edit",
            task="edit",
            reference_video_paths=["https://cdn.example.com/source.mp4"],
        ),
        model_id="kling-v3-omni",
        video_id="video-1",
    )

    assert payload["input_mode"] == "video_edit"
    assert payload["task"] == "edit"
    assert payload["inputs"]["reference_videos"] == [
        {"uri": "https://cdn.example.com/source.mp4"}
    ]


def test_video_task_spec_normalizes_input_mode_aliases_from_llm():
    task = VideoTaskSpec(
        prompt="把参考视频改成水彩风格",
        name="水彩视频编辑",
        width=1280,
        height=720,
        inputMode="video_editing",
        task="edit",
    )

    assert task.input_mode == "video_edit"
    assert task.task == "edit"
