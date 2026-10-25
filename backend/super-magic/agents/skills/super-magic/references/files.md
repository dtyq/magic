# Project files

Skill projects are discovered with `list_skills` / `get_skill`, not the ordinary project list. Follow [Skills](skills.md) for creation, project references and publication.

## Choose the project and access path

Use the sandbox's AGFS mounts for file contents. Product tools discover projects and file IDs and perform product-level organization. A product workspace is a grouping of projects, not a filesystem directory.

| Target | Content access |
| --- | --- |
| Current project | Existing `.workspace/` mount. File-tool relative paths resolve here: use `reports/summary.md`, not `.workspace/reports/summary.md`. |
| Another project needed for the task | Its absolute referenced-project mount path, after resolving the exact project and checking access as below. |
| Selected file that cannot be read through a mount | `prepare_project_files` returns a temporary local copy for reading; edits to that copy do not update the project. |

Do not enumerate or mount other projects for an ordinary current-project request. When the task needs another project:

1. Use an exact project ID from product context, a project mention, a tool result, or an unambiguous user-provided ID. Otherwise use `list_projects` with a narrow `keyword` and, when known, `workspace_id`. Search `scope="owned"` or `scope="participated"` as appropriate; the default owned list does not cover all collaborations. Resolve ambiguous names before writing. See [Projects](projects.md).
2. Prefer the absolute project path supplied by runtime context or the project mention. Otherwise use nonblank `AGENT_REFERENCED_PROJECT_MOUNT_BASE_PATH`; when absent, derive `<AGFS_FUSE_MOUNT_PATH>/magicfs/referenced-projects`. A blank or unset FUSE root defaults to `/mnt/agfs`. Inspect only these two settings through a sandbox shell tool if needed, not the full environment. Append the verified project ID as one path segment. Never infer an ID from a name or guess alternate project IDs or mount roots.
3. Check the exact project root with a filesystem `stat` through the sandbox shell tool, then browse only the needed directory. On a sandbox with the AGFS referenced-project resolver enabled, first access triggers authorization and lazy mounting. The parent `referenced-projects` directory is not an inventory of all accessible projects. Do not call mount administration endpoints, install FUSE, create a replacement local directory at a missing mount path, or change the current project's `.workspace` mount.
4. Use absolute paths for this project's file tools and document tools. Join only verified project-relative paths to that root; reject traversal outside it. Access to one project does not make a same-named path in another project equivalent.

Mounting uses the sandbox's existing user credentials; the service enforces permissions. A successful read or project listing does not establish edit permission. Published micro-app access can be read-only and limited to published files. Respect permission failures without changing credentials. A missing or inaccessible root can mean denied access, a mount limit, or an unavailable resolver; it does not prove the project is empty. In particular, an empty `list_dir` result alone does not prove that mounting succeeded.

## Find files across candidate projects

For a request such as "find last year's review presentation", first narrow candidate projects by relevant names and workspace using [Projects](projects.md). Use the returned `project_name` field for names, not `name`. Then call `search_project_files` once for that candidate group. It aggregates authorized metadata queries and pagination into one visible search card. Do not replace it with a loop calling `list_project_files` for every owned/participated project; each call creates a separate card and reading only page one gives incomplete coverage.

`search_project_files(projects, keywords, max_pages=20, max_results=100)` accepts:

- `projects`: 1–20 selected scopes. Each has `project_id`, optional `project_name` from discovery for display, optional `parent_id`, `page_size` (default 50, maximum 100), and optional opaque `next_parent_ids` for continuation. Do not repeat the same project/directory scope.
- `keywords`: 1–5 nonempty literal substrings, each at most 100 characters. Matching is case-insensitive; any keyword may match a file name or project-relative path. Directories are excluded. This is not a regular expression, content search, or server-side year/date filter.
- `max_pages`: a total budget across all scopes (1–50). Scopes take turns fetching pages so a large first project does not consume the whole budget before others are checked.
- `max_results`: 1–100 matching files to return. Searches also stop after about 45 seconds; an individual page request has a 15-second timeout. Failures in one scope preserve successful results from others. User interruption stops the search.

