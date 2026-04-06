---
name: designing-canvas-images
description: Core canvas design skill covering project management, coordinate system, element operations, multimedia principles, AI image generation, web image search, and design marker processing. Load for any canvas design task. CRITICAL - When user message contains [@design_canvas_project:...] or [@design_marker:...] mentions, you MUST load this skill first before any operations.
---

# Canvas Design Skill

Covers all canvas design fundamentals: project management, element types, multimedia principles, AI image generation, web image search, and design marker processing.

---

## Execution

All Python code in this skill runs via `run_skills_snippet`:

```python
run_skills_snippet(
    python_code="""
from sdk.tool import tool
result = tool.call('create_design_project', {"project_path": "my-design"})
"""
)
```

---

## Project Concept

Design projects are uniquely identified by `project_path`. All canvas tools require this parameter.

**Canvas selection:** Default to reusing the same canvas project. Only create a new one when the user explicitly says "create new canvas" or "new project". If no project path is specified, find or reuse an existing project first.

---

## Canvas System

**Coordinate:** Origin `(0, 0)` at top-left. X increases rightward, Y downward. `(x, y)` = element top-left corner. Canvas is infinite.

**Element types:**

| Type | Key properties | Smart features |
|------|----------------|----------------|
| `image` | `src`, `generateImageRequest`, `visualUnderstanding` | Auto-reads dimensions from file; auto-calculates position when x/y omitted |
| `video` | `src`, `poster`, `status`, `generateVideoRequest` | Placeholder creation; async status backfill |

---

## Multimedia Principles

**Prohibited:**
- Shell commands for media processing
- Modifying original image or video files
- Deleting canvas elements
- Using file tools (`write_file`, `edit_file`, shell) on `magic.project.js` — use canvas tools only
- Creating separate elements on canvas to fake image editing

**Correct approach:**
- Image content changes → `generate_images_to_canvas` (creates new element; keep original)
- Video generation and follow-up → load `designing-canvas-videos` skill
- Original elements and media files must remain unchanged

**Tool priority:**
- Static output (poster, illustration, cover, still image) → image tools
- Dynamic output (video, animation, shot, clip) → `designing-canvas-videos` skill
- Do not fall back to image tools just because a video task is still processing

---

## Core Tools

### create_design_project

| Parameter | Required | Description |
|---|---|---|
| `project_path` | Yes | Project relative path, e.g. `"my-design"` |

Returns: `{ project_path, project_name }`

### generate_images_to_canvas

| Parameter | Required | Description |
|---|---|---|
| `project_path` | Yes | Project path |
| `name` | Yes | Canvas element label; multiple images get suffixes `_1`, `_2`, … |
| `prompts` | Yes | Generation prompts, up to 6 entries |
| `size` | Yes | Image dimensions `"WxH"`, e.g. `"2048x2048"`, `"1440x2560"` |
| `reference_images` | Yes | Reference image paths. Pass `[]` for text-only generation |
| `image_count` | No | Variations in single-prompt mode, 1–4 (default 1) |

Returns: `{ created_elements: [{ id, name, type, x, y, width, height }], succeeded_count, failed_count }`

### query_canvas_overview

| Parameter | Required | Description |
|---|---|---|
| `project_path` | Yes | Project path |
| `sort_by` | No | `"layer"` \| `"position"` \| `"type"` |
| `visible_only` | No | Show only visible elements |

Returns: `{ elements: [{ id, name, type, size, position }], canvas_info.total_elements, project_name }`

### query_canvas_element

| Parameter | Required | Description |
|---|---|---|
| `project_path` | Yes | Project path |
| `element_id` | No | Element ID (either this or `src`) |
| `src` | No | Image path — use to find element by path and retrieve its dimensions |

Returns: `{ id, name, size: { width, height }, image_properties.src }`

---

## Canvas Rules

**Image operations:**
- Do not modify original image files — all content changes must create new elements
- Do not delete elements
- Do not alter image content through element properties
- Use `generate_images_to_canvas` for any content change; keep original elements intact
- "Add X to image" = image-to-image generation, not placing a separate element on canvas

