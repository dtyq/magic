# MagicMarkdown 魔法 Markdown 渲染组件

`MagicMarkdown` 是一个功能强大的 Markdown 渲染组件，基于 react-markdown，支持代码高亮、LaTeX 公式、HTML 内容等多种扩展功能。

## 属性

| 属性名             | 类型    | 默认值 | 说明                             |
| ------------------ | ------- | ------ | -------------------------------- |
| content            | string  | -      | 要渲染的 Markdown 内容           |
| allowHtml          | boolean | true   | 是否允许渲染 HTML 内容           |
| enableLatex        | boolean | true   | 是否启用 LaTeX 公式支持          |
| isSelf             | boolean | false  | 是否为自己发送的内容（影响样式） |
| hiddenDetail       | boolean | false  | 是否隐藏详细内容                 |
| isStreaming        | boolean | false  | 是否为流式渲染模式               |
| ...MarkdownOptions | -       | -      | 支持所有 react-markdown 的选项   |

## 基础用法

```tsx
import { MagicMarkdown } from '@/opensource/pages/chatNew/components/ChatMessageList/components/MessageFactory/components/Markdown/EnhanceMarkdown';

// 基础用法
<MagicMarkdown content="# 标题\n这是一段普通文本" />

// 启用 LaTeX 公式
<MagicMarkdown
  content="爱因斯坦质能方程：$E=mc^2$"
  enableLatex
/>

// 允许 HTML 内容
<MagicMarkdown
  content="这是一个<span style='color:red'>红色</span>文本"
  allowHtml
/>

// 流式渲染（适用于打字机效果）
<MagicMarkdown
  content="正在生成的内容..."
  isStreaming
/>

// 自定义组件
<MagicMarkdown
  content="# 自定义标题"
  components={{
    h1: ({ node, ...props }) => <h1 style={{ color: 'blue' }} {...props} />
  }}
/>

// 使用自定义插件
<MagicMarkdown
  content="内容"
  remarkPlugins={[myCustomPlugin]}
  rehypePlugins={[myCustomRehypePlugin]}
/>
```

## 特点

1. **丰富的格式支持**：支持标准 Markdown 语法，包括标题、列表、表格、代码块等
2. **代码高亮**：内置代码语法高亮功能
3. **LaTeX 公式**：支持数学公式渲染
4. **HTML 内容**：可以安全地渲染 HTML 内容
5. **流式渲染**：支持流式内容的平滑渲染
6. **自定义组件**：可以自定义各种 Markdown 元素的渲染方式
7. **插件系统**：支持 remark 和 rehype 插件扩展功能

## 内置组件

MagicMarkdown 内置了多个优化的组件用于渲染特定的 Markdown 元素：

-   `A`：优化的链接组件，支持外部链接安全打开
-   `Code`：代码块和行内代码组件，支持语法高亮
-   `Pre`：代码块容器组件，支持复制代码功能
-   `Sup`：上标组件

## 何时使用

-   需要渲染 Markdown 格式内容时
-   需要在应用中展示富文本内容时
-   需要支持代码高亮和数学公式时
-   需要流式渲染内容（如聊天机器人回复）时

MagicMarkdown 组件让你的 Markdown 内容展示更加美观和功能丰富，适合在各种需要富文本展示的场景下使用。
