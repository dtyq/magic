# PPT Screenshot Lazy Loading

## 概述

PPT 缩略图现在支持三种加载策略,可以根据场景选择最优的性能方案:

1. **Eager Loading (预加载)** - 初始化时立即生成所有缩略图
2. **Lazy Loading (懒加载)** - 仅在明确请求时生成缩略图
3. **Viewport Loading (视口加载)** - 仅在缩略图进入或即将进入视口时生成(推荐)

## 配置方式

### 基本配置

```typescript
import { createPPTStore } from "./stores"

// 方式 1: 使用 viewport 策略(推荐)
const store = createPPTStore({
	attachments: [],
	attachmentList: [],
	mainFileId: "main-file-id",
	mainFileName: "main.html",
	metadata: {},
	screenshotStrategy: "viewport", // 视口加载
	initialScreenshotCount: 5, // 初始生成5个缩略图(可选,默认5)
})

// 方式 2: 使用 lazy 策略
const store = createPPTStore({
	// ...其他配置
	screenshotStrategy: "lazy", // 完全手动控制
})

// 方式 3: 使用 eager 策略(默认,向后兼容)
const store = createPPTStore({
	// ...其他配置
	screenshotStrategy: "eager", // 或不设置,默认为 eager
})
```

### 向后兼容

旧的 `autoLoadAndGenerate` 配置仍然可用,会自动转换为新的配置:

```typescript
// 旧方式(仍然支持)
const store = createPPTStore({
	// ...
	autoLoadAndGenerate: false, // 等同于 autoLoadSlides: false
})

// 新方式(推荐)
const store = createPPTStore({
	// ...
	autoLoadSlides: false, // 控制是否自动加载幻灯片内容
	screenshotStrategy: "viewport", // 控制缩略图生成策略
})
```

## 策略对比

### Eager Loading (预加载)

**适用场景:**

- 幻灯片数量较少(< 20 页)
- 需要立即显示所有缩略图
- 网络条件良好

**优点:**

- 用户体验流畅,无等待
- 适合小型演示文稿

**缺点:**

- 初始加载时间长
- 内存占用大
- 可能造成浏览器卡顿

**示例:**

```typescript
const store = createPPTStore({
	// ...
	screenshotStrategy: "eager",
})
```

### Lazy Loading (懒加载)

**适用场景:**

- 需要完全控制缩略图生成时机
- 有自定义的加载逻辑
- 特殊的性能优化需求

**优点:**

- 完全可控
- 最小的初始开销

**缺点:**

- 需要手动触发
- 实现复杂度较高

**示例:**

```typescript
const store = createPPTStore({
	// ...
	screenshotStrategy: "lazy",
})

// 手动生成特定幻灯片的缩略图
await store.generateSlideScreenshot(0)

// 或批量生成
await store.generateAllScreenshots()
```

### Viewport Loading (视口加载,推荐)

**适用场景:**

- 幻灯片数量多(> 20 页)
- 需要优化性能和用户体验
- 大多数生产环境

**优点:**

- 按需生成,性能最优
- 自动生成初始可见的缩略图(前5个)
- 其他缩略图使用 Intersection Observer 预加载
- 用户体验好,感知延迟低

**缺点:**

- 实现复杂度中等
- 依赖 Intersection Observer API(可降级)

**实现原理:**

1. **初始加载**: 自动生成前 N 个缩略图(默认5个)
2. **UI 层检测**: 使用 `getBoundingClientRect` 检查初始可见性
3. **懒加载**: 使用 Intersection Observer API 监听其他缩略图:
    - 当缩略图进入视口前 300px 时开始生成
    - 自动跟踪已生成的缩略图,避免重复
    - 支持快速滚动场景

**示例:**

```typescript
const store = createPPTStore({
	// ...
	screenshotStrategy: "viewport",
	initialScreenshotCount: 5, // 初始生成5个缩略图(可选)
})

// 在 PPTRender 组件中
<PPTSidebar
	// ...其他 props
	onRequestScreenshot={(index) => store.generateSlideScreenshot(index)}
/>
```

## 技术实现

### PPTStore 层

```typescript
export interface PPTStoreConfig {
	// ...
	screenshotStrategy?: "eager" | "lazy" | "viewport"
}

class PPTStore {
	constructor(config: PPTStoreConfig) {
		const screenshotStrategy = config.screenshotStrategy ?? "eager"
		// ...
	}

	async loadAllSlides() {
		// ...加载幻灯片内容

		// 根据策略决定是否自动生成缩略图
		if (this.config.screenshotStrategy === "eager") {
			this.generateAllScreenshots()
		}
		// lazy 和 viewport 策略不自动生成
	}
}
```