**Workflow:**
- Default to reusing the existing canvas project; only create a new one when the user explicitly asks
- Query the canvas with `query_canvas_overview` before operating on existing content
- Never assume file paths — always use paths obtained from query results
- For image-to-image: always query the reference image's dimensions first with `query_canvas_element(src=...)`
- When the user references a canvas image, check `image_properties.visual_understanding` in the `query_canvas_element` response first. Only call a dedicated visual understanding tool if `has_cache` is false or the cached description is clearly insufficient for the task.

**Generation timeout handling:**
- Image generation takes 1–3 minutes. Always pass `timeout=180` to `run_skills_snippet` when calling `generate_images_to_canvas`.
- If the call returns a timeout error, do NOT retry immediately. First call `query_canvas_overview` to check whether an element with the expected name already exists. Only re-generate if it is absent. Retrying blindly creates duplicate elements because generation is not idempotent.

---

## Image Sizes

Select from model's available sizes listed in the context. Common fallbacks:

| Size | Ratio |
|---|---|
| `2048x2048` | 1:1 (default) |
| `2560x1440` | 16:9 |
| `1440x2560` | 9:16 |
| `2304x1728` | 4:3 |
| `1728x2304` | 3:4 |
| `2496x1664` | 3:2 |
| `1664x2496` | 2:3 |
| `3024x1296` | 21:9 |

Image-to-image: use the reference image's original dimensions unless the user specifies otherwise.

---

## AI Image Generation

### Mode 1 — Multiple themes (up to 6 independent images)

Use multiple prompts when each image has a distinct subject:

```python
from sdk.tool import tool

result = tool.call('generate_images_to_canvas', {
    "project_path": "landmarks",
    "name": "beijing-landmarks",
    "prompts": [
        "Great Wall of China panoramic view, golden hour lighting, professional landscape photography, ...",
        "Forbidden City Hall of Supreme Harmony, dramatic clouds, professional architectural photography, ...",
        "Temple of Heaven main hall, clear blue sky, professional travel photography, ..."
    ],
    "size": "2048x2048",
    "reference_images": []
})
```

### Mode 2 — Variations (up to 4 versions of one theme)

Use single prompt + `image_count` when the user wants alternatives for one idea:

```python
from sdk.tool import tool

result = tool.call('generate_images_to_canvas', {
    "project_path": "product",
    "name": "product-shots",
    "prompts": ["Skincare bottle on white marble surface, soft studio lighting, minimalist e-commerce photography, ..."],
    "image_count": 4,
    "size": "2048x2048",
    "reference_images": []
})
```

### Mode 3 — Image-to-image (reference-anchored)

Always query the reference image's dimensions first, then generate at the same size:

```python
from sdk.tool import tool

# Step 1: Get reference image dimensions
result = tool.call('query_canvas_element', {
    "project_path": "my-design",
    "src": "my-design/images/cat.jpg"
})

if result.ok and result.data:
    width = result.data['size']['width']
    height = result.data['size']['height']
    src = result.data['image_properties']['src']

    # Step 2: Generate at same size with reference
    result2 = tool.call('generate_images_to_canvas', {
        "project_path": "my-design",
        "name": "modified-cat",
        "reference_images": [src],
        "prompts": ["Change the ear at the top-right to red while keeping all other parts completely unchanged, strictly follow the reference image, ..."],
        "size": f"{width}x{height}"
    })
```

**Replacement scenario (element swap):** When the user says "replace the character in image A with image B", use both images as references:

```python
from sdk.tool import tool

result = tool.call('generate_images_to_canvas', {
    "project_path": "my-design",
    "name": "banner-hero-swap",
    "prompts": [
        "Keep the entire composition of the first reference image unchanged — background, text, layout, and all other characters. "
        "Replace only the [target character] in the center with the character from the second reference image: "
        "[describe the replacement character's pose, armor, and key visual features]. "
        "The replacement character should occupy the same position and scale as the original. "
        "Do not alter any other element."
    ],
    "size": "2048x869",
    "reference_images": [
        "my-design/images/original-banner.png",   # composition anchor — first
        "my-design/images/new-character.png",     # replacement source — second
    ]
})
```

### Image-to-Image Principles

Apply all four when the user provides reference images:

