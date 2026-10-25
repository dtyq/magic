# Image generation

Load this reference for image generation, image revision, reference images, or image retry. It never widens the parent skill's retry limit or permits direct file operations.

## Workflow

1. Query the Canvas and any exact reference Elements.
2. Look at the reference images when you need to decide what each one governs, where the change goes, or what to preserve. An image already visible in your context needs no tool call; call `visual_understanding` only for images you cannot see yet.
3. Confirm the creative direction when the direction is ambiguous.
4. New image or image revision → `add_canvas_elements`, one independent Element per image; preserve the original and use its actual path as a reference.
5. Only when the user explicitly requests versions inside one existing image Element → `add_canvas_contents`.
6. Failed and the user agrees → `retry_canvas_content_generation`.
7. The first Content of any Element is automatically main; the user confirms a later candidate → `select_canvas_main_content`.

Image generation, editing, retries, and additional candidates may consume points or money. After a successful image, let the user review it; a successful image you personally dislike is not a failure. Follow the core user-confirmation rule before any additional image call.

## Tool choice

- New logical image: `add_canvas_elements`, `element_type=image`, Content `source=generated`, `content_type=image`.
- Revised image: `add_canvas_elements` by default, even for "another version" or a small change. Use `add_canvas_contents` only for an explicit request to keep versions in the same Element; append without overwriting.
- In-place retry: `retry_canvas_content_generation` with the exact Element ID and failed Content ID.
- After the user confirms a later candidate: `select_canvas_main_content`. Do not call it for the first Content of any Element.

## Generation inputs

For an image Content (`source=generated`, `content_type=image`), the generation fields are `prompt`, `size`, `model_id`, `name`, and `reference_images`.

Before submitting, validate the complete nested shape:

```python
from sdk.tool import tool

result = tool.call("add_canvas_elements", {
    "project_path": "Demo",
    "items": [{
        "item_ref": "product-hero-image",
        "element_type": "image",
        "name": "Product hero image",
        "content": {
            "source": "generated",
            "content_type": "image",
            "name": "Product hero image",
            "prompt": "A premium product hero image on a clean studio background, soft commercial lighting, no text or watermark.",
            "size": "2048x2048",
        },
    }],
})
print(result.content)
```

`name` is required for every generated image Content, including a candidate appended with `add_canvas_contents`; the parent Element name does not satisfy this field. Keep `item_ref`, `element_id`, and `content_id` in their own fields and never substitute one for another.

- Text-to-image: `size` is required when `reference_images` is empty.
- Image-to-image: pass the reference path(s) in `reference_images`. When `size` is omitted, the tool auto-reads dimensions from the largest reference image; set `size` explicitly only for a different output size.
- Images inside the current project use project-relative paths and must begin with `./` (e.g. `./images/cat.jpg`); images outside the current project use workspace-relative paths (e.g. `other-project/images/style.jpg`). `visual_understanding` is workspace-anchored, so convert a returned Canvas path such as `./images/cat.jpg` to `<exact project_path>/images/cat.jpg` before calling it. Never guess a path — use one you already know or obtained from a query result.
- Before image-to-image, look at each reference to assign its role and locate the change (see Reference roles). What you observe guides the prompt; it is not text to copy into it.

```python
result = tool.call("add_canvas_elements", {
    "project_path": "Demo",
    "items": [{
        "item_ref": "cat-red-ear",
        "element_type": "image",
        "name": "cat with red ear",
        "content": {
            "source": "generated",
            "content_type": "image",
            "name": "cat with red ear",
            "prompt": "In Image 1, change only the ear in the upper-right area to bright red. Keep the cat's face, body, pose, background, and every other detail exactly as in Image 1.",
            "reference_images": ["./images/cat.jpg"],
        },
    }],
})
print(result.content)
```

## Version rules

Follow the retry, waiting, and version rules in SKILL.md. A failed image Content is retried in place with `retry_canvas_content_generation`, using the exact Element ID and Content ID.

## Output format

Honor a format the user already chose. If the user has not chosen between a direct image, an HTML page, and an SVG file, explain the relevant tradeoffs briefly, recommend an option, and let the user decide before generating anything.

