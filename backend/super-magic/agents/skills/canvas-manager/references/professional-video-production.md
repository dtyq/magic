# Professional video production

This reference covers ordinary direct production, direct professional production, and detailed staged production with the current Canvas tools. Load it only after the video-intent decision rules in SKILL.md have already selected this workflow.

## When to use

Use this reference only when one of these is already true:

- The user explicitly asks for professional or complete video production.
- The user names a production capability such as a storyboard, multiple shots, shot reference images, staged approvals, Connections, BGM replacement, or final composition.
- The latest message names an explicit detailed or fine-grained generation mode, including `生成模式: 精细` or `generation mode: detailed`.
- The current Canvas already has an in-progress professional production and the user is continuing, revising, or finishing that work.
- This file was preloaded with the Skill as a dedicated video-production agent.

Do not load this reference for ordinary image or video generation. Requests such as “generate a video”, “make a promotional video”, or “animate this image” stay on `references/video-generation.md`, even when the user uploads assets, the Canvas already has ordinary images or videos, the user asks to revise a basic video, or the latest message names an explicit ordinary generation mode such as `生成模式: 普通`. Quality words such as “professional-looking”, “premium”, or “cinematic” describe output quality and never by themselves request this workflow. “Advertisement” alone never selects this workflow.

## Production modes

Inspect the latest user message for an explicit generation mode before inferring one. Ordinary, simple, or direct versus detailed or fine-grained — including a structured field such as `生成模式: 普通/精细` or `generation mode: ordinary/detailed` — is a hard constraint. It beats “advertisement”, uploaded assets, task complexity, and any Agent role. Never interpret “advertisement” alone as detailed staged mode.

When this reference is already selected and no explicit mode is present, select exactly one mode from the user's wording and the current task state:

- **Ordinary direct mode**: the user explicitly asks for ordinary, simple, or direct video production, or an explicit ordinary generation-mode field is present. Generate one final video directly with no storyboard, initialization images, shot reference images, `video-edit`, or separate final composition, while preserving direct business predecessors through explicit Connections.
- **Direct professional mode**: the user asks for professional video production without a detailed or staged workflow. Generate one final professional video directly, preserving direct business predecessors.
- **Detailed staged mode**: the user asks for detailed, fine-grained, staged, multi-shot production, or names storyboards, shot reference images, shot videos, staged approvals, BGM replacement, or final composition. Use all applicable stages below.

If a video-production task does not name a mode, use detailed staged mode. Do not silently switch modes during a task. If the user later requests a staged workflow after an ordinary or direct result, continue from the existing Canvas Elements and switch at the next incomplete stage.

All three modes share the same project binding, `result.content` reading, estimate gate for billed video, Content versioning, asset-reference, failure-recovery, and user-confirmation rules below.

### Ordinary direct mode

Use this mode when the user explicitly asks for a simple, direct, or ordinary video-production workflow, or when an explicit ordinary generation-mode field is present.

1. Understand all submitted assets and identify the subject, product treatment, scene, visual style, motion, pacing, audio expectation, duration, aspect ratio, resolution, model, and artifact exclusions.
2. Present one complete creative target and the final video prompt in readable Markdown. Ask one concise confirmation question after presenting it; ask again after any material revision.
3. Freeze the complete billable request, estimate points, and wait for explicit confirmation before submission.
4. After confirmation, create one `video` Element with `add_canvas_elements`, use `dependency_flow` layout for the production relation, put all used reference paths in the corresponding arrays, and add Connections only for submitted Canvas Elements that directly contribute to the final video. Reference-only assets stay in the arrays without a Connection.
5. Wait immediately on any returned generation task, query the completed Element, and present the candidate. The first Content of this newly created Video Element is automatically main, so do not ask whether to make it main or call `select_canvas_main_content`. For a revision appended to an existing Video Element, select the appended candidate as main only after user confirmation.
6. For a revision, append a candidate to the same Video Element with `add_canvas_contents`; do not create a duplicate logical Element. If the user asks for a storyboard, staged approvals, BGM replacement, or separate composition, preserve the current result and continue in detailed staged mode.

Example using the current Canvas tools:

```python
from sdk.tool import tool

estimate = tool.call("estimate_canvas_content_points", {
    "project_path": "Demo",
    "production_rule": "video_generation",
    "items": [{
        "item_ref": "direct-video",
        "name": "Product launch video",
        "prompt": "Create the confirmed 15-second product video from [image1] and [image2]. Preserve product identity and scene details. Smooth commercial motion, no text, watermark, captions, or interface artifacts.",
        "model_id": "model-from-media-model-info",
        "reference_image_paths": ["./images/product.webp", "./images/scene.webp"],
        "duration_seconds": 15,
        "aspect_ratio": "9:16",
        "resolution": "1080p",
    }],
})
print(estimate.content)
```

