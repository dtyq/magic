#!/usr/bin/env python3
"""
在平台内检索技能（我的技能库 + 市场）

优先级：我的技能库 → 技能市场 → skillhub（外部）

参数：
    --keyword   搜索关键词（必填）
    --page      页码，默认 1
    --page-size 每页条数，默认 20（技能库和市场各自独立分页）

输出格式：JSON
{
  "my_skills": [
    {
      "code": "xxx",
      "name": "xxx",
      "description": "xxx"
    },
    ...
  ],
  "market": [
    {
      "code": "xxx",
      "name": "xxx",
      "description": "xxx"
    },
    ...
  ],
  "summary": "在我的技能库找到 X 个，在市场找到 Y 个"
}
"""
import argparse
import json
import sys

from _context import _setup_project_root  # noqa: F401 — 触发 sys.path 设置
from app.infrastructure.sdk.magic_service.factory import create_magic_service_sdk_with_defaults
from app.infrastructure.sdk.magic_service.parameter.query_skills_parameter import QuerySkillsParameter
from app.infrastructure.sdk.magic_service.parameter.get_latest_published_skill_versions_parameter import (
    GetLatestPublishedSkillVersionsParameter,
)

parser = argparse.ArgumentParser(description="在平台内检索技能")
parser.add_argument("--keyword", required=True, help="搜索关键词")
parser.add_argument("--page", type=int, default=1, help="页码，默认 1")
parser.add_argument("--page-size", type=int, default=20, dest="page_size", help="每页条数，默认 20")
args = parser.parse_args()

try:
    sdk = create_magic_service_sdk_with_defaults()

    # 查询我的技能库（使用 last-versions 接口，直接返回 file_url）
    my_skills_parameter = GetLatestPublishedSkillVersionsParameter(
        page=args.page,
        page_size=args.page_size,
        keyword=args.keyword,
    )
    my_skills_result = sdk.skill.query_latest_published_versions(my_skills_parameter)
    my_skills = [
        {"code": item.code, "name": item.package_name or item.name, "description": item.description}
        for item in my_skills_result.get_items()
    ]

    # 查询技能市场
    market_parameter = QuerySkillsParameter(
        page=args.page,
        page_size=args.page_size,
        keyword=args.keyword,
    )
    market_result = sdk.skill.query_skill_market(market_parameter)
    market = [
        {"code": item.code, "name": item.package_name or item.name, "description": item.description}
        for item in market_result.get_items()
    ]

    output = {
        "my_skills": my_skills,
        "market": market,
        "summary": f"在我的技能库找到 {len(my_skills)} 个，在市场找到 {len(market)} 个",
    }
    print(json.dumps(output, ensure_ascii=False))

except Exception as e:
    print(json.dumps({"error": str(e)}, ensure_ascii=False))
    sys.exit(1)