- Direct image generation suits concise copy and compositions where text and artwork should be designed together. Preserve requested wording in the image prompt; do not remove it because of outdated assumptions about image-model text rendering.
- HTML suits long or structured content and frequent revisions. Keep the copy as editable page text and generate only the supporting images needed by the page.
- An explicit SVG request is a direct file-authoring request, not Canvas image generation. Write the `.svg` file with the existing file-writing capability. Do not call image-generation tools, use scripts or code generators, create a raster intermediate, or convert PNG/JPG to SVG. Keep the SVG's vector elements, text, styles, and `viewBox` editable and self-contained.
- A supporting illustration, background, or other pure-image request does not require this format question.

## Writing a high-quality prompt

A prompt is a creative brief, not a keyword list. State what must stay fixed and what may change.

### Separate content from style

- **Content (what)** — the subject: shape, color, texture, quantity, identity. Must not drift.
- **Style (how)** — photography, background, lighting, color grade, mood. May change.

When the user says "redesign this in a dark moody style", they mean: keep the subject unchanged, change the presentation. Make that split explicit. When a reference supplies the content, lock it by pointing to that reference (see Reference roles) and spend the description on what changes.

### Specificity over adjectives

Replace vague adjectives with what actually creates the effect:

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

### Technical language

Photography and cinematography vocabulary gives the model precise anchors for decisions it would otherwise default on. Use it when the output needs specific visual qualities, not as boilerplate.

Camera bodies encode color science (Fujifilm → warm, organic tones; GoPro → wide, immersive distortion). Lens specs control perspective and depth (85mm → compressed, flattering; wide-angle → environmental, expansive). Lighting setups encode mood (softbox → clean commercial; chiaroscuro → cinematic tension; golden hour → warmth, nostalgia). Color grade sets the emotional register.

Only include these when they are relevant to what the image needs to communicate.

### Sensory stacking

Pure visual description is often not enough — especially for food, beverages, textured materials, and any scene where tactile or atmospheric qualities are part of the appeal.

Image models have learned associations between visual cues and non-visual sensations. "Steam wisps slowly rising" produces a different image than "hot food"; "caramelised crust with visible cracks" produces a different image than "crispy".

When the visual alone cannot convey what makes the subject compelling, layer in non-visual sensory dimensions:

- Texture / tactile: "velvety matte finish", "coarse-grain leather with visible stitching".
- Motion / dynamic: "steam wisps slowly rising and dispersing", "fabric lifting at the edge in a gentle draft".
- Temperature / atmosphere: "warm condensation on the outside of a cold glass", "heat haze shimmering above the surface".
- Aroma as visual suggestion: "caramelised edges that imply burnt sugar".

Apply selectively — for food or beverages, textured materials, atmospheric scenes, or abstract concepts where multi-sensory language gives the model something concrete to visualize.

### Reference roles

The generation model sees each reference image's pixels directly. Your prompt is a second channel that it also obeys. Words that match the image add nothing; words that misread it or say it more strongly pull the result away from the reference. Your own reading of an image can be wrong (glasses that are not there) or coarse ("dark skin", "blemishes"), and the model amplifies it.

So spend words on what the image cannot say:

- **Which image governs what.** Cite references by order — Image 1, Image 2 (图片1, 图片2 in a Chinese prompt) — since filenames are not visible. For each, name the aspects it controls — identity and face, hairstyle, outfit, expression, pose, product shape and label, composition, palette, lighting, style — and how strictly: exact match, or loose inspiration.
- **What changes and what is new** — the scene, action, camera, lighting, and the edit itself. Describe these fully.

Leave the reference's own appearance to the image. Point at a detail when it matters: the user mentioned it, it is the thing being changed, it is small or easily lost and must survive (a logo, a mole, label text), or you must say which of several subjects you mean. Point to it in the reference instead of re-describing it, and keep the user's own wording as given.

| Intent | [Wrong] | [Right] |
|---|---|---|
| Same person in a new scene | "A man with dark skin, a beard, and glasses sits in a café" | "The man from Image 1, face and hairstyle exactly as in Image 1, sits in a café" |
| Outfit from one image, person from another | "A woman in a beige trench coat with gold buttons" | "The woman from Image 1 wearing the outfit from Image 2" |
| Keep a small detail | "He has a small dark mole" | "Keep the mole on his left cheek from Image 1" |

### Positive framing, negative constraints

Describe what should be present. Use negative constraints only to block known failures that have no positive equivalent. Use "no text or watermarks" only when the user wants a text-free supporting image; when the user asks for a poster, notice, diagram, or other image with wording, preserve that wording in the positive prompt instead.

### Scene quick reference

