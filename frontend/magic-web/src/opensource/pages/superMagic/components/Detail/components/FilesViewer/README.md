# FilesViewer 缓存功能

## 概述

FilesViewer 组件现在支持 tab 缓存功能，可以显著提升用户体验。当用户在不同 tab 之间切换时，已打开的 tab 内容会被缓存，避免重新渲染，实现瞬间切换。

## 功能特性

### 🚀 性能优化
- **瞬间切换**：已缓存的 tab 切换时无重新渲染延迟
- **状态保持**：每个 tab 的滚动位置、编辑状态等完全保持
- **内存可控**：支持设置最大缓存数量，默认 10 个

### 🎯 用户体验
- **流畅切换**：使用 CSS 过渡动画实现平滑的显隐效果
- **智能缓存**：LRU 策略自动管理缓存，优先保留最近使用的 tab
- **自动清理**：关闭 tab 时自动清理对应缓存

## 实现原理

### 缓存策略
1. **多实例渲染**：为每个 tab 创建独立的 Render 组件实例
2. **显隐控制**：通过 CSS `opacity` 和 `visibility` 控制显示状态
3. **LRU 淘汰**：当缓存达到上限时，自动移除最久未使用的 tab

### 核心组件

#### TabCache 组件
```tsx
<TabCache
  tab={tabItem}
  isActive={isActive}
  renderProps={renderProps}
  onActiveFileChange={handleActiveFileChange}
/>
```

#### useTabCache Hook
```tsx
const {
  addToCache,
  getFromCache,
  removeFromCache,
  clearCache,
  getCacheStats,
  isCached,
  cachedTabIds,
} = useTabCache({
  maxCacheSize: 10,
  enableCache: true,
})
```

## 使用方法

### 基本使用
```tsx
import FilesViewer from "./components/FilesViewer"

function MyComponent() {
  return (
    <FilesViewer
      ref={filesViewerRef}
      attachments={attachments}
      // ... 其他 props
    />
  )
}
```

### 缓存控制
```tsx
// 获取缓存统计信息
const stats = filesViewerRef.current?.getCacheStats()
console.log(`缓存了 ${stats.size}/${stats.maxSize} 个 tab`)

// 清空缓存
filesViewerRef.current?.clearCache()
```

## 配置选项

### useTabCache 参数
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `maxCacheSize` | `number` | `10` | 最大缓存数量 |
| `enableCache` | `boolean` | `true` | 是否启用缓存 |

### 样式配置
```tsx
// 在 styles.ts 中自定义缓存样式
tabCacheContainer: css`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transition: opacity 0.2s ease, visibility 0.2s ease;
`,

tabCacheActive: css`
  opacity: 1;
  visibility: visible;
  z-index: 1;
`,

tabCacheInactive: css`
  opacity: 0;
  visibility: hidden;
  z-index: 0;
  pointer-events: none;
`,
```

## 性能监控

### 缓存统计
```tsx
// 获取缓存状态
const stats = filesViewerRef.current?.getCacheStats()
console.log({
  size: stats.size,        // 当前缓存数量
  maxSize: stats.maxSize,  // 最大缓存数量
  keys: stats.keys,        // 已缓存的 tab IDs
})
```

### 调试信息
在开发模式下，可以通过以下方式查看缓存状态：
```tsx
// 在控制台查看缓存信息
console.log('Cached tabs:', filesViewerRef.current?.getCacheStats())
```

## 最佳实践

### 1. 合理设置缓存大小
- 桌面端：建议 10-15 个
- 移动端：建议 5-8 个
- 根据设备内存和性能调整

### 2. 监控内存使用
```tsx
// 定期检查缓存状态
useEffect(() => {
  const interval = setInterval(() => {
    const stats = filesViewerRef.current?.getCacheStats()
    if (stats && stats.size > stats.maxSize * 0.8) {
      console.warn('缓存使用率较高，考虑清理')
    }
  }, 30000) // 每30秒检查一次

  return () => clearInterval(interval)
}, [])
```

### 3. 处理内存泄漏
```tsx
// 组件卸载时清理缓存
useEffect(() => {
  return () => {
    filesViewerRef.current?.clearCache()
  }
}, [])
```

## 注意事项

1. **内存使用**：每个缓存的 tab 都会占用内存，建议根据设备性能调整缓存大小
2. **组件更新**：当 tab 的 props 发生变化时，缓存会自动更新
3. **清理时机**：关闭 tab 或清空所有 tabs 时会自动清理对应缓存
4. **兼容性**：缓存功能向后兼容，不影响现有功能

## 故障排除

### 常见问题

**Q: 缓存不生效？**
A: 检查 `enableCache` 是否设置为 `true`，以及 `maxCacheSize` 是否大于 0

**Q: 内存占用过高？**
A: 降低 `maxCacheSize` 值，或定期调用 `clearCache()` 清理缓存

**Q: 切换时出现闪烁？**
A: 检查 CSS 过渡动画是否正确配置，确保 `transition` 属性设置正确

### 调试技巧
```tsx
// 启用详细日志
const DEBUG_CACHE = process.env.NODE_ENV === 'development'

if (DEBUG_CACHE) {
  console.log('Cache operation:', {
    action: 'add',
    tabId: tab.id,
    cacheSize: getCacheStats().size,
  })
}
``` 