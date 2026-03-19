# MagicBlock 魔法块组件

`MagicBlock` 是一个简单的可编辑内容块组件，提供了一个具有 `contentEditable` 属性的 div 容器，允许用户直接编辑其中的内容。

## 属性

| 属性名   | 类型                           | 默认值 | 说明                          |
| -------- | ------------------------------ | ------ | ----------------------------- |
| children | ReactNode                      | -      | 块内显示的内容                |
| ...props | HTMLAttributes<HTMLDivElement> | -      | 支持所有 div 元素的 HTML 属性 |

## 基础用法

```tsx
import MagicBlock from '@/components/base/MagicBlock';

// 基础用法
<MagicBlock>可编辑的内容</MagicBlock>

// 设置样式
<MagicBlock
  style={{
    padding: '10px',
    border: '1px solid #eee',
    borderRadius: '4px'
  }}
>
  带样式的可编辑内容
</MagicBlock>

// 添加事件处理
<MagicBlock
  onBlur={(e) => console.log('编辑完成', e.currentTarget.textContent)}
  onInput={(e) => console.log('内容变化', e.currentTarget.textContent)}
>
  带事件处理的可编辑内容
</MagicBlock>
```

## 特点

1. **简单轻量**：提供最基本的内容编辑功能，不包含复杂的格式控制
2. **易于集成**：可以轻松集成到各种需要内容编辑的场景
3. **完全可定制**：支持所有 div 元素的 HTML 属性，可以根据需要自定义样式和行为
4. **引用透明**：使用 useRef 保持对 DOM 元素的引用，便于外部操作

## 何时使用

-   需要简单的内容编辑功能时
-   需要用户能够直接在页面上编辑文本内容时
-   不需要复杂富文本编辑功能的简单编辑场景
-   需要自定义编辑区域的外观和行为时

MagicBlock 组件提供了一个简单而灵活的内容编辑解决方案，适用于各种需要基本文本编辑功能的场景。
