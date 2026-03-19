# SkillConfig 配置文档

## 概述

`SkillConfig` 是技能面板的顶层配置对象，用于描述一个技能的交互面板集合和输入框占位文本。每个技能可包含多个面板，面板类型分为三种：**字段面板（Field）**、**指南面板（Guide）**、**演示面板（Demo）**。

---

## LocaleText 类型（国际化）

所有用户可见的文本字段均支持 `LocaleText` 类型，用于在配置中直接携带多语言内容：

```typescript
type LocaleText = string | Record<string, string>
```

- **`string`**：单语言，直接使用原始字符串（向后兼容）
- **`Record<string, string>`**：多语言，key 为语言代码（如 `zh_CN`、`en_US`），value 为对应语言的文本

前端根据当前语言环境，从 config 中取出对应语言的文本渲染。locale key 完全开放，由配置者自行决定支持哪些语言。

**支持 LocaleText 的字段**：`placeholder`、`title`、`label`、`description`、`group_name`、`group_description`、`sub_text`。

**配置示例**（多语言使用 `Record`，单语言可直接用 `string` 保持兼容）：

```json
{
  "label": { "zh_CN": "风格", "en_US": "Style", "ja": "スタイル" }
}
```

---

## 顶层结构：`SkillConfig`

```json
{
  "placeholder": {
    "zh_CN": "请输入你想要做的事情...",
    "en_US": "Enter what you want to do..."
  },
  "panels": []
}
```

| 字段          | 类型                  | 必填 | 说明                             |
| ------------- | --------------------- | ---- | -------------------------------- |
| `panels`      | `SkillPanelConfig[]`  | 是   | 面板配置数组，支持多个面板并列   |
| `placeholder` | `LocaleText`          | 否   | 输入框的占位提示文本             |

---

## 面板公共基础字段：`BasePanelConfig`

所有面板类型均继承以下基础字段：

| 字段               | 类型                            | 必填 | 说明                               |
| ------------------ | ------------------------------- | ---- | ---------------------------------- |
| `type`             | `"guide" \| "field" \| "demo"` | 是   | 面板类型，决定渲染方式             |
| `title`            | `LocaleText`                    | 否   | 面板标题                           |
| `expandable`       | `boolean`                       | 否   | 是否支持折叠/展开                  |
| `default_expanded` | `boolean`                       | 否   | 默认是否展开（配合 `expandable`）  |

---

## 面板类型一：`GuidePanelConfig`（指南面板）

**用途**：展示一组带图标的引导卡片，帮助用户快速了解技能的使用方式或功能点。

```json
{
  "type": "guide",
  "title": { "zh_CN": "使用指南", "en_US": "User Guide" },
  "guide": {
    "items": [
      {
        "key": "step_1",
        "title": { "zh_CN": "第一步：描述你的目标", "en_US": "Step 1: Describe your goal" },
        "description": {
          "zh_CN": "在输入框中用自然语言描述你希望完成的任务",
          "en_US": "Describe your task in natural language in the input box"
        },
        "icon": "https://cdn.example.com/icons/target.svg"
      },
      {
        "key": "step_2",
        "title": { "zh_CN": "第二步：等待生成结果", "en_US": "Step 2: Wait for results" },
        "description": {
          "zh_CN": "AI 将根据你的描述自动生成对应内容",
          "en_US": "AI will generate content based on your description"
        },
        "icon": "https://cdn.example.com/icons/magic.svg"
      }
    ]
  }
}
```

### `GuidePanelConfig` 专有字段

| 字段    | 类型     | 必填 | 说明               |
| ------- | -------- | ---- | ------------------ |
| `guide` | `object` | 是   | 指南配置对象       |
| `guide.items` | `GuideItem[]` | 是 | 引导项列表   |

### `GuideItem` 字段说明

