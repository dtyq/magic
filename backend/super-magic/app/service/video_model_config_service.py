# -*- coding: utf-8 -*-
"""视频模型配置服务：提取 dynamic_config 中的视频模型配置并同步到 AgentHorizon。"""

from html import escape
from typing import TYPE_CHECKING, Any, Dict, Optional

from app.utils.video_logger import get_video_logger

if TYPE_CHECKING:
    from app.core.horizon.agent_horizon import AgentHorizon

logger = get_video_logger(__name__)


class VideoModelConfigService:
    """视频模型配置服务类"""

    _GENERATION_CONSTRAINT_KEYS = ("durations", "resolutions", "aspect_ratios", "sizes")

    _INPUT_FIELD_MAP = {
        "reference_images": "reference_image_paths",
        "reference_videos": "reference_video_paths",
        "reference_audios": "reference_audio_paths",
        "frames": "frame_start_path,frame_end_path",
    }

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
    def _xml_attr(value: str) -> str:
        """转义 XML 属性值，避免配置中的特殊字符破坏注入结构。"""
        return escape(value, quote=True)

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
    def _normalize_input_field(field_name: str) -> str:
        """把平台能力字段转换为工具参数字段名，降低 LLM 二次翻译出错概率。"""
        return VideoModelConfigService._INPUT_FIELD_MAP.get(field_name, field_name)

    @staticmethod
    def _normalize_input_fields(fields: Any) -> list[str]:
        """从 input mode 的 supported_fields 生成工具侧字段列表。"""
        normalized: list[str] = ["prompt"]
        if not isinstance(fields, list) or not fields:
            return normalized

        for field in fields:
            if not isinstance(field, str) or not field.strip():
                continue
            mapped = VideoModelConfigService._normalize_input_field(field.strip())
            for part in mapped.split(","):
                if part and part not in normalized:
                    normalized.append(part)
        return normalized

    @staticmethod
    def _format_limit(limit: Any) -> str:
        """把单个素材限制压缩成 XML 属性值。"""
        if not isinstance(limit, dict):
            return ""

        min_count = limit.get("min")
        max_count = limit.get("max")

        has_min = isinstance(min_count, int)
        has_max = isinstance(max_count, int)
        if has_min and has_max:
            if min_count == max_count:
                return str(min_count)
            return f"{min_count}-{max_count}"
        if has_min:
            return f"{min_count}+"
        if has_max:
            if max_count == 0:
                return "0"
            return f"0-{max_count}"
        return ""

    @staticmethod
    def _format_unsupported_attrs(unsupported: Any) -> dict[str, str]:
        """把模式级不支持项转换成更自然的 XML 属性。"""
        if not unsupported:
            return {}

        # 兼容旧版配置可能以 list 形式直接给出不支持项名称
        if isinstance(unsupported, list):
            return {
                f"no_{item}": "true"
                for item in unsupported
                if isinstance(item, str) and item.strip()
            }

        if not isinstance(unsupported, dict):
            return {}

        attrs: dict[str, str] = {}
        if unsupported.get("sizes") is True:
            attrs["no_size"] = "true"
        if unsupported.get("aspect_ratios") is True:
            attrs["no_aspect_ratio"] = "true"

        resolutions = unsupported.get("resolutions")
        if isinstance(resolutions, list):
            values = [
                str(value).strip()
                for value in resolutions
                if isinstance(value, str) and str(value).strip()
            ]
            if values:
                attrs["avoid_resolution"] = "|".join(values)

        return attrs

    @staticmethod
    def _format_constraint_list(values: Any) -> str:
        """把 generation_constraints 的枚举列表压缩成 `a|b|c`。"""
        if not isinstance(values, list):
            return ""
        normalized: list[str] = []
        for value in values:
            if not isinstance(value, (str, int, float)):
                continue
            formatted = str(value).strip()
            if formatted and formatted not in normalized:
                normalized.append(formatted)
        return "|".join(normalized)

    @staticmethod
    def _format_generation_constraint_attrs(constraints: Any) -> dict[str, str]:
        """把模式/规则级 generation_constraints 转换成 XML 属性。

        非空数组表示该模式下允许的取值；空数组表示该字段在该模式下不支持设置。
        """
        if not isinstance(constraints, dict):
            return {}

        attrs: dict[str, str] = {}
        mapping = {
            "durations": ("duration", "no_duration"),
            "resolutions": ("resolution", "no_resolution"),
            "aspect_ratios": ("aspect_ratio", "no_aspect_ratio"),
            "sizes": ("size", "no_size"),
        }
        for config_key, (attr_key, disabled_key) in mapping.items():
            if config_key not in constraints:
                continue
            values = constraints.get(config_key)
            if isinstance(values, list) and values == []:
                attrs[disabled_key] = "true"
                continue

            formatted = VideoModelConfigService._format_constraint_list(values)
            if formatted:
                attrs[attr_key] = formatted

        return attrs

    @staticmethod
    def _extract_generation_constraints(config: Any) -> dict[str, list[Any]]:
        """安全取出 generation_constraints；字段类型错误时按未声明处理。"""
        if not isinstance(config, dict):
            return {}

        constraints = config.get("generation_constraints")
        if not isinstance(constraints, dict):
            return {}

        return {
            key: values
            for key, values in constraints.items()
            if key in VideoModelConfigService._GENERATION_CONSTRAINT_KEYS and isinstance(values, list)
        }

    @staticmethod
    def _build_global_generation_constraints(video_generation_config: Dict[str, Any]) -> dict[str, list[Any]]:
        """把顶层 generation 配置转换成可继承的通用约束。"""
        generation = VideoModelConfigService._get_generation_config(video_generation_config)
        constraints: dict[str, list[Any]] = {}

        durations = generation.get("durations")
        if isinstance(durations, list):
            constraints["durations"] = durations

        resolutions = generation.get("resolutions")
        if isinstance(resolutions, list):
            constraints["resolutions"] = resolutions

        aspect_ratios = generation.get("aspect_ratios")
        if isinstance(aspect_ratios, list):
            constraints["aspect_ratios"] = aspect_ratios

        sizes = generation.get("sizes")
        if isinstance(sizes, list):
            constraints["sizes"] = [
                size.get("value")
                for size in sizes
                if isinstance(size, dict) and isinstance(size.get("value"), str)
            ]

            if "resolutions" not in constraints:
                constraints["resolutions"] = [
                    size.get("resolution")
                    for size in sizes
                    if isinstance(size, dict) and isinstance(size.get("resolution"), str)
                ]

            if "aspect_ratios" not in constraints:
                constraints["aspect_ratios"] = [
                    size.get("label")
                    for size in sizes
                    if isinstance(size, dict) and isinstance(size.get("label"), str)
                ]

        return constraints

    @staticmethod
    def _merge_generation_constraints(*candidates: dict[str, list[Any]]) -> dict[str, list[Any]]:
        """按传入优先级合并约束，空数组也视为有效声明。"""
        merged: dict[str, list[Any]] = {}
        for key in VideoModelConfigService._GENERATION_CONSTRAINT_KEYS:
            for candidate in candidates:
                if not isinstance(candidate, dict):
                    continue
                values = candidate.get(key)
                if isinstance(values, list):
                    merged[key] = values
                    break
        return merged

    @staticmethod
    def _format_xml_attrs(attrs: dict[str, Any]) -> str:
        """按插入顺序格式化 XML 属性，跳过空值。"""
        parts: list[str] = []
        for key, value in attrs.items():
            normalized = str(value).strip() if value is not None else ""
            if normalized == "":
                continue
            parts.append(f'{key}="{VideoModelConfigService._xml_attr(normalized)}"')
        return " ".join(parts)

    @staticmethod
    def _build_mode_rule_line(rule: Any, inherited_constraints: dict[str, list[Any]], indent: str = "      ") -> str:
        """把一个 mode rule/variant 转换成一行 XML 子节点。"""
        if not isinstance(rule, dict):
            return ""

        code = rule.get("code")
        if not isinstance(code, str) or not code.strip():
            return ""

        attrs: dict[str, str] = {"name": code.strip()}
        limits = rule.get("limits")
        if isinstance(limits, dict):
            for field_name, limit in limits.items():
                if not isinstance(field_name, str):
                    continue
                field = VideoModelConfigService._normalize_input_field(field_name)
                value = VideoModelConfigService._format_limit(limit)
                if value:
                    attrs[field] = value

        attrs.update(VideoModelConfigService._format_unsupported_attrs(rule.get("unsupported")))
        rule_constraints = VideoModelConfigService._merge_generation_constraints(
            VideoModelConfigService._extract_generation_constraints(rule),
            inherited_constraints,
        )
        attrs.update(VideoModelConfigService._format_generation_constraint_attrs(rule_constraints))
        return f"{indent}<rule {VideoModelConfigService._format_xml_attrs(attrs)}/>"

    @staticmethod
    def _build_input_mode_lines(video_generation_config: Dict[str, Any]) -> list[str]:
        """构建 mode/rule 子节点，让 LLM 以 XML 结构读取输入模式与限制。"""
        input_modes = video_generation_config.get("input_modes")
        if not isinstance(input_modes, dict):
            return []

        global_constraints = VideoModelConfigService._build_global_generation_constraints(video_generation_config)
        lines: list[str] = []
        for mode, mode_config in input_modes.items():
            if not isinstance(mode, str) or not mode.strip() or not isinstance(mode_config, dict):
                continue

            attrs: dict[str, Any] = {"name": mode.strip()}
            task = mode_config.get("task")
            if isinstance(task, str) and task.strip():
                attrs["task"] = task.strip()

            fields = VideoModelConfigService._normalize_input_fields(mode_config.get("supported_fields"))
            attrs["fields"] = ",".join(fields)

            max_count = mode_config.get("max_count")
            if isinstance(max_count, int):
                attrs["max_count"] = max_count

            mode_constraints = VideoModelConfigService._merge_generation_constraints(
                VideoModelConfigService._extract_generation_constraints(mode_config),
                global_constraints,
            )
            attrs.update(VideoModelConfigService._format_generation_constraint_attrs(mode_constraints))

            rules = mode_config.get("rules")
            if not isinstance(rules, list):
                rules = mode_config.get("variants")
            rule_lines = [
                VideoModelConfigService._build_mode_rule_line(rule, mode_constraints)
                for rule in rules
            ] if isinstance(rules, list) else []
            rule_lines = [line for line in rule_lines if line]

            mode_open = f"    <mode {VideoModelConfigService._format_xml_attrs(attrs)}"
            if not rule_lines:
                lines.append(mode_open + "/>")
                continue

            lines.append(mode_open + ">")
            lines.extend(rule_lines)
            lines.append("    </mode>")

        return lines

    @staticmethod
    def build_video_model_info(video_model_id: str, video_generation_config: Dict[str, Any], changed: bool = False) -> str:
        """构建紧凑视频模型信息，供 horizon 注入。"""
        if not video_model_id:
            return ""
        if not isinstance(video_generation_config, dict):
            video_generation_config = {}

        lines = [
            "  <video",
            f'    model="{VideoModelConfigService._xml_attr(video_model_id)}"',
        ]
        if changed:
            lines.append('    changed="true"')

        # 这里按"模型决策真正会用到的字段"逐项输出，缺失字段故意不补默认，
        # 这样规则层才能把"未声明 = 不支持"稳定传达给 LLM。
        def _attr(name: str, value: str) -> None:
            if value:
                lines.append(f'    {name}="{VideoModelConfigService._xml_attr(value)}"')

        _attr("input", VideoModelConfigService._join_string_list(video_generation_config.get("supported_inputs")))
        _attr("size", VideoModelConfigService._build_supported_sizes_attr(video_generation_config))
        _attr("default_size", VideoModelConfigService._pick_default_size(video_generation_config))
        _attr("default_duration", VideoModelConfigService._get_default_duration(video_generation_config))
        _attr("duration", VideoModelConfigService._build_duration_attr(video_generation_config))
        _attr("option", VideoModelConfigService._build_option_attr(video_generation_config))
        _attr("ref", VideoModelConfigService._build_reference_attr(video_generation_config))
        _attr("support", VideoModelConfigService._build_support_attr(video_generation_config))
        _attr("unsupported", VideoModelConfigService._build_unsupported_attr(video_generation_config))

        mode_lines = VideoModelConfigService._build_input_mode_lines(video_generation_config)
        if not mode_lines:
            lines.append("  />")
            return "\n".join(lines)

        lines.append("  >")
        lines.extend(mode_lines)
        lines.append("  </video>")
        return "\n".join(lines)

    @staticmethod
    def build_media_model_rules(has_video: bool, has_video_config: bool = True) -> str:
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
            if has_video_config:
                lines.extend([
                    "Prefer video `size`.",
                    "If video size or resolution is missing, use `default_size`.",
                    "Use video modes to choose reference fields and avoid unsupported combinations.",
                    "Canvas width/height are layout size, not real video size.",
                ])
            else:
                lines.append("Video model is selected, but capability config is unavailable; use tool schema and defaults.")
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
            raw_config = video_model.get("video_generation_config")
            config = raw_config if isinstance(raw_config, dict) else {}
            if model_id:
                await horizon.update_video_model(model_id, config)
        except Exception as e:
            logger.warning(f"[VideoModelConfigService] sync_to_horizon 失败: {e}")
