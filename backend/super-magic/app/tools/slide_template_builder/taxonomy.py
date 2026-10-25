"""Access slide template categories and tags from a catalog payload."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any


TAXONOMY_PATH = (
    Path(__file__).resolve().parents[3]
    / "agents"
    / "skills"
    / "slide-template-maker"
    / "references"
    / "template-taxonomy.json"
)


@lru_cache(maxsize=1)
def load_taxonomy() -> dict[str, Any]:
    try:
        data = json.loads(TAXONOMY_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Bundled slide template taxonomy is unavailable: {TAXONOMY_PATH}") from exc
    return catalog_from_payload(data)


def catalog_from_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Slide template taxonomy must be a JSON object.")
    categories = payload.get("categories")
    groups = payload.get("groups")
    tags = payload.get("tags")
    if not isinstance(categories, list) or not isinstance(groups, list) or not isinstance(tags, list):
        raise ValueError("Slide template taxonomy must include categories, groups, and tags lists.")
    return {"categories": categories, "groups": groups, "tags": tags}


def _catalog(taxonomy: dict[str, Any] | None) -> dict[str, Any]:
    return taxonomy if taxonomy is not None else load_taxonomy()


def _localized_parts(item: dict[str, Any]) -> tuple[str, str]:
    names = item.get("name_i18n") if isinstance(item.get("name_i18n"), dict) else {}
    return str(names.get("zh_CN") or ""), str(names.get("en_US") or "")


def localized_name(item: dict[str, Any]) -> str:
    return " | ".join(part for part in _localized_parts(item) if part)


def _public_named_record(item: dict[str, Any]) -> dict[str, Any]:
    zh, en = _localized_parts(item)
    return {"code": item["code"], "zh": zh, "en": en}


def compact_agent_catalog(taxonomy: dict[str, Any] | None = None) -> dict[str, Any]:
    tags_by_group: dict[str, list[dict[str, Any]]] = {}
    for item in _raw_tags(taxonomy):
        tags_by_group.setdefault(item["group_code"], []).append(_public_named_record(item))
    groups = []
    for item in _catalog(taxonomy).get("groups", []):
        if not isinstance(item, dict) or not isinstance(item.get("code"), str):
            continue
        groups.append({**_public_named_record(item), "tags": tags_by_group.get(item["code"], [])})
    return {"categories": active_categories(taxonomy), "groups": groups}


def active_categories(taxonomy: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    return [
        _public_named_record(item)
        for item in _catalog(taxonomy).get("categories", [])
        if isinstance(item, dict) and item.get("status") == 1 and isinstance(item.get("code"), str)
    ]


def active_category_codes(taxonomy: dict[str, Any] | None = None) -> set[str]:
    return {item["code"] for item in active_categories(taxonomy)}


def tag_records_by_code(taxonomy: dict[str, Any] | None = None) -> dict[str, dict[str, Any]]:
    return {item["code"]: item for item in _raw_tags(taxonomy)}


def format_index_content(catalog: dict[str, Any]) -> str:
    categories = catalog.get("categories") or []
    groups = catalog.get("groups") or []
    lines = [
        (
            f"Categories ({len(categories)}). Pick one by this template's audience, "
            "use case, and decision. Do not keyword-match titles or filenames."
        ),
        *[f"{item['code']}\t{item.get('en', '')}\t{item.get('zh', '')}" for item in categories],
        "",
        (
            f"Tag groups ({len(groups)}). Print every group's tags from result.data in this one "
            "snippet, because result.data does not survive into your next snippet and a second "
            "lookup costs another call. Then pick tags by visible purpose, style, color, layout, "
            "mood, and language. Do not substring-search names."
        ),
        *[
            f"{item['code']}\t{item.get('en', '')}\t{item.get('zh', '')}\t{len(item.get('tags') or [])} tags"
            for item in groups
        ],
    ]
    return "\n".join(lines)


def _raw_tags(taxonomy: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    return [
        item
        for item in _catalog(taxonomy).get("tags", [])
        if isinstance(item, dict) and isinstance(item.get("code"), str) and isinstance(item.get("group_code"), str)
    ]
