---
name: designing-canvas-images
description: Canvas (画布) project management skill providing AI image generation, web image search, and design marker processing. Automatically used for all image generation tasks to organize and manage images. Supports image-to-image generation and design marker processing. Skip canvas only when users explicitly request without canvas or when operating on images in other applications like webpages or PPT. CRITICAL - When user message contains [@design_canvas_project:...] or [@design_marker:...] mentions, you MUST load this skill first before any operations.

name-cn: 画布项目管理
description-cn: 画布项目管理技能，提供 AI 图片生成、网络图片搜索和设计标记处理能力。在所有图片生成任务中自动使用，用于组织和管理图片。支持图生图和设计标记处理。仅在用户明确要求不使用画布或操作其他应用中的图片（如网页、PPT）时跳过画布。关键规则 - 当用户消息包含 [@design_canvas_project:...] 或 [@design_marker:...] 引用时，必须首先加载此技能再进行任何操作。
---

<!--zh
# 画布图片设计技能
-->
# Canvas Image Design Skill

<!--zh: 提供 AI 图片生成、网络图片搜索下载和设计标记处理能力。-->
Provides AI image generation, web image search and download, and design marker processing capabilities.

---

<!--zh
## 如何使用本文档
-->
## How to Use This Document

<!--zh
本文档提供**快速指引**，涵盖基础用法和核心规则。当遇到以下情况时，阅读对应的 reference 文档：

- **图生图详细规范** → [reference/image-generation.md](reference/image-generation.md)
- **网络图片搜索** → [reference/image-search.md](reference/image-search.md)
- **设计标记处理** (`[@design_marker:xxx]`) → [reference/design-marker.md](reference/design-marker.md)
-->
This document provides **quick guidance** covering basic usage and core rules. When encountering the following situations, read the corresponding reference documentation:

- **Detailed Image-to-Image Guidelines** → [reference/image-generation.md](reference/image-generation.md)
- **Web Image Search** → [reference/image-search.md](reference/image-search.md)
- **Design Marker Processing** (`[@design_marker:xxx]`) → [reference/design-marker.md](reference/design-marker.md)

---

<!--zh
## 代码执行方式（关键）
-->
## Code Execution Method (Critical)

<!--zh
本技能中所有 Python 代码示例，在 Agent 环境中**必须通过 `run_skills_snippet` 工具执行**。

**正确示例**：
-->
All Python code examples in this skill **must be executed via the `run_skills_snippet` tool** in Agent environment.

**Correct example**:
```python
# Correct! Must use run_skills_snippet to execute
run_skills_snippet(
    python_code="""
from sdk.tool import tool
result = tool.call('create_design_project', {
    "project_path": "my-design"
})
"""
)
```

<!--zh
本文档中所有 `from sdk.tool import tool` 开头的代码块，均遵循此规则，通过 `run_skills_snippet` 的 `python_code` 参数传入执行。
-->
All code blocks in this document starting with `from sdk.tool import tool` follow this rule: pass them via the `python_code` parameter of `run_skills_snippet` for execution.

---

<!--zh
## 快速开始
-->
## Quick Start

<!--zh
**创建新画布项目：**
-->
**Create a new canvas project:**
```python
from sdk.tool import tool

result = tool.call('create_design_project', {
    "project_path": "my-design"
})
```

<!--zh
**生成 AI 图片：**
-->
**Generate AI images:**
```python
from sdk.tool import tool

result = tool.call('generate_images_to_canvas', {
    "project_path": "my-design",
    "name": "北京景点",
    "prompts": ["长城全景，专业摄影", "故宫太和殿，专业摄影", "天坛祈年殿，专业摄影"],
    "size": "2048x2048"
})
```

<!--zh
**查询画布概览：**
-->
**Query canvas overview:**
```python
from sdk.tool import tool

result = tool.call('query_canvas_overview', {
    "project_path": "my-design",
    "sort_by": "layer"
})
```

<!--zh
**通过图片路径查询元素：**
-->
**Query element by image path:**
```python
from sdk.tool import tool

result = tool.call('query_canvas_element', {
    "project_path": "my-design",
    "src": "my-design/images/cat.jpg"
})
```

