---
name: dingtalk-cli
description: "Use when the user wants to interact with DingTalk/钉钉 in any way — including but not limited to: reading, querying, searching, sending, replying to, forwarding, or recalling DingTalk/钉钉 chat messages and chat history; managing group chats and conversations; sending DING alerts; querying contacts, org structure, AI search, or coworkers; reading, searching, creating, or editing DingTalk/钉钉 docs, drive files, sheets, AI tables, wiki, mail, calendar events, meeting rooms, AI meeting minutes, attendance, OA approvals, todos, reports/logs, live sessions, AI apps, permissions, or open-platform docs."

name-cn: 钉钉能力入口
description-cn: 当用户需要以任何方式操作钉钉时——包括但不限于：读取/查询/搜索/发送/回复/转发/撤回钉钉聊天消息和聊天记录、管理群聊和会话、DING、查通讯录/组织架构/AI搜问/同事、读写和搜索钉钉文档/云盘/表格/AI表格/知识库/邮件/日历/会议室/AI听记/考勤/OA审批/待办/日志/直播/AI应用/权限/开放平台文档等。
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
| `aiapp` | AI apps: create, query, update | `dws aiapp` |
| `aisearch` | AI search: find people by name, employee number, phone, department, responsibility, reporting lines | `dws aisearch` |
| `aitable` | AI tables: bases, tables, fields, records, views, charts, dashboards, import/export | `dws aitable` |
| `attendance` | Attendance: punch records, shift schedules, statistics | `dws attendance` |
| `calendar` | Calendar: events, attendees, meeting rooms, availability | `dws calendar` |
| `chat` | Conversations, group chats, bot messaging, single chat, Webhook, message history, direct/group message list, sender filters, unread conversations, keyword and advanced message search, read/send status, send/reply/forward/recall | `dws chat` |
| `contact` | Contacts: user lookup, department structure | `dws contact` |
| `devdoc` | DingTalk open platform developer documentation search | `dws devdoc` |
| `ding` | DING alerts: send/recall (in-app / SMS / phone) | `dws ding` |
| `doc` | DingTalk docs: search, read, write, block edit, comments, copy/move | `dws doc` |
| `drive` | Cloud drive: file list, upload, download, folders | `dws drive` |
| `live` | Live sessions: list and info | `dws live` |
| `mail` | Mail: search, view, send | `dws mail` |
| `minutes` | AI meeting minutes: list, summary, transcript, todos, mindmap | `dws minutes` |
| `oa` | OA approvals: pending, submitted, approve, reject, revoke | `dws oa` |
| `pat` | Behavior authorization management | `dws pat` |
| `report` | Logs/reports: create by template, inbox, sent, statistics | `dws report` |
| `sheet` | DingTalk spreadsheets: worksheets, cells, formulas, images, find/replace | `dws sheet` |
| `todo` | Todos: create, query, update, complete, delete | `dws todo` |
| `wiki` | DingTalk wiki spaces and knowledge-base nodes | `dws wiki` |

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
