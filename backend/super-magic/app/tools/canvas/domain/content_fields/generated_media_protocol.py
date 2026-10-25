"""Canvas 可生成媒体的协议注册表。"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class GeneratedMediaProtocol:
    """描述一种可生成媒体的 Content 协议字段。"""

    element_type: str
    request_field: str
    content_fields: frozenset[str]


_GENERATED_MEDIA_PROTOCOLS = {
    "image": GeneratedMediaProtocol(
        element_type="image",
        request_field="generateImageRequest",
        content_fields=frozenset(
            {
                "src",
                "status",
                "errorMessage",
                "visualUnderstanding",
                "generateImageRequest",
                "imageGenerationTaskMeta",
                "crop",
            }
        ),
    ),
    "video": GeneratedMediaProtocol(
        element_type="video",
        request_field="generateVideoRequest",
        content_fields=frozenset(
            {
                "src",
                "status",
                "errorMessage",
                "visualUnderstanding",
                "generateVideoRequest",
                "videoEditorDraft",
                "videoGenerationResultMeta",
            }
        ),
    ),
}


def generated_media_protocol(element_type: str) -> GeneratedMediaProtocol | None:
    """按 Element 类型返回可生成媒体协议。"""
    return _GENERATED_MEDIA_PROTOCOLS.get(element_type)


def generated_media_types() -> frozenset[str]:
    """返回当前已注册的可生成媒体类型。"""
    return frozenset(_GENERATED_MEDIA_PROTOCOLS)


def ordered_generated_media_types() -> tuple[str, ...]:
    """返回按注册顺序排列的可生成媒体类型。"""
    return tuple(_GENERATED_MEDIA_PROTOCOLS)


def generated_request_fields() -> frozenset[str]:
    """返回所有可生成媒体的公共请求字段名。"""
    return frozenset(protocol.request_field for protocol in _GENERATED_MEDIA_PROTOCOLS.values())


def generated_content_fields(element_type: str) -> frozenset[str]:
    """返回指定媒体类型允许的 Content 字段。"""
    protocol = generated_media_protocol(element_type)
    return protocol.content_fields if protocol is not None else frozenset()


def generation_request_field(element_type: str) -> str | None:
    """返回指定媒体类型对应的 sidecar 生成请求字段。"""
    protocol = generated_media_protocol(element_type)
    return protocol.request_field if protocol is not None else None


def find_generation_request(detail: dict[str, object]) -> tuple[str, dict[str, object]] | None:
    """从详情中找到第一条已注册的生成请求。"""
    for protocol in _GENERATED_MEDIA_PROTOCOLS.values():
        field_name = protocol.request_field
        value = detail.get(field_name)
        if isinstance(value, dict):
            return field_name, value
    return None
