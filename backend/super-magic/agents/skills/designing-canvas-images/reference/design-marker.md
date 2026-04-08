# Design Marker Processing Guide

## What is a Design Marker

Users mark areas on canvas images that need modification. The marker encodes the target image, the marked region, and the user's intent.

**Format:** `[@design_marker:marker_name]`

**Example:**
```
[@design_marker:红色耳朵]
- Image location: my-design/images/dog.jpg
- Marked area: Small area at top right of image
- Coordinates: Top left (64.0%, 7.0%)
```

## Core Principles

1. **Image-to-image only** — use the original image as a reference to generate a new image
2. **Original stays untouched** — generate a new element; never modify or delete the original
3. **No independent overlays** — "add X to image" means image-to-image generation, not placing a separate element on the canvas

## Processing Steps

### 1. Parse the marker

Extract from the marker information:
- **Marker name** — what the user wants changed (this is the intent)
- **Image path** — the file to use as reference
- **Marked area / coordinates** — which part of the image the change applies to

### 2. Understand the reference image

Call `visual_understanding` on the image path. This returns:
- The image's dimensions (use these for the `size` parameter)
- A content description (use this to write a precise prompt — you need to know what the image contains to describe what should change and what should stay)

### 3. Build the prompt

Apply the Prompt Engineering principles from the main skill. The marker gives you three things to work with:

- **Where** — the marked region (use the marker coordinates directly in the prompt for precision)
- **What to change** — the marker name + any additional user instructions
- **What to preserve** — everything else in the image

Write the prompt as a coherent instruction that explicitly states all three. Do not use generic templates — the prompt should be specific to this image and this change, informed by what `visual_understanding` told you about the image content.

### 4. Generate

```python
from sdk.tool import tool

# visual_understanding was already called and returned:
# - dimensions: 1920x1080
# - content: "A golden retriever sitting on grass, looking at camera,
#   with pointed ears, warm afternoon sunlight from the left"

tool.call('generate_images_to_canvas', {
    "project_path": "my-design",
    "name": "dog-red-ear",
    "reference_images": ["my-design/images/dog.jpg"],
    "prompts": [
        "A golden retriever sitting on grass, looking at camera, warm afternoon sunlight from the left. "
        "Change only the ear in the upper-right area to bright red — same fur texture, same lighting, "
        "just the color changed to a vivid red. "
        "Preserve the dog's face, body, pose, the grass, and the entire background exactly as they appear."
    ],
    "size": "1920x1080"
})
```

Notice how the prompt incorporates the visual understanding result to describe the full scene, then specifies the change precisely, then locks everything else.

## Using Marker Coordinates

Pass marker coordinates directly into the prompt — they are precise percentage positions that image models can interpret. Combine them with the object name from visual understanding for maximum clarity.

Example: marker says `Top-left (64.0%, 7.0%)` and visual understanding confirms an ear is there → prompt says "the ear at approximately (64%, 7%) in the image".

## Key Points

1. Always provide `reference_images` with the original image path
2. Always use the original image's dimensions for `size`
3. The prompt must describe the full scene (from visual understanding), not just the change
4. Explicitly state what is preserved — do not assume the model will keep unchanged areas intact by default
5. Generate a new canvas element — the original image element must remain unchanged
