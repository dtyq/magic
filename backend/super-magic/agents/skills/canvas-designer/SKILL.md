---
name: canvas-designer
description: Core canvas design skill covering project management, multimedia principles, AI image generation, web image search, and design marker processing. Load for any canvas design task. CRITICAL - When user message contains [@design_canvas_project:...] or [@design_marker:...] mentions, or when the user wants to generate video/animation/clip on a canvas project, you MUST load this skill first before any operations.
---

# Canvas Design Skill

Covers all canvas design fundamentals: project management, multimedia principles, AI image generation, web image search, and design marker processing. Video generation on canvas is supported via dedicated reference docs.

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

## Multimedia Principles

**Prohibited:**
- Shell commands for media processing
- Modifying original image or video files
- Deleting canvas elements
- Using file tools (`write_file`, `edit_file`, shell) on `magic.project.js` — use canvas tools only
- Creating separate elements on canvas to fake image editing
- Using general `web_search` to find images for canvas — this fetches webpage snippets, not downloadable images; use `search_canvas_images` instead

**Correct approach:**
- Image content changes → `generate_canvas_images` (creates new element; keep original)
- Web image search for canvas → read [reference/image/image-search.md](reference/image/image-search.md) first, then `search_canvas_images`
- Video generation → `generate_canvas_videos` (see Video Generation section below)
- Original elements and media files must remain unchanged

