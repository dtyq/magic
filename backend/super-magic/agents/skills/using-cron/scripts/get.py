#!/usr/bin/env python3
"""
获取定时消息任务详情

参数：
    --id    定时任务 ID（必填）

输出格式：JSON
"""
import json
import argparse

import _context  # 初始化项目根路径
from app.infrastructure.sdk.magic_service.factory import create_magic_service_sdk_with_defaults
from app.infrastructure.sdk.magic_service.parameter.message_schedule_parameter import (
    GetMessageScheduleDetailParameter,
)

parser = argparse.ArgumentParser(description="获取定时消息任务详情")
parser.add_argument("--id", required=True, help="定时任务 ID")
args = parser.parse_args()

try:
    sdk = create_magic_service_sdk_with_defaults()

    parameter = GetMessageScheduleDetailParameter(schedule_id=args.id)
    result = sdk.message_schedule.get_message_schedule_detail(parameter)
    raw = result.get_raw_data()
    # 白名单：只输出对大模型有意义的字段
    whitelist = ("id", "task_name", "task_describe", "message_content", "time_config", "status", "enabled", "deadline")
    output = {k: raw[k] for k in whitelist if k in raw}
    print(json.dumps(output, ensure_ascii=False, indent=2))

except Exception as e:
    print(json.dumps({"error": str(e)}, ensure_ascii=False))
