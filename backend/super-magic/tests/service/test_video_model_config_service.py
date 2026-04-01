from app.service.video_model_config_service import VideoModelConfigService


class _ChatHistory:
    def __init__(self, last_session_config):
        self._last_session_config = last_session_config

    def get_last_session_config(self):
        return self._last_session_config


class _Agent:
    def __init__(self, last_session_config):
        self.chat_history = _ChatHistory(last_session_config)


def test_build_runtime_video_model_config_message_skips_when_unchanged():
    dynamic_config = {
        "video_model": {
            "model_id": "veo-3.1-fast-generate-preview",
            "video_generation_config": {
                "supported_inputs": ["text_prompt"],
                "generation": {"resolutions": ["1080p"], "default_resolution": "1080p"},
            },
        }
    }
    agent = _Agent(
        {
            "video_model_id": "veo-3.1-fast-generate-preview",
            "video_generation_config": dynamic_config["video_model"]["video_generation_config"],
        }
    )

    assert VideoModelConfigService.build_runtime_video_model_config_message(dynamic_config, agent) is None


def test_build_runtime_video_model_config_message_returns_message_when_changed():
    dynamic_config = {
        "video_model": {
            "model_id": "veo-3.1-fast-generate-preview",
            "video_generation_config": {
                "supported_inputs": ["text_prompt", "image"],
                "generation": {
                    "aspect_ratios": ["16:9"],
                    "resolutions": ["1080p"],
                    "default_resolution": "1080p",
                    "sizes": [{"label": "16:9", "value": "1920x1080", "width": 1920, "height": 1080, "resolution": "1080p"}],
                },
                "constraints": {},
            },
        }
    }
    agent = _Agent(
        {
            "video_model_id": "other-model",
            "video_generation_config": None,
        }
    )

    result = VideoModelConfigService.build_runtime_video_model_config_message(dynamic_config, agent)
    assert result is not None
    assert "video_generation_config" not in result
    assert "supported_inputs" in result
    assert "Current video model: veo-3.1-fast-generate-preview" in result
    assert "Supported sizes" in result
    assert "Prefer the `size` parameter" in result


def test_build_video_model_context_handles_missing_sizes_and_default_resolution():
    result = VideoModelConfigService.build_video_model_context(
        "wuyin-grok-imagine",
        {
            "supported_inputs": ["text_prompt", "reference_images"],
            "reference_images": {"max_count": 1, "reference_types": ["asset"], "style_supported": False},
            "generation": {
                "aspect_ratios": ["2:3", "3:2", "1:1", "16:9", "9:16"],
                "durations": [6, 10, 15],
            },
            "constraints": {},
        },
    )

    assert "Current video model: wuyin-grok-imagine" in result
    assert "do not invent a size parameter" in result
    assert "choose an appropriate supported resolution" in result


def test_build_video_model_context_supports_keling_resolution_only_featured():
    result = VideoModelConfigService.build_video_model_context(
        "keling-3.0-video",
        {
            "supported_inputs": ["text_prompt", "image", "last_frame"],
            "reference_images": {"max_count": 1, "reference_types": ["asset"], "style_supported": False},
            "generation": {
                "aspect_ratios": ["16:9", "9:16", "1:1"],
                "durations": [5, 10],
                "resolutions": ["720p", "1080p"],
                "default_resolution": "720p",
            },
            "constraints": {},
        },
    )

    assert "Current video model: keling-3.0-video" in result
    assert "do not invent a size parameter" in result
    assert '"default_resolution": "720p"' in result
    assert '"resolutions": [' in result
    assert "prefer 1080p when calling the video tool" in result


def test_build_video_model_context_prefers_default_resolution_for_supported_sizes():
    result = VideoModelConfigService.build_video_model_context(
        "veo-3.1-fast-generate-preview",
        {
            "generation": {
                "resolutions": ["720p", "1080p"],
                "default_resolution": "720p",
                "sizes": [
                    {"label": "16:9", "value": "1280x720", "width": 1280, "height": 720, "resolution": "720p"},
                    {"label": "16:9", "value": "1920x1080", "width": 1920, "height": 1080, "resolution": "1080p"},
                ],
            }
        },
    )

    assert "Supported sizes" in result
    assert "Prefer a 1080p size first" in result
