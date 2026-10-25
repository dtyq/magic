---
name: lark-cli
description: "Use when the user wants to configure or log in to Lark/Feishu, check identity, or manage permissions; read, query, search, send, reply to, or forward IM messages and chat history, download chat files, or manage group chats; list, view, search, create, or edit cloud docs/files, Drive, Markdown, spreadsheets, Base tables, wiki, whiteboards, slides, apps, calendars/events/meeting rooms, contacts/org structure, tasks/todos, mail, or OKRs; query attendance, handle approvals, or retrieve meeting records, minutes, transcripts, summaries, and action items; subscribe to real-time events; call Lark OpenAPI; or build reusable CLI skills and workflows."
---

# Lark/Feishu CLI Skill Index

The `lark-cli` command is provided by the Super Magic runtime. Start with
`lark-shared`, then read only the skill matching the current task.

## Read Guidance for the Installed CLI

Recent versions embed their own skill text and reference files. Prefer this
version-matched source:

```bash
lark-cli skills list
lark-cli skills read lark-shared
lark-cli skills read lark-im
lark-cli skills read lark-shared/references/lark-shared-identity-and-permissions.md
```

Use `lark-cli skills list <skill>/references` to discover reference paths, and
`lark-cli skills read <skill>/<path>` to read them. Resolve relative links in
embedded text within that skill; do not assume they name local files.
Embedded skills omit scripts and assets. If the task needs such files, use an
installed skill directory and verify the required files exist.

If `lark-cli skills` is unavailable in an older runtime, use `read_skills` to
load the installed `lark-shared` and task skill. For file-based guidance,
resolve references from the returned `<skill_dir>`. Do not automatically
install or upgrade the runtime if guidance is missing.

## Choose a Skill

| User intent | Read skill |
|-------------|------------|
| Configuration, login, identity, scopes, or common errors | `lark-shared` |
| Messages, chat history, groups, threads, or chat attachments | `lark-im` |
| Calendar events, attendees, availability, or meeting-room booking | `lark-calendar` |
| Find people or resolve user identities | `lark-contact` |
| Read, create, or edit documents and mindnotes | `lark-doc` |
| Drive files, folders, uploads, downloads, permissions, or comments | `lark-drive` |
| Native Drive Markdown files | `lark-markdown` |
| Spreadsheet cells, formulas, imports, or exports | `lark-sheets` |
| Base tables, records, fields, views, dashboards, or workflows | `lark-base` |
| Presentations and slides | `lark-slides` |
| Whiteboards | `lark-whiteboard` |
| Wiki spaces, members, or document hierarchy | `lark-wiki` |
| Todos, task lists, subtasks, or task agents | `lark-task` |
| Approval instances or approval tasks | `lark-approval` |
| Attendance records | `lark-attendance` |
| Mail, drafts, labels, rules, or mail folders | `lark-mail` |
| Meetings, meeting notes, Minutes, transcripts, summaries, or meeting artifacts | `lark-meeting` |
| OKR objectives, key results, or progress | `lark-okr` |
| Real-time events and subscriptions | `lark-event` |
| Spark/Miaoda applications, web apps, or deployment | `lark-apps` |
| Build a reusable Lark workflow skill | `lark-skill-maker` |
| Native OpenAPI beyond the task-specific skills | `lark-openapi-explorer` |
| Summarize meeting notes across a time range | `lark-workflow-meeting-summary` |
| Summarize an agenda and unfinished tasks | `lark-workflow-standup-report` |

The current `lark-minutes`, `lark-vc`, and `lark-vc-agent` skills are compatibility
entries that delegate to `lark-meeting`. On older runtimes, inspect the installed
skill list and use the meeting skill actually provided there.

## Authentication in the Super Magic Sandbox

Apply these sandbox-specific rules when reading upstream authentication guidance.
For status, use:

```bash
lark-cli auth status --json
```

Use `--verify` only when an online token check is required. A missing application
configuration is separate from a missing user login; follow the configuration
reference when the CLI reports that setup is required. Run the configuration
command in the background, return its setup URL, and wait for it to complete
before starting user login. Do not ask the user to paste an App Secret into chat.
When a named profile is used, pass the same `--profile <name>` to initiation,
polling, and status verification. A new configuration does not necessarily
switch the default profile. Logging out or choosing another user also does
not change the configured app. An account without access to that app needs an
account/app-access decision, rather than repeated login attempts. When the
user asks for a new app, preserve the existing configuration with a named
profile:

```bash
lark-cli config init --new --name <profile>
```

Return the setup URL before waiting on the background task. Once configuration
completes, use `lark-cli --profile <profile> auth ...` throughout that login
attempt; only switch the default profile when the user requests it.

The current login command uses device authorization and normally waits for the
user. In the sandbox, split initiation and polling so the user receives the
link before the shell waits:

```bash
lark-cli auth login --domain <required-domain> --no-wait --json
```

Use `--scope "<required-scope>"` when a precise permission is known. Choose the
scope or domain needed for the task; the current no-argument login and
`--recommend` request all known business domains. The requested scopes do not prove the
final token is restricted to those scopes: inspect the returned scope set,
which may include previously granted or service-provided permissions.

Return `verification_url` unchanged as a text link, ask the user to open it and
reply after authorization, and end the turn. Keep the returned device code for
that authorization attempt. After the user confirms, resume it with:

```bash
lark-cli auth login --device-code <device_code>
lark-cli auth status --json --verify
```

Do not immediately poll before the user can receive the link, start duplicate
login attempts, or reuse an expired device code. Start a new authorization only
when the previous attempt expired or failed. If some scopes were not granted,
verify the actual identity and token state before deciding whether login failed
or the task still needs additional permissions. A page saying no permissions
need authorization is not proof of login. If polling or verification reports
organization/data-security policy denial, stop and report the policy error;
do not broaden scopes, recreate the app, or repeat login as a workaround.
After polling, require the user identity to be available and verified; a ready
bot identity or a zero exit code from `auth status` is insufficient.

Sandbox exception: do not generate QR-code images or call `lark-cli auth qrcode`.
Return the authorization URL as a text link. This overrides upstream QR-code
instructions in this sandbox and avoids creating image files or attachments.
Never expose client secrets, access tokens, or credential files.

## Command Discovery

Prefer a supported `+shortcut` for the task, then inspect typed API commands or
OpenAPI only when necessary:

```bash
lark-cli <domain> --help
lark-cli <domain> <command> --help
lark-cli schema <service.resource.method>
```

Confirm user versus bot identity before accessing personal resources. Follow
the loaded guidance for confirmations, output interpretation, and retries;
do not treat an empty response or zero exit code as proof of the requested
business result.