| 字段          | 类型        | 必填 | 说明                         |
| ------------- | ----------- | ---- | ---------------------------- |
| `key`         | `string`    | 是   | 唯一标识符                   |
| `title`       | `LocaleText`| 是   | 引导项标题                   |
| `description` | `LocaleText`| 是   | 引导项说明文本               |
| `icon`        | `string`    | 是   | 图标 URL 或图标标识符        |

---

## 面板类型二：`FieldPanelConfig`（字段面板）

**用途**：展示一组可配置的筛选/选择字段，用户通过选择字段值来定制任务参数（如风格、尺寸、语言等）。

```json
{
  "type": "field",
  "title": { "zh_CN": "参数配置", "en_US": "Settings" },
  "field": {
    "items": [
      {
        "data_key": "style",
        "label": { "zh_CN": "风格", "en_US": "Style" },
        "current_value": "realistic",
        "default_value": "realistic",
        "option_view_type": "capsule",
        "options": [
          { "value": "realistic", "label": { "zh_CN": "写实", "en_US": "Realistic" } },
          { "value": "cartoon", "label": { "zh_CN": "卡通", "en_US": "Cartoon" } },
          { "value": "sketch", "label": { "zh_CN": "素描", "en_US": "Sketch" } }
        ]
      },
      {
        "data_key": "ratio",
        "label": { "zh_CN": "尺寸", "en_US": "Size" },
        "current_value": "16:9",
        "default_value": "16:9",
        "has_leading_icon": true,
        "leading_icon": "https://cdn.example.com/icons/ratio.svg",
        "option_view_type": "capsule",
        "options": [
          { "value": "16:9", "label": { "zh_CN": "横版 16:9", "en_US": "Landscape 16:9" } },
          { "value": "9:16", "label": { "zh_CN": "竖版 9:16", "en_US": "Portrait 9:16" } },
          { "value": "1:1", "label": { "zh_CN": "方形 1:1", "en_US": "Square 1:1" } }
        ]
      },
      {
        "data_key": "category",
        "label": { "zh_CN": "分类", "en_US": "Category" },
        "current_value": "landscape",
        "default_group_key": "nature",
        "default_value": "landscape",
        "option_view_type": "grid",
        "options": [
          {
            "group_key": "nature",
            "group_name": { "zh_CN": "自然", "en_US": "Nature" },
            "group_icon": "https://cdn.example.com/icons/nature.svg",
            "children": [
              { "value": "landscape", "label": { "zh_CN": "风景", "en_US": "Landscape" } },
              { "value": "animal", "label": { "zh_CN": "动物", "en_US": "Animal" } }
            ]
          },
          {
            "group_key": "urban",
            "group_name": { "zh_CN": "城市", "en_US": "Urban" },
            "children": [
              { "value": "architecture", "label": { "zh_CN": "建筑", "en_US": "Architecture" } },
              { "value": "street", "label": { "zh_CN": "街景", "en_US": "Street" } }
            ]
          }
        ]
      }
    ]
  }
}
```

### `FieldPanelConfig` 专有字段

| 字段           | 类型     | 必填 | 说明                   |
| -------------- | -------- | ---- | ---------------------- |
| `field`        | `object` | 否   | 字段配置对象           |
| `field.items`  | `FieldItem[]` | 是 | 字段项列表           |

### `FieldItem` 字段说明

| 字段                | 类型                            | 必填 | 说明                                            |
| ------------------- | ------------------------------- | ---- | ----------------------------------------------- |
| `data_key`          | `string`                        | 是   | 字段唯一键，用于提交时识别参数                  |
| `label`             | `LocaleText`                    | 是   | 字段显示名称                                    |
| `current_value`     | `string`                        | 是   | 当前选中的值                                    |
| `options`           | `(OptionGroup \| OptionItem)[]` | 是   | 选项列表，支持平铺选项或分组选项                |
| `has_leading_icon`  | `boolean`                       | 否   | 是否在字段前展示前置图标                        |
| `leading_icon`      | `string`                        | 否   | 字段前置图标 URL 或标识符                       |
| `default_group_key` | `string`                        | 否   | 默认选中的分组 key（配合 `OptionGroup` 使用）   |
| `default_value`     | `string`                        | 否   | 默认选中的选项 value                            |
| `option_view_type`  | `OptionViewType`                | 否   | 选项的视图模式，见枚举说明                      |

