"""生成仅供大模型继续决策的 ToolResult.content。"""

from __future__ import annotations

import json
from typing import Any

from app.tools.canvas.presentation.batch_status import summarize_items


def overview_content(result: dict[str, Any]) -> str:
    """生成概览工具的模型可读文本。"""
    lines = [
        "Canvas overview completed.",
        f"- Project path: {result['project_path']}",
        f"- Elements: {result['total_elements']}",
        f"- Connections: {result['total_connections']}",
    ]
    pagination = []
    if result.get("page", 1) != 1:
        pagination.append(f"page={result['page']}")
    if result.get("limit", 50) != 50:
        pagination.append(f"limit={result['limit']}")
    if result.get("has_more"):
        pagination.append("has_more=true")
    if pagination:
        lines.append("- " + " | ".join(pagination))
    lines.append(f"- Returned: {len(result['elements'])}; has_more={str(bool(result.get('has_more'))).lower()}")
    for element in result["elements"]:
        lines.append(_overview_element_line(element))
    lines.append("Next: call query_canvas_element_details with exact Element IDs when full details are needed.")
    return "\n".join(lines)


def _overview_element_line(element: dict[str, Any]) -> str:
    """只渲染概览中非默认且对后续决策有用的 Element 字段。"""
    fields = [
        f"element_id={element['element_id']}",
        f"type={element['element_type']}",
    ]
    if element.get("name"):
        fields.append(f"name={element['name']}")
    if element.get("active_content_id"):
        fields.append(f"active_content_id={element['active_content_id']}")
    if str(element.get("asset_path") or "").startswith("data:"):
        fields.append("media=embedded data; no file path")
    elif element.get("asset_path"):
        fields.append(f"asset_path={element['asset_path']}")
    else:
        fields.append("asset_path=none")
    if element.get("file_name"):
        fields.append(f"file_name={element['file_name']}")
    if element.get("x") is not None or element.get("y") is not None:
        fields.append(f"position=({element.get('x')}, {element.get('y')})")
    if element.get("width") is not None or element.get("height") is not None:
        fields.append(f"size={element.get('width')}x{element.get('height')}")
    if element.get("content_count", 1) != 1:
        fields.append(f"contents={element.get('content_count', 0)}")
    if element.get("parent_element_id"):
        fields.append(f"parent_element_id={element['parent_element_id']}")
    if element.get("depth", 0) != 0:
        fields.append(f"depth={element['depth']}")
    if element.get("child_count", 0) != 0:
        fields.append(f"child_count={element['child_count']}")
    if element.get("content_count", 1) != 1:
        if element.get("main_content_id"):
            fields.append(f"main_content_id={element['main_content_id']}")
    if element.get("status") and element["status"] != "completed":
        fields.append(f"status={element['status']}")
    incoming = len(element.get("incoming") or [])
    outgoing = len(element.get("outgoing") or [])
    if incoming:
        fields.append(f"incoming={incoming}")
    if outgoing:
        fields.append(f"outgoing={outgoing}")
    return "- " + " | ".join(fields)


