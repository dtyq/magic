<!--zh
# 网络图片搜索指南
-->
# Web Image Search Guide

<!--zh
## 工具：search_images_to_canvas
-->
## Tool: search_images_to_canvas

<!--zh: 从网络搜索图片并自动下载添加到画布。-->
Search images from the web and automatically download and add them to canvas.

<!--zh
## 必填参数
-->
## Required Parameters

<!--zh
| 参数 | 类型 | 说明 |
|------|------|------|
| `project_path` | string | 画布项目路径 |
| `topic_id` | string | 主题 ID，用于同主题下去重 |
| `requirements_xml` | string | XML 格式的搜索需求 |
-->
| Parameter | Type | Description |
|------|------|------|
| `project_path` | string | Canvas project path |
| `topic_id` | string | Topic ID for deduplication within the same topic |
| `requirements_xml` | string | XML-formatted search requirements |

<!--zh
## 可选参数
-->
## Optional Parameters

<!--zh
| 参数 | 类型 | 说明 |
|------|------|------|
| `name_prefix` | string | 名称前缀，默认使用 requirement.name |
-->
| Parameter | Type | Description |
|------|------|------|
| `name_prefix` | string | Name prefix, defaults to requirement.name |

<!--zh
## requirements_xml 格式
-->
## requirements_xml Format

```xml
<requirements>
  <requirement>
    <name>需求名称</name>
    <query>搜索关键词</query>
    <requirement_explanation>需求说明</requirement_explanation>
    <expected_aspect_ratio>期望宽高比</expected_aspect_ratio>
    <count>图片数量</count>
  </requirement>
</requirements>
```

<!--zh
### 字段说明
-->
### Field Description

<!--zh
| 字段 | 必填 | 说明 |
|------|------|------|
| `name` | 是 | 需求名称，用于标识和命名 |
| `query` | 是 | 搜索关键词 |
| `requirement_explanation` | 是 | 需求详细说明 |
| `expected_aspect_ratio` | 否 | 期望宽高比，如 `16:9`, `1:1`, `9:16` |
| `count` | 否 | 图片数量，默认 10，最多 20 |
-->
| Field | Required | Description |
|------|------|------|
| `name` | Yes | Requirement name for identification and naming |
| `query` | Yes | Search keywords |
| `requirement_explanation` | Yes | Detailed requirement explanation |
| `expected_aspect_ratio` | No | Expected aspect ratio, e.g., `16:9`, `1:1`, `9:16` |
| `count` | No | Number of images, default 10, maximum 20 |

<!--zh
## 完整示例
-->
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

<!--zh
## 去重机制
-->
## Deduplication Mechanism

<!--zh
使用 `topic_id` 参数避免同主题重复图片：
-->
Use `topic_id` parameter to avoid duplicate images within the same topic:

```python
from sdk.tool import tool

# <!--zh: 第一次搜索-->First search
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

# <!--zh: 第二次搜索（自动过滤已有图片）-->Second search (automatically filters existing images)
result2 = tool.call('search_images_to_canvas', {
    "project_path": "my-project",
    "topic_id": "cats",  # <!--zh: 相同的 topic_id-->Same topic_id
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

<!--zh
## 多需求搜索
-->
## Multiple Requirements Search

<!--zh
可以在一个请求中包含多个搜索需求：
-->
Can include multiple search requirements in one request:

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

<!--zh
## 使用建议
-->
## Usage Recommendations

<!--zh
1. **明确关键词** - 使用具体、准确的搜索词
2. **合理数量** - 单个需求最多 20 张
3. **善用去重** - 相关主题使用相同 topic_id
4. **分批搜索** - 大量图片分多次搜索
5. **结合 AI 生成** - 搜不到合适图片时用 AI 生成
-->
1. **Clear keywords** - Use specific and accurate search terms
2. **Reasonable quantity** - Maximum 20 images per requirement
3. **Use deduplication** - Use same topic_id for related themes
4. **Batch searches** - Split large quantities into multiple searches
5. **Combine with AI generation** - Use AI generation when suitable images cannot be found

<!--zh
## 与 AI 生成对比
-->
## Comparison with AI Generation

<!--zh
| 特性 | 网络搜索 | AI 生成 |
|------|----------|---------|
| 速度 | 更快 | 较慢 |
| 单次数量 | 最多 20 张 | 最多 4 张 |
| 内容来源 | 现有图片库 | 全新生成 |
| 灵活性 | 受限于搜索结果 | 可定制任意内容 |
| 适用场景 | 需要真实照片 | 需要创意内容 |
-->
| Feature | Web Search | AI Generation |
|------|----------|---------|
| Speed | Faster | Slower |
| Single batch count | Maximum 20 | Maximum 4 |
| Content source | Existing image library | Newly generated |
| Flexibility | Limited by search results | Can customize any content |
| Use case | Need real photos | Need creative content |