After the estimate is confirmed, submit the same `item_ref` and frozen request through `add_canvas_elements` with one generated `video` Content. Add only the confirmed direct predecessor Connections; do not change any billable prompt field after confirmation:

```python
result = tool.call("add_canvas_elements", {
    "project_path": "Demo",
    "items": [{
        "item_ref": "direct-video",
        "element_type": "video",
        "name": "Product launch video",
        "layout": {"strategy": "dependency_flow"},
        "connections": [
            {"source_element_id": "product-element-id"},
            {"source_element_id": "scene-element-id"},
        ],
        "content": {
            "source": "generated",
            "content_type": "video",
            "name": "Product launch video",
            "prompt": "Create the confirmed 15-second product video from [image1] and [image2]. Preserve product identity and scene details. Smooth commercial motion, no text, watermark, captions, or interface artifacts.",
            "model_id": "model-from-media-model-info",
            "input_mode": "image_reference",
            "task": "generate",
            "reference_image_paths": ["./images/product.webp", "./images/scene.webp"],
            "duration_seconds": 15,
            "aspect_ratio": "9:16",
            "resolution": "1080p",
        },
    }],
})
print(result.content)
```

### Direct professional mode

This is the default after the user asks for professional video production but does not request a detailed or staged workflow.

- Generate one final video directly.
- Preserve the direct business predecessor relations from the submitted source Elements.
- Do not create a storyboard, initialization images, shot reference images, a `video-edit`, or a separate final composition.
- The generated video Element is the final result for this mode.

Use the exact parameter confirmation, estimate, generation, wait, and later-candidate selection gates described below.

### Detailed staged mode

Use this mode only when the user explicitly asks for detailed, fine-grained, staged, or multi-shot production, or names workflow stages such as a storyboard, shot reference images, shot videos, staged approvals, BGM replacement, or final composition.

## Direct professional mode workflow

1. Understand the submitted assets and identify the intended subject, scene, motion, style, duration, aspect ratio, resolution, output model, and audio expectations.
2. Present one complete creative target and the final video prompt before generating anything. Ask one concise confirmation question for unresolved material choices.
3. Before calling `estimate_canvas_content_points`, freeze the complete final prompt and request, including every reference binding token and prompt constraint. Call the estimate with that exact request, then wait for explicit confirmation of the estimate.
4. After the estimate is confirmed, call `add_canvas_elements` once with one `video` Element and copy the estimated request byte-for-byte. Do not add `[imageN]` bindings, watermark instructions, or other prompt text after confirmation. If anything changes, estimate again and ask for confirmation again before generation. The generation tool does not receive or validate an estimate ID.
5. When a submitted Canvas Element is a direct business predecessor, add its exact Element ID in the new video's `connections`. Reference paths alone never create Connections.
6. Call `wait_canvas_generation` when the completed video is needed for the next professional-production step, user confirmation, or final response. If the current step has no dependency on the completed media, preserve the exact task ID and continue independent work without waiting.
7. Query the generated Element and present the candidate. Because this is the first Content of a newly created Video Element, it is already main; do not ask whether to make it main or call `select_canvas_main_content`. For a later appended candidate, select its main Content only after the user confirms it.

Do not create a storyboard, initialization image, shot reference image, `video-edit`, or final composition in this mode. If the user later requests staged production, continue from the existing result and switch to detailed professional mode without silently mixing the two workflows.

### Direct professional mode references

For a generated video Content, use `prompt`, `model_id`, `name`, `input_mode`, `task`, `reference_image_paths`, `reference_video_paths`, `reference_audio_paths`, `frame_start_path`, `frame_end_path`, `size`, `duration_seconds`, `aspect_ratio`, `resolution`, `fps`, `seed`, `watermark`, and `draft` as supported by the current `<media_model_info>`.

Bind reference assets in the prompt by array order:

- `reference_image_paths[0]` → `[image1]`, `reference_image_paths[1]` → `[image2]`
- `reference_video_paths[0]` → `[video1]`, `reference_video_paths[1]` → `[video2]`
- `reference_audio_paths[0]` → `[audio1]`, `reference_audio_paths[1]` → `[audio2]`

