---
name: magicbase
description: "Use when an HTML micro-app needs MagicBase persistence, window.Magic.db row operations, current-user context through window.Magic.getContext, creators, owners, assignees, permissions, CRUD, forms, surveys, todos, dashboards, filters, statistics, exports, or any saved user data."
---

# MagicBase for HTML Micro-apps

Use this skill when an HTML micro-app needs persistent data, current-user identity, ownership, permissions, or runtime row-level database operations.

MagicBase has three operation surfaces:

- Schema work runs through Code Mode tools before HTML generation: `query_magicbase_tables`, `get_magicbase_table`, `create_magicbase_table`, `create_magicbase_column`, `update_magicbase_table_permissions`, `delete_magicbase_table`, `update_magicbase_column`, and `delete_magicbase_column`.
- Explicit agent-side data maintenance runs through Code Mode tools: `query_magicbase_rows`, `get_magicbase_row`, `batch_get_magicbase_rows`, `create_magicbase_row`, `update_magicbase_row`, `batch_create_magicbase_rows`, `delete_magicbase_row`, and `batch_delete_magicbase_rows`.
- Runtime row operations are done inside HTML with `window.Magic.db`, using real table IDs returned by MagicBase tools.

Do not expose schema creation inside HTML pages. HTML code should only read and write rows on tables that already exist.

## Code Mode Execution

Every agent-side tool above is Code Mode only. They are not mounted directly, so never try to call them as ordinary tools and never declare them in an agent `tools:` list.

Call them from the `run_sdk_snippet` tool by passing code in its `python_code` parameter. Inside that code, import the tool proxy and call the tool by name:

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("query_magicbase_tables", {})
if not result.ok:
    raise SystemExit(result.content)
print(result.content)
""")
```

Rules for these calls:

- Always check `result.ok` before using the result.
- Read `result.content` first; it always explains the actual state in one place. Use `result.data` only when you need exact structured values such as real `table_id`, `column_id`, or `record_id` for later steps.
- For multi-step schema work, keep the real IDs from `result.data` instead of re-querying by name.
- Never pass `project_id`, `authorization`, `organization_code`, `created_by`, a share token, or any other actor field. The tool reads them from the current session; providing them is an error.
- Do not use `run_python_snippet` for MagicBase tools. It is a plain Python executor and does not provide `sdk.tool.call(...)`.

Create a table and keep its real id:

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("create_magicbase_table", {
    "table_key": "orders",
    "table_name": "Orders",
    "columns": [
        {"column_key": "title", "column_name": "Title", "data_type": "text", "is_required": True},
        {"column_key": "status", "column_name": "Status", "data_type": "text", "default_value": "pending"},
    ],
})
if not result.ok:
    raise SystemExit(result.content)
print(result.content)
table_id = result.data["table"]["table_id"]
print(f"TABLE_ID={table_id}")
""")
```

Query then update one real row:

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

table_id = "<table_id>"
found = tool.call("query_magicbase_rows", {"table_id": table_id, "page": 1, "page_size": 20})
if not found.ok:
    raise SystemExit(found.content)
rows = found.data["rows"]
if not rows:
    raise SystemExit("No rows matched; nothing to update.")
record_id = rows[0]["id"]

updated = tool.call("update_magicbase_row", {
    "table_id": table_id,
    "record_id": record_id,
    "data": {"status": "done"},
})
print(updated.content)
""")
```

`query_magicbase_rows` already returns the selected readable fields; use its `data["rows"]` directly when those fields are sufficient. When several known row IDs need additional fields, use one batch query instead of calling `get_magicbase_row` repeatedly:

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("batch_get_magicbase_rows", {
    "table_id": "<table_id>",
    "record_ids": ["<record_id_1>", "<record_id_2>"],
    "select": ["id", "status", "created_at"],
})
if not result.ok:
    raise SystemExit(result.content)
