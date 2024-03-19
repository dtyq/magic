# MagicMarpit 魔法幻灯片组件

MagicMarpit 是一个基于 Marpit 和 Reveal.js 的幻灯片渲染组件，用于将 Markdown 格式的内容转换为交互式幻灯片展示。该组件支持丰富的幻灯片功能，如切换动画、主题设置等。

## 属性

| 属性名  | 类型   | 默认值 | 描述                      |
| ------- | ------ | ------ | ------------------------- |
| content | string | -      | Markdown 格式的幻灯片内容 |

## 基本用法

```tsx
import MagicMarpit from "@/components/base/MagicMarpit"

// 基本用法
const slideContent = `
---
theme: default
---

# 第一张幻灯片
这是第一张幻灯片的内容

---

# 第二张幻灯片
- 项目 1
- 项目 2
- 项目 3

---

# 感谢观看
`

;<MagicMarpit content={slideContent} />
```

## Markdown 语法

MagicMarpit 使用 Marpit 的语法来定义幻灯片：

1. 使用 `---` 分隔不同的幻灯片
2. 在第一个 `---` 前可以设置全局主题和样式
3. 支持标准的 Markdown 语法，如标题、列表、代码块等
4. 可以使用 HTML 和 CSS 进行更复杂的布局和样式定制

示例：

````markdown
---
theme: default
---

# 幻灯片标题

内容段落

---

## 列表示例

-   项目 1
-   项目 2
    -   子项目 A
    -   子项目 B

---

## 代码示例

```javascript
function hello() {
	console.log("Hello, world!")
}
```
````

## 特性

-   **Markdown 支持**：使用简单的 Markdown 语法创建幻灯片
-   **交互式展示**：基于 Reveal.js 提供交互式幻灯片浏览体验
-   **主题定制**：支持自定义主题和样式
-   **自动清理**：组件卸载时自动清理资源
-   **响应式设计**：适应不同尺寸的容器

## 使用场景

-   在应用内展示演示文稿
-   教育和培训材料的交互式展示
-   产品演示和功能介绍
-   会议和报告内容的呈现
-   任何需要将 Markdown 内容转换为幻灯片的场景

MagicMarpit 组件为应用提供了一种简单而强大的方式，将文本内容转换为专业的幻灯片展示，特别适合需要频繁更新内容或基于数据生成演示文稿的场景。