Place each token next to the subject, action, or source media it controls, and say what that reference governs and how strictly, e.g. "the presenter from [image1], face and outfit exactly as in [image1]". Do not put file paths in the prompt.

Use `task="edit"` and `input_mode="video_edit"` only for an explicit video-to-video edit. For prompt-only generation, omit reference arrays. For image, video, or audio references, populate the corresponding arrays and bind every reference in the prompt.

Keep one clear scene and one main action unless the user explicitly asks for a sequence. Cover the subject, action, scene, camera, lighting, pacing, and any requested sound, narration, or dialogue. Preserve requested narration or dialogue verbatim. When the user request or a confirmed storyboard includes voiceover, dubbing, narration, spoken lines, dialogue, sound effects, or ambient sound, keep the complete text, speaker or voice, tone, and sound description in the generation prompt, state that the video must include those sounds, and set `content.audioPolicy="generate"` on the direct video request. Do not let the visual description replace or drop those audio requirements, and do not use `mute` or omit `audioPolicy` in that case. Composition still uses `output.audioPolicy` as `preserve` or `mute`; never pass `generate` on a `task="compose"` request.

Use this reference-mode mapping for generated videos:

| Situation | `input_mode` | Required inputs |
|---|---|---|
| Prompt-only generation | `standard` | No reference paths or frame paths |
| One or more image references | `image_reference` | `reference_image_paths` and ordered `[imageN]` bindings |
| Fine-grained shot reference image | `omni_reference` | The confirmed shot image in `reference_image_paths`, bound as `[image1]` |
| Mixed image, video, or audio references | `omni_reference` | Matching reference arrays and ordered bindings |
| Start/end frame transition | `keyframe_guided` | `frame_start_path` and optional `frame_end_path`; do not duplicate as reference images |

If the current `<media_model_info>` does not declare a mode, do not use it. A reference path controls generation input; only an explicit Connection creates a Canvas business relation.

## Core rules

- Adapt the workflow to the current request and existing results; do not restart completed stages.
- Treat the current Canvas as the source of truth.
- Every confirmation is a hard gate: tool success is not user approval. Do not continue past a gate until the user confirms or requests a revision.
- Complete execution confirmation gates are mandatory: confirm the first completed shot reference image before generating the remaining shot reference images; confirm the first completed trial shot video before generating the remaining shots; and show the final Video Edit configuration, including `audioPolicy`, for confirmation before composing. A successful tool call, a returned task ID, or a completed query is not confirmation.
- Infer established facts and reasonable defaults before asking. Ask only about unresolved decisions that materially affect the result.
- Follow the language and terminology rules in the parent `canvas-manager` Skill. Keep user-facing video-production terms in one language; use the localized names for Canvas, Points, Elements, Content, Connections, Storyboards, Video Edits, audio, status, and estimated cost. Keep exact tool names, parameter names, IDs, paths, and protocol values unchanged in code and field references.
- Keep each task bound to its current Canvas project. If a tool fails, do not call `initialize_canvas`, invent a new project suffix, or change `project_path` to bypass the error. Recover in the current project: read the failure from `result.content`, inspect the referenced Element or Content, repair it with the available tools, and retry only after the repair is complete. If safe recovery is impossible, tell the user the blocking reason and stop.
- Do not repeat a paid image or video generation call speculatively. After a failure, first inspect and repair the current Canvas state or correct the referenced workspace path; regenerate only when the user has approved the revised generation or the retry is an exact, safe retry of the failed task.
- Before using `dependency_flow`, query every endpoint Element and compare its `parent_element_id`. Use this strategy only when all connected endpoints share the same direct parent. For cross-container endpoints, create the Elements with `row_incremental` or another valid non-dependent layout, then maintain the explicit business relation separately with `manage_canvas_connections` when the relation is required. Do not treat a layout validation error as a reason to reinitialize or move the project.

## Confirmation gates

- Infer established facts and reasonable defaults before asking questions, but ask about every unresolved choice that materially changes the result. Resolve no more than one to three related decisions in one confirmation round.
- Present a complete direction, storyboard, shot reference-image prompt collection, or other long-form material as readable Markdown in the assistant message. Then use `ask_user` with one concise question that does not repeat the displayed content.
- Treat direction approval, storyboard approval, shot reference-image prompt approval, initialization or shot reference-image candidate approval, the first trial video, edit configuration, and final composition as hard gates when they apply.
- A revision request is not approval. Keep the current candidate unconfirmed and ask again after the revised result returns. Image revisions default to independent Elements; use the same-Element candidate workflow for videos or explicitly requested image versions.
- After resuming from a pause or interruption, query the relevant Elements before continuing.

