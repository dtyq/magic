#!/usr/bin/env python3
"""
删除定时消息任务

参数：
    --id    定时任务 ID（必填）

输出格式：JSON
"""
import json
import argparse

import _context  # 初始化项目根路径
from app.infrastructure.sdk.magic_service.factory import create_magic_service_sdk_with_defaults
from app.infrastructure.sdk.magic_service.parameter.message_schedule_parameter import (
    DeleteMessageScheduleParameter,
)

parser = argparse.ArgumentParser(description="删除定时消息任务")
parser.add_argument("--id", required=True, help="定时任务 ID")
args = parser.parse_args()

try:
    sdk = create_magic_service_sdk_with_defaults()

    parameter = DeleteMessageScheduleParameter(schedule_id=args.id)
    result = sdk.message_schedule.delete_message_schedule(parameter)
    print(json.dumps({"id": args.id}, ensure_ascii=False))

except Exception as e:
    print(json.dumps({"error": str(e)}, ensure_ascii=False))
