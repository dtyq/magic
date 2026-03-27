#!/usr/bin/env python3
"""
Initialize a minimal set of employee definition files in .workspace/.

Reads a JSON config (via --config <path>) containing employee metadata
and generates the appropriate definition files.

Usage:
    python scripts/init_crew.py --config /path/to/config.json [--overwrite]

Config JSON schema:
    {
        "name":            "Research Assistant",       # required
        "name_cn":         "研究助手",                  # required
        "role":            "Academic Researcher",      # required
        "role_cn":         "学术研究员",                 # required
        "description":     "...",                      # required
        "description_cn":  "...",                      # required
        "role_body":       "English role definition",  # optional
        "role_body_cn":    "中文角色定义",               # optional
        "personality":     "English personality",      # optional → SOUL.md
        "personality_cn":  "中文性格定义",               # optional → SOUL.md
        "instructions":    "English workflow",         # optional → AGENTS.md
        "instructions_cn": "中文工作流指令",             # optional → AGENTS.md
    }

Files generated:
    .workspace/IDENTITY.md   — always
    .workspace/AGENTS.md     — if instructions provided
    .workspace/SOUL.md       — if personality provided
    (TOOLS.md / SKILLS.md are intentionally NOT created so the system uses defaults)
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def _setup_project_root() -> Path:
    """Walk up to find the project root and add it to sys.path."""
    current = Path(__file__).resolve().parent
    markers = {"setup.py", "script_runner"}
    for _ in range(10):
        if any((current / marker).exists() for marker in markers):
            root = str(current)
            if root not in sys.path:
                sys.path.insert(0, root)
            return current
        current = current.parent
    raise RuntimeError("Cannot locate project root (setup.py / script_runner not found)")


REQUIRED_FIELDS = ("name", "name_cn", "role", "role_cn", "description", "description_cn")


def _build_identity(cfg: dict) -> str:
    header = (
        f"---\n"
        f"name: {cfg['name']}\n"
        f"name_cn: {cfg['name_cn']}\n"
        f"role: {cfg['role']}\n"
        f"role_cn: {cfg['role_cn']}\n"
        f"description: {cfg['description']}\n"
        f"description_cn: {cfg['description_cn']}\n"
        f"---\n"
    )

    body_cn = cfg.get("role_body_cn") or f"你是一名{cfg['role_cn']}，{cfg['description_cn']}。"
    article = "an" if cfg["role"][0:1].lower() in "aeiou" else "a"
    body_en = cfg.get("role_body") or f"You are {article} {cfg['role']}. {cfg['description']}."

    return f"{header}\n<!--zh\n{body_cn}\n-->\n{body_en}\n"


def _build_agents(cfg: dict) -> str | None:
    cn = cfg.get("instructions_cn")
    en = cfg.get("instructions")
    if not cn and not en:
        return None
    cn = cn or "（待补充工作流指令）"
    en = en or "(Workflow instructions to be added)"
    return f"<!--zh\n{cn}\n-->\n{en}\n"


def _build_soul(cfg: dict) -> str | None:
    cn = cfg.get("personality_cn")
    en = cfg.get("personality")
    if not cn and not en:
        return None
    cn = cn or "（待补充性格定义）"
    en = en or "(Personality to be defined)"
    return f"<!--zh\n{cn}\n-->\n{en}\n"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Initialize employee definition files in .workspace/",
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

    config_path = Path(args.config)
    if not config_path.is_absolute():
        config_path = Path.cwd() / config_path
    if not config_path.is_file():
        print(json.dumps({"ok": False, "error": f"Config file not found: {config_path}"}, ensure_ascii=False))
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

    project_root = _setup_project_root()
    ws_dir = project_root / ".workspace"

    identity_path = ws_dir / "IDENTITY.md"
    if identity_path.exists() and not args.overwrite:
        print(json.dumps({
            "ok": False,
            "error": f"IDENTITY.md already exists at {identity_path}. Use --overwrite to replace.",
        }, ensure_ascii=False))
        return 2

    ws_dir.mkdir(parents=True, exist_ok=True)
    created: list[str] = []

    identity_path.write_text(_build_identity(cfg), encoding="utf-8")
    created.append("IDENTITY.md")

    agents_content = _build_agents(cfg)
    if agents_content:
        (ws_dir / "AGENTS.md").write_text(agents_content, encoding="utf-8")
        created.append("AGENTS.md")

    soul_content = _build_soul(cfg)
    if soul_content:
        (ws_dir / "SOUL.md").write_text(soul_content, encoding="utf-8")
        created.append("SOUL.md")

    print(json.dumps({
        "ok": True,
        "workspace": str(ws_dir),
        "files_created": created,
        "message": f"Employee '{cfg['name_cn']}' ({cfg['name']}) initialized with {len(created)} file(s).",
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
