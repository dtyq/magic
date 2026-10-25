---
name: dingtalk-cli
description: "Use when the user wants to log in to DingTalk or check authentication and permissions; read, query, search, send, reply to, forward, or recall messages and chat history; manage group chats or send DING alerts; find coworkers or query contacts, departments, and reporting relationships; read, search, create, or edit docs, drive files, spreadsheets, AI tables, wiki, mail, calendars, meeting rooms, AI meeting minutes, todos, reports, whiteboards, or AI cards; query attendance or live sessions, handle OA approvals, manage goals, contracts, digital employees, or applications; subscribe to real-time events; or look up developer documentation and use DingTalk OpenAPI."
---

# DingTalk CLI Skill Index

The `dws` command is provided by the Super Magic runtime. Its current default
installation contains separate `dingtalk-*` skills under `~/.agents/skills/`.
Use the task-specific skill below; do not require the legacy all-in-one `dws` skill.

## Choose a Skill

For a clear product request, load only the matching skill with `read_skills` and
follow its reference and shared-rule requirements. For authentication, account
selection, an ambiguous request, or a cross-product workflow, start with
`dingtalk-shared`.

| User intent | Load skill |
|-------------|------------|
| Login, authentication status, accounts, profiles, or cross-product routing | `dingtalk-shared` |
| Read, search, send, reply to, forward, or recall messages; manage chats | `dingtalk-chat` |
| Find people by name, department, responsibility, or reporting lines | `dingtalk-aisearch` |
| Look up users, departments, and directory relationships | `dingtalk-contact` |
| Read, create, or edit DingTalk documents and document content | `dingtalk-doc` |
| List, upload, download, or organize cloud drive files | `dingtalk-drive` |
| Operate AI tables, fields, records, views, charts, or dashboards | `dingtalk-aitable` |
| Manage calendar events, attendees, meeting rooms, or availability | `dingtalk-calendar` |
| Read or send mail | `dingtalk-mail` |
| Query meeting minutes, transcripts, summaries, or action items | `dingtalk-minutes` |
| Manage todos | `dingtalk-todo` |
| Manage wiki spaces, nodes, or members | `dingtalk-wiki` |
| Listen for future messages, approval changes, or other real-time events | `dingtalk-event` |
| Create or update AI cards | `dingtalk-aicard` |
| Manage digital employees or their local agent connections | `dingtalk-tag` |
| Approvals, attendance, DING, reports, spreadsheets, whiteboards, contracts, goals, app development, OpenAPI, or other long-tail products | `dingtalk-misc` |

```
read_skills(skill_names=["dingtalk-shared"])
read_skills(skill_names=["dingtalk-chat"])
read_skills(skill_names=["dingtalk-misc"])
```

Use the loaded skill's returned `<skill_dir>` to resolve reference files.
Do not guess a per-product skill name from the CLI command: several products
share `dingtalk-misc`.

## Authentication in the Super Magic Sandbox

For a status-only request, use the local snapshot without refreshing credentials:

```bash
dws auth status --readonly --format json
```

A snapshot is not an online token-validity check. Before a business operation,
follow the selected skill's authentication requirements. If login is needed,
use the device flow because the user's browser cannot reach the sandbox's
loopback listener:

```bash
dws auth login --device --no-browser
```

Start login with `shell_exec`. If it returns a background task ID, return the
authorization link and required user code to the user before waiting. After
the user confirms authorization, use `shell_await` to resume that same task.
Do not start duplicate login attempts. `--no-browser` alone only suppresses
browser launch; it does not replace `--device`. Verify the result with:

```bash
dws auth status --format json
```

Do not initiate login merely to answer whether the user is already logged in.
Follow the shared account-selection rules; do not pick an arbitrary account.
Never expose access tokens, client secrets, or credential files.

## Command Discovery and Missing Skills

Inspect the installed CLI before choosing parameters:

```bash
dws --help
dws <product> --help
dws <product> <command> --help
dws schema --cli-path "<command path>" --compact --format json
```

Use only commands supported by the installed version. A CLI command being
available does not prove its skill is installed. If a selected skill is missing,
inspect the installed skill directories. Use legacy `dws` guidance only when
that mono skill is actually installed. Otherwise report the missing runtime
skill; do not install, upgrade, or change skill mode inside the sandbox.

Follow the selected skill's confirmation and retry rules. A zero process exit
code alone does not prove the requested business operation completed.
