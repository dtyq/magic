# PPT 加载状态合并优化

## 优化目标

将 `isLoaded` 和 `isLoading` 两个布尔值合并为一个统一的状态枚举 `loadingState`，提升代码可维护性和类型安全性。

## 问题分析

### 原有实现（双布尔值）

```typescript
export interface SlideItem {
	id: string
	url?: string
	index: number
	path: string
	title?: string
	content?: string
	isLoaded?: boolean // 是否已加载
	isLoading?: boolean // 是否正在加载
}
```

**存在的问题：**

1. ❌ **状态冲突**：可能出现 `isLoaded=true` 且 `isLoading=true` 的非法状态
2. ❌ **状态不完整**：无法表示 "未开始" 和 "加载失败" 状态
3. ❌ **条件判断复杂**：`!isLoaded && !isLoading` 表示未加载，不直观
4. ❌ **错误处理缺失**：无法区分 "未加载" 和 "加载失败"

## 优化方案

### 1. 引入状态枚举

```typescript
/**
 * Slide loading state
 */
export type SlideLoadingState = "idle" | "loading" | "loaded" | "error"

export interface SlideItem {
	id: string
	url?: string
	index: number
	path: string
	title?: string
	content?: string
	loadingState?: SlideLoadingState // 统一的加载状态
	loadingError?: Error // 加载失败时的错误信息
}
```

**状态说明：**

- `idle`：未开始加载（初始状态）
- `loading`：正在加载中
- `loaded`：加载成功
- `error`：加载失败

### 2. 状态转换流程

```
idle → loading → loaded  (成功)
  ↓       ↓
  └───────→ error        (失败)
```

### 3. 添加辅助方法

```typescript
// PPTStore.ts
class PPTStore {
	/**
	 * Check if a slide is loaded
	 */
	private isSlideLoaded(slide: SlideItem | undefined): boolean {
		return slide?.loadingState === "loaded"
	}

	/**
	 * Check if a slide is ready to view (loaded or loading)
	 */
	private isSlideReady(slide: SlideItem | undefined): boolean {
		return slide?.loadingState === "loaded" || slide?.loadingState === "loading"
	}
}
```

## 修改对比

### 状态初始化

**旧代码：**

```typescript
this.slides.forEach((slide) => {
	slide.isLoaded = false
	slide.isLoading = false
	slide.content = undefined
})
```

**新代码：**

```typescript
this.slides.forEach((slide) => {
	slide.loadingState = "idle"
	slide.content = undefined
	slide.loadingError = undefined
})
```

### 加载过程状态更新

**旧代码：**

```typescript
// 标记为加载中
runInAction(() => {
	if (this.slides[index]) {
		this.slides[index].isLoading = true
	}
})

// 加载成功
runInAction(() => {
	if (this.slides[index]) {
		this.slides[index].isLoaded = true
		this.slides[index].isLoading = false
	}
})

// 加载失败
runInAction(() => {
	if (this.slides[index]) {
		this.slides[index].isLoading = false
		this.slides[index].isLoaded = false
	}
})
```

**新代码：**

```typescript
// 标记为加载中
runInAction(() => {
	if (this.slides[index]) {
		this.slides[index].loadingState = "loading"
	}
})

// 加载成功
runInAction(() => {
	if (this.slides[index]) {
		this.slides[index].loadingState = "loaded"
	}
})

// 加载失败
runInAction(() => {
	if (this.slides[index]) {
		this.slides[index].loadingState = "error"
		this.slides[index].loadingError = error as Error
	}
})
```

### 状态检查

**旧代码：**

```typescript
// 检查是否可以导航
get canGoNext(): boolean {
  const nextSlide = this.slides[this.activeIndex + 1]
  return Boolean(nextSlide && (nextSlide.isLoaded || nextSlide.isLoading))
}

// 检查是否已加载
const loadedSlides = this.slides.filter((slide) => slide.isLoaded && slide.content)

// 检查是否正在加载
if (slide.isLoading) {
  // ...
}
```

**新代码：**

```typescript
// 检查是否可以导航（使用辅助方法）
get canGoNext(): boolean {
  const nextSlide = this.slides[this.activeIndex + 1]
  return this.isSlideReady(nextSlide)
}

// 检查是否已加载
const loadedSlides = this.slides.filter((slide) => 
  slide.loadingState === "loaded" && slide.content
)

// 检查是否正在加载
if (slide.loadingState === "loading") {
  // ...
}
```

### 组件渲染

**旧代码：**

```tsx
{store.slideUrls.map((_, index) => (
	<PPTSlide
		key={index}
		isLoading={store.slides[index]?.isLoading || false}
		content={store.slides[index]?.content || ""}
		// ...
	/>
))}
```

**新代码：**

