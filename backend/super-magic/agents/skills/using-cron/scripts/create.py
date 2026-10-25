#!/usr/bin/env python3
"""
Create a scheduled message task.

Arguments:
    --task-name     Task name, for example "Daily briefing". Required.
    --message-content   Message content, used as the task instruction. Mutually exclusive with --message-content-file.
    --message-content-file Read message content from a file. Use for long text or special characters.
    --type          Schedule type. Required:
                      no_repeat      Non-repeating; requires --day YYYY-MM-DD.
                      daily_repeat   Repeats daily.
                      weekly_repeat  Repeats weekly; requires --day 0-6, where 0 is Monday and 6 is Sunday.
                      monthly_repeat Repeats monthly; requires --day 1-31.
    --time          Execution time in HH:MM format, for example "9:00". Required.
    --day           Date, weekday, or day-of-month; meaning depends on --type.
    --deadline      End date in YYYY-MM-DD HH:MM:SS format. Date-only or partial time values are normalized. Optional.
    --specify-topic Whether to specify a topic, 0=no and 1=yes. Default: 0. Use 1 only when repeated runs depend on prior results.
    --topic-pattern Agent mode. For built-in agents, pass values such as ip-manager.
    --agent-code    Custom agent code. Required when --topic-pattern custom_agent.

topic_id and model_id are read from the current session automatically.

Output format: JSON
"""
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

import argparse

from _context import get_context
from app.infrastructure.sdk.magic_service.factory import create_magic_service_sdk_with_defaults
from app.infrastructure.sdk.magic_service.parameter.message_schedule_parameter import (
    MessageScheduleParameter,
    TimeConfig,
)

parser = argparse.ArgumentParser(description="Create a scheduled message task")
parser.add_argument("--task-name", required=True, help="Task name")
message_group = parser.add_mutually_exclusive_group(required=True)
message_group.add_argument(
    "--message-content",
    dest="message_content",
    help="Message content; maps to detail fields message_content/task_describe",
)
message_group.add_argument(
    "--message-content-file",
    dest="message_content_file",
    help="Read message content from a file; prefer this for long text or special characters",
)
parser.add_argument(
    "--type",
    required=True,
    choices=["no_repeat", "daily_repeat", "weekly_repeat", "monthly_repeat"],
    help="Schedule type",
)
parser.add_argument("--time", required=True, help="Execution time in HH:MM format")
parser.add_argument("--day", default=None, help="Date, weekday, or day-of-month; meaning depends on --type")
parser.add_argument(
    "--deadline",
    default=None,
    help="End date in YYYY-MM-DD HH:MM:SS format; date-only or partial time values are normalized",
)
parser.add_argument(
    "--specify-topic",
    type=int,
    default=0,
    choices=[0, 1],
    help="Whether to specify a topic, 0=no and 1=yes. Use 1 only when repeated runs depend on prior results",
)
parser.add_argument(
    "--topic-pattern",
    default=None,
    help="Agent mode, such as ip-manager. When omitted, the service defaults to general",
)
parser.add_argument(
    "--agent-code",
    default=None,
    help="Custom agent code; required when --topic-pattern custom_agent",
)
args = parser.parse_args()


def normalize_deadline(value: Optional[str]) -> Optional[str]:
    """
    Normalize a user-provided deadline to YYYY-MM-DD HH:MM:SS.
    Date-only values become 00:00:00; date+minute values get :00 seconds;
    full datetime values are returned as-is.
    """
    if not value or not value.strip():
        return None
    s = value.strip()
    # Already YYYY-MM-DD HH:MM:SS.
    if re.match(r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$", s):
        return s
    # YYYY-MM-DD HH:MM
    m = re.match(r"^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$", s)
    if m:
        return f"{m.group(1)} {m.group(2)}:00"
    # Date-only YYYY-MM-DD or YYYY-M-D; try full datetime before date-only.
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(s, fmt)
            if fmt == "%Y-%m-%d %H:%M:%S":
                return s
            return dt.strftime("%Y-%m-%d 00:00:00")
        except ValueError:
            continue
    # Lenient YYYY-M-D parsing.
    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", s)
    if m:
        y, mon, d = m.group(1), m.group(2).zfill(2), m.group(3).zfill(2)
        return f"{y}-{mon}-{d} 00:00:00"
    return None


def resolve_message_content(message_content: Optional[str], message_content_file: Optional[str]) -> str:
    """Resolve the final task instruction content."""
    if message_content is not None:
        return message_content
    if not message_content_file:
        raise ValueError("message content is required")
    return Path(message_content_file).read_text(encoding="utf-8").strip()


def text_to_json_content(text: str) -> dict:
    """Convert plain text to Tiptap JSONContent format for rich_text messages."""
    paragraphs = []
    for line in text.split("\n"):
        if line:
            paragraphs.append({
                "type": "paragraph",
                "content": [{"type": "text", "text": line}],
            })
        else:
            paragraphs.append({"type": "paragraph"})
    return {"type": "doc", "content": paragraphs}


def parse_message_content(raw: str):
    """
    Parse message content.

    - Use valid JSONContent dicts directly when they contain a type field.
    - Treat all other input as plain text and convert it to JSONContent.
    Return (content, message_type).
    """
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict) and parsed.get("type"):
            return parsed, "rich_text"
    except (json.JSONDecodeError, TypeError):
        pass
    return text_to_json_content(raw), "rich_text"


try:
    topic_id, model_id = get_context(
        topic_pattern=args.topic_pattern,
        agent_code=args.agent_code,
    )

    if not topic_id:
        print(json.dumps({"error": "Failed to read topic_id from the current session"}, ensure_ascii=False))
        sys.exit(1)
    if not model_id:
        print(json.dumps({"error": "Failed to read model_id from the current session"}, ensure_ascii=False))
        sys.exit(1)

    raw_content = resolve_message_content(args.message_content, args.message_content_file)
    message_content, message_type = parse_message_content(raw_content)
    sdk = create_magic_service_sdk_with_defaults()

    normalized_deadline = normalize_deadline(args.deadline)
    time_config = TimeConfig(
        schedule_type=args.type,
        time=args.time,
        day=args.day,
    )
    parameter = MessageScheduleParameter(
        task_name=args.task_name,
        message_content=message_content,
        time_config=time_config,
        topic_id=topic_id,
        model_id=model_id,
        deadline=normalized_deadline,
        specify_topic=args.specify_topic,
        topic_pattern=args.topic_pattern,
        agent_code=args.agent_code,
        message_type=message_type,
    )

    result = sdk.message_schedule.create_message_schedule(parameter)
    print(json.dumps({"id": result.get_schedule_id()}, ensure_ascii=False))

except Exception as e:
    print(json.dumps({"error": str(e)}, ensure_ascii=False))
