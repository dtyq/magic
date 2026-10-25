# User info data schema

Read `result.content` first. Use `result.data` for precise identifiers or conditional coordination; do not print the entire profile.

The tool keeps profile fields at the top level. Its internal service response nests them under `user`; do not expect that nesting in the tool result.

| Field | Type | Meaning |
|---|---|---|
| `id`, `magic_id` | string | Authenticated user ID in the organization and account's Magic ID |
| `third_platform_id` | string | Original user ID in the current organization's connected source system; empty means not determined, including missing configuration, no usable mapping, or a lookup failure. If multiple distinct IDs are found, the service logs a warning and returns the first nonempty ID in query-result order. Not a credential or a cross-platform ID. Older responses may omit it. |
| `nickname`, `real_name`, `position`, `work_number` | string | Profile fields; empty means not provided |
| `email`, `phone`, `avatar_url` | string | Contact and avatar fields; phone is masked unless explicitly authorized |
| `departments` | array | Entries contain string `id`, `name`, and `path` |
| `organization` | object | String `code` and `name` |
| `captured_at` | string | Profile query time with an explicit timezone |
| `subscription` | object | Independent status and organization subscription fields |
| `points` | object | Independent status and the amount visible to the current user |

Subscription fields: `status`, `scope=organization`; successful queries have `captured_at`. Available plans provide `id` or `name`, and may include `plan_type`, `starts_at`, `ends_at`. A confirmed `none` has a query time but no plan fields. Missing validity dates do not establish an unlimited plan.

Points fields: `status`, `scope=current_user_visible`; `available` status provides numeric `available` and `captured_at`. Preserve the returned precision and sign. This amount follows the existing organization and member quota rules; it is not a separate personal wallet. Unsupported or unavailable sections omit the amount and successful query time.

Treat optional fields as potentially missing or empty. Upstream types can change; the query boundary validates the supported contract and may reject malformed data. Never convert missing, invalid, or failed points to zero.

```python
result = tool.call("get_user_info", {})
print(result.content)
if result.ok:
    data = result.data
    points = data.get("points", {})
    if points.get("status") == "available":
        visible_points = points["available"]
        # Pass this value to the next step only when that step requires it.
    else:
        print("No current points value is available.")
```

If a needed field is missing, inspect keys and types without exposing unrelated profile values:

```python
data = result.data or {}
print("Top-level keys:", sorted(data))
for key in ("organization", "subscription", "points"):
    section = data.get(key)
    print(key, type(section).__name__)
    if isinstance(section, dict):
        print("Fields:", sorted(section))
        print("Status:", str(section.get("status", "missing"))[:80])
```

Display timestamps as human-readable times with their timezone. The profile, subscription, and points can have different query times and are not a transactional snapshot. Do not derive a final task charge or settlement status from a balance difference.
