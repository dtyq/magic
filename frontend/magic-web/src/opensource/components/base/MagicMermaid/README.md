# MagicMermaid 魔法流程图组件

`MagicMermaid` 是一个基于 mermaid.js 的流程图渲染组件，支持将 mermaid 语法的文本转换为可视化的流程图、时序图、甘特图等图表。

## 属性

| 属性名 | 类型   | 默认值 | 说明                   |
| ------ | ------ | ------ | ---------------------- |
| data   | string | -      | mermaid 语法的图表定义 |

## 基础用法

```tsx
import { MagicMermaid } from '@/components/base/MagicMermaid';

// 基础流程图
<MagicMermaid
  data={`
    graph TD
    A[开始] --> B{判断}
    B -->|是| C[处理]
    B -->|否| D[结束]
    C --> D
  `}
/>

// 时序图
<MagicMermaid
  data={`
    sequenceDiagram
    参与者A->>参与者B: 你好，B！
    参与者B->>参与者A: 你好，A！
  `}
/>

// 甘特图
<MagicMermaid
  data={`
    gantt
    title 项目计划
    dateFormat  YYYY-MM-DD
    section 阶段1
    任务1           :a1, 2023-01-01, 30d
    任务2           :after a1, 20d
    section 阶段2
    任务3           :2023-02-15, 12d
    任务4           :24d
  `}
/>

// 类图
<MagicMermaid
  data={`
    classDiagram
    类A <|-- 类B
    类A : +String 属性1
    类A : +方法1()
    类B : +方法2()
  `}
/>

// 状态图
<MagicMermaid
  data={`
    stateDiagram-v2
    [*] --> 状态1
    状态1 --> 状态2: 触发条件
    状态2 --> [*]
  `}
/>
```

## 特点

1. **双模式查看**：支持图表模式和代码模式切换，方便查看和编辑
2. **主题适配**：自动适应亮色/暗色主题，提供一致的视觉体验
3. **点击预览**：点击图表可以全屏预览，查看更多细节
4. **错误处理**：当 mermaid 语法错误时，会显示友好的错误提示
5. **SVG 导出**：支持将图表导出为 SVG 格式，方便分享和使用

## 何时使用

-   需要可视化展示流程、关系或时序时
-   需要在文档中嵌入流程图、时序图、甘特图等图表时
-   需要将文本描述转换为直观图形表示时
-   需要在 Markdown 内容中展示复杂图表时
-   需要创建可交互的图表展示时

MagicMermaid 组件让你的流程图、关系图等可视化内容展示更加直观和专业，适合在各种需要图表可视化的场景下使用。
