"""Canvas Content sidecar 元数据与生成重试信息。"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime
from typing import Any

from app.tools.canvas.domain.content_fields.generated_media_protocol import (
    find_generation_request,
    generated_request_fields,
    generation_request_field,
)
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.video_generation_utils.provider_asset_uri import normalize_provider_asset_uri

RUNTIME_METADATA_KEY = "__canvas_runtime__"
RUNTIME_SIDECAR_FILENAME = "element-details-runtime.json"
PUBLIC_DETAIL_FIELDS = generated_request_fields() | {"visualUnderstanding"}


class ContentMetadataService:
    """负责 Content 详情读取、写入和生成尝试演进。"""

    @staticmethod
    def remove(metadata: dict, element_id: str, content_ids: list[str] | None = None) -> None:
        """移除已确认删除目标的详情；None 表示整元素，不影响其它版本或未知旧记录。"""
        documents = [metadata]
        runtime = metadata.get(RUNTIME_METADATA_KEY)
        if isinstance(runtime, dict):
            documents.append(runtime)
        for document in documents:
            elements = document.get("elements")
            if isinstance(elements, dict):
                if content_ids is None:
                    elements.pop(element_id, None)
                else:
                    element = elements.get(element_id)
                    details = element.get("contentDetails") if isinstance(element, dict) else None
                    if isinstance(details, dict):
                        for content_id in content_ids:
                            details.pop(content_id, None)
            legacy = document.get("contentDetails")
            if isinstance(legacy, dict):
                for content_id, detail in list(legacy.items()):
                    if isinstance(detail, dict) and detail.get("elementId") == element_id and (content_ids is None or content_id in content_ids):
                        legacy.pop(content_id, None)

    @staticmethod
    def get(metadata: dict, element_id: str, content_id: str) -> dict[str, Any]:
        """读取公共与运行态合并后的 Content 详情，并兼容旧 sidecar。"""
        elements = metadata.get("elements") if isinstance(metadata, dict) else None
        runtime = metadata.get(RUNTIME_METADATA_KEY) if isinstance(metadata, dict) else None
        runtime_elements = runtime.get("elements") if isinstance(runtime, dict) else None
        public_detail = _find_detail(elements, element_id, content_id)
        runtime_detail = _find_detail(runtime_elements, element_id, content_id)
        if public_detail or runtime_detail:
            merged = {**runtime_detail, **public_detail}
            if "generationParameters" not in merged:
                generation_request = find_generation_request(public_detail)
                if generation_request is not None:
                    merged["generationParameters"] = _generation_parameters_from_public_request(generation_request[1])
            return merged
        legacy = metadata.get("contentDetails") if isinstance(metadata, dict) else None
        if isinstance(legacy, dict) and isinstance(legacy.get(content_id), dict):
            return dict(legacy[content_id])
        return {}

    @staticmethod
    def set(metadata: dict, element_id: str, content_id: str, detail: dict[str, Any]) -> None:
        """按线上公共字段与后端运行态分别写入两个 sidecar。"""
        public_detail = {
            key: value for key, value in detail.items()
            if key in PUBLIC_DETAIL_FIELDS and value is not None
        }
        runtime_detail = {
            key: value for key, value in detail.items()
            if key not in PUBLIC_DETAIL_FIELDS
        }
        _set_detail(metadata, element_id, content_id, public_detail, runtime=False)
        _set_detail(metadata, element_id, content_id, runtime_detail, runtime=True)
        legacy = metadata.get("contentDetails")
        if isinstance(legacy, dict):
            legacy.pop(content_id, None)
            if not legacy:
                metadata.pop("contentDetails", None)

    @staticmethod
    def clear_public_request(metadata: dict, element_id: str, content_id: str) -> None:
        """移除公共 sidecar 中指定 Content 的生成请求。"""
        elements = metadata.get("elements") if isinstance(metadata, dict) else None
        if not isinstance(elements, dict):
            return
        element = elements.get(element_id)
        if not isinstance(element, dict):
            return
        details = element.get("contentDetails")
        if not isinstance(details, dict):
            return
        details.pop(content_id, None)
        if not details:
            element.pop("contentDetails", None)
        if not element:
            elements.pop(element_id, None)

    @staticmethod
    def new_detail(element_id: str, data: dict[str, Any], project_path: str | None = None) -> dict[str, Any]:
        """创建来源、公共生成请求和运行态生成尝试详情。"""
        detail: dict[str, Any] = {
            "elementId": element_id,
            "source": data.get("source", "user"),
        }
        if data.get("source") == "generated":
            parameters = _clean_generation_parameters(data)
            parameters = _with_generation_start_metadata(parameters, str(data.get("contentType") or ""))
            detail.update({
                "retryCount": 0,
                "generationStatus": "pending",
                "generationParameters": parameters,
            })
            request_field = generation_request_field(str(data.get("contentType") or ""))
            if request_field:
                detail[request_field] = ContentMetadataService.build_public_generation_request(
                    parameters,
                    str(data.get("contentType") or ""),
                    project_path=project_path,
                )
        elif data.get("source") == "imported":
            detail["assetPath"] = data.get("assetPath")
        return detail

    @staticmethod
    def merge_generation_override(
        element_type: str,
        original: dict[str, Any],
        override: dict[str, Any] | None,
    ) -> dict[str, Any]:
        """只允许覆盖指定生成能力公开的输入字段。"""
        allowed = {
            "image": {"prompt", "size", "model_id", "name", "reference_images"},
            "video": {
                "prompt",
                "model_id",
                "estimate_id",
                "skip_point_estimate",
                "name",
                "reference_images",
                "reference_image_paths",
                "reference_video_paths",
                "reference_audio_paths",
                "frame_start_path",
                "frame_end_path",
                "input_mode",
                "task",
                "size",
                "duration_seconds",
                "aspect_ratio",
                "resolution",
                "fps",
                "seed",
                "watermark",
                "draft",
                "extensions",
            },
        }.get(element_type)
        if allowed is None:
            raise CanvasDomainError(
                "GENERATION_NOT_CONFIGURED",
                f"No retry capability is configured for {element_type}.",
            )
        values = dict(override or {})
        unexpected = set(values) - allowed
        if unexpected:
            raise CanvasDomainError(
                "CONTENT_FIELD_MANAGED_INTERNAL",
                f"Generation override contains unsupported fields: {', '.join(sorted(unexpected))}.",
            )
        merged = {**dict(original or {}), **values}
        if merged.get("skip_point_estimate") is True:
            merged.pop("estimate_id", None)
        return merged

    @staticmethod
    def start_retry(
        element_id: str,
        detail: dict[str, Any],
        retry_count: int,
        parameters: dict[str, Any],
        idempotency_key: str,
        element_type: str | None = None,
        project_path: str | None = None,
    ) -> dict[str, Any]:
        """归档上一终态并创建携带新公共请求的新尝试。"""
        updated = dict(detail)
        history = list(updated.get("attemptHistory") or [])
        if updated.get("generationStatus") in {"completed", "failed", "terminated"}:
            history.append({
                "generationTaskId": updated.get("generationTaskId"),
                "generationStatus": updated.get("generationStatus"),
                "outputUri": updated.get("outputUri"),
                "errorMessage": updated.get("errorMessage"),
            })
        for key in ("providerTaskId", "generationTaskId", "outputUri", "outputFilename", "errorMessage"):
            updated.pop(key, None)
        cleaned_parameters = _clean_generation_parameters(parameters)
        for key in ("start_time", "expected_finished_at", "end_time", "duration_ms"):
            cleaned_parameters.pop(key, None)
        cleaned_parameters = _with_generation_start_metadata(cleaned_parameters, element_type or "")
        updated.update({
            "elementId": element_id,
            "source": "generated",
            "retryCount": retry_count,
            "generationStatus": "pending",
            "generationParameters": cleaned_parameters,
            "attemptHistory": history,
            "retryIdempotencyKey": idempotency_key,
        })
        request_field = generation_request_field(element_type or "")
        if request_field:
            updated[request_field] = ContentMetadataService.build_public_generation_request(
                cleaned_parameters,
                element_type or "",
                project_path=project_path,
            )
        return updated

    @staticmethod
    def build_video_result_metadata(parameters: dict[str, Any]) -> dict[str, Any]:
        """根据生成参数构造视频详情面板可读的初始元数据。"""
        generation_info = {
            key: parameters[key]
            for key in ("task", "input_mode", "aspect_ratio", "resolution", "duration_seconds")
            if parameters.get(key) not in (None, "")
        }
        runtime = {"started_at": parameters.get("start_time")} if parameters.get("start_time") else {}
        return {
            key: value
            for key, value in (("generation_info", generation_info), ("runtime", runtime))
            if value
        }

    @staticmethod
    def merge_video_result_metadata(
        existing: dict[str, Any],
        incoming: dict[str, Any] | None,
        status: str,
        finished_at: str | None = None,
    ) -> dict[str, Any]:
        """合并视频生成元数据，并在终态补齐完成时间和耗时。"""
        current = dict(existing) if isinstance(existing, dict) else {}
        incoming = incoming if isinstance(incoming, dict) else {}
        for key in ("billing", "generation_info", "runtime"):
            value = incoming.get(key)
            if isinstance(value, dict):
                current[key] = {**(current.get(key) if isinstance(current.get(key), dict) else {}), **value}
        runtime = dict(current.get("runtime") or {})
        if status in {"completed", "failed", "terminated"}:
            runtime.setdefault("finished_at", finished_at or _now_text())
            started_at = runtime.get("started_at")
            if runtime.get("elapsed_seconds") is None:
                elapsed = _diff_seconds(started_at, runtime.get("finished_at"))
                if elapsed is not None:
                    runtime["elapsed_seconds"] = elapsed
        if runtime:
            current["runtime"] = runtime
        return current

    @staticmethod
    def complete_image_generation_request(request: dict[str, Any], status: str) -> dict[str, Any]:
        """在图片生成终态补齐完成时间和毫秒耗时。"""
        completed = dict(request)
        if status not in {"completed", "failed", "terminated"}:
            return completed
        completed.setdefault("end_time", _now_text())
        if completed.get("duration_ms") is None:
            elapsed = _diff_seconds(completed.get("start_time"), completed.get("end_time"))
            if elapsed is not None:
                completed["duration_ms"] = elapsed * 1000
        return completed

    @staticmethod
    def retry_idempotency_key(
        item_ref: str,
        element_id: str,
        content_id: str,
        parameters: dict[str, Any],
    ) -> str:
        """根据一次明确的重试请求生成稳定幂等键。

        item_ref 参与幂等键只用于识别同一次请求的重放；它不会影响 retryCount，
        因此更换 item_ref 仍然必须经过统一的重试上限校验。
        """
        stable_parameters = dict(parameters or {})
        for key in ("start_time", "expected_finished_at", "end_time", "duration_ms", "mode"):
            stable_parameters.pop(key, None)
        payload = {
            "item_ref": item_ref,
            "element_id": element_id,
            "content_id": content_id,
            "parameters": stable_parameters,
        }
        serialized = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    @staticmethod
    def split_legacy_metadata(public: dict[str, Any], runtime: dict[str, Any]) -> None:
        """把旧版混合详情拆成线上公共 sidecar和运行态 sidecar。"""
        elements = public.get("elements") if isinstance(public, dict) else None
        if not isinstance(elements, dict):
            public.setdefault("version", "2.0.0")
            public.setdefault("elements", {})
            return
        runtime.setdefault("version", "1.0.0")
        runtime_elements = runtime.setdefault("elements", {})
        for element_id, raw_element in list(elements.items()):
            if not isinstance(raw_element, dict):
                elements.pop(element_id, None)
                continue
            details = raw_element.get("contentDetails")
            if not isinstance(details, dict):
                elements.pop(element_id, None)
                continue
            for content_id, detail in list(details.items()):
                if not isinstance(detail, dict):
                    details.pop(content_id, None)
                    continue
                public_detail = {
                    key: value for key, value in detail.items()
                    if key in PUBLIC_DETAIL_FIELDS and value is not None
                }
                runtime_detail = {
                    key: value for key, value in detail.items()
                    if key not in PUBLIC_DETAIL_FIELDS
                }
                if public_detail:
                    details[content_id] = public_detail
                else:
                    details.pop(content_id, None)
                if runtime_detail:
                    runtime_element = runtime_elements.setdefault(element_id, {})
                    runtime_details = runtime_element.setdefault("contentDetails", {})
                    existing = runtime_details.get(content_id, {})
                    runtime_details[content_id] = {**runtime_detail, **existing}
            if not details:
                elements.pop(element_id, None)
        public["version"] = "2.0.0"
        runtime["version"] = "1.0.0"

    @staticmethod
    def build_public_generation_request(
        parameters: dict[str, Any],
        element_type: str,
        project_path: str | None = None,
    ) -> dict[str, Any]:
        """按媒体类型注册的构建器生成公共请求。"""
        request: dict[str, Any] = {
            "prompt": str(parameters.get("prompt") or ""),
        }
        generic_keys = (
            (
                "name",
                "size",
                "image_id",
                "mode",
                "start_time",
                "expected_finished_at",
                "end_time",
                "duration_ms",
                "model_id",
            )
            if element_type == "image"
            else ("model_id",)
        )
        for key in generic_keys:
            value = parameters.get(key)
            if value is not None:
                request[key] = value
        builder = _PUBLIC_GENERATION_REQUEST_BUILDERS.get(element_type)
        if builder is not None:
            request.update(builder(parameters, project_path=project_path))
        return request


def _build_public_image_request(parameters: dict[str, Any], project_path: str | None = None) -> dict[str, Any]:
    """构建图片生成请求的媒体特有字段。"""
    references = parameters.get("reference_images")
    if not isinstance(references, (list, tuple)) or not references:
        return {}
    return {
        "reference_images": [
            _normalize_project_path(path, project_path)
            for path in references
            if isinstance(path, str) and path
        ]
    }


def _with_generation_start_metadata(parameters: dict[str, Any], element_type: str) -> dict[str, Any]:
    """为新一轮生成建立可直接展示的初始时间、模式和模型快照。"""
    values = dict(parameters)
    values.setdefault("start_time", _now_text())
    if element_type == "image":
        values.setdefault(
            "mode",
            "edit" if values.get("reference_images") or values.get("reference_image_paths") else "generate",
        )
    elif element_type == "video":
        values.setdefault("input_mode", _resolve_video_input_mode(values))
    return values


def _now_text() -> str:
    """返回包含明确时区的新生成详情时间文本。"""
    return datetime.now().astimezone().isoformat(timespec="seconds")


def _diff_seconds(started_at: Any, finished_at: Any) -> int | None:
    """计算前端时间文本之间的整秒耗时。"""
    if not isinstance(started_at, str) or not isinstance(finished_at, str):
        return None
    try:
        started = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        finished = datetime.fromisoformat(finished_at.replace("Z", "+00:00"))
    except ValueError:
        return None
    if started.tzinfo is None and finished.tzinfo is not None:
        started = started.replace(tzinfo=finished.tzinfo)
    if finished.tzinfo is None and started.tzinfo is not None:
        finished = finished.replace(tzinfo=started.tzinfo)
    return max(0, int((finished - started).total_seconds()))


def _resolve_video_input_mode(parameters: dict[str, Any]) -> str:
    """按视频任务参数推导与 Design API 一致的输入模式。"""
    explicit = parameters.get("input_mode")
    if isinstance(explicit, str) and explicit:
        return explicit
    if parameters.get("task") == "edit":
        return "video_edit"
    if parameters.get("frame_start_path") or parameters.get("frame_end_path"):
        return "keyframe_guided"
    if (
        parameters.get("reference_images")
        or parameters.get("reference_image_paths")
        or parameters.get("reference_video_paths")
        or parameters.get("reference_audio_paths")
    ):
        return "omni_reference"
    return "standard"


def _find_detail(elements: Any, element_id: str, content_id: str) -> dict[str, Any]:
    """从 Element/Content 文档中读取一条详情。"""
    if not isinstance(elements, dict):
        return {}
    element = elements.get(element_id)
    details = element.get("contentDetails") if isinstance(element, dict) else None
    detail = details.get(content_id) if isinstance(details, dict) else None
    return dict(detail) if isinstance(detail, dict) else {}


def _set_detail(metadata: dict, element_id: str, content_id: str, detail: dict[str, Any], *, runtime: bool) -> None:
    """写入公共或运行态文档中的 Content 详情。"""
    if not detail:
        return
    target = metadata.setdefault(RUNTIME_METADATA_KEY, {}) if runtime else metadata
    target.setdefault("version", "1.0.0" if runtime else "2.0.0")
    elements = target.setdefault("elements", {})
    element = elements.setdefault(element_id, {})
    element.setdefault("contentDetails", {})[content_id] = dict(detail)


def _clean_generation_parameters(data: dict[str, Any]) -> dict[str, Any]:
    """移除来源和协议包装字段，保留重试所需的生成输入。"""
    nested = data.get("generationParameters")
    if isinstance(nested, dict):
        data = nested
    return {
        key: value for key, value in data.items()
        if key not in {"source", "contentType", "assetPath"} and value is not None
    }


def _normalize_project_path(value: str, project_path: str | None = None) -> str:
    """将路径规范为相对于当前 magic.project.js 的 ./ URI。"""
    normalized = value.replace("\\", "/").strip()
    normalized_provider_uri = normalize_provider_asset_uri(normalized)
    if normalized_provider_uri is not None:
        return normalized_provider_uri
    if "://" in normalized or normalized.startswith("data:"):
        return normalized
    normalized = normalized.lstrip("/")
    without_dot = normalized[2:] if normalized.startswith("./") else normalized
    if project_path:
        project_prefix = project_path.replace("\\", "/").strip().strip("/")
        if without_dot == project_prefix:
            return "./"
        if without_dot.startswith(f"{project_prefix}/"):
            without_dot = without_dot[len(project_prefix) + 1 :]
    return f"./{without_dot}"


def _build_public_video_request(parameters: dict[str, Any], project_path: str | None = None) -> dict[str, Any]:
    """将内部视频参数转换为 magic-web 读取的 GenerateVideoRequest 结构。"""
    request: dict[str, Any] = {}
    for key in ("input_mode", "task", "model_id"):
        value = parameters.get(key)
        if value not in (None, ""):
            request[key] = value

    composition = parameters.get("composition")
    if isinstance(composition, dict):
        request["composition"] = {
            "videoSequence": [
                value for value in composition.get("videoSequence", [])
                if isinstance(value, str) and value
            ],
            "audioSequence": [
                value for value in composition.get("audioSequence", [])
                if isinstance(value, str) and value
            ],
            "output": dict(composition.get("output"))
            if isinstance(composition.get("output"), dict)
            else {},
        }

    image_paths = parameters.get("reference_images") or parameters.get("reference_image_paths") or []
    video_paths = parameters.get("reference_video_paths") or []
    audio_paths = parameters.get("reference_audio_paths") or []
    inputs: dict[str, Any] = {
        "reference_images": _build_uri_inputs(image_paths, project_path),
        "reference_videos": _build_uri_inputs(video_paths, project_path),
        "reference_audios": _build_uri_inputs(audio_paths, project_path),
        "frames": _build_video_frames(parameters, project_path),
    }
    request["inputs"] = inputs

    generation_keys = ("aspect_ratio", "resolution", "duration_seconds", "fps", "seed", "watermark")
    generation = {
        key: parameters[key]
        for key in generation_keys
        if parameters.get(key) not in (None, "")
    }
    # draft 是「这条内容是不是样片」的标记位，只写 true：写成 false 会让所有非样片视频
    # 凭空多出一个键，而前端的判定是 generation.draft === true，false 不带来任何信息。
    if parameters.get("draft") is True:
        generation["draft"] = True
    if generation:
        request["generation"] = generation
    extensions = parameters.get("extensions")
    if isinstance(extensions, dict) and extensions:
        request["extensions"] = dict(extensions)
    return request


_PUBLIC_GENERATION_REQUEST_BUILDERS = {
    "image": _build_public_image_request,
    "video": _build_public_video_request,
}


def _build_uri_inputs(values: Any, project_path: str | None = None) -> list[dict[str, str]]:
    """将路径列表转换成 GenerateVideoRequest 的 URI 输入项。"""
    if not isinstance(values, (list, tuple)):
        return []
    return [
        {"uri": _normalize_project_path(value, project_path)}
        for value in values
        if isinstance(value, str) and value
    ]


def _build_video_frames(parameters: dict[str, Any], project_path: str | None = None) -> list[dict[str, str]]:
    """将首尾帧路径转换成带角色的输入项。"""
    frames: list[dict[str, str]] = []
    for role, key in (("start", "frame_start_path"), ("end", "frame_end_path")):
        value = parameters.get(key)
        if isinstance(value, str) and value:
            frames.append({"role": role, "uri": _normalize_project_path(value, project_path)})
    return frames


def _generation_parameters_from_public_request(request: dict[str, Any]) -> dict[str, Any]:
    """从新旧公共视频请求恢复重试所需的内部参数。"""
    inputs = request.get("inputs") if isinstance(request.get("inputs"), dict) else {}
    generation = request.get("generation") if isinstance(request.get("generation"), dict) else {}
    parameters: dict[str, Any] = {
        key: value for key, value in request.items()
        if key not in {"inputs", "generation", "callbacks", "execution"}
    }
    image_values = _read_uri_values(inputs.get("reference_images"))
    if not image_values:
        image_values = _read_string_values(request.get("reference_image_paths"))
    if not image_values:
        image_values = _read_string_values(request.get("reference_images"))
    if image_values:
        parameters["reference_images"] = image_values
    for request_key, input_key in (
        ("reference_video_paths", "reference_videos"),
        ("reference_audio_paths", "reference_audios"),
    ):
        values = _read_uri_values(inputs.get(input_key))
        if values:
            parameters[request_key] = values
    frames = inputs.get("frames") if isinstance(inputs, dict) else None
    if isinstance(frames, list):
        for frame in frames:
            if not isinstance(frame, dict) or not isinstance(frame.get("uri"), str):
                continue
            role = frame.get("role")
            if role == "start":
                parameters["frame_start_path"] = frame["uri"]
            elif role == "end":
                parameters["frame_end_path"] = frame["uri"]
    parameters.update(generation)
    return parameters


def _read_uri_values(value: Any) -> list[str]:
    """读取 URI 对象数组，同时兼容旧的字符串数组。"""
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for item in value:
        if isinstance(item, str) and item:
            result.append(item)
        elif isinstance(item, dict) and isinstance(item.get("uri"), str) and item["uri"]:
            result.append(item["uri"])
    return result


def _read_string_values(value: Any) -> list[str]:
    """读取旧版路径字符串数组。"""
    return [item for item in value if isinstance(item, str) and item] if isinstance(value, list) else []
