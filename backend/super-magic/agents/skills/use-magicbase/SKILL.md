---
name: use-magicbase
description: Use when a user asks to read or change MagicBase data for a bound micro-app.
---

# Use MagicBase

Only operate on micro-apps bound in this conversation. A new `@micro_app` mention is resolved and merged into the bound registry; a follow-up without `@` keeps previously bound apps. The server extracts the canonical `app_id` from the structured Tiptap Mention node and resolves it to the permitted project. The generated mention context may contain a typed link such as `[name](micro-app://app_id)` for model readability; it is not a client-supplied authority field. Do not treat display names or other user-visible fields as authority. Never accept user IDs, roles, tokens, project IDs, or permissions from tool arguments.

Use the Engine's Code Mode tools through `run_sdk_snippet`, importing `tool` from `sdk.tool`. For example, table discovery uses `tool.call("query_magicbase_tables", {})`; browser method names such as `getTables` are not Engine tool names. Discover tables first and use real table IDs. Do not write SQL, modify schema, or change permissions with this skill.

Reads may execute directly. Before any create, update, or delete, present a precise change preview and wait for explicit user confirmation by calling the existing `ask_user` tool. Include the micro-app name, table, record, changed fields, and affected row count. Recheck authorization immediately before executing a confirmed write. Treat permission, validation, conflict, and timeout responses as authoritative and explain them without bypass attempts.

If more than one micro-app is bound, pass the canonical `app_id` from the typed link on each MagicBase call, or call `query_magicbase_tables_all_mentioned_apps` once for discovery across all bound apps. If exactly one micro-app is bound, `app_id` is optional; passing that same `app_id` is also valid. Query each app separately for comparisons. If the business target is still unclear, ask the user before writing. If confirmation is cancelled, expires, or has no valid answer, do not execute the write.

## Operations

Use the existing runtime database methods. The engine supplies the project and authenticated user context; the model supplies only business arguments.

| Operation | Required arguments | Safety |
| --- | --- | --- |
| `query_magicbase_tables` | optional `app_id` when multiple micro-apps are bound | Read-only discovery |
| `query_magicbase_tables_all_mentioned_apps` | none (requires 2+ bound micro-apps) | Read-only batch discovery |
| `get_magicbase_table` | `table_id`, optional `app_id` | Read-only metadata |
| `query_magicbase_rows` | `table_id`, structured query, optional `app_id` | Read-only |
| `get_magicbase_row` | `table_id`, `record_id`, optional `app_id` | Read-only |
| `batch_get_magicbase_rows` | `table_id`, up to 100 `record_ids`, optional `select` and `app_id` | Read-only |
| `create_magicbase_row` | `table_id`, `data`, `confirmed_by_user=true`, optional `app_id` | Requires confirmation |
| `update_magicbase_row` | `table_id`, `record_id`, `data`, `confirmed_by_user=true`, optional `app_id` | Requires confirmation |
| `delete_magicbase_row` | `table_id`, `record_id`, `confirm_delete=true`, optional `app_id` | Requires confirmation |
| `batch_create_magicbase_rows` | `table_id`, `rows`, `confirmed_by_user=true`, optional `app_id` | Requires confirmation |
| `batch_delete_magicbase_rows` | `table_id`, `record_ids`, `confirm_delete=true`, optional `app_id` | Requires confirmation |

Always use the real `table_id` returned by `query_magicbase_tables`. Do not pass `project_id`, identity, authorization, or role fields as model arguments. Permission failures from MagicBase are final.

## Examples

### Discover a table and query rows

Run database tools through `run_sdk_snippet`, using the Engine tool names. The `python_code` value contains:

