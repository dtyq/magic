# Basic Canvas video generation

Use this reference as the default Canvas video path. For video tasks, read and follow only this reference by default. Read and follow `references/professional-video-production.md` only when the user explicitly states that they want to use the professional video-production capabilities in that document.

## Workflow

1. Understand the subject, action, scene, camera, style, duration, aspect ratio, resolution, model, and requested audio. If a reference is a provider-managed asset URI such as `asset://virtual-human-asset-id`, treat it as an opaque generation input: do not call `visual_understanding`, do not try to resolve it as a local file, and do not import it into Canvas. Only inspect a reference when it is an actual workspace media path or an accessible image URL, and skip the call when the image is already visible in your context.
2. Present one concise generation target and complete prompt before generating. Ask only about unresolved choices that materially affect the result.
3. Generate one video Element directly through the basic Canvas video-generation path.
4. Use the same direct media pattern as basic image generation: the generated video is the result, and no storyboard, initialization image, shot reference image, `video-edit`, final composition, or professional-production Connection is created.
5. Use `row_incremental` layout unless the user provides exact coordinates.
6. Keep reference paths as generation inputs only. Do not convert them into business Connections.
7. Decide whether the completed media is needed immediately. Wait for the asynchronous generation task when the next step or the final response depends on the output; otherwise return the submitted state, preserve its exact IDs, and continue independent work without waiting.

Video billing remains in force. Before generating, call `estimate_canvas_content_points`, show the estimated points, and obtain explicit user confirmation. This is a workflow instruction; the estimate tool and generation tool are independent, and generation does not validate an estimate ID.

Video generation, revisions, retries, and additional candidates may consume points or money. After a successful video, let the user review it; a successful video you personally dislike is not a failure. Follow the core user-confirmation rule before any additional video call.

Continue using this basic video-generation path unless the user explicitly states that they want to use the professional video-production capabilities in `references/professional-video-production.md`.

## Tool choice

- Point estimate: `estimate_canvas_content_points` with `production_rule="video_generation"`.
- New logical video: `add_canvas_elements`, `element_type=video`, Content `source=generated`, `content_type=video`.
- New candidate on an existing Video Element: `add_canvas_contents`.
- Wait for asynchronous generation when the completed result is needed: `wait_canvas_generation` with the exact returned `generation_task_id`.
- Verify the result: `query_canvas_element_details` with the exact returned `element_id`.
- The first Content of any Video Element is automatically main. For a later candidate appended to an existing Video Element, call `select_canvas_main_content` only after explicit user confirmation.

Read only `result.content` from every Code Mode tool result. Reuse the exact IDs and paths shown there; do not guess them.

## Generation inputs

Fill the point-estimate request with the fields listed by the estimate tool. Do not add `audioPolicy` to the estimate request. For the actual generated video Content, set `content.audioPolicy` only when the requested audio behavior must be explicit; omit it when the user did not specify an audio requirement.

For a generated video Content, the supported generation fields are `prompt`, `model_id`, `name`, `input_mode`, `task`, `reference_image_paths`, `reference_video_paths`, `reference_audio_paths`, `frame_start_path`, `frame_end_path`, `size`, `duration_seconds`, `aspect_ratio`, `resolution`, `fps`, `seed`, `watermark`, `draft`, and the conditional `audioPolicy` field. Use `audioPolicy="mute"` for a silent result or `audioPolicy="generate"` when generated audio is explicitly requested. Use `audioPolicy="auto"` only when the model rules require an explicit default. Missing audio capability metadata means unknown, not unsupported; do not claim that narration or audio is impossible unless the model explicitly declares audio output unsupported. Distinguish generated voice from recording the user's real voice. This field belongs directly under `content`; it is not a prompt instruction and it is not an estimate parameter.

Before submitting a generated video, check the user request for voiceover, dubbing, narration, spoken lines, dialogue, sound effects, or ambient sound. If any of those are present, keep the complete text, speaker or voice, tone, and sound description in `prompt`, state that the video must include those sounds, and set `content.audioPolicy="generate"`. Do not let the visual description replace or drop those audio requirements, and do not use `mute` or omit the field. If the user asked for a silent result, set `mute`. If no audio behavior was requested, omit `audioPolicy`. Never pass `generate` on `task="compose"`; composition uses `output.audioPolicy` as `preserve` or `mute`.

Before submitting, validate the complete nested shape and keep the operation identity stable:

```python
from sdk.tool import tool

result = tool.call("add_canvas_elements", {
    "project_path": "Demo",
    "items": [{
        "item_ref": "product-promo-video",
        "element_type": "video",
        "name": "Product promotional video",
        "layout": {"strategy": "row_incremental"},
        "content": {
            "source": "generated",
            "content_type": "video",
            "name": "Product promotional video",
        },
    }],
})
print(result.content)
```

`name` and `content_type` are required for every generated video Content, including an appended candidate. The exact original `item_ref` must be reused for an approved retry; do not create a retry suffix or a new item identity.

