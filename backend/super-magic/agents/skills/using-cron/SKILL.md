---
name: using-cron
description: Manage scheduled tasks — create, query, update, and delete. CRITICAL - When user message contains any future time intent (e.g. "in 2 days", "tomorrow at 8am", "every morning"), you MUST load this skill first. NEVER write custom scheduler scripts.

name-cn: 定时任务管理
description-cn: 管理定时任务，支持创建、查询、更新、删除。关键规则 - 当用户消息包含未来时间意图时（例如"2天后"、"明天早上8点"、"每天早上"），必须首先加载此技能。禁止自行编写调度脚本。
---

<!--zh
# 定时消息任务管理
-->
# Scheduled Message Task Management

<!--zh
通过脚本管理定时消息任务，支持创建、查询列表、获取详情、更新、删除。
-->
Manage scheduled message tasks through scripts, supporting create, list, get, update, and delete operations.

<!--zh
## 核心能力
-->
## Core Capabilities

<!--zh
- 创建一次性或重复性定时消息任务
- 查询和过滤已有定时任务列表
- 获取任务详情
- 更新任务配置（名称、时间、启用状态等）
- 删除任务
-->
- Create one-time or recurring scheduled message tasks
- Query and filter existing scheduled task lists
- Get task details
- Update task configuration (name, time, enabled status, etc.)
- Delete tasks

<!--zh
## 快速开始
-->
## Quick Start

<!--zh
### 典型工作流
```
1. 创建任务 (create.py)
   ↓ 获取返回的 schedule_id
2. 查询列表 (list.py) - 可选
   ↓ 确认任务已创建
3. 获取详情 (get.py) - 可选
   ↓ 查看完整任务信息
4. 更新任务 (update.py) - 按需
5. 删除任务 (delete.py) - 按需
```
-->
### Typical Workflow
```
1. Create task (create.py)
   ↓ Get returned schedule_id
2. Query list (list.py) - Optional
   ↓ Confirm task was created
3. Get details (get.py) - Optional
   ↓ View complete task info
4. Update task (update.py) - As needed
5. Delete task (delete.py) - As needed
```

<!--zh
## 可用脚本

所有脚本位于 `agents/skills/using-cron` 目录下。
-->
## Available Scripts

All scripts are located in the `agents/skills/using-cron` directory.

---

<!--zh
### create.py - 创建定时任务
-->
### create.py - Create Scheduled Task

<!--zh
创建一个新的定时消息任务。
-->
Create a new scheduled message task.

**SYNOPSIS**
```bash
python scripts/create.py --task-name <name> --message-content <content> --type <type> --time <HH:MM> [OPTIONS]
```

**DESCRIPTION**

<!--zh
创建定时消息任务，支持单次执行和每日/每周/每月重复模式。

**何时传 `--specify-topic 1`**：仅当同时满足以下两点时传 1：（1）任务为重复执行（daily_repeat / weekly_repeat / monthly_repeat）；（2）用户意图中下一次执行时间或触发条件依赖本次/上一次执行结果（例如「每次完成后隔 3 天再执行」「根据上次结果决定下次时间」）。单次任务、或固定周期不依赖前次结果的任务，均不传或传 0。
-->
Create a scheduled message task, supporting one-time execution and daily/weekly/monthly repeat modes.

**When to pass `--specify-topic 1`**: Pass 1 only when both hold: (1) the task is recurring (daily_repeat / weekly_repeat / monthly_repeat), and (2) the user intent implies that the next run time or trigger depends on the current or previous run's result (e.g. "run again 3 days after each completion", "next time based on last result"). For one-time tasks or fixed-schedule tasks that do not depend on previous results, omit this option or pass 0.

**OPTIONS**

<!--zh
| 选项 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `--task-name <name>` | string | 是 | 任务名称 |
| `--message-content <content>` | string | 是 | 消息内容（与详情 message_content/task_describe 对应）|
| `--type <type>` | string | 是 | 调度类型，见下表 |
| `--time <HH:MM>` | string | 是 | 执行时间 |
| `--day <value>` | string | 条件必填 | 依调度类型而定，见下表 |
| `--deadline <YYYY-MM-DD HH:MM:SS>` | string | 否 | 重复任务截止日期，格式 YYYY-MM-DD HH:MM:SS；若只填日期或格式不明确，需要自行理解并补全（如补为当日 23:59:59）|
| `--specify-topic <0\|1>` | integer | 否 | 是否指定话题，0=否，1=是；默认 0。仅当识别到用户要创建**周期性**定时任务且**后续执行时间依赖前一次执行结果**时传 1，否则采用默认值 0 |
-->
| Option | Type | Required | Description |
|------|------|------|------|
| `--task-name <name>` | string | Yes | Task name |
| `--message-content <content>` | string | Yes | Message content (same as detail message_content/task_describe) |
| `--type <type>` | string | Yes | Schedule type, see table below |
| `--time <HH:MM>` | string | Yes | Execution time |
| `--day <value>` | string | Conditional | Depends on schedule type, see table below |
| `--deadline <YYYY-MM-DD HH:MM:SS>` | string | No | Expiry datetime; format YYYY-MM-DD HH:MM:SS. If only date or unclear format is given, the system will interpret and complete (e.g. to 00:00:00 that day) |
| `--specify-topic <0\|1>` | integer | No | Whether to specify topic; 0=no, 1=yes; default 0. Pass 1 only when the user intent is a **recurring** task whose **next run depends on the previous run's result**; otherwise use default 0 |

