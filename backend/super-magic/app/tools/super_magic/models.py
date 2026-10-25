"""Exact public IDs and small resource projections."""

from __future__ import annotations

from typing import Any

from pydantic import ConfigDict

from app.tools.core import BaseToolParams


class ProductParams(BaseToolParams):
    model_config = ConfigDict(extra="forbid")


def resource_id(value: str, name: str = "resource_id") -> str:
    if (
        not isinstance(value, str)
        or not value.isascii()
        or not value.isdecimal()
        or value.startswith("0")
        or len(value) > 19
        or (len(value) == 19 and value > "9223372036854775807")
    ):
        raise ValueError(f"{name} must be a positive decimal ID string")
    return value


def projected(value: Any, fields: tuple[str, ...]) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError("The service returned an invalid resource")
    result = {key: value[key] for key in fields if key in value and value[key] is not None}
    for key in ("id", "project_id", "workspace_id", "topic_id", "file_id", "task_id", "queue_id"):
        if key in result:
            result[key] = str(result[key])
    return result


WORKSPACE = ("id", "name", "workspace_type", "is_archived", "is_pinned", "project_count", "updated_at")
PROJECT = ("id", "project_name", "project_description", "workspace_id", "workspace_name", "topic_count", "user_role", "is_pinned", "created_at", "updated_at", "last_active_at")
TOPIC = ("id", "topic_name", "project_id", "workspace_id", "topic_mode", "agent_code", "task_status", "updated_at")
FILE = ("id", "file_id", "file_name", "name", "project_id", "parent_id", "relative_file_path", "is_directory", "file_type", "file_size", "created_at", "updated_at")


def projected_page(raw: Any, fields: tuple[str, ...]) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("The service returned an invalid page")
    values = raw.get("list", raw.get("items"))
    if not isinstance(values, list):
        raise ValueError("The service returned a page without a list")
    result: dict[str, Any] = {"items": [projected(item, fields) for item in values]}
    for key in ("page", "page_size", "total", "has_more", "next_cursor", "next_parent_ids"):
        if key in raw:
            result[key] = raw[key]
    return result