```python
from sdk.tool import tool

found = tool.call("search_project_files", {
    "projects": [
        {"project_id": "<candidate-project-id>", "project_name": "<name-from-discovery>"},
        {"project_id": "<another-candidate-project-id>", "project_name": "<name-from-discovery>"}
    ],
    "keywords": ["annual review", "performance review"],
    "max_pages": 20,
    "max_results": 30
})
print(found.content)
```

Use keywords in the user's language and relevant to the requested subject. Avoid adding a broad term such as `ppt` to every search: any-keyword matching would include unrelated presentations. Evaluate candidate results before expanding scope. A filename match does not establish the document's year; read selected files to confirm. Once the right project is identified, use its mount to inspect contents instead of searching all remaining projects.

Read `content` even on failure. `data.items` contains selected matches with exact file/project IDs and metadata. `data.search_scopes` records each scope's `project_id`, `project_name`, `parent_id`, `status`, successful `pages_scanned`, and opaque `next_parent_ids`. Status is `complete`, `pending` (not yet fully scanned), or `failed` (with `error_code`). `search_complete` only describes coverage of the requested scopes from their supplied starting cursors, not all accessible projects. A complete search with no matches differs from a failed or unfinished search.

When more coverage is necessary, make another aggregate call for only the relevant pending scopes, passing their `project_id`, `project_name`, `parent_id`, and `next_parent_ids` unchanged along with the same keywords. Do not pass response-only `status`, `pages_scanned`, or `error_code` as input. Do not restart completed scopes or treat a missing/repeated cursor as end-of-results. If `results_truncated` is true, some matches from already scanned pages were omitted; narrow the keywords or directory and search again, because continuing the cursor cannot recover those omitted matches. Report unsearched/failed scopes and omitted results rather than claiming an exhaustive search.

For a current-project filename lookup that needs only a local path, ordinary mounted filesystem search remains appropriate. Use `list_project_files` for deliberate directory browsing and exact IDs needed by copy/move operations, not as a substitute for aggregate discovery.

## Read and write mounted contents

Use `list_dir` for a narrow directory view, `read_files` for text, and the appropriate document/image tools for other formats. For other projects, pass the absolute path even to `list_dir`'s `relative_workspace_path` parameter. For example, after resolving an accessible project root and selecting an existing file:

```python
from sdk.tool import tool

# Current project: paths are relative to .workspace.
result = tool.call("read_files", {
    "operations": [{"file_path": "reports/summary.md", "offset": 0, "limit": 100}]
})
print(result.content)

# Another project: substitute its resolved absolute root, not a project name.
project_root = "<resolved-absolute-project-root>"
result = tool.call("read_files", {
    "operations": [{"file_path": project_root + "/reports/summary.md", "offset": 0, "limit": 100}]
})
print(result.content)
```

Create or update content with ordinary file tools such as `write_file(file_path, content)` and available edit tools. Read the existing content before a partial change; `write_file` replaces the whole file. The same operations work on an accessible other-project mount when the user has edit permission. Do not first copy the file into the current project just to edit it.

AGFS handles object upload and file metadata persistence for mounted writes. Do not also request `upload-token` or call a `save` endpoint: those belong to a separate direct-upload workflow. Keep the same target path for updates and write directly to the existing file; do not delete/recreate it or replace it with a temporary file via rename, which can change file identity. Generate intermediate artifacts on local runtime storage, then write only the intended deliverables to the target project mount.

Check each tool result and read back the changed portion when useful. Report write or synchronization errors; a local read-back alone is not an independent confirmation of remote synchronization. Do not claim a failed or uncertain write was saved, automatically redirect it into another project, or repeat it blindly. User-facing results should identify the project and project-relative file location. Internal mount paths are tool inputs, not browser links; use the separate `share` Skill when a browser-accessible link is needed.

## File metadata and organization

`list_project_files(project_id, parent_id=None, page_size=50, next_parent_ids=None)` browses one bounded metadata page. It can return names, project-relative paths, IDs, type, size, and update time. Pass opaque `next_parent_ids` back unchanged to continue; do not recurse through every directory by default. `get_project_file(file_id)` reads basic metadata for one file. Neither provides file content or a browser link. Metadata paths must be resolved against the selected project's mount before use with file tools.