<!--zh
**调度类型 `--type` 与 `--day` 对应关系：**

| `--type` | 说明 | `--day` |
|----------|------|---------|
| `no_repeat` | 不重复，单次执行 | 执行日期 `YYYY-MM-DD`（必填）|
| `daily_repeat` | 每天重复 | 不需要 |
| `weekly_repeat` | 每周重复 | 星期几 `0`-`6`，`0`=周日（必填）|
| `monthly_repeat` | 每月重复 | 几号 `1`-`31`（必填）|
-->
**Schedule type `--type` and `--day` mapping:**

| `--type` | Description | `--day` |
|----------|------|---------|
| `no_repeat` | No repeat, one-time execution | Execution date `YYYY-MM-DD` (required) |
| `daily_repeat` | Repeat daily | Not needed |
| `weekly_repeat` | Repeat weekly | Day of week `0`-`6`, `0`=Sunday (required) |
| `monthly_repeat` | Repeat monthly | Day of month `1`-`31` (required) |

**OUTPUT**

<!--zh
成功返回：`{"id": "<schedule_id>"}`
-->
On success: `{"id": "<schedule_id>"}`

**EXAMPLES**
```bash
python scripts/create.py \
  --task-name "每日早报" \
  --message-content "请生成今日早报" \
  --type daily_repeat \
  --time "9:00"
```

---

<!--zh
### list.py - 查询任务列表
-->
### list.py - Query Task List

<!--zh
查询定时任务列表，支持按条件过滤。
-->
Query the scheduled task list with optional filtering.

**SYNOPSIS**
```bash
python scripts/list.py [OPTIONS]
```

**DESCRIPTION**

<!--zh
查询所有定时任务或按条件过滤，支持分页。查询结果**仅包含当前项目（project）下的定时任务**；project_id 由系统从当前会话自动带入，无需传入。
-->
Query all scheduled tasks or filter by conditions, with pagination support. Results are **scoped to the current project**; project_id is taken from the current session and must not be passed.

**OPTIONS**

<!--zh
| 选项 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `--task-name <name>` | string | 否 | 按任务名称模糊搜索 |
| `--enabled <0\|1>` | integer | 否 | `1`=启用中 `0`=已禁用 |
| `--completed <0\|1>` | integer | 否 | `1`=已完成 `0`=未完成 |
| `--page <n>` | integer | 否 | 页码，默认第 1 页 |
| `--page-size <n>` | integer | 否 | 每页条数，默认 50 条 |
-->
| Option | Type | Required | Description |
|------|------|------|------|
| `--task-name <name>` | string | No | Fuzzy search by task name |
| `--enabled <0\|1>` | integer | No | `1`=enabled `0`=disabled |
| `--completed <0\|1>` | integer | No | `1`=completed `0`=not completed |
| `--page <n>` | integer | No | Page number, default 1 |
| `--page-size <n>` | integer | No | Items per page, default 50 |

**OUTPUT**

<!--zh
成功返回：`{"total": N, "schedules": [{"id": "...", "task_name": "...", "task_describe": "...", "status": "...", "enabled": 0|1, "time_config": {...}, "deadline": ...}]}`。列表项包含：`id`、`task_name`、`task_describe`、`status`、`enabled`、`time_config`、`deadline`。
-->
On success: `{"total": N, "schedules": [{"id": "...", "task_name": "...", "task_describe": "...", "status": "...", "enabled": 0|1, "time_config": {...}, "deadline": ...}]}`. Each item includes: `id`, `task_name`, `task_describe`, `status`, `enabled`, `time_config`, `deadline`.

**EXAMPLES**
```bash
# 查询全部
python scripts/list.py

# 按条件过滤
python scripts/list.py --task-name "早报" --enabled 1 --completed 0
```

---

<!--zh
### get.py - 获取任务详情
-->
### get.py - Get Task Details

<!--zh
获取指定定时任务的完整详情。
-->
Get the complete details of a specific scheduled task.

**SYNOPSIS**
```bash
python scripts/get.py --id <schedule_id>
```

**DESCRIPTION**

<!--zh
根据任务 ID 查询完整任务信息。
-->
Query complete task information by task ID.


**OPTIONS**

<!--zh
| 选项 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `--id <schedule_id>` | string | 是 | 任务 ID |
-->
| Option | Type | Required | Description |
|------|------|------|------|
| `--id <schedule_id>` | string | Yes | Task ID |

**OUTPUT**

<!--zh
成功返回完整任务信息，包含 `id`、`task_name`、`task_describe`、`message_content`、`time_config`、`status`、`enabled`、`deadline`。
-->
On success: Returns complete task info including `id`, `task_name`, `task_describe`, `message_content`, `time_config`, `status`, `enabled`, `deadline`.

