# PPT Event Bus

PPT 组件的事件总线系统，使用发布-订阅模式实现组件间解耦通信。

## 设计理念

事件总线（Event Bus）使用发布-订阅模式，允许组件间进行松耦合通信：

- **解耦组件依赖**：组件不需要知道彼此的存在
- **避免 Props 透传**：不需要一层层传递 props
- **灵活扩展**：轻松添加新的事件类型
- **类型安全**：TypeScript 提供完整的类型支持
- **实例隔离**：每个 PPTRender 实例有独立的事件总线，互不干扰

## 架构说明

```
┌─────────────────────────────────────────┐
│          PPTRender (外层壳)              │
│  创建独立的 EventBus 实例                 │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │   PPTEventBusProvider (Context)   │  │
│  │   提供 EventBus 实例               │  │
│  │                                   │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │   PPTRenderInner            │  │  │
│  │  │   (订阅事件)                 │  │  │
│  │  │   - onDownload              │  │  │
│  │  │   - onFullscreen            │  │  │
│  │  └───────────┬─────────────────┘  │  │
│  │              │                    │  │
│  │              │ subscribes to      │  │
│  │              │                    │  │
│  │         ┌────▼─────┐              │  │
│  │         │ EventBus │              │  │
│  │         │ Instance │              │  │
│  │         └────▲─────┘              │  │
│  │              │                    │  │
│  │              │ publishes to       │  │
│  │              │                    │  │
│  │  ┌───────────┴─────────────────┐  │  │
│  │  │      EditToolbar            │  │  │
│  │  │      (发布事件)              │  │  │
│  │  │   - emitDownload            │  │  │
│  │  │   - emitFullscreen          │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘

每个 PPTRender 实例都有独立的 EventBus，互不影响
```

## 使用方法

### 1. 发布事件（Publisher）

在需要触发操作的组件中发布事件：

```tsx
import { usePPTEventBus } from "../PPTRender/hooks/usePPTEventBus"

function EditToolbar() {
  const { emitDownload, emitFullscreenToggle } = usePPTEventBus()
  
  return (
    <>
      <Button onClick={() => emitDownload(fileId)}>
        Download
      </Button>
      <Button onClick={() => emitFullscreenToggle()}>
        Fullscreen
      </Button>
    </>
  )
}
```

### 2. 订阅事件（Subscriber）

在需要处理操作的组件中订阅事件：

```tsx
import { usePPTEventBus } from "./hooks/usePPTEventBus"

function PPTRender({ onDownload, onFullscreen }) {
  const { onDownloadRequest, onFullscreenToggle } = usePPTEventBus()
  
  // Subscribe to download event
  useEffect(() => {
    const unsubscribe = onDownloadRequest((payload) => {
      onDownload?.(payload.fileId)
    })
    return unsubscribe
  }, [onDownload, onDownloadRequest])
  
  // Subscribe to fullscreen toggle event
  useEffect(() => {
    const unsubscribe = onFullscreenToggle(() => {
      onFullscreen?.()
    })
    return unsubscribe
  }, [onFullscreen, onFullscreenToggle])
}
```

### 3. 监听状态变化

使用专用 hook 监听全屏状态变化：

```tsx
import { useFullscreenState } from "../PPTRender/hooks/usePPTEventBus"

function SomeComponent() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  useFullscreenState((fullscreen) => {
    setIsFullscreen(fullscreen)
  })
  
  return <div>{isFullscreen ? "全屏" : "正常"}</div>
}
```

## API 参考

### `usePPTEventBus()`

返回事件总线的发布和订阅方法。

**返回值：**

```typescript
{
  // Download events
  onDownloadRequest: (callback: (payload: DownloadEventPayload) => void) => () => void
  emitDownload: (fileId: string) => void
  
  // Fullscreen toggle events
  onFullscreenToggle: (callback: () => void) => () => void
  emitFullscreenToggle: () => void
  
  // Fullscreen state change events
  onFullscreenStateChange: (callback: (payload: FullscreenStateChangePayload) => void) => () => void
  emitFullscreenStateChange: (isFullscreen: boolean) => void
}
```

### `useFullscreenState(callback)`

自动订阅和取消订阅全屏状态变化。

**参数：**
- `callback: (isFullscreen: boolean) => void` - 状态变化时的回调函数

**示例：**

```tsx
useFullscreenState((isFullscreen) => {
  console.log('Fullscreen state changed:', isFullscreen)
})
```

## 事件类型

### `PPT_EVENTS.DOWNLOAD`