**Tool priority:**
- Static output (poster, illustration, cover, still image) → image tools
- Web/internet images to place on canvas → `search_canvas_images` (read reference first)
- Dynamic output (video, animation, shot, clip) → video tools (see [Video Generation](#video-generation) below)

---

## Core Tools

### create_canvas

| Parameter | Required | Description |
|---|---|---|
| `project_path` | Yes | Project relative path. Name the folder in the user's language — e.g. use a Chinese folder name for Chinese users, an English name for English users |

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
| `name` | Yes | Canvas element label. Must be in the user's language and reflect the specific content of this image — name the actual subjects, not the category or a numbered slot. [Correct] name the specific subjects depicted, in the user's language. [Wrong] English slug when the user is Chinese, or a generic category + style number |
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

Common substitutions for frequently vague terms:

| Vague term | Specific replacement |
|---|---|
| cinematic / film-like | 35mm anamorphic lens, film grain (Cinestill 800T), letterbox 2.39:1 crop, motivated practical lighting |
| vintage / retro | Kodak Portra 400 color science, faded highlights, lifted blacks, slight vignette, halation around highlights |
| professional photography | 85mm f/1.4, studio softbox at 45°, clean seamless backdrop, controlled catch-light |
| dramatic lighting | single hard key light at 90° to subject, deep shadow on opposite side, chiaroscuro contrast |
| moody / atmospheric | underexposed by 1 stop, cool blue shadow fill, haze or mist in background, low contrast colour grade |
| luxury / high-end | medium-format rendering, muted earth tones, razor-sharp product focus, generous negative space |
| minimal / clean | flat even lighting, white or off-white background, single subject, no decorative props |
| editorial | overhead 90° flat lay or eye-level straight-on, even diffused lighting, graphic colour block background |

### Separating content from style

This is the most important principle for image-to-image and product work. Conflating them is the most common cause of unwanted changes.

**Content (What)** = the subject itself — its shape, color, texture, quantity, identity. Must not drift.
**Style (How)** = photography approach, background, lighting, color grade, mood. Can change freely.

When the user says "redesign this in a dark moody style", they almost certainly mean: keep the product/subject unchanged, change the presentation. Make this separation explicit in the prompt.

### Positive framing and negative constraints

Describe what should be present. Negative instructions ("no cars", "don't change the background") are less reliable than their positive equivalents ("empty street", "keep the background exactly as it appears in the first image"). When something must be preserved, say explicitly what it is and that it stays unchanged.

However, some prohibitions have no positive equivalent — when a specific unwanted intrusion must be blocked rather than replaced, a negative constraint is the right tool:
- Blocking elements the model commonly adds uninvited: "no text or watermarks", "no people in the background"
- Preventing product distortion: "the product shape, proportions, and design must not be altered in any way"
- Excluding incompatible aesthetics: "no neon colours", "no artificial studio glow", "no decorative noise"

The rule: use positive framing when describing what to preserve or include; use negative constraints to block specific known failure modes that cannot be addressed by describing what should be there instead. Do not use both interchangeably — choose based on what the instruction actually is.

### Technical language as a precision tool

Photography and cinematography vocabulary gives the model precise, unambiguous anchors for visual decisions it would otherwise default on. Use these when the output needs specific visual qualities — not as boilerplate to append to every prompt.

Camera bodies encode color science (Fujifilm → warm, organic tones; GoPro → wide, immersive distortion). Lens specs control perspective and depth (85mm → compressed, flattering; wide-angle → environmental, expansive). Lighting setups encode mood (softbox → clean commercial; chiaroscuro → cinematic tension; golden hour → warmth, nostalgia). Color grade sets emotional register.

Only include these when they are relevant to what the image needs to communicate.

### Sensory stacking

Pure visual description is often not enough — especially for food, beverages, textured materials, and any scene where tactile or atmospheric qualities are part of the subject's appeal.

Image models have learned associations between visual cues and non-visual sensations from their training data. Describing a sensation activates the associated visual language. "Steam wisps slowly rising" produces a different image than "hot food"; "surface tension trembling" produces a different image than "liquid in a bowl"; "caramelised crust with visible cracks" produces a different image than "crispy".

When the visual alone cannot convey what makes the subject compelling, layer in non-visual sensory dimensions:

- Texture / tactile: "velvety matte finish", "coarse-grain leather with visible stitching", "crisp crackling crust that shatters at the slightest pressure"
- Motion / dynamic: "steam wisps slowly rising and dispersing", "surface tension barely holding the liquid in place", "fabric lifting at the edge in a gentle draft"
- Temperature / atmosphere: "warm condensation forming on the outside of a cold glass", "heat haze shimmering just above the surface"
- Aroma as visual suggestion: "caramelised edges that imply burnt sugar", "herbs scattered in a way that suggests fragrance"

Apply selectively — not every image benefits from this technique. Use it when:
- Food or beverage: texture and temperature almost always strengthen the result
- Material or textured products: surface finish and tactile quality are part of the subject
- Atmospheric or mood scenes: motion and environmental cues anchor the feeling
- Abstract concepts: multi-sensory language gives the model something concrete to visualise

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

### Scene type quick reference

Different scene types call for different prompt strategies. Use this as a starting point — adapt based on the specific task.

| Scene type | Recommended technical language | Common negative constraints |
|---|---|---|
| Product / commercial | Medium-format rendering, studio softbox, seamless backdrop, macro surface detail | Product must not be distorted or redesigned; no text or watermarks |
| Portrait | 85mm f/1.4, shallow DOF, catch-light in eyes, skin-tone accuracy | Preserve facial features exactly; do not alter identity |
| Food / beverage | 45° overhead or 30° side angle, diffused side light, textured surface, steam or condensation details | No utensil clutter; no text |
| Cinematic / film | Anamorphic lens, film grain, letterbox crop, practical motivated lighting | — |
| Japanese / minimal | High-key exposure, wabi-sabi negative space, diffused natural light, desaturated warm tones | No neon colours; no artificial studio glow |
| Design / poster | Grid-based layout, flat graphic style, limited colour palette | Clear visual hierarchy; no decorative noise |
| Lifestyle / environmental | Wide-angle environmental framing, natural available light, subject in context | No artificial product distortion |
| Concept / atmospheric | Volumetric light, environmental haze, scale cues for depth, sensory stacking | — |

### From user intent to prompt

When the user asks for an image, you are translating intent into a visual specification. This is a reasoning task, not a template-fill.

**Step 1 — Identify what the user cares about.** What makes or breaks this image for them? A product shot fails if the product looks wrong. A mood illustration fails if the atmosphere is off. A character portrait fails if the face drifts. Start from the failure conditions.

**Step 2 — Fill in visual decisions the user left open.** The user said "a cat on a rooftop at sunset" — they did not specify camera angle, lens, depth of field, color palette, or the cat's pose. These are decisions you need to make. Choose what serves the image's purpose; do not leave them for the model to default on.

**Step 3 — Construct the prompt as a coherent scene description.** Write it as if briefing someone who will create this image. The prompt should read as clear prose or structured direction — not as a comma-separated keyword dump.

**Choosing a format:**

- Simple scene with a single subject and no strict preservation requirements → write as connected prose. Flow reads naturally and the model treats it as a unified brief.
- Complex scene with multiple elements, strict preservation constraints, or several reference images → use structured groups with short labels. Grouping makes each dimension explicit and reduces the risk of the model conflating requirements across sections.

Structured group example for a complex task:

```
Subject: [exact description of what must be preserved]
Lighting: [lighting setup, direction, quality]
Background / environment: [what to change or keep]
Style: [colour grade, aesthetic reference]
Constraints: [what must not appear or change]
```

Use labels that match the actual dimensions of the task — not every prompt needs all five groups. Only add a group if it carries real information.

### Prompt, name, and project path language

**All three fields — `prompt`, `name`, and `project_path` — must be written in the same language the user is using. No exceptions.**

Write the prompt in the same language the user is using. If the user speaks Chinese, the prompt should be in Chinese. Modern image models handle multilingual prompts natively — there is no quality advantage in translating to English.

The `name` field follows the same rule: use the user's language for the canvas element label. If the user is Chinese, the name must be in Chinese — do not default to English slugs regardless of what the examples show. Beyond language, the name must describe the **specific content** of that image — who or what is actually in it — not a generic category, a task slot number, or a theme-level label. When generating multiple images in one call, each task has a distinct subject or variation; the name should capture what makes that task unique, not just its position in the batch.

The `project_path` in `create_canvas` follows the same rule: name the project folder in the user's language. For example, if the user speaks Chinese, use a Chinese folder name; if English, use an English name. Do not use English folder names for Chinese users.

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

### Multi-view consistency (anchor-then-expand)

When the user wants multiple views of the same subject — fashion multi-view sheets, character design sheets, product 360° views — do not generate all views in a single call. Tasks within one call run concurrently and share no output; each task independently interprets the original reference, causing the results to diverge from each other.

The correct pattern is two sequential calls:

**Call 1 — Establish the anchor image**

Generate a single clean front-facing view from the original reference. This fixes the model's interpretation of the design before any other views are produced. The anchor image is more reliable than the original reference for subsequent calls because it is already in the target presentation style and has no occlusion, angle distortion, or lighting inconsistency.

```python
result = tool.call('generate_canvas_images', {
    "project_path": "my-design",
    "tasks": [{
        "name": "front-view",
        "prompt": """Subject: The garment from the reference image. Preserve the exact stripe pattern, tiered ruffle hem structure, wrist bow details, fabric texture, and cream/ivory colour palette — these are non-negotiable.
Presentation: Full-length front-facing view, white seamless background, even diffused studio lighting, clean fashion lookbook style.
Constraints: No background props. The garment design, proportions, and surface details must not be simplified or altered in any way.""",
        "reference_images": ["uploads/original-reference.jpg"]
    }]
})

anchor_path = result.data["created_elements"][0]["src"]  # path to the anchor image
```

**Call 2 — Expand from the anchor**

Pass the anchor image as `reference_images[0]` for every remaining view. All tasks in this call can run concurrently because they all share the same anchor. Do not chain views off each other (side view referencing back view referencing front view) — drift accumulates with each step.

```python
tool.call('generate_canvas_images', {
    "project_path": "my-design",
    "tasks": [
        {
            "name": "side-view",
            "prompt": """Subject: The first image defines the garment. Preserve its exact stripe pattern, tiered ruffle hem, wrist bows, fabric texture, and cream/ivory colour palette — non-negotiable.
View: Show the same garment from the side (90° angle). Adjust camera angle only.
Presentation: Same white seamless background and even diffused studio lighting as the first image. Full-length shot.
Constraints: Garment design and proportions must match the first image exactly.""",
            "reference_images": [anchor_path]
        },
        {
            "name": "back-view",
            "prompt": """Subject: The first image defines the garment. Preserve its exact stripe pattern, tiered ruffle hem, wrist bows, fabric texture, and cream/ivory colour palette — non-negotiable.
View: Show the same garment from the back (180° angle). Adjust camera angle only.
Presentation: Same white seamless background and even diffused studio lighting as the first image. Full-length shot.
Constraints: Garment design and proportions must match the first image exactly.""",
            "reference_images": [anchor_path]
        }
    ]
})
```

**Key rules:**
- Always anchor from the front view — it exposes the most design information with no occlusion
- All non-anchor views must reference the anchor image, not each other
- The anchor image path comes from `result.data["created_elements"][0]["src"]` — do not guess or hardcode it
- This pattern applies to any multi-view task: fashion, characters, products, architecture

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

> If the message contains `[@design_marker:xxx]`, read [reference/image/design-marker.md](reference/image/design-marker.md) for the full workflow before proceeding.

---

## Video Generation

> For full video generation workflow, read the matching reference before proceeding:
>
> - **Generation** → [reference/video/generation.md](reference/video/generation.md)
> - **Follow-up / status sync** → [reference/video/follow-up.md](reference/video/follow-up.md)
> - **Parameter selection / error handling** → [reference/video/parameters-and-errors.md](reference/video/parameters-and-errors.md)

**Use video tools when:**
- User wants dynamic output on canvas: video, animation, shot, clip, short film, motion poster
- User is following up on an existing canvas video task ("is it done / continue / refresh / check progress")
- User provides reference images or start/end frames and wants a video element on canvas

**Do not use video tools for:**
- Static output such as poster, cover, screenshot, or illustration → use image workflow above
- General non-canvas video generation → use the video tools directly
- Only adjusting element position, size, or layer → use canvas element editing tools

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
├─ Yes → read reference/video/generation.md first, then generate_canvas_videos
│   └─ Follow up? → read reference/video/follow-up.md, then query_video_generation
└─ No → continue

Search web images?
├─ Yes → read reference/image/image-search.md first, then search_canvas_images
└─ No → continue

User prompt too short or vague to generate well?
├─ Yes → search_image_prompts → present 3–5 adapted options for user to choose
└─ No → proceed with generation
```

---

## Web Image Search

> If the user wants to search and download web images onto the canvas, read [reference/image/image-search.md](reference/image/image-search.md) for the full workflow before proceeding.

---

## Prompt Library Search

The `search_image_prompts` tool provides access to 1300+ curated AI image generation prompts from the nanobanana library, ranked by real-world engagement (likes + views).

**When to use — trigger condition:**

The user's input is too short or vague to produce a good image without guessing (e.g. "画一个产品图", "something cinematic", "帮我做个封面"). In this situation, do not silently guess and generate. Instead:

1. Call `search_image_prompts` with a query that reflects the user's intent and scene type
2. Read the results and derive 3–5 distinct prompt options, each adapted to the user's subject
3. Present the options to the user in the user's language, and ask them to pick one or say what to adjust
4. Generate only after the user confirms a direction

**When not to use:**
- User provides a specific, detailed prompt — use it directly without searching
- The request is clear enough to construct a complete prompt from first principles (e.g. user described subject, style, and scene in sufficient detail)

**Parameters:**
- `query`: keyword search across prompt text, author, and categories
- `category`: filter by category — `Photography`, `Product & Brand`, `Girl`, `Food & Drink`, `Illustration & 3D`, `App`, `JSON`, `Other`
- `sort_by`: `rank` (default), `likes`, `views`, `date`
- `limit`: number of results, default 5, max 20
- `random`: set to `true` for open-ended inspiration browsing

```python
from sdk.tool import tool

result = tool.call('search_image_prompts', {
    "query": "product storyboard",
    "category": "Product & Brand",
    "limit": 5,
})
print(result.content)
# result.data["results"]: [{ rank, id, prompt, categories, likes, views, image, images, author_name, source_url }, ...]
```

**Deriving options from results:**

Library prompts are structural references, not templates to copy verbatim. For each option you present to the user:
- Take the structural pattern and technical vocabulary from a high-ranking result
- Substitute the user's actual subject, scene, and any constraints they mentioned
- Give each option a short label so the user can easily refer to it (e.g. "Option A — studio grid storyboard", "Option B — lifestyle editorial")

After the user picks, use their choice as the foundation and apply prompt engineering principles (content/style separation, sensory stacking, etc.) before calling `generate_canvas_images`.
