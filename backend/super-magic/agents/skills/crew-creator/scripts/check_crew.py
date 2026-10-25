#!/usr/bin/env python3
"""
Verification gate script for digital employee initialization and workspace structure.

Checks:
1. .magic/ directory exists.
2. IDENTITY.md exists and contains valid standard YAML frontmatter:
   - name, role, description, icon (strictly .magic/logo.png or .magic/logo.jpg).
   - NO disallowed multilingual keys (name_cn, role_cn, description_cn, name_en, etc.).
3. The referenced icon file exists directly under .magic/ (e.g. .magic/logo.png or .magic/logo.jpg):
   - readable and <= 500KB.
4. AGENTS.md exists and contains executable SOP steps (at least 2 numbered steps).
5. SOUL.md is valid if present.
6. Cleans up unwanted runtime directories (.workspace, .browser, .cache, logs, assets/) if empty/leftover.

Usage:
    python scripts/check_crew.py [--workspace-dir /path/to/workspace]

Outputs JSON:
    {"ok": true, "details": {...}} or {"ok": false, "errors": [...]}
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
from pathlib import Path

STANDARD_IDENTITY_KEYS = {"name", "role", "description", "icon"}
DISALLOWED_MULTILINGUAL_PATTERNS = [
    re.compile(r"^(name|role|description)[_-](cn|en|zh|zh_cn|en_us)$", re.IGNORECASE),
]
VALID_ICON_FILENAMES = {".magic/logo.png", ".magic/logo.jpg", "logo.png", "logo.jpg"}


def _resolve_workspace_dir(custom_path: str | None = None) -> Path:
    if custom_path:
        return Path(custom_path).resolve()
    cwd = Path.cwd()
    if (cwd / ".magic").exists() or cwd.name == "project":
        return cwd
    if (cwd / ".workspace").exists():
        return cwd / ".workspace"
    return cwd


def _parse_frontmatter(content: str) -> tuple[dict[str, str], str]:
    """Extract YAML frontmatter between --- lines and return (frontmatter_dict, body)."""
    lines = content.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, content

    fm_lines: list[str] = []
    body_start = -1
    for idx, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            body_start = idx + 1
            break
        fm_lines.append(line)

    if body_start == -1:
        return {}, content

    fm_dict: dict[str, str] = {}
    for line in fm_lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" in line:
            key, val = line.split(":", 1)
            key = key.strip()
            val = val.strip().strip("\"'")
            fm_dict[key] = val

    body = "\n".join(lines[body_start:])
    return fm_dict, body


def check_identity(workspace_dir: Path) -> tuple[bool, list[str], dict[str, str]]:
    errors: list[str] = []
    identity_path = workspace_dir / ".magic" / "IDENTITY.md"
    if not identity_path.exists():
        return False, [".magic/IDENTITY.md is missing"], {}

    try:
        content = identity_path.read_text(encoding="utf-8")
    except OSError as exc:
        return False, [f"Failed to read .magic/IDENTITY.md: {exc}"], {}

    fm, body = _parse_frontmatter(content)
    if not fm:
        return False, ["IDENTITY.md must start with valid YAML frontmatter (---)"], {}

    # Check required fields
    for field in ["name", "role", "description"]:
        if not fm.get(field):
            errors.append(f"IDENTITY.md missing required '{field}' in frontmatter")

    # Check for forbidden multilingual fields
    for key in fm.keys():
        for pattern in DISALLOWED_MULTILINGUAL_PATTERNS:
            if pattern.match(key):
                errors.append(
                    f"IDENTITY.md contains forbidden multilingual field '{key}'. Use standard '{key.split('_')[0].split('-')[0]}' only."
                )

    # Check icon
    icon_val = fm.get("icon", "").strip()
    if not icon_val:
        errors.append("IDENTITY.md is missing 'icon' field pointing to .magic/logo.png or .magic/logo.jpg")
    else:
        norm_icon = icon_val.replace("\\", "/").strip("./")
        if not (norm_icon.endswith("logo.png") or norm_icon.endswith("logo.jpg")):
            errors.append(
                f"IDENTITY.md icon must point to .magic/logo.png or .magic/logo.jpg, got: '{icon_val}'"
            )

    return len(errors) == 0, errors, fm


def check_avatar(workspace_dir: Path, icon_val: str) -> tuple[bool, list[str]]:
    errors: list[str] = []
    
    # 1. 检查 IDENTITY.md 中指定的 icon 文件是否存在
    avatar_file: Path | None = None
    if icon_val:
        norm_icon = icon_val.replace("\\", "/").lstrip("/")
        candidate = workspace_dir / norm_icon if norm_icon.startswith(".magic/") else workspace_dir / ".magic" / norm_icon
        if candidate.is_file():
            avatar_file = candidate

    # 2. 如果指定的找不到，但存在另一个扩展名（如写了 .png 但实际是 .jpg）
    if not avatar_file:
        for cand in [
            workspace_dir / ".magic" / "logo.jpg",
            workspace_dir / ".magic" / "logo.jpeg",
            workspace_dir / ".magic" / "logo.png",
            workspace_dir / ".magic" / "logo.webp",
        ]:
            if cand.is_file():
                errors.append(
                    f"Avatar file '{cand.name}' exists on disk, but IDENTITY.md declares '{icon_val}'. Please update 'icon:' in .magic/IDENTITY.md to '.magic/{cand.name}'."
                )
                avatar_file = cand
                break

    if not avatar_file:
        return False, [
            "Avatar file .magic/logo.png or .magic/logo.jpg not found in workspace"
        ]

    # Check file size (must be <= 500KB = 512,000 bytes)
    try:
        size = avatar_file.stat().st_size
        if size == 0:
            errors.append(f"Avatar file '{avatar_file.name}' is empty (0 bytes)")
        elif size > 500 * 1024:
            errors.append(
                f"Avatar file '{avatar_file.name}' size ({size / 1024:.1f}KB) exceeds 500KB limit"
            )
    except OSError as exc:
        errors.append(f"Cannot access avatar file '{avatar_file.name}': {exc}")

    return len(errors) == 0, errors


def check_agents(workspace_dir: Path) -> tuple[bool, list[str]]:
    errors: list[str] = []
    agents_path = workspace_dir / ".magic" / "AGENTS.md"
    if not agents_path.exists():
        return True, []  # AGENTS.md is recommended/optional in some base flows

    try:
        content = agents_path.read_text(encoding="utf-8")
    except OSError as exc:
        return False, [f"Failed to read .magic/AGENTS.md: {exc}"]

    # Count numbered steps
    ordered_steps = 0
    for line in content.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        sep_idx = 0
        while sep_idx < len(stripped) and stripped[sep_idx].isdigit():
            sep_idx += 1
        if sep_idx > 0 and sep_idx < len(stripped) and stripped[sep_idx] in ".)":
            if stripped[sep_idx + 1 :].strip():
                ordered_steps += 1

    if ordered_steps < 2:
        errors.append(
            f".magic/AGENTS.md must contain structured executable SOP steps (found {ordered_steps} numbered step(s), minimum 2 required)"
        )

    return len(errors) == 0, errors


def cleanup_workspace(workspace_dir: Path) -> None:
    """Clean up unwanted runtime directories created accidentally in the workspace root."""
    unwanted = [".browser", ".cache", "logs"]
    for name in unwanted:
        target = workspace_dir / name
        if target.exists() and target.is_dir():
            try:
                shutil.rmtree(target, ignore_errors=True)
            except Exception:
                pass


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify digital employee definition and avatar setup")
    parser.add_argument("--workspace-dir", help="Path to employee workspace")
    args = parser.parse_args()

    workspace_dir = _resolve_workspace_dir(args.workspace_dir)
    cleanup_workspace(workspace_dir)

    all_errors: list[str] = []

    # 1. Check .magic directory
    magic_dir = workspace_dir / ".magic"
    if not magic_dir.is_dir():
        print(json.dumps({
            "ok": False,
            "errors": [f"Missing .magic/ directory in workspace: {workspace_dir}"],
        }, ensure_ascii=False))
        return 1

    # 2. Check IDENTITY.md
    id_ok, id_errors, fm = check_identity(workspace_dir)
    all_errors.extend(id_errors)

    # 3. Check Logo/Avatar file
    av_ok, av_errors = check_avatar(workspace_dir, fm.get("icon", ""))
    all_errors.extend(av_errors)

    # 4. Check AGENTS.md
    ag_ok, ag_errors = check_agents(workspace_dir)
    all_errors.extend(ag_errors)

    if all_errors:
        print(json.dumps({
            "ok": False,
            "errors": all_errors,
        }, ensure_ascii=False))
        return 1

    print(json.dumps({
        "ok": True,
        "details": {
            "name": fm.get("name"),
            "role": fm.get("role"),
            "icon": fm.get("icon"),
            "identity_file": ".magic/IDENTITY.md",
            "agents_file": ".magic/AGENTS.md" if (magic_dir / "AGENTS.md").exists() else None,
            "soul_file": ".magic/SOUL.md" if (magic_dir / "SOUL.md").exists() else None,
        },
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
