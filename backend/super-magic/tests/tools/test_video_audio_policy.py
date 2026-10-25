import pytest

from app.tools.video_generation_utils import VideoAudioPolicyResolver


@pytest.mark.parametrize(
    ("model_id", "expected_strategy"),
    [
        ("veo-3.1", "native"),
        ("doubao-seedance-2-0-260128", "native"),
        ("kling-v3-omni", "compose"),
        ("wan-2.7", "compose"),
        ("unknown-video-model", "compose"),
    ],
)
def test_video_audio_policy_resolver_uses_safe_model_strategy(model_id, expected_strategy):
    assert VideoAudioPolicyResolver.strategy(model_id) == expected_strategy


@pytest.mark.parametrize(
    ("policy", "model_id", "expected"),
    [
        (None, "veo-3.1", None),
        ("auto", "veo-3.1", None),
        ("generate", "veo-3.1", True),
        ("mute", "veo-3.1", False),
        ("mute", "wan-2.7", None),
    ],
)
def test_video_audio_policy_resolver_maps_legacy_magic_service_field(policy, model_id, expected):
    assert VideoAudioPolicyResolver.to_legacy_generate_audio(policy, model_id) is expected


@pytest.mark.parametrize(
    ("config", "expected_output"),
    [
        ({"generation": {"supports_generate_audio": True}}, "supported"),
        ({"generation": {"supports_generate_audio": False}}, "unsupported"),
        ({"generation": {}}, "unknown"),
        ({}, "unknown"),
    ],
)
def test_video_audio_policy_prompt_attributes_distinguish_unknown_from_unsupported(config, expected_output):
    attributes = VideoAudioPolicyResolver.prompt_attributes("mock-video-model", config)

    assert attributes["audio_output"] == expected_output