---

## 面板类型三：`DemoPanelConfig`（演示面板）

**用途**：展示一组分组的模板卡片，用户可以选择一个预设模板作为任务起点（如选择 PPT 模板、图片样式等）。

```json
{
  "type": "demo",
  "title": { "zh_CN": "选择模板", "en_US": "Select Template" },
  "demo": {
    "view_type": "waterfall",
    "default_selected_group_key": "business",
    "default_selected_template_key": "annual_report",
    "groups": [
      {
        "group_key": "business",
        "group_name": { "zh_CN": "商务", "en_US": "Business" },
        "group_icon": "https://cdn.example.com/icons/business.svg",
        "group_description": {
          "zh_CN": "适用于商业汇报场景",
          "en_US": "For business presentation scenarios"
        },
        "children": [
          {
            "value": "annual_report",
            "label": { "zh_CN": "年度报告", "en_US": "Annual Report" },
            "thumbnail_url": "https://cdn.example.com/thumbs/annual_report.jpg",
            "description": {
              "zh_CN": "简洁大气的年度汇报模板",
              "en_US": "Clean and professional annual report template"
            },
            "sub_text": { "zh_CN": "推荐", "en_US": "Recommended" },
            "width": 1920,
            "height": 1080,
            "aspect_ratio": 1.778
          },
          {
            "value": "project_proposal",
            "label": { "zh_CN": "项目提案", "en_US": "Project Proposal" },
            "thumbnail_url": "https://cdn.example.com/thumbs/project_proposal.jpg",
            "description": {
              "zh_CN": "专业清晰的项目提案模板",
              "en_US": "Professional and clear project proposal template"
            },
            "width": 1920,
            "height": 1080,
            "aspect_ratio": 1.778
          }
        ]
      },
      {
        "group_key": "education",
        "group_name": { "zh_CN": "教育", "en_US": "Education" },
        "group_icon": "https://cdn.example.com/icons/education.svg",
        "group_description": {
          "zh_CN": "适用于课程教学场景",
          "en_US": "For course teaching scenarios"
        },
        "children": [
          {
            "value": "course_intro",
            "label": { "zh_CN": "课程介绍", "en_US": "Course Introduction" },
            "thumbnail_url": "https://cdn.example.com/thumbs/course_intro.jpg",
            "description": {
              "zh_CN": "生动活泼的课程介绍模板",
              "en_US": "Vivid and lively course introduction template"
            },
            "sub_text": { "zh_CN": "热门", "en_US": "Popular" },
            "width": 1920,
            "height": 1080,
            "aspect_ratio": 1.778
          }
        ]
      }
    ]
  }
}
```

### `DemoPanelConfig` 专有字段

| 字段                                  | 类型             | 必填 | 说明                               |
| ------------------------------------- | ---------------- | ---- | ---------------------------------- |
| `demo`                                | `object`         | 是   | 演示配置对象                       |
| `demo.groups`                         | `OptionGroup[]`  | 是   | 模板分组列表                       |
| `demo.default_selected_group_key`     | `string`         | 否   | 初始选中的分组 `group_key`         |
| `demo.default_selected_template_key`  | `string`         | 否   | 初始选中的模板 `value`             |
| `demo.view_type`                      | `OptionViewType` | 否   | 模板卡片的视图模式                 |

### `OptionGroup` 字段说明

| 字段                | 类型           | 必填 | 说明                     |
| ------------------- | -------------- | ---- | ------------------------ |
| `group_key`         | `string`       | 是   | 分组唯一标识符           |
| `group_name`        | `LocaleText`   | 是   | 分组显示名称             |
| `group_icon`        | `string`       | 否   | 分组图标 URL             |
| `group_description` | `LocaleText`   | 否   | 分组描述文本             |
| `children`          | `OptionItem[]` | 否   | 分组下的模板/选项列表    |