## Content versioning and retries

Follow the retry, waiting, and version rules in SKILL.md. Image revisions default to independent Elements; existing video version workflows remain unchanged.

- New logical result: omit `element_id` and `content_id` in `add_canvas_elements`.
- New candidate for an existing video, or explicitly requested image versions: pass the existing `element_id` and omit `content_id`; use `add_canvas_contents` when appending to that Element.
- Exact retry: use `retry_canvas_content_generation` with the exact `element_id`, `content_id`, and original `item_ref` returned by the latest result or query. Never add `-retry`, `-new`, or a counter to `item_ref`.
- A failed final composition is an in-place retry of the existing final Video Element and Content. Reuse their exact IDs; do not call `add_canvas_elements` to create a duplicate final-video Element.
- Never identify an existing result by name alone. Preserve every returned Element ID, Content ID, task ID, video ID, status, and media path.

## Asset and prompt fidelity

- Treat all submitted compatible assets as required source material by default. Use every relevant path in the appropriate reference array and map every materially contributing Canvas Element separately to direct Connections.
- Exclude an asset only when the user explicitly asks to ignore it or the current generation tool cannot accept its media type. If relevance is unclear, ask before omitting it.
- Before each generation call, verify that every used asset appears in the correct reference array, that direct Connections contain only the intended upstream Element IDs, and that any requested or storyboarded audio is still present in the prompt with `content.audioPolicy="generate"` on the direct video request.
- The generation model sees each reference directly; the prompt carries its role, not its appearance. Restating a referenced subject's look in your own words (skin, facial hair, glasses, clothing details) adds your misreadings as instructions the model also follows, and the result drifts from the reference. Name a detail only when the user stressed it, it is the thing changing, it is small and easily lost (a logo, label text), or you must pick one of several subjects, and point to it in the reference instead of re-describing it. With a first frame, the frame already fixes subject and scene; describe motion, camera, and what happens next.
- Reference media may contain watermarks, captions, interface marks, compression artifacts, unwanted backgrounds, or accidental crops. Preserve intended subject information but explicitly exclude those defects from generated prompts unless the user requests them.
- Use only model IDs, `input_mode`, task values, aspect ratios, resolutions, durations, FPS values, and other generation fields declared by the current `<media_model_info>`.

### Facial-expression constraints

- If the user says a person must have no facial expression, treat that request as a hard cross-stage visual constraint, not as a loose mood hint. Carry it from the confirmed creative direction into the saved storyboard, every shot reference-image prompt, every shot-video prompt, and any regenerated media that depends on those prompts.
- Record the constraint explicitly in each affected storyboard shot, for example: `Facial expression: completely neutral and expressionless.` Do not leave it implicit in the scene or action description.
- In each affected image or video prompt, use explicit appearance and exclusion language: `completely neutral, expressionless face; relaxed facial muscles; naturally closed mouth; no smile, frown, surprise, sadness, anger, laughter, eyebrow acting, or other visible emotion.`
- Do not weaken the requirement to `calm`, `serious`, or `neutral mood`, and do not assume that a reference image is expressionless. Preserve the reference subject's identity and other requested details, but override any smile or other visible expression with the confirmed no-expression constraint.

## Detailed production stages

### 1. Set up the Canvas

Create or reuse the project with `initialize_canvas`. Before importing any user-supplied image, video, or audio, query the current Canvas and resolve whether the asset is already represented by an existing Element.

When an existing video needs FFmpeg or another media transformation, complete the processing in a system temporary directory before importing the result into Canvas. Keep the Canvas workspace focused on persistent project assets and Canvas state. After processing, use the exact Canvas-importable media reference returned by the runtime capability, create a new Video Element, and connect it to the source video when that relationship is part of the production flow.

If the uploaded asset already has a matching Canvas Element and Content, reuse the exact Element ID, Content ID, and project-relative media path. Pass that path in the appropriate generation reference array and use the existing Element as a direct Connection only when it materially contributes to the requested output. Do not call `add_canvas_elements` to create a second imported Element. If the asset cannot be matched to an existing Canvas Element, import it with `add_canvas_elements` using `source=imported`.

Import user-supplied images, videos, or audio that need stable Element IDs with `add_canvas_elements` using `source=imported`.
For every imported root Element without an upstream source, pass `layout: {"strategy": "dependency_flow"}` explicitly. This keeps professional-production roots in a vertical root column; omitting `layout` invokes the generic horizontal `row_incremental` layout. After importing, query the returned Elements and verify their Element IDs, Content IDs, status, project-relative paths, and dimensions before continuing.

