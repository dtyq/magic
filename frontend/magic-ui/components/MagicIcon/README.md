# MagicIcon 魔法图标组件

`MagicIcon` 是一个基于 Tabler Icons 的图标包装组件，提供了主题适配和统一的样式控制。

## 属性

| 属性名       | 类型                                                                    | 默认值 | 说明                         |
| ------------ | ----------------------------------------------------------------------- | ------ | ---------------------------- |
| component    | ForwardRefExoticComponent<Omit<IconProps, "ref"> & RefAttributes<Icon>> | -      | 要渲染的 Tabler 图标组件     |
| active       | boolean                                                                 | false  | 是否处于激活状态             |
| animation    | boolean                                                                 | false  | 是否启用动画效果             |
| ...IconProps | -                                                                       | -      | 支持所有 Tabler Icons 的属性 |

## 基础用法

```tsx
import { MagicIcon } from '@/components/base/MagicIcon';
import { IconHome, IconStar, IconSettings } from '@tabler/icons-react';

// 基础图标
<MagicIcon component={IconHome} />

// 自定义大小
<MagicIcon component={IconStar} size={24} />

// 自定义颜色（会覆盖主题颜色）
<MagicIcon component={IconSettings} color="blue" />

// 自定义线条粗细
<MagicIcon component={IconHome} stroke={2} />

// 激活状态
<MagicIcon component={IconStar} active />

// 带动画效果（如果实现了动画）
<MagicIcon component={IconSettings} animation />
```

## 特点

1. **主题适配**：自动根据当前主题（亮色/暗色）调整图标颜色
2. **统一样式**：默认提供了统一的线条粗细和颜色
3. **类型安全**：完全支持 TypeScript，提供了完整的类型定义
4. **灵活扩展**：可以通过属性轻松自定义图标的各种特性

## 何时使用

-   需要在应用中使用 Tabler 图标时
-   需要图标自动适应主题变化时
-   需要统一管理图标样式时
-   需要为图标添加交互状态（如激活状态）时

MagicIcon 组件让你的图标使用更加简单和统一，同时确保它们能够适应应用的主题设置。
