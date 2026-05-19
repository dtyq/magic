#!/usr/bin/env python3
"""
Initialize a minimal set of employee definition files in .workspace/.magic/.

Reads a JSON config (via --config <path>) containing employee metadata
and generates the appropriate definition files.

Usage:
    python scripts/init_crew.py --config /path/to/config.json [--overwrite]

Config JSON schema:
    # Single-language mode (default) — fields in user's preferred language:
    {
        "name":            "研究助手",                  # required
        "role":            "学术研究员",                 # required
        "description":     "专业的学术研究助手",          # required
        "role_body":       "你是一名学术研究员...",      # optional (IDENTITY.md body)
        "personality":     "严谨、简洁...",              # optional → SOUL.md
        "personality_en":  "Rigorous, concise...",      # optional English translation
        "instructions":    "工作流程...",                # optional → AGENTS.md
        "instructions_en": "Workflow...",               # optional English translation
    }

    # Multilingual mode — add _cn or _en suffixed fields for translations:
    #   _cn → Chinese translation (goes in <!--zh --> comments)
    #   _en → English translation (goes in <!--en --> comments)
    # Base fields = primary language (active content).
    {
        "name":            "研究助手",
        "name_en":         "Research Assistant",
        "role":            "学术研究员",
        "role_en":         "Academic Researcher",
        "description":     "专业的学术研究助手",
        "description_en":  "A professional research assistant",
        "role_body":       "你是一名学术研究员...",
        "role_body_en":    "You are an academic researcher...",
        "personality":     "严谨、简洁...",
        "personality_en":  "Rigorous, concise...",
        "instructions":    "工作流程...",
        "instructions_en": "Workflow..."
    }

Files generated:
    .workspace/.magic/IDENTITY.md   — always
    .workspace/.magic/AGENTS.md     — if instructions provided
    .workspace/.magic/SOUL.md       — if personality provided
    (TOOLS.md / SKILLS.md are intentionally NOT created so the system uses defaults)
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# agents/skills/_shared/ 对所有 skill 脚本均在 parents[2] 下
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from _shared.bootstrap import get_project_root


REQUIRED_FIELDS = ("name", "role", "description")

# Mapping from suffix to HTML comment tag name
SUFFIX_TAG: dict[str, str] = {
    "_cn": "zh",
    "_en": "en",
}


def _contains_chinese(text: str) -> bool:
    """Rough detection: does the text contain CJK characters?"""
    return any('一' <= c <= '鿿' for c in str(text))


def _has_translations(cfg: dict) -> bool:
    """Check if the config has any translation (suffixed) fields."""
    return any(k.endswith(tuple(SUFFIX_TAG)) for k in cfg)


def _wrap_body(body: str, cfg: dict, field: str) -> str:
    """
    Format body text. In multilingual mode, wraps translations in <!--xx --> blocks
    with the primary (unsuffixed) content as the active text.
    `field` is the base field name (e.g. "role_body", "instructions", "personality").
    """
    if not _has_translations(cfg):
        return f"{body}\n"

    parts: list[str] = []
    for suffix, tag in SUFFIX_TAG.items():
        translation = cfg.get(f"{field}{suffix}")
        if translation:
            parts.append(f"<!--{tag}\n{translation}\n-->")

    parts.append(body)
    return "\n".join(parts) + "\n"


def _build_identity(cfg: dict) -> str:
    header_lines = [
        "---",
        f"name: {cfg['name']}",
        f"role: {cfg['role']}",
        f"description: {cfg['description']}",
    ]

    # Add suffixed header fields for multilingual mode
    for suffix in SUFFIX_TAG:
        for field in ("name", "role", "description"):
            value = cfg.get(f"{field}{suffix}")
            if value:
                header_lines.append(f"{field}{suffix}: {value}")

    header_lines.append("---")
    header = "\n".join(header_lines) + "\n"

    # Build body with language-aware default
    body = cfg.get("role_body") or ""
    if not body:
        role = cfg["role"]
        desc = cfg["description"]
        if _contains_chinese(cfg["name"]):
            body = f"你是{role}，{desc}。"
        else:
            article = "an" if role[0:1].lower() in "aeiou" else "a"
            body = f"You are {article} {role}. {desc}."

    return f"{header}\n{_wrap_body(body, cfg, 'role_body')}"


def _build_agents(cfg: dict) -> str | None:
    body = cfg.get("instructions")
    if not body:
        return None
    return _wrap_body(body, cfg, "instructions")


def _build_soul(cfg: dict) -> str | None:
    body = cfg.get("personality")
    if not body:
        return None
    return _wrap_body(body, cfg, "personality")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Initialize employee definition files in .workspace/.magic/",
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

    project_root = get_project_root()
    ws_dir = project_root / ".workspace" / ".magic"

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

    multilingual = _has_translations(cfg)
    mode = "multilingual" if multilingual else "single-language"
    print(json.dumps({
        "ok": True,
        "workspace": str(ws_dir),
        "mode": mode,
        "files_created": created,
        "message": f"Employee '{cfg['name']}' ({cfg['role']}) initialized with {len(created)} file(s) in {mode} mode.",
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