**1. Mandatory reference inclusion**
Include the path in `reference_images`. State explicitly in the prompt: "Strictly adhere to the visual identity in the reference image. Maintain consistency in product color, texture, and branding." Do not deviate from the reference or invent content freely.

For element swap (replace X in image A with image B): pass both in `reference_images` — composition anchor first, replacement source second; state each image's role explicitly in the prompt. See Replacement scenario example above.

**2. Subject integrity**
Do not add products, components, or decorations absent from the original (unless the user explicitly requests). If the original contains multiple products (SKUs), require in the prompt: "Show all products from the reference image simultaneously and clearly." Keep product count and types consistent.

**3. Subject–style separation**
Distinguish subject content (What) from style expression (How). The subject's exact features (e.g., pink handle, white bristles) must not change. Style attributes — photography style, background, lighting — can change. Example: "Redesign in Apple style" → keep the product unchanged, only change photography style, background, and lighting.

**4. Precise requirement delivery**
Do not blur or simplify user requirements. Every keyword the user mentions (e.g., "fan-shaped spread", "firework explosion", "minimalist floating") must appear in the prompt as a modifier. Specify how to use the reference: state "rearrange objects from the reference image" for layout changes, or "apply the reference image's style to the current subject" for style transfers.

### Batching (> 4 images)

A single call supports at most 6 prompts (Mode 1) or 4 variations (Mode 2). For more images, split into multiple calls:

```python
from sdk.tool import tool

# First batch
result = tool.call('generate_images_to_canvas', {
    "project_path": "animals",
    "name": "dogs",
    "prompts": [
        "Golden retriever puppy in a sunny park, natural lighting, professional pet photography, ...",
        "Husky with blue eyes against a snowy background, professional pet photography, ...",
        "Corgi on green grass, playful expression, warm natural light, ...",
        "German shepherd in a forest, alert posture, professional pet photography, ..."
    ],
    "size": "2048x2048",
    "reference_images": []
})

# Second batch
result2 = tool.call('generate_images_to_canvas', {
    "project_path": "animals",
    "name": "dogs-2",
    "prompts": [
        "Samoyed with fluffy white coat in an outdoor setting, professional photography, ...",
        "Border collie mid-action on an agility field, dynamic shot, professional photography, ..."
    ],
    "size": "2048x2048",
    "reference_images": []
})
```

---

## Design Marker Processing

Users annotate canvas images with `[@design_marker:name]` to request modifications. Example marker:

```
[@design_marker:红色耳朵]
- 图片位置: my-design/images/dog.jpg
- 标记区域: 图片上方右侧的小区域
- 坐标: 左上角(64.0%, 7.0%)
```

Processing steps:
1. **Parse** — extract image path, marked area, and user intent from the marker
2. **Query size** — `query_canvas_element(src=...)` to get original image dimensions
3. **Build prompt** — `[location] + [what to change] + [preserve everything else]`
4. **Generate** — `generate_images_to_canvas` with `reference_images` pointing to the original image

> If the message contains `[@design_marker:xxx]`, read [reference/design-marker.md](reference/design-marker.md) for the full workflow before proceeding.

---

## Video Generation

Load `designing-canvas-videos` skill for all video tasks:
- Initial generation and follow-up both go through that skill
- If a video task returns `queued/running/processing`, it's in the correct pipeline — not an error
- Do not proactively poll; only follow up when the user explicitly asks

---

## Tool Selection Decision Tree

```
Need a new canvas project?
├─ Yes → create_design_project
└─ No → continue

Generate AI images?
├─ Yes → generate_images_to_canvas
│   ├─ Has reference image? → query_canvas_element(src) first, then reference_images=[src]
│   ├─ Different themes? → multiple prompts (Mode 1, max 6)
│   └─ Same theme, multiple versions? → single prompt + image_count (Mode 2, max 4)
└─ No → continue

Generate video?
├─ Yes → load designing-canvas-videos skill
└─ No → continue

Search web images?
├─ Yes → See reference/image-search.md
└─ No → continue

Query canvas info?
├─ Overview → query_canvas_overview
├─ By element ID → query_canvas_element(element_id)
└─ By image path → query_canvas_element(src)
```

---

## Web Image Search

> For web image search capabilities, see [reference/image-search.md](reference/image-search.md).
