# Canvas naming

Load for renaming Canvas titles or actual image files. Use Canvas tools in Code mode and print `result.content`. Query exact Element details first; keep every returned ID and project path.

An Element has one shared Canvas title. Each Content is a version that may reference a distinct file; multiple Contents may also share one file. `generation_name` is the original generation input, or an expected name while generating. It is not the current filename. `can_rename_file` and `file_rename_reason` describe whether a version has a manageable file; final server permission and identity checks still apply. `file_name`, `file_id` and `file_exists` describe the actual Workspace file at the persisted media path.

## rename_canvas_elements

Required: `project_path`, `items`. Each item has an exact `element_id` and one or more of:

- `canvas_title`: change only the shared Canvas title. Works while generating.
- `files`: entries with exact queried `content_id`, `file_id`, `expected_file_name`, and target `file_name`. Change only those actual image files; mismatched original identity/name requires a new query. The original extension is retained; supply the basename or the full name with that same extension. Generating versions have no renameable file yet.
- `all_versions_base_name`: completed versions receive `<base>_v1.<ext>`, `<base>_v2.<ext>` in original Content order. Generating versions are skipped and reported. Do not combine this field with `files`.

For a single image, change title only, file only, or provide both explicitly. Never infer filename changes from a non-default Canvas title. All-version filename changes do not change the shared title unless `canvas_title` is also provided.

For a single-version image requesting both changes, keep its original title if the file change fails or is skipped. For a multi-version image, its shared title is independent: apply the title and report each file outcome separately. Successful changes remain reported; there is no cross-service rollback. A generating Element's title can be changed alone.

For several independent images, supply ordered `items` containing `element_id` and `batch_naming={base_name, target, start_number, digits}`. `target` is `title`, `file` or `both`; defaults are `start_number=1`, `digits=2`. The program produces `<base>_01`, `<base>_02`, etc., retaining each extension. Do not supply explicit names in the same request. For existing multi-version Elements and a file target, each item must explicitly specify `file_scope=current|all`; `all` uses the original version indices, e.g. `<base>_01_v1.png`. Do not infer all versions from a batch request.

The tool checks duplicate target names in the batch and other files in each actual directory. Conflicts are rejected; do not overwrite, append arbitrary suffixes or use shell/file rename to bypass the result. A shared file receives one name, and its current project references follow the successful rename. Provider `asset://` references and external files are not local files; import unresolved resources before file management. Do not promise global cross-project path repair.

### Title only

```python
from sdk.tool import tool
result = tool.call("rename_canvas_elements", {
    "project_path": "Demo", "stage": "execute",
    "items": [{"element_id": "element-A", "canvas_title": "Character reference"}],
})
print(result.content)
```

```python
result = tool.call("rename_canvas_elements", {
    "project_path": "Demo", "stage": "prepare",
    "items": [{"element_id": "element-A"}, {"element_id": "element-B"}],
    "batch_naming": {"base_name": "Character", "target": "both", "start_number": 1, "digits": 2},
})
print(result.content)
```

### Batch filenames

1. Call `stage=prepare` with the complete requested `items` and any `batch_naming`. Read the exact before/after comparison and skipped versions. Preparation makes no changes.
2. Outside Code mode, call the main Agent's direct `ask_user` with ordinary `questions` XML describing that exact comparison, for example `<question type="confirm">Rename A.png to Release_01.png and B.png to Release_02.png? Image content stays unchanged.</question>`. Omit timeout and wait for the user's answer.
3. Judge the answer: execute the same `items` and `batch_naming` only after explicit agreement. Do not treat rejection, skipping, timeout or an unclear answer as agreement. If the requested scope changes, query and prepare the new scope before asking again.

```python
from sdk.tool import tool
result = tool.call("rename_canvas_elements", {
    "project_path": "Demo", "stage": "prepare",
    "items": [{"element_id": "element-A", "all_versions_base_name": "Character reference"}],
})
print(result.content)
```

One completed file can be renamed with `stage=execute` without adding a batch confirmation; the user's concrete rename request must still identify the intended version and name. `stage=prepare` is available for inspecting that change.

Read per-item outcomes even when `ok` is false. If the file was renamed but Canvas references could not be saved, do not repeat the rename. Use `stage=recover` with the returned `recovery_tool_call_id` to repair references only, after the tool verifies the unchanged actual file identity. The recovery ID locates actual execution outcomes, not user authorization. Failed or unknown file writes must be re-queried before any new preparation. Canvas and file metadata do not form a cross-service transaction; do not claim rollback or atomicity.