**EXAMPLES**
```bash
python scripts/get.py --id "<schedule_id>"
```

---

<!--zh
### update.py - 更新任务
-->
### update.py - Update Task

<!--zh
更新指定定时任务的配置，只需传要修改的字段。
-->
Update the configuration of a specific scheduled task; only pass fields to be modified.

**SYNOPSIS**
```bash
python scripts/update.py --id <schedule_id> [OPTIONS]
```

**DESCRIPTION**

<!--zh
更新定时任务配置。只需传要修改的字段，未传的字段保持不变。`--type` 与 `--time` 需同时提供。
-->
Update scheduled task configuration. Only pass fields to be modified; unspecified fields remain unchanged. `--type` and `--time` must be provided together.

**OPTIONS**

<!--zh
| 选项 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `--id <schedule_id>` | string | 是 | 任务 ID |
| `--task-name <name>` | string | 否 | 新任务名称 |
| `--message-content <content>` | string | 否 | 消息内容（与详情 message_content/task_describe 对应）|
| `--type <type>` | string | 否 | 调度类型（需与 `--time` 同时提供）|
| `--time <HH:MM>` | string | 否 | 执行时间（需与 `--type` 同时提供）|
| `--day <value>` | string | 否 | 日期/星期/日号，含义随 `--type` 不同 |
| `--deadline <YYYY-MM-DD HH:MM:SS>` | string | 否 | 截止日期，格式 YYYY-MM-DD HH:MM:SS；若只填日期或格式不明确将自动补全 |
| `--enabled <0\|1>` | integer | 否 | `1`=启用 `0`=禁用 |
-->
| Option | Type | Required | Description |
|------|------|------|------|
| `--id <schedule_id>` | string | Yes | Task ID |
| `--task-name <name>` | string | No | New task name |
| `--message-content <content>` | string | No | Message content (same as detail message_content/task_describe) |
| `--type <type>` | string | No | Schedule type (must be provided with `--time`) |
| `--time <HH:MM>` | string | No | Execution time (must be provided with `--type`) |
| `--day <value>` | string | No | Date/weekday/day-of-month, depends on `--type` |
| `--deadline <YYYY-MM-DD HH:MM:SS>` | string | No | Expiry datetime; format YYYY-MM-DD HH:MM:SS, auto-completed if only date or unclear |
| `--enabled <0\|1>` | integer | No | `1`=enable `0`=disable |

**OUTPUT**

<!--zh
成功返回：`{"id": "<schedule_id>"}`
-->
On success: `{"id": "<schedule_id>"}`

**EXAMPLES**
```bash
# 修改任务名称
python scripts/update.py --id "<schedule_id>" --task-name "新名称"

# 修改任务详情
python scripts/update.py --id "<schedule_id>" --message-content "新的任务详情内容"

# 修改调度时间
python scripts/update.py --id "<schedule_id>" --type daily_repeat --time "10:00"

# 修改截止日期
python scripts/update.py --id "<schedule_id>" --deadline "2026-12-31 23:59:59"

# 禁用任务
python scripts/update.py --id "<schedule_id>" --enabled 0

# 重新启用任务
python scripts/update.py --id "<schedule_id>" --enabled 1
```

---

<!--zh
### delete.py - 删除任务
-->
### delete.py - Delete Task

<!--zh
删除指定的定时任务。
-->
Delete a specific scheduled task.

**SYNOPSIS**
```bash
python scripts/delete.py --id <schedule_id>
```

**DESCRIPTION**

<!--zh
根据任务 ID 永久删除定时任务。
-->
Permanently delete a scheduled task by task ID.

**OPTIONS**

<!--zh
| 选项 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `--id <schedule_id>` | string | 是 | 任务 ID |
-->
| Option | Type | Required | Description |
|------|------|------|------|
| `--id <schedule_id>` | string | Yes | Task ID |

**OUTPUT**

<!--zh
成功返回：`{"id": "<schedule_id>"}`
-->
On success: `{"id": "<schedule_id>"}`

**EXAMPLES**
```bash
python scripts/delete.py --id "<schedule_id>"
```

---

<!--zh
## 调用示例
-->
## Usage Examples

<!--zh
在 Agent 环境中，使用 `shell_exec` 工具执行脚本：
-->
In Agent environment, use `shell_exec` tool to execute scripts:
```python
# 创建任务
shell_exec(
    command='python scripts/create.py --task-name "每日早报" --message-content "请生成今日早报" --type daily_repeat --time "9:00"',
    cwd="agents/skills/using-cron"
)

# 查询任务列表
shell_exec(
    command="python scripts/list.py",
    cwd="agents/skills/using-cron"
)

# 获取任务详情
shell_exec(
    command='python scripts/get.py --id "<schedule_id>"',
    cwd="agents/skills/using-cron"
)

# 更新任务
shell_exec(
    command='python scripts/update.py --id "<schedule_id>" --enabled 0',
    cwd="agents/skills/using-cron"
)

# 删除任务
shell_exec(
    command='python scripts/delete.py --id "<schedule_id>"',
    cwd="agents/skills/using-cron"
)
```
