#!/usr/bin/env python3
"""
查询当前用户可用的所有员工（Agent）列表

参数：
    --name-filter   按名称模糊过滤（可选，不区分大小写）
    --type-filter   按类型过滤：official / custom / public（可选）

输出格式：JSON
"""
import json
import os
import sys
import argparse
from pathlib import Path

# agents/skills/_shared/ 对所有 skill 脚本均在 parents[2] 下
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import _shared.bootstrap  # noqa: F401 — 触发环境初始化

from app.infrastructure.sdk.magic_service.factory import create_magic_service_sdk_with_defaults
from app.infrastructure.sdk.magic_service.parameter.list_agents_parameter import ListAgentsParameter

parser = argparse.ArgumentParser(description="查询当前用户可用的员工列表")
parser.add_argument("--name-filter", default=None, help="按名称模糊过滤（不区分大小写）")
parser.add_argument("--type-filter", default=None, choices=["official", "custom", "public"], help="按类型过滤")
args = parser.parse_args()

try:
    sdk = create_magic_service_sdk_with_defaults()
    parameter = ListAgentsParameter()
    result = sdk.agent.list_agents(parameter)

    agents = result.get_agents()

    # 按名称过滤
    if args.name_filter:
        keyword = args.name_filter.lower()
        agents = [a for a in agents if keyword in (getattr(a, "name", None) or "").lower()]

    # 按类型过滤
    if args.type_filter:
        agents = [a for a in agents if (getattr(a, "type", None) or "") == args.type_filter]

    output = {
        "total": len(agents),
        "agents": [a.to_dict() for a in agents],
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))

except Exception as e:
    output = {"error": "failed to list agents"}
    if os.getenv("AGENT_INFO_DEBUG_ERRORS") == "1":
        output["debug_error"] = str(e)
    print(json.dumps(output, ensure_ascii=False))
    sys.exit(1)
