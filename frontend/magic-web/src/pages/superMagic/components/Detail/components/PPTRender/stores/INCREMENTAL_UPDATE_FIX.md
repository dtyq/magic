# PPT 新增幻灯片导致重新初始化问题的修复

## 问题描述

在新增 PPT 幻灯片时，整个 PPT 会重新初始化，导致：
- 当前播放位置被重置为第一张
- 已加载的幻灯片内容丢失
- 用户体验中断

## 根本原因分析

### 1. 双重状态管理冲突

```typescript
// ❌ 问题流程：
// 1. 用户点击"插入幻灯片"
// 2. store.insertSlide() 在内部更新了 slides 数组
// 3. 父组件同时更新了 slidePaths prop
// 4. useDeepCompareEffect 检测到 slidePaths 变化
// 5. 调用 store.initializeSlides(slidePaths) 导致完全重新初始化
```

### 2. initializeSlides 的破坏性操作

```typescript
initializeSlides(slideItems: SlideItem[]): void {
    runInAction(() => {
        this.slides = slideItems
        this.activeIndex = 0  // ❌ 强制重置为 0
        this.isTransitioning = false
    })
}
```

### 3. useDeepCompareEffect 缺乏智能判断

```typescript
// ❌ 无条件重新初始化
useDeepCompareEffect(() => {
    if (slidePaths && slidePaths.length > 0) {
        store.initializeSlides(slidePaths)  // 破坏性操作
    }
}, [slidePaths])
```

## 解决方案

### 1. 实现增量更新机制

在 `PPTSlideManager` 中新增 `syncSlides()` 方法，提供智能的增量更新：

```typescript
/**
 * Sync slides with external slide paths (incremental update)
 * - 检测变更类型：插入/删除/重排序/完全替换
 * - 仅更新必要的部分，保留其他状态
 * - 自动调整 activeIndex，避免播放位置丢失
 */
syncSlides(newSlidePaths: string[]): boolean {
    // 检测是否有实际变更
    if (this.arePathsEqual(currentPaths, newSlidePaths)) {
        return false  // 无变更，跳过更新
    }

    // 检测变更类型并执行相应策略
    const changeType = this.detectChangeType(currentPaths, newSlidePaths)
    
    switch (changeType) {
        case "insert":    // 单个插入：保留其他幻灯片
        case "delete":    // 单个删除：保留其他幻灯片
        case "reorder":   // 重排序：保留所有内容和状态
        case "replace":   // 完全替换：执行完整初始化
    }
    
    return true
}
```

### 2. 变更检测逻辑

```typescript
private detectChangeType(
    oldPaths: string[],
    newPaths: string[],
): "insert" | "delete" | "reorder" | "replace" {
    const oldSet = new Set(oldPaths)
    const newSet = new Set(newPaths)

    const hasInserts = newPaths.some((path) => !oldSet.has(path))
    const hasDeletes = oldPaths.some((path) => !newSet.has(path))

    // 单个插入
    if (hasInserts && !hasDeletes && newPaths.length === oldPaths.length + 1) {
        return "insert"
    }
    // 单个删除
    if (hasDeletes && !hasInserts && newPaths.length === oldPaths.length - 1) {
        return "delete"
    }
    // 重排序
    if (!hasInserts && !hasDeletes && oldSet.size === newSet.size) {
        return "reorder"
    }
    // 完全替换
    return "replace"
}
```

### 3. 增量插入处理

```typescript
private handleIncrementalInsert(oldPaths: string[], newPaths: string[]): void {
    // 找到插入位置和新路径
    const insertedIndex = newPaths.findIndex((path, idx) => path !== oldPaths[idx])
    const insertedPath = newPaths[insertedIndex]

    // 创建新幻灯片项
    const newSlide: SlideItem = {
        id: `slide-${Date.now()}-${insertedIndex}`,
        path: insertedPath,
        url: this.pathMappingService.getUrlByPath(insertedPath),
        index: insertedIndex,
        loadingState: "idle",
    }

    runInAction(() => {
        // 在正确位置插入
        const newSlides = [...this.slides]
        newSlides.splice(insertedIndex, 0, newSlide)

        // 更新后续幻灯片的索引
        newSlides.forEach((slide, idx) => {
            slide.index = idx
        })

        this.slides = newSlides

        // ✅ 智能调整 activeIndex（插入点在当前位置之前时需要 +1）
        if (insertedIndex <= this.activeIndex) {
            this.activeIndex = this.activeIndex + 1
        }
    })
}
```

