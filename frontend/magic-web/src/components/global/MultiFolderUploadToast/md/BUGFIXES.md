# 🐛 Bug 修复报告

## 修复的问题

### 1. MultiFolderUploadToast 组件不显示 ❌ → ✅

**问题描述**：
- 用户上传文件夹时，全局进度组件没有在UI中显示出来

**根本原因**：
- 组件显示条件 `hasActiveTasks` 基于 `globalState.activeTasks.length`
- 新创建的任务只添加到 `globalState.tasks` Map，只有开始执行时才加入 `activeTasks` 数组
- 如果任务在队列中等待，就不会出现在 `activeTasks` 中，导致UI不显示

**解决方案**：
```typescript
// 修改 hasActiveTasks getter，包括队列中的任务
get hasActiveTasks(): boolean {
  // 包括正在执行的任务和队列中等待的任务
  return this.globalState.totalActiveTasks > 0 || this.taskQueue.length > 0
}
```

### 2. 项目任务计数警告 ❌ → ✅

**问题描述**：
- 上传完一个文件夹后，再次上传会提示「项目已有 2 个上传任务」

**根本原因**：
- `getTasksByProject` 方法返回 `globalState.tasks` 中的所有任务
- 任务完成后只从 `activeTasks` 中移除，但仍保留在 `tasks` Map 中
- 计数检查时包含了已完成的任务

**解决方案**：
1. **创建新的活跃任务检查方法**：
```typescript
// 获取项目的活跃任务（用于限制检查）
getActiveTasksByProject = (projectId: string): IFolderUploadTask[] => {
  return Array.from(this.globalState.tasks.values()).filter(task => 
    task.projectId === projectId && 
    (!task.state.isCompleted && !task.state.isError)
  )
}
```

2. **任务完成后完全清理**：
```typescript
// 任务完成时从 tasks Map 中移除
this.globalState.tasks.delete(taskId)
```

3. **使用活跃任务检查**：
```typescript
// 在创建任务时使用新的方法
const activeProjectTasks = this.getActiveTasksByProject(options.projectId)
if (activeProjectTasks.length >= 2) {
  // 显示警告
}
```

## 添加的功能

### 1. 调试日志支持 🔍

添加了详细的调试日志帮助开发者排查问题：

```typescript
console.log("🟢 任务已创建:", {
  taskId: task.id,
  projectName: options.projectName,
  totalTasks: this.globalState.tasks.size,
  queueLength: this.taskQueue.length
})

console.log("🔵 MultiFolderUploadToast Debug:", {
  hasActiveTasks,
  activeTasks: activeTasks.length,
  completedTasks: completedTasks.length,
  totalTasks: multiFolderUploadStore.globalState.tasks.size,
  queueLength: multiFolderUploadStore.queueLength
})
```

### 2. 队列长度访问器 📊

添加了公共访问器获取队列信息：

```typescript
get queueLength(): number {
  return this.taskQueue.length
}
```

## 代码变更总结

### 修改的文件：
1. `MultiFolderUploadStore.ts` - 核心状态管理逻辑
2. `MultiFolderUploadToast/index.tsx` - UI 组件调试

### 关键变更：
- ✅ 修复了UI显示逻辑，包含队列中的任务
- ✅ 修复了任务计数逻辑，只计算活跃任务
- ✅ 改进了任务清理机制，完全移除已完成任务
- ✅ 添加了调试日志系统
- ✅ 优化了全局任务限制检查

## 测试建议

1. **UI显示测试**：
   - 创建文件夹上传任务
   - 验证右上角立即显示进度组件
   - 检查调试控制台输出

2. **任务计数测试**：
   - 上传一个文件夹并等待完成
   - 立即再次上传另一个文件夹
   - 验证不会出现「已有2个任务」警告

3. **多任务测试**：
   - 同时上传多个文件夹
   - 验证并发控制正确工作
   - 检查任务完成后的清理

## 影响评估

- ✅ **兼容性**: 不影响现有功能
- ✅ **性能**: 优化了内存使用（及时清理已完成任务）
- ✅ **用户体验**: 修复了显示问题和错误警告
- ✅ **开发体验**: 增加了调试信息

这些修复确保了多任务文件夹上传功能的正确性和稳定性！🎉
