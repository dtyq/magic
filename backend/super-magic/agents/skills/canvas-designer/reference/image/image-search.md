# Web Image Search Guide

## Tool: search_images_to_canvas

Search images from the web and automatically download and add them to canvas.

## Required Parameters

| Parameter | Type | Description |
|---|---|---|
| `project_path` | string | Canvas project path |
| `topic_id` | string | Topic ID for deduplication within the same topic |
| `requirements_xml` | string | XML-formatted search requirements |

## Optional Parameters

| Parameter | Type | Description |
|---|---|---|
| `name_prefix` | string | Name prefix, defaults to requirement.name |

## requirements_xml Format

```xml
<requirements>
  <requirement>
    <name>requirement name</name>
    <query>search keywords</query>
    <requirement_explanation>detailed description</requirement_explanation>
    <expected_aspect_ratio>16:9</expected_aspect_ratio>
    <count>10</count>
  </requirement>
</requirements>
```

### Field Description

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Requirement name for identification and naming |
| `query` | Yes | Search keywords |
| `requirement_explanation` | Yes | Detailed requirement explanation |
| `expected_aspect_ratio` | No | Expected aspect ratio, e.g., `16:9`, `1:1`, `9:16` |
| `count` | No | Number of images, default 10, maximum 20 |

## Complete Example

```python
from sdk.tool import tool

result = tool.call('search_images_to_canvas', {
    "project_path": "design-inspiration",
    "topic_id": "home-design",
    "requirements_xml": """<requirements>
    <requirement>
      <name>极简家居</name>
      <query>极简主义家居设计 室内装修</query>
      <requirement_explanation>需要现代简约风格的家居室内图片</requirement_explanation>
      <expected_aspect_ratio>16:9</expected_aspect_ratio>
      <count>10</count>
    </requirement>
  </requirements>"""
})
```

## Deduplication Mechanism

Use `topic_id` to avoid duplicate images within the same topic:

```python
from sdk.tool import tool

# First search
result1 = tool.call('search_images_to_canvas', {
    "project_path": "my-project",
    "topic_id": "cats",
    "requirements_xml": """<requirements>
    <requirement>
      <name>猫咪</name>
      <query>猫咪 宠物摄影</query>
      <requirement_explanation>可爱的猫咪图片</requirement_explanation>
      <count>10</count>
    </requirement>
  </requirements>"""
})

# Second search (automatically filters existing images via same topic_id)
result2 = tool.call('search_images_to_canvas', {
    "project_path": "my-project",
    "topic_id": "cats",
    "requirements_xml": """<requirements>
    <requirement>
      <name>可爱猫</name>
      <query>可爱的猫 萌宠</query>
      <requirement_explanation>超萌的猫咪图片</requirement_explanation>
      <count>10</count>
    </requirement>
  </requirements>"""
})
```

## Multiple Requirements Search

Include multiple requirements in one request:

```python
from sdk.tool import tool

result = tool.call('search_images_to_canvas', {
    "project_path": "pet-album",
    "topic_id": "pets",
    "requirements_xml": """<requirements>
    <requirement>
      <name>狗狗</name>
      <query>可爱的狗 宠物摄影</query>
      <requirement_explanation>各种可爱的狗狗图片</requirement_explanation>
      <expected_aspect_ratio>1:1</expected_aspect_ratio>
      <count>5</count>
    </requirement>
    <requirement>
      <name>猫咪</name>
      <query>猫咪 宠物摄影</query>
      <requirement_explanation>各种可爱的猫咪图片</requirement_explanation>
      <expected_aspect_ratio>1:1</expected_aspect_ratio>
      <count>5</count>
    </requirement>
  </requirements>"""
})
```

## Usage Recommendations

1. **Clear keywords** - Use specific and accurate search terms
2. **Reasonable quantity** - Maximum 20 images per requirement
3. **Use deduplication** - Use same `topic_id` for related themes
4. **Batch searches** - Split large quantities into multiple searches
5. **Combine with AI generation** - Use AI generation when suitable images cannot be found

## Comparison with AI Generation

| Feature | Web Search | AI Generation |
|---|---|---|
| Speed | Faster | Slower |
| Single batch count | Maximum 20 | Maximum 6 |
| Content source | Existing image library | Newly generated |
| Flexibility | Limited by search results | Can customize any content |
| Use case | Need real photos | Need creative content |
