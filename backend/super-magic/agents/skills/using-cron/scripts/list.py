#!/usr/bin/env python3
"""
查询定时消息任务列表

列表仅返回当前项目（project）下的定时任务；project_id 从当前会话读取，无需传入。

参数：
    --page          页码，默认 1
    --page-size     每页数量，默认 50
    --task-name     按任务名称模糊搜索（可选）
    --enabled       是否启用过滤：1=启用 0=禁用（可选）
    --completed     是否完成过滤：1=已完成 0=未完成（可选）

输出格式：JSON
"""
import json
import sys
import argparse

import _context  # 初始化项目根路径
from _context import get_project_id
from app.infrastructure.sdk.magic_service.factory import create_magic_service_sdk_with_defaults
from app.infrastructure.sdk.magic_service.parameter.message_schedule_parameter import (
    QueryMessageSchedulesParameter,
)

parser = argparse.ArgumentParser(description="查询定时消息任务列表")
parser.add_argument("--page", type=int, default=1, help="页码，默认 1")
parser.add_argument("--page-size", type=int, default=50, help="每页数量，默认 50")
parser.add_argument("--task-name", default=None, help="按任务名称模糊搜索")
parser.add_argument("--enabled", type=int, choices=[0, 1], default=None, help="是否启用：1=启用 0=禁用")
parser.add_argument("--completed", type=int, choices=[0, 1], default=None, help="是否完成：1=已完成 0=未完成")
args = parser.parse_args()

try:
    project_id = get_project_id()
    if not project_id:
        print(json.dumps({"error": "无法从当前会话获取 project_id"}, ensure_ascii=False))
        sys.exit(1)

    sdk = create_magic_service_sdk_with_defaults()

    parameter = QueryMessageSchedulesParameter(
        page=args.page,
        page_size=args.page_size,
        project_id=project_id,
        task_name=args.task_name,
        enabled=args.enabled,
        completed=args.completed,
    )

    result = sdk.message_schedule.query_message_schedules(parameter)
    raw = result.get_raw_data()
    # 白名单：列表项只保留对大模型有意义的字段
    item_whitelist = ("id", "task_name", "task_describe", "status", "enabled", "time_config", "deadline")
    output = {
        "total": raw.get("total", 0),
        "schedules": [
            {k: item[k] for k in item_whitelist if k in item}
            for item in raw.get("list", [])
        ],
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))

except Exception as e:
    print(json.dumps({"error": str(e)}, ensure_ascii=False))
