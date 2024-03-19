# 移动端聊天动画 Hooks

该目录包含了专门为移动端聊天页面设计的动画 hooks，提供了流畅和一致的用户体验。

## Hooks 概览

### 1. `useSlideAnimation` - 通用滑动动画

最基础的滑动动画 hook，支持四个方向的滑动效果。

```tsx
import { useSlideAnimation } from "../hooks"

function MyComponent({ visible }: { visible: boolean }) {
  const animation = useSlideAnimation(visible, {
    direction: "right", // "left" | "right" | "up" | "down"
    duration: 300,
    easing: "cubic-bezier(0.4, 0, 0.2, 1)",
    onEntered: () => console.log("进入动画完成"),
    onExited: () => console.log("退出动画完成"),
  })

  if (!animation.isVisible && !animation.isAnimating) return null

  return (
    <div 
      className={animation.getAnimationClassName("my-container")}
      style={animation.getAnimationStyles()}
    >
      内容
    </div>
  )
}
```

### 2. `useConversationAnimation` - 对话页面动画

专门为对话页面设计的动画 hook，包含固定定位和层级管理。

```tsx
import { useConversationAnimation, CHAT_MOBILE_ANIMATION } from "../hooks"

function ConversationPage({ visible }: { visible: boolean }) {
  const {
    shouldRender,
    getContainerStyles,
    getContainerClassName,
  } = useConversationAnimation(visible, CHAT_MOBILE_ANIMATION.CONVERSATION)

  if (!shouldRender) return null

  return (
    <div 
      className={getContainerClassName("conversation-container")}
      style={getContainerStyles()}
    >
      对话内容
    </div>
  )
}
```

### 3. `useModalAnimation` - 模态框动画

通用的模态框动画 hook，支持多种动画类型。

```tsx
import { useModalAnimation, CHAT_MOBILE_ANIMATION } from "../hooks"

function MyModal({ visible }: { visible: boolean }) {
  const {
    shouldRender,
    getModalStyles,
    getBackdropStyles,
    getModalClassName,
  } = useModalAnimation(visible, {
    type: "fade", // "fade" | "scale" | "slideUp" | "slideDown"
    ...CHAT_MOBILE_ANIMATION.MODAL
  })

  if (!shouldRender) return null

  return (
    <>
      <div className="backdrop" style={getBackdropStyles()} />
      <div 
        className={getModalClassName("modal")}
        style={getModalStyles()}
      >
        模态框内容
      </div>
    </>
  )
}
```

## 动画配置

使用 `animationConfig.ts` 中的预定义配置，确保整个应用的动画一致性：

```tsx
import { CHAT_MOBILE_ANIMATION, EASING, DURATION } from "../hooks"

// 使用预定义的对话动画配置
useConversationAnimation(visible, CHAT_MOBILE_ANIMATION.CONVERSATION)

// 使用预定义的模态框配置
useModalAnimation(visible, CHAT_MOBILE_ANIMATION.MODAL)

// 使用预定义的底部弹出配置
useModalAnimation(visible, CHAT_MOBILE_ANIMATION.BOTTOM_SHEET)

// 自定义配置
useSlideAnimation(visible, {
  duration: DURATION.FAST,
  easing: EASING.SPRING,
  direction: "left",
})
```

## 最佳实践

### 1. 条件渲染优化

使用 `shouldRender` 来优化性能，避免不必要的 DOM 渲染：

```tsx
const { shouldRender, ...animation } = useConversationAnimation(visible)

// ✅ 推荐：使用 shouldRender
if (!shouldRender) return null

// ❌ 避免：总是渲染但隐藏
return <div style={{ display: shouldRender ? 'block' : 'none' }}>...</div>
```

### 2. 样式组合

正确组合动画样式和现有样式：

```tsx
const containerStyles = {
  backgroundColor: "#fff",
  borderRadius: "8px",
  ...getContainerStyles(), // 动画样式应该放在最后
}
```

### 3. 动画回调

使用动画回调来处理副作用：

```tsx
useConversationAnimation(visible, {
  ...CHAT_MOBILE_ANIMATION.CONVERSATION,
  onEntered: () => {
    // 动画进入完成后的操作
    trackEvent("conversation_opened")
  },
  onExited: () => {
    // 动画退出完成后的操作
    resetConversationState()
  },
})
```

### 4. 性能优化

- 使用 `will-change` 属性来优化动画性能（已内置）
- 避免在动画过程中修改其他 CSS 属性
- 使用 `transform` 和 `opacity` 来实现动画（已内置）

## 注意事项

1. **状态管理**：hooks 内部管理动画状态，无需额外的状态管理
2. **内存清理**：hooks 会自动清理定时器，无需手动清理
3. **浏览器兼容性**：使用了现代 CSS 特性，需要考虑目标浏览器支持
4. **性能监控**：在低端设备上测试动画性能，必要时调整参数

## 扩展

如需添加新的动画类型，可以：

1. 扩展现有 hooks 的选项
2. 创建新的专用 hooks
3. 更新 `animationConfig.ts` 添加新的配置

例如，添加新的侧边栏动画：

```tsx
// hooks/useSidebarAnimation.ts
export function useSidebarAnimation(visible: boolean) {
  return useSlideAnimation(visible, CHAT_MOBILE_ANIMATION.SIDEBAR)
}
``` 