```tsx
{store.slides.map((slide, index) => (
	<PPTSlide
		key={slide.id}
		isLoading={slide.loadingState === "loading"}
		content={slide.content || ""}
		// ...
	/>
))}
```

## 修改文件清单

### 核心类型定义

1. **PPTSidebar/types.ts**
	- ✅ 新增 `SlideLoadingState` 类型定义
	- ✅ `SlideItem` 接口：`isLoaded` + `isLoading` → `loadingState` + `loadingError`

### 状态管理

2. **stores/PPTStore.ts**
	- ✅ 新增 `isSlideLoaded()` 辅助方法
	- ✅ 新增 `isSlideReady()` 辅助方法
	- ✅ 更新 `loadAllSlides()` 中的状态设置
	- ✅ 更新 `loadSlideContent()` 中的状态设置
	- ✅ 更新 `updateSlideContent()` 中的状态设置
	- ✅ 更新 `generateAllScreenshots()` 中的状态检查
	- ✅ 更新 `canGoNext` / `canGoPrev` 使用辅助方法
	- ✅ 更新 `goToFirstSlide()` 使用辅助方法
	- ✅ 更新 `loadingPercentage` 使用辅助方法

### UI 组件

3. **index.tsx**
	- ✅ 改用 `store.slides.map()` 直接遍历（而不是 `slideUrls.map()`）
	- ✅ 使用 `slide.id` 作为 key（更稳定）
	- ✅ 状态检查：`slide.loadingState === "loading"`

4. **hooks/usePPTSidebar.ts**
	- ✅ `handleSlideClick` 中的状态检查更新

## 优势总结

### 1. 类型安全

- ✅ **互斥状态**：不可能同时处于多个状态
- ✅ **编译时检查**：TypeScript 强类型保证
- ✅ **穷尽性检查**：switch 语句可以检查是否处理了所有状态

### 2. 代码可读性

```typescript
// 旧代码：不直观
if (!slide.isLoaded && !slide.isLoading) {
	// 未开始加载
}

// 新代码：清晰明确
if (slide.loadingState === "idle") {
	// 未开始加载
}
```

### 3. 扩展性

```typescript
// 可以轻松添加新状态，无需修改大量代码
export type SlideLoadingState = 
  | "idle" 
  | "loading" 
  | "loaded" 
  | "error"
  | "cancelled"  // 新增：取消加载
  | "retrying"   // 新增：重试中
```

### 4. 错误处理

```typescript
// 新增错误信息字段，便于调试和用户提示
if (slide.loadingState === "error") {
	console.error("加载失败:", slide.loadingError)
	showErrorMessage(slide.loadingError?.message)
}
```

## 性能影响

- ✅ **零性能损耗**：状态枚举在运行时只是字符串比较
- ✅ **内存优化**：1 个字段代替 2 个布尔字段
- ✅ **更少的条件判断**：单一状态检查，不需要组合多个布尔值

## 未来扩展

### 1. 加载进度

```typescript
export interface SlideItem {
	loadingState: SlideLoadingState
	loadingProgress?: number // 0-100，加载进度百分比
}
```

### 2. 重试机制

```typescript
export type SlideLoadingState = 
  | "idle" 
  | "loading" 
  | "loaded" 
  | "error"
  | "retrying" // 支持重试

export interface SlideItem {
	loadingState: SlideLoadingState
	retryCount?: number // 重试次数
	maxRetries?: number // 最大重试次数
}
```

### 3. 缓存状态

```typescript
export type SlideLoadingState = 
  | "idle" 
  | "loading" 
  | "loaded" 
  | "cached" // 来自缓存
  | "error"
```

## 迁移指南

### 对于现有代码

如果有其他地方使用了 `isLoaded` 或 `isLoading`：

```typescript
// 查找所有使用
grep -r "isLoaded\|isLoading" src/

// 批量替换模式
slide.isLoaded → slide.loadingState === "loaded"
slide.isLoading → slide.loadingState === "loading"
!slide.isLoaded && !slide.isLoading → slide.loadingState === "idle"
```

### 对于测试代码

```typescript
// 旧测试
expect(slide.isLoaded).toBe(true)
expect(slide.isLoading).toBe(false)

// 新测试
expect(slide.loadingState).toBe("loaded")
```

## 总结

通过将 `isLoaded` 和 `isLoading` 合并为统一的 `loadingState` 枚举：

1. ✅ **消除了状态冲突**：状态互斥，不会出现非法组合
2. ✅ **增强了类型安全**：TypeScript 类型系统提供编译时保障
3. ✅ **提升了可读性**：状态语义清晰，代码更易理解
4. ✅ **改善了错误处理**：可以区分不同的失败情况
5. ✅ **提高了扩展性**：添加新状态无需修改大量代码

这是一个标准的状态机模式实践，符合前端最佳实践，为后续功能扩展打下了良好的基础。
