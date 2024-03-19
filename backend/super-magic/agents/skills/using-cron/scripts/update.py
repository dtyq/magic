#!/usr/bin/env python3
"""
更新定时消息任务（支持部分更新，只传需要修改的字段）

参数：
    --id            定时任务 ID（必填）
    --task-name     任务名称（可选）
    --message-content   消息内容（可选）
    --type          调度类型：no_repeat | daily_repeat | weekly_repeat | monthly_repeat（可选，与 --time 一起使用）
    --time          执行时间，格式 HH:MM（可选，与 --type 一起使用）
    --day           日期/星期/日号，含义随 --type 不同（可选）
    --deadline      截止日期，格式 YYYY-MM-DD HH:MM:SS；若只填日期或格式不明确将自动补全（可选）
    --enabled       启用/禁用任务：1=启用 0=禁用（可选）

输出格式：JSON
"""
import json
import re
import argparse
from datetime import datetime
from typing import Optional

import _context  # 初始化项目根路径
from app.infrastructure.sdk.magic_service.factory import create_magic_service_sdk_with_defaults
from app.infrastructure.sdk.magic_service.parameter.message_schedule_parameter import (
    UpdateMessageScheduleParameter,
    TimeConfig,
)

parser = argparse.ArgumentParser(description="更新定时消息任务")
parser.add_argument("--id", required=True, help="定时任务 ID")
parser.add_argument("--task-name", default=None, help="任务名称")
parser.add_argument("--message-content", dest="message_content", default=None, help="消息内容（与详情中的 message_content/task_describe 对应）")
parser.add_argument(
    "--type",
    default=None,
    choices=["no_repeat", "daily_repeat", "weekly_repeat", "monthly_repeat"],
    help="调度类型",
)
parser.add_argument("--time", default=None, help="执行时间，格式 HH:MM")
parser.add_argument("--day", default=None, help="日期/星期/日号，含义随 --type 不同")
parser.add_argument(
    "--deadline",
    default=None,
    help="截止日期，格式 YYYY-MM-DD HH:MM:SS；仅填日期或格式不完整时将自动补全",
)
parser.add_argument("--enabled", type=int, choices=[0, 1], default=None, help="启用/禁用：1=启用 0=禁用")
args = parser.parse_args()


def normalize_deadline(value: Optional[str]) -> Optional[str]:
    """
    将用户传入的 deadline 规范为 YYYY-MM-DD HH:MM:SS。
    仅日期 -> 补全为 00:00:00；日期+时分 -> 补全秒为 :00；已是完整格式 -> 原样返回。
    """
    if not value or not value.strip():
        return None
    s = value.strip()
    if re.match(r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$", s):
        return s
    m = re.match(r"^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$", s)
    if m:
        return f"{m.group(1)} {m.group(2)}:00"
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(s, fmt)
            if fmt == "%Y-%m-%d %H:%M:%S":
                return s
            return dt.strftime("%Y-%m-%d 00:00:00")
        except ValueError:
            continue
    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", s)
    if m:
        y, mon, d = m.group(1), m.group(2).zfill(2), m.group(3).zfill(2)
        return f"{y}-{mon}-{d} 00:00:00"
    return None


try:
    # 只有同时提供了 --type 和 --time 才构造 time_config
    time_config = None
    if args.type and args.time:
        time_config = TimeConfig(
            schedule_type=args.type,
            time=args.time,
            day=args.day,
        )

    normalized_deadline = normalize_deadline(args.deadline)

    sdk = create_magic_service_sdk_with_defaults()

    parameter = UpdateMessageScheduleParameter(
        schedule_id=args.id,
        task_name=args.task_name,
        message_content=args.message_content,
        time_config=time_config,
        deadline=normalized_deadline,
        enabled=args.enabled,
    )

    result = sdk.message_schedule.update_message_schedule(parameter)
    print(json.dumps({"id": result.get_schedule_id()}, ensure_ascii=False))

except Exception as e:
    print(json.dumps({"error": str(e)}, ensure_ascii=False))
