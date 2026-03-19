# PPTStore 重构文档

## 重构概述

将原来的大型 PPTStore（1520行）拆分成多个独立的管理类，遵循**单一职责原则（SRP）**，提高代码的可维护性和可测试性。

## 架构设计

### 新的类结构

```
PPTStore (主协调器)
├── PPTSlideManager          # 幻灯片数据和CRUD操作管理
├── PPTLoadingManager         # 加载状态和进度管理
├── PPTViewStateManager       # 视图状态管理
├── PPTScreenshotManager      # 截图管理
└── Services                  # 服务层
    ├── SlideLoaderService
    ├── SlideProcessorService
    ├── PPTPathMappingService
    ├── PPTIncrementalUpdateService
    └── SlideScreenshotService
```

## 各模块职责

### 1. PPTSlideManager
**职责：** 管理幻灯片数据和CRUD操作

**管理的状态：**
- `slides: SlideItem[]` - 幻灯片数组
- `activeIndex: number` - 当前激活的幻灯片索引
- `isTransitioning: boolean` - 是否正在切换

**提供的方法：**
- `initializeSlides()` - 初始化幻灯片
- `setActiveIndex()` / `nextSlide()` / `prevSlide()` - 导航操作
- `insertSlide()` - 插入新幻灯片
- `deleteSlide()` - 删除幻灯片
- `sortSlides()` - 排序/重新排列幻灯片
- `updateSlideContent()` / `updateSlideTitle()` - 更新幻灯片内容

**优势：**
- 集中管理幻灯片的所有CRUD操作
- 自动处理索引更新
- 统一的错误处理和日志记录

### 2. PPTLoadingManager
**职责：** 管理加载状态和进度

**管理的状态：**
- `isAllSlidesLoaded: boolean` - 所有幻灯片是否已加载
- `loadingProgress: number` - 加载进度 (0-100)
- `slidesFileVersions: Record<string, number>` - 文件版本记录

**提供的方法：**
- `calculateLoadingPercentage()` - 计算加载百分比
- `updateProgress()` - 更新加载进度
- `setAllSlidesLoaded()` - 设置完成状态
- `setSlideFileVersion()` / `setSlidesFileVersions()` - 版本管理

**优势：**
- 独立的加载状态管理
- 易于追踪加载进度
- 版本控制集中化

### 3. PPTViewStateManager
**职责：** 管理视图状态（缩放、偏移、全屏）

**管理的状态：**
- `scaleRatio: number` - 缩放比例
- `verticalOffset: number` - 垂直偏移
- `horizontalOffset: number` - 水平偏移
- `isFullscreen: boolean` - 全屏状态

**提供的方法：**
- `setScaleRatio()` - 设置缩放
- `setVerticalOffset()` / `setHorizontalOffset()` - 设置偏移
- `setFullscreen()` - 切换全屏
- `resetViewState()` - 重置视图状态

**优势：**
- 视图状态与业务逻辑分离
- 便于添加新的视图功能
- 独立的状态重置

### 4. PPTScreenshotManager
**职责：** 管理截图操作

**提供的方法：**
- `generateSlideScreenshot()` - 生成单个幻灯片截图
- `generateAllScreenshots()` - 生成所有截图
- `clearSlideScreenshot()` - 清除单个截图
- `clearAllScreenshots()` - 清除所有截图
- `getCacheStats()` - 获取缓存统计

**优势：**
- 截图逻辑封装独立
- 统一的缓存管理
- 易于扩展截图功能

### 5. PPTStore（重构后）
**职责：** 主协调器，提供统一的API

**功能：**
- 创建并协调所有Manager
- 对外提供统一的访问接口
- 处理跨Manager的复杂操作
- 管理配置更新和增量更新

**优势：**
- 保持向后兼容的API
- 简化使用方式
- 统一的错误处理和日志

## 重构带来的改进

### 1. 代码组织
- ✅ 单个类从 1520行 减少到 200-400行
- ✅ 每个类职责清晰，易于理解
- ✅ 符合 SOLID 原则中的单一职责原则

### 2. 可维护性
- ✅ 修改某个功能只需要关注对应的Manager
- ✅ 减少代码耦合，降低修改风险
- ✅ 更好的代码复用性

### 3. 可测试性
- ✅ 每个Manager可以独立测试
- ✅ Mock依赖更加容易
- ✅ 测试用例更加聚焦

### 4. 扩展性
- ✅ 添加新功能只需创建新的Manager
- ✅ 不影响现有代码
- ✅ 支持插件化架构

## 使用示例

### 插入幻灯片
```typescript
// 旧方式（在hook中处理）
const newSlides = [...slides]
newSlides.splice(insertIndex, 0, newSlide)
setSlides(newSlides)

// 新方式（使用store）
const insertIndex = await store.insertSlide(position, direction, {
  path: result.newFilePath,
  url: newFileUrl,
  fileId: result.newFileId,
})
```

### 删除幻灯片
```typescript
// 旧方式（手动处理索引调整）
const newSlides = slides.filter((_, idx) => idx !== index)
setSlides(newSlides)
if (index === activeIndex) {
  setActiveIndex(Math.max(0, index - 1))
}

// 新方式（store自动处理）
const newActiveIndex = store.deleteSlide(index, true)
```

### 排序幻灯片
```typescript
// 旧方式（只更新状态）
setSlides(newSlides)

// 新方式（store统一处理）
store.sortSlides(newSlides)
```

## 向后兼容性

所有原有的API都保持兼容，不会破坏现有代码：

```typescript
// 这些API仍然可用
store.slides
store.activeIndex
store.currentSlide
store.setActiveIndex()
store.updateSlideContent()
// ... 等等
```

## 迁移指南

### 对于使用者
如果你只是使用 PPTStore 的API，**无需任何修改**。所有现有代码都能正常工作。

### 对于维护者
1. 修改幻灯片相关逻辑 → 查看 `PPTSlideManager`
2. 修改加载相关逻辑 → 查看 `PPTLoadingManager`
3. 修改视图相关逻辑 → 查看 `PPTViewStateManager`
4. 修改截图相关逻辑 → 查看 `PPTScreenshotManager`

## 文件结构

```
stores/
├── PPTStore.ts                 # 主Store（协调器）
├── PPTSlideManager.ts          # 幻灯片管理
├── PPTLoadingManager.ts        # 加载管理
├── PPTViewStateManager.ts      # 视图状态管理
├── PPTScreenshotManager.ts     # 截图管理
├── PPTStore.old.ts            # 旧版本备份
├── index.ts                    # 导出
└── REFACTORING.md             # 本文档
```

## 备份说明

旧的 PPTStore 已备份为 `PPTStore.old.ts`，如需回退可以：
```bash
mv stores/PPTStore.old.ts stores/PPTStore.ts
```

## 总结

这次重构通过将庞大的Store拆分成多个专注的Manager类，显著提升了代码的：
- **可读性** - 每个文件更短更清晰
- **可维护性** - 职责明确，修改影响范围小
- **可测试性** - 独立测试各个模块
- **可扩展性** - 易于添加新功能

同时保持了完全的**向后兼容性**，不影响现有使用方式。
