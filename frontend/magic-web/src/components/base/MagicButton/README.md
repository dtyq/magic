# MagicButton 魔法按钮组件

`MagicButton` 是一个基于 Ant Design Button 组件的增强版按钮，提供了更多的自定义选项和样式优化。

## 属性

| 属性名         | 类型                            | 默认值   | 说明                              |
| -------------- | ------------------------------- | -------- | --------------------------------- |
| justify        | CSSProperties["justifyContent"] | "center" | 按钮内容的水平对齐方式            |
| theme          | boolean                         | true     | 是否应用主题样式                  |
| tip            | ReactNode                       | -        | 鼠标悬停时显示的提示内容          |
| ...ButtonProps | -                               | -        | 支持所有 Ant Design Button 的属性 |

## 基础用法

```tsx
import { MagicButton } from '@/components/base/MagicButton';

// 基础按钮
<MagicButton>点击我</MagicButton>

// 带图标的按钮
<MagicButton icon={<IconStar />}>收藏</MagicButton>

// 带提示的按钮
<MagicButton tip="这是一个提示">悬停查看提示</MagicButton>

// 自定义对齐方式
<MagicButton justify="flex-start">左对齐内容</MagicButton>

// 不使用主题样式
<MagicButton theme={false}>无主题样式</MagicButton>

// 不同类型的按钮
<MagicButton type="primary">主要按钮</MagicButton>
<MagicButton type="default">默认按钮</MagicButton>
<MagicButton type="dashed">虚线按钮</MagicButton>
<MagicButton type="link">链接按钮</MagicButton>
<MagicButton type="text">文本按钮</MagicButton>
```

## 特点

1. **增强的样式控制**：提供了更多的样式自定义选项，如内容对齐方式
2. **内置提示功能**：通过 `tip` 属性可以轻松添加悬停提示
3. **主题集成**：可以通过 `theme` 属性控制是否应用主题样式
4. **灵活的图标支持**：完全兼容 Ant Design 的图标系统

## 何时使用

-   当你需要在页面上放置一个按钮时
-   当你需要按钮有更好的样式控制时
-   当你需要按钮带有悬停提示时
-   当你需要按钮内容有特定对齐方式时

MagicButton 组件让你的按钮更加灵活和美观，同时保持了 Ant Design 按钮的所有功能。
