# MagicSpin 魔法加载组件

`MagicSpin` 是一个基于 Ant Design Spin 组件的增强版加载组件，提供了品牌化的加载动画和更好的样式控制。

## 属性

| 属性名       | 类型    | 默认值 | 说明                            |
| ------------ | ------- | ------ | ------------------------------- |
| section      | boolean | false  | 是否使用节段式加载动画          |
| ...SpinProps | -       | -      | 支持所有 Ant Design Spin 的属性 |

## 基础用法

```tsx
import { MagicSpin } from '@/components/base/MagicSpin';

// 基础用法
<MagicSpin spinning />

// 包裹内容
<MagicSpin spinning>
  <div>加载中的内容</div>
</MagicSpin>

// 不同尺寸
<MagicSpin size="small" spinning />
<MagicSpin spinning /> {/* 默认尺寸 */}
<MagicSpin size="large" spinning />

// 节段式加载动画
<MagicSpin section={true} spinning />

// 在容器中居中显示
<div style={{ height: '200px', position: 'relative' }}>
  <MagicSpin spinning />
</div>

// 带提示文本
<MagicSpin tip="加载中..." spinning />
```

## 特点

1. **品牌化动画**：使用 Magic 品牌的 Lottie 动画作为加载指示器
2. **自适应尺寸**：提供小、中、大三种预设尺寸
3. **居中布局**：自动在容器中居中显示
4. **节段式动画**：可以通过 `section` 属性切换不同的动画风格
5. **主题适配**：自动适应亮色/暗色主题

## 何时使用

-   页面或组件加载时显示加载状态
-   数据请求过程中提供视觉反馈
-   长时间操作时提供等待提示
-   需要阻止用户与正在加载的内容交互时
-   需要品牌化加载体验时

MagicSpin 组件让你的加载状态展示更加美观和品牌化，适合在各种需要加载提示的场景下使用。
