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

## Model Context

When `<media_model_info>` contains a `<video ...>` entry:
- pass its `model` value as `model_id`
- use declared `size` values only; if the user does not specify a size, use `default_size`
- use declared `duration` values only; if the user does not specify duration, use `default_duration`
- use `<mode>` / `<rule>` nodes to choose reference fields and avoid unsupported combinations
- when using a `<mode>`, pass its `name` as `input_mode` and its `task` as `task`; for example `name="video_edit"` means `input_mode="video_edit"`, not `inputMode` or `video_editing`
- `width` and `height` are canvas layout size, not the real generation size; keep them consistent with `size`

## Reference Tokens

When using reference assets, bind them inside `prompt` by list order:
- `reference_image_paths[0]` -> `[image1]`, `reference_image_paths[1]` -> `[image2]`
- `reference_video_paths[0]` -> `[video1]`, `reference_video_paths[1]` -> `[video2]`
- `reference_audio_paths[0]` -> `[audio1]`, `reference_audio_paths[1]` -> `[audio2]`

Use these tokens next to the subject, action, or source media they control. Do not put file paths in `prompt`; file paths still belong in the reference path arrays.

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
    "model_id": "model-from-media-model-info",
    "tasks": [{
        "name": "launch_video",
        "prompt": "A phone slowly rotates on a minimal stage, push-in camera, soft rim light, commercial ad look",
        "width": 1280,
        "height": 720,
        "size": "1280x720",
        "duration_seconds": 5
    }]
})
print(result)
```

## Video Edit Mode Example
```python
from sdk.tool import tool

result = tool.call('generate_canvas_videos', {
    "project_path": "my-design",
    "model_id": "model-from-media-model-info",
    "tasks": [{
        "name": "edited_video",
        "prompt": "Turn the reference video [video1] into a watercolor animation while keeping the original motion",
        "width": 1280,
        "height": 720,
        "input_mode": "video_edit",
        "task": "edit",
        "reference_video_paths": ["videos/source.mp4"],
        "duration_seconds": 5
    }]
})
print(result)
```

## Add Priority Parameters Only When Needed
```python
from sdk.tool import tool

result = tool.call('generate_canvas_videos', {
    "project_path": "my-design",
    "model_id": "model-from-media-model-info",
    "tasks": [{
        "name": "launch_video",
        "prompt": "A phone [image1] slowly rotates on a minimal stage, push-in camera, soft rim light, commercial ad look",
        "width": 1280,
        "height": 720,
        "size": "1920x1080",
        "duration_seconds": 5,
        "reference_image_paths": ["images/reference.png"]
    }]
})
print(result)
```
