---
name: dingtalk-cli
description: Use when the user wants to interact with DingTalk in any way — including but not limited to: sending messages or DING alerts; managing group chats; querying contacts or org structure; reading, creating, or editing DingTalk docs; managing cloud drive files; operating AI tables (aitable); handling OA approvals; reviewing attendance; managing todos; submitting daily/weekly reports (logs); querying AI meeting minutes; reading mail; browsing calendar events or booking meeting rooms.

name-cn: 钉钉能力入口
description-cn: 当用户需要以任何方式操作钉钉时——包括但不限于：发消息/DING、管群聊、查通讯录、读写钉钉文档、管云盘文件、操作AI表格、OA审批、查考勤、管待办、提交日志/日报/周报、查询AI听记纪要、收发邮件、管日历/会议室等。
---

# DingTalk CLI Skill Index

**Before doing anything**, you MUST load the `dws` skill first. It contains the full product reference, command syntax, intent routing decision tree, dangerous operation rules, and error handling guide. Do not proceed without reading it.

```
read_skills(skill_names=["dws"])
```

---

## Product Overview

| Product | Use for | CLI entry |
|---------|---------|-----------|
| `aitable` | AI tables: bases, tables, fields, records, views, charts, dashboards, import/export | `dws aitable` |
| `attendance` | Attendance: punch records, shift schedules, statistics | `dws attendance` |
| `calendar` | Calendar: events, attendees, meeting rooms, availability | `dws calendar` |
| `chat` | Group chats, bot messaging, single chat, Webhook | `dws chat` |
| `contact` | Contacts: user lookup, department structure | `dws contact` |
| `devdoc` | DingTalk open platform developer documentation search | `dws devdoc` |
| `ding` | DING alerts: send/recall (in-app / SMS / phone) | `dws ding` |
| `doc` | DingTalk docs: search, read, write, block edit, comments, copy/move | `dws doc` |
| `drive` | Cloud drive: file list, upload, download, folders | `dws drive` |
| `mail` | Mail: search, view, send | `dws mail` |
| `minutes` | AI meeting minutes: list, summary, transcript, todos, mindmap | `dws minutes` |
| `oa` | OA approvals: pending, submitted, approve, reject, revoke | `dws oa` |
| `report` | Logs/reports: create by template, inbox, sent, statistics | `dws report` |
| `todo` | Todos: create, query, update, complete, delete | `dws todo` |

---

## Authentication

Before any DingTalk operation, verify auth status first:

```bash
dws auth status --format json
```

If `authenticated` is `false`, start the login flow. This environment has no browser (Docker/SSH), so always use the device flow:

```bash
dws auth login --device
```

The command outputs an authorization URL, then waits with the prompt `Waiting for user authorization`. At this point:
1. Show the authorization URL to the user
2. Ask the user to open the URL in a browser or DingTalk mobile app to complete authorization
3. The command will automatically detect the authorization and proceed

To force re-login (e.g. token expired):

```bash
dws auth login --device --force
```

---

## When Unsure About a Command

Always check `--help` before guessing parameters.

```bash
dws --help
dws <product> --help
dws <product> <command> --help
```

Examples:

```bash
dws chat --help
dws calendar event list --help
dws aitable record --help
```
