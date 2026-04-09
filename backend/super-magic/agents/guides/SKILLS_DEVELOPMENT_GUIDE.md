# Skills 开发指南

> 基于 [Anthropic 官方 Skills 规范](https://github.com/anthropics/skills) 整理

## 目录

- [什么是 Skill？](#什么是-skill)
- [目录结构](#目录结构)
- [SKILL.md 文件规范](#skillmd-文件规范)
  - [基本格式](#基本格式)
  - [必需元数据字段](#必需元数据字段)
  - [可选元数据字段](#可选元数据字段)
  - [多语言支持](#多语言支持可选)
  - [Markdown 正文结构](#markdown-正文结构)
- [最佳实践](#最佳实践)
- [工具参数说明规范](#工具参数说明规范)
- [工具返回值说明规范](#工具返回值说明规范)
- [高级功能](#高级功能)
  - [添加参考文档](#添加参考文档)
  - [添加脚本](#添加脚本)
  - [脚本文档规范](#脚本文档规范)
- [安全注意事项](#安全注意事项)
- [完整示例](#完整示例)
- [参考资源](#参考资源)

---

## 什么是 Skill？

Skill 是一组指令、脚本和资源的文件夹，Agent 会动态加载以提升在特定任务上的表现。Skill 教会 Agent 如何以可重复的方式完成特定任务，例如：
- 使用公司的品牌指南创建文档
- 使用组织特定的工作流程分析数据
- 自动化个人任务

## 目录结构

```
my-skill/
├── SKILL.md              # 必需 - 核心指令文件
├── reference/            # 可选 - 参考文档目录
│   ├── workflow.md       # 工作流程说明
│   └── examples.md       # 使用示例
├── scripts/              # 可选 - 辅助脚本目录
│   ├── helper.py         # Python 脚本
│   └── util.js           # JavaScript 脚本
└── resources/            # 可选 - 资源文件目录
    ├── templates/        # 模板文件
    └── assets/           # 其他资源
```

## SKILL.md 文件规范

### 基本格式

SKILL.md 文件必须以 **YAML frontmatter** 开头，后跟 Markdown 内容：

```markdown
---
name: skill-name
description: 清晰描述 Skill 的功能和使用场景
---

# Skill 标题

[Markdown 格式的详细指令]
```

### 必需元数据字段

| 字段 | 说明 | 限制 |
|------|------|------|
| `name` | Skill 的唯一标识符 | 仅限小写字母、数字和连字符 |
| `description` | 描述 Skill 的功能和使用时机 | 最多 1024 字符，**非常关键** - Agent 使用此描述来决定何时调用 Skill |

#### 命名规范

名字应和 Skill 的核心身份完全吻合——既不过宽也不过窄，一眼就能判断它的职责边界。

好的命名示例：
- `find-skill`：职责单一明确，名字就是它的完整定义
- `skill-creator`：名词复合，描述它扮演的角色
- `deep-research`：修饰语 + 名词，描述能力的性质与深度
- `im-channels`：领域名词，覆盖该领域下所有操作

避免用动词形式（如 `creating-slides`）——动词会把名称锁定在单一操作上，Skill 功能一扩展就名不副实。涵盖多种操作的 Skill 用名词（`slides`）更准确。

同样避免过于宽泛的词：`helper`、`utils`、`tools`、`documents`、`data`。

### 可选元数据字段

| 字段 | 说明 | 示例 |
|------|------|------|
| `allowed-tools` | 限制 Skill 可使用的工具 | `Read, Grep, Glob` 或列表格式 |
| `model` | 指定使用的模型 | `claude-sonnet-4-20250514` |
| `context` | 上下文模式，`fork` 表示在分叉上下文中运行 | `fork` |
| `agent` | 指定 agent 类型 | `Explore`, `Plan`, `general-purpose` |
| `hooks` | 定义 Skill 的钩子（PreToolUse, PostToolUse, Stop） | 见下方示例 |
| `user-invocable` | 是否允许用户通过 `/skill-name` 手动调用 | `true` / `false` |
| `disable-model-invocation` | 禁止模型自动调用此 Skill | `true` |

### 多语言支持（可选）

如果你的 Skill 需要支持多语言（如中英文双语），可以在元数据中添加本地化字段：

```yaml
---
name: example-skill
description: Example skill for demonstration
name-cn: 示例技能
description-cn: 用于演示的示例技能
---
```

在正文中使用 HTML 注释标记实现双语支持：

```markdown
<!--zh
# 中文标题
-->
# English Title

<!--zh: 这是中文说明-->
This is English description
```

**注意事项：**
- 多语言支持是可选的，适用于需要国际化的 Skills
- 中文内容使用 `<!--zh` 和 `-->` 包裹（块级）或 `<!--zh: 内容-->` 格式（行内）
- 英文作为默认语言，直接书写

### Markdown 正文结构

> **重要**: SKILL.md 正文应保持在 **500 行以内**以获得最佳性能。超过此限制时，应将内容拆分到单独的文件中。

#### 推荐的章节组织

根据 Skill 的复杂度，选择合适的结构：

**简单 Skill（< 200 行）：**
```
# 标题
简短描述
## 核心能力
## 使用示例
## 注意事项
```

**中等 Skill（200-500 行）：**
```
# 标题
简短描述
## 如何使用本文档（可选，有 reference 时推荐）
## 快速开始
## 核心工具及参数
## 关键规则/原则
## 使用示例
## 工作流程/决策树
## 参考文档
```

**复杂 Skill（> 500 行，需拆分）：**
```
# 标题（主文档 SKILL.md）
简短描述
## 如何使用本文档 ⬅️ 必需，指导 AI 何时查阅详细文档
## 快速开始
## 核心工具及参数（简化版）
## 关键规则（仅核心规则）
## 基础示例
## 参考文档 ⬅️ 必需，列出所有详细文档
```

#### 完整示例模板

```markdown
---
name: example-skill
description: 示例 Skill，展示标准结构
---

# Example Skill

简短的功能概述（1-2 句话）。

---

## 如何使用本文档

本文档提供**快速指引**，涵盖基础用法和核心规则。当遇到以下情况时，阅读对应的 reference 文档：

- **详细配置说明** → [reference/configuration.md](reference/configuration.md)
- **高级用法** → [reference/advanced-usage.md](reference/advanced-usage.md)
- **故障排查** → [reference/troubleshooting.md](reference/troubleshooting.md)

---

## 快速开始

**创建基础项目：**
```python
from sdk.tool import tool

result = tool.call('create_project', {
    "name": "my-project"
})
```

**处理数据：**
```python
from sdk.tool import tool

result = tool.call('process_data', {
    "project": "my-project",
    "input": "data.csv"
})
```

## 核心工具及参数

### create_project - 创建项目

| 参数 | 必填 | 说明 |
|------|------|------|
| `name` | 是 | 项目名称 |
| `type` | 否 | 项目类型，默认 `"default"` |

**返回数据 (result.data)：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `project_id` | string | 项目 ID |
| `created_at` | string | 创建时间 |

### process_data - 处理数据

| 参数 | 必填 | 说明 |
|------|------|------|
| `project` | 是 | 项目名称 |
| `input` | 是 | 输入文件路径 |
| `options` | 否 | 处理选项 |

**返回数据 (result.data)：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `output_path` | string | 输出文件路径 |
| `processed_count` | number | 处理的记录数 |

## 关键规则

### 数据处理原则

1. **禁止修改原始文件** - 所有操作必须创建新文件
2. **验证输入格式** - 处理前必须验证数据格式
3. **错误处理** - 失败时保持原始数据不变

### 工作流程原则

1. **先查询再操作** - 操作前使用查询工具确认状态
2. **不要假设路径** - 必须基于查询结果引用路径
3. **批量处理限制** - 单次最多处理 100 条记录

## 工作流程决策树

```
需要创建新项目？
├─ 是 → create_project
└─ 否 → 继续

需要处理数据？
├─ 是 → process_data
│   ├─ 数据量 > 100？→ 分批处理
│   └─ 数据量 ≤ 100？→ 单次处理
└─ 否 → 继续

需要查询信息？
├─ 项目列表 → list_projects
└─ 项目详情 → get_project_info
```

## 使用示例

### 示例 1：基本工作流

```python
from sdk.tool import tool

# Step 1: 创建项目
result = tool.call('create_project', {
    "name": "my-project"
})

# Step 2: 处理数据
if result.ok and result.data:
    project_id = result.data['project_id']

    result2 = tool.call('process_data', {
        "project": project_id,
        "input": "data.csv"
    })

    if result2.ok:
        print(f"处理完成：{result2.data['output_path']}")
```

### 示例 2：批量处理

```python
from sdk.tool import tool

# 大数据集分批处理
data_files = ["batch1.csv", "batch2.csv", "batch3.csv"]

for file in data_files:
    result = tool.call('process_data', {
        "project": "my-project",
        "input": file
    })
```

## 注意事项

1. 所有文件路径必须使用相对路径
2. 处理大文件时注意内存使用
3. 建议在生产环境启用错误日志

## 参考文档

详细用法请查阅 reference 目录：
- `configuration.md` - 完整配置说明
- `advanced-usage.md` - 高级使用场景
- `api-reference.md` - 完整 API 参考
```

## 最佳实践

### 1. 保持专注

创建多个专注的 Skill，而不是一个大而全的 Skill。多个专注的 Skill 组合使用效果更好。

### 2. 编写清晰的描述

`description` 字段非常关键，Agent 使用它来决定何时调用 Skill。要具体说明适用场景。

**好的描述示例：**
```yaml
description: Canvas (画布) design skill for AI image generation and web image search. Use when users need to create canvas projects, generate AI images, or search and download web images.
```

**差的描述示例：**
```yaml
description: 一个设计工具
```

### 3. 从简单开始

先用基本的 Markdown 指令开始，再根据需要添加复杂的脚本。

### 4. 使用示例

在 SKILL.md 中包含输入输出示例，帮助 Agent 理解预期效果。

### 5. 渐进式测试

每次重大更改后都进行测试，而不是一次性构建复杂的 Skill。

### 6. 渐进式披露

SKILL.md 作为概述，指向详细材料供 Agent 按需加载（类似于指南中的目录）：
- SKILL.md 正文保持在 500 行以内
- 接近限制时拆分内容到单独文件
- Agent 只在需要时加载引用的文件

### 7. 清晰的参数和返回值说明

**使用表格说明参数：**

| 参数 | 必填 | 类型 | 说明 |
|------|------|------|------|
| `project_path` | 是 | string | 项目相对路径 |
| `name` | 是 | string | 元素名称 |
| `options` | 否 | object | 可选配置项 |

**明确说明返回数据结构：**

```python
# 返回数据 (result.data)：
{
    "id": "element_123",           # string - 元素 ID
    "name": "图片_1",               # string - 元素名称
    "size": {                       # object - 尺寸信息
        "width": 2048,              # number - 宽度（像素）
        "height": 2048              # number - 高度（像素）
    },
    "created_at": "2024-01-01"     # string - 创建时间
}
```

### 8. 提供决策树和工作流程

帮助 AI 快速判断使用哪个工具：

```
需要创建画布？
├─ 是 → create_canvas
└─ 否 → 继续

需要生成图片？
├─ 有参考图？→ 先查询尺寸，再调用 generate_canvas_images
├─ 不同主题？→ 使用多个 prompts
└─ 风格统一？→ 使用单 prompt + image_count
```

### 9. 明确限制和禁止操作

使用清晰的语言说明不能做什么：

```markdown
## 关键规则

1. **禁止修改原图文件** - 所有内容变更必须创建新元素
2. **禁止删除元素** - 任何情况下都不要删除元素
3. **必须先查询再操作** - 操作前使用查询工具确认状态
```

### 10. 提供"何时查阅详细文档"的指引

在主文档开头添加指引章节：

```markdown
## 如何使用本文档

本文档提供**快速指引**，涵盖基础用法和核心规则。当遇到以下情况时，阅读对应的 reference 文档：

- **复杂的图生图场景** → [reference/image-generation.md](reference/image-generation.md)
- **网络图片搜索** → [reference/image-search.md](reference/image-search.md)
- **设计标记处理** (`[@design_marker:xxx]`) → [reference/design-marker.md](reference/design-marker.md)
```

### 11. 展示完整的代码工作流

不仅展示单个工具调用，还要展示完整的工作流程：

```python
# Step 1: 理解原图内容和尺寸
result = tool.call('visual_understanding', {
    "images": ["my-design/images/cat.jpg"],
    "question": "Describe this image in detail, including its content and dimensions."
})

# Step 2: 基于理解结果生成新图（size 省略时自动从参考图读取）
if result.ok:
    result2 = tool.call('generate_canvas_images', {
        "project_path": "my-design",
        "tasks": [{
            "name": "修改后的猫",
            "reference_images": ["my-design/images/cat.jpg"],
            "prompt": "修改描述"
        }]
    })
```

### 12. 脚本使用规范

如果 Skill 包含脚本，使用标准的命令行文档格式：

**文档结构：**
- **SYNOPSIS**: 命令格式概览
- **DESCRIPTION**: 功能详细说明
- **OPTIONS**: 参数表格（选项、类型、必填、说明）
- **OUTPUT**: 返回数据结构说明
- **EXAMPLES**: 使用 shell_exec 工具执行的示例

**关键规则：**
1. 脚本通过 `shell_exec` 工具执行
2. 必须指定 `cwd` 参数（工作目录）
3. 参数使用标准的 `--param-name` 格式
4. 示例要展示如何解析返回的 JSON 结果

**示例格式：**

```markdown
**EXAMPLES**

使用 shell_exec 工具执行：

- **命令**: `python scripts/get_data.py --format json --limit 10`
- **工作目录**: `agents/skills/my-skill`

返回 JSON 格式的数据，可以解析 `result.content` 获取结果。
```

## 工具参数说明规范

清晰说明每个工具的参数，包括必填/可选、类型、说明、默认值等。

### 基本表格格式

```markdown
### tool_name - 工具名称

| 参数 | 必填 | 类型 | 说明 |
|------|------|------|------|
| `project_path` | 是 | string | 项目相对路径 |
| `name` | 是 | string | 元素名称 |
| `size` | 是 | string | 图片尺寸，格式：`'宽度x高度'`，如 `"2048x2048"` |
| `options` | 否 | object | 可选配置项，默认 `{}` |
```

### 参数互斥关系说明

当某些参数不能同时使用时，要明确说明：

```markdown
| 参数 | 必填 | 说明 |
|------|------|------|
| `element_id` | 否 | 元素 ID（与 `src` 二选一）|
| `src` | 否 | 图片路径（与 `element_id` 二选一）|
| `prompts` | 是 | 提示词列表 |
| `image_count` | 否 | 组图数量（与多个 prompts 互斥）|
```

### 复杂参数的详细说明

对于复杂的参数格式，提供清晰的说明和示例：

```markdown
### search_images_to_canvas - 搜索网络图片

| 参数 | 必填 | 说明 |
|------|------|------|
| `requirements_xml` | 是 | XML 格式的搜索需求 |

**requirements_xml 格式：**

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

**字段说明：**

| 字段 | 必填 | 说明 |
|------|------|------|
| `name` | 是 | 需求名称 |
| `query` | 是 | 搜索关键词 |
| `requirement_explanation` | 是 | 需求详细说明 |
| `expected_aspect_ratio` | 否 | 期望宽高比，如 `16:9`, `1:1` |
| `count` | 否 | 图片数量，默认 10，最多 20 |
```

### 参数值的枚举说明

当参数只接受特定值时，明确列出：

```markdown
| 参数 | 必填 | 说明 |
|------|------|------|
| `sort_by` | 否 | 排序方式：`"layer"`, `"position"`, `"type"` |
| `format` | 否 | 输出格式：`"json"` 或 `"xml"`，默认 `"json"` |
```

### 参数约束和限制

明确说明参数的约束条件：

```markdown
| 参数 | 必填 | 说明 |
|------|------|------|
| `prompts` | 是 | 提示词列表，**最多 4 个元素** |
| `size` | 是 | 图片尺寸，格式 `'宽x高'`，宽高范围 512-4096 |
| `image_count` | 否 | 图片数量，1-4 之间的整数 |
```

## 工具返回值说明规范

在 SKILL.md 中清晰说明工具的返回数据结构，帮助 AI 正确处理返回值。

### 基本格式

在每个工具说明后添加"返回数据"章节：

```markdown
### tool_name - 工具名称

| 参数 | 必填 | 说明 |
|------|------|------|
| `param1` | 是 | 参数说明 |

**返回数据 (result.data)：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `field1` | string | 字段说明 |
| `field2` | number | 字段说明 |
| `nested.field` | object | 嵌套字段说明 |
```

### 详细示例

**简单返回值：**

```markdown
**返回数据 (result.data)：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `project_id` | string | 项目唯一标识符 |
| `project_name` | string | 项目名称 |
| `created_at` | string | 创建时间（ISO 8601 格式）|
```

**复杂嵌套结构：**

```markdown
**返回数据 (result.data)：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `elements` | array | 元素列表 |
| `elements[].id` | string | 元素 ID |
| `elements[].name` | string | 元素名称 |
| `elements[].size` | object | 尺寸信息 |
| `elements[].size.width` | number | 宽度（像素）|
| `elements[].size.height` | number | 高度（像素）|
| `canvas_info` | object | 画布信息 |
| `canvas_info.total_elements` | number | 元素总数 |
```

### 在代码示例中展示如何使用返回值

不仅说明返回值结构，还要展示如何使用：

```python
# Step 1: 调用工具
result = tool.call('generate_canvas_images', {
    "project_path": "my-design",
    "tasks": [{
        "name": "示例图片",
        "prompt": "生成描述",
        "size": "2048x2048"
    }]
})

# Step 2: 检查调用是否成功并使用 result.data
if result.ok and result.data:
    # 直接访问字段
    created = result.data.get('created_elements', [])
    if created:
        element_id = created[0]['id']
        width = created[0]['width']
        height = created[0]['height']

        # Step 3: 使用提取的数据进行下一步操作
        result2 = tool.call('another_tool', {
            "element_id": element_id,
            "size": f"{width}x{height}"
        })
```

### 说明特殊返回值情况

**部分成功的情况：**

```markdown
**返回数据 (result.data)：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `created_elements` | array | 成功创建的元素列表 |
| `succeeded_count` | number | 成功数量 |
| `failed_count` | number | 失败数量 |
| `errors` | array | 错误信息列表（如果有失败）|
```

**可选字段说明：**

```markdown
| 字段 | 类型 | 说明 |
|------|------|------|
| `image_properties` | object | 图片属性（仅图片元素）|
| `image_properties.src` | string | 图片路径 |
| `text_properties` | object | 文本属性（仅文本元素）|
```

## 高级功能

### 添加参考文档

当信息量过大时，可以添加额外的文档文件：

```
my-skill/
├── SKILL.md              # 主文件（快速指引，< 500 行）
└── reference/
    ├── workflow.md       # 工作流程详情
    ├── examples.md       # 更多示例
    └── api-reference.md  # API 参考
```

#### 何时使用参考文档

**需要拆分的信号：**
- SKILL.md 接近或超过 500 行
- 某个功能的说明超过 100 行
- 有多个复杂的使用场景需要详细说明
- 需要提供大量示例代码

**拆分策略：**

| 内容类型 | 放置位置 | 示例 |
|---------|---------|------|
| 核心概念、基础用法 | SKILL.md 主文件 | 快速开始、核心参数 |
| 详细的工作流程 | reference/workflow.md | 完整的多步骤流程 |
| 高级使用场景 | reference/advanced-usage.md | 复杂的配置和用法 |
| 特殊功能详解 | reference/feature-name.md | 如 image-generation.md |
| 故障排查 | reference/troubleshooting.md | 常见问题和解决方案 |
| API 完整参考 | reference/api-reference.md | 所有 API 的详细说明 |

#### 在 SKILL.md 中引用参考文档

**方式 1：在开头提供导航（推荐）**

```markdown
## 如何使用本文档

本文档提供**快速指引**，涵盖基础用法和核心规则。当遇到以下情况时，阅读对应的 reference 文档：

- **详细的图生图规范** → [reference/image-generation.md](reference/image-generation.md)
- **网络图片搜索** → [reference/image-search.md](reference/image-search.md)
- **设计标记处理** (`[@design_marker:xxx]`) → [reference/design-marker.md](reference/design-marker.md)
```

**方式 2：在相关章节中插入提示**

```markdown
## 图生图功能

基本用法：
[基础示例代码...]

> **需要详细说明？** 如遇复杂的图生图场景（如产品设计、品牌一致性要求等），请阅读：[reference/image-generation.md](reference/image-generation.md)
```

**方式 3：在章节末尾列出所有参考文档**

```markdown
## 参考文档

详细用法请查阅 reference 目录：
- `workflow.md` - 完整工作流程说明
- `examples.md` - 更多使用示例
- `api-reference.md` - 完整 API 参考
```

#### 参考文档编写规范

**文件命名：**
- 使用小写字母和连字符：`image-generation.md`
- 清晰描述内容：`design-marker.md` 而不是 `dm.md`
- 按功能分类：`api-*.md`、`guide-*.md`

**文档结构：**
```markdown
# 功能名称详细指南

> 本文档提供 [功能] 的详细使用指南。基础用法请参考 [SKILL.md](../SKILL.md)。

## 核心概念

[详细的概念说明]

## 使用场景

### 场景 1：[场景名称]
[详细说明和示例]

### 场景 2：[场景名称]
[详细说明和示例]

## 最佳实践

1. [实践 1]
2. [实践 2]

## 常见问题

**Q: [问题]**
A: [答案]
```

### 添加脚本

对于高级 Skill，可以附加可执行代码：

```
my-skill/
├── SKILL.md
└── scripts/
    ├── helper.py         # Python 脚本
    ├── converter.js      # JavaScript 脚本
    └── thumbnail.py      # 工具脚本
```

支持的语言和包：
- **Python**: pandas, numpy, matplotlib 等
- **JavaScript/Node.js**: 各类 npm 包
- **Shell 脚本**: Bash 等

> **注意**: Agent 可以在加载 Skill 时从标准仓库（PyPI, npm）安装包。

#### 脚本文档规范

脚本应该像标准的命令行工具一样文档化，使用类似 `--help` 的格式。脚本通过 `shell_exec` 工具执行。

**标准文档结构：**

```markdown
### script_name.py - 脚本简短描述

一句话说明脚本的功能。

**SYNOPSIS**
```bash
python scripts/script_name.py [OPTIONS]
```

**DESCRIPTION**

详细描述脚本的功能和用途。

**OPTIONS**

| 选项 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `--param1 <value>` | string | 是 | 参数 1 的说明 |
| `--param2 <value>` | number | 否 | 参数 2 的说明，默认值 |
| `--flag` | flag | 否 | 布尔标志的说明 |

**OUTPUT**

描述输出格式和返回数据结构。

| 字段 | 类型 | 说明 |
|------|------|------|
| `field1` | string | 字段说明 |
| `field2` | number | 字段说明 |

**EXAMPLES**

使用 shell_exec 工具执行：

- **基本用法**:
  - 命令: `python scripts/script_name.py --param1 value`
  - 工作目录: `agents/skills/my-skill`

- **带多个参数**:
  - 命令: `python scripts/script_name.py --param1 value --param2 100 --flag`
  - 工作目录: `agents/skills/my-skill`

返回 JSON 格式数据，解析 `result.content` 获取 `field1`、`field2` 等字段。
```

**完整示例：**

````markdown
### get_servers.py - 获取 MCP 服务器列表

获取所有 MCP 服务器的列表和状态。

**SYNOPSIS**
```bash
python scripts/get_servers.py
```

**DESCRIPTION**

查询所有已注册的 MCP 服务器，返回服务器名称、状态、工具数量等信息。

**OPTIONS**

无参数。

**OUTPUT**

返回 JSON 数组，每个元素包含：

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 服务器内部名称 |
| `label_name` | string | 服务器显示名称 |
| `status` | string | 状态：`success`、`failed`、`timeout` |
| `tool_count` | number | 工具数量 |

**EXAMPLES**

使用 shell_exec 工具执行：

- **命令**: `python scripts/get_servers.py`
- **工作目录**: `agents/skills/using-mcp`

返回 JSON 数组，每个元素包含 `name`、`label_name`、`status`、`tool_count` 等字段。
````

**关键点：**

1. **使用 shell_exec 工具执行** - 不是直接运行命令，而是通过工具调用
2. **指定 cwd 参数** - 确保在正确的工作目录执行脚本
3. **标准化文档格式** - SYNOPSIS、DESCRIPTION、OPTIONS、OUTPUT、EXAMPLES
4. **清晰的参数说明** - 使用表格列出所有选项、类型、必填性
5. **完整的使用示例** - 展示如何通过 shell_exec 调用和处理结果
6. **输出格式说明** - 详细说明返回数据的结构和字段

**参数表格规范：**

| 列名 | 说明 |
|------|------|
| 选项 | 参数名称，如 `--server-name <name>` |
| 类型 | string、number、boolean、flag 等 |
| 必填 | 是/否 |
| 说明 | 参数的详细说明，包括默认值（如果有）|

参考 `agents/skills/using-mcp/SKILL.md` 查看完整的脚本文档示例。

## 安全注意事项

- ⚠️ 添加脚本时要谨慎
- ⚠️ 不要硬编码敏感信息（API 密钥、密码等）
- ⚠️ 启用下载的 Skill 前先审查其内容
- ⚠️ 使用适当的 MCP 连接访问外部服务

## 完整示例

### 简单 Skill 示例

```markdown
---
name: brand-guidelines
description: 将 Acme Corp 品牌指南应用到演示文稿和文档中
---

# Brand Guidelines Skill

应用公司官方品牌指南创建一致、专业的材料。

## 品牌颜色

- 主色: #FF6B35 (Coral)
- 次色: #004E89 (Navy Blue)
- 强调色: #F7B801 (Gold)
- 中性色: #2E2E2E (Charcoal)

## 字体规范

- 标题: Montserrat Bold
- 正文: Open Sans Regular
- H1: 32pt | H2: 24pt | 正文: 11pt

## 何时应用

创建以下内容时应用这些指南：
- PowerPoint 演示文稿
- 对外分享的 Word 文档
- 营销材料
- 客户报告
```

### 复杂 Skill 示例

参考本目录下的 `designing-canvas-images/SKILL.md`，它展示了：
- 多个核心能力的组织
- "如何使用本文档"导航章节
- 快速开始和核心工具参数表格
- 详细的使用原则和关键规则
- 完整的代码工作流示例
- 工具选择决策树
- 参考文档引用和按需加载策略
- 多语言支持（中英文双语）

**目录结构示例：**
```
designing-canvas-images/
├── SKILL.md                          # 主文件（约 570 行）
└── reference/                         # 详细文档目录
    ├── image-generation.md            # AI 图片生成详细指南
    ├── image-search.md                # 网络图片搜索指南
    └── design-marker.md               # 设计标记处理指南
```

**主文件 SKILL.md 的章节组织：**
1. 元数据（含多语言字段）
2. 如何使用本文档（指向 reference）
3. 快速开始（立即可用的代码）
4. 核心工具及必填参数（表格形式）
5. 关键规则（核心原则）
6. 图片尺寸说明（配置参考）
7. AI 生成模式选择（不同场景）
8. 设计标记处理（简化版 + 指向详细文档）
9. 工具选择决策树
10. 网络图片搜索（指向详细文档）

## 参考资源

- [Claude Code Skills 官方文档](https://code.claude.com/docs/en/skills) - 最权威的 Skills 配置指南
- [Skills 最佳实践](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices) - 官方撰写最佳实践
- [官方 Skills 仓库](https://github.com/anthropics/skills) - 示例 Skills 集合
- [创建自定义 Skills](https://support.claude.com/en/articles/12512198-creating-custom-skills) - Claude.ai 用户指南
