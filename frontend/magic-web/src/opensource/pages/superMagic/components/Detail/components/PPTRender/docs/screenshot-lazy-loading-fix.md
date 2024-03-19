# PPT 缩略图懒加载问题修复

## 问题现象

中间部分的缩略图没有触发加载，导致用户滚动时看到空白的缩略图占位符。

## 根本原因分析

### 1. 滚动容器识别错误

**问题**：Intersection Observer 默认使用 `window` 作为 root，但实际的滚动容器是 `ScrollArea` 内部的 div。

**影响**：

- 监听的是元素相对于 window viewport 的可见性
- 实际应该监听相对于 ScrollArea 滚动容器的可见性
- 导致在 ScrollArea 内滚动时，Observer 无法正确触发

### 2. 初始检测时机问题

**问题**：`getBoundingClientRect()` 在 useEffect 执行时，DOM 可能还没有完成布局。

**影响**：

- 获取的位置信息不准确
- 初始可见的元素可能被误判为不可见
- 导致应该立即加载的缩略图没有触发

### 3. 坐标系统不一致

**问题**：初始检测使用 window 坐标系，但滚动容器是 ScrollArea。

**影响**：

- `rect.top` 和 `rect.bottom` 是相对于 viewport 的
- 但应该相对于 ScrollArea 容器计算
- 导致可见性判断不准确

## 解决方案

### 1. 自动查找滚动容器

```typescript
// Find ScrollArea container as root for Intersection Observer
let scrollContainer: Element | null = element.parentElement
while (scrollContainer) {
	const overflowY = window.getComputedStyle(scrollContainer).overflowY
	if (overflowY === "auto" || overflowY === "scroll") {
		break
	}
	scrollContainer = scrollContainer.parentElement
}
```

**优点**：

- 自动适配任何滚动容器
- 不需要手动传递滚动容器引用
- 兼容 ScrollArea 等封装组件

### 2. 使用 requestAnimationFrame 延迟检测

```typescript
requestAnimationFrame(() => {
	if (!element) return

	// 确保 DOM 布局完成后再检测
	const rect = element.getBoundingClientRect()
	// ...
})
```

**优点**：

- 确保 DOM 完全渲染后再进行检测
- 获取准确的元素位置信息
- 避免初始检测的竞态条件

### 3. 相对于容器计算可见性

```typescript
const rect = element.getBoundingClientRect()
const containerRect = scrollContainer?.getBoundingClientRect() || {
	top: 0,
	bottom: window.innerHeight,
}

const isInitiallyVisible =
	rect.top < containerRect.bottom + 300 && rect.bottom > containerRect.top - 300
```

**优点**：

- 使用正确的坐标系统
- 准确判断相对于滚动容器的可见性
- 支持 300px 预加载边距

### 4. 配置正确的 Observer root

```typescript
observerRef.current = new IntersectionObserver(
	(entries) => {
		entries.forEach((entry) => {
			if (entry.isIntersecting) {
				requestScreenshot()
			}
		})
	},
	{
		root: scrollContainer, // 使用 ScrollArea 容器作为 root
		rootMargin: "300px 0px 300px 0px",
		threshold: 0,
	},
)
```

**优点**：

- 监听相对于正确滚动容器的可见性
- 预加载距离正确计算
- 滚动时准确触发加载

### 5. 优化 Observer 管理

```typescript
const observerRef = useRef<IntersectionObserver | null>(null)

// Clean up previous observer if exists
if (observerRef.current) {
	observerRef.current.disconnect()
	observerRef.current = null
}
```

**优点**：

- 避免重复创建 Observer
- 正确清理旧的 Observer
- 防止内存泄漏

## 修复效果

### 修复前

- ❌ 初始只加载前 5 个缩略图
- ❌ 中间部分滚动时不触发加载
- ❌ 需要滚动多次才能看到缩略图
- ❌ 初始可见的缩略图也可能不加载

### 修复后

- ✅ 初始自动加载所有可见的缩略图
- ✅ 滚动时提前 300px 预加载
- ✅ 滚动平滑，无感知延迟
- ✅ 准确识别滚动容器和可见性

## 性能优化

### 加载策略

1. **初始加载**：使用 `requestAnimationFrame` 检测初始可见的所有缩略图
2. **预加载**：提前 300px 预加载即将可见的缩略图
3. **按需加载**：仅生成可见或即将可见的缩略图
4. **缓存复用**：已生成的缩略图自动缓存，避免重复生成

### 内存管理

- Observer 在组件卸载时自动清理
- 已请求的缩略图使用 ref 标记，避免重复请求
- 缩略图 URL 使用 blob URL，浏览器自动管理

## 调试技巧

### 1. 检查滚动容器

```typescript
console.log("Scroll container:", scrollContainer)
console.log("Overflow Y:", window.getComputedStyle(scrollContainer).overflowY)
```

### 2. 检查元素位置

```typescript
const rect = element.getBoundingClientRect()
const containerRect = scrollContainer?.getBoundingClientRect()
console.log("Element rect:", rect)
console.log("Container rect:", containerRect)
console.log("Is initially visible:", isInitiallyVisible)
```

### 3. 监听 Observer 事件

```typescript
observerRef.current = new IntersectionObserver(
	(entries) => {
		entries.forEach((entry) => {
			console.log("Intersection:", {
				index: item.index,
				isIntersecting: entry.isIntersecting,
				intersectionRatio: entry.intersectionRatio,
			})
			if (entry.isIntersecting) {
				requestScreenshot()
			}
		})
	},
	// ...
)
```

## 浏览器兼容性

### Intersection Observer

- Chrome/Edge: 51+
- Firefox: 55+
- Safari: 12.1+
- 覆盖率: 96%+

### requestAnimationFrame

- Chrome/Edge: 10+
- Firefox: 4+
- Safari: 6+
- 覆盖率: 99%+

## 相关文件

- `PPTStore.ts`: 添加了 `viewport` 和 `initialScreenshotCount` 配置
- `SortableSlideItem.tsx`: 修复了懒加载检测逻辑
- `PPTSidebar/index.tsx`: 传递 `onRequestScreenshot` 回调
- `index.tsx` (PPTRender): 配置 `screenshotStrategy: "viewport"`

## 未来改进

### 1. 虚拟滚动

对于超长列表(> 100 个缩略图)，可以考虑使用虚拟滚动：

- 仅渲染可见区域的 DOM 元素
- 进一步减少内存占用
- 提升滚动性能

### 2. 渐进式加载

可以实现多级加载策略：

- 第一阶段：加载低分辨率缩略图(更快)
- 第二阶段：可见时加载高分辨率缩略图
- 提升首屏加载速度

### 3. 预测性加载

根据滚动方向和速度预测用户行为：

- 快速向下滚动时，多预加载下方缩略图
- 慢速浏览时，减少预加载距离
- 智能调整预加载策略