def elements_content(result: dict[str, Any]) -> str:
    """生成详情工具的模型可读文本。"""
    lines = [
        "Canvas Element details returned.",
        f"- Project path: {result['project_path']}",
        f"- Elements: {len(result['elements'])}",
    ]
    if result.get("details_complete") is False:
        lines.append("- details_complete=false")
    for element in result["elements"]:
        lines.append(f"Element {element['element_id']}:")
        fields = [f"type={element['element_type']}"]
        if element.get("name"):
            fields.append(f"name={element['name']}")
        if element.get("parent_element_id"):
            fields.append(f"parent_element_id={element['parent_element_id']}")
        if element.get("depth", 0) != 0:
            fields.append(f"depth={element['depth']}")
        lines.append("- " + " | ".join(fields))
        layout = element.get("layout") or {}
        layout_fields = []
        for key in ("x", "y", "width", "height", "scale_x", "scale_y", "z_index"):
            value = layout.get(key)
            if value is None:
                continue
            if key in {"scale_x", "scale_y"} and value == 1:
                continue
            if key == "z_index" and value == 0:
                continue
            layout_fields.append(f"{key}={value}")
        if layout_fields:
            lines.append("- layout=" + ", ".join(layout_fields))
        child_ids = element.get("child_element_ids") or []
        children = element.get("children") or []
        if child_ids and not children:
            lines.append(f"- child_element_ids={','.join(child_ids)}")
        contents = element.get("contents") or []
        active_content_id = element.get("active_content_id")
        main_content_id = element.get("main_content_id")
        if (len(contents) > 1 or active_content_id != main_content_id) and (active_content_id or main_content_id):
            content_fields = []
            if active_content_id:
                content_fields.append(f"active_content_id={active_content_id}")
            if main_content_id:
                content_fields.append(f"main_content_id={main_content_id}")
            if content_fields:
                lines.append("- " + " | ".join(content_fields))
        for content in contents:
            fields = [
                f"content_id={content['content_id']}",
            ]
            fields.append(f"version=V{content.get('version_index', 1)}")
            if content.get("is_current"):
                fields.append("current=true")
            if content.get("is_main"):
                fields.append("main=true")
            if content.get("file_name"):
                fields.append(f"file_name={content['file_name']}")
            if content.get("file_id"):
                fields.append(f"file_id={content['file_id']}")
            if content.get("file_exists") is False:
                fields.append("file_exists=false")
            fields.append(f"can_rename_file={str(content.get('can_rename_file', False)).lower()}")
            if content.get("file_rename_reason"):
                fields.append(f"file_rename_reason={content['file_rename_reason']}")
            if content.get("generation_name"):
                key = "expected_generation_name" if content.get("status") in {"pending", "processing"} else "original_generation_name"
                fields.append(f"{key}={content['generation_name']}")
            if content.get("discarded") is True:
                fields.append("review=discarded draft (main-content selection and connections unchanged)")
            if content.get("status"):
                fields.append(f"status={content['status']}")
            if content.get("source"):
                fields.append(f"source={content['source']}")
            for key in ("asset_path", "generation_task_id", "error_message"):
                if content.get(key):
                    fields.append(f"{key}={content[key]}")
            if content.get("retry_count", 0) != 0:
                fields.append(f"retry_count={content['retry_count']}")
            parameters = content.get("generation_parameters") or {}
            if parameters:
                fields.append("generation_record=recorded")
                for key in ("prompt", "model_id", "model_name", "size", "resolution", "mode"):
                    value = parameters.get(key)
                    if value is not None:
                        fields.append(f"{key}={value}")
            else:
                availability = "unavailable" if result.get("details_complete") is False else "not_recorded"
                fields.append(f"generation_record={availability}")
            payload = content.get("payload")
            if isinstance(payload, dict):
                for key in ("videoSequence", "audioSequence"):
                    if payload.get(key) is not None:
                        fields.append(f"{key}={_compact_value(payload[key])}")
                if payload.get("content") is not None:
                    fields.append(f"content={_compact_value(payload['content'])}")
            runtime = content.get("runtime")
            if isinstance(runtime, dict):
                fields.append(f"runtime={_compact_value(runtime, max_length=1200)}")
            lines.append("- content: " + " | ".join(fields))
            references = parameters.get("reference_images") or []
            if isinstance(references, list):
                for index, reference in enumerate(references, 1):
                    lines.append(f"  - reference [image{index}]: {reference}")
            options = parameters.get("reference_image_options") or []
            if isinstance(options, list):
                for option in options:
                    if not isinstance(option, dict) or not isinstance(option.get("crop"), dict):
                        continue
                    crop = option["crop"]
                    dimensions = ", ".join(f"{key}={crop[key]}" for key in ("x", "y", "width", "height") if key in crop)
                    lines.append(f"  - reference crop for {option.get('path', '-')}: {dimensions} (source image pixels)")
            settings = parameters.get("image_generation_config")
            if isinstance(settings, dict):
                for key, value in settings.items():
                    # 配置来自历史请求，不用当前模型默认值替代；按业务字段展示，不打印原始对象。
                    lines.append(f"  - generation setting {key}: {value}")
        for child in children:
            lines.append(f"- child={child['element_id']} | type={child['element_type']}")
    connections = result.get("connections") or []
    if connections:
        lines.append(f"Connections ({len(connections)}):")
        for connection in connections:
            lines.append(
                f"- connection_id={connection['connection_id']} | "
                f"source_element_id={connection['source_element_id']} | "
                f"target_element_id={connection['target_element_id']}"
            )
    for warning in result.get("warnings", []):
        lines.append(f"- Warning: {warning}")
    lines.append("An Element has one shared Canvas title; each Content version can reference its own file. Generation names are historical inputs, not current filenames.")
    return "\n".join(lines)


def _compact_value(value: Any, *, max_length: int = 500) -> str:
    """把用户内容压缩成可读单行，避免把内部 DTO 原样注入模型上下文。"""
    if isinstance(value, str):
        return value.replace("\n", " ")[:max_length]
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))[:max_length]


def items_content(
    summary: str,
    result: dict[str, Any],
    follow_up: str | None = None,
) -> str:
    """生成批量工具的模型可读逐项摘要。"""
    batch_status = summarize_items(result.get("items"), fallback_ok=True)
    lines = [summary, f"Batch status: {batch_status.status}"]
    for item in result.get("items", []):
        ordered_keys = (
            "item_ref",
            "status",
            "previous_status",
            "element_id",
            "content_id",
            "connection_id",
            "frame_element_id",
            "child_element_ids",
            "parent_element_id",
            "depth",
            "padding",
            "source_element_id",
            "target_element_id",
            "strategy",
            "previous_main_content_id",
            "main_content_id",
            "active_content_id",
            "removed_connection_ids",
            "generation_task_id",
            "retry_count",
            "idempotent_replay",
            "asset_path",
            "output_uri",
            "error_code",
            "error",
            "reason",
            "query_error",
            "persistence_warning",
            "persistence_error",
            "timed_out",
            "already_finalized",
            "next_action",
        )
        values = []
        for key in ordered_keys:
            value = item.get(key)
            if value is None or value == []:
                continue
            if key in {"query_error", "persistence_error"}:
                value = "Generation status is temporarily unavailable; continue with the same task ID."
            if isinstance(value, (list, dict)):
                rendered = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
            elif isinstance(value, bool):
                rendered = str(value).lower()
            else:
                rendered = str(value)
            values.append(f"{key}={rendered}")
        lines.append("- " + " | ".join(values))
    if any(
        item.get("generation_task_id")
        and item.get("status") in {"pending", "processing", "queued", "running"}
        for item in result.get("items", [])
    ):
        lines.append("Next: call wait_canvas_generation with the returned generation_task_id values.")
    if any(item.get("timed_out") for item in result.get("items", [])):
        lines.append("Continue waiting with the same generation_task_id; do not create a duplicate generation task.")
    elif follow_up and result.get("items"):
        statuses = {item.get("status") for item in result["items"]}
        if statuses and statuses <= {
            "completed",
            "added",
            "removed",
            "replaced",
            "already_removed",
            "already_replaced",
        }:
            lines.append(f"Next: {follow_up}")
    return "\n".join(lines)
