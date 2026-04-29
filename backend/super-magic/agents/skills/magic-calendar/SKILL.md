---
name: magic-calendar
description: Create and manage calendar projects for scheduling, content planning, and event management. Use when user wants to create a calendar, schedule events, or build a content/publishing calendar.

name-cn: 日历日程管理
description-cn: 创建和管理日历项目，用于日程安排、内容规划和活动管理。当用户想创建日历、安排日程、制作内容/发布日历时使用。
---

# Magic Calendar

Create and manage interactive calendar projects. Each calendar project is a folder containing `index.html` (visualization), `magic.project.js` (metadata and categories), and `events/` (monthly event files). All data operations go through tools — do not manually read or edit these files.

## Workflow

```
1. Create project folder (shell_exec: mkdir)
2. setup_calendar_project  → initialize calendar
3. manage_calendar         → add categories (optional)
4. manage_calendar         → add events (batch or one-by-one)
```

### Decision Tree

```
User request
├── Create new calendar       → setup_calendar_project
├── Add event/schedule/plan   → manage_calendar (add_event)
├── View/query events         → manage_calendar (list_events)
├── Modify existing event     → manage_calendar (update_event)
├── Delete/cancel event       → manage_calendar (delete_event)
├── Add event category        → manage_calendar (add_category)
└── View categories           → manage_calendar (list_categories)
```

---

## Tool: setup_calendar_project

Initialize a calendar project in an **existing** folder. You must create the folder first via `shell_exec`.

### Parameters

| Param | Required | Type | Description |
|-------|----------|------|-------------|
| `project_path` | yes | string | Existing folder path (relative to workspace). Name according to user's language |
| `calendar_name` | yes | string | Calendar display name |
| `description` | no | string | Calendar description |
| `timezone` | no | string | IANA timezone identifier, default `Asia/Shanghai` |
| `initial_categories` | no | string | JSON array string. Example: `'[{"id":"publish","name":"Publish","color":"#4CAF50"}]'` |

---

## Tool: manage_calendar

Manage calendar events and categories.

### Common Parameters (all actions)

| Param | Type | Description |
|-------|------|-------------|
| `action` | string | `add_event` / `list_events` / `update_event` / `delete_event` / `add_category` / `list_categories` |
| `project_path` | string | Calendar project folder path (relative to workspace) |

### add_event

Only `title` + `start` are required. All other fields are optional with sensible defaults.

| Param | Required | Type | Description |
|-------|----------|------|-------------|
| `title` | yes | string | Event title |
| `start` | yes | string | `YYYY-MM-DD HH:MM` for timed events; `YYYY-MM-DD` for all-day events |
| `end` | no | string | Same format as start. Default: timed +1h, all-day same day |
| `description` | no | string | Event description |
| `location` | no | string | Location |
| `status` | no | string | `confirmed` (default) / `tentative` / `cancelled` / `completed` |
| `category` | no | string | Category ID (must exist) |
| `recurrence` | no | string | Recurrence rule as JSON string (see below) |

### list_events

All filters are optional. No filters = return all events.

| Param | Type | Description |
|-------|------|-------------|
| `date_from` | string | Start date filter (`YYYY-MM-DD`) |
| `date_to` | string | End date filter, inclusive (`YYYY-MM-DD`) |
| `category` | string | Filter by category ID |
| `keyword` | string | Search in title and description |

### update_event

Partial update — only pass fields you want to change.

| Param | Required | Type | Description |
|-------|----------|------|-------------|
| `event_id` | yes | string | Event ID (from add_event or list_events result) |
| `title` | no | string | New title |
| `start` | no | string | New start time |
| `end` | no | string | New end time |
| `description` | no | string | New description |
| `location` | no | string | New location |
| `status` | no | string | New status |
| `category` | no | string | New category ID |
| `recurrence` | no | string | New recurrence rule (JSON string) |

### delete_event