下载文件事件。

**Payload:**
```typescript
{
  fileId: string
}
```

### `PPT_EVENTS.FULLSCREEN_TOGGLE`

切换全屏事件（无 payload）。

### `PPT_EVENTS.FULLSCREEN_STATE_CHANGE`

全屏状态变化事件。

**Payload:**
```typescript
{
  isFullscreen: boolean
}
```

## 最佳实践

### 1. 总是清理订阅

订阅事件时，确保在组件卸载时取消订阅：

```tsx
useEffect(() => {
  const unsubscribe = onDownloadRequest((payload) => {
    // handle download
  })
  return unsubscribe // 清理订阅
}, [onDownloadRequest])
```

### 2. 使用 TypeScript 类型

利用 TypeScript 确保类型安全：

```tsx
import type { DownloadEventPayload } from "../events/PPTEventBus"

const handleDownload = (payload: DownloadEventPayload) => {
  console.log(payload.fileId) // 类型安全
}
```

### 3. 错误处理

事件处理器中的错误会被自动捕获并记录：

```tsx
onDownloadRequest((payload) => {
  try {
    // 可能出错的操作
  } catch (error) {
    console.error('Download failed:', error)
  }
})
```

### 4. 添加新事件类型

在 `PPTEventBus.ts` 中添加新的事件常量：

```typescript
export const PPT_EVENTS = {
  DOWNLOAD: "ppt:download",
  FULLSCREEN_TOGGLE: "ppt:fullscreen:toggle",
  FULLSCREEN_STATE_CHANGE: "ppt:fullscreen:state:change",
  // 添加新的事件类型
  SHARE: "ppt:share",
} as const
```

然后在 `usePPTEventBus` hook 中添加对应的方法：

```typescript
// 在 usePPTEventBus 中添加
const onShareRequest = useCallback((callback: () => void) => {
  return pptEventBus.on(PPT_EVENTS.SHARE, callback)
}, [])

const emitShare = useCallback(() => {
  pptEventBus.emit(PPT_EVENTS.SHARE)
}, [])

return {
  // ...existing methods
  onShareRequest,
  emitShare,
}
```

## 对比 Context 方案

### Context 方案的问题

```tsx
// 需要层层传递 props
<PPTRender>
  <SomeMiddleComponent>
    <EditToolbar onDownload={onDownload} onFullscreen={onFullscreen} />
  </SomeMiddleComponent>
</PPTRender>

// 或者需要 Provider 包裹
<PPTActionsProvider onDownload={onDownload} onFullscreen={onFullscreen}>
  {children}
</PPTActionsProvider>
```

### 事件总线方案的优势

```tsx
// 发布者和订阅者完全解耦
// PPTRender 中订阅事件
useEffect(() => {
  return onDownloadRequest((payload) => onDownload?.(payload.fileId))
}, [onDownload, onDownloadRequest])

// EditToolbar 中发布事件
<Button onClick={() => emitDownload(fileId)}>Download</Button>
```

## 注意事项

1. **实例隔离**：每个 PPTRender 实例都有独立的事件总线，不同实例之间的事件不会相互影响
2. **内存泄漏**：确保在组件卸载时取消订阅（使用 useEffect 返回清理函数）
3. **Context 依赖**：usePPTEventBus 必须在 PPTEventBusProvider 内部使用
4. **作用域**：事件只在当前 PPTRender 实例范围内生效

## 高级用法

### 一次性订阅

```tsx
import { usePPTEventBusContext } from "../contexts/PPTEventBusContext"

function MyComponent() {
  const eventBus = usePPTEventBusContext()
  
  useEffect(() => {
    const unsubscribe = eventBus.once(PPT_EVENTS.DOWNLOAD, (payload) => {
      console.log('This will only run once')
    })
    return unsubscribe
  }, [eventBus])
}
```

### 手动清理所有订阅

```tsx
import { usePPTEventBusContext } from "../contexts/PPTEventBusContext"

function MyComponent() {
  const eventBus = usePPTEventBusContext()
  
  // 清理特定事件的所有订阅
  eventBus.off(PPT_EVENTS.DOWNLOAD)
  
  // 清理所有事件
  eventBus.clear()
}
```

### 调试订阅数量

```tsx
import { usePPTEventBusContext } from "../contexts/PPTEventBusContext"

function MyComponent() {
  const eventBus = usePPTEventBusContext()
  
  const count = eventBus.getSubscriberCount(PPT_EVENTS.DOWNLOAD)
  console.log(`Current subscribers: ${count}`)
}
```
