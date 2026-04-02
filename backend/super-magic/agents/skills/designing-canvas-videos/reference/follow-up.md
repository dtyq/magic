<!--zh
# 设计生视频续查

视频创建工具本身会先阻塞轮询，并在等待期间持续给用户发进度消息。
只有当创建工具已轮询到超时，且用户明确要求查询进度时，才调用 `query_video_generation`。当视频任务已经返回 `queued` / `running` / `processing` 时，不要重建任务。

## 续查时优先复用的信息
- `operation_id` 是主输入
- `request_id`、`element_id`、`video_name`、`project_path` 是已知时再补

## 关键规则
- 默认先让创建工具完成自己的轮询；不要为了盯进度主动反复查询
- 画布场景中，尽量同时传 `project_path` + `element_id`
- 这样工具会自动把 `src`、`poster`、`status`、`generateVideoRequest` 回填到原 video 元素
- 如果结果仍是处理中，说明上一次创建已轮询到超时；只有用户再次明确要求查询时才再查

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
