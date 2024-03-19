# useZoomControls Hook

## 概述

`useZoomControls` 是一个用于管理 HTML 内容缩放控制的自定义 Hook。它封装了缩放逻辑、样式计算和用户交互处理，提供了完整的缩放控制解决方案。

## 功能特性

- **自动缩放**：根据容器尺寸自动计算最佳缩放比例
- **手动缩放**：支持用户手动调整缩放比例
- **缩放重置**：一键重置到自动缩放模式
- **样式计算**：自动计算内容包装器和 iframe 的样式
- **编辑模式集成**：退出编辑模式时自动重置缩放

## 使用方法

```typescript
import { useZoomControls } from './hooks/useZoomControls'

function MyComponent() {
  const containerRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  
  const {
    scaleRatio,
    isManualZoom,
    handleScaleChange,
    handleResetZoom,
    getContentWrapperStyle,
    getIframeStyle,
  } = useZoomControls({
    containerRef,
    iframeRef,
    isPptRender: true,
    isFullscreen: false,
    iframeLoaded: true,
    contentInjected: true,
    isVisible: true,
    isEditMode: false,
    minScale: 0.1,
    maxScale: 1.5,
  })

  return (
    <div ref={containerRef}>
      <div style={getContentWrapperStyle()}>
        <iframe 
          ref={iframeRef}
          style={getIframeStyle(hasRenderedOnce)}
        />
      </div>
      
      <ZoomControls
        currentScale={scaleRatio}
        onScaleChange={handleScaleChange}
        onResetZoom={handleResetZoom}
      />
    </div>
  )
}
```

## API

### 配置参数 (ZoomControlsConfig)

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `containerRef` | `RefObject<HTMLDivElement>` | ✓ | - | 容器元素引用 |
| `iframeRef` | `RefObject<HTMLIFrameElement>` | ✓ | - | iframe 元素引用 |
| `isPptRender` | `boolean` | - | `false` | 是否为 PPT 渲染模式 |
| `isFullscreen` | `boolean` | - | `false` | 是否全屏模式 |
| `iframeLoaded` | `boolean` | - | `false` | iframe 是否已加载 |
| `contentInjected` | `boolean` | - | `false` | 内容是否已注入 |
| `isVisible` | `boolean` | - | `true` | 是否可见 |
| `isEditMode` | `boolean` | - | `false` | 是否编辑模式 |
| `minScale` | `number` | - | `0.1` | 最小缩放比例 (10%) |
| `maxScale` | `number` | - | `1.5` | 最大缩放比例 (150%) |

### 返回值 (ZoomControlsResult)

#### 状态属性

- `scaleRatio: number` - 当前缩放比例
- `isManualZoom: boolean` - 是否处于手动缩放模式
- `isScaleReady: boolean` - 缩放是否准备就绪
- `shouldApplyScaling: boolean` - 是否应用缩放

#### 尺寸属性

- `contentWidth: number` - 内容宽度
- `contentHeight: number` - 内容高度
- `containerDimensions: { width: number; height: number }` - 容器尺寸
- `verticalOffset: number` - 垂直偏移量
- `horizontalOffset: number` - 水平偏移量

#### 控制方法

- `handleScaleChange: (newScale: number) => void` - 处理缩放变化
  - 参数会自动限制在 minScale 和 maxScale 之间
  
- `handleResetZoom: () => void` - 重置缩放
  - 如果有滚动条，会先平滑滚动到顶部
  - 然后重置到自动缩放模式

#### 样式计算方法

- `getContentWrapperStyle: () => CSSProperties` - 获取内容包装器样式
  - 根据当前缩放模式返回合适的样式
  - 自动处理手动缩放和自动缩放的样式差异
  
- `getIframeStyle: (hasRenderedOnce: boolean) => CSSProperties` - 获取 iframe 样式
  - 参数 `hasRenderedOnce`: 是否已渲染过一次，用于控制过渡效果
  - 返回包含 transform、尺寸等的完整样式对象

## 样式计算逻辑

### 内容包装器样式

**手动缩放模式**：
- 使用视觉尺寸计算（`contentWidth * scaleRatio`）
- 添加 padding 避免内容贴边
- 向上取整防止子像素舍入问题

**自动缩放模式**：
- 固定尺寸以适应容器
- 使用 flex 布局居中内容

**非缩放模式**：
- 100% 宽高填充容器

### iframe 样式

**应用缩放时**：
- 使用 CSS transform scale 进行缩放
- transform-origin 设置为 center
- 首次渲染时有过渡动画

**不应用缩放时**：
- 返回空对象，保持默认样式

## 与 useIframeScaling 的关系

`useZoomControls` 是对 `useIframeScaling` 的高级封装：

```
useIframeScaling (底层)
    ↓
useZoomControls (高级封装)
    ↓
IsolatedHTMLRenderer (使用方)
```

**useIframeScaling** 负责：
- 核心缩放计算
- 容器尺寸监听
- 内容尺寸测量

**useZoomControls** 额外提供：
- 用户交互处理
- 缩放范围限制
- 编辑模式集成
- 样式计算封装

## 最佳实践

1. **性能优化**：样式计算方法使用 `useMemoizedFn` 缓存，避免不必要的重新计算

2. **滚动处理**：重置缩放时会自动处理滚动位置，提供流畅的用户体验

3. **编辑模式**：退出编辑模式时自动重置缩放，保持一致的视觉体验

4. **范围限制**：缩放比例自动限制在合理范围内（默认 10% - 150%）

## 示例场景

### PPT 预览模式

```typescript
const zoomControls = useZoomControls({
  containerRef,
  iframeRef,
  isPptRender: true,
  isEditMode: false,
  minScale: 0.5,
  maxScale: 2.0,
  // ...其他配置
})
```

### HTML 编辑模式

```typescript
const zoomControls = useZoomControls({
  containerRef,
  iframeRef,
  isPptRender: true,
  isEditMode: true,
  minScale: 0.1,
  maxScale: 1.5,
  // ...其他配置
})

// 退出编辑模式时会自动重置缩放
```
