<!--zh
# 设计生视频续查

系统会在后台继续轮询视频进度、给用户推送消息，并主动把结果回报给 AI。
只有当用户明确要求查询进度时，才调用 `query_video_generation`。当视频任务已经返回 `queued` / `running` / `processing` 时，不要重建任务。

## 续查时优先复用的信息
- `operation_id` 是主输入
- `request_id`、`element_id`、`video_name`、`project_path` 是已知时再补

## 关键规则
- 默认依赖系统后台轮询，不要为了盯进度主动反复查询
- 画布场景中，尽量同时传 `project_path` + `element_id`
- 这样工具会自动把 `src`、`poster`、`status`、`generateVideoRequest` 回填到原 video 元素
- 如果结果仍是处理中，继续等待系统后台推进；只有用户再次明确要求查询时才再查

## 示例
```python
from sdk.tool import tool

result = tool.call('query_video_generation', {
    "operation_id": "op_123"
})
```

## 已知画布元素时再补信息
```python
from sdk.tool import tool

result = tool.call('query_video_generation', {
    "operation_id": "op_123",
    "project_path": "my-design",
    "element_id": "video_elem_1"
})
```
-->

# Canvas Video Follow-Up

The system keeps polling video progress in the background, pushes updates to the user, and proactively reports results back to the AI.
Only call `query_video_generation` when the user explicitly asks to check progress. When a video task is already `queued` / `running` / `processing`, do not recreate it.

## Prefer Reusing
- `operation_id` is the primary input
- add `request_id`, `element_id`, `video_name`, and `project_path` only when already known

## Critical Rules
- By default, rely on the system background polling instead of repeatedly querying just to watch progress
- In canvas scenarios, prefer passing both `project_path` and `element_id`
- This lets the tool backfill `src`, `poster`, `status`, and `generateVideoRequest` into the original video element
- If the task is still pending, let the system continue in the background and query again only when the user explicitly asks

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
