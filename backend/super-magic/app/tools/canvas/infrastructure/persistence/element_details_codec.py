"""Canvas Element Details sidecar 编解码校验。"""

from __future__ import annotations

from typing import Any

from app.tools.canvas.domain.content_fields.generated_media_protocol import generated_request_fields


class ElementDetailsCodec:
    """校验 Element Details sidecar 的公共结构。"""

    @classmethod
    def validate(cls, document: dict[str, Any]) -> dict[str, Any]:
        """拒绝无法安全映射的 sidecar 结构，不静默跳过损坏数据。"""
        if not isinstance(document, dict):
            raise ValueError("INVALID_ELEMENT_DETAILS")
        version = document.get("version")
        if version is not None and not isinstance(version, str):
            raise ValueError("UNSUPPORTED_ELEMENT_DETAILS_STRUCTURE")
        elements = document.get("elements")
        if elements is not None:
            if not isinstance(elements, dict):
                raise ValueError("UNSUPPORTED_ELEMENT_DETAILS_STRUCTURE")
            for element_id, raw_element in elements.items():
                if not isinstance(element_id, str) or not element_id or not isinstance(raw_element, dict):
                    raise ValueError("UNSUPPORTED_ELEMENT_DETAILS_STRUCTURE")
                cls._validate_element_entry(raw_element)
        content_details = document.get("contentDetails")
        if content_details is not None:
            cls._validate_content_details(content_details)
        return document

    @classmethod
    def validate_public(cls, document: dict[str, Any]) -> dict[str, Any]:
        """校验 backend 公共 sidecar 只包含线上约定的重字段。"""
        cls.validate(document)
        if set(document) - {"version", "elements"}:
            raise ValueError("UNSUPPORTED_PUBLIC_ELEMENT_DETAILS_STRUCTURE")
        elements = document.get("elements") or {}
        for raw_element in elements.values():
            if not isinstance(raw_element, dict) or set(raw_element) - {"contentDetails"}:
                raise ValueError("UNSUPPORTED_PUBLIC_ELEMENT_DETAILS_STRUCTURE")
            details = raw_element.get("contentDetails") if isinstance(raw_element, dict) else None
            for detail in (details or {}).values() if isinstance(details, dict) else ():
                if not isinstance(detail, dict) or not set(detail).issubset(
                    generated_request_fields() | {"visualUnderstanding"}
                ):
                    raise ValueError("UNSUPPORTED_PUBLIC_ELEMENT_DETAILS_STRUCTURE")
        return document

    @classmethod
    def _validate_element_entry(cls, raw_element: dict[str, Any]) -> None:
        """校验 Element 级旧结构和 Content 级新结构。"""
        source = raw_element.get("source")
        if source is not None and not isinstance(source, str):
            raise ValueError("UNSUPPORTED_ELEMENT_DETAILS_STRUCTURE")
        content_details = raw_element.get("contentDetails")
        if content_details is not None:
            cls._validate_content_details(content_details)
        for key, value in raw_element.items():
            if key in {"source", "contentDetails"}:
                continue
            if not isinstance(key, str) or not isinstance(value, (dict, list, str, int, float, bool, type(None))):
                raise ValueError("UNSUPPORTED_ELEMENT_DETAILS_STRUCTURE")

    @staticmethod
    def _validate_content_details(content_details: Any) -> None:
        """校验 Content ID 到详情对象的映射。"""
        if not isinstance(content_details, dict):
            raise ValueError("UNSUPPORTED_ELEMENT_DETAILS_STRUCTURE")
        for content_id, detail in content_details.items():
            if not isinstance(content_id, str) or not content_id or not isinstance(detail, dict):
                raise ValueError("UNSUPPORTED_ELEMENT_DETAILS_STRUCTURE")
