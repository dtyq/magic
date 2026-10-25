#!/usr/bin/env python3
"""
Initialize a minimal set of employee definition files in .magic/.

Reads a JSON config (via --config <path>) containing employee metadata
and generates the appropriate definition files.

Usage:
    python scripts/init_crew.py --config /path/to/config.json [--overwrite]

Config JSON schema:
    # All fields are written in the selected language:
    {
        "name":            "Research Assistant",        # required
        "role":            "Academic Researcher",       # required
        "description":     "A professional research assistant",  # required
        "role_body":       "You are an academic researcher...",  # optional (IDENTITY.md body)
        "personality":     "Rigorous, concise...",      # optional -> SOUL.md
        "instructions":    "Workflow...",               # required -> AGENTS.md
        "skill_decomposition_decision": "yes"            # required: "yes" or "no"
    }

Files generated:
    .magic/IDENTITY.md   — always
    .magic/AGENTS.md     — if instructions provided
    .magic/SOUL.md       — if personality provided
    (TOOLS.md / SKILLS.md are intentionally NOT created so the system uses defaults)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

REQUIRED_FIELDS = ("name", "role", "description", "instructions", "skill_decomposition_decision")
VALID_SKILL_DECOMPOSITION_DECISIONS = {"yes", "no"}


def _resolve_workspace_dir() -> Path:
    """
    Resolve the employee workspace directory.
    When running inside sandbox (/app), cwd is usually the workspace (/mnt/agfs/magicfs/project).
    If cwd has .magic or is named 'project', cwd is the employee workspace.
    If cwd/.workspace exists, prefer cwd/.workspace.
    """
    cwd = Path.cwd()
    if (cwd / ".magic").exists() or cwd.name == "project":
        return cwd
    if (cwd / ".workspace").exists():
        return cwd / ".workspace"
    return cwd


def _resolve_config_path(config_arg: str, workspace_dir: Path) -> tuple[Path | None, list[Path]]:
    config_path = Path(config_arg).expanduser()
    if config_path.is_absolute():
        candidates = [config_path]
    else:
        candidates = [
            Path.cwd() / config_path,
            workspace_dir / config_path,
            workspace_dir / ".workspace" / config_path,
        ]

    for candidate in candidates:
        if candidate.is_file():
            return candidate.resolve(), candidates
    return None, candidates


def _detect_existing_avatar(workspace_dir: Path) -> str | None:
    """Detect if an avatar already exists in workspace (.magic/logo.*)."""
    magic_dir = workspace_dir / ".magic"
    for ext in [".png", ".jpg", ".jpeg", ".webp"]:
        candidate = magic_dir / f"logo{ext}"
        if candidate.is_file():
            return f".magic/logo{ext}"
    return None


def _build_identity(cfg: dict, workspace_dir: Path | None = None) -> str:
    header_lines = [
        "---",
        f"name: {cfg['name']}",
        f"role: {cfg['role']}",
        f"description: {cfg['description']}",
    ]
    existing_avatar = _detect_existing_avatar(workspace_dir) if workspace_dir else None
    icon = cfg.get("icon") or existing_avatar or ".magic/logo.png"
    header_lines.append(f"icon: {icon}")

    header_lines.append("---")
    header = "\n".join(header_lines) + "\n"

    body = cfg.get("role_body") or ""
    if not body:
        role = cfg["role"]
        desc = cfg["description"]
        body = f"Role: {role}\n\nDescription: {desc}"

    return f"{header}\n{body}\n"


def _build_crew_instructions(cfg: dict) -> str | None:
    body = cfg.get("instructions")
    if not body:
        return None
    return f"{body}\n"


def _build_soul(cfg: dict) -> str | None:
    body = cfg.get("personality")
    if not body:
        return None
    return f"{body}\n"


def _validate_crew_instructions(content: str) -> list[str]:
    if not content.strip():
        return ["content"]

    ordered_steps = 0
    for line in content.splitlines():
        stripped = line.strip()
        if not stripped:
            continue

        separator_index = 0
        while separator_index < len(stripped) and stripped[separator_index].isdigit():
            separator_index += 1

        if separator_index == 0 or separator_index >= len(stripped):
            continue
        if stripped[separator_index] not in ".)":
            continue
        if not stripped[separator_index + 1 :].strip():
            continue
        ordered_steps += 1

    if ordered_steps < 2:
        return ["executable_steps"]

    return []


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Initialize employee definition files in .magic/",
    )
    parser.add_argument(
        "--config",
        required=True,
        help="Path to a JSON config file with employee metadata.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing IDENTITY.md if it already exists.",
    )
    args = parser.parse_args()

    workspace_dir = _resolve_workspace_dir()
    config_path, candidates = _resolve_config_path(args.config, workspace_dir)
    if config_path is None:
        checked_paths = ", ".join(str(path) for path in candidates)
        print(json.dumps({
            "ok": False,
            "error": f"Config file not found. Checked: {checked_paths}",
        }, ensure_ascii=False))
        return 1

    try:
        cfg = json.loads(config_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        print(json.dumps({"ok": False, "error": f"Failed to read config: {exc}"}, ensure_ascii=False))
        return 1

    missing = [f for f in REQUIRED_FIELDS if not cfg.get(f)]
    if missing:
        print(json.dumps({"ok": False, "error": f"Missing required fields: {missing}"}, ensure_ascii=False))
        return 1

    skill_decision = str(cfg["skill_decomposition_decision"]).strip().lower()
    if skill_decision not in VALID_SKILL_DECOMPOSITION_DECISIONS:
        print(json.dumps({
            "ok": False,
            "error": "skill_decomposition_decision must be an explicit 'yes' or 'no'.",
        }, ensure_ascii=False))
        return 1

    invalid_crew_instruction_sections = _validate_crew_instructions(str(cfg["instructions"]))
    if invalid_crew_instruction_sections:
        print(json.dumps({
            "ok": False,
            "error": "AGENTS.md instructions must contain at least two executable ordered steps.",
            "missing_sections": invalid_crew_instruction_sections,
        }, ensure_ascii=False))
        return 1

    ws_dir = workspace_dir / ".magic"

    identity_path = ws_dir / "IDENTITY.md"
    if identity_path.exists() and not args.overwrite:
        print(json.dumps({
            "ok": False,
            "error": f"IDENTITY.md already exists at {identity_path}. Use --overwrite to replace.",
        }, ensure_ascii=False))
        return 2

    ws_dir.mkdir(parents=True, exist_ok=True)
    created: list[str] = []

    identity_path.write_text(_build_identity(cfg, workspace_dir), encoding="utf-8")
    created.append("IDENTITY.md")

    crew_instructions = _build_crew_instructions(cfg)
    if crew_instructions:
        (ws_dir / "AGENTS.md").write_text(crew_instructions, encoding="utf-8")
        created.append("AGENTS.md")

    soul_content = _build_soul(cfg)
    if soul_content:
        (ws_dir / "SOUL.md").write_text(soul_content, encoding="utf-8")
        created.append("SOUL.md")

    print(json.dumps({
        "ok": True,
        "workspace": str(ws_dir),
        "mode": "single-language",
        "files_created": created,
        "message": f"Employee '{cfg['name']}' ({cfg['role']}) initialized with {len(created)} file(s) in single-language mode.",
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
