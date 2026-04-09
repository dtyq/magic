# Initial Canvas Video Generation

Use `generate_canvas_videos` to handle both placeholder creation and job creation.

## Confirm Before Generating

- If the user is only asking about capability ("can you?", "is it possible?"), confirm and ask for content details first; do not start generating
- If the user says "I want to generate a video" without describing the content, ask for details before calling any tool
- Only call generation tools when the user has expressed clear content intent and willingness to proceed

## Timeout

Video tool calls automatically use long timeouts. Do not reason about or pass timeout values manually.

## Required Parameters
- `project_path`: design project path
- `tasks`: task list, each task needs `name`, `prompt`, `width`, `height`; max 4 per call

## Priority Parameters
- the generation goal itself
- user-requested size/resolution intent
- user-requested duration intent
- reference inputs such as reference images or start/end frames

## Non-Priority Parameters
- leave them empty by default when the user did not explicitly ask for them
- do not fill every optional field "just in case"

## Recommended Prompt Content
- subject
- action
- camera language
- lighting, style, pacing

## Example
```python
from sdk.tool import tool

result = tool.call('generate_canvas_videos', {
    "project_path": "my-design",
    "tasks": [{
        "name": "launch_video",
        "prompt": "A phone slowly rotates on a minimal stage, push-in camera, soft rim light, commercial ad look",
        "width": 1280,
        "height": 720
    }]
})
print(result)
```

## Add Priority Parameters Only When Needed
```python
from sdk.tool import tool

result = tool.call('generate_canvas_videos', {
    "project_path": "my-design",
    "tasks": [{
        "name": "launch_video",
        "prompt": "A phone slowly rotates on a minimal stage, push-in camera, soft rim light, commercial ad look",
        "width": 1280,
        "height": 720,
        "size": "1920x1080"
    }]
})
print(result)
```