<!--zh
## 核心工具及必填参数
-->
## Core Tools and Required Parameters

<!--zh
### create_design_project - 创建画布项目
-->
### create_design_project - Create Canvas Project

<!--zh
| 参数 | 必填 | 说明 |
|------|------|------|
| `project_path` | 是 | 项目相对路径，如 `"my-design"` |
-->
| Parameter | Required | Description |
|------|------|------|
| `project_path` | Yes | Project relative path, e.g., `"my-design"` |

<!--zh
**返回数据 (result.data)：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `project_path` | string | 项目路径 |
| `project_name` | string | 项目名称 |
-->
**Return data (result.data):**

| Field | Type | Description |
|------|------|------|
| `project_path` | string | Project path |
| `project_name` | string | Project name |

<!--zh
### generate_images_to_canvas - 生成 AI 图片
-->
### generate_images_to_canvas - Generate AI Images

<!--zh
| 参数 | 必填 | 说明 |
|------|------|------|
| `project_path` | 是 | 项目路径 |
| `name` | 是 | 元素名称，多张时自动添加后缀 `_1`, `_2` |
| `prompts` | 是 | 提示词列表（多 prompts 模式最多 6 个） |
| `size` | 是 | 图片尺寸，格式：`'宽度x高度'`，如 `"2048x2048"`, `"2560x1440"` |
| `image_count` | 否 | 组图数量，最多 4 张（与多 prompts 互斥） |
| `image_paths` | 否 | 参考图路径（图生图时使用） |
-->
| Parameter | Required | Description |
|------|------|------|
| `project_path` | Yes | Project path |
| `name` | Yes | Element name, automatically adds suffix `_1`, `_2` for multiple images |
| `prompts` | Yes | List of prompts (max 6 prompts for multiple prompts mode) |
| `size` | Yes | Image size, format: `'widthxheight'`, e.g., `"2048x2048"`, `"2560x1440"` |
| `image_count` | No | Number of images in a set, max 4 (mutually exclusive with multiple prompts) |
| `image_paths` | No | Reference image paths (used for image-to-image generation) |

<!--zh
**返回数据 (result.data)：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `created_elements` | array | 创建的元素列表，每个包含 `{ id, name, type, x, y, width, height }` |
| `succeeded_count` | number | 成功生成的图片数量 |
| `failed_count` | number | 失败的图片数量 |
-->
**Return data (result.data):**

| Field | Type | Description |
|------|------|------|
| `created_elements` | array | Created element list, each contains `{ id, name, type, x, y, width, height }` |
| `succeeded_count` | number | Number of successfully generated images |
| `failed_count` | number | Number of failed images |

<!--zh
### query_canvas_overview - 查询画布概览
-->
### query_canvas_overview - Query Canvas Overview

<!--zh
| 参数 | 必填 | 说明 |
|------|------|------|
| `project_path` | 是 | 项目路径 |
| `sort_by` | 否 | 排序方式：`"layer"`, `"position"`, `"type"` |
| `visible_only` | 否 | 是否只显示可见元素 |
-->
| Parameter | Required | Description |
|------|------|------|
| `project_path` | Yes | Project path |
| `sort_by` | No | Sort method: `"layer"`, `"position"`, `"type"` |
| `visible_only` | No | Whether to show only visible elements |

<!--zh
**返回数据 (result.data)：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `elements` | array | 元素列表，每个元素包含 `{ id, name, type, size, position }` |
| `canvas_info.total_elements` | number | 元素总数 |
| `project_name` | string | 项目名称 |
-->
**Return data (result.data):**

| Field | Type | Description |
|------|------|------|
| `elements` | array | Element list, each contains `{ id, name, type, size, position }` |
| `canvas_info.total_elements` | number | Total element count |
| `project_name` | string | Project name |

<!--zh
### query_canvas_element - 查询元素详情
-->
### query_canvas_element - Query Element Details

<!--zh
| 参数 | 必填 | 说明 |
|------|------|------|
| `project_path` | 是 | 项目路径 |
| `element_id` | 否 | 元素 ID（与 `src` 二选一）|
| `src` | 否 | 图片路径（与 `element_id` 二选一，用于通过图片路径查找元素）|
-->
| Parameter | Required | Description |
|------|------|------|
| `project_path` | Yes | Project path |
| `element_id` | No | Element ID (choose one between `element_id` and `src`) |
| `src` | No | Image path (choose one between `element_id` and `src`, used to find element by image path) |

