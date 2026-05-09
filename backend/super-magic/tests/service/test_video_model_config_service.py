import pytest

from app.core.horizon.agent_horizon import AgentHorizon
from app.core.horizon.store import HorizonStore
from app.service.video_model_config_service import VideoModelConfigService


def test_build_video_model_info_includes_compact_input_mode_rules():
    video_generation_config = {
        "generation": {
            "sizes": [
                {"label": "16:9", "value": "1280x720", "resolution": "720p"},
                {"label": "16:9", "value": "1920x1080", "resolution": "1080p"},
                {"label": "9:16", "value": "2160x3840", "resolution": "4k"},
            ],
            "durations": [3, 4, 5],
            "default_duration_seconds": 5,
        },
        "input_modes": {
            "standard": {
                "description": "普通文生视频模式，不依赖任何参考素材。",
                "supported_fields": [],
                "task": "generate",
            },
            "omni_reference": {
                "description": "上传参考图片或参考视频生成视频。",
                "supported_fields": ["reference_images", "reference_videos"],
                "max_count": 7,
                "rules": [
                    {
                        "code": "images_only",
                        "description": "仅上传参考图片，最多支持 7 张。",
                        "limits": {
                            "reference_images": {"min": 0, "max": 7},
                            "reference_videos": {"max": 0},
                        },
                    },
                    {
                        "code": "image_and_video",
                        "description": "同时上传参考图片和 1 个参考视频时，参考图片最多支持 6 张。",
                        "limits": {
                            "reference_images": {"min": 0, "max": 6},
                            "reference_videos": {"min": 0, "max": 1},
                        },
                        "generation_constraints": {
                            "resolutions": ["720p", "1080p"],
                        },
                    },
                ],
                "task": "generate",
            },
            "video_edit": {
                "description": "上传 1 个参考视频，结合文字指令对原视频进行编辑或改写。",
                "supported_fields": ["reference_videos"],
                "max_count": 7,
                "rules": [
                    {
                        "code": "video_only",
                        "limits": {
                            "reference_videos": {"min": 1, "max": 1},
                        },
                        "unsupported": {
                            "sizes": True,
                            "aspect_ratios": True,
                            "resolutions": ["4k"],
                        },
                    },
                ],
                "task": "edit",
                "generation_constraints": {
                    "durations": [],
                    "resolutions": ["720p", "1080p"],
                    "aspect_ratios": [],
                    "sizes": [],
                },
            },
        },
    }

    info = VideoModelConfigService.build_video_model_info(
        "kling-v3-omni",
        video_generation_config,
    )

    assert 'model="kling-v3-omni"' in info
    assert 'size="1280x720@16:9@720p|1920x1080@16:9@1080p|2160x3840@9:16@4k"' in info
    assert 'default_size="1920x1080"' in info
    assert 'duration="3|4|5"' in info
    assert '<mode name="standard" task="generate" fields="prompt" duration="3|4|5" resolution="720p|1080p|4k" aspect_ratio="16:9|9:16" size="1280x720|1920x1080|2160x3840"/>' in info
    assert '<mode name="omni_reference" task="generate" fields="prompt,reference_image_paths,reference_video_paths" max_count="7" duration="3|4|5" resolution="720p|1080p|4k" aspect_ratio="16:9|9:16" size="1280x720|1920x1080|2160x3840">' in info
    assert '<rule name="images_only" reference_image_paths="0-7" reference_video_paths="0" duration="3|4|5" resolution="720p|1080p|4k" aspect_ratio="16:9|9:16" size="1280x720|1920x1080|2160x3840"/>' in info
    assert '<rule name="image_and_video" reference_image_paths="0-6" reference_video_paths="0-1" duration="3|4|5" resolution="720p|1080p" aspect_ratio="16:9|9:16" size="1280x720|1920x1080|2160x3840"/>' in info
    assert '<mode name="video_edit" task="edit" fields="prompt,reference_video_paths" max_count="7" no_duration="true" resolution="720p|1080p" no_aspect_ratio="true" no_size="true">' in info
    assert '<rule name="video_only" reference_video_paths="1" no_size="true" no_aspect_ratio="true" avoid_resolution="4k" no_duration="true" resolution="720p|1080p"/>' in info


def test_build_video_model_info_keeps_selected_model_without_config():
    info = VideoModelConfigService.build_video_model_info("kling-v3-omni", {})
    malformed_info = VideoModelConfigService.build_video_model_info("kling-v3-omni", None)

    assert 'model="kling-v3-omni"' in info
    assert info.strip().endswith("/>")
    assert 'model="kling-v3-omni"' in malformed_info
    assert malformed_info.strip().endswith("/>")


def test_build_video_model_info_handles_invalid_generation_constraint_types():
    video_generation_config = {
        "generation": {
            "sizes": [
                {"label": "16:9", "value": "1280x720", "resolution": "720p"},
            ],
            "durations": [5],
        },
        "input_modes": {
            "omni_reference": {
                "supported_fields": ["reference_images"],
                "task": "generate",
                "generation_constraints": {
                    "durations": "bad",
                    "resolutions": [],
                },
                "variants": [
                    {
                        "code": "images_only",
                        "limits": {
                            "reference_images": {"max": 1},
                        },
                        "generation_constraints": "bad",
                    },
                ],
            },
        },
    }

    info = VideoModelConfigService.build_video_model_info(
        "kling-v3-omni",
        video_generation_config,
    )

    assert '<mode name="omni_reference" task="generate" fields="prompt,reference_image_paths" duration="5" no_resolution="true" aspect_ratio="16:9" size="1280x720">' in info
    assert '<rule name="images_only" reference_image_paths="0-1" duration="5" no_resolution="true" aspect_ratio="16:9" size="1280x720"/>' in info


@pytest.mark.asyncio
async def test_sync_to_horizon_updates_real_horizon_video_model_context(tmp_path):
    video_generation_config = {
        "generation": {
            "sizes": [
                {"label": "16:9", "value": "1280x720", "resolution": "720p"},
            ],
            "durations": [5],
        },
        "input_modes": {
            "standard": {
                "supported_fields": [],
                "task": "generate",
            },
        },
    }
    dynamic_config = {
        "video_model": {
            "model_id": "kling-v3-omni",
            "video_generation_config": video_generation_config,
        },
    }
    store = HorizonStore(str(tmp_path), "test-agent", "agent-1")
    horizon = AgentHorizon(store, "agent-1")

    await VideoModelConfigService.sync_to_horizon(dynamic_config, horizon)
    context = await horizon.build_context_update("unit-test")

    assert context is not None
    assert "<media_model_info>" in context
    assert 'model="kling-v3-omni"' in context
    assert 'size="1280x720@16:9@720p"' in context
    assert '<mode name="standard" task="generate" fields="prompt" duration="5" resolution="720p" aspect_ratio="16:9" size="1280x720"/>' in context
    assert "Use video modes to choose reference fields and avoid unsupported combinations." in context


@pytest.mark.asyncio
async def test_sync_to_horizon_keeps_video_model_when_config_is_missing(tmp_path):
    dynamic_config = {
        "video_model": {
            "model_id": "kling-v3-omni",
        },
    }
    store = HorizonStore(str(tmp_path), "test-agent", "agent-1")
    horizon = AgentHorizon(store, "agent-1")

    await VideoModelConfigService.sync_to_horizon(dynamic_config, horizon)
    context = await horizon.build_context_update("unit-test")

    assert context is not None
    assert "<media_model_info>" in context
    assert 'model="kling-v3-omni"' in context
    assert "Video model is selected, but capability config is unavailable" in context