For product-level organization, use the tools below with exact IDs from discovery. Prefer them for transfers between projects, rather than treating a cross-mount shell rename as one atomic operation.

| Tool | Arguments and effect |
| --- | --- |
| `create_project_directory` | `project_id, parent_id, name`: create a folder under an exact parent directory ID. |
| `rename_project_file` | `file_id, name`: rename a file or folder. Replacement names must fit within 255 UTF-8 bytes, including the extension. |
| `copy_project_files` | `project_id, file_ids, target_project_id, target_parent_id`: copy selected files; leave originals. |
| `move_project_files` | Same arguments as copy: transfer originals to the destination. |
| `delete_project_files` | `project_id, file_ids`: remove selected files using product semantics. |

For copy/move, `project_id` is the source, `target_parent_id` is the exact destination directory ID, and `file_ids` contains 1–100 selected IDs. Delete also accepts 1–100 IDs. Do not invent a root directory ID or substitute its project ID. Service authorization determines whether the operation is allowed in both source and destination. A request to collect material does not itself authorize moving or deleting originals; use copies when originals should remain.

### Follow asynchronous operations to their actual result

A successful tool invocation can mean the operation was accepted, not completed. Copy/move/delete may return a `batch_key`; the returned receipt, not the tool name, determines how to continue.

```python
from sdk.tool import tool

# Replace placeholders with IDs already selected from authorized discovery.
result = tool.call("copy_project_files", {
    "project_id": "<source-project-id>",
    "file_ids": ["<selected-file-id>"],
    "target_project_id": "<destination-project-id>",
    "target_parent_id": "<destination-directory-id>"
})
print(result.content)
batch_key = (result.data or {}).get("batch_key")
if batch_key:
    status = tool.call("get_file_batch_status", {"batch_key": batch_key})
    print(status.content)
    # This is one status check, not a guarantee of completion.
```

- With a `batch_key`, retain it and check `get_file_batch_status(batch_key)`. For `accepted`, `processing`, `waiting`, or `queued`, continue checking with pauses rather than a tight loop. If still running when you must return, report it as pending and retain the key for follow-up.
- For `success`, inspect any per-file statuses or errors before reporting what completed. Partial completion is not a rollback. After a transfer, refresh the affected directory metadata before relying on new IDs or paths.
- For `failed`, report the failure and any known completed items. For `not_found` or an unknown status, completion is unconfirmed; inspect source/destination state instead of immediately resubmitting.
- Without a batch key, require an explicit successful receipt or verified resulting state. `result.ok` alone is insufficient when the operation status is unknown.
- After a transport timeout, query the known batch key or inspect the relevant source/destination state before considering another mutation. Do not duplicate an uncertain copy, move, or deletion.

## Temporary downloads when mounted reading is unavailable

`prepare_project_files(project_id, file_ids, purpose)` downloads at most ten selected files, not directories, using the current user's authorization. Use it when mount access is unavailable or a reader specifically needs a local copy. It does not bypass denied file permissions. Limits are 20 MiB per file, 100 MiB per request, and 500 MiB retained locally.

Read `result.content`, then inspect `result.data["files"]`. Each successful entry has `status="prepared"` and an exact absolute `path`; failed entries carry a reason. Downloads live under `.runtime/super-magic-product-files/<request-id>/` with generated filenames. Use the returned path, not a reconstructed filename. For a selected text file:

```python
from sdk.tool import tool

prepared = tool.call("prepare_project_files", {
    "project_id": "<selected-project-id>",
    "file_ids": ["<selected-text-file-id>"],
    "purpose": "Read the selected report for the user's comparison"
})
print(prepared.content)
for item in (prepared.data or {}).get("files", []):
    if item.get("status") == "prepared":
        result = tool.call("read_files", {
            "operations": [{"file_path": item["path"], "offset": 0, "limit": 100}]
        })
        print(result.content)
```

For binary documents, pass the returned path to the corresponding document tool instead. Handle successes and failures separately. These are temporary copies, eligible for cleanup after 24 hours on a subsequent preparation. Editing one does not sync back to the source project. A requested persistent edit still requires a writable project mount; report unavailable access instead of claiming the temporary edit updated the original. Do not expose signed URLs, object keys, or temporary runtime paths as user deliverables.
