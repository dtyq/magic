# Canvas Video Follow-Up

The video creation tool itself blocks and polls first while sending progress updates to the user.
Only call `query_video_generation` after that creation flow has already timed out and the user explicitly asks to check progress. When a video task is already `queued` / `running` / `processing`, do not recreate it.

## Prefer Reusing
- `operation_id` is the primary input
- add `request_id`, `element_id`, `video_name`, and `project_path` only when already known

## Critical Rules
- By default, let the creation tool finish its own polling instead of repeatedly querying just to watch progress
- In canvas scenarios, prefer passing both `project_path` and `element_id`
- This lets the tool backfill `src`, `poster`, `status`, and `generateVideoRequest` into the original video element
- If the task is still pending, it means the previous creation flow timed out; query again only when the user explicitly asks

## Example
```python
from sdk.tool import tool

result = tool.call('query_video_generation', {
    "operation_id": "op_123"
})
```

## Add Canvas Details Only When Already Known
```python
from sdk.tool import tool

result = tool.call('query_video_generation', {
    "operation_id": "op_123",
    "project_path": "my-design",
    "element_id": "video_elem_1"
})
```