- Provide `name` in the user's language using a concise 3-5 word description of the actual video. The saved file uses this model-provided name plus one short unique value.
- Use only model, duration, aspect ratio, resolution, and mode values declared in the current `<media_model_info>`.
- Omit optional parameters when the user did not request them and the current model rules do not make a legal choice clear.
- Bind every reference asset inside the prompt by array order: `[image1]`, `[video1]`, and `[audio1]`. These binding tokens are part of the final prompt and must already be present before point estimation.
- For each bound reference, say what it governs and how strictly, e.g. "the woman from [image1], face and outfit exactly as in [image1]" or "follow the camera movement of [video1]". The video model sees the reference itself; restating its look in your own words adds your misreadings as instructions it also follows. Name a detail only when the user stressed it, it is the thing changing, it is small and easily lost (a logo, label text), or you must pick one of several subjects, and point to it in the reference instead of re-describing it.
- With `frame_start_path`, the first frame already fixes the subject and scene; spend the prompt on motion, camera, and what happens next.
- Do not put file paths in the prompt. Paths belong in their corresponding reference arrays.
- Use `frame_start_path` and optional `frame_end_path` for a start/end-frame transition; do not duplicate those files in `reference_image_paths`.
- Use `task="edit"` and `input_mode="video_edit"` only for an explicit video-to-video edit.

## Draft mode

Only when `<media_model_info>` declares a `draft` capability, and only when the user asks for a draft or preview; otherwise never send `draft`.

- Send `content.draft=true` together with `content.resolution` set to the `draft` capability's declared resolution (e.g. `480p`) — never any other resolution.
- Draft and final are separately billable; estimate and confirm each on its own.
- After the draft completes, tell the user they can approve it and render the final at full resolution from the canvas; never submit that render yourself.
- The final render (`input_mode="draft_task"`) inherits the draft's prompt, references, and duration — only the resolution changes, and it carries no references or frames of its own.

## Code Mode example: estimate

The estimate is side-effect free. Build and freeze the exact final request first, including all reference binding tokens and prompt constraints, then show `estimate.content` to the user and end the turn. Do not submit generation until the user confirms the parameters and points in a later message. After confirmation, call generation with the same request fields; do not pass an estimate ID. If the prompt, reference list, or any billable field changes, call the estimate again and request a new confirmation. The generation tool does not compare the request with the estimate.

For a retry of failed Content, keep the original generation request's `item_ref` unchanged. A retry is an operation on the existing Element and Content, not a new batch item. The retry tool does not accept an estimate ID.

```python
from sdk.tool import tool

estimate = tool.call("estimate_canvas_content_points", {
    "project_path": "Demo",
    "production_rule": "video_generation",
    "items": [{
        "item_ref": "product-promo-video",
        "name": "Product promotional video",
        "prompt": (
            "Show the confirmed product [image1] on a clean studio stage. "
            "The product slowly rotates while the camera makes a gentle push-in. "
            "Preserve the product shape, proportions, materials, colors, and logo. "
            "Premium commercial lighting, stable motion, no added text or watermark."
        ),
        "model_id": "model-from-media-model-info",
        "reference_image_paths": ["Demo/images/product.png"],
        "duration_seconds": 5,
        "aspect_ratio": "9:16",
        "resolution": "720p",
    }],
})
print(estimate.content)
```

## Code Mode example: generate after confirmation

Use the same `item_ref` and generation parameters as the estimate, including the prompt string byte-for-byte. The generation call does not need the estimate result ID and must contain the actual generation parameters. Basic Canvas video generation deliberately omits `connections` and uses `row_incremental` layout.

```python
from sdk.tool import tool

result = tool.call("add_canvas_elements", {
    "project_path": "Demo",
    "items": [{
        "item_ref": "product-promo-video",
        "element_type": "video",
        "name": "Product promotional video",
        "layout": {"strategy": "row_incremental"},
        "content": {
            "source": "generated",
            "content_type": "video",
            "name": "Product promotional video",
            "prompt": (
                "Show the confirmed product [image1] on a clean studio stage. "
                "The product slowly rotates while the camera makes a gentle push-in. "
                "Preserve the product shape, proportions, materials, colors, and logo. "
                "Premium commercial lighting, stable motion, no added text or watermark."
            ),
            "model_id": "model-from-media-model-info",
            "reference_image_paths": ["Demo/images/product.png"],
            "duration_seconds": 5,
            "aspect_ratio": "9:16",
            "resolution": "720p",
        },
    }],
})
print(result.content)
```

This example omits `audioPolicy` because the request has no audio requirement. When the user asks for narration, dialogue, or sound effects, keep that complete audio text in `prompt` and set `content.audioPolicy="generate"` on the generation call only.

## Code Mode example: wait and verify

When generation returns a task ID, wait only when the completed result is needed for a downstream operation, confirmation, or final response. If the user requested background submission or the next steps are independent, do not call the wait tool yet; report the submitted state and preserve the exact IDs. When waiting, `timed_out=true`, `pending`, `processing`, `queued`, and `running` only mean that the current wait did not observe completion. Continue with the same tool in bounded follow-ups using the same `generation_task_id`; never submit a duplicate generation and never enter retry unless the task or Content is explicitly `failed`.

```python
from sdk.tool import tool

wait_result = tool.call("wait_canvas_generation", {
    "project_path": "Demo",
    "tasks": [{
        "generation_task_id": "generation-task-id-from-result-content",
    }],
    "max_wait_seconds": 600,
})
print(wait_result.content)

details = tool.call("query_canvas_element_details", {
    "project_path": "Demo",
    "element_ids": ["element-id-from-result-content"],
})
print(details.content)
```

## Version rules

Follow the retry, waiting, and version rules in SKILL.md. Append a revision as a new candidate with `add_canvas_contents`; the first Content of a Video Element is already main.