### `OptionItem` 字段说明

| 字段            | 类型        | 必填 | 说明                                        |
| --------------- | ----------- | ---- | ------------------------------------------- |
| `value`         | `string`    | 是   | 选项唯一标识值，选中后提交此值              |
| `label`         | `LocaleText`| 否   | 选项显示名称                                |
| `thumbnail_url` | `string`    | 否   | 缩略图 URL，用于卡片预览                    |
| `description`   | `LocaleText`| 否   | 选项详细描述                                |
| `icon_url`      | `string`    | 否   | 选项小图标 URL                              |
| `sub_text`      | `LocaleText`| 否   | 副标签文本（如"推荐"、"热门"）              |
| `width`         | `number` | 否   | 模板原始宽度（像素）                        |
| `height`        | `number` | 否   | 模板原始高度（像素）                        |
| `aspect_ratio`  | `number` | 否   | 宽高比（`width / height`），用于瀑布流布局  |

---

## 枚举值说明

### `SkillPanelType`（面板类型）

| 值        | 说明       |
| --------- | ---------- |
| `"guide"` | 指南面板   |
| `"field"` | 字段面板   |
| `"demo"`  | 演示面板   |

### `OptionViewType`（选项视图模式）

| 值            | 说明                                              |
| ------------- | ------------------------------------------------- |
| `"grid"`      | 网格视图，等宽等高的卡片排列                      |
| `"waterfall"` | 瀑布流视图，根据 `aspect_ratio` 自动计算高度       |
| `"text_list"` | 文本列表视图，纯文字列表形式                      |
| `"capsule"`   | 胶囊视图，横向滚动的标签胶囊形式                  |

---

## 完整配置示例

以下为一个包含三种面板的完整技能配置示例（以"AI 生成 PPT"为例）：

