#!/usr/bin/env python3
"""
Scan available tools from tool_definitions.json.

Usage:
  python scripts/tools.py list              # list all tools (name + one-line description)
  python scripts/tools.py detail <name>     # show full details of a specific tool
  python scripts/tools.py search <keyword>  # search tools by keyword
"""
import sys
import json
from pathlib import Path

# agents/skills/_shared/ 对所有 skill 脚本均在 parents[2] 下
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from _shared.bootstrap import get_project_root


def _load_definitions() -> dict:
    root = get_project_root()
    definitions_path = root / "config" / "tool_definitions.json"
    if not definitions_path.exists():
        print(json.dumps({"ok": False, "error": f"tool_definitions.json not found at {definitions_path}"}, ensure_ascii=False))
        sys.exit(1)
    with open(definitions_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _first_line(desc: str) -> str:
    """Extract the first meaningful line from a description."""
    for line in desc.strip().split("\n"):
        stripped = line.strip()
        if stripped:
            return stripped[:120]
    return ""


def cmd_list() -> None:
    data = _load_definitions()
    tools = data.get("tools", {})
    result = []
    for name in sorted(tools.keys()):
        tool = tools[name]
        result.append({
            "name": name,
            "description": _first_line(tool.get("description", "")),
        })
    print(json.dumps({"ok": True, "tool_count": len(result), "tools": result}, ensure_ascii=False, indent=2))


def cmd_detail(tool_name: str) -> None:
    data = _load_definitions()
    tools = data.get("tools", {})
    tool = tools.get(tool_name)
    if not tool:
        print(json.dumps({"ok": False, "error": f"Tool '{tool_name}' not found"}, ensure_ascii=False))
        sys.exit(1)

    schema = tool.get("parameters_schema", {})
    params = []
    properties = schema.get("properties", {})
    required_fields = set(schema.get("required", []))
    for pname, pinfo in properties.items():
        params.append({
            "name": pname,
            "type": pinfo.get("type", "unknown"),
            "required": pname in required_fields,
            "description": _first_line(pinfo.get("description", "")),
        })

    print(json.dumps({
        "ok": True,
        "tool": {
            "name": tool["name"],
            "description": tool.get("description", ""),
            "parameters": params,
        }
    }, ensure_ascii=False, indent=2))


def cmd_search(keyword: str) -> None:
    data = _load_definitions()
    tools = data.get("tools", {})
    keyword_lower = keyword.lower()
    result = []
    for name in sorted(tools.keys()):
        tool = tools[name]
        desc = tool.get("description", "")
        if keyword_lower in name.lower() or keyword_lower in desc.lower():
            result.append({
                "name": name,
                "description": _first_line(desc),
            })
    print(json.dumps({"ok": True, "keyword": keyword, "match_count": len(result), "tools": result}, ensure_ascii=False, indent=2))


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "Usage: tools.py list | detail <name> | search <keyword>"}, ensure_ascii=False))
        sys.exit(1)

    command = sys.argv[1]

    if command == "list":
        cmd_list()
    elif command == "detail":
        if len(sys.argv) != 3:
            print(json.dumps({"ok": False, "error": "Usage: tools.py detail <tool_name>"}, ensure_ascii=False))
            sys.exit(1)
        cmd_detail(sys.argv[2].strip())
    elif command == "search":
        if len(sys.argv) != 3:
            print(json.dumps({"ok": False, "error": "Usage: tools.py search <keyword>"}, ensure_ascii=False))
            sys.exit(1)
        cmd_search(sys.argv[2].strip())
    else:
        print(json.dumps({"ok": False, "error": f"Unknown command: {command}"}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
