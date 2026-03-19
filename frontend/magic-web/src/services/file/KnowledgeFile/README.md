# 知识库文件服务

## 概述

知识库文件服务提供了一个完整的文件缓存和管理解决方案，支持：

- 🚀 **双层缓存机制** - 内存缓存 + IndexedDB 持久化
- 🔄 **请求去重** - 防止相同文件的并发重复请求
- ⚡ **智能过期管理** - 自动检测和清理过期缓存
- 📦 **批量操作支持** - 高效处理多个文件请求
- 🛡️ **错误处理** - 完善的错误处理和降级策略

## 核心特性

### 请求去重机制 🔄

当多个组件同时请求相同的文件时，服务会自动去重，确保：
- 相同 `fileKey` 的并发请求共享同一个 Promise
- 避免重复的 API 调用，提升性能
- 减少服务器压力和网络开销

```typescript
// 多个组件同时请求相同文件
const promises = [
  KnowledgeFileService.fetchFileUrl("same_file_key"),
  KnowledgeFileService.fetchFileUrl("same_file_key"), 
  KnowledgeFileService.fetchFileUrl("same_file_key")
]

// 只会发起一次 API 请求，所有 Promise 共享结果
const results = await Promise.all(promises)
```

### 缓存策略 📦

- **L1 缓存（内存）**：快速访问，应用重启后清空
- **L2 缓存（IndexedDB）**：持久化存储，跨会话保持
- **智能过期**：默认 30 分钟过期时间，可配置

### 性能优化 ⚡

- 预加载机制支持
- 批量请求优化
- 自动清理过期数据
- 内存使用优化

## API 接口

### 核心方法

#### `fetchFileUrl(fileKey: string)`
获取单个文件的下载链接

```typescript
const fileInfo = await KnowledgeFileService.fetchFileUrl("DT001/588417216353")
if (fileInfo) {
  console.log("文件URL:", fileInfo.url)
  console.log("过期时间:", fileInfo.expires)
}
```

#### `fetchFileUrls(fileKeys: string[])`
批量获取多个文件的下载链接

```typescript
const results = await KnowledgeFileService.fetchFileUrls([
  "file1_key", 
  "file2_key"
])
```

#### `checkFileExpired(fileKey: string)`
检查文件缓存是否过期

```typescript
const isExpired = KnowledgeFileService.checkFileExpired("file_key")
```

#### `clearAllCache()`
清空所有缓存（包括内存和持久化缓存）

```typescript
await KnowledgeFileService.clearAllCache()
```

## 使用示例

### 在 React 组件中使用

```typescript
import { KnowledgeFileService } from "@/opensource/services/file/KnowledgeFile"

function MyComponent() {
  const [fileUrl, setFileUrl] = useState<string>("")
  
  useEffect(() => {
    const loadFile = async () => {
      const fileInfo = await KnowledgeFileService.fetchFileUrl("your_file_key")
      if (fileInfo?.url) {
        setFileUrl(fileInfo.url)
      }
    }
    
    loadFile()
  }, [])
  
  return <img src={fileUrl} alt="知识库文件" />
}
```

### 使用 Hook

```typescript
import { useKnowledgeFileUrl } from "@/opensource/hooks/useKnowledgeFileUrls"

function MyComponent({ fileKey }: { fileKey: string }) {
  const { data, loading, error } = useKnowledgeFileUrl(fileKey)
  
  if (loading) return <div>加载中...</div>
  if (error) return <div>加载失败</div>
  if (!data) return <div>文件不存在</div>
  
  return <img src={data.url} alt={data.name} />
}
```

## 架构设计

### 三层架构

```
┌─────────────────────────────────────┐
│           业务逻辑层                  │
│      KnowledgeFileService           │
│   (缓存管理、请求去重、业务逻辑)        │
└─────────────────────────────────────┘
                    │
┌─────────────────────────────────────┐
│          数据持久化层                 │
│     KnowledgeFileDbService          │
│      (IndexedDB 操作)               │
└─────────────────────────────────────┘
                    │
┌─────────────────────────────────────┐
│            存储层                    │
│         IndexedDB                   │
│     (浏览器本地存储)                  │
└─────────────────────────────────────┘
```

