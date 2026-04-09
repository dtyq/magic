---
name: designing-canvas-images
description: Core canvas design skill covering project management, multimedia principles, AI image generation, web image search, and design marker processing. Load for any canvas design task. CRITICAL - When user message contains [@design_canvas_project:...] or [@design_marker:...] mentions, you MUST load this skill first before any operations.
---

# Canvas Design Skill

Covers all canvas design fundamentals: project management, multimedia principles, AI image generation, web image search, and design marker processing.

---

## Execution

All Python code in this skill runs via `run_sdk_snippet`:

```python
run_sdk_snippet(
    python_code="""
from sdk.tool import tool
result = tool.call('create_canvas', {"project_path": "my-design"})
print(result)
"""
)
```

**Result object:** fields are `result.ok` (bool), `result.content` (str), `result.data` (dict). Access structured data via `result.data`, not `result['key']` — the Result object is not subscriptable.

---

## Project Concept

Design projects are uniquely identified by `project_path`. All canvas tools require this parameter.

**Canvas selection:** Default to reusing the same canvas project. Only create a new one when the user explicitly says "create new canvas" or "new project". If no project path is specified, find or reuse an existing project first.

---

## Element Types

| Type | Key properties |
|------|----------------|
| `image` | `src`, `generateImageRequest` |
| `video` | `src`, `poster`, `status`, `generateVideoRequest` |

---

## Multimedia Principles

**Prohibited:**
- Shell commands for media processing
- Modifying original image or video files
- Deleting canvas elements
- Using file tools (`write_file`, `edit_file`, shell) on `magic.project.js` — use canvas tools only
- Creating separate elements on canvas to fake image editing

**Correct approach:**
- Image content changes → `generate_canvas_images` (creates new element; keep original)
- Video generation and follow-up → load `designing-canvas-videos` skill
- Original elements and media files must remain unchanged

**Tool priority:**
- Static output (poster, illustration, cover, still image) → image tools
- Dynamic output (video, animation, shot, clip) → `designing-canvas-videos` skill

---

## Core Tools

### create_canvas

| Parameter | Required | Description |
|---|---|---|
| `project_path` | Yes | Project relative path. Name the folder in the user's language — e.g. `"产品海报设计"` for Chinese users, `"product-poster-design"` for English users |

Returns: `{ project_path, project_name }`

### generate_canvas_images

| Parameter | Required | Description |
|---|---|---|
| `project_path` | Yes | Project path |
| `tasks` | Yes | List of image generation tasks; each task produces one image |

**Task object:**

| Field | Required | Description |
|---|---|---|
| `prompt` | Yes | Generation prompt for this image |
| `name` | Yes | Canvas element label. Must reflect the specific content of this image — name the actual subjects, not the category or a numbered slot. [Correct] name the specific subjects depicted. [Wrong] generic category + style number |
| `size` | Conditional | Image dimensions `"WxH"`, e.g. `"2048x2048"`. Required when `reference_images` is empty; omit to auto-read from the largest reference image |
| `reference_images` | No | Reference image paths (workspace-relative). Images inside the project use project-relative paths, e.g. `images/cat.jpg`; images outside the project use workspace-relative paths, e.g. `other-project/images/ref.png`. Omit or pass `[]` for text-only generation |
| `element_id` | No | Existing element ID to overwrite (for retrying a failed placeholder) |

Returns: `{ created_elements: [{ id, name, type }], succeeded_count, failed_count }`

---

## Canvas Rules

**Image operations:**
- Do not modify original image files — all content changes must create new elements
- Do not delete elements
- Do not alter image content through element properties
- Use `generate_canvas_images` for any content change; keep original elements intact
- "Add X to image" = image-to-image generation, not placing a separate element on canvas

**Workflow:**
- Default to reusing the existing canvas project; only create a new one when the user explicitly asks
- Never assume file paths — always use paths obtained from query results
- For image-to-image: use `visual_understanding` to analyze the reference image first — it returns both content description and dimensions. Use the description to inform your prompt; `size` can be omitted when reference images are provided (auto-resolved from the largest one), or set explicitly if the user wants a different output size.
- When the user references a canvas image, always call `visual_understanding` to understand its content before generating. This ensures your prompt accurately describes what to preserve and what to change.