```json
{
  "placeholder": {
    "zh_CN": "描述你想要生成的 PPT 主题和内容...",
    "en_US": "Describe the PPT theme and content you want to generate..."
  },
  "panels": [
    {
      "type": "guide",
      "title": { "zh_CN": "使用说明", "en_US": "Quick Start" },
      "expandable": true,
      "default_expanded": false,
      "guide": {
        "items": [
          {
            "key": "describe",
            "title": { "zh_CN": "描述主题", "en_US": "Describe Topic" },
            "description": {
              "zh_CN": "在输入框中描述 PPT 的主题、目的和受众",
              "en_US": "Describe the PPT topic, purpose and audience in the input"
            },
            "icon": "https://cdn.example.com/icons/edit.svg"
          },
          {
            "key": "select_template",
            "title": { "zh_CN": "选择模板", "en_US": "Select Template" },
            "description": {
              "zh_CN": "从下方模板库中选择一个符合场景的设计风格",
              "en_US": "Choose a design style from the template library below"
            },
            "icon": "https://cdn.example.com/icons/template.svg"
          },
          {
            "key": "generate",
            "title": { "zh_CN": "一键生成", "en_US": "Generate" },
            "description": {
              "zh_CN": "点击发送，AI 将自动生成完整 PPT 文件",
              "en_US": "Click send and AI will generate a complete PPT file"
            },
            "icon": "https://cdn.example.com/icons/magic.svg"
          }
        ]
      }
    },
    {
      "type": "field",
      "title": { "zh_CN": "参数设置", "en_US": "Settings" },
      "expandable": true,
      "default_expanded": true,
      "field": {
        "items": [
          {
            "data_key": "language",
            "label": { "zh_CN": "语言", "en_US": "Language" },
            "current_value": "zh",
            "default_value": "zh",
            "option_view_type": "capsule",
            "options": [
              { "value": "zh", "label": { "zh_CN": "中文", "en_US": "Chinese" } },
              { "value": "en", "label": { "zh_CN": "英文", "en_US": "English" } }
            ]
          },
          {
            "data_key": "slide_count",
            "label": { "zh_CN": "页数", "en_US": "Pages" },
            "current_value": "10",
            "default_value": "10",
            "option_view_type": "capsule",
            "options": [
              { "value": "5", "label": { "zh_CN": "5 页", "en_US": "5 Pages" } },
              { "value": "10", "label": { "zh_CN": "10 页", "en_US": "10 Pages" } },
              { "value": "20", "label": { "zh_CN": "20 页", "en_US": "20 Pages" } }
            ]
          }
        ]
      }
    },
    {
      "type": "demo",
      "title": { "zh_CN": "选择模板风格", "en_US": "Select Template Style" },
      "expandable": true,
      "default_expanded": true,
      "demo": {
        "view_type": "waterfall",
        "default_selected_group_key": "business",
        "default_selected_template_key": "clean_business",
        "groups": [
          {
            "group_key": "business",
            "group_name": { "zh_CN": "商务", "en_US": "Business" },
            "group_icon": "https://cdn.example.com/icons/business.svg",
            "children": [
              {
                "value": "clean_business",
                "label": { "zh_CN": "简洁商务", "en_US": "Clean Business" },
                "thumbnail_url": "https://cdn.example.com/thumbs/clean_business.jpg",
                "description": {
                  "zh_CN": "干净利落的商务风格",
                  "en_US": "Clean and professional business style"
                },
                "sub_text": { "zh_CN": "推荐", "en_US": "Recommended" },
                "aspect_ratio": 1.778
              }
            ]
          },
          {
            "group_key": "creative",
            "group_name": { "zh_CN": "创意", "en_US": "Creative" },
            "group_icon": "https://cdn.example.com/icons/creative.svg",
            "children": [
              {
                "value": "gradient_modern",
                "label": { "zh_CN": "渐变现代", "en_US": "Gradient Modern" },
                "thumbnail_url": "https://cdn.example.com/thumbs/gradient_modern.jpg",
                "description": {
                  "zh_CN": "充满活力的渐变配色风格",
                  "en_US": "Vibrant gradient color style"
                },
                "aspect_ratio": 1.778
              }
            ]
          }
        ]
      }
    }
  ]
}
```

---

## LocaleText 多语言配置示例

当需要支持多语言时，将文本字段改为 locale map 格式：

```json
{
  "placeholder": {
    "zh_CN": "描述你想要生成的 PPT 主题和内容...",
    "en_US": "Describe the PPT theme and content..."
  },
  "panels": [
    {
      "type": "field",
      "title": { "zh_CN": "参数设置", "en_US": "Settings" },
      "field": {
        "items": [
          {
            "data_key": "language",
            "label": { "zh_CN": "语言", "en_US": "Language" },
            "current_value": "zh",
            "option_view_type": "capsule",
            "options": [
              { "value": "zh", "label": { "zh_CN": "中文", "en_US": "Chinese" } },
              { "value": "en", "label": { "zh_CN": "英文", "en_US": "English" } }
            ]
          }
        ]
      }
    }
  ]
}
```

---

## 设计约束

1. **面板顺序**：`panels` 数组中的面板按顺序从上到下渲染，建议将 `guide` 面板置于首位。
2. **视图模式与数据匹配**：使用 `waterfall` 视图时，`OptionItem` 建议提供 `aspect_ratio` 以保证布局正确。
3. **分组与平铺互斥**：`FieldItem.options` 中的元素应统一为 `OptionGroup[]` 或 `OptionItem[]`，不建议混用。
4. **默认值一致性**：`default_value` 应与 `options` 中某个 `OptionItem.value` 保持一致；`default_group_key` 应与某个 `OptionGroup.group_key` 保持一致。
5. **唯一性要求**：同一 `SkillConfig` 中，所有 `OptionGroup.group_key` 和 `OptionItem.value` 应保证唯一。