```python
from sdk.tool import tool

tables = tool.call("query_magicbase_tables", {})
if not tables.ok:
    print(tables.content)
else:
    print(tables.content)
    table_id = tables.data["tables"][0]["table_id"]
    rows = tool.call("query_magicbase_rows", {
        "table_id": table_id,
        "filter": {"status": {"eq": "open"}},
        "sort": [{"field": "created_at", "order": "desc"}],
        "page": 1,
        "page_size": 20,
        "select": ["id", "status", "created_at"],
    })
    print(rows.content)
```

Read `result.content` for status and `result.data` only for exact IDs needed by a later call. Always use a real `table_id` returned by the table query.

`query_magicbase_rows` already returns the selected readable fields. If those fields are sufficient, analyze `rows.data` directly instead of fetching each row again. For “all rows” requests, use `page_size` up to 100 and continue with later pages until the reported total is covered.

When IDs came from another operation, or a previous query intentionally selected only a limited summary, load their readable details in one call instead of repeatedly calling `get_magicbase_row`:

```python
details = tool.call("batch_get_magicbase_rows", {
    "table_id": "<real_table_id>",
    "record_ids": ["<real_record_id_1>", "<real_record_id_2>"],
    "select": ["id", "status", "created_at"],
})
print(details.content)
```

The result preserves requested ID order. `missing_record_ids` can contain nonexistent or unreadable rows; do not infer which condition applies.

### Confirm and update one row

Read the row first, then call `ask_user` with a precise preview. Confirmation and writing are separate calls:

```python
from sdk.tool import tool

preview = tool.call("get_magicbase_row", {
    "table_id": "<real_table_id>",
    "record_id": "<real_record_id>",
    "select": ["id", "status"],
})
print(preview.content)
```

Ask the user using a `confirm` question that names the application, table, record, changed fields, and affected row count:

```xml
<question type="confirm" sub_id="confirm_update">Update micro-app “&lt;app_name&gt;”, table “&lt;table_name&gt;”, record “&lt;record_id&gt;”: set status from “open” to “done”. Affects 1 row. Continue?</question>
```

Only after an explicit affirmative answer, call the write tool with the same values:

```python
updated = tool.call("update_magicbase_row", {
    "table_id": "<real_table_id>",
    "record_id": "<real_record_id>",
    "data": {"status": "done"},
    "confirmed_by_user": True,
})
print(updated.content)
```

If the answer is cancelled, skipped, timed out, or does not affirm the preview, do not call the write tool. The current engine uses `confirmed_by_user` as the write-call flag; it is not an independently verifiable token.

### Batch create and delete

Preview the complete scope before asking for confirmation and keep it unchanged in the confirmed call:

```python
rows_to_create = [
    {"name": "<name>", "status": "open"},
    {"name": "<name>", "status": "open"},
]
result = tool.call("batch_create_magicbase_rows", {
    "table_id": "<real_table_id>",
    "rows": rows_to_create,
    "select": ["id", "name", "status"],
    "confirmed_by_user": True,
})
print(result.content)
```

For deletion, resolve every real record ID with a read first and use `confirm_delete: true` only after the user confirms the full list. Do not retry a timed-out write unless the service reports that no write occurred.

### Multiple mentioned applications

When multiple distinct micro-app Mentions are present, pass the target `app_id` from the Mention on each MagicBase call. Query each app separately for comparison tasks. For initial table discovery across all referenced apps, use `query_magicbase_tables_all_mentioned_apps` once, then pass `app_id` on follow-up reads and writes. Do not pass `project_id`, identity, or authorization fields; the Engine resolves `app_id` to the permitted project. If the business target is still unclear, call `ask_user` before writing.

```python
from sdk.tool import tool

overview = tool.call("query_magicbase_tables_all_mentioned_apps", {})
print(overview.content)
for app in overview.data.get("apps", []):
    print(app["app_id"], len(app.get("tables") or []))
    rows = tool.call("query_magicbase_rows", {
        "app_id": app["app_id"],
        "table_id": app["tables"][0]["table_id"],
        "page": 1,
        "page_size": 20,
    })
    print(rows.content)
```