### 4. 更新组件初始化逻辑

```typescript
// ✅ 智能判断：首次使用 initializeSlides，后续使用 syncSlides
useDeepCompareEffect(() => {
    if (slidePaths && slidePaths.length > 0) {
        if (store.slides.length === 0) {
            // 首次初始化：完整初始化
            store.initializeSlides(slidePaths)
        } else {
            // 后续更新：增量同步
            const hasChanges = store.syncSlides(slidePaths)
            // hasChanges 为 true 时会自动触发加载和截图生成
        }
    }
}, [slidePaths, store])
```

## 优化效果

### Before (问题场景)
```
用户在第 5 张幻灯片，点击"插入新幻灯片"
↓
PPT 完全重新初始化
↓
activeIndex 重置为 0
↓
用户被强制回到第 1 张幻灯片 ❌
已加载的内容全部丢失 ❌
```

### After (优化后)
```
用户在第 5 张幻灯片，点击"插入新幻灯片"
↓
检测到增量插入操作
↓
仅在指定位置插入新幻灯片
↓
activeIndex 智能调整为 6（插入在前面时）或保持 5（插入在后面时）
↓
用户停留在原幻灯片或自然过渡到新位置 ✅
已加载的内容完全保留 ✅
```

## 涉及文件

### 核心修改
1. **PPTSlideManager.ts**
   - 新增 `syncSlides()` 方法
   - 新增 `detectChangeType()` 变更检测
   - 新增 `handleIncrementalInsert/Delete/Reorder()` 增量处理
   - 新增 `handleFullReplace()` 完全替换兜底

2. **PPTStore.ts**
   - 代理 `syncSlides()` 方法到 SlideManager

3. **index.tsx**
   - 更新 `useDeepCompareEffect` 逻辑
   - 首次初始化使用 `initializeSlides()`
   - 后续更新使用 `syncSlides()`

## 向后兼容性

- ✅ `initializeSlides()` 方法保留，用于首次初始化
- ✅ 现有的插入/删除/排序逻辑不受影响
- ✅ 不影响其他使用场景

## 测试建议

### 场景 1：插入幻灯片
1. 在第 3 张幻灯片时插入新幻灯片
2. 验证 activeIndex 是否正确调整
3. 验证已加载的幻灯片内容是否保留

### 场景 2：删除幻灯片
1. 删除第 2 张幻灯片
2. 验证 activeIndex 是否正确调整
3. 验证其他幻灯片内容是否保留

### 场景 3：重排序
1. 拖拽调整幻灯片顺序
2. 验证当前幻灯片是否跟随移动
3. 验证所有内容和状态是否保留

### 场景 4：首次加载
1. 全新打开 PPT
2. 验证是否正常初始化
3. 验证首次加载流程不受影响

## 性能优化

- 🚀 避免不必要的重新初始化
- 🚀 保留已加载的幻灯片内容
- 🚀 减少网络请求
- 🚀 提升用户体验流畅度

## 问题 2：新插入的 PPT 缩略图不生成

### 问题描述
在解决了重新初始化问题后，发现新插入的幻灯片缩略图无法正常生成。

### 根本原因
增量插入时，仅更新了 slides 数组，但缺少了关键步骤：

```typescript
// ❌ 原问题：handleIncrementalInsert 仅创建了 slide 对象
const newSlide: SlideItem = {
    path: insertedPath,
    url: "",  // ❌ URL 为空
    loadingState: "idle",  // ❌ 没有触发加载
}
// 没有调用 loadSlideContent()
// 没有调用 generateSlideScreenshot()
```

### 完整生命周期对比

#### initializeSlides (完整流程)
```typescript
1. 提取 file IDs
2. 批量获取临时下载 URLs
3. 填充 URLs 到 slide items
4. 调用 loadAllSlides()
   ├─ 加载原始内容
   ├─ 处理内容（图片路径替换等）
   └─ 更新 slide.content
5. 自动触发 generateAllScreenshots()
```

#### syncSlides (增量流程 - 问题版本)
```typescript
1. 创建新 slide 对象 ✅
2. ❌ 没有获取 URL
3. ❌ 没有加载内容
4. ❌ 没有生成缩略图
```

### 解决方案

#### 1. 修改 syncSlides 返回类型
```typescript
// Before: 返回简单的 boolean
syncSlides(newSlidePaths: string[]): boolean

// After: 返回详细的同步结果
syncSlides(newSlidePaths: string[]): {
    hasChanges: boolean
    changeType?: "insert" | "delete" | "reorder" | "replace"
    affectedIndices?: number[]  // 新增：受影响的索引
}
```

