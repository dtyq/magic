"""Canvas 文件列表视频合成服务的 mock 测试。"""

from pathlib import Path

import pytest

from app.tools.canvas.production.services.file_video_composition_service import (
    FileVideoCompositionService,
)


class _MockCompositionPort:
    """提供固定媒体信息的 mock 合成端口。"""

    def __init__(self, infos: list[tuple[int, int, float, bool]]) -> None:
        """保存待返回的媒体信息。"""
        self._infos = iter(infos)

    async def inspect_video(self, _path: Path, _interruption_event=None):
        """返回预置媒体规格。"""
        return next(self._infos)


@pytest.mark.asyncio
async def test_default_dimensions_follow_first_video(tmp_path: Path) -> None:
    """未提供 generation 时使用第一个视频的偶数尺寸。"""
    first = tmp_path / "project" / "videos" / "a.mp4"
    second = tmp_path / "project" / "videos" / "b.mp4"
    first.parent.mkdir(parents=True)
    first.write_bytes(b"mock")
    second.write_bytes(b"mock")
    service = FileVideoCompositionService(
        _MockCompositionPort([(1921, 1081, 3.0, True), (1080, 1920, 4.0, False)])
    )

    plan = await service.build_plan(
        workspace_dir=tmp_path,
        file_dir="/project/videos/",
        composition={
            "videos": [
                {"path": "/project/videos/a.mp4"},
                {"path": "/project/videos/b.mp4"},
            ]
        },
        generation={},
        output_file_name="",
        task_id="task-1",
    )

    assert (plan.request.width, plan.request.height) == (1922, 1082)
    assert plan.output_relative_path == "./project/videos/composition-task-1.mp4"


@pytest.mark.asyncio
async def test_explicit_generation_overrides_dimensions(tmp_path: Path) -> None:
    """显式 generation 规格覆盖首个视频尺寸。"""
    source = tmp_path / "video.mp4"
    source.write_bytes(b"mock")
    service = FileVideoCompositionService(
        _MockCompositionPort([(1920, 1080, 3.0, False)])
    )

    plan = await service.build_plan(
        workspace_dir=tmp_path,
        file_dir="/videos",
        composition={"videos": [{"path": "/video.mp4"}]},
        generation={"aspect_ratio": "9:16", "resolution": "480p"},
        output_file_name="final.mp4",
        task_id="task-2",
    )

    assert (plan.request.width, plan.request.height) == (480, 854)


@pytest.mark.asyncio
async def test_numeric_resolution_is_converted_to_requested_short_side(tmp_path: Path) -> None:
    """任意数字短边分辨率应参与输出尺寸计算。"""
    source = tmp_path / "video.mp4"
    source.write_bytes(b"mock")
    service = FileVideoCompositionService(
        _MockCompositionPort([(1344, 768, 3.0, True)])
    )

    plan = await service.build_plan(
        workspace_dir=tmp_path,
        file_dir="/videos",
        composition={"videos": [{"path": "/video.mp4"}]},
        generation={"aspect_ratio": "16:9", "resolution": "768p"},
        output_file_name="final.mp4",
        task_id="task-768",
    )

    assert (plan.request.width, plan.request.height) == (1366, 768)


@pytest.mark.asyncio
async def test_explicit_dimensions_are_used_for_output(tmp_path: Path) -> None:
    """明确宽高应优先于比例和分辨率预设。"""
    source = tmp_path / "video.mp4"
    source.write_bytes(b"mock")
    service = FileVideoCompositionService(
        _MockCompositionPort([(1920, 1080, 3.0, True)])
    )

    plan = await service.build_plan(
        workspace_dir=tmp_path,
        file_dir="/videos",
        composition={"videos": [{"path": "/video.mp4"}]},
        generation={"aspect_ratio": "16:9", "resolution": "720p", "width": 1344, "height": 768},
        output_file_name="final.mp4",
        task_id="task-explicit",
    )

    assert (plan.request.width, plan.request.height) == (1344, 768)


@pytest.mark.asyncio
async def test_multiple_audio_files_are_rejected(tmp_path: Path) -> None:
    """文件列表合成最多接受一个外部音频。"""
    source = tmp_path / "video.mp4"
    source.write_bytes(b"mock")
    service = FileVideoCompositionService(
        _MockCompositionPort([(1920, 1080, 3.0, False)])
    )

    with pytest.raises(ValueError, match="at most one audio"):
        await service.build_plan(
            workspace_dir=tmp_path,
            file_dir="/videos",
            composition={
                "videos": [{"path": "/video.mp4"}],
                "audios": [{"path": "/a.mp3"}, {"path": "/b.mp3"}],
            },
            generation={},
            output_file_name="final.mp4",
            task_id="task-3",
        )


@pytest.mark.asyncio
async def test_media_path_cannot_escape_workspace(tmp_path: Path) -> None:
    """媒体路径不能通过目录穿越离开 workspace。"""
    service = FileVideoCompositionService(_MockCompositionPort([]))

    with pytest.raises(ValueError, match="media.path is invalid"):
        await service.build_plan(
            workspace_dir=tmp_path,
            file_dir="/videos",
            composition={"videos": [{"path": "/../outside.mp4"}]},
            generation={},
            output_file_name="final.mp4",
            task_id="task-4",
        )
