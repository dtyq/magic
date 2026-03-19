# MagicLoadingIcon 组件

`MagicLoadingIcon` 是一个优雅的加载图标组件，提供旋转动画效果和暂停状态控制。

## 属性

| 属性名 | 类型    | 默认值 | 说明                                 |
| ------ | ------- | ------ | ------------------------------------ |
| size   | number  | 20     | 图标大小（像素）                     |
| paused | boolean | false  | 是否暂停旋转动画，true 时停止旋转    |

## 基础用法

```tsx
import { MagicLoadingIcon } from '@/components/base/MagicLoadingIcon';

// 基础用法
<MagicLoadingIcon />

// 示例 1：自定义大小
<MagicLoadingIcon size={24} />

// 示例 2：暂停状态（不旋转）
<MagicLoadingIcon paused={true} />

// 示例 3：大尺寸加载图标
<MagicLoadingIcon size={32} />
```

## 特点

1. **平滑动画**：使用 CSS 动画提供流畅的旋转效果
2. **可控状态**：支持暂停和恢复旋转动画
3. **灵活尺寸**：支持自定义图标大小
4. **优雅外观**：使用渐变色彩和精美的 SVG 设计

## 何时使用

- 数据加载过程中显示加载状态
- 文件上传或下载进度指示
- 异步操作的等待状态显示
- 需要暂停/恢复动画的加载场景

MagicLoadingIcon 组件提供了美观的加载动画效果，适用于各种需要显示加载状态的场景。