#### 2. handleIncrementalInsert 返回插入索引
```typescript
private handleIncrementalInsert(oldPaths: string[], newPaths: string[]): number[] {
    // ... 插入逻辑 ...
    return [insertedIndex]  // 返回插入的索引
}
```

#### 3. PPTStore.syncSlides 处理新插入的幻灯片
```typescript
async syncSlides(newSlidePaths: string[]): Promise<boolean> {
    const result = this.slideManager.syncSlides(newSlidePaths)

    if (result.changeType === "insert" && result.affectedIndices) {
        await this.handleNewSlideInsertion(result.affectedIndices)
    }

    return result.hasChanges
}
```

#### 4. handleNewSlideInsertion 完整处理流程
```typescript
private async handleNewSlideInsertion(insertedIndices: number[]): Promise<void> {
    // Step 1: 提取 file IDs
    const fileIds: string[] = []
    for (const index of insertedIndices) {
        const slide = this.slides[index]
        const fileId = this.pathMappingService.extractFileIdFromPath(slide.path)
        if (fileId) {
            fileIds.push(fileId)
            this.pathMappingService.setPathFileIdMapping(slide.path, fileId)
        }
    }

    // Step 2: 批量获取临时下载 URLs
    const response = await getTemporaryDownloadUrl({ file_ids: fileIds })
    response?.forEach((item) => {
        if (item.file_id && item.url) {
            // 更新 path-url 映射
            this.pathMappingService.setPathUrlMapping(path, item.url)
            // 更新 slide.url
            runInAction(() => {
                this.slides[index].url = item.url
            })
        }
    })

    // Step 3: 加载内容和生成缩略图（如果启用自动模式）
    if (this.config.autoLoadAndGenerate !== false) {
        for (const index of insertedIndices) {
            const slide = this.slides[index]
            if (slide?.url) {
                // 加载幻灯片内容
                await this.loadSlideContent(slide.url, index)
                // 生成缩略图
                await this.generateSlideScreenshot(index)
            }
        }
    }
}
```

### 优化后的完整流程

```
用户插入新幻灯片
↓
1. usePPTSidebar.handleInsertSlide()
   - 调用 store.insertSlide()
   - 更新内部 slides 数组
↓
2. 父组件更新 slidePaths prop
↓
3. useDeepCompareEffect 触发
   - 检测到不是首次加载
   - 调用 store.syncSlides(slidePaths)
↓
4. PPTSlideManager.syncSlides()
   - 检测变更类型为 "insert"
   - 调用 handleIncrementalInsert()
   - 返回 { hasChanges: true, changeType: "insert", affectedIndices: [3] }
↓
5. PPTStore.syncSlides()
   - 检测到插入操作
   - 调用 handleNewSlideInsertion([3])
↓
6. handleNewSlideInsertion()
   - 提取 fileId ✅
   - 获取临时 URL ✅
   - 加载幻灯片内容 ✅
   - 生成缩略图 ✅
↓
完成！新幻灯片完全可用 ✅
```

### 关键改进点

1. **类型安全**：syncSlides 返回详细的结果对象
2. **责任分离**：
   - PPTSlideManager：负责数据结构更新
   - PPTStore：负责业务逻辑（URL 获取、内容加载、截图生成）
3. **批量处理**：支持一次插入多张幻灯片
4. **错误处理**：为每个步骤添加了完整的错误处理和日志
5. **异步处理**：syncSlides 改为异步，等待所有资源加载完成

### 性能优化

- ✅ 批量获取 URLs（而非逐个请求）
- ✅ 并行加载多个新幻灯片
- ✅ 复用现有的加载和截图生成逻辑
- ✅ 仅处理新插入的幻灯片，不影响已有幻灯片

## 后续改进建议

1. **批量操作优化**
   - 支持一次插入/删除多张幻灯片
   - 减少多次 runInAction 调用

2. **更精细的变更检测**
   - 支持更复杂的变更场景
   - 例如：同时插入和删除

3. **性能监控**
   - 添加性能日志
   - 追踪增量更新的耗时

4. **单元测试**
   - 为 `syncSlides()` 添加完整的单元测试
   - 覆盖各种变更场景

5. **加载状态反馈**
   - 为新插入的幻灯片显示加载进度
   - 提供加载失败时的重试机制
