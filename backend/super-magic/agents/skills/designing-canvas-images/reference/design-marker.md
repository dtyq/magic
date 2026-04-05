# Design Marker Processing Guide

## What is a Design Marker

Users mark areas on images that need modification or content addition.

**Format:** `[@design_marker:marker_name]`

**Example information:**
```
[@design_marker:红色耳朵]
- Image location: project/images/dog.jpg
- Marked area: Small area at top right of image
- Coordinates: Top left (64.0%, 7.0%)
```

## Core Principles

1. **Use image-to-image method** - Use original image as reference to generate new image
2. **Original image remains unchanged** - Generate new elements, do not modify or delete original elements
3. **Do not create independent elements** - "Add XX" does not mean creating an independent XX element on canvas

## Processing Steps

### 1. Parse Marker Information

Extract from marker:
- **Marker name** - What modification the user wants
- **Image location** - Path of original image
- **Marked area** - Which part of the image
- **Coordinates** - Specific percentage position

### 2. Query Original Image Size

```python
from sdk.tool import tool

result = tool.call('query_canvas_element', {
  "project_path": "my-project",
  "src": "my-project/images/dog.jpg"
})

# Use result.data to get structured data
if result.ok and result.data:
    width = result.data['size']['width']
    height = result.data['size']['height']
    src = result.data['image_properties']['src']
```

### 3. Construct Prompt

**Format:** `[location] + [modification] + [keep original]`

```
"Change the ear at the top right of the image to red, keeping all other parts completely unchanged"
```

### 4. Call Image-to-Image

```python
from sdk.tool import tool

# Assume width and height are obtained from query_canvas_element
result = tool.call('generate_images_to_canvas', {
  "project_path": "my-project",
  "name": "修改结果",
  "reference_images": ["my-project/images/dog.jpg"],
  "prompts": ["将右上角的耳朵改为红色，保持其他部分不变"],
  "size": f"{width}x{height}"  # Use original image size
})
```

## Complete Example

**Marker information:**
```
[@design_marker:红色耳朵]
- Image location: my-design/images/dog.jpg
- Marked area: Top right of image
```

**User requirement:** "Change the ear to red"

**Processing flow:**
```python
# 1. Query original image element to get size
from sdk.tool import tool

result = tool.call('query_canvas_element', {
  "project_path": "my-design",
  "src": "my-design/images/dog.jpg"
})

# 2. Use result.data to get original image info
if result.ok and result.data:
    width = result.data['size']['width']
    height = result.data['size']['height']
    src = result.data['image_properties']['src']

    # 3. Use image-to-image to generate new image
    result2 = tool.call('generate_images_to_canvas', {
      "project_path": "my-design",
      "name": "修改结果",
      "reference_images": [src],
      "prompts": ["将图片右上方的耳朵改为红色，保持其他部分不变"],
      "size": f"{width}x{height}"
    })
```

## Prompt Writing Templates

### Color Modification
```
"Change [object] at [location] to [color], keeping other parts unchanged"
```

### Add Element
```
"Add [element] at [location], keeping original composition unchanged"
```

### Remove Element
```
"Remove [element] at [location], keeping background natural"
```

### Style Adjustment
```
"Adjust [element] at [location] to [style], keeping overall harmony"
```

## Location Description Conversion

| Marked Area Description | Prompt Location Description |
|---|---|
| Top right of image | Top right corner |
| Left middle of image | Left center |
| Bottom center of image | Bottom middle |
| Center area of image | Center position |

## Notes

1. **Always use image-to-image** - Provide `reference_images` parameter
2. **Specify location** - State specific location in prompt
3. **Emphasize keeping original** - Avoid changing other parts
4. **Maintain original size** - Pass width and height
5. **Generate new image** - Do not modify original image element
