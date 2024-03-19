# PPT Store 重构文档

## 重构目标

将 PPT 组件中的 useEffect 监听逻辑移到 store 内部，实现自动化流程控制，减少组件层面的副作用依赖。

## 主要变更

### 1. PPTStore 配置增强

在 `PPTStoreConfig` 接口中添加了 `autoLoadAndGenerate` 配置项：

```typescript
export interface PPTStoreConfig {
  // ... 其他配置
  /**
   * Whether to automatically load slides and generate screenshots
   * when slides are initialized
   * @default true
   */
  autoLoadAndGenerate?: boolean
}
```

**默认值**: `true` - 自动执行完整流程

### 2. Store 内部自动化流程

#### initializeSlides() 方法增强

```typescript
initializeSlides(slides: SlideItem[] | string[]): void {
  // 1. 初始化 slides 数据
  // ...
  
  // 2. 如果 autoLoadAndGenerate 启用（默认），自动加载所有幻灯片
  if (this.config.autoLoadAndGenerate !== false) {
    this.loadAllSlides()
  }
}
```

**调用时机**: 当接收到新的 slides 数据时

#### loadAllSlides() 方法增强

```typescript
async loadAllSlides(): Promise<void> {
  // 1. 加载所有幻灯片内容
  // ...
  
  runInAction(() => {
    this.isAllSlidesLoaded = true
    this.loadingProgress = 100
  })

  // 2. 如果 autoLoadAndGenerate 启用（默认），自动生成截图
  if (this.config.autoLoadAndGenerate !== false) {
    this.generateAllScreenshots()
  }
}
```

**调用时机**: 当所有幻灯片加载完成后

### 3. 组件层面简化

#### 重构前 (3 个 useEffect)

```typescript
// Effect 1: 初始化 slides
useDeepCompareEffect(() => {
  if (slides && slides.length > 0) {
    store.initializeSlides(slides)
  }
}, [slides])

// Effect 2: 加载所有幻灯片
useEffect(() => {
  if (store.slideUrls.length === 0) return
  
  const loadAndGenerateScreenshots = async () => {
    await store.loadAllSlides()
    if (store.isAllSlidesLoaded) {
      store.generateAllScreenshots()
    }
  }
  
  loadAndGenerateScreenshots()
}, [store.slideUrls.length])

// Effect 3: 自动生成截图
useEffect(() => {
  if (store.isAllSlidesLoaded && store.slides.length > 0) {
    const needsScreenshots = store.slides.some(
      (slide) =>
        slide.isLoaded &&
        slide.content &&
        !slide.thumbnailUrl &&
        !slide.thumbnailLoading,
    )
    if (needsScreenshots) {
      store.generateAllScreenshots()
    }
  }
}, [store.isAllSlidesLoaded, store.slides.length, store])
```

#### 重构后 (1 个 useEffect)

```typescript
// 只需一个 useEffect 来监听 slides prop 变化
// store 内部自动处理后续的加载和截图生成
useDeepCompareEffect(() => {
  if (slides && slides.length > 0) {
    store.initializeSlides(slides)
  }
}, [slides])
```

## 自动化流程图

```
props.slides 变化
    ↓
store.initializeSlides()
    ↓ (自动触发)
store.loadAllSlides()
    ↓ (自动触发)
store.generateAllScreenshots()
    ↓
完成
```

## 优势

### 1. 代码简化
- 组件层面从 3 个 useEffect 减少到 1 个
- 去除了复杂的依赖项管理
- 减少了重复的条件判断

### 2. 逻辑内聚
- 所有自动化逻辑集中在 store 内部
- 更符合单一职责原则
- 更容易理解和维护

### 3. 灵活性
- 通过 `autoLoadAndGenerate` 配置可以控制是否自动执行
- 仍然保留手动调用的能力
- 向后兼容

### 4. 可测试性
- store 的行为更加独立
- 更容易编写单元测试
- 减少了组件测试的复杂度

## 使用场景

### 场景 1: 默认自动模式（推荐）

```typescript
const store = createPPTStore({
  fileUrlMapping,
  attachments,
  // autoLoadAndGenerate 默认为 true
})

// 只需调用一次 initializeSlides
store.initializeSlides(slides)
// 后续加载和截图生成自动进行
```

### 场景 2: 手动控制模式

```typescript
const store = createPPTStore({
  fileUrlMapping,
  attachments,
  autoLoadAndGenerate: false, // 禁用自动化
})

// 手动控制每个步骤
store.initializeSlides(slides)
await store.loadAllSlides()
await store.generateAllScreenshots()
```

## 注意事项

1. **异步操作**: `loadAllSlides()` 和 `generateAllScreenshots()` 都是异步操作，但在自动模式下无需等待
2. **错误处理**: store 内部已处理所有错误，确保即使失败也不会阻塞流程
3. **性能**: 自动化不会影响性能，因为原本这些操作就会执行，只是触发方式改变了
4. **向后兼容**: 默认行为与之前保持一致，不会破坏现有功能

## 测试建议

### 单元测试

```typescript
describe('PPTStore autoLoadAndGenerate', () => {
  it('should auto load and generate when enabled', async () => {
    const store = createPPTStore({ 
      fileUrlMapping: new Map(),
      autoLoadAndGenerate: true 
    })
    
    store.initializeSlides(mockSlides)
    
    // 验证自动触发
    await waitFor(() => {
      expect(store.isAllSlidesLoaded).toBe(true)
      expect(store.slides[0].thumbnailUrl).toBeDefined()
    })
  })
  
  it('should not auto load when disabled', () => {
    const store = createPPTStore({ 
      fileUrlMapping: new Map(),
      autoLoadAndGenerate: false 
    })
    
    store.initializeSlides(mockSlides)
    
    // 验证不自动触发
    expect(store.isAllSlidesLoaded).toBe(false)
  })
})
```

## 相关文件

- `src/opensource/pages/superMagic/components/Detail/components/PPTRender/stores/PPTStore.ts` - Store 实现
- `src/opensource/pages/superMagic/components/Detail/components/PPTRender/index.tsx` - 组件使用