For imported media, the exact user-provided or runtime-returned import reference must be passed as `content.asset_path`. This is the tool input path, not the final Canvas `src`; the import service validates and materializes the file into the project's canonical media directory before storing its project-local `src`. Do not use `path`, `media_path`, `file_path`, or `src` as synonyms for `asset_path`.

Use this shape for each imported item. Replace the placeholder with the exact import reference returned by the runtime capability before calling the tool:

```python
from sdk.tool import tool

result = tool.call("add_canvas_elements", {
    "project_path": "Demo",
    "items": [{
        "item_ref": "import-product",
        "element_type": "image",
        "name": "Product reference",
        "layout": {"strategy": "dependency_flow"},
        "content": {
            "source": "imported",
            "content_type": "image",
            "asset_path": "<exact-import-reference-returned-by-runtime>",
        },
    }],
})
print(result.content)
```

If validation reports `Unknown parameter`, re-read the `add_canvas_elements` schema and use `content.asset_path`. If the runtime result is not importable, obtain a new import reference from the runtime media-processing capability before retrying. Never create `Project/imports/` as a manual staging area: the import service writes the returned image, video, or audio Content to `./images/`, `./videos/`, or `./audios/` respectively.

For a request such as “Remove the audio from this video,” use this operating instruction:

```text
Locate the video specified by the user and create a silent copy in a system temporary directory. After processing completes, use the importable media reference returned by the runtime capability to create a new Video Element, then connect the original video as its direct source. Use the new video's returned Canvas media path for later composition and editing while preserving the original video.
```

### 2. Understand the assets

Look at each asset to identify subjects, products, scenes, text, style, distinguishing details, defects, and factual constraints; call `visual_understanding` only for assets not already visible in your context. Separate direct observations from uncertain inferences. These observations drive planning, reference roles, and defect exclusion; they are not prompt text (see Asset and prompt fidelity).
Imported assets are original reference material only. They do not count as initialization visual anchors, storyboard shot reference images, or confirmed main Content unless a newly generated anchor has been created and confirmed through the stage below.
Treat uncertain brand marks, product categories, and feature claims as inferences rather than facts. If a requested selling point is not supported by the submitted assets, identify the gap and ask the user to confirm it before putting the claim into a generation prompt.

### 3. Confirm the creative direction

Draft a concise direction covering objective, subject, setting, story line, visual tone, opening, development, and ending. Display it as Markdown and confirm before creating media or saving a storyboard.

### 4. Generate and confirm initialization images

Generate only the visual anchors the direction requires: a character look, product hero, location, prop, or style reference.

This stage is mandatory before creating or saving a storyboard in detailed mode. Do not treat an imported asset as completion of this stage. If the direction appears to need no new anchor, state the reason and obtain explicit user confirmation before proceeding without one.

Before generating, confirm any missing aspect ratio, total duration, and output resolution. Suggest defaults but do not silently choose them.
Canvas node arrangement and final video aspect ratio are separate decisions. Do not infer the final video aspect ratio from the dimensions of one imported image.

Map every submitted source medium to its Canvas Element. Pass every media path as generation evidence and every owning Element as a direct upstream source — do not rely on prompt text alone to represent an imported subject.

Confirm each generated anchor before depending on it downstream; its first Content is automatically main, so no main-selection call is needed. If the user requests a change, create an independent Image Element by default, confirm it, and use its exact ID/path as the revised anchor. Append inside the original Element only when the user explicitly requests image versions; that later candidate requires confirmation before selecting main.

The confirmation sequence is mandatory: generate the initialization candidate, wait for completion, query its Element, show or summarize the candidate, call `ask_user`, and wait. A successful tool result or visual inspection is not user approval.

### 5. Draft, confirm, and save the storyboard

Draft about four shots when no count is specified (fewer for simple tasks). Each shot covers its name, scene, framing or camera, action, and focus. Keep the storyboard focused on creative direction. If the user requested no facial expression, include the confirmed facial-expression constraint in every affected shot description.

Display and confirm the complete shot plan before saving. Save the confirmed shot descriptions as a storyboard Content:

