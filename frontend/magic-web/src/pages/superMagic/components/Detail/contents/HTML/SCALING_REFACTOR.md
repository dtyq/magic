# Iframe Scaling Refactoring

## 概述

本次重构将 IsolatedHTMLRenderer 组件中的缩放相关逻辑封装成了独立的 `useIframeScaling` hook，并实现了动态高度计算，不再使用固定的 1080px 高度。

## 主要改进

### 1. 动态高度计算

**之前：** iframe 的高度固定为 1080px
```typescript
<iframe style={{ width: 1920, height: 1080 }} />
```

**之后：** 根据 iframe 内部实际内容高度动态计算
```typescript
const { contentHeight } = useIframeScaling(...)
<iframe style={{ width: 1920, height: contentHeight }} />
```

### 2. 缩放逻辑封装

将原本分散在组件中的缩放计算逻辑（约80行代码）封装成了可复用的 `useIframeScaling` hook。

**优点：**
- 代码更易维护和测试
- 逻辑更清晰，职责分离
- 可以在其他组件中复用

### 3. 仅保留非受控模式

Hook 内部管理所有状态，统一缩放逻辑，避免外部状态不同步带来的闪动与抖动。
```typescript
const { scaleRatio, verticalOffset, horizontalOffset } = useIframeScaling({
  containerRef,
  iframeRef,
  isPptRender: true
})
```

## 修改的文件

### 新增文件

1. **`hooks/useIframeScaling.ts`** - 核心 hook 实现
2. **`hooks/useIframeScaling.md`** - Hook 使用文档
3. **`hooks/__tests__/useIframeScaling.test.ts`** - 单元测试
4. **`SCALING_REFACTOR.md`** - 本文档

### 修改的文件

1. **`IsolatedHTMLRenderer.tsx`**
   - 移除了手动的缩放计算逻辑（约80行代码）
   - 使用 `useIframeScaling` hook
   - 简化了 props 接口，移除了 `scaleRatio`, `verticalOffset`, `horizontalOffset` 及其 setter props
   - iframe 的 height 样式改为使用动态计算的 `contentHeight`

2. **`PPTSlide.tsx`**
   - 移除了 `scaleRatio`, `verticalOffset`, `horizontalOffset` 相关 props
   - 简化了组件接口

3. **`PPTRender/index.tsx`**
   - 移除了向 PPTSlide 传递缩放相关 props 的代码

4. **`MessageList/.../TextEditor/index.tsx`**
   - 更新了 IsolatedHTMLRenderer 的调用，移除了已废弃的 props

## 技术细节

### 高度计算算法

```typescript
const height = Math.max(
  body.scrollHeight,
  body.offsetHeight,
  html.clientHeight,
  html.scrollHeight,
  html.offsetHeight,
)
```

取 document.body 和 document.documentElement 的各种高度属性的最大值，以确保获取到准确的内容高度。

### 缩放比例计算

```typescript
// 分别计算基于宽度和高度的缩放比例
const scaleByWidth = containerWidth / CONTENT_BASE_WIDTH  // 1920
const scaleByHeight = containerHeight / actualHeight

// 取较小值以确保内容完全适应容器
const scaleRatio = Math.min(scaleByWidth, scaleByHeight)
```

### 居中对齐

```typescript
// 垂直居中
const scaledHeight = actualHeight * scaleRatio
const verticalOffset = (containerHeight - scaledHeight) / 2 / scaleRatio

// 水平居中
const scaledWidth = CONTENT_BASE_WIDTH * scaleRatio
const horizontalOffset = (containerWidth - scaledWidth) / 2 / scaleRatio
```

注意：偏移量需要除以 scaleRatio，因为 CSS transform 的 translate 会受到 scale 的影响。

## 性能优化

1. **防抖处理**：使用 16ms 防抖（约 60fps），避免频繁计算
2. **条件计算**：只有在 `isPptRender` 为 true 且 iframe 已加载时才进行计算
3. **事件监听**：
   - 使用 ResizeObserver 监听容器尺寸变化
   - 自动清理事件监听器

## 预渲染切换优化

为避免全屏切换时出现缩放闪动与黑屏，增加了以下策略：

1. **可见性驱动计算**：通过 `isVisible` 在 slide 变为可见时触发同步计算。
2. **同步缩放**：在 `useLayoutEffect` 中执行一次同步计算，确保首帧使用正确缩放。
3. **保持布局**：全屏下非激活页使用 `visibility: hidden` 保持尺寸可计算。
4. **动画控制**：隐藏状态暂停 CSS 动画，避免入场动画提前播放。
   - 通过 `setAnimationState` 消息在 iframe 内注入/移除暂停样式。

## 向后兼容性

### 接口变更

**IsolatedHTMLRenderer Props 移除：**
- `scaleRatio?: number`
- `verticalOffset?: number`
- `horizontalOffset?: number`
- `setScaleRatio?: (ratio: number) => void`
- `setVerticalOffset?: (offset: number) => void`
- `setHorizontalOffset?: (offset: number) => void`

这些 props 不再需要从外部传入，缩放逻辑完全由 hook 内部管理。

**PPTSlide Props 移除：**
- 同上

### 迁移指南

如果有其他地方使用了 IsolatedHTMLRenderer 并传入了上述 props，需要移除这些 props：

```typescript
// 之前
<IsolatedHTMLRenderer
  content={content}
  isPptRender
  scaleRatio={1}
  verticalOffset={0}
  horizontalOffset={0}
  setScaleRatio={setRatio}
  setVerticalOffset={setVOffset}
  setHorizontalOffset={setHOffset}
/>

// 之后
<IsolatedHTMLRenderer
  content={content}
  isPptRender
  filePathMapping={new Map()}
  openNewTab={() => {}}
/>
```

## 测试

运行测试：
```bash
pnpm test src/opensource/pages/superMagic/components/Detail/contents/HTML/hooks/__tests__/useIframeScaling.test.ts
```

所有测试通过 ✅

## PPT Store 中的缩放管理

虽然 PPTStore 中仍然保留了 `scaleRatio`, `verticalOffset`, `horizontalOffset` 的属性和方法，但当前实现中每个 slide 独立管理自己的缩放。这允许：

1. 每个 slide 根据自己的内容高度独立计算缩放比例
2. 当切换 slides 时，自动调整缩放以适应不同的内容高度

## 未来优化方向

1. **缓存优化**：缓存已计算的内容高度，避免重复计算
2. **渐进式加载**：对于大型 HTML 文档，可以分阶段计算高度
3. **性能监控**：添加性能指标收集，监控缩放计算的耗时
4. **自适应策略**：根据内容类型（文档/图片/混合）采用不同的缩放策略

## 相关文档

- [useIframeScaling Hook 文档](./hooks/useIframeScaling.md)
- [IsolatedHTMLRenderer README](./README.md)
- [PPT Render 迁移文档](../../components/PPTRender/MIGRATION_TO_V2.md)
