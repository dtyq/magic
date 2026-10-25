# Discovery data fields

`result.content` is the model-readable summary. `result.data` is for exact IDs, pagination, and bounded programmatic filtering. Service fields may be missing or null; inspect keys and a small sample before relying on a field. Do not print an entire page's data into model context.

List results use `items` and may include `page`, `page_size`, `total`, and `has_more`. Topic sidebar searches can additionally report `coverage_limit=999`; `total=999` does not prove that only 999 matches exist. File browsing may use `next_parent_ids` instead of page numbers.

- Projects: `id`, `project_name`, `workspace_id`, optional `workspace_name`, `created_at`, `updated_at`, and `last_active_at`. The last field is available on participated results and means this user's project activity, not a project edit. Owned project sorting uses `created_at` or `updated_at`; participated results are ordered by `last_active_at` descending.
- Topics: `id`, `topic_name`, `project_id`, `updated_at` when available. Topic-name search and recent-update listing use the sidebar endpoint; default listing is in creation order.
- Files: `id` or `file_id`, `file_name`, `project_id`, optional `relative_file_path`, `updated_at`, and type/size fields. A project-relative path is product metadata, not a sandbox path or browser link.

Magic Service currently sends these database times as strings without an offset in its Asia/Shanghai process timezone. The tool's readable summary adds `UTC+08:00`; raw `data` retains the source text. Interpret raw times using that source timezone when comparing them with a user's time window. If a field is absent, malformed, or the requested search exceeds the available pages or service cap, do not claim complete time coverage.

For an unfamiliar result, inspect only shape and a few values:

```python
from sdk.tool import tool

result = tool.call("list_projects", {"page_size": 5})
print(result.content)
if result.ok:
    data = result.data or {}
    print("page keys:", list(data.keys()))
    print("first item keys:", list(data.get("items", [{}])[0].keys()) if data.get("items") else [])
```