```python
tool.call("add_canvas_elements", {
    "project_path": "Demo",
    "items": [{
        "item_ref": "storyboard",
        "element_type": "storyboard",
        "name": "Product launch storyboard",
        "layout": {"strategy": "dependency_flow"},
        "content": {
            "source": "user",
            "content_type": "storyboard",
            "generationConfig": {
                "model_id": "confirmed-image-model",
                "size": "1600x900",
                "resolution": "2K",
                "aspect_ratio": "16:9",
            },
            "shots": [
                {"id": "S01", "description": "Shot: reveal — Scene: dark stage — Camera: slow push-in — Action: product emerges — Focus: establish tone"},
                {"id": "S02", "description": "Shot: detail — Scene: three-quarter angle — Camera: orbit — Action: product rotates — Focus: material finish"},
            ],
        },
    }],
})
```

A storyboard update is the latest working storyboard; it is not a user-selectable media candidate. For a partial revision, append or update only the changed shot descriptions while preserving the existing storyboard Element and generation settings. For a confirmed complete replacement, removal, or reorder, replace the full shot list in one update. Never save unconfirmed generation prompts as storyboard shot descriptions. If shot count or order changes, update the storyboard before rebuilding the downstream video sequence.
Whenever the user adds or changes a constraint, first update the saved Storyboard with that constraint and obtain confirmation of the updated Storyboard. Only then regenerate affected shot reference images, shot videos, or edit configuration. Do not change only a downstream generation prompt while leaving the saved Storyboard stale.
The persisted Storyboard generation configuration must include the selected model, size, resolution, and aspect ratio. The Canvas protocol stores it as `model_id`, `size`, `resolution`, and `image_generation_config.aspect_ratio`; do not leave model or aspect ratio implicit and do not invent unsupported settings.

### 6. Generate and confirm shot reference images

Do not generate a shot reference image immediately after saving. First display the opening shot's complete reference-image prompt, call `ask_user`, and wait for explicit approval or revisions. Only after approval should you generate the opening shot reference image.

After the opening reference image returns, wait for its task if needed, query the exact Element, show or summarize the candidate, call `ask_user`, and wait for explicit approval. Only after the opening reference image is confirmed may you draft and confirm the remaining prompts. Every shot reference-image request must pass all confirmed initialization assets in `reference_images` (and the corresponding project paths when required by the provider), not just the asset most relevant to that shot. When the confirmed request includes no facial expression, repeat the exact facial-expression constraint in every affected shot reference-image prompt; do not rely on the initialization image or another reference image to convey it. Generate one independent image task per shot, verify every requested shot succeeded, preserve successful images, and retry only missing or rejected shots.

Use one generated `image` Element per shot. The storyboard Element is the direct upstream source of each shot reference-image Element; reference paths are generation inputs. A shot reference-image revision defaults to a new independent Image Element; update only the affected shot's confirmed image binding. Append Content to the old Element only for an explicit same-Element version request:

```python
result = tool.call("add_canvas_elements", {
    "project_path": "Demo",
    "items": [{
        "item_ref": "shot-reference-image-s01",
        "element_type": "image",
        "name": "Opening shot reference image",
        "layout": {"strategy": "dependency_flow"},
        "connections": [{"source_element_id": "storyboard-element-id"}],
        "content": {
            "source": "generated",
            "content_type": "image",
            "name": "Opening shot reference image",
            "prompt": "The product from Image 1 exactly as shown, placed in the location from Image 2, in the style of Image 3; then the confirmed opening composition, camera framing, lighting, and artifact exclusions.",
            "reference_images": ["./images/product-anchor.webp", "./images/scene-anchor.webp", "./images/style-anchor.webp"],
            "size": "1080x1920",
        },
    }],
})
print(result.content)
```

Read the returned `element_id`, `content_id`, status, generation task ID, and media path from `result.content`. Call `wait_canvas_generation` for a returned task ID, then `query_canvas_element_details`; never treat `pending`, `processing`, or a successful tool call as user approval.

### 7. Generate and confirm shot videos

Before each shot-video call, inspect the current `<media_model_info>` and use only a declared mode. The confirmed shot reference image is a reference input: pass it in `reference_image_paths`, bind it as `[image1]`, and use `omni_reference` when declared. Do not pass it as `frame_start_path` or select `keyframe_guided` unless the user explicitly requested a start/end-frame transition. Use exactly the corresponding confirmed shot reference-image Element as the shot video's direct upstream Connection; additional initialization or product references may remain generation inputs but must not become direct Connections. When the storyboard includes the no-facial-expression constraint, copy that exact constraint into every affected shot-video prompt so motion does not introduce smiles, frowns, eyebrow acting, or other visible emotion.

