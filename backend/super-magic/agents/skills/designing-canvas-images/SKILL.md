---
name: designing-canvas-images
description: Core canvas design skill covering project management, coordinate system, element operations, multimedia principles, AI image generation, web image search, and design marker processing. Load for any canvas design task. CRITICAL - When user message contains [@design_canvas_project:...] or [@design_marker:...] mentions, you MUST load this skill first before any operations.
---

# Canvas Design Skill

Covers all canvas design fundamentals: project management, element types, multimedia principles, AI image generation, web image search, and design marker processing.

---

## Execution

All Python code in this skill runs via `run_sdk_snippet`:

```python
run_sdk_snippet(
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
| `image` | `src`, `generateImageRequest` | Auto-reads dimensions from file; auto-calculates position when x/y omitted |
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
- For image-to-image: use `visual_understanding` to analyze the reference image first — it returns both content description and dimensions. Use the dimensions for `size` and the description to inform your prompt.
- When the user references a canvas image, always call `visual_understanding` to understand its content before generating. This ensures your prompt accurately describes what to preserve and what to change.

**Generation timeout handling:**
- `run_sdk_snippet` automatically enforces a minimum 10-minute timeout for `generate_images_to_canvas` calls. You do not need to pass `timeout` unless the task is expected to take longer than 10 minutes.
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

### Prompt language

Write the prompt in the same language the user is using. If the user speaks Chinese, the prompt should be in Chinese. Modern image models handle multilingual prompts natively — there is no quality advantage in translating to English.

### Handling user-provided prompts

**User gives a vague idea** (e.g. "draw a cat at sunset"):
This is an intent signal, not a finished prompt. Expand it into a complete visual specification. Include the user's original phrasing naturally within the expanded prompt so their core intent passes through to the model.

**User provides a detailed, crafted prompt** (e.g. they clearly spent effort writing it):
Respect their work. Use their prompt as the primary body. Only append supplementary context (dimensions, technical specs, reference image roles) that the generation API needs but the user's prompt does not cover. Do not rewrite, restructure, or "improve" their wording.

**In both cases:** the user's own words — their specific nouns, adjectives, and descriptive phrases — must be preserved in the final prompt. This is not about mechanical verbatim copying; it is about ensuring that the user's intent, expressed in their chosen words, reaches the image model without being filtered through your interpretation.

---

## AI Image Generation

### Text-to-image (no references)

Use when generating from description alone. Each prompt in `prompts` produces one independent image.

**Multiple themes** — up to 6 prompts, each a distinct image:

```python
from sdk.tool import tool

result = tool.call('generate_images_to_canvas', {
    "project_path": "landmarks",
    "name": "beijing-landmarks",
    "prompts": [
        "The Great Wall winding across mountain ridges toward the horizon, "
        "late afternoon sun casting long shadows along the stone walkway, "
        "aerial perspective from a drone at 200m altitude, "
        "warm golden light with cool blue shadows in the valleys",

        "The Hall of Supreme Harmony in the Forbidden City, "
        "low-angle shot from the courtyard emphasizing the layered rooflines, "
        "overcast sky with dramatic cloud formations breaking above the ridge, "
        "symmetrical composition with the central staircase as the leading line",

        "The Temple of Heaven's Hall of Prayer, "
        "shot from ground level looking up at the triple-tiered circular roof, "
        "early morning with clear sky, the deep blue and gold roof tiles "
        "catching the first direct sunlight against the pale sky"
    ],
    "size": "2560x1440",
    "reference_images": []
})
```

**Variations** — up to 4 versions of one theme:

```python
result = tool.call('generate_images_to_canvas', {
    "project_path": "product",
    "name": "moisturizer-options",
    "prompts": [
        "A frosted glass moisturizer jar on a slab of raw white marble, "
        "single soft light source from the upper left creating a gentle gradient shadow, "
        "clean negative space around the product, "
        "shallow depth of field with the brand label tack-sharp, "
        "neutral warm color grade, e-commerce product photography"
    ],
    "image_count": 4,
    "size": "2048x2048",
    "reference_images": []
})
```

### Image-to-image (with references)

Always query the reference image's dimensions first, then generate at the same size.

The prompt must declare what each reference contributes. The model receives images in array order; cite them as "the first image", "the second image", etc. (or the equivalent in the prompt's language).

**Single reference — targeted edit:**

Before generating, call `visual_understanding` on the reference image. It returns the image's dimensions and a content description — use both to build the prompt and set the correct `size`.

```python
from sdk.tool import tool

# visual_understanding has already been called on "my-design/images/cat.jpg"
# and returned dimensions 1920x1080 and a description of the cat

tool.call('generate_images_to_canvas', {
    "project_path": "my-design",
    "name": "cat-red-ear",
    "reference_images": ["my-design/images/cat.jpg"],
    "prompts": [
        "Based on the reference image, change only the ear in the upper-right area to bright red. "
        "Preserve the cat's face, body, pose, background, and every other detail exactly as they appear. "
        "The red ear should look natural — same fur texture, same lighting direction, just the color changed."
    ],
    "size": "1920x1080"
})
```

**Multiple references — element swap:**

```python
tool.call('generate_images_to_canvas', {
    "project_path": "my-design",
    "name": "banner-hero-swap",
    "prompts": [
        "The first image is the composition anchor: keep its background, layout, text overlays, "
        "and all secondary characters exactly unchanged. "
        "The second image provides the replacement character. "
        "Remove the original central figure and place the character from the second image "
        "in the same position and at the same scale. "
        "Match the lighting direction and color temperature of the first image onto the new character "
        "so they integrate naturally into the scene."
    ],
    "size": "2048x869",
    "reference_images": [
        "my-design/images/original-banner.png",
        "my-design/images/new-character.png",
    ]
})
```

**Style transfer:**

```python
tool.call('generate_images_to_canvas', {
    "project_path": "my-design",
    "name": "product-lifestyle",
    "reference_images": [product_src, style_ref_src],
    "prompts": [
        "The first image shows the product. Preserve its shape, color, material finish, "
        "and all surface details — these are non-negotiable. "
        "The second image defines the target visual style: adopt its lighting setup, "
        "color grading, and background treatment. "
        "Place the product in a new lifestyle setting that matches the second image's aesthetic, "
        "while keeping the product itself pixel-accurate to the first image."
    ],
    "size": f"{w}x{h}"
})
```

### Batching (> 4 images)

A single call supports at most 6 prompts or 4 variations. For more images, split into multiple calls with distinct `name` values.

---

## Design Marker Processing

Users annotate canvas images with `[@design_marker:name]` to request modifications. Example marker:

```
[@design_marker:red-ear]
- Image location: my-design/images/dog.jpg
- Marked area: Small area at top-right of image
- Coordinates: Top-left (64.0%, 7.0%)
```

Processing steps:
1. **Parse** — extract image path, marked area, and user intent from the marker
2. **Understand** — call `visual_understanding` on the image to get its dimensions and content description
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
│   ├─ Has reference image? → visual_understanding first, then reference_images=[path]
│   ├─ Different themes? → multiple prompts (max 6)
│   └─ Same theme, multiple versions? → single prompt + image_count (max 4)
└─ No → continue

Generate video?
├─ Yes → load designing-canvas-videos skill
└─ No → continue

Search web images?
├─ Yes → See reference/image-search.md
└─ No → continue

Query canvas info?
└─ Overview → query_canvas_overview
```

---

## Web Image Search

> For web image search capabilities, see [reference/image-search.md](reference/image-search.md).
