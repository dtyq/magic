#!/usr/bin/env python3
"""
List all agents available to the current user.

Arguments:
    --name-filter   Filter by name substring, case-insensitive.
    --type-filter   Filter by type: official / custom / public.

Output format: JSON
"""
import json
import os
import sys
import argparse
from pathlib import Path

# agents/skills/_shared/ is under parents[2] for all skill scripts.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import _shared.bootstrap  # noqa: F401 — initialize runtime environment

from app.infrastructure.sdk.magic_service.factory import create_magic_service_sdk_with_defaults
from app.infrastructure.sdk.magic_service.parameter.list_agents_parameter import ListAgentsParameter

parser = argparse.ArgumentParser(description="List agents available to the current user")
parser.add_argument("--name-filter", default=None, help="Filter by name substring, case-insensitive")
parser.add_argument("--type-filter", default=None, choices=["official", "custom", "public"], help="Filter by agent type")
args = parser.parse_args()

try:
    sdk = create_magic_service_sdk_with_defaults()
    parameter = ListAgentsParameter()
    result = sdk.agent.list_agents(parameter)

    agents = result.get_agents()

    # Filter by name.
    if args.name_filter:
        keyword = args.name_filter.lower()
        agents = [a for a in agents if keyword in (getattr(a, "name", None) or "").lower()]

    # Filter by type.
    if args.type_filter:
        agents = [a for a in agents if (getattr(a, "type", None) or "") == args.type_filter]

    output = {
        "total": len(agents),
        "agents": [a.to_dict() for a in agents],
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))

except Exception as e:
    output = {"error": "failed to list agents"}
    if os.getenv("MICRO_APP_AGENT_LIST_DEBUG_ERRORS") == "1":
        output["debug_error"] = str(e)
    print(json.dumps(output, ensure_ascii=False))
    sys.exit(1)
