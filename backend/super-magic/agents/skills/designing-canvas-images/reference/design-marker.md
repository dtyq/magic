<!--zh
# 设计标记处理指南
-->
# Design Marker Processing Guide

<!--zh
## 什么是设计标记
-->
## What is a Design Marker

<!--zh: 用户在图片上标记需要修改或添加内容的区域。-->
Users mark areas on images that need modification or content addition.

<!--zh: **格式：** `[@design_marker:标记名称]`-->
**Format:** `[@design_marker:marker_name]`

<!--zh: **示例信息：**-->
**Example information:**
```
[@design_marker:红色耳朵]
- <!--zh: 图片位置:-->Image location: project/images/dog.jpg
- <!--zh: 标记区域:-->Marked area: <!--zh: 图片上方右侧的小区域-->Small area at top right of image
- <!--zh: 坐标:-->Coordinates: <!--zh: 左上角(64.0%, 7.0%)-->Top left (64.0%, 7.0%)
```

<!--zh
## 核心原则
-->
## Core Principles

<!--zh
1. **使用图生图方式** - 原图作为参考生成新图
2. **原图保持不变** - 生成新元素，不修改或删除原元素
3. **不创建独立元素** - "添加XX"不是在画布上创建独立的XX元素
-->
1. **Use image-to-image method** - Use original image as reference to generate new image
2. **Original image remains unchanged** - Generate new elements, do not modify or delete original elements
3. **Do not create independent elements** - "Add XX" does not mean creating an independent XX element on canvas

<!--zh
## 处理步骤
-->
## Processing Steps

<!--zh
### 1. 解析标记信息
-->
### 1. Parse Marker Information

<!--zh
从标记中提取：
- **标记名称** - 用户想要做什么修改
- **图片位置** - 原图的路径
- **标记区域** - 在图片的哪个位置
- **坐标** - 具体的百分比位置
-->
Extract from marker:
- **Marker name** - What modification the user wants
- **Image location** - Path of original image
- **Marked area** - Which part of the image
- **Coordinates** - Specific percentage position

<!--zh
### 2. 查询原图尺寸
-->
### 2. Query Original Image Size

```python
from sdk.tool import tool

result = tool.call('query_canvas_element', {
  "project_path": "my-project",
  "src": "my-project/images/dog.jpg"
})

# <!--zh: 使用 result.data 获取结构化数据-->Use result.data to get structured data
if result.ok and result.data:
    width = result.data['size']['width']
    height = result.data['size']['height']
    src = result.data['image_properties']['src']
```

<!--zh
### 3. 构造 Prompt
-->
### 3. Construct Prompt

<!--zh
**格式：** `[位置] + [修改内容] + [保持原貌]`
-->
**Format:** `[location] + [modification] + [keep original]`

```
<!--zh: "将图片右上角的耳朵改为红色，保持其他部分完全不变"-->
"Change the ear at the top right of the image to red, keeping all other parts completely unchanged"
```

<!--zh
### 4. 调用图生图
-->
### 4. Call Image-to-Image

```python
from sdk.tool import tool

# <!--zh: 假设已从 query_canvas_element 获取了 width 和 height-->Assume width and height are obtained from query_canvas_element
result = tool.call('generate_images_to_canvas', {
  "project_path": "my-project",
  "image_paths": ["my-project/images/dog.jpg"],
  "prompts": ["将右上角的耳朵改为红色，保持其他部分不变"],
  "size": f"{width}x{height}"  # <!--zh: 使用原图尺寸-->Use original image size
})
```

<!--zh
## 完整示例
-->
## Complete Example

<!--zh
**标记信息：**
```
[@design_marker:红色耳朵]
- 图片位置: my-design/images/dog.jpg
- 标记区域: 图片上方右侧
```

**用户需求：** "把耳朵改成红色"

**处理流程：**
-->
**Marker information:**
```
[@design_marker:红色耳朵]
- Image location: my-design/images/dog.jpg
- Marked area: Top right of image
```

**User requirement:** "Change the ear to red"

**Processing flow:**
```python
# <!--zh: 1. 查询原图元素获取尺寸-->1. Query original image element to get size
from sdk.tool import tool

result = tool.call('query_canvas_element', {
  "project_path": "my-design",
  "src": "my-design/images/dog.jpg"
})

# <!--zh: 2. 使用 result.data 获取原图信息-->2. Use result.data to get original image info
if result.ok and result.data:
    width = result.data['size']['width']
    height = result.data['size']['height']
    src = result.data['image_properties']['src']

    # <!--zh: 3. 使用图生图生成新图片-->3. Use image-to-image to generate new image
    result2 = tool.call('generate_images_to_canvas', {
      "project_path": "my-design",
      "image_paths": [src],
      "prompts": ["将图片右上方的耳朵改为红色，保持其他部分不变"],
      "size": f"{width}x{height}"
    })
```

<!--zh
## Prompt 编写模板
-->
## Prompt Writing Templates

<!--zh
### 颜色修改
-->
### Color Modification
```
<!--zh: "将[位置]的[物体]改为[颜色]，保持其他部分不变"-->
"Change [object] at [location] to [color], keeping other parts unchanged"
```

<!--zh
### 添加元素
-->
### Add Element
```
<!--zh: "在[位置]添加[元素]，保持原图构图不变"-->
"Add [element] at [location], keeping original composition unchanged"
```

<!--zh
### 移除元素
-->
### Remove Element
```
<!--zh: "移除[位置]的[元素]，保持背景自然"-->
"Remove [element] at [location], keeping background natural"
```

<!--zh
### 风格调整
-->
### Style Adjustment
```
<!--zh: "将[位置]的[元素]调整为[风格]，保持整体协调"-->
"Adjust [element] at [location] to [style], keeping overall harmony"
```

<!--zh
## 位置描述转换
-->
## Location Description Conversion

<!--zh
| 标记区域描述 | Prompt 位置描述 |
|-------------|----------------|
| 图片上方右侧 | 右上角 |
| 图片左侧中间 | 左侧中央 |
| 图片底部中央 | 底部中间 |
| 图片中心区域 | 中央位置 |
-->
| Marked Area Description | Prompt Location Description |
|-------------|----------------|
| Top right of image | Top right corner |
| Left middle of image | Left center |
| Bottom center of image | Bottom middle |
| Center area of image | Center position |

<!--zh
## 注意事项
-->
## Notes

<!--zh
1. **始终用图生图** - 提供 `image_paths` 参数
2. **明确位置** - 在 prompt 中说明具体位置
3. **强调保持原貌** - 避免改变其他部分
4. **保持原图尺寸** - 传入 width 和 height
5. **生成新图** - 不修改原图元素
-->
1. **Always use image-to-image** - Provide `image_paths` parameter
2. **Specify location** - State specific location in prompt
3. **Emphasize keeping original** - Avoid changing other parts
4. **Maintain original size** - Pass width and height
5. **Generate new image** - Do not modify original image element
