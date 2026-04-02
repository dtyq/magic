# -*- coding: utf-8 -*-
"""视频模型配置服务：提取 dynamic_config 中的视频模型配置并同步到 AgentHorizon。"""

from typing import TYPE_CHECKING, Any, Dict, Optional

from app.utils.video_logger import get_video_logger

if TYPE_CHECKING:
    from app.core.horizon.agent_horizon import AgentHorizon

logger = get_video_logger(__name__)


class VideoModelConfigService:
    """视频模型配置服务类"""

    @staticmethod
    def _extract_supported_sizes(video_generation_config: Dict[str, Any]) -> list[dict[str, Any]]:
        """从顶层配置中取出 generation.sizes 列表，过滤掉非 dict 条目。"""
        generation = video_generation_config.get("generation")
        if not isinstance(generation, dict):
            return []

        sizes = generation.get("sizes")
        if not isinstance(sizes, list):
            return []

        return [size for size in sizes if isinstance(size, dict)]

    @staticmethod
    def _get_generation_config(video_generation_config: Dict[str, Any]) -> Dict[str, Any]:
        """安全取出 generation 子块，缺失时返回空 dict，避免各 helper 重复判空。"""
        generation = video_generation_config.get("generation")
        return generation if isinstance(generation, dict) else {}

    @staticmethod
    def _join_string_list(values: Any) -> str:
        """把字符串列表用 `|` 拼接，非列表或空列表返回空串。用于生成 XML 属性的枚举值。"""
        if not isinstance(values, list):
            return ""
        normalized = [
            str(value).strip()
            for value in values
            if isinstance(value, str) and str(value).strip()
        ]
        return "|".join(normalized)

    @staticmethod
    def _build_supported_sizes_attr(video_generation_config: Dict[str, Any]) -> str:
        """构建 `size` 属性值：每个尺寸编码为 `{value}@{aspect_ratio}@{resolution}`，条目间用 `|` 分隔。
        示例：`1920x1080@16:9@1080p|720x1280@9:16@720p`
        """
        supported_sizes = VideoModelConfigService._extract_supported_sizes(video_generation_config)
        formatted_sizes: list[str] = []
        for size in supported_sizes:
            value = size.get("value")
            if not isinstance(value, str) or not value.strip():
                continue

            # `size` 同时承载真实尺寸、画幅和分辨率，保持这三个维度并排，
            # 可以让模型在少 token 前提下直接完成工具参数选择。
            parts = [value.strip()]
            label = size.get("label")
            resolution = size.get("resolution")
            if isinstance(label, str) and label.strip():
                parts.append(label.strip())
            if isinstance(resolution, str) and resolution.strip():
                parts.append(resolution.strip())
            formatted_sizes.append("@".join(parts))
        return "|".join(formatted_sizes)

    @staticmethod
    def _pick_default_size(video_generation_config: Dict[str, Any]) -> str:
        """从支持的尺寸中选出工具调用的首选默认尺寸（即 `default_size` 属性值）。
        优先级：1080p > provider 配置的 default_resolution > 列表第一项。
        """
        supported_sizes = VideoModelConfigService._extract_supported_sizes(video_generation_config)
        if not supported_sizes:
            return ""

        # 这里产出的 `default_size` 是"给工具调用时优先选什么"，
        # 不是单纯回放 provider 原始默认值；因此优先挑 1080p，再回退到配置默认。
        def _find_by_resolution(target_resolution: str) -> str:
            for size in supported_sizes:
                resolution = size.get("resolution")
                value = size.get("value")
                if resolution == target_resolution and isinstance(value, str) and value.strip():
                    return value.strip()
            return ""

        preferred_1080p = _find_by_resolution("1080p")
        if preferred_1080p:
            return preferred_1080p

        generation = VideoModelConfigService._get_generation_config(video_generation_config)
        default_resolution = generation.get("default_resolution")
        if isinstance(default_resolution, str) and default_resolution.strip():
            matched_default = _find_by_resolution(default_resolution.strip())
            if matched_default:
                return matched_default

        for size in supported_sizes:
            value = size.get("value")
            if isinstance(value, str) and value.strip():
                return value.strip()
        return ""

    @staticmethod
    def _build_duration_attr(video_generation_config: Dict[str, Any]) -> str:
        """构建 `duration` 属性值：所有支持的秒数用 `|` 拼接。示例：`4|6|8`"""
        generation = VideoModelConfigService._get_generation_config(video_generation_config)
        durations = generation.get("durations")
        if not isinstance(durations, list):
            return ""
        normalized = [
            str(value)
            for value in durations
            if isinstance(value, (int, float))
        ]
        return "|".join(normalized)

    @staticmethod
    def _get_default_duration(video_generation_config: Dict[str, Any]) -> str:
        """取工具调用的默认时长（秒）字符串。优先读 default_duration_seconds，缺失则取 durations 第一项。"""
        generation = VideoModelConfigService._get_generation_config(video_generation_config)
        default_duration = generation.get("default_duration_seconds")
        if isinstance(default_duration, (int, float)):
            return str(int(default_duration))
        durations_attr = VideoModelConfigService._build_duration_attr(video_generation_config)
        return durations_attr.split("|")[0] if durations_attr else ""

    @staticmethod
    def _build_option_attr(video_generation_config: Dict[str, Any]) -> str:
        """构建 `option` 属性值：仅收纳有枚举或范围的可选参数，格式为 `key{val1|val2}`，条目间用 `;` 分隔。
        示例：`compression_quality{optimized|lossless};sample_count{1-4}`

        `option` 只收纳"可选参数及其枚举/范围"，
        让 `support` / `unsupported` 只表达布尔能力，避免语义混在一起。
        """
        generation = VideoModelConfigService._get_generation_config(video_generation_config)
        options: list[str] = []

        compression_quality_options = VideoModelConfigService._join_string_list(
            generation.get("compression_quality_options")
        )
        if generation.get("supports_compression_quality") and compression_quality_options:
            options.append(f"compression_quality{{{compression_quality_options}}}")

        person_generation_options = VideoModelConfigService._join_string_list(
            generation.get("person_generation_options")
        )
        if generation.get("supports_person_generation") and person_generation_options:
            options.append(f"person_generation{{{person_generation_options}}}")

        resize_mode_options = VideoModelConfigService._join_string_list(
            generation.get("resize_mode_options")
        )
        if generation.get("supports_resize_mode") and resize_mode_options:
            options.append(f"resize_mode{{{resize_mode_options}}}")

        sample_count_range = generation.get("sample_count_range")
        if (
            generation.get("supports_sample_count")
            and isinstance(sample_count_range, list)
            and len(sample_count_range) == 2
        ):
            options.append(f"sample_count{{{sample_count_range[0]}-{sample_count_range[1]}}}")

        seed_range = generation.get("seed_range")
        if generation.get("supports_seed") and isinstance(seed_range, list) and len(seed_range) == 2:
            options.append(f"seed{{{seed_range[0]}-{seed_range[1]}}}")

        return ";".join(options)

    @staticmethod
    def _build_support_attr(video_generation_config: Dict[str, Any]) -> str:
        """构建 `support` 属性值：列出所有 `supports_xxx=true` 的布尔能力名，用 `|` 分隔。
        示例：`enhance_prompt|generate_audio|negative_prompt`
        """
        generation = VideoModelConfigService._get_generation_config(video_generation_config)
        support_map = [
            ("supports_enhance_prompt", "enhance_prompt"),
            ("supports_generate_audio", "generate_audio"),
            ("supports_negative_prompt", "negative_prompt"),
            ("supports_person_generation", "person_generation"),
            ("supports_resize_mode", "resize_mode"),
            ("supports_sample_count", "sample_count"),
            ("supports_seed", "seed"),
        ]
        supported = [name for field, name in support_map if generation.get(field) is True]
        return "|".join(supported)

    @staticmethod
    def _build_unsupported_attr(video_generation_config: Dict[str, Any]) -> str:
        """构建 `unsupported` 属性值：列出所有 `supports_xxx=false` 的明确不支持项，用 `|` 分隔。
        只有明确设为 false 的才收入，避免把"未声明"误判为不支持。
        """
        generation = VideoModelConfigService._get_generation_config(video_generation_config)
        unsupported: list[str] = []
        if generation.get("supports_watermark") is False:
            unsupported.append("watermark")
        return "|".join(unsupported)

    @staticmethod
    def _build_reference_attr(video_generation_config: Dict[str, Any]) -> str:
        """构建 `ref` 属性值：汇总参考图的使用限制，格式为 `key=val` 逗号拼接。
        示例：`max=3,type=asset,style=false,require_duration=8`
        """
        parts: list[str] = []
        reference_images = video_generation_config.get("reference_images")
        if isinstance(reference_images, dict):
            max_count = reference_images.get("max_count")
            if isinstance(max_count, int):
                parts.append(f"max={max_count}")

            reference_types = VideoModelConfigService._join_string_list(reference_images.get("reference_types"))
            if reference_types:
                parts.append(f"type={reference_types}")

            style_supported = reference_images.get("style_supported")
            if isinstance(style_supported, bool):
                parts.append(f"style={str(style_supported).lower()}")

        constraints = video_generation_config.get("constraints")
        if isinstance(constraints, dict):
            required_duration = constraints.get("reference_images_requires_duration_seconds")
            if isinstance(required_duration, (int, float)):
                parts.append(f"require_duration={int(required_duration)}")

        return ",".join(parts)

    @staticmethod
    def build_video_model_info(video_model_id: str, video_generation_config: Dict[str, Any], changed: bool = False) -> str:
        """构建紧凑视频模型信息，供 horizon 注入。"""
        if not video_model_id or not video_generation_config:
            return ""

        lines = [
            "  <video",
            f'    model="{video_model_id}"',
            f'    changed="{"true" if changed else "false"}"',
        ]

        # 这里按"模型决策真正会用到的字段"逐项输出，缺失字段故意不补默认，
        # 这样规则层才能把"未声明 = 不支持"稳定传达给 LLM。
        input_attr = VideoModelConfigService._join_string_list(video_generation_config.get("supported_inputs"))
        if input_attr:
            lines.append(f'    input="{input_attr}"')

        size_attr = VideoModelConfigService._build_supported_sizes_attr(video_generation_config)
        if size_attr:
            lines.append(f'    size="{size_attr}"')

        default_size = VideoModelConfigService._pick_default_size(video_generation_config)
        if default_size:
            lines.append(f'    default_size="{default_size}"')

        default_duration = VideoModelConfigService._get_default_duration(video_generation_config)
        if default_duration:
            lines.append(f'    default_duration="{default_duration}"')

        duration_attr = VideoModelConfigService._build_duration_attr(video_generation_config)
        if duration_attr:
            lines.append(f'    duration="{duration_attr}"')

        option_attr = VideoModelConfigService._build_option_attr(video_generation_config)
        if option_attr:
            lines.append(f'    option="{option_attr}"')

        reference_attr = VideoModelConfigService._build_reference_attr(video_generation_config)
        if reference_attr:
            lines.append(f'    ref="{reference_attr}"')

        support_attr = VideoModelConfigService._build_support_attr(video_generation_config)
        if support_attr:
            lines.append(f'    support="{support_attr}"')

        unsupported_attr = VideoModelConfigService._build_unsupported_attr(video_generation_config)
        if unsupported_attr:
            lines.append(f'    unsupported="{unsupported_attr}"')

        lines.append("  />")
        return "\n".join(lines)

    @staticmethod
    def build_media_model_rules(has_video: bool) -> str:
        """构建简短规则块，避免在上下文里重复长说明文。"""
        # 规则块只保留决策约束，不再重复 provider 配置正文，
        # 否则节省下来的 token 很快又会被说明文吃掉。
        lines = [
            "<media_model_rules>",
            "Use this info only for image/video generation questions or tool calls.",
            "Use declared values only.",
            "Missing field means unsupported.",
        ]
        if has_video:
            lines.extend([
                "Prefer video `size`.",
                "If video size or resolution is missing, use `default_size`.",
                "Canvas width/height are layout size, not real video size.",
            ])
        lines.append("</media_model_rules>")
        return "\n".join(lines)

    @staticmethod
    async def sync_to_horizon(dynamic_config: Optional[Dict[str, Any]], horizon: "AgentHorizon") -> None:
        """从 dynamic_config 中提取视频模型配置并同步到 horizon（内部判断是否变化）。"""
        try:
            if not dynamic_config:
                return
            video_model = dynamic_config.get("video_model")
            if not isinstance(video_model, dict):
                return
            model_id = video_model.get("model_id") or ""
            config = video_model.get("video_generation_config")
            if model_id and isinstance(config, dict) and config:
                await horizon.update_video_model(model_id, config)
        except Exception as e:
            logger.warning(f"[VideoModelConfigService] sync_to_horizon 失败: {e}")
