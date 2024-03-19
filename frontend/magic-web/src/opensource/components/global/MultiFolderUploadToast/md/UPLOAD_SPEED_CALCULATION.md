# 上传速度计算机制

## 概述

本文档详细说明了多文件夹上传组件中上传速度的计算方法，包括数据收集、计算逻辑、聚合方式和显示格式。

## 🎯 核心原理

### 基本公式
```
上传速度 (KB/s) = 已上传字节数 / 耗时秒数 / 1024
```

## 📊 数据收集

### 1. 文件大小统计
```typescript
// 在任务初始化时计算真实文件总大小
const totalBytes = this.files.reduce((sum, file) => sum + file.size, 0)

// 任务状态中的关键字段
interface FolderUploadState {
    totalBytes: number      // 所有文件的总字节数
    uploadedBytes: number   // 已成功上传的字节数
    startTime: number       // 任务开始时间戳
}
```

### 2. 字节数累计
```typescript
// 每批上传成功后累计实际字节数
const batchBytes = remainingFiles.reduce(
    (sum, folderFile) => sum + folderFile.file.size,
    0,
)

this.updateState({
    uploadedBytes: (this.state.uploadedBytes || 0) + batchBytes,
})
```

## ⚡ 速度计算逻辑

### 1. 单个任务速度计算
**位置**: `src/opensource/stores/folderUpload/FolderUploadTask.ts`

```typescript
private updateUploadStats(): void {
    if (!this.state.startTime) return

    // 使用真实的已上传字节数
    const uploadedBytes = this.state.uploadedBytes || 0
    const totalBytes = this.state.totalBytes || 0
    const speed = calculateUploadSpeed(uploadedBytes, this.state.startTime)
    const remaining = estimateTimeRemaining(totalBytes, uploadedBytes, speed)

    this.updateState({
        uploadSpeed: speed,
        estimatedTimeRemaining: remaining,
    })
}
```

### 2. 速度计算核心函数
**位置**: `src/opensource/stores/folderUpload/helpers.ts`

```typescript
/**
 * 计算上传速度 (KB/s)
 */
export const calculateUploadSpeed = (uploadedBytes: number, startTime: number): number => {
    const elapsedSeconds = (Date.now() - startTime) / 1000
    if (elapsedSeconds === 0) return 0
    return Math.round(uploadedBytes / 1024 / elapsedSeconds)
}
```

**计算步骤**:
1. 计算耗时：`(当前时间 - 开始时间) / 1000` 秒
2. 计算速度：`已上传字节数 / 1024 / 耗时秒数` = KB/s
3. 四舍五入取整

## 📈 多任务速度聚合

### TaskSummary 中的平均速度
**位置**: `src/opensource/components/global/MultiFolderUploadToast/TaskSummary.tsx`

```typescript
// 计算所有活跃任务的平均上传速度
const totalUploadSpeed = activeTasks.reduce((sum, task) => {
    return sum + (task.state.uploadSpeed || 0)
}, 0)
const averageSpeed = activeTasks.length > 0 ? totalUploadSpeed / activeTasks.length : 0
```

**聚合逻辑**:
1. 累加所有活跃任务的 `uploadSpeed`
2. 除以活跃任务数量得到平均速度
3. 如果没有活跃任务，速度为 0

## 🎨 速度格式化显示

### formatUploadSpeed 函数
**位置**: `src/opensource/stores/folderUpload/i18nHelpers.ts`

```typescript
/**
 * 格式化上传速度
 * @param speedInKBps 速度，单位为 KB/s
 */
export const formatUploadSpeed = (speedInKBps: number): string => {
    if (speedInKBps < 1) {
        // 小于 1 KB/s，显示为 B/s
        const speedInBps = speedInKBps * 1024
        return `${Math.round(speedInBps)} B/s`
    } else if (speedInKBps < 1024) {
        // 1 KB/s ~ 1024 KB/s，显示为 KB/s
        return `${Math.round(speedInKBps)} KB/s`
    } else {
        // 大于等于 1024 KB/s，显示为 MB/s
        const speedInMBps = speedInKBps / 1024
        return `${speedInMBps.toFixed(1)} MB/s`
    }
}
```

### 显示规则
| 速度范围 | 显示格式 | 示例 |
|---------|---------|------|
| < 1 KB/s | `XXX B/s` | `512 B/s` |
| 1-1023 KB/s | `XXX KB/s` | `500 KB/s` |
| ≥ 1024 KB/s | `X.X MB/s` | `2.4 MB/s` |

## 🔄 更新时机

### 1. 单个任务速度更新
- **触发时机**: 每批文件上传成功后
- **更新内容**: `uploadedBytes`, `uploadSpeed`, `estimatedTimeRemaining`
- **调用链**: `uploadBatchWithRetry` → `updateState` → `updateUploadStats`

### 2. 全局速度更新
- **触发时机**: 任何任务状态变化时
- **更新内容**: `totalProcessedFiles`, `globalProgress`
- **调用链**: `updateGlobalStats` → `updateProgress`

## 📝 关键注意事项

### 1. 数据准确性
✅ **使用真实文件大小**: 不再假设每个文件1MB  
✅ **累计实际字节数**: 基于文件的 `file.size` 属性  
✅ **实时计算**: 每批上传后立即更新  

### 2. 性能考虑
✅ **避免频繁计算**: 只在状态变化时更新  
✅ **合理精度**: KB/s 级别精度足够使用  
✅ **异常处理**: 耗时为0时返回0速度  

### 3. 用户体验
✅ **直观单位**: 自动选择合适的显示单位  
✅ **实时反馈**: 速度变化及时反映到UI  
✅ **准确预估**: 基于真实速度计算剩余时间  

## 🧪 测试验证

### Mock 数据中的速度模拟
```typescript
// 动态速度范围：1800-3200 KB/s (约1.8-3.1 MB/s)
uploadSpeed: 1800 + Math.random() * 1400
```

### 预期显示效果
- 低速场景: `500 KB/s`
- 中速场景: `1.8 MB/s`
- 高速场景: `3.1 MB/s`
- 极慢场景: `256 B/s`

## 🔍 故障排查

### 常见问题
1. **显示为 0**: 检查 `startTime` 是否正确设置
2. **速度异常高**: 检查 `uploadedBytes` 累计是否正确
3. **单位不对**: 检查 `formatUploadSpeed` 函数逻辑

### 调试方法
```typescript
// 在控制台查看任务状态
console.log('Task State:', task.state)
console.log('Upload Speed:', task.state.uploadSpeed)
console.log('Uploaded Bytes:', task.state.uploadedBytes)
console.log('Total Bytes:', task.state.totalBytes)
```

---

**更新时间**: 2024年  
**维护者**: 前端开发团队
