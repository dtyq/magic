#!/usr/bin/env python3
"""
Copy a built-in skill from agents/skills/<name>/ into the employee workspace copy
at .workspace/skills/<dest>/ so it can be edited without touching the repo tree.

Usage:
    python scripts/copy_skill_to_workspace.py <skill-name> [--dest-name NAME] [--overwrite]

Examples:
    python scripts/copy_skill_to_workspace.py find-skill
    python scripts/copy_skill_to_workspace.py skill-creator --dest-name my-skill-creator --overwrite

Requires running from the project environment (same as package_skill.py); cwd should be
agents/skills/skill-creator when invoked via shell_exec.
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

import _skill_scripts_bootstrap  # noqa: F401


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Copy agents/skills/<name> into .workspace/skills/ for crew editing.",
    )
    parser.add_argument(
        "skill_name",
        help="Directory name under agents/skills/ (kebab-case folder name).",
    )
    parser.add_argument(
        "--dest-name",
        default=None,
        help="Destination folder name under .workspace/skills/ (default: same as skill_name).",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="If destination exists, remove it first then copy (full replace).",
    )
    args = parser.parse_args()

    from app.paths import PathManager

    PathManager._ensure_app_initialization()

    src = PathManager.get_agents_dir() / "skills" / args.skill_name
    skill_md = src / "SKILL.md"
    if not skill_md.is_file():
        print(f"error: missing SKILL.md under built-in path: {skill_md}", file=sys.stderr)
        return 2

    dest_name = args.dest_name or args.skill_name
    ws_skills_root = PathManager.get_workspace_dir() / "skills"
    dest = ws_skills_root / dest_name

    if dest.exists():
        if not args.overwrite:
            print(
                f"error: destination already exists: {dest}. "
                f"Use --overwrite to replace, or choose --dest-name.",
                file=sys.stderr,
            )
            return 3
        shutil.rmtree(dest)

    ws_skills_root.mkdir(parents=True, exist_ok=True)
    shutil.copytree(src, dest)
    print(f"ok: copied {src} -> {dest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
