---
name: using-cron
description: Manage scheduled tasks — create, query, update, and delete. CRITICAL - When user message contains any future time intent (e.g. "in 2 days", "tomorrow at 8am", "every morning"), you MUST load this skill first. Use the Code Mode tools described by this skill.

---

# Scheduled Task Management

Use this skill to create, list, inspect, update, and delete magic-service scheduled tasks.

## How it works

Scheduled task capabilities are exposed as Code Mode tools (`scheduled_task_*`). They are not directly callable as standalone tool calls. Invoke them through `run_sdk_snippet` and `sdk.tool.call`:

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("scheduled_task_list")
print(result.content)
""")
```

`tool.call(name, params)` returns:

| Field | Meaning |
| --- | --- |
| `result.ok` | Whether the operation succeeded. Check this first. |
| `result.content` | JSON text suitable for reading and reasoning. |
| `result.data` | Structured payload for follow-up calls. |

Use the Code Mode tools below for every scheduled-task operation.

## Available Tools

| Tool name | Purpose |
| --- | --- |
| `scheduled_task_create` | Create a one-time or recurring scheduled task. |
| `scheduled_task_list` | List scheduled tasks in the current project. |
| `scheduled_task_get` | Get one scheduled task by ID. |
| `scheduled_task_update` | Partially update one scheduled task. |
| `scheduled_task_delete` | Delete one scheduled task. |

The tools automatically read `topic_id`, `project_id`, and current `model_id` from the current session. Do not pass those IDs yourself.

## Schedule Types

| `schedule_type` | Meaning | `day` |
| --- | --- | --- |
| `no_repeat` | One-time execution | Execution date `YYYY-MM-DD` (required) |
| `daily_repeat` | Repeat daily | Not needed |
| `weekly_repeat` | Repeat weekly | Weekday `0`-`6`, `0`=Monday ... `6`=Sunday (required) |
| `monthly_repeat` | Repeat monthly | Day of month `1`-`31` (required) |

`time` is always required and must be `HH:MM`.

`day` must be passed as a quoted string (e.g. `"2"`), not a bare integer. For `weekly_repeat`, `day` uses `0`=Monday, `1`=Tuesday, `2`=Wednesday, `3`=Thursday, `4`=Friday, `5`=Saturday, `6`=Sunday.

`deadline` is optional for recurring tasks. Use `YYYY-MM-DD HH:MM:SS`; `YYYY-MM-DD` is normalized to `YYYY-MM-DD 00:00:00`.

## Agent Modes

`agent_mode` is optional. Omit it by default; the scheduled task will use the current running mode.

Use `agent_mode` only when the user explicitly asks for a mode. Built-in values:

| `agent_mode` | Meaning |
| --- | --- |
| `magic` | General mode |
| `slider` | Slide generation mode |
| `data-analyst` | Data analysis mode |
| `design` | Design mode |
| `audio` | Audio summary mode |

The tool maps these friendly values to the corresponding magic-service mode identifiers internally.

If the user gives a custom employee identifier/code, pass that value as `agent_mode`. The tool maps it internally.

## Create

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("scheduled_task_create", {
    "task_name": "Daily Briefing",
    "message_content": "Generate today's briefing",
    "schedule_type": "daily_repeat",
    "time": "09:00"
})
print(result.content)
""")
```

Weekly example — pass `day` as a quoted string; `0`=Monday ... `6`=Sunday:

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("scheduled_task_create", {
    "task_name": "Weekly Report",
    "message_content": "Generate the weekly report",
    "schedule_type": "weekly_repeat",
    "day": "2",  # 2 = Wednesday (0=Monday, 1=Tuesday, 2=Wednesday, ... 6=Sunday)
    "time": "09:00"
})
print(result.content)
""")
```

For long content, pass a Python triple-quoted string. Do not write a temp script:

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

message = \"\"\"Read ops/source.json in the current article directory, visit the bound publishedUrl, and update only these operations files:
- ops/metrics.json
- ops/comments.json
- ops/review.html
Do not generate an AI Card.\"\"\"

result = tool.call("scheduled_task_create", {
    "task_name": "[Article Sync] Example Article",
    "message_content": message,
    "schedule_type": "daily_repeat",
    "time": "09:00",
    "specify_topic": 0
})
print(result.content)
""")
```

For custom employees, keep this parameter contract:

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("scheduled_task_create", {
    "task_name": "Custom Employee Task",
    "message_content": "Process this task with the custom employee",
    "schedule_type": "daily_repeat",
    "time": "09:00",
    "agent_mode": "SMA-custom-agent"
})
print(result.content)
""")
```

### `specify_topic`

Pass `specify_topic=1` only when both conditions hold:

1. The task is recurring: `daily_repeat`, `weekly_repeat`, or `monthly_repeat`.
2. The next run time or trigger depends on the current or previous run result, such as "run again 3 days after each completion" or "decide next time based on last result".

For one-time tasks, or fixed schedules that do not depend on previous results, keep `specify_topic=0`.

## List

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("scheduled_task_list", {
    "page": 1,
    "page_size": 50,
    "task_name": "briefing",
    "enabled": 1,
    "completed": 0
})
print(result.content)
""")
```

The list is scoped to the current project.

## Get

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("scheduled_task_get", {
    "id": "<scheduled_task_id>"
})
print(result.content)
""")
```

## Update

Only pass fields that should change. When changing time configuration, pass `schedule_type` and `time` together.

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("scheduled_task_update", {
    "id": "<scheduled_task_id>",
    "enabled": 0
})
print(result.content)
""")
```

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("scheduled_task_update", {
    "id": "<scheduled_task_id>",
    "message_content": "Updated task details",
    "schedule_type": "daily_repeat",
    "time": "10:00"
})
print(result.content)
""")
```

## Delete

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("scheduled_task_delete", {
    "id": "<scheduled_task_id>"
})
print(result.content)
""")
```

## Rules

1. Never create scheduler scripts or ask the shell to run cron scripts.
2. Always call `scheduled_task_list` when the user asks what scheduled tasks exist.
3. After `scheduled_task_create`, keep the returned `id`; use it for get/update/delete.
4. Check `result.ok` before relying on `result.content` or `result.data`.
5. Surface tool errors directly; do not silently retry with guessed workspace, topic, or project IDs.