Generate the first shot video as a trial; wait or query until its state is known, present the completed candidate, and confirm motion, subject consistency, camera behavior, pacing, and visual direction before generating the rest. Then generate the remaining confirmed shots in supported batches. `pending`, `processing`, `queued`, and `running` are submitted states, not failures; preserve their IDs and do not submit duplicates. Preserve successful videos and revise only affected shots. Each billed shot video still goes through the shared estimate gate in this reference unless the user's explicit current-request opt-out covers that shot generation.

For each shot video, freeze and estimate the exact request first. After confirmation, create one generated `video` Element with a Connection from exactly its corresponding shot reference-image Element:

Set `duration_seconds` in each generated shot-video request according to the confirmed pacing and the current model's supported values. The storyboard shot object contains the creative description; the video request contains the generation duration.

```python
result = tool.call("add_canvas_elements", {
    "project_path": "Demo",
    "items": [{
        "item_ref": "shot-video-s01",
        "element_type": "video",
        "name": "Opening shot video",
        "layout": {"strategy": "dependency_flow"},
        "connections": [{"source_element_id": "shot-reference-image-s01-element-id"}],
        "content": {
            "source": "generated",
            "content_type": "video",
            "name": "Opening shot video",
            "prompt": "Use the confirmed shot reference image [image1] to generate stable subject identity, natural motion, and the approved camera behavior. No text or watermark.",
            "model_id": "model-from-media-model-info",
            "input_mode": "omni_reference",
            "task": "generate",
            "reference_image_paths": ["./images/shot-s01-reference.webp"],
            "duration_seconds": 4,
            "aspect_ratio": "9:16",
            "resolution": "1080p",
        },
    }],
})
print(result.content)
```

Use `standard` for prompt-only generation, `omni_reference` for reference images or mixed media references, and `keyframe_guided` only when the current model declares it. For `keyframe_guided`, pass `frame_start_path` and optional `frame_end_path`; do not duplicate those files in `reference_image_paths`. Bind every reference token by array order before estimating.

If the confirmed storyboard shot includes voiceover, dialogue, or sound effects, copy that complete audio text into the shot-video prompt and set `content.audioPolicy="generate"`. Do not generate a silent shot when the storyboard specified sound.

### 8. Define ordered media inputs and optional audio

Import user-provided audio when needed. The composition request carries ordered Video and Audio Element IDs using the same sequence fields as Video Edit:

```python
tool.call("add_canvas_elements", {
    "project_path": "Demo",
    "items": [{
        "item_ref": "final-video",
        "element_type": "video",
        "name": "Product launch final edit",
        "layout": {"strategy": "dependency_flow"},
        "content": {
            "source": "generated",
            "content_type": "video",
            "task": "compose",
            "composition": {
                "videoSequence": ["element-shot-01", "element-shot-02"],
                "audioSequence": ["element-music"],
            },
            "output": {"aspectRatio": "16:9", "resolution": "1080p", "format": "mp4", "audioPolicy": "preserve"},
        },
    }],
})
```

Set `resolution` in the final composition request as the target short-side value. Supported examples include `720p`, `1080p`, `2k`, `4k`, and numeric values such as `768p`. For exact pixel dimensions, set both `width` and `height` in `output`.

Set `audioPolicy` to `preserve` to keep source audio or the configured Audio Element, or set it to `mute` for a silent MP4. Reuse the same sequence IDs with a different `output` to create another export version. Recalculate the expected total duration after changing the video order or source sequence.

### 9. Compose and deliver

After the user confirms the ordered media inputs, create the final Video Element through `add_canvas_elements`. Include `composition.videoSequence`, optional `composition.audioSequence`, the `dependency_flow` layout, `task="compose"`, and the requested `output`. Verify the returned Element with `query_canvas_element_details`, then present the MP4 path, duration, dimensions, audio status, and runtime composition summary. Submit another composition request with the same sequence IDs and a different `output` for each additional export version.

When a Video Edit is used, connect only the Video Edit to the final video. The source media remain connected to the Video Edit. For direct composition without a Video Edit, connect the contributing source media directly to the final video.

The composition result is the final Video Element Content. Query the returned Canvas Element for its status and media details. When a composition fails, inspect the reported inputs or configuration, obtain confirmation for the repair, retry the same final Element, and verify the result after completion.

## Canvas tool mapping for migrated video-production scenarios

Use the current Canvas tools below; do not call the removed video-production tool names:

