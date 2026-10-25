"""Canvas Element Details sidecar 的结构适配与来源合并。"""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from app.tools.canvas.domain.models import CanvasProject


class ElementDetailsAdapter:
    """把 baseline、user 和 legacy sidecar 统一映射为 Content 级详情。"""

    def merge(
        self,
        project: CanvasProject,
        baseline: dict[str, Any],
        user: dict[str, Any],
    ) -> dict[str, dict[str, dict[str, Any]]]:
        """按 user source 优先级合并可唯一映射的 Content 详情。"""
        result: dict[str, dict[str, dict[str, Any]]] = {}
        self._collect(result, project, baseline, user_document=False)
        runtime = baseline.get("__canvas_runtime__") if isinstance(baseline, dict) else None
        if isinstance(runtime, dict):
            self._collect(result, project, runtime, user_document=False)
        self._collect(result, project, user, user_document=True)
        return result

    def _collect(
        self,
        target: dict[str, dict[str, dict[str, Any]]],
        project: CanvasProject,
        document: dict[str, Any],
        user_document: bool,
    ) -> None:
        """收集一种 sidecar 形态并映射到真实 Content。"""
        elements = document.get("elements") if isinstance(document, dict) else None
        if isinstance(elements, dict):
            for element_id, raw_element in elements.items():
                if not isinstance(raw_element, dict):
                    continue
                details = raw_element.get("contentDetails")
                if isinstance(details, dict):
                    for content_id, detail in details.items():
                        if isinstance(detail, dict):
                            self._merge_one(target, str(element_id), str(content_id), detail, user_document)
                legacy = {
                    key: value
                    for key, value in raw_element.items()
                    if key not in {"source", "contentDetails"}
                }
                if legacy:
                    self._map_legacy(target, project, str(element_id), legacy, user_document)
        legacy_details = document.get("contentDetails") if isinstance(document, dict) else None
        if isinstance(legacy_details, dict):
            for content_id, detail in legacy_details.items():
                if not isinstance(detail, dict):
                    continue
                element_id = detail.get("elementId")
                if isinstance(element_id, str):
                    self._merge_one(target, element_id, str(content_id), detail, user_document)

    def _map_legacy(
        self,
        target: dict[str, dict[str, dict[str, Any]]],
        project: CanvasProject,
        element_id: str,
        detail: dict[str, Any],
        user_document: bool,
    ) -> None:
        """仅在 Element 只有一个 Content 时映射旧 Element 级详情。"""
        element = project.canvas.get_element(element_id)
        if element is None or len(element.contents) != 1:
            return
        self._merge_one(target, element_id, element.contents[0].content_id, detail, user_document)

    @staticmethod
    def _merge_one(
        target: dict[str, dict[str, dict[str, Any]]],
        element_id: str,
        content_id: str,
        detail: dict[str, Any],
        user_document: bool,
    ) -> None:
        """按来源优先级合并一条详情。"""
        element = target.setdefault(element_id, {})
        existing = element.get(content_id)
        incoming = deepcopy(detail)
        if existing is None:
            element[content_id] = incoming
            return
        existing_source = existing.get("source")
        incoming_source = incoming.get("source")
        if user_document and incoming_source == "user":
            element[content_id] = {**existing, **incoming}
        elif existing_source != "user" and incoming_source != "user":
            element[content_id] = {**existing, **incoming}