### 请求去重流程

```
多个组件请求相同文件
         │
    ┌────▼────┐
    │检查缓存  │
    └────┬────┘
         │
    ┌────▼────┐
    │缓存命中？│
    └────┬────┘
         │ No
    ┌────▼────┐
    │检查正在  │
    │进行的请求│
    └────┬────┘
         │
    ┌────▼────┐
    │有pending？│
    └────┬────┘
    Yes  │    No
    ┌────▼────┐    ┌────▼────┐
    │返回现有  │    │发起新请求│
    │Promise  │    │并缓存    │
    └─────────┘    └─────────┘
```

## 错误处理

### 网络错误
- 自动重试机制
- 降级到缓存数据
- 用户友好的错误提示

### 数据库错误
- 优雅降级到内存缓存
- 错误日志记录
- 不影响核心功能

### 缓存错误
- 自动清理损坏数据
- 重新初始化缓存
- 保证服务可用性

## 性能监控

### 缓存统计

```typescript
const stats = await KnowledgeFileService.getCacheStats()
console.log("内存缓存数量:", stats.memory)
console.log("数据库缓存统计:", stats.database)
```

### 性能指标
- 缓存命中率
- 请求去重效果
- 内存使用情况
- 数据库操作耗时

## 最佳实践

### 1. 预加载优化
```typescript
// 在页面加载时预加载可能需要的文件
await KnowledgeFileService.preloadFileUrls([
  "file1_key",
  "file2_key", 
  "file3_key"
])
```

### 2. 批量操作
```typescript
// 优先使用批量接口
const results = await KnowledgeFileService.fetchFileUrls(fileKeys)
```

### 3. 错误处理
```typescript
try {
  const fileInfo = await KnowledgeFileService.fetchFileUrl(fileKey)
  if (!fileInfo) {
    // 处理文件不存在的情况
    showErrorMessage("文件不存在")
    return
  }
  // 使用文件信息
} catch (error) {
  // 处理网络错误等异常情况
  console.error("获取文件失败:", error)
  showErrorMessage("网络错误，请稍后重试")
}
```

### 4. 内存管理
```typescript
// 定期清理过期缓存
setInterval(() => {
  KnowledgeFileService.clearExpiredCache()
}, 30 * 60 * 1000) // 每30分钟清理一次
```

## 迁移指南

### 从直接 API 调用迁移

**之前：**
```typescript
// 直接调用 API，没有缓存
const response = await FileApi.getKnowledgeFileUrl(fileKey)
```

**现在：**
```typescript
// 使用服务，自动缓存和去重
const fileInfo = await KnowledgeFileService.fetchFileUrl(fileKey)
```

### 性能提升
- ✅ 减少 API 调用次数
- ✅ 提升页面加载速度
- ✅ 降低服务器压力
- ✅ 改善用户体验

## 故障排除

### 常见问题

**Q: 文件链接过期了怎么办？**
A: 服务会自动检测过期并重新获取，无需手动处理。

**Q: 如何清理缓存？**
A: 调用 `KnowledgeFileService.clearAllCache()` 方法。

**Q: 如何查看缓存状态？**
A: 使用 `KnowledgeFileService.getCacheStats()` 获取统计信息。

**Q: 请求去重不生效？**
A: 检查是否在不同的服务实例中调用，确保使用同一个单例。

### 调试技巧

1. 开启控制台日志查看请求去重效果
2. 使用 `getCacheStats()` 监控缓存状态
3. 检查 IndexedDB 中的数据持久化情况
4. 使用浏览器开发者工具监控网络请求

## 更新日志

### v1.1.0 (当前版本)
- ✨ 新增请求去重机制
- 🐛 修复并发请求重复问题
- 📝 完善文档和测试用例
- ⚡ 优化性能和内存使用

### v1.0.0
- 🎉 初始版本发布
- 📦 双层缓存机制
- �� 自动过期管理
- 📊 批量操作支持 