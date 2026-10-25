# -*- coding: utf-8 -*-
"""视频模型配置服务：提取 dynamic_config 中的视频模型配置并同步到 AgentHorizon。"""

from html import escape
from typing import TYPE_CHECKING, Any, Dict, Optional

from app.tools.video_generation_utils import VideoAudioPolicyResolver
from app.utils.video_logger import get_video_logger

if TYPE_CHECKING:
    from app.core.horizon.agent_horizon import AgentHorizon

logger = get_video_logger(__name__)


class VideoModelConfigService:
    """视频模型配置服务类"""

    _GENERATION_CONSTRAINT_KEYS = ("duration_type", "durations", "resolutions", "aspect_ratios")

    # generate_audio 也是 switch 型能力，但它已经由 VideoAudioPolicyResolver 翻译成
    # audio_output / native_mute / mute_fallback 这套专用词汇，不能再按通用 switch 渲染，
    # 否则同一个能力在上下文里会出现两套说法。
    _DEDICATED_SWITCH_KEYS = ("generate_audio",)

    _INPUT_FIELD_MAP = {
        "reference_images": "reference_image_paths",
        "reference_videos": "reference_video_paths",
        "reference_audios": "reference_audio_paths",
        "frames": "frame_start_path,frame_end_path",
    }

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
    def _build_duration_attrs(video_generation_config: Dict[str, Any]) -> dict[str, str]:
        """只输出模型时长元数据：duration_type 与 durations。"""
        generation = VideoModelConfigService._get_generation_config(video_generation_config)
        duration_type = generation.get("duration_type")
        durations = generation.get("durations")
        if duration_type not in {"options", "range"}:
            duration_type = "options" if isinstance(durations, list) else None
        attrs: dict[str, str] = {}
        if duration_type:
            attrs["duration_type"] = duration_type
        if duration_type == "range" and isinstance(durations, dict):
            parts = []
            for key in ("min", "max", "step"):
                value = durations.get(key)
                if isinstance(value, (int, float)):
                    parts.append(f"{key}={int(value)}")
            if parts:
                attrs["durations"] = ",".join(parts)
        elif duration_type == "options" and isinstance(durations, list):
            values = [str(int(value)) for value in durations if isinstance(value, (int, float))]
            if values:
                attrs["durations"] = "|".join(values)
        return attrs

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
    def _build_audio_attrs(
        video_model_id: str,
        video_generation_config: Dict[str, Any],
    ) -> dict[str, str]:
        """构建统一音频策略属性，隐藏供应商的具体参数名。"""
        return VideoAudioPolicyResolver.prompt_attributes(
            video_model_id,
            video_generation_config,
        )

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
        duration_type = constraints.get("duration_type")
        durations = constraints.get("durations")
        if duration_type in {"options", "range"}:
            attrs["duration_type"] = duration_type
            if duration_type == "range" and isinstance(durations, dict):
                parts = [f"{key}={int(durations[key])}" for key in ("min", "max", "step") if isinstance(durations.get(key), (int, float))]
                if parts:
                    attrs["durations"] = ",".join(parts)
            elif duration_type == "options":
                formatted = VideoModelConfigService._format_constraint_list(durations)
                if formatted:
                    attrs["durations"] = formatted
        mapping = {
            "resolutions": ("resolution", "no_resolution"),
            "aspect_ratios": ("aspect_ratio", "no_aspect_ratio"),
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
    def _extract_generation_constraints(config: Any) -> dict[str, Any]:
        """安全取出 generation_constraints；字段类型错误时按未声明处理。"""
        if not isinstance(config, dict):
            return {}

        constraints = config.get("generation_constraints")
        if not isinstance(constraints, dict):
            return {}

        result: dict[str, Any] = {}
        for key in VideoModelConfigService._GENERATION_CONSTRAINT_KEYS:
            if key not in constraints:
                continue
            value = constraints[key]
            if key == "duration_type" and value in {"options", "range"}:
                result[key] = value
            elif key == "durations" and isinstance(value, (list, dict)):
                result[key] = value
            elif key in {"resolutions", "aspect_ratios"} and isinstance(value, list):
                result[key] = value
        return result

    @staticmethod
    def _build_global_generation_constraints(video_generation_config: Dict[str, Any]) -> dict[str, Any]:
        """把顶层 generation 配置转换成可继承的通用约束。"""
        generation = VideoModelConfigService._get_generation_config(video_generation_config)
        constraints: dict[str, Any] = {}

        duration_attrs = VideoModelConfigService._build_duration_attrs(video_generation_config)
        if duration_attrs:
            constraints["duration_type"] = duration_attrs["duration_type"]
            generation = VideoModelConfigService._get_generation_config(video_generation_config)
            if "durations" in generation:
                constraints["durations"] = generation["durations"]

        durations = generation.get("durations")
        if isinstance(durations, list) and "durations" not in constraints:
            constraints["durations"] = durations

        resolutions = generation.get("resolutions")
        if isinstance(resolutions, list):
            constraints["resolutions"] = resolutions

        aspect_ratios = generation.get("aspect_ratios")
        if isinstance(aspect_ratios, list):
            constraints["aspect_ratios"] = aspect_ratios

        sizes = generation.get("sizes")
        if isinstance(sizes, list):
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
    def _merge_generation_constraints(*candidates: dict[str, Any]) -> dict[str, Any]:
        """按传入优先级合并约束，空数组也视为有效声明。"""
        merged: dict[str, Any] = {}
        for key in VideoModelConfigService._GENERATION_CONSTRAINT_KEYS:
            for candidate in candidates:
                if not isinstance(candidate, dict):
                    continue
                values = candidate.get(key)
                if key == "duration_type" and values in {"options", "range"}:
                    merged[key] = values
                    break
                if key == "durations" and isinstance(values, (list, dict)):
                    merged[key] = values
                    break
                if key in {"resolutions", "aspect_ratios"} and isinstance(values, list):
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
    def _build_capability_lines(video_generation_config: Dict[str, Any]) -> list[str]:
        """把 switch 型生成能力渲染成 <capability> 子节点。

        列表型约束（resolutions / aspect_ratios / durations）已能由属性与 <mode> 表达，
        开关型能力没有对应的列表词汇：能力层声明了、投影却看不见，Agent 就无从知道它存在。
        规则描述直接取能力层声明的 description，因此新增模型只需改能力层，投影不用动。
        """
        generation = VideoModelConfigService._get_generation_config(video_generation_config)
        lines: list[str] = []
        for key, capability in generation.items():
            if key in VideoModelConfigService._DEDICATED_SWITCH_KEYS:
                continue
            if not isinstance(capability, dict) or capability.get("type") != "switch":
                continue

            attrs: dict[str, Any] = {"name": key, "type": "switch"}
            default = capability.get("default")
            if isinstance(default, bool):
                attrs["default"] = str(default).lower()
            attrs.update(
                VideoModelConfigService._format_generation_constraint_attrs(capability.get("constraints"))
            )
            description = capability.get("description")
            if isinstance(description, str) and description.strip():
                attrs["desc"] = description.strip()
            lines.append(f"    <capability {VideoModelConfigService._format_xml_attrs(attrs)}/>")
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

        # 这里按“模型决策真正会用到的字段”逐项输出，缺失字段保留为未知，
        # 避免把供应商未声明的能力误报为明确不支持。
        def _attr(name: str, value: str) -> None:
            if value:
                lines.append(f'    {name}="{VideoModelConfigService._xml_attr(value)}"')

        _attr("input", VideoModelConfigService._join_string_list(video_generation_config.get("supported_inputs")))
        for attr_name, attr_value in VideoModelConfigService._build_duration_attrs(video_generation_config).items():
            _attr(attr_name, attr_value)
        _attr("ref", VideoModelConfigService._build_reference_attr(video_generation_config))
        _attr("unsupported", VideoModelConfigService._build_unsupported_attr(video_generation_config))
        for attr_name, attr_value in VideoModelConfigService._build_audio_attrs(
            video_model_id,
            video_generation_config,
        ).items():
            _attr(attr_name, attr_value)

        # capability 是生成级开关，mode 是输入模式，前者先输出。
        child_lines = [
            *VideoModelConfigService._build_capability_lines(video_generation_config),
            *VideoModelConfigService._build_input_mode_lines(video_generation_config),
        ]
        if not child_lines:
            lines.append("  />")
            return "\n".join(lines)

        lines.append("  >")
        lines.extend(child_lines)
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
            "Missing capability fields mean unknown, not unsupported.",
        ]
        if has_video:
            if has_video_config:
                lines.extend([
                    "Use video resolution, aspect_ratio, and duration only from declared values; if unspecified by the user, infer legal values when the model rules make the choice clear, otherwise omit them.",
                    "Use video modes to choose reference fields and avoid unsupported combinations.",
                    "Treat audio_output=supported as model audio generation support, audio_output=unsupported as an explicit limitation, and audio_output=unknown as unverified; an omitted capability must not be presented as unsupported. When users request narration, dialogue, voice-over, music, or sound effects, preserve the request and use generation.audio_policy=generate when audio_output is supported or unknown. native_mute controls silent output only and does not mean audio generation is unavailable. For mute, use native_mute=true when declared; when mute_fallback=compose, generate first and compose the final video with output.audioPolicy=mute. Never emit provider-specific audio fields.",
                    "Before passing reference_*_paths, prompt MUST bind assets by list order: reference_image_paths[0]->[image1], reference_video_paths[0]->[video1], reference_audio_paths[0]->[audio1]. Do not submit references without tokens.",
                    "Canvas width/height are layout size, not generation parameters.",
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