**Generation timeout handling:**
- `run_sdk_snippet` automatically enforces a minimum 10-minute timeout for `generate_canvas_images` calls. You do not need to pass `timeout` unless the task is expected to take longer than 10 minutes.
- If a task fails, the result content includes the `element_id` of the failed placeholder. Pass that `element_id` back in the retried task to overwrite the placeholder in-place instead of creating a duplicate element.

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

## Prompt Engineering

Modern image generation models reason about prompts before generating — they understand spatial relationships, logical constraints, and intent. This means prompt quality determines output quality more than any parameter setting.

There is no universal formula. The right prompt depends on the scene. What matters is understanding *why* these models work the way they do, so you can construct the right prompt for any situation from first principles.

### How to think about a prompt

A prompt is a **creative brief**, not a keyword list. Ask yourself: if you were directing a film crew or briefing a photographer, what would you tell them? Prompts that read like clear directions produce images that look like clear decisions.

The most common failure mode is vagueness-by-omission: the model fills in gaps with its defaults, and the result looks "generic". Specificity is not about length — it is about removing ambiguity for every visual decision that matters for this particular image.

What "matters" depends entirely on the task:
- A product shot → exact surface, lighting direction, reflections, what not to change
- A portrait → expression, angle, relationship between subject and background
- A concept art scene → atmosphere, scale cues, relationship between elements
- A style transfer → which parts come from which reference, and what stays locked

Identify the 2–3 things that would make this image fail if they were wrong, and make those explicit in the prompt.

### Writing principle: specificity over adjectives

Adjectives like "beautiful", "stunning", "dramatic" give the model nothing to work with. Replace them with what actually creates that effect:

- "dramatic" → specify *what* is dramatic: harsh side-lighting, extreme low angle, deep shadow
- "professional" → specify the medium: shot on medium-format film, editorial composition, clean negative space
- "cozy" → specify what makes it feel cozy: warm tungsten light, close framing, shallow DOF with blurred surroundings

The test: could another person reconstruct the visual from your prompt alone?

### Separating content from style

This is the most important principle for image-to-image and product work. Conflating them is the most common cause of unwanted changes.

**Content (What)** = the subject itself — its shape, color, texture, quantity, identity. Must not drift.
**Style (How)** = photography approach, background, lighting, color grade, mood. Can change freely.

When the user says "redesign this in a dark moody style", they almost certainly mean: keep the product/subject unchanged, change the presentation. Make this separation explicit in the prompt.

### Positive framing

Describe what should be present. Negative instructions ("no cars", "don't change the background") are less reliable than their positive equivalents ("empty street", "keep the background exactly as it appears in the first image"). When something must be preserved, say explicitly what it is and that it stays unchanged.

### Technical language as a precision tool

Photography and cinematography vocabulary gives the model precise, unambiguous anchors for visual decisions it would otherwise default on. Use these when the output needs specific visual qualities — not as boilerplate to append to every prompt.

Camera bodies encode color science (Fujifilm → warm, organic tones; GoPro → wide, immersive distortion). Lens specs control perspective and depth (85mm → compressed, flattering; wide-angle → environmental, expansive). Lighting setups encode mood (softbox → clean commercial; chiaroscuro → cinematic tension; golden hour → warmth, nostalgia). Color grade sets emotional register.

Only include these when they are relevant to what the image needs to communicate.

### Using reference images

Every reference image carries multiple visual attributes simultaneously: subject identity, composition structure, color palette, lighting, texture, style, background. Without guidance, the model blends all of them — which is almost never what you want.

The prompt's job is to decompose each reference into its constituent attributes, then explicitly assign each attribute: which image it comes from, whether it is locked or free to change, and what part of the output it applies to.

Answer these questions in the prompt for each reference:
- What specific visual attribute am I extracting from this image?
- Is that attribute locked (must be preserved exactly) or used as guidance (can evolve)?
- Which part of the output does it govern?

When multiple images are passed, cite them by their position in `reference_images` — the model indexes inputs by order, and filenames are not visible. Use "the first image", "the second image", or equivalent in whichever language the prompt is written in.