| Param | Required | Type | Description |
|-------|----------|------|-------------|
| `event_id` | yes | string | Event ID |

### add_category

| Param | Required | Type | Description |
|-------|----------|------|-------------|
| `category_id` | yes | string | Alphanumeric identifier (e.g. `meeting`, `publish`) |
| `category_name` | yes | string | Display name |
| `category_color` | yes | string | Hex color (e.g. `#4CAF50`) |

### list_categories

No additional parameters.

### Recurrence Rule Format

Pass as JSON string in the `recurrence` parameter:

```json
{"type": "daily", "interval": 1, "end_date": "2026-06-30"}
{"type": "weekly", "interval": 1, "days_of_week": [1, 3, 5]}
{"type": "monthly", "interval": 1, "day_of_month": 15, "end_date": "2026-12-31"}
```

- `type`: `daily` / `weekly` / `monthly`
- `interval`: repeat every N days/weeks/months, default 1
- `days_of_week`: for weekly only, 1=Mon … 7=Sun
- `day_of_month`: for monthly, defaults to the day from `start`
- `end_date`: `YYYY-MM-DD`, omit for indefinite

---

## Code Mode Examples

### Create calendar and add events

```python
from sdk.tool import tool

# 1. Create project folder
tool.call("shell_exec", {"command": "mkdir -p .workspace/content-calendar"})

# 2. Setup calendar with initial categories
tool.call("setup_calendar_project", {
    "project_path": "content-calendar",
    "calendar_name": "Content Publishing Calendar",
    "description": "30-day rolling content plan",
    "initial_categories": '[{"id":"publish","name":"Publish","color":"#4CAF50"},{"id":"review","name":"Review","color":"#2196F3"}]'
})

# 3. Minimal event (title + start only)
tool.call("manage_calendar", {
    "action": "add_event",
    "project_path": "content-calendar",
    "title": "Weekly standup",
    "start": "2026-04-21 10:00"
})

# 4. Full event
tool.call("manage_calendar", {
    "action": "add_event",
    "project_path": "content-calendar",
    "title": "Product review video",
    "start": "2026-04-22 14:00",
    "end": "2026-04-22 15:30",
    "category": "publish",
    "location": "Studio 3F",
    "description": "30s vertical tutorial"
})

# 5. Recurring event
tool.call("manage_calendar", {
    "action": "add_event",
    "project_path": "content-calendar",
    "title": "Content review meeting",
    "start": "2026-04-21 09:00",
    "recurrence": '{"type":"weekly","interval":1,"days_of_week":[1,3,5],"end_date":"2026-06-30"}'
})

# 6. All-day event (date-only start)
tool.call("manage_calendar", {
    "action": "add_event",
    "project_path": "content-calendar",
    "title": "Product launch day",
    "start": "2026-05-01",
    "category": "publish"
})
```

### Query, update, and delete

```python
from sdk.tool import tool

# Query by date range
result = tool.call("manage_calendar", {
    "action": "list_events",
    "project_path": "content-calendar",
    "date_from": "2026-04-21",
    "date_to": "2026-04-27"
})
print(result.content)

# Mark event as completed
tool.call("manage_calendar", {
    "action": "update_event",
    "project_path": "content-calendar",
    "event_id": "evt_a7f3b2",
    "status": "completed"
})

# Delete event
tool.call("manage_calendar", {
    "action": "delete_event",
    "project_path": "content-calendar",
    "event_id": "evt_c3d4e5"
})
```

---

## Important Notes

1. **Create folder first** — `setup_calendar_project` does not create folders; use `shell_exec` beforehand
2. **Event IDs are auto-generated** — never pass `id` when creating; use the returned ID for update/delete
3. **update_event is partial** — omitted fields keep their current value
4. **Time format** — `YYYY-MM-DD HH:MM` for timed events, `YYYY-MM-DD` for all-day. No seconds or timezone suffixes
5. **Do not manually edit project files** — always use tools; manual edits waste context and may corrupt data format