<!--zh
**返回数据 (result.data)：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `size` | `{ width, height }` | 元素尺寸，图生图时使用 |
| `image_properties.src` | string | 图片路径（图片元素） |
| `id` | string | 元素 ID |
| `name` | string | 元素名称 |
-->
**Return data (result.data):**

| Field | Type | Description |
|------|------|------|
| `size` | `{ width, height }` | Element size, use for image-to-image |
| `image_properties.src` | string | Image path (for image elements) |
| `id` | string | Element ID |
| `name` | string | Element name |

<!--zh
## 关键规则
-->
## Key Rules

<!--zh
### 坐标系统
-->
### Coordinate System

<!--zh
画布采用绝对坐标系统：
- **坐标原点**：画布左上角为 (0, 0)
- **坐标方向**：X 轴向右为正，Y 轴向下为正
- **x, y 坐标含义**：表示元素的**左上角位置**（相对于画布的绝对坐标）
- **画布无限大**：可以在任意位置放置元素
-->
Canvas uses absolute coordinate system:
- **Coordinate origin**: Canvas top-left corner is (0, 0)
- **Coordinate direction**: X-axis increases rightward, Y-axis increases downward
- **x, y coordinate meaning**: Represents the **top-left corner position** of the element (absolute coordinates relative to canvas)
- **Infinite canvas**: Elements can be placed at any position

<!--zh
### 图片处理原则
-->
### Image Processing Principles

<!--zh
1. **禁止修改原图文件** - 所有内容变更必须创建新元素
2. **禁止删除元素** - 任何情况下都不要删除元素
3. **禁止通过属性修改图片内容** - 不能通过任何方式改变图片内容（如改颜色、加文字）
4. **内容变更用 generate_images_to_canvas** - 创建新元素，保持原元素不变
5. **"在图片上添加XX" 意味着图生图** - 生成包含新内容的图片，不是在画布上创建独立的XX元素
-->
1. **Do not modify original image files** - All content changes must create new elements
2. **Do not delete elements** - Never delete elements under any circumstances
3. **Do not modify image content through properties** - Cannot change image content in any way (e.g., changing colors, adding text)
4. **Use generate_images_to_canvas for content changes** - Create new elements while keeping original elements unchanged
5. **"Add XX to image" means image-to-image** - Generate images containing new content, NOT create separate XX element on canvas

<!--zh
### 操作流程原则
-->
### Operation Flow Principles

<!--zh
1. **画布选择：默认使用同一个画布** - 除非用户明确要求新建画布
   - 优先查找或复用已有项目，避免不必要的项目创建
   - 只有在用户明确表达"新建画布"、"创建新项目"等意图时，才创建新项目
2. **操作已有画布必须先查询** - 使用 `query_canvas_overview`
3. **不要臆想文件路径** - 必须基于查询结果引用路径
4. **图生图前查询原图尺寸** - 使用 `query_canvas_element` 通过 `src` 参数查询
-->
1. **Canvas Selection: By default, use the same canvas** - Unless user explicitly requests a new canvas
   - Prioritize finding or reusing existing projects, avoid unnecessary project creation
   - Only create new projects when user explicitly expresses intent like "create new canvas" or "create new project"
2. **Must query existing canvases before operations** - Use `query_canvas_overview`
3. **Do not assume file paths** - Must reference paths based on query results
4. **Query original image size before image-to-image** - Use `query_canvas_element` with `src` parameter

<!--zh
## 图片尺寸说明
-->
## Image Size Guide

<!--zh
**尺寸格式：** `'宽度x高度'`，如 `'2048x2048'`

**可用尺寸：** 从用户消息中的"当前图片生成模型可用的尺寸选项"中选择

**常见尺寸**（如果配置中未提供可用尺寸时使用）：
- `'2048x2048'` - 2K 正方形（推荐，适合大多数场景）
- `'2304x1728'` - 横版矩形
- `'1728x2304'` - 竖版矩形
- `'2560x1440'` - 16:9 横版
- `'1440x2560'` - 9:16 竖版
- `'2496x1664'` - 3:2 横版
- `'1664x2496'` - 2:3 竖版
- `'3024x1296'` - 超宽横版