| Production need | Current Canvas tool |
|---|---|
| Create or recover a project | `initialize_canvas` |
| Import uploaded media | `add_canvas_elements` with `source="imported"` and `content.asset_path` |
| Read the current project index | `query_canvas_overview` |
| Read exact Content, status, paths, and Connections | `query_canvas_element_details` |
| Create or update a storyboard | `add_canvas_elements` / `add_canvas_contents` with `storyboard` Content |
| Generate an initialization image or shot reference image | `add_canvas_elements` with generated `image` Content; `add_canvas_contents` only for explicitly requested versions |
| Generate a direct video or shot video | `add_canvas_elements` / `add_canvas_contents` with generated `video` Content |
| Wait for image or video generation | `wait_canvas_generation` |
| Retry one failed Content | `retry_canvas_content_generation` |
| Select the confirmed later candidate as main Content | `select_canvas_main_content` |
| Estimate billed video generation | `estimate_canvas_content_points` |
| Change layout | `layout_canvas_elements` |
| Add, remove, or replace a Connection | `manage_canvas_connections` |
| Configure an ordered edit | `add_canvas_elements` / `add_canvas_contents` with `video-edit` Content when a reusable edit plan is needed |
| Compose the final MP4 | `add_canvas_elements` with generated Video Content, Element ID sequences, and `task="compose"` |

The table above is authoritative for this workflow. Translate every scenario to the current Canvas tool and Content lifecycle; do not invent alternate tool names or bypass the Canvas business tools.

## Direct upstream relations

A Connection declares only a direct business predecessor. Reference paths are generation inputs; they do not imply Connections.

- Direct professional video: connect from every submitted Canvas Element that materially contributes to the final video. Do not infer a Connection from a reference path whose owning Element was not submitted as a business predecessor.
- Initialization image: connect from every imported or confirmed Element materially combined into the result.
- Storyboard: connect from the confirmed initialization anchors only, not the original imported assets behind them.
- Shot reference image: connect from the storyboard Element.
- Shot video: connect from exactly its corresponding shot reference-image Element only — never add initialization, product, scene, or storyboard Elements to a shot video's Connections.
- Final composition: pass the ordered Element IDs in `composition.videoSequence` and `composition.audioSequence`; record Canvas business relationships separately through `connections`.

For a new direct professional video, create the initial relations in the same `add_canvas_elements` call:

```python
tool.call("add_canvas_elements", {
    "project_path": "Demo",
    "items": [{
        "item_ref": "professional-direct-video",
        "element_type": "video",
        "name": "Product launch video",
        "layout": {"strategy": "dependency_flow"},
        "connections": [
            {"source_element_id": "element-740000000000000001"},
            {"source_element_id": "element-740000000000000002"},
        ],
        "content": {
            "source": "generated",
            "content_type": "video",
            "name": "Product launch video",
            "prompt": "Show the confirmed product [image1] in a premium studio scene with a slow push-in, stable product identity, and no text or watermark.",
            "reference_image_paths": ["Demo/images/product.png"],
        },
    }],
})
```

Use `dependency_flow` for professional production relations. Basic Canvas image and video generation outside this reference remains `row_incremental` and does not create these production Connections.

## Failure and revision

- Preserve confirmed results and all successful media.
- Regenerate only affected initialization images, shot reference images, or shot videos.
- After a shot reference-image change, update the corresponding shot and regenerate only dependent videos.
- When a shot video changes, keep its Element ID, append a candidate Content, confirm, and select main before composing again.
- When changing shot count or order, update the storyboard first, preserve unaffected outputs, rebuild the ordered sequence, confirm the edit, and compose again.
- When adding, replacing, or removing BGM, import or reuse the Audio Element, update `audio_sequence`, confirm the edit, and compose again.
- A new video direction appends a candidate with `add_canvas_contents`; image revisions remain independent by default.
- If the media is correct but a Canvas relation is wrong, repair only the relation with `manage_canvas_connections`: query the exact current Connection IDs first, provide the complete intended endpoints, and do not regenerate media. Remove or replace relations only with explicit user intent.

## Provider-managed assets

Only Seedance-series video models support provider-managed asset URIs such as `asset://virtual-human-asset-id`. Keep a supported provider asset URI in the appropriate reference array, bind it in the prompt, and do not read it as a workspace file, import it into the Canvas, or create a synthetic Element for it. For other video models, use a workspace-relative media path.

## Layout strategies

Production chains use `dependency_flow`; basic design scenes use `row_incremental`; `explicit_position` only when the user gives coordinates. See the `layout_canvas_elements` tool reference in the parent SKILL.md for parameters. Layout never touches Content or Connections, and never infers Connections from visual distance.