```
# Subject consistency + new context
"Use the character from the first image — preserve their exact facial features, hair, and outfit.
Place them in an outdoor market environment. The background, lighting, and framing are free."

# Composition lock + style transfer
"The second image defines the composition: maintain its layout, subject placement, and proportions exactly.
Apply the color palette, texture, and lighting style from the first image to that composition."

# Object fidelity in a new scene
"The first image shows the product. Preserve its shape, color, material, and all surface details exactly.
Generate a new lifestyle context around it — environment, props, and background are unconstrained."
```

The failure mode is listing references without declaring roles: the model interpolates between all input images and the result satisfies none of your requirements precisely.

### From user intent to prompt

When the user asks for an image, you are translating intent into a visual specification. This is a reasoning task, not a template-fill.

**Step 1 — Identify what the user cares about.** What makes or breaks this image for them? A product shot fails if the product looks wrong. A mood illustration fails if the atmosphere is off. A character portrait fails if the face drifts. Start from the failure conditions.

**Step 2 — Fill in visual decisions the user left open.** The user said "a cat on a rooftop at sunset" — they did not specify camera angle, lens, depth of field, color palette, or the cat's pose. These are decisions you need to make. Choose what serves the image's purpose; do not leave them for the model to default on.

**Step 3 — Construct the prompt as a coherent scene description.** Write it as if briefing someone who will create this image. The prompt should read as clear prose or structured direction — not as a comma-separated keyword dump.

### Prompt, name, and project path language

Write the prompt in the same language the user is using. If the user speaks Chinese, the prompt should be in Chinese. Modern image models handle multilingual prompts natively — there is no quality advantage in translating to English.

The `name` field follows the same rule: use the user's language for the canvas element label. Beyond language, the name must describe the **specific content** of that image — who or what is actually in it — not a generic category, a task slot number, or a theme-level label. When generating multiple images in one call, each task has a distinct subject or variation; the name should capture what makes that task unique, not just its position in the batch.

The `project_path` in `create_canvas` follows the same rule: name the project folder in the user's language. For example, if the user speaks Chinese, use a Chinese folder name such as `"产品海报设计"`; if English, use something like `"product-poster-design"`.

### Handling user-provided prompts

**User gives a vague idea** (e.g. "draw a cat at sunset"):
This is an intent signal, not a finished prompt. Expand it into a complete visual specification. Include the user's original phrasing naturally within the expanded prompt so their core intent passes through to the model.

**User provides a detailed, crafted prompt** (e.g. they clearly spent effort writing it):
Respect their work. Use their prompt as the primary body. Only append supplementary context (dimensions, technical specs, reference image roles) that the generation API needs but the user's prompt does not cover. Do not rewrite, restructure, or "improve" their wording.

**In both cases:** the user's own words — their specific nouns, adjectives, and descriptive phrases — must be preserved in the final prompt. This is not about mechanical verbatim copying; it is about ensuring that the user's intent, expressed in their chosen words, reaches the image model without being filtered through your interpretation.

---

## AI Image Generation

Each call accepts a `tasks` list. Every task produces one image independently — tasks run concurrently and each updates the canvas as soon as it finishes.

### Text-to-image (no references)

`size` is required when no `reference_images` are provided.

**Multiple independent images:**

```python
from sdk.tool import tool

result = tool.call('generate_canvas_images', {
    "project_path": "landmarks",
    "tasks": [
        {
            "name": "great-wall",
            "prompt": "The Great Wall winding across mountain ridges toward the horizon, late afternoon sun casting long shadows along the stone walkway, aerial perspective from a drone at 200m altitude, warm golden light with cool blue shadows in the valleys",
            "size": "2560x1440",
            "reference_images": []
        },
        {
            "name": "forbidden-city",
            "prompt": "The Hall of Supreme Harmony in the Forbidden City, low-angle shot from the courtyard emphasizing the layered rooflines, overcast sky with dramatic cloud formations breaking above the ridge, symmetrical composition with the central staircase as the leading line",
            "size": "2560x1440",
            "reference_images": []
        },
        {
            "name": "temple-of-heaven",
            "prompt": "The Temple of Heaven's Hall of Prayer, shot from ground level looking up at the triple-tiered circular roof, early morning with clear sky, the deep blue and gold roof tiles catching the first direct sunlight against the pale sky",
            "size": "2560x1440",
            "reference_images": []
        }
    ]
})
```

### Image-to-image (with references)

