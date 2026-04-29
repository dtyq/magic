#!/usr/bin/env python3
"""
Copy a built-in skill from agents/skills/<name>/ into the employee workspace
at .workspace/.magic/skills/<dest>/ so it can be edited without touching the repo tree.

Usage:
    python scripts/copy_skill_to_workspace.py <skill-name> [--dest-name NAME] [--overwrite]

Examples:
    python scripts/copy_skill_to_workspace.py find-skill
    python scripts/copy_skill_to_workspace.py skill-creator --dest-name my-skill-creator --overwrite
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

# agents/skills/_shared/ 对所有 skill 脚本均在 parents[2] 下
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from _shared.bootstrap import get_project_root


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Copy agents/skills/<name> into .workspace/.magic/skills/ for crew editing.",
    )
    parser.add_argument(
        "skill_name",
        help="Directory name under agents/skills/ (kebab-case folder name).",
    )
    parser.add_argument(
        "--dest-name",
        default=None,
        help="Destination folder name under .workspace/.magic/skills/ (default: same as skill_name).",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="If destination exists, remove it first then copy (full replace).",
    )
    args = parser.parse_args()

    project_root = get_project_root()

    agents_dir = project_root / "agents"
    src = agents_dir / "skills" / args.skill_name
    skill_md = src / "SKILL.md"
    if not skill_md.is_file():
        print(json.dumps({"ok": False, "error": f"Missing SKILL.md under built-in path: {skill_md}"}, ensure_ascii=False))
        return 2

    dest_name = args.dest_name or args.skill_name
    ws_skills_root = project_root / ".workspace" / ".magic" / "skills"
    dest = ws_skills_root / dest_name

    if dest.exists():
        if not args.overwrite:
            print(json.dumps({
                "ok": False,
                "error": f"Destination already exists: {dest}. Use --overwrite to replace, or choose --dest-name.",
            }, ensure_ascii=False))
            return 3
        shutil.rmtree(dest)

    ws_skills_root.mkdir(parents=True, exist_ok=True)
    shutil.copytree(src, dest)
    print(json.dumps({
        "ok": True,
        "source": str(src),
        "destination": str(dest),
        "message": f"Copied {args.skill_name} -> {dest}",
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
