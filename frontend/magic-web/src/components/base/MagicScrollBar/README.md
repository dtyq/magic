# MagicScrollBar 魔法滚动条组件

`MagicScrollBar` 是一个基于 simplebar-core 的增强版滚动条组件，提供了更美观、更流畅的自定义滚动条体验。

## 属性

| 属性名              | 类型                    | 默认值 | 说明                           |
| ------------------- | ----------------------- | ------ | ------------------------------ |
| children            | ReactNode \| RenderFunc | -      | 子元素或渲染函数               |
| scrollableNodeProps | object                  | {}     | 可滚动节点的属性               |
| ...SimpleBarOptions | -                       | -      | 支持所有 simplebar-core 的选项 |
| ...HTMLAttributes   | -                       | -      | 支持所有 HTML div 元素的属性   |

## 基础用法

```tsx
import { MagicScrollBar } from '@/components/base/MagicScrollBar';

// 基础用法
<MagicScrollBar style={{ maxHeight: '300px' }}>
  <div>
    {/* 大量内容 */}
    {Array.from({ length: 50 }).map((_, index) => (
      <p key={index}>这是第 {index + 1} 行内容</p>
    ))}
  </div>
</MagicScrollBar>

// 自定义滚动条选项
<MagicScrollBar
  autoHide={false} // 始终显示滚动条
  style={{ maxHeight: '300px', width: '100%' }}
>
  <div>
    {/* 内容 */}
  </div>
</MagicScrollBar>

// 使用渲染函数
<MagicScrollBar>
  {({ scrollableNodeRef, scrollableNodeProps, contentNodeRef, contentNodeProps }) => (
    <div {...scrollableNodeProps}>
      <div {...contentNodeProps}>
        {/* 自定义内容 */}
        <p>这是使用渲染函数的内容</p>
      </div>
    </div>
  )}
</MagicScrollBar>

// 在容器中使用
<div style={{ height: '500px', border: '1px solid #ccc' }}>
  <MagicScrollBar style={{ height: '100%' }}>
    <div>
      {/* 内容 */}
    </div>
  </MagicScrollBar>
</div>

// 水平滚动
<MagicScrollBar style={{ width: '300px' }}>
  <div style={{ display: 'flex', width: '1000px' }}>
    {Array.from({ length: 20 }).map((_, index) => (
      <div
        key={index}
        style={{
          width: '100px',
          height: '100px',
          background: `hsl(${index * 20}, 70%, 70%)`,
          margin: '0 10px'
        }}
      >
        项目 {index + 1}
      </div>
    ))}
  </div>
</MagicScrollBar>
```

## 特点

1. **美观的滚动条**：提供了现代化的滚动条样式，比原生滚动条更美观
2. **流畅的滚动体验**：基于 simplebar-core，提供流畅的滚动体验
3. **自动隐藏**：默认在不滚动时自动隐藏滚动条，减少视觉干扰
4. **跨浏览器一致性**：在不同浏览器中提供一致的滚动条样式和行为
5. **灵活的渲染方式**：支持普通子元素和渲染函数两种方式

## 何时使用

-   需要美观的自定义滚动条时
-   需要在不同浏览器中保持一致的滚动条样式时
-   需要更好的滚动体验时
-   需要控制滚动条的显示和隐藏行为时
-   需要在复杂布局中使用滚动条时

MagicScrollBar 组件让你的滚动条更加美观和用户友好，适合在各种需要滚动内容的场景下使用。
