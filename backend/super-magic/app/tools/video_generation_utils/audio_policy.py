"""视频音频策略的 super-magic 侧兼容转换。"""

from __future__ import annotations

from typing import Literal

AudioPolicy = Literal["auto", "generate", "mute"]
AudioStrategy = Literal["native", "compose"]


class VideoAudioPolicyResolver:
    """把统一音频意图转换为旧 Magic Service 协议和 Canvas 策略。"""

    # 明确支持通过 generate_audio=false 原生静音的模型族。
    _NATIVE_MUTE_PREFIXES = (
        "kling-v3",
        "kling-3",
        "seedance",
        "doubao-seedance",
        "veo-3",
    )
    # 这些模型不保证 generate_audio=false 生效，统一走最终视频合成。
    _COMPOSE_PREFIXES = (
        "kling-v3-omni",
        "wan",
        "minimax",
    )

    @classmethod
    def strategy(cls, model_id: str) -> AudioStrategy:
        """返回指定模型的静音实现策略，未知模型采用安全的合成策略。"""
        normalized = cls._normalize_model_id(model_id)
        if normalized.startswith(cls._COMPOSE_PREFIXES):
            return "compose"
        if normalized.startswith(cls._NATIVE_MUTE_PREFIXES):
            return "native"
        return "compose"

    @classmethod
    def to_legacy_generate_audio(
        cls,
        policy: AudioPolicy | None,
        model_id: str,
    ) -> bool | None:
        """将统一策略转换为 Magic Service 已支持的 generate_audio 字段。"""
        if policy in (None, "auto"):
            return None
        if policy == "generate":
            return True
        return False if cls.strategy(model_id) == "native" else None

    @classmethod
    def prompt_attributes(
        cls,
        model_id: str,
        video_generation_config: dict | None = None,
    ) -> dict[str, str]:
        """生成注入模型上下文的通用音频能力属性。"""
        strategy = cls.strategy(model_id)
        generation = (
            video_generation_config.get("generation", {})
            if isinstance(video_generation_config, dict)
            else {}
        )
        supports_generate_audio = generation.get("supports_generate_audio")
        audio_output = "unknown"
        if supports_generate_audio is True:
            audio_output = "supported"
        elif supports_generate_audio is False:
            audio_output = "unsupported"

        return {
            "audio_output": audio_output,
            "native_mute": str(strategy == "native").lower(),
            "mute_fallback": "none" if strategy == "native" else "compose",
        }

    @staticmethod
    def _normalize_model_id(model_id: str) -> str:
        """规范化模型 ID，避免大小写和空白导致能力判断不一致。"""
        return str(model_id or "").strip().casefold()