The prompt must declare what each reference contributes. The model receives images in array order; cite them as "the first image", "the second image", etc. (or the equivalent in the prompt's language).

When `reference_images` is non-empty and `size` is omitted, the tool auto-reads dimensions from the largest reference image. Set `size` explicitly only if you need a different output size.

**Path format:** all paths are workspace-relative. Images inside the current project can be referenced using their project-relative path (e.g. `images/cat.jpg`); images from other locations use their full workspace-relative path (e.g. `uploads/ref.png` or `another-project/images/style.jpg`). Do not guess paths — use the path you already know or obtained from previous tool results.

**Single reference — targeted edit:**

Before generating, call `visual_understanding` on the reference image to get its content description. `size` can be omitted — the tool resolves it from the reference automatically.

```python
from sdk.tool import tool

# visual_understanding has already been called on "images/cat.jpg"
# and returned a description of the cat

tool.call('generate_canvas_images', {
    "project_path": "my-design",
    "tasks": [{
        "name": "cat-red-ear",
        "prompt": "Based on the reference image, change only the ear in the upper-right area to bright red. Preserve the cat's face, body, pose, background, and every other detail exactly as they appear. The red ear should look natural — same fur texture, same lighting direction, just the color changed.",
        "reference_images": ["images/cat.jpg"]
    }]
})
```

**Multiple references — element swap:**

```python
tool.call('generate_canvas_images', {
    "project_path": "my-design",
    "tasks": [{
        "name": "banner-hero-swap",
        "prompt": "The first image is the composition anchor: keep its background, layout, text overlays, and all secondary characters exactly unchanged. The second image provides the replacement character. Remove the original central figure and place the character from the second image in the same position and at the same scale. Match the lighting direction and color temperature of the first image onto the new character so they integrate naturally into the scene.",
        "size": "2048x869",
        "reference_images": [
            "images/original-banner.png",
            "images/new-character.png"
        ]
    }]
})
```

**Style transfer:**

```python
tool.call('generate_canvas_images', {
    "project_path": "my-design",
    "tasks": [{
        "name": "product-lifestyle",
        "prompt": "The first image shows the product. Preserve its shape, color, material finish, and all surface details — these are non-negotiable. The second image defines the target visual style: adopt its lighting setup, color grading, and background treatment. Place the product in a new lifestyle setting that matches the second image's aesthetic, while keeping the product itself pixel-accurate to the first image.",
        "reference_images": [product_src, style_ref_src]
    }]
})
```

### Retrying failed tasks

When a task fails, the result content includes the `element_id` of the failed placeholder. Pass it back in `element_id` to overwrite the placeholder in-place:

```python
tool.call('generate_canvas_images', {
    "project_path": "my-design",
    "tasks": [{
        "name": "cat-red-ear",
        "prompt": "...",
        "reference_images": ["images/cat.jpg"],
        "element_id": "elem_xxxxxxxxxxxx"   # from the failed task's result
    }]
})
```

### Batching (> 6 images)

A single call supports up to 6 tasks. For more images, split into multiple calls.

---

## Design Marker Processing

Users annotate canvas images with `[@design_marker:name]` to request modifications. Example marker:

```
[@design_marker:red-ear]
- Image location: images/dog.jpg
- Marked area: Small area at top-right of image
- Coordinates: Top-left (64.0%, 7.0%)
```

Processing steps:
1. **Parse** — extract image path, marked area, and user intent from the marker
2. **Understand** — call `visual_understanding` on the image to get its dimensions and content description
3. **Build prompt** — `[location] + [what to change] + [preserve everything else]`
4. **Generate** — `generate_canvas_images` with a single task whose `reference_images` points to the original image; `size` auto-resolved from the reference

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
├─ Yes → create_canvas
└─ No → continue

Generate AI images?
├─ Yes → generate_canvas_images
│   ├─ Has reference image? → visual_understanding first, then reference_images=[path] (size auto-resolved)
│   ├─ Different images? → multiple tasks in one call (max 6)
│   └─ Retry failed task? → pass element_id from the failed result
└─ No → continue

Generate video?
├─ Yes → load designing-canvas-videos skill
└─ No → continue

Search web images?
├─ Yes → See reference/image-search.md
└─ No → continue
```

---

## Web Image Search

> For web image search capabilities, see [reference/image-search.md](reference/image-search.md).