**图生图尺寸处理：**
- 如果用户没有明确要求特定尺寸，使用参考图的原始尺寸
- 如果用户明确指定了尺寸，使用用户指定的尺寸
-->
**Size format:** `'widthxheight'`, e.g., `'2048x2048'`

**Available sizes:** Select from "当前图片生成模型可用的尺寸选项" in the user message

**Common sizes** (use when no available sizes in configuration):
- `'2048x2048'` - 2K square (recommended, suitable for most scenarios)
- `'2304x1728'` - Horizontal rectangle
- `'1728x2304'` - Vertical rectangle
- `'2560x1440'` - 16:9 horizontal
- `'1440x2560'` - 9:16 vertical
- `'2496x1664'` - 3:2 horizontal
- `'1664x2496'` - 2:3 vertical
- `'3024x1296'` - Ultra-wide horizontal

**Image-to-image size handling:**
- If user hasn't explicitly requested a specific size, use the reference image's original size
- If user explicitly specified a size, use the user-specified size

---

<!--zh
## AI 生成模式选择
-->
## AI Generation Mode Selection

<!--zh
### 模式 1：不同主题的独立图片
-->
### Mode 1: Independent Images of Different Themes

<!--zh
**生成不同主题的图片** → 使用多个 prompts（最多 6 个）
-->
**Generate images of different themes** → Use multiple prompts (max 6)
```python
from sdk.tool import tool

result = tool.call('generate_images_to_canvas', {
    "project_path": "landmarks",
    "name": "北京景点",
    "prompts": ["长城全景", "故宫太和殿", "天坛祈年殿", "颐和园昆明湖"],
    "size": "2048x2048"
}))
```

<!--zh
### 模式 2：风格统一的变体（组图）
-->
### Mode 2: Style-Consistent Variants (Set)

<!--zh
**生成风格统一的变体** → 使用单个 prompt + image_count（最多 4 张）
-->
**Generate style-consistent variants** → Use single prompt + image_count (max 4)
```python
from sdk.tool import tool

result = tool.call('generate_images_to_canvas', {
    "project_path": "product",
    "name": "产品图",
    "prompts": ["产品摄影，多角度展示"],
    "image_count": 4,
    "size": "2048x2048"
}))
```

<!--zh
### 模式 3：图生图（基于参考图）
-->
### Mode 3: Image-to-Image (Based on Reference)

<!--zh
基于已有图片生成新图片，适合修改设计或处理设计标记。

**重要：图生图前必须查询原图尺寸并使用相同尺寸**
-->
Generate new images based on existing images, suitable for design modifications or processing design markers.

**Important: Must query original image size before image-to-image and use the same size**

```python
# Step 1: Query original image size by src
from sdk.tool import tool

result = tool.call('query_canvas_element', {
    "project_path": "my-design",
    "src": "my-design/images/cat.jpg"
})

# Step 2: Use result.data to get original size
if result.ok and result.data:
    width = result.data['size']['width']
    height = result.data['size']['height']
    src = result.data['image_properties']['src']

    # Step 3: Generate with same size
    result2 = tool.call('generate_images_to_canvas', {
        "project_path": "my-design",
        "name": "修改后的猫",
        "image_paths": [src],
        "prompts": ["将右上角的耳朵改为红色，保持其他部分不变"],
        "size": f"{width}x{height}"
    })
```

<!--zh
### 图生图核心原则
-->
### Image-to-Image Core Principles

<!--zh
当用户提供参考图片时，遵循以下核心原则：

1. **必须使用参考图** - 包含 `image_paths` 参数，在 prompts 中强调保持视觉一致性
2. **保持主体完整** - 不添加原图不存在的内容，保持产品数量和种类一致
3. **区分主体与风格** - 可改变拍摄风格、背景、光影，但不改变主体本身特征
4. **精确传达需求** - 将用户的每个关键词写入 Prompt，明确说明如何使用参考图

> **需要详细说明？** 如遇复杂的图生图场景（如产品设计、品牌一致性要求等），请阅读：[reference/image-generation.md](reference/image-generation.md)
-->
When user provides reference images, follow these core principles:

1. **Must use reference images** - Include `image_paths` parameter, emphasize visual consistency in prompts
2. **Maintain subject integrity** - Don't add content not in original, keep product count and types consistent
3. **Separate subject from style** - Can change photography style, background, lighting, but not subject's features
4. **Precise requirement delivery** - Write every user keyword into Prompt, clearly state how to use reference

> **Need detailed explanation?** For complex image-to-image scenarios (e.g., product design, brand consistency requirements), read: [reference/image-generation.md](reference/image-generation.md)

<!--zh
## 设计标记处理
-->
## Design Marker Processing

<!--zh
### 什么是设计标记
-->
### What is Design Marker

<!--zh
用户在图片上标记需要修改或添加内容的区域，格式：`[@design_marker:标记名称]`

**示例信息：**
```
[@design_marker:红色耳朵]
- 图片位置: my-design/images/dog.jpg
- 标记区域: 图片上方右侧的小区域
- 坐标: 左上角(64.0%, 7.0%)
```
-->
Users mark areas on images that need modification or content addition. Format: `[@design_marker:marker_name]`

**Example information:**
```
[@design_marker:红色耳朵]
- Image location: my-design/images/dog.jpg
- Marked area: Small area at top right of image
- Coordinates: Top left (64.0%, 7.0%)
```

<!--zh
### 处理步骤
-->
### Processing Steps

<!--zh
1. **解析标记信息** - 从标记中提取图片位置、标记区域、用户需求
2. **查询原图尺寸** - 使用 `query_canvas_element(src=...)`
3. **构造 Prompt** - `[位置] + [修改内容] + [保持原貌]`
4. **调用图生图** - 使用 `generate_images_to_canvas` 的 `image_paths` 参数
-->
1. **Parse marker information** - Extract image location, marked area, user requirements from marker
2. **Query original image size** - Use `query_canvas_element(src=...)`
3. **Construct Prompt** - `[location] + [modification] + [keep original]`
4. **Call image-to-image** - Use `generate_images_to_canvas` with `image_paths` parameter

<!--zh
> **重要：** 如果用户消息中包含 `[@design_marker:xxx]` 标记，必须阅读详细处理流程：[reference/design-marker.md](reference/design-marker.md)
-->
> **Important:** If user message contains `[@design_marker:xxx]` markers, MUST read detailed processing workflow: [reference/design-marker.md](reference/design-marker.md)

---

<!--zh
## 工具选择决策树
-->
## Tool Selection Decision Tree

<!--zh
```
需要创建新画布？
├─ 是 → create_design_project
└─ 否 → 继续

需要生成AI图片？
├─ 是 → generate_images_to_canvas
│   ├─ 有参考图？→ 先 query_canvas_element (src) 查尺寸
│   ├─ 不同主题？→ 多个 prompts
│   └─ 风格统一？→ 单 prompt + image_count
└─ 否 → 继续

需要搜索网络图片？
├─ 是 → 详见 reference/image-search.md
└─ 否 → 继续

需要查询信息？
├─ 画布概览 → query_canvas_overview
├─ 元素详情（已知ID）→ query_canvas_element (element_id)
└─ 元素详情（已知图片路径）→ query_canvas_element (src)
```
-->
```
Need to create new canvas?
├─ Yes → create_design_project
└─ No → Continue

Need to generate AI images?
├─ Yes → generate_images_to_canvas
│   ├─ Have reference? → First query_canvas_element (src) to get size
│   ├─ Different themes? → Multiple prompts
│   └─ Style-consistent? → Single prompt + image_count
└─ No → Continue

Need to search web images?
├─ Yes → See reference/image-search.md
└─ No → Continue

Need to query information?
├─ Canvas overview → query_canvas_overview
├─ Element details (known ID) → query_canvas_element (element_id)
└─ Element details (known image path) → query_canvas_element (src)
```

<!--zh
## 网络图片搜索
-->
## Web Image Search

<!--zh
> **如需使用网络图片搜索功能：** 请参阅 [reference/image-search.md](reference/image-search.md)
-->
> **To use web image search:** See [reference/image-search.md](reference/image-search.md)