### 组件层 (SortableSlideItem)

```typescript
export function SortableSlideItem({
	// ...
	onRequestScreenshot,
}: SortableSlideItemProps) {
	const thumbnailRef = useRef<HTMLDivElement>(null)
	const hasRequestedScreenshot = useRef(false)

	// 使用 Intersection Observer 检测可见性
	useEffect(() => {
		if (screenshot?.thumbnailUrl || screenshot?.isLoading) {
			return // 已有缩略图或正在加载
		}

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting && !hasRequestedScreenshot.current) {
						hasRequestedScreenshot.current = true
						onRequestScreenshot?.()
					}
				})
			},
			{
				rootMargin: "200px", // 提前 200px 预加载
				threshold: 0,
			},
		)

		if (thumbnailRef.current) {
			observer.observe(thumbnailRef.current)
		}

		return () => observer.disconnect()
	}, [screenshot?.thumbnailUrl, screenshot?.isLoading])

	// 渲染缩略图容器
	return <div ref={thumbnailRef}>{/* ... */}</div>
}
```

## 性能优化建议

### 1. 选择合适的策略

| 幻灯片数量 | 推荐策略 | 说明                |
| ---------- | -------- | ------------------- |
| < 10       | eager    | 数量少,预加载体验好 |
| 10-50      | viewport | 平衡性能和体验      |
| > 50       | viewport | 必须懒加载,避免卡顿 |

### 2. 调整预加载距离

```typescript
// 在 SortableSlideItem 中调整 rootMargin
const observer = new IntersectionObserver(
	(entries) => {
		// ...
	},
	{
		rootMargin: "200px", // 可根据实际情况调整(100px - 500px)
		threshold: 0,
	},
)
```

### 3. 缓存策略

PPTStore 内部已实现缩略图缓存:

- 基于 URL 或 slide index 作为 key
- 自动复用已生成的缩略图
- 内容变化时自动重新生成

### 4. 监控和调试

```typescript
// 获取缓存统计
const stats = store.getScreenshotCacheStats()
console.log("缓存命中率:", stats.hitRate)
console.log("总缓存数:", stats.totalCached)
```

## 迁移指南

### 从旧版本迁移

如果你的代码使用了旧的配置:

```typescript
// 旧代码
const store = createPPTStore({
	// ...
	autoLoadAndGenerate: true,
})
```

建议更新为:

```typescript
// 新代码
const store = createPPTStore({
	// ...
	autoLoadSlides: true, // 自动加载内容
	screenshotStrategy: "viewport", // 按需生成缩略图
})
```

### 自定义实现

如果需要自定义加载逻辑:

```typescript
const store = createPPTStore({
	// ...
	screenshotStrategy: "lazy", // 使用 lazy 策略
})

// 自定义加载逻辑
async function loadVisibleSlides(visibleIndices: number[]) {
	for (const index of visibleIndices) {
		await store.generateSlideScreenshot(index)
	}
}

// 在组件中调用
useEffect(() => {
	loadVisibleSlides([0, 1, 2]) // 加载前三张
}, [])
```

## 常见问题

### Q: 如何判断缩略图是否已加载?

A: 检查 slide 的 `thumbnailUrl` 和 `thumbnailLoading` 状态:

```typescript
const slide = store.slides[index]
if (slide.thumbnailUrl) {
	// 已加载
} else if (slide.thumbnailLoading) {
	// 加载中
} else {
	// 未加载
}
```

### Q: Viewport 策略会生成所有缩略图吗?

A: 只会生成可见或即将可见的缩略图。如果用户不滚动侧边栏,底部的缩略图不会被生成。

### Q: 如何强制重新生成某个缩略图?

A: 先清除缓存,再生成:

```typescript
store.clearSlideScreenshot(index)
await store.generateSlideScreenshot(index)
```

### Q: 性能问题怎么办?

A: 检查以下几点:

1. 是否选择了合适的策略?
2. 幻灯片内容是否过大?(优化 HTML)
3. 是否有内存泄漏?(检查 Observer 清理)
4. 浏览器是否支持 Intersection Observer?

## 浏览器兼容性

Viewport 策略依赖 Intersection Observer API:

- Chrome/Edge: 51+
- Firefox: 55+
- Safari: 12.1+
- 不支持的浏览器会自动降级为 lazy 策略

检测支持:

```typescript
if ("IntersectionObserver" in window) {
	// 支持 viewport 策略
} else {
	// 使用 lazy 或 eager 策略
}
```