| Scene | Technical anchors | Common negatives |
|---|---|---|
| Product / commercial | Medium-format rendering, studio softbox, seamless backdrop, macro surface detail | Product must not be distorted or redesigned; no text or watermarks for a text-free supporting product image |
| Portrait | 85mm f/1.4, shallow DOF, catch-light in eyes, skin-tone accuracy | Preserve facial features exactly; do not alter identity |
| Food / beverage | 45° overhead or 30° side angle, diffused side light, textured surface, steam or condensation details | No utensil clutter; no text only for a text-free food image, not for a food poster with requested copy |
| Cinematic / film | Anamorphic lens, film grain, letterbox crop, practical motivated lighting | — |
| Japanese / minimal | High-key exposure, wabi-sabi negative space, diffused natural light, desaturated warm tones | No neon colours; no artificial studio glow |
| Design / poster | Grid-based layout, flat graphic style, limited colour palette | Clear visual hierarchy; preserve requested wording and legibility; no decorative noise |
| Lifestyle / environmental | Wide-angle environmental framing, natural available light, subject in context | No artificial product distortion |
| Concept / atmospheric | Volumetric light, environmental haze, scale cues for depth, sensory stacking | — |

### From user intent to prompt

When the user asks for an image, you translate intent into a visual specification. This is a reasoning task, not template-filling.

**Step 1 — Identify what the user cares about.** Start from the failure conditions: a product shot fails if the product looks wrong, a mood illustration fails if the atmosphere is off, a portrait fails if the face drifts.

**Step 2 — Fill in the visual decisions the user left open.** The user said "a cat on a rooftop at sunset" but did not specify camera angle, lens, depth of field, palette, or the cat's pose. Make those decisions; do not leave them for the model to default on.

**Step 3 — Construct the prompt as a coherent scene description.** Write as if briefing someone who will create the image — clear prose or structured direction, not a comma-separated keyword dump.

Format: simple single-subject scenes with no strict preservation → connected prose. Complex scenes with several elements, strict preservation, or multiple references → structured groups with short labels:

```
References: [Image N → the aspects it governs, exact or loose]
Subject: [what is new or changed; leave what a reference shows to the reference]
Lighting: [setup, direction, quality]
Background / environment: [what to change or keep]
Style: [colour grade, aesthetic reference]
Constraints: [what must not appear or change]
```

Use only the labels that carry real information; not every prompt needs all of them.

### Handling user-provided prompts

**Vague idea** (e.g. "draw a cat at sunset"): this is an intent signal, not a finished prompt. Expand it into a complete visual specification, weaving the user's original phrasing in naturally so their core intent passes through.

**Detailed, crafted prompt**: respect their work. Use their prompt as the primary body and only append what the generation API needs but the prompt lacks (dimensions, technical specs, reference roles). Do not rewrite or "improve" their wording.

**Either way**, the user's own words — their specific nouns, adjectives, and descriptive phrases — must survive into the final prompt so their intent reaches the model unfiltered.

## Multi-view consistency (anchor-then-expand)

When the user wants multiple views of the same subject — fashion multi-view sheets, character design sheets, product 360° views — do not generate all views in one call. Tasks in one call run concurrently and share no output; each independently interprets the original reference, so results diverge.

Use two sequential calls:

1. **Establish the anchor image** — generate a single clean front-facing view from the original reference. This fixes the model's interpretation of the design before any other view is produced. The anchor is more reliable than the original reference because it is already in the target presentation style with no occlusion or angle distortion.
2. **Expand from the anchor** — pass the anchor image as `reference_images[0]` for every remaining view. All tasks in this call can run concurrently because they share the same anchor. Do not chain views off each other (side referencing back referencing front) — drift accumulates.

Key rules:

- Always anchor from the front view — it exposes the most design information with no occlusion.
- All non-anchor views must reference the anchor image, not each other.
- The anchor path comes from the earlier `add_canvas_elements` result; do not guess or hardcode it.
- This pattern applies to any multi-view task: fashion, characters, products, architecture.

## Image sizes

Select from the model's available sizes listed in the runtime context. Common fallbacks:

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

## Language and naming

The `prompt`, `name`, and any new `project_path` follow the user's language — no exceptions. Beyond language, the `name` must describe the **specific content** of that image — who or what is actually in it — not a generic category, a task slot number, or a theme-level label. When generating multiple images in one call, each task's `name` should capture what makes that task unique, not just its position in the batch.
