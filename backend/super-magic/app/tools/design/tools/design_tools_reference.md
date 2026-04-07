# 设计工具参考文档

本文档详细说明了 Design Mode 中所有可用的工具，包括工具功能、参数、返回值、以及对大模型和用户的提示信息。

---

## 📋 目录

1. [create_design_project](#1-create_design_project) - 创建设计项目
2. [delete_canvas_element](#2-delete_canvas_element) - 删除画布元素
3. [query_canvas_overview](#3-query_canvas_overview) - 查询画布概览
4. [query_canvas_element](#4-query_canvas_element) - 查询画布元素详情

---

## 1. create_design_project

### 🎯 工具说明

创建设计项目的基础结构，包括项目文件夹和配置文件。

**功能特性：**
- 自动创建项目文件夹
- 生成 `magic.project.js`（画布项目标识文件）
- 支持国际化项目名称（中文、日文、英文等）

**使用场景：**
- 开始新的设计项目
- 初始化画布工作区
- 为多个设计任务创建独立项目

**重要说明：**
- 包含 `magic.project.js` 的文件夹即为画布项目
- 所有画布工具都需要 `project_path` 参数指向包含此文件的文件夹
- 如果文件夹中没有 `magic.project.js`，工具将报错

---

### 📥 入参

| 参数名 | 类型 | 必需 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `project_path` | `string` | ✅ | - | 要创建的设计项目的相对路径，项目名称将从路径中自动提取（如 'xx/yy' 提取 'yy'） |

**参数示例：**

```json
{
  "project_path": "产品海报设计"
}
```

```json
{
  "project_path": "brand-design-2024"
}
```

```json
{
  "project_path": "projects/ブランドデザイン"
}
```

**参数验证：**
- `project_path` 必须提供
- 项目名称应反映设计主题
- 避免使用文件系统不支持的字符（如 `<>:"/\|?*`）

---

### 📤 出参

**成功时的返回结构：**

```python
ToolResult(
    content="""Project structure:
{project_path}/
└── magic.project.js  # Canvas project identifier (auto-managed)

Project: {project_name} (canvas project)"""
)
```

**失败时的返回结构：**

```python
ToolResult.error("Failed to create design project: {error_message}")
```

---

### 🤖 对大模型的提示

**LLM 在 `execute` 方法中看到的内容：**

1. **成功创建时的完整信息：**
   - 项目结构说明（包含 `magic.project.js`）
   - 项目名称和路径

2. **引导 LLM 的关键信息：**
   - `magic.project.js` 是画布项目标识文件，由工具自动管理
   - 输出格式简洁，避免冗余信息

**示例 LLM 输出：**

```
Project structure:
产品海报设计/
└── magic.project.js  # Canvas project identifier (auto-managed)

Project: 产品海报设计 (canvas project)
```

---

### 👤 对用户的提示

#### 1. `get_after_tool_call_friendly_action_and_remark`

**用户在工具执行后看到的简短提示：**

- **action**: "创建设计项目" (i18n: `ToolActionCodes.CREATE_DESIGN_PROJECT`)
- **remark**: "设计项目 {project_name} 创建成功" (i18n: `ToolMessageCodes.DESIGN_PROJECT_CREATE_SUCCESS`)

**示例输出：**

```
✅ 创建设计项目
设计项目 产品海报设计 创建成功
```

#### 2. `get_tool_detail`

**用户在前端看到的详细信息（Markdown 格式）：**

```markdown
## 🎨 设计项目创建成功

### 项目信息
- **项目名称**: 产品海报设计
- **项目路径**: `产品海报设计`

### 项目结构
```
产品海报设计/
└── magic.project.js  # 画布项目标识文件（自动管理）
```
```

**特点：**
- 使用表情符号（🎨）增强视觉效果
- 清晰展示项目路径和名称
- 说明项目结构和文件用途
- **不包含**"下一步建议"（仅展示操作结果）

---

## 2. delete_canvas_element

### 🎯 工具说明

从设计项目的画布上删除一个或多个元素。

**支持的操作：**
- **单个删除**：传入单个元素 ID
- **批量删除**：传入元素 ID 列表，一次性删除多个元素

**删除特性：**
- **幂等性**：多次删除同一个元素不会报错
- **容错性**：如果某些 ID 不存在，不影响其他 ID 的删除
- **详细统计**：返回删除成功和失败的详细信息

**注意事项：**
- 删除操作不可恢复（除非有备份）
- 删除 group 或 frame 元素不会自动删除其子元素
- 删除锁定的元素不会被阻止（工具层权限高于 UI 层）
- 删除元素后，其他元素的 z-index 不会自动调整

**使用场景：**
- 清理不需要的元素
- 批量删除临时元素
- 重新组织画布布局

---

### 📥 入参

| 参数名 | 类型 | 必需 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `project_path` | `string` | ✅ | - | 设计项目的相对路径 |
| `element_ids` | `string` \| `array` | ✅ | - | 要删除的元素 ID（字符串）或 ID 列表 |

**参数示例：**

```json
// 单个删除
{
  "project_path": "产品海报设计",
  "element_ids": "elem_abc123"
}
```

```json
// 批量删除
{
  "project_path": "产品海报设计",
  "element_ids": [
    "elem_abc123",
    "elem_def456",
    "elem_ghi789"
  ]
}
```

**参数验证：**
- `element_ids` 不能为空字符串或空数组
- 数组中的所有 ID 必须是非空字符串
- 会自动去重

---

### 📤 出参

**成功时的返回结构：**

```python
ToolResult(
    content="""Deletion Summary:
- Total Requested: {total}
- Successfully Deleted: {deleted}
- Not Found: {not_found}

Deleted Elements:
- {id} ({type} "{name}")
...

Not Found Elements:
- {id}
...

Changes saved to: {project_path}/magic.project.js"""
)
```

**失败时的返回结构：**

```python
ToolResult.error("Failed to delete canvas element(s): {error_message}")
```

---

### 🤖 对大模型的提示

**LLM 在 `execute` 方法中看到的内容：**

1. **成功删除时的完整信息：**
   - 删除统计（请求数量、成功数量、未找到数量）
   - 已删除元素的详细列表（ID、类型、名称）
   - 未找到元素的 ID 列表
   - 保存位置

2. **引导 LLM 的关键信息：**
   - 明确告知删除结果统计
   - 列出所有已删除和未找到的元素
   - 输出格式简洁，避免冗余信息

**示例 LLM 输出：**

```
Deletion Summary:
- Total Requested: 3
- Successfully Deleted: 2
- Not Found: 1

Deleted Elements:
- elem_abc123 (image "产品图片")
- elem_def456 (text "标题")

Not Found Elements:
- elem_ghi789

Changes saved to: 产品海报设计/magic.project.js
```

---

### 👤 对用户的提示

#### 1. `get_after_tool_call_friendly_action_and_remark`

**用户在工具执行后看到的简短提示：**

- **action**: "删除画布元素" (i18n: `ToolActionCodes.DELETE_CANVAS_ELEMENT`)
- **remark**: "删除画布元素成功" (i18n: `ToolMessageCodes.DESIGN_ELEMENT_DELETE_SUCCESS`)

**示例输出：**

```
✅ 删除画布元素
删除画布元素成功
```

#### 2. `get_tool_detail`

**用户在前端看到的详细信息（Markdown 格式）：**

```markdown
## 🗑️ 画布元素删除成功

### 删除统计
- **请求删除**: 3 个元素

### 删除的元素 ID
- `elem_abc123`
- `elem_def456`
- `elem_ghi789`
```

**特点：**
- 使用 🗑️ 图标表示删除操作
- 显示请求删除的元素数量
- 列出所有删除的元素 ID（如果超过 10 个，只显示前 10 个）
- **不包含**"下一步建议"

---

## 3. query_canvas_overview

### 🎯 工具说明

查询设计项目画布的概览信息，返回优化的结构化数据格式。

**返回信息包括：**
- **项目基本信息**：项目名称、版本等
- **画布统计信息**：元素总数、可见元素数、类型分布等
- **空间分布信息**：画布边界、中心点等
- **元素列表**：按指定方式排序和过滤

**排序方式：**
- **layer**：按图层层级排序（zIndex 从小到大，底层元素在前）
- **position**：按位置排序（从左上到右下，先按 y 坐标后按 x 坐标）
- **type**：按元素类型分组排序

**过滤选项：**
- **visible_only**：只显示可见元素
- **element_types**：只显示指定类型的元素

**使用场景：**
- 快速了解画布上有哪些元素
- 获取画布的整体统计信息
- 为进一步操作提供上下文信息
- 分析画布的空间布局

**注意：**
- 此工具不包含详细的元素属性，如需详细信息请使用 `query_canvas_element`
- 返回的元素列表是简化格式，便于大模型快速理解
- 空画布也会返回成功结果，只是元素列表为空

---

### 📥 入参

| 参数名 | 类型 | 必需 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `project_path` | `string` | ✅ | - | 设计项目的相对路径 |
| `sort_by` | `string` | ❌ | `"layer"` | 排序方式：`layer`、`position`、`type` |
| `visible_only` | `boolean` | ❌ | `false` | 是否只显示可见元素 |
| `element_types` | `array` | ❌ | `None` | 元素类型过滤列表，如 `["image", "text"]` |
| `offset` | `integer` | ❌ | `0` | 分页偏移量，从第几个元素开始返回（从0开始） |
| `limit` | `integer` | ❌ | `50` | 每页最多返回多少个元素（最大值：50） |

**参数示例：**

```json
// 基本查询（默认按图层排序）
{
  "project_path": "产品海报设计"
}
```

```json
// 按位置排序
{
  "project_path": "产品海报设计",
  "sort_by": "position"
}
```

```json
// 只显示可见的图片和文本元素
{
  "project_path": "产品海报设计",
  "visible_only": true,
  "element_types": ["image", "text"]
}
```

```json
// 分页查询（第2页，每页50个）
{
  "project_path": "产品海报设计",
  "offset": 50,
  "limit": 50
}
```

**参数验证：**
- `sort_by` 必须是 `layer`、`position`、`type` 之一
- `offset` 必须 ≥ 0
- `limit` 必须在 1-50 之间（默认50）

---

### 📤 出参

**成功时的返回结构：**

```python
ToolResult(
    content="""Project Information:
- Project Name: {name}
- Project Version: {version}

Canvas Statistics:
- Total Elements: {total}
- Visible Elements: {visible}
- Locked Elements: {locked}
- Z-index Range: {min} ~ {max}

Element Type Distribution:
  • {type}: {count}
  ...

Spatial Distribution:
  • Bounds: ({min_x}, {min_y}) ~ ({max_x}, {max_y})
  • Canvas Size: {width} × {height}
  • Center Point: ({center_x}, {center_y})

Viewport State:
  • Scale: {scale}
  • Offset: ({x}, {y})

Pagination:
  • Showing: {showing} of {total_matched} (offset: {offset})
  • Remaining: {remaining_count} elements not shown

Elements:
  1. [{type}] {name} (element_id: {element_id})
     Position: ({x}, {y}), Size: {w}×{h}, Layer: {z}
     Visual: {summary}  # 仅图片元素显示视觉理解摘要
  ...

Remaining Elements Overview ({remaining_count} not shown):  # 当有剩余元素时显示
  • {type}: {count}
  ...

To view more elements, use offset={next_offset}"""
)
```

**失败时的返回结构：**

```python
ToolResult.error("Failed to query canvas overview: {error_message}")
```

---

### 🤖 对大模型的提示

**LLM 在 `execute` 方法中看到的内容：**

1. **成功查询时的完整信息：**
   - 项目名称和版本
   - 画布统计信息（元素总数、可见/锁定数量、z-index 范围）
   - 元素类型分布
   - 空间分布（边界、画布大小、中心点）
   - 视口状态（缩放、偏移）
   - 分页信息（当前显示数量、总匹配数、偏移量、剩余数量）
   - 元素列表（每页最多50个，包含位置、尺寸、图层、状态等信息）
   - **图片元素视觉理解摘要**（如果有，显示在元素信息下方）
   - 剩余元素概览（当有剩余元素时，显示按类型分组的统计）

2. **引导 LLM 的关键信息：**
   - 提供画布的全局视图
   - 明确告知分页状态和剩余元素数量
   - 列出元素的简化信息，便于快速浏览
   - 显示图片的视觉理解摘要，帮助 LLM 理解图片内容
   - 提示如何获取更多元素（使用新的 offset 值）
   - 输出格式简洁，避免冗余信息

3. **分页机制：**
   - 单次最多返回 50 个元素，防止上下文过载
   - 当有剩余元素时，显示剩余元素的类型统计
   - 提供下一页的 offset 值，方便 LLM 继续查询

**示例 LLM 输出（含分页和视觉理解）：**

```
Project Information:
- Project Name: 产品海报设计
- Project Version: 1.0.0

Canvas Statistics:
- Total Elements: 65
- Visible Elements: 60
- Locked Elements: 5
- Z-index Range: 0 ~ 64

Element Type Distribution:
  • image: 25
  • text: 20
  • rectangle: 15
  • ellipse: 5

Spatial Distribution:
  • Bounds: (0.00, 0.00) ~ (1920.00, 1080.00)
  • Canvas Size: 1920.00 × 1080.00
  • Center Point: (960.00, 540.00)

Viewport State:
  • Scale: 1.00
  • Offset: (0.0, 0.0)

Pagination:
  • Showing: 50 of 65 (offset: 0)
  • Remaining: 15 elements not shown

Elements:
  1. [rectangle] 背景 (element_id: element-001)
     Position: (0, 0), Size: 1920×1080, Layer: 0
  2. [image] 产品图片 (element_id: element-002)
     Position: (100, 100), Size: 400×300, Layer: 1
     Visual: A high-quality smartphone with sleek design on white background
  3. [text] 标题 (element_id: element-003)
     Position: (50, 50), Size: 500×80, Layer: 2
  ...
  50. [image] Banner (element_id: element-050)
      Position: (800, 900), Size: 320×180, Layer: 49
      Visual: Colorful promotional banner with text and graphics

Remaining Elements Overview (15 not shown):
  • image: 5
  • text: 7
  • ellipse: 3

To view more elements, use offset=50
```

---

### 👤 对用户的提示

#### 1. `get_after_tool_call_friendly_action_and_remark`

**用户在工具执行后看到的简短提示：**

- **action**: "查询画布概览" (i18n: `ToolActionCodes.QUERY_CANVAS_OVERVIEW`)
- **remark**: "查询画布概览成功" (i18n: `ToolMessageCodes.DESIGN_CANVAS_OVERVIEW_QUERY_SUCCESS`)

**示例输出：**

```
✅ 查询画布概览
查询画布概览成功
```

#### 2. `get_tool_detail`

**用户在前端看到的详细信息（Markdown 格式）：**

```markdown
## 📊 画布概览查询完成

### 查询配置
- **项目路径**: `产品海报设计`
- **排序方式**: layer
- **仅可见元素**: 否

---

Canvas overview query completed successfully.

Project Information:
- Project Name: 产品海报设计
- Project Version: 1.0.0

...（完整的查询结果）
```

**特点：**
- 使用 📊 图标表示统计查询
- 显示查询配置（项目路径、排序方式、过滤条件）
- 包含完整的查询结果（项目信息、统计、元素列表等）
- **不包含**"下一步建议"（仅在 LLM 输出中有）

---

## 4. query_canvas_element

### 🎯 工具说明

查询设计项目画布上指定元素的详细信息，返回完整的元素属性和上下文信息。

**返回信息根据元素类型不同而不同：**

**通用信息（所有元素）：**
- 基本属性：ID、名称、类型、位置、尺寸、图层等
- 状态信息：可见性、锁定状态、透明度等
- 上下文信息：周围元素、图层关系

**图片元素特有信息：**
- 图片源路径
- 文件信息（是否存在、大小、格式等）
- AI 生成信息（如果是 AI 生成的图片）
- 视觉理解信息（如果有缓存）
  - 如果元素没有视觉理解信息，会**自动执行视觉理解**并保存

**文本元素特有信息：**
- 富文本内容
- 默认样式
- 文本统计（字符数、段落数等）

**形状元素特有信息：**
- 填充颜色
- 描边属性
- 特殊属性（圆角、边数等）

**容器元素特有信息：**
- 子元素列表
- 容器类型（frame/group）

**使用场景：**
- 查看元素的完整配置
- 分析元素与其他元素的关系
- 获取元素的上下文信息
- 为编辑操作提供详细信息

**注意：**
- 元素 ID 必须存在，否则返回错误
- 返回的信息根据元素类型自动调整
- 周围元素分析可能需要一定的计算时间

---

### 📥 入参

| 参数名 | 类型 | 必需 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `project_path` | `string` | ✅ | - | 设计项目的相对路径 |
| `element_id` | `string` | ✅ | - | 要查询的元素 ID |
| `include_surrounding` | `boolean` | ❌ | `true` | 是否包含周围元素分析 |
| `include_layer_context` | `boolean` | ❌ | `true` | 是否包含图层关系分析 |

**参数示例：**

```json
// 基本查询（包含周围元素和图层关系）
{
  "project_path": "产品海报设计",
  "element_id": "elem_abc123"
}
```

```json
// 只查询元素本身的信息
{
  "project_path": "产品海报设计",
  "element_id": "elem_abc123",
  "include_surrounding": false,
  "include_layer_context": false
}
```

---

### 📤 出参

**成功时的返回结构：**

```python
ToolResult(
    content="""Element Information:
- ID: {id}
- Name: {name}
- Type: {type}
- Position: ({x}, {y})
- Size: {width} × {height}
- Layer (z-index): {z_index}
- Status: {status}

{Type-Specific Properties}

Surrounding Elements (Top 5 by distance):
  1. [{type}] {name} - {distance}px {direction}
  ...

Layers Below (closest 3):
  • [{type}] {name} (z-index: {z})
  ...

Layers Above (closest 3):
  • [{type}] {name} (z-index: {z})
  ..."""
)
```

**失败时的返回结构：**

```python
ToolResult.error("Failed to query canvas element: {error_message}")
```

可能的错误信息：
- "Element with ID '{element_id}' not found."

---

### 🤖 对大模型的提示

**LLM 在 `execute` 方法中看到的内容：**

1. **成功查询时的完整信息：**
   - 元素基本信息（ID、名称、类型、位置、尺寸、图层）
   - 元素状态（可见性、锁定状态、透明度）
   - 元素类型特定的属性：
     - 图片：源路径、文件信息、生成信息、视觉理解
     - 文本：文本内容、样式、统计
     - 形状：填充色、描边、特殊属性
     - 容器：子元素列表
   - 周围元素分析（最近的 5 个元素，包含距离和方向）
   - 图层关系（上方和下方最近的 3 个图层）

2. **引导 LLM 的关键信息：**
   - 提供元素的完整上下文
   - 明确展示元素与周围元素的关系
   - 显示图层叠放关系
   - 输出格式简洁，避免冗余信息

3. **视觉理解自动触发（图片元素缺失视觉信息）：**
   - 当查询图片元素且元素没有 `visualUnderstanding` 属性时，会自动执行视觉理解
   - 视觉理解结果会自动保存到元素，下次查询直接使用缓存
   - 视觉理解失败不会阻止查询操作，只会记录警告日志

**示例 LLM 输出（图片元素，含视觉理解）：**

```
Element Information:
- ID: elem_abc123
- Name: 产品图片
- Type: image
- Position: (100, 100)
- Size: 400 × 300
- Layer (z-index): 1
- Status: Normal

Image Properties:
  • Source: images/product.jpg
  • File Status: Exists
  • File Size: 245.3 KB
  • AI Generated: Yes
    - Model: dall-e-3
    - Prompt: A high-quality product photo with white background
  • Visual Understanding:
    - Summary: A modern smartphone with sleek design on white background
    - Analyzed At: 2024-12-24T10:30:00Z
    - Details: {...}

Surrounding Elements (Top 5 by distance):
  1. [text] 标题 - 71.0px above
  2. [rectangle] 背景 - 141.4px left
  3. [image] Logo - 608.3px right
  4. [text] 描述 - 412.3px below
  5. [star] 装饰 - 520.8px right

Layers Below (closest 3):
  • [rectangle] 背景 (z-index: 0)

Layers Above (closest 3):
  • [text] 标题 (z-index: 2)
  • [text] 描述 (z-index: 3)
  • [image] Logo (z-index: 10)
```

---

### 👤 对用户的提示

#### 1. `get_after_tool_call_friendly_action_and_remark`

**用户在工具执行后看到的简短提示：**

- **action**: "查询画布元素" (i18n: `ToolActionCodes.QUERY_CANVAS_ELEMENT`)
- **remark**: "查询元素 {element_id} 成功" (i18n: `ToolMessageCodes.DESIGN_ELEMENT_QUERY_SUCCESS`)

**示例输出：**

```
✅ 查询画布元素
查询元素 elem_abc123 成功
```

#### 2. `get_tool_detail`

**用户在前端看到的详细信息（Markdown 格式）：**

```markdown
## 🔍 画布元素详情查询完成

### 查询配置
- **元素 ID**: `elem_abc123`
- **包含周围元素**: 是
- **包含图层关系**: 是

---

Canvas element query completed successfully.

Element Information:
- ID: elem_abc123
- Name: 产品图片
- Type: image
...（完整的查询结果）
```

**特点：**
- 使用 🔍 图标表示查询操作
- 显示查询配置（元素 ID、是否包含周围元素和图层关系）
- 包含完整的元素详情（基本信息、类型特定属性、周围元素、图层关系等）
- **不包含**"下一步建议"（仅在 LLM 输出中有）

---

## 📚 附录

### A. 视觉理解功能说明

**功能概述：**

视觉理解（Visual Understanding）是一个自动化的 AI 功能，用于分析图片元素的内容并生成结构化的描述信息。此功能在图片元素的生命周期中自动触发，无需手动调用。

**触发时机：**

| 工具 | 触发条件 | 说明 |
|------|---------|------|
| `generate_images_to_canvas` | 生成图片并创建元素时 | 自动对新图片执行视觉理解 |
| `query_canvas_element` | 查询图片元素且无视觉信息时 | 自动补充缺失的视觉理解 |
| `query_canvas_overview` | - | 只显示已有的摘要，不触发新分析 |

**输出数据结构：**

```json
{
  "summary": "一句话描述（80字以内）",
  "analyzedAt": "2024-12-24T10:30:00Z",
  "detailed": {
    "theme": "图片主题描述",
    "mainObjects": ["主要物体1", "主要物体2"],
    "colors": ["主要颜色1", "主要颜色2"],
    "style": "风格描述",
    "composition": "构图描述",
    "mood": "情感氛围",
    "technicalAspects": "技术特点"
  }
}
```

**字段说明：**

- **summary**：简短摘要（80字符以内），用于快速了解图片内容，显示在 `query_canvas_overview` 中
- **analyzedAt**：分析时间戳（ISO 8601 格式）
- **detailed**：详细分析结果，包含多个维度的信息：
  - `theme`: 图片的主题和核心内容
  - `mainObjects`: 图片中的主要物体列表
  - `colors`: 主要颜色列表
  - `style`: 图片风格（如写实、卡通、抽象等）
  - `composition`: 构图方式（如居中、三分法、对称等）
  - `mood`: 情感氛围（如温馨、专业、活泼等）
  - `technicalAspects`: 技术特点（如光线、景深、后期处理等）

**缓存机制：**

- 视觉理解结果会自动缓存到系统临时目录，避免重复分析
- 缓存基于图片路径的哈希值
- 缓存会在元素保存时写入 `visualUnderstanding` 属性

**失败处理：**

- 视觉理解失败不会阻止元素操作（创建、更新、查询）
- 失败时只记录警告日志，元素操作正常完成
- 支持自动重试机制（最多1次重试）

**使用建议：**

- 视觉理解对工作区内的本地图片效果最佳
- 对于 URL 图片，确保 URL 可访问
- 图片文件应为常见格式（JPG、PNG、GIF、WebP）
- 视觉理解可能需要几秒钟时间，请耐心等待

---

### B. 分页功能说明

**功能概述：**

`query_canvas_overview` 工具支持分页查询，单次最多返回 50 个元素，防止上下文过载。

**分页参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `offset` | integer | 0 | 从第几个元素开始返回（从0开始） |
| `limit` | integer | 50 | 每页最多返回多少个元素（最大50） |

**分页逻辑：**

1. 工具首先根据 `sort_by`、`visible_only`、`element_types` 过滤和排序元素
2. 从 `offset` 位置开始，返回最多 `limit` 个元素
3. 如果还有剩余元素，显示剩余元素的类型统计概览
4. 提供下一页的 `offset` 值（`offset + showing`）

**使用示例：**

```json
// 第1页（前50个元素）
{
  "project_path": "大型项目",
  "offset": 0,
  "limit": 50
}

// 第2页（51-100个元素）
{
  "project_path": "大型项目",
  "offset": 50,
  "limit": 50
}

// 第3页（101-150个元素）
{
  "project_path": "大型项目",
  "offset": 100,
  "limit": 50
}
```

**剩余元素概览：**

当查询结果超过 `limit` 时，工具会在输出末尾显示剩余元素的统计信息：

```
Remaining Elements Overview (35 not shown):
  • image: 15
  • text: 12
  • rectangle: 8

To view more elements, use offset=50
```

**注意事项：**

- `offset` 超出总元素数量时，返回空列表（不报错）
- `limit` 超过 50 时会被限制为 50
- 分页基于过滤后的结果集，不是全部元素

---

### C. 元素类型参考

| 类型 | 标识符 | 必需尺寸 | 特有属性 |
|------|--------|----------|----------|
| 图片 | `image` | ✅ | `src`, `generateImageRequest`, `visualUnderstanding` |
| 文本 | `text` | ❌ | `content`, `defaultStyle` |
| 矩形 | `rectangle` | ✅ | `fill`, `stroke`, `strokeWidth`, `cornerRadius` |
| 圆形 | `ellipse` | ✅ | `fill`, `stroke`, `strokeWidth` |
| 三角形 | `triangle` | ✅ | `fill`, `stroke`, `strokeWidth` |
| 星形 | `star` | ✅ | `fill`, `stroke`, `strokeWidth`, `sides`, `innerRadiusRatio` |
| 画框 | `frame` | ✅ | `children` |
| 组 | `group` | ❌ | `children` |

### D. 图层操作参考

| 操作 | 标识符 | 说明 | z-index 变化 |
|------|--------|------|-------------|
| 置于顶层 | `bring_to_front` | 将元素置于所有其他元素之上 | max + 1 |
| 上移一层 | `bring_forward` | 将元素向上移动一层 | current + 1 |
| 下移一层 | `send_backward` | 将元素向下移动一层 | current - 1 (min 0) |
| 置于底层 | `send_to_back` | 将元素置于所有其他元素之下 | 0 |
| 设置图层 | `set_zindex` | 设置元素到指定图层 | specified value |

### E. 排序方式参考

| 排序方式 | 标识符 | 说明 |
|----------|--------|------|
| 按图层 | `layer` | 按 z-index 从小到大排序，底层元素在前 |
| 按位置 | `position` | 按位置从左上到右下排序，先按 y 后按 x |
| 按类型 | `type` | 按元素类型分组排序 |

### F. 常见错误信息

| 错误信息 | 原因 | 解决方案 |
|----------|------|----------|
| `magic.project.js does not exist` | 项目文件夹不包含画布配置文件 | 使用 `create_design_project` 创建项目 |
| `Element with ID 'xxx' not found` | 元素 ID 不存在 | 使用 `query_canvas_overview` 查看所有元素 ID |
| `Element with ID 'xxx' already exists` | 元素 ID 已被使用 | 使用不同的 ID 或不指定 ID（自动生成） |
| `Element type 'xxx' requires both width and height` | 缺少必需的尺寸参数 | 为该类型元素提供 width 和 height |
| `z_index is required when action is 'set_zindex'` | set_zindex 操作缺少 z_index 参数 | 提供 z_index 参数 |

### G. 国际化代码参考

**动作代码 (ToolActionCodes):**
- `CREATE_DESIGN_PROJECT` - 创建设计项目
- `CREATE_CANVAS_ELEMENT` - 创建画布元素
- `UPDATE_CANVAS_ELEMENT` - 更新画布元素
- `DELETE_CANVAS_ELEMENT` - 删除画布元素
- `REORDER_CANVAS_ELEMENTS` - 调整图层顺序
- `QUERY_CANVAS_OVERVIEW` - 查询画布概览
- `QUERY_CANVAS_ELEMENT` - 查询画布元素

**消息代码 (ToolMessageCodes):**
- `DESIGN_PROJECT_CREATE_SUCCESS` - 设计项目创建成功
- `DESIGN_ELEMENT_CREATE_SUCCESS` - 元素创建成功
- `DESIGN_ELEMENT_UPDATE_SUCCESS` - 元素更新成功
- `DESIGN_ELEMENT_DELETE_SUCCESS` - 元素删除成功
- `DESIGN_ELEMENT_REORDER_SUCCESS` - 图层调整成功
- `DESIGN_CANVAS_OVERVIEW_QUERY_SUCCESS` - 画布概览查询成功
- `DESIGN_ELEMENT_QUERY_SUCCESS` - 元素查询成功

---

### H. Token 优化说明

**优化目标：**

为了减少大模型的 token 消耗，所有工具的输出格式都经过优化，移除了冗余信息。

**主要优化措施：**

1. **移除 "Next:" 建议行**
   - 旧格式：每个工具输出末尾都有 "Next: Use xxx to ..." 的建议
   - 新格式：移除所有建议行，让 LLM 自主判断下一步操作

2. **简化状态消息**
   - 旧格式：`"Canvas element created successfully."`
   - 新格式：直接输出元素详情，不需要成功消息前缀

3. **移除查询设置段落**
   - `query_canvas_overview` 不再输出 "Query Settings" 段落
   - 查询条件已在分页信息中体现，无需重复

4. **禁用 Emoji**
   - 工具输出给 LLM 的内容不使用 emoji
   - 保持专业、简洁的文本格式

**效果评估：**

- 平均每次工具调用节省约 20-50 tokens
- 输出更简洁，LLM 更易理解核心信息
- 不影响功能完整性，所有必要信息均保留

---

**文档版本**: 2.0.0
**最后更新**: 2025-12-24
**作者**: Super Magic Team
