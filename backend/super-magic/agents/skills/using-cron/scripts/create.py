#!/usr/bin/env python3
"""
创建定时消息任务

参数：
    --task-name     任务名称，如 "每日早报"（必填）
    --message-content   消息内容（任务指令）（必填）
    --type          调度类型（必填）：
                      no_repeat      不重复，需要 --day YYYY-MM-DD
                      daily_repeat   每天重复
                      weekly_repeat  每周重复，需要 --day 0-6（0=周日）
                      monthly_repeat 每月重复，需要 --day 1-31
    --time          执行时间，格式 HH:MM，如 "9:00"（必填）
    --day           日期/星期/日号，含义随 --type 不同（见上）
    --deadline      截止日期，格式 YYYY-MM-DD HH:MM:SS；若只填日期或格式不明确将自动补全（如当日 23:59:59）（可选，重复任务到期后停止）
    --specify-topic 是否指定话题，0=否 1=是，默认 0；仅当意图为「周期性且后续执行依赖前次结果」时由调用方传 1

topic_id 和 model_id 自动从当前会话读取，无需传入。

输出格式：JSON
"""
import json
import re
import sys
from datetime import datetime
from typing import Optional

import argparse

from _context import get_context
from app.infrastructure.sdk.magic_service.factory import create_magic_service_sdk_with_defaults
from app.infrastructure.sdk.magic_service.parameter.message_schedule_parameter import (
    MessageScheduleParameter,
    TimeConfig,
)

parser = argparse.ArgumentParser(description="创建定时消息任务")
parser.add_argument("--task-name", required=True, help="任务名称")
parser.add_argument("--message-content", dest="message_content", required=True, help="消息内容（任务指令），与详情 message_content/task_describe 对应")
parser.add_argument(
    "--type",
    required=True,
    choices=["no_repeat", "daily_repeat", "weekly_repeat", "monthly_repeat"],
    help="调度类型",
)
parser.add_argument("--time", required=True, help="执行时间，格式 HH:MM")
parser.add_argument("--day", default=None, help="日期/星期/日号，含义随 --type 不同")
parser.add_argument(
    "--deadline",
    default=None,
    help="截止日期，格式 YYYY-MM-DD HH:MM:SS；仅填日期或格式不完整时会自动理解并补全（重复任务可选）",
)
parser.add_argument(
    "--specify-topic",
    type=int,
    default=0,
    choices=[0, 1],
    help="是否指定话题，0=否 1=是，默认 0；仅当周期性且后续执行依赖前次结果时传 1",
)
args = parser.parse_args()


def normalize_deadline(value: Optional[str]) -> Optional[str]:
    """
    将用户传入的 deadline 规范为 YYYY-MM-DD HH:MM:SS。
    仅日期 -> 补全为 00:00:00；日期+时分 -> 补全秒为 :00；已是完整格式 -> 原样返回。
    """
    if not value or not value.strip():
        return None
    s = value.strip()
    # 已是 YYYY-MM-DD HH:MM:SS
    if re.match(r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$", s):
        return s
    # YYYY-MM-DD HH:MM
    m = re.match(r"^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$", s)
    if m:
        return f"{m.group(1)} {m.group(2)}:00"
    # 仅日期 YYYY-MM-DD 或 YYYY-M-D（先试完整格式再试仅日期）
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(s, fmt)
            if fmt == "%Y-%m-%d %H:%M:%S":
                return s
            return dt.strftime("%Y-%m-%d 00:00:00")
        except ValueError:
            continue
    # 宽松解析 YYYY-M-D
    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", s)
    if m:
        y, mon, d = m.group(1), m.group(2).zfill(2), m.group(3).zfill(2)
        return f"{y}-{mon}-{d} 00:00:00"
    return None


try:
    topic_id, model_id = get_context()

    if not topic_id:
        print(json.dumps({"error": "无法从当前会话获取 topic_id"}, ensure_ascii=False))
        sys.exit(1)
    if not model_id:
        print(json.dumps({"error": "无法从当前会话获取 model_id"}, ensure_ascii=False))
        sys.exit(1)

    sdk = create_magic_service_sdk_with_defaults()

    normalized_deadline = normalize_deadline(args.deadline)
    time_config = TimeConfig(
        schedule_type=args.type,
        time=args.time,
        day=args.day,
    )
    parameter = MessageScheduleParameter(
        task_name=args.task_name,
        message_content=args.message_content,
        time_config=time_config,
        topic_id=topic_id,
        model_id=model_id,
        deadline=normalized_deadline,
        specify_topic=args.specify_topic,
    )

    result = sdk.message_schedule.create_message_schedule(parameter)
    print(json.dumps({"id": result.get_schedule_id()}, ensure_ascii=False))

except Exception as e:
    print(json.dumps({"error": str(e)}, ensure_ascii=False))
