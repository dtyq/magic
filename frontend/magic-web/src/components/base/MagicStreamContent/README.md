# MagicStreamContent 魔法流式内容组件

MagicStreamContent 是一个用于展示流式内容的组件，它能够模拟打字效果，逐字显示文本内容，为用户提供动态的阅读体验。该组件特别适用于聊天机器人回复、代码生成等需要渐进式展示内容的场景。

## 属性

| 属性名   | 类型                              | 默认值 | 描述                                     |
| -------- | --------------------------------- | ------ | ---------------------------------------- |
| content  | string                            | -      | 要流式显示的文本内容                     |
| children | (text: string) => React.ReactNode | -      | 可选的渲染函数，用于自定义内容的渲染方式 |

## 基本用法

```tsx
import MagicStreamContent from '@/components/base/MagicStreamContent';

// 基本用法 - 直接显示文本
<MagicStreamContent content="这是一段流式显示的文本内容，会逐字出现，模拟打字效果。" />

// 使用自定义渲染函数
<MagicStreamContent content="这是一段**带有 Markdown 格式**的文本内容。">
  {(text) => <ReactMarkdown>{text}</ReactMarkdown>}
</MagicStreamContent>

// 在聊天界面中使用
<div className="chat-message">
  <div className="avatar">
    <img src="/bot-avatar.png" alt="Bot" />
  </div>
  <div className="message-content">
    <MagicStreamContent content={botResponse} />
  </div>
</div>
```

## 特性

-   **打字效果**：模拟真实的打字过程，逐字显示内容
-   **流式更新**：支持内容的增量更新，适用于流式 API 响应
-   **自定义渲染**：通过 children 函数可以自定义内容的渲染方式
-   **平滑过渡**：新增内容时保持平滑的视觉效果
-   **轻量级**：组件实现简洁，性能开销小

## 使用场景

-   AI 聊天机器人的回复展示
-   代码生成器的输出展示
-   教程和引导内容的逐步呈现
-   故事和叙述内容的动态展示
-   任何需要吸引用户注意力的渐进式内容展示

MagicStreamContent 组件通过模拟打字效果，为应用提供了一种更加生动和引人入胜的内容展示方式，特别适合需要营造实时交互感的场景。