print(result.content)
rows = result.data["rows"]
missing = result.data["missing_record_ids"]
""")
```

`batch_get_magicbase_rows` accepts at most 100 numeric row IDs, preserves the requested order, and returns readable rows only. Missing IDs can mean the row does not exist or is not readable; do not treat them as an authorization verdict.


Project memory uses `MICRO-APP.md` for the latest human-readable app memory and MagicBase data model. Do not edit it directly with file-editing tools. MagicBase schema tools maintain `.magicbase/migrations.json`; after successful table or column changes, they refresh the latest MagicBase data model in `MICRO-APP.md`. If tools report a `Pending` migration at the start of a later task, query MagicBase first so confirmable records can be repaired before more schema work. If a legacy `HTML-APP.md` exists, read it for context and migrate the memory to `MICRO-APP.md` before finishing.

MagicBase exposes a simplified MySQL-like column model. Use only these `data_type` values when creating tables or columns: `text`, `number`, `datetime`, `boolean`, `json`.

### Datetime Values

For `datetime` columns, MagicBase accepts only these input formats:

- `YYYY-MM-DD`, normalized to `YYYY-MM-DD 00:00:00`.
- `YYYY-MM-DD HH:mm`.
- `YYYY-MM-DD HH:mm:ss`.
- `YYYY-MM-DDTHH:mm`.
- `YYYY-MM-DDTHH:mm:ss`.
- ISO 8601 values with a UTC or numeric timezone, with optional fractional seconds, such as `2026-08-04T03:12:18.582Z` or `2026-08-04T11:12:18.582+08:00`.

Use the raw value from `<input type="date">` or `<input type="datetime-local">` when it matches one of these formats. `Date.prototype.toISOString()` output is also accepted. MagicBase converts timezone-aware values to the service timezone and normalizes all accepted values to `YYYY-MM-DD HH:mm:ss` for storage and responses. Fractional seconds are discarded because MagicBase currently stores datetime values with second precision. Date and datetime filter values follow the same format rules.

Do not manually remove `Z` or a numeric timezone offset before calling `createRow`, `batchCreateRows`, `updateRow`, or a query filter. Removing timezone information changes the represented instant instead of converting it correctly.

Model UI choices with MySQL-like columns:

- Single-choice UI values use `text`.
- Multiple-choice UI values use `json` and write an array, such as `["office", "gaming"]`.
- User IDs, department IDs, attachment IDs/URLs, and foreign-key values use `text` unless the app truly needs a JSON array/object.
- Do not use low-code field types such as `single_select`, `multi_select`, `user`, `department`, `attachment`, or `reference`; MagicBase no longer exposes them as column types.
- Relations are separate metadata. Create ordinary key columns such as `customer_id: text`, then create a MagicBase relation between source and target columns when joined reads are needed.

## Current User Context (`window.Magic.getContext`)

Use `window.Magic.getContext()` whenever a micro-app needs current-user display, creators, owners, assignees, collaborators, "my data versus all data", or edit/delete permission checks.

`getContext()` is hosted by the parent application. It uses the current login state to query magic-service user information and returns a normalized current-user profile. HTML business code should not call `/api/v1/contact/users/queries` directly for the current user, should not hard-code tokens, and should not read `.credentials` files.

```javascript
const context = await window.Magic.getContext();
// context: {
//   userId: "usi_xxx",
//   userName: "Alice",
//   user: { user_id, real_name, nickname, avatar_url, phone, email, ... },
//   organizationCode: "org_xxx",
//   language: "zh-CN"
// }
```

For data apps with ownership or collaboration:

- Ensure `app.json.anonymous` matches the permission model. Apps that depend on real current-user identity, `created_by`, owner-only editing, departments, organizations, or team collaboration must set `anonymous:false`. Anonymous apps can only use identity-independent public flows such as public display or anonymous intake.
- Call `window.Magic.getContext()` during initialization before user-dependent reads or writes.
- Prefer MagicBase system fields for ownership. MagicBase automatically records `created_by` for every row, and backend `private_user` permissions are based on this system field.
- Do not create a dynamic `creator_user_id` column just to enforce creator permissions. Create business identity fields only when the app needs UI display, filtering, assignment, or domain-specific ownership beyond the system creator, such as `creator_name`, `owner_user_id`, `owner_name`, `assignee_user_id`, or `updated_by_user_id`.
- When creating a row, write only real business fields. Do not write system fields such as `created_by`, `organization_code`, `created_at`, or `updated_at`.
- When rendering edit/delete/archive/transfer buttons for creator-owned rows, request `created_by` through `select` and compare it with `context.userId`. Display names are not permission keys.
- If `getContext()` fails, disable user-dependent create, edit, delete, ownership, and transfer operations and show an understandable error. Never write fake identities such as `unknown`, `guest`, `visitor`, `访客`, or `未命名用户` into MagicBase.

## Micro-app Administrator Pages

Use this pattern when a micro-app has pages such as an administrator dashboard, aggregate statistics, exports, or management tools that ordinary users must not open:

- Set `app.json.anonymous` to `false`; administrator checks require a real login.
- Put a shared `app.js` in the app root and declare page-relative paths:

```javascript
window.MagicAppConfig = {
  admin_pages: ["admin.html", "statistics.html"],
};
```

- Call `window.Magic.db.getProjectAdminAccess()` during startup. It is a host-bridged request to `GET /api/v1/magicbase/projects/{projectId}/admin-access`, so the host supplies the current project context, login authorization, and share token when applicable.
- The backend evaluates the real logged-in user. A share token only proves access to the current project share and must never be used as the current user or share creator identity.
- Hide administrator links on the home page when `is_admin` is false. Every administrator page must repeat the guard before loading its protected data; direct URL access must not bypass it.
- Do not call administrator data endpoints before the guard resolves. Frontend hiding is not a substitute for MagicBase dynamic/static permissions or a backend authorization check.

Recommended guard:

```javascript
window.MagicAppGuard = {
  async requireAdminPage(pagePath) {
    const pages = window.MagicAppConfig?.admin_pages || [];
    if (!pages.includes(pagePath)) return true;

    const access = await window.Magic.db.getProjectAdminAccess();
    if (!access?.is_admin) {
      window.location.replace("index.html");
      return false;
    }
    return true;
  },
};
```

If a requested administrator rule depends on workflow state, cross-table membership, approval, hierarchy, time windows, quotas, or sensitive business validation, classify it as `requires_backend`; `admin_pages` only gates pages and does not implement those business rules.

Recommended pattern:

```javascript
let context = null;

async function initRuntime() {
  context = await window.Magic.getContext();
  if (!context?.userId || !context?.userName) {
    throw new Error("Current user information is unavailable");
  }
}

async function createTask(data) {
  if (!context) {
    throw new Error("Current user information is not initialized");
  }

  return window.Magic.db.createRow(
    TASK_TABLE_ID,
    {
      ...data,
      creator_name: context.userName, // UI display only; backend ownership uses system created_by.
    },
    ["id", "title", "status", "created_by", "creator_name", "created_at", "updated_at"]
  );
}

function canEdit(row) {
  return Boolean(context?.userId && row.created_by === context.userId);
}
```

---

## MagicBase Dynamic Permissions

MagicBase `dynamic_permissions` are the backend security boundary. Frontend filters, hidden buttons, and `canEdit()` checks are only product experience safeguards. They must not be treated as the only permission control when the user asks for private, owner-only, organization-shared, department-shared, read-only, or restricted-edit data.

Before creating a table for a multi-user data app, split the permission intent into four questions and reflect the answer in the `micro_app_plan` assumptions and `create_magicbase_table.dynamic_permissions`:

1. Who can read rows?
2. Who can insert rows?
3. Who can edit rows?
4. Who can delete rows?
5. Is the permission rule enforceable by MagicBase scopes/static permissions, or does it require backend business logic?

If the user gives partial permission intent, infer the missing parts with the least-privilege default that still satisfies the product loop, and state the assumption in the plan. Do not omit `dynamic_permissions` for data that has ownership, privacy, collaboration, organization, department, review, or read-only semantics.

Pass `dynamic_permissions` as a nested object in the tool arguments, not as a JSON string. Do not stringify it or wrap the object in quotes. If the tool rejects `dynamic_permissions` with "expected object", retry with the same permission intent as an object; do not remove the permission field or fall back to a public table.

### Permission feasibility boundary

Before promising a permission feature, classify it in the plan as one of:

- `enforceable_by_magicbase`: MagicBase can enforce it with table, row, column, and static permissions.
- `ui_only_not_secure`: The HTML app can hide buttons, disable fields, or filter lists, but users could bypass the UI and call MagicBase directly. This is product guidance only, not security.
- `requires_backend`: The rule needs custom backend logic or an extension to the MagicBase permission model. Do not generate a front-end-only app while claiming the permission is secure.

When the request contains `ui_only_not_secure` or `requires_backend` rules, tell the user before building or changing schema. If the user accepts a UI-only downgrade, state the downgrade explicitly in `micro_app_plan.assumptions` and do not describe it as enforced permission.

MagicBase can enforce these common cases:

- Table-level read/insert/manage access.
- Row access by built-in scopes: `public`, `private_user`, `private_department`, `private_org`, `disabled`.
- Creator-owned rows through system `created_by`.
- Organization/department sharing where the rule directly matches MagicBase scopes.
- Static grants to explicit users, departments, organization, or anonymous subjects for fixed tables, columns, or rows.
- Column read/edit restrictions that do not depend on row state or cross-table business logic.

MagicBase cannot enforce these cases in a pure HTML + MagicBase micro-app:

- State-dependent permissions such as "only approvers can edit while pending, everyone read-only after approved".
- Cross-table or relation-computed permissions such as "only users listed in the project members table can edit that project's tasks".
- Hierarchical business relationships such as "a direct manager can edit subordinate records".
- Conditional field permissions such as "finance can edit amount only when amount is greater than 10000".
- Time-window, quota, sequence, or workflow permissions such as "editable only within 10 minutes", "submit at most 3 times per day", or "must complete A before editing B".
- Sensitive domain operations that require authoritative validation, such as payments, approvals, inventory deduction, financial balance changes, points, credits, or settlement.

For those cases, use wording like:

```text
This permission depends on business logic that MagicBase cannot enforce in a pure front-end micro-app. I can implement UI hints such as hidden buttons or disabled fields, but that is not secure permission because users may bypass the UI and call MagicBase directly. To enforce it, add a backend endpoint or extend the MagicBase permission model.
```

Scope selection:

- `public`: public collaborative data that every permitted project user may access.
- `private_user`: only the row creator may read, edit, or delete. This uses MagicBase system `created_by`, not a dynamic `creator_user_id` column. Use this for personal records, my applications, my drafts, owner-only edit/delete, and creator-owned rows.
- `private_department`: users may access rows created by people in overlapping departments. Use only when the user explicitly asks for department-level isolation.
- `private_org`: users in the same organization may access the data. Use for organization-shared data.
- `disabled`: dynamic permissions do not grant access; use only when the app intentionally relies on static permissions or administrators.

Permission intent matrix:

When permissions are omitted, reads are public, table inserts are disabled, and row edits/deletes and column edits are creator-only (`private_user`). Enable inserts explicitly for submission flows. For shared editing of other users' rows, configure both row edit scope and the editable columns; a row grant alone does not override column permissions. Preserve these defaults unless the user's requested collaboration requires broader access. Existing explicitly saved permissions are not changed by these defaults.

| User intent | Table scope | Row scope |
| --- | --- | --- |
| Everyone collaborates and can edit/delete all rows | `read_scope=public`, `insert_scope=public` | `read_scope=public`, `edit_scope=public`, `delete_scope=public` |
| Everyone can read, only the creator can edit/delete | `read_scope=public`, `insert_scope=public` | `read_scope=public`, `edit_scope=private_user`, `delete_scope=private_user` |
| Each user can only access their own rows | `read_scope=public`, `insert_scope=public` | `read_scope=private_user`, `edit_scope=private_user`, `delete_scope=private_user` |
| Organization-shared rows | `read_scope=public`, `insert_scope=public` | Use `private_org` for read/edit/delete only where the user asks for organization-wide access; otherwise combine `read_scope=private_org` with `edit_scope=private_user` and `delete_scope=private_user` for creator-managed org data. |
| Department-shared rows | `read_scope=public`, `insert_scope=public` | Use `private_department` for read/edit/delete only where the user asks for department-wide access; otherwise combine `read_scope=private_department` with `edit_scope=private_user` and `delete_scope=private_user` for creator-managed department data. |
| Public intake form where submitters should not edit after submit | `read_scope=public`, `insert_scope=public` | Do not grant ordinary public edit/delete. Use `edit_scope=disabled`, `delete_scope=disabled`, or explain that administrator/explicit permissions are required for later review operations. |
| Admin-maintained data with ordinary user read-only access | `read_scope=public`, `insert_scope=disabled` unless users may submit | Do not use public edit/delete. Use `edit_scope=disabled`, `delete_scope=disabled`, or explicit manager/admin permissions. |

Correct `create_magicbase_table` pattern for a todo app where everyone can read all todos but only the creator can edit or delete:

```json
{
  "table_key": "tasks",
  "table_name": "Tasks",
  "description": "Team-visible todo tasks with creator-only edits",
  "columns": [
    {
      "column_key": "title",
      "column_name": "Title",
      "data_type": "text",
      "is_required": true
    },
    {
      "column_key": "status",
      "column_name": "Status",
      "data_type": "text",
      "is_required": true,
      "default_value": "pending"
    },
    {
      "column_key": "creator_name",
      "column_name": "Creator Name",
      "data_type": "text",
      "is_required": false
    }
  ],
  "dynamic_permissions": {
    "table": {
      "read_scope": "public",
      "insert_scope": "public"
    },
    "row": {
      "read_scope": "public",
      "edit_scope": "private_user",
      "delete_scope": "private_user"
    },
    "columns": {}
  }
}
```

Field-level permissions:

- System fields such as `created_by`, `organization_code`, `created_at`, and `updated_at` are not dynamic columns. They can be selected where supported, but must not be written in `createRow` or `updateRow`.
- Business ownership, assignment, review, status-transition, audit, and statistics fields should not be publicly editable unless the user explicitly asks for open collaboration.
- If a field is for display only, derived data, review state, ownership, or system-like metadata, either set an appropriate `dynamic_permission` for the column or do not render an edit control for it. Backend row permissions are still the security boundary.

If `query_magicbase_tables` or `get_magicbase_table` finds an existing table whose row permissions do not match the user's permission intent, use `update_magicbase_table_permissions` before claiming backend enforcement. Do not describe frontend filtering, hidden buttons, or disabled controls as secure permission enforcement unless MagicBase dynamic permissions are updated to match the requirement.

Destructive schema changes:

- `delete_magicbase_table` and `delete_magicbase_column` are destructive. Use them only after the user explicitly confirms the deletion in the approved plan or follow-up instruction.
- `update_magicbase_column` expects the complete desired column definition. Call `get_magicbase_table` first, preserve unchanged values, and then pass the final `column_key`, `column_name`, `data_type`, `is_required`, default value, and any field `dynamic_permission` that should remain in effect.

Schema tool reference:

- `query_magicbase_tables({})` — optional `table_key` and `table_name` filter exact matches. Returns `data.tables`, each with `table_id`, `table_key`, `table_name`, and columns.
- `get_magicbase_table({"table_id": "<id>"})` — returns the real `table_id`, columns with `column_id`, and current permissions.
- `create_magicbase_table({...})` — requires `table_key`, `table_name`, and `columns`; optional `description`, `project_name`, and `dynamic_permissions`. Every column needs `column_key`, `column_name`, and one of `text`, `number`, `datetime`, `boolean`, `json`. Returns the real `table_id`.
- `create_magicbase_column({...})` — requires the real `table_id` plus `column_key`, `column_name`, `data_type`; optional `is_required`, `default_value`, `dynamic_permission`.
- `update_magicbase_column({...})` — requires the real `table_id` and `column_id` plus the complete desired `column_key`, `column_name`, `data_type`, and `is_required`. Read the table first so unchanged values and existing field permissions are preserved.
- `update_magicbase_table_permissions({"table_id": "<id>", "dynamic_permissions": {...}})` — replaces the whole permission object; pass the complete object, not a partial patch.
- `delete_magicbase_table({"table_id": "<id>", "confirm_delete": true})` and `delete_magicbase_column({"table_id": "<id>", "column_id": "<id>", "confirm_delete": true})` — destructive; only after explicit user confirmation.

Schema tools also maintain `.magicbase/migrations.json` and refresh the MagicBase data model in `MICRO-APP.md`. Do not maintain those files with file-editing tools.

Agent-side row data operations:

- These tools execute through Magic Service with the current session user's `Authorization`, organization, and project context. They are subject to the same project role, table, row, column, dynamic, and static permission checks as ordinary MagicBase calls. They are not service-account or administrator bypasses.
- The project identity comes from the tool execution context and is checked against the persisted session. Never ask the model or user to provide `project_id`, `authorization`, `organization_code`, a share token, `created_by`, or other actor fields as tool arguments.
- Use `create_magicbase_row`, `update_magicbase_row`, or `batch_create_magicbase_rows` only when the user explicitly asks to import, initialize, backfill, correct, or enter real business data. Do not insert or edit demo rows merely to populate a generated page or verify CRUD.
- Row tool reference:
  - `query_magicbase_rows({"table_id": "<id>", "filter": {...}, "sort": [...], "page": 1, "page_size": 20, "select": [...]})` — `filter` uses operators without `$`, such as `{"status": {"eq": "open"}}`; `sort` uses `{"field": "created_at", "order": "desc"}`. Returns `data.total` and `data.rows`.
  - `get_magicbase_row({"table_id": "<id>", "record_id": "<id>", "select": [...]})` — returns one row.
  - `batch_get_magicbase_rows({"table_id": "<id>", "record_ids": ["<id>"], "select": [...]})` — returns up to 100 readable rows in requested ID order plus `data.missing_record_ids`; use it instead of repeated `get_magicbase_row` calls.
  - `create_magicbase_row({"table_id": "<id>", "data": {...}, "select": [...]})` — `data` holds only dynamic column keys.
  - `update_magicbase_row({"table_id": "<id>", "record_id": "<id>", "data": {...}, "select": [...]})` — `data` holds only the dynamic column keys that should change; never write system fields.
  - `batch_create_magicbase_rows({"table_id": "<id>", "rows": [...], "select": [...]})` — at most 200 rows per call; all rows are validated before the write begins.
  - `delete_magicbase_row({"table_id": "<id>", "record_id": "<id>", "confirm_delete": true})` and `batch_delete_magicbase_rows({"table_id": "<id>", "record_ids": [...], "confirm_delete": true})` — require explicit user confirmation.
- Before deleting, call `query_magicbase_rows` to resolve the exact real row IDs and show the user the deletion scope.
- Agent-side row mutations never update `.magicbase/migrations.json` or the MagicBase data-model section in `MICRO-APP.md`; those files describe schema, not business records.


---

## MagicBase Runtime Database API (`window.Magic.db`)

The HTML runtime database API only supports row-level operations on existing MagicBase tables. It does not create tables, create columns, or manage schema.

It also exposes the read-only administrator check for the current project:

```javascript
const access = await window.Magic.db.getProjectAdminAccess();
// { project_id: "...", is_admin: true|false }
```

This check uses the real logged-in user from `Authorization`. In a shared micro-app, the host may also send the share token so the backend can verify the shared project, but the share token/share creator is never treated as the current user.

For data-oriented micro-apps, treat MagicBase persistence as the default. Surveys, forms, todos, CRUD apps, small admin panels, dashboards, trackers, and any app with user-submitted, editable, collected, analytical, searchable, exportable, or reusable data should prepare a MagicBase table before generating HTML. Skip persistence only for pure showcase/static pages, pure calculators, apps with no user data, or when the user explicitly says not to save data.

The data model must serve the full approved product loop, not the smallest possible CRUD shell. Derive fields from the planned object, attributes, lifecycle state, category/grouping needs, notes/details, ordering, archive/deletion behavior, statistics, and filters. UI-only state should stay in JavaScript; anything needed for persistence, search, filtering, sorting, or later reuse belongs in MagicBase.

System fields are not dynamic business columns. MagicBase automatically maintains fields such as `id`, `record_id`, `created_at`, `updated_at`, `created_by`, `project_id`, `table_id`, and `organization_code`. HTML code may read, display, select, filter, or sort by supported system fields, but must not put system fields into the `data` object passed to `createRow` or `updateRow`. Only dynamic business fields that appear in the table's `columns` list as `column_key` may be written in `data`.

When `select` is omitted or empty, row APIs return all readable dynamic business fields plus these default row system fields: `id`, `record_id`, `organization_code`, `created_at`, `updated_at`, and `created_by`. When `select` is provided, the response is an exact projection: include every business or system field the UI needs.

When UI behavior depends on creator ownership, default queries already include `created_by`. If you provide an explicit `select` for `queryRows`, `getRow`, `createRow`, or `updateRow`, include `id`, all displayed business fields, `created_by`, `created_at`, and `updated_at` in that `select`. Compare `row.created_by` with `context.userId`; do not require a dynamic `creator_user_id` field unless the product has a separate business owner concept.

Canonical runtime signatures:

- `window.Magic.db.queryRows(tableId, query)`
- `window.Magic.db.createRow(tableId, data, select?)`
- `window.Magic.db.updateRow(tableId, recordId, data, select?)`
- `window.Magic.db.deleteRow(tableId, recordId)`

Never omit the first `tableId` argument. In particular, `updateRow(recordId, data, select)` is wrong and will not update the intended MagicBase table.

1. Call `query_magicbase_tables` to check whether the required table already exists.
2. If the table is missing, call `create_magicbase_table`; the tool automatically records migration history in `.magicbase/migrations.json` and refreshes the latest MagicBase data model in `MICRO-APP.md`.
3. If columns are missing, call `create_magicbase_column`; the tool automatically records migration history in `.magicbase/migrations.json` and refreshes the latest MagicBase data model in `MICRO-APP.md`.
4. Generate HTML only after you have a real `table.id` from MagicBase tools or from a successful reconciliation against MagicBase.

Never pass `table_key` or `table_name` as `tableId` to `window.Magic.db`. The HTML code must use the real table id returned by MagicBase tools.

Database API calls are automatically associated with the current project inside the iframe, so HTML code does not pass `projectId`.

### List tables `getTables()`

```javascript
const tables = await window.Magic.db.getTables();
// tables: [{ id: "1234567890", name: "users", ... }, ...]
```

- Return: `Promise<Array<{ id: string; name: string; ... }>>` — table summaries

### Get table details `getTable(tableId)`

```javascript
const table = await window.Magic.db.getTable(TABLE_ID_FROM_MAGICBASE_TOOL);
// table: { id: "1234567890", name: "users", fields: [...], ... }
```

- Parameters: `tableId: string` — 表 ID
- Return: `Promise<object>` — table details, including field definitions

### Create a row `createRow(tableId, data, select?)`

```javascript
const newRow = await window.Magic.db.createRow(TABLE_ID_FROM_MAGICBASE_TOOL, {
  name: "Alice",
  age: 30,
  email: "alice@example.com",
}, ["id", "name", "email", "created_at", "updated_at"]);
// newRow: { id: "rec_yyy", name: "Alice", age: 30, ... }
```

- Parameters: `tableId: string`、`data: Record<string, unknown>`、`select?: string[]`（可选，指定返回字段）
- Return: `Promise<object>` — the created row
- The `data` object must contain only dynamic column keys from the actual table schema. Do not write `created_at`, `updated_at`, `id`, `record_id`, `created_by`, `project_id`, `table_id`, or `organization_code` into `data`; omit `select` for the default response fields or request specific system fields through `select` if you need a custom projection.
- Match values to the MySQL-like column type. For `json` columns, pass arrays/objects directly; do not stringify or join arrays before calling `createRow`.

### Query rows `queryRows(tableId, query)`

```javascript
const result = await window.Magic.db.queryRows(TABLE_ID_FROM_MAGICBASE_TOOL, {
  filter: { name: { eq: "Alice" } },
  sort: [{ field: "created_at", order: "desc" }],
  select: ["name", "email"],
  page: 1,
  page_size: 20,
});
// result: { list: [...], total: 42, page: 1, page_size: 20 }
const rows = result.list;
```

- Parameters: `tableId: string`、`query: object`
  - `filter?` — 过滤条件。Use MagicBase operators without `$`: equality is `{ field: { eq: value } }`, inclusion is `{ field: { in: [value1, value2] } }`. Do not use Mongo operators such as `$eq`, `$in`, or `$contains`; unsupported operators are ignored by the current backend.
  - `sort?` — 排序规则。Use `{ field: "created_at", order: "desc" }`; the backend reads `order`, not `direction`.
  - `select?: string[]` — 返回字段列表
  - `page?: number` — 页码（默认 1）
  - `page_size?: number` — 每页行数（默认 20）
  - `with?` — 关联查询配置
- Return: `Promise<{ list: Array<object>; total: number; page: number; page_size: number }>` — 分页结果。行数组字段是 `list`，不要使用 `rows`
- **超时**：30 秒（其他操作为 15 秒）
- If `select` is omitted or empty, each row includes all readable dynamic business fields plus `id`, `record_id`, `organization_code`, `created_at`, `updated_at`, and `created_by`.
- If the UI enables or disables actions based on creator ownership and you provide an explicit `select`, it must include `id`, the displayed business fields, `created_by`, `created_at`, and `updated_at`.

Use this defensive read pattern when handling existing or uncertain runtime responses:

```javascript
const result = await window.Magic.db.queryRows(TABLE_ID_FROM_MAGICBASE_TOOL, {
  page: 1,
  page_size: 100,
});
const rows = Array.isArray(result?.list)
  ? result.list
  : Array.isArray(result?.data?.list)
    ? result.data.list
    : [];
```

Prefer `result.list` in new code. The `result.data?.list` fallback is only a compatibility guard for uncertain host responses. Do not use `result.rows`.

### 获取单行 `getRow(tableId, recordId, select?)`

```javascript
const row = await window.Magic.db.getRow(TABLE_ID_FROM_MAGICBASE_TOOL, "rec_yyy");
```

- Parameters: `tableId: string`、`recordId: string`、`select?: string[]`
- Return: `Promise<object>` — 行数据

### Update a row `updateRow(tableId, recordId, data, select?)`

```javascript
const updated = await window.Magic.db.updateRow(TABLE_ID_FROM_MAGICBASE_TOOL, "rec_yyy", {
  name: "Bob",
  age: 25,
}, ["id", "name", "age", "updated_at"]);
```

- Parameters: `tableId: string`、`recordId: string`、`data: Record<string, unknown>`、`select?: string[]`
- Return: `Promise<object>` — the updated row
- Do not call `updateRow(recordId, data, select)`. The first argument must always be the real MagicBase table id, followed by the row/record id.
- The `data` object must contain only dynamic column keys from the actual table schema. Do not write system fields such as `updated_at`; MagicBase updates them automatically and they can be returned through `select`.
- Match values to the MySQL-like column type. For `json` columns, pass arrays/objects directly; do not stringify or join arrays before calling `updateRow`.

### Delete a row `deleteRow(tableId, recordId)`

```javascript
await window.Magic.db.deleteRow(TABLE_ID_FROM_MAGICBASE_TOOL, "rec_yyy");
```

- Parameters: `tableId: string`、`recordId: string`
- Return: `Promise<void>`

### 获取relation list `getRelations()`

```javascript
const relations = await window.Magic.db.getRelations();
```

- Return: `Promise<Array<object>>` — 当前项目的表relation list

### Database error handling

```javascript
try {
  const row = await window.Magic.db.getRow(TABLE_ID_FROM_MAGICBASE_TOOL, "rec_notfound");
} catch (err) {
  console.error("Database operation failed:", err.message);
  // 可能的错误：
  // - "No project selected" — 未选中项目
  // - "getRow: tableId must be a non-empty string" — 参数校验失败
  // - HTTP 错误信息（404, 500 等）
}
```

---
