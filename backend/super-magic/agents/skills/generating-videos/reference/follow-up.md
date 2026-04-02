<!--zh
# 通用视频续查

系统会在后台继续轮询视频进度、给用户推送消息，并主动把结果回报给 AI。
只有当用户明确要求查询进度时，才调用 `query_video_generation`。当已有任务处于 `queued` / `running` / `processing` 时，不要重建任务。

## 必要信息
- `operation_id`
- 其余信息已知时再补，不要默认全传

## 关键规则
- 默认依赖系统后台轮询，不要为了盯进度主动反复查询
- 不要把“还没完成”当成失败
- 不要因为用户催进度就重新发起视频生成

## 示例
```python
from sdk.tool import tool

result = tool.call('query_video_generation', {
    "operation_id": "op_123"
})
```

-->

# General Video Follow-Up

The system keeps polling video progress in the background, pushes updates to the user, and proactively reports results back to the AI.
Only call `query_video_generation` when the user explicitly asks to check progress. When an existing task is `queued` / `running` / `processing`, do not recreate it.

## Required Information
- `operation_id`
- add the rest only when already known

## Critical Rules
- By default, rely on the system background polling instead of repeatedly querying just to watch progress
- Do not treat “not finished yet” as failure
- Do not create a new video job just because the user is asking for progress

## Example
```python
from sdk.tool import tool

result = tool.call('query_video_generation', {
    "operation_id": "op_123"
})
```
