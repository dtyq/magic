#!/usr/bin/env python3
"""Rebuild the bundled slide template taxonomy snapshot.

Agents must pick category and tag codes through query_slide_template_taxonomy
by matching the actual template. Do not use this script to search or guess codes.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


DEFAULT_TAXONOMY = Path(__file__).resolve().parent.parent / "references" / "template-taxonomy.json"


def _read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _sync(categories_path: Path, tags_path: Path, output_path: Path) -> None:
    categories = _read_json(categories_path)
    tags_source = _read_json(tags_path)
    if not isinstance(categories, list) or not isinstance(tags_source, dict):
        raise ValueError("Unexpected taxonomy source format.")
    groups = tags_source.get("groups")
    tags = tags_source.get("tags")
    if not isinstance(groups, list) or not isinstance(tags, list):
        raise ValueError("Tag source must contain groups and tags arrays.")

    category_codes = [item.get("code") for item in categories]
    group_codes = [item.get("code") for item in groups]
    tag_codes = [item.get("code") for item in tags]
    for label, codes in (
        ("category", category_codes),
        ("group", group_codes),
        ("tag", tag_codes),
    ):
        if any(not isinstance(code, str) or not code for code in codes):
            raise ValueError(f"Every {label} must have a non-empty code.")
        if len(codes) != len(set(codes)):
            raise ValueError(f"Duplicate {label} code found.")
    unknown_groups = sorted({item.get("group_code") for item in tags} - set(group_codes))
    if unknown_groups:
        raise ValueError(f"Tags reference unknown groups: {', '.join(unknown_groups)}")

    payload = {
        "schema_version": "1.0",
        "source": {
            "categories_file": categories_path.name,
            "categories_sha256": _sha256(categories_path),
            "tags_file": tags_path.name,
            "tags_sha256": _sha256(tags_path),
        },
        "categories": sorted(categories, key=lambda item: (-int(item.get("sort", 0)), item["code"])),
        "groups": sorted(groups, key=lambda item: (-int(item.get("sort", 0)), item["code"])),
        "tags": sorted(
            tags,
            key=lambda item: (
                group_codes.index(item["group_code"]),
                -int(item.get("sort", 0)),
                item["code"],
            ),
        ),
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {len(categories)} categories, {len(groups)} groups, and {len(tags)} tags to {output_path}"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--taxonomy", type=Path, default=DEFAULT_TAXONOMY)
    subparsers = parser.add_subparsers(dest="command", required=True)
    sync_parser = subparsers.add_parser("sync", help="Build the bundled taxonomy snapshot from source JSON files.")
    sync_parser.add_argument("--categories", type=Path, required=True)
    sync_parser.add_argument("--tags", type=Path, required=True)
    sync_parser.add_argument("--output", type=Path, default=DEFAULT_TAXONOMY)
    args = parser.parse_args()
    if args.command == "sync":
        _sync(args.categories, args.tags, args.output)


if __name__ == "__main__":
    main()
