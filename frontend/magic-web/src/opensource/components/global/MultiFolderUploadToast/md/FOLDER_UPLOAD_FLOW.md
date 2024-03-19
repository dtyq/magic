# 📁 多任务文件夹上传功能流程说明

## 🌟 功能概述

多任务文件夹上传功能支持用户同时为多个项目上传多个文件夹，提供实时进度显示、任务控制、失败重试等功能，并且具备全局持久化和跨路由保持能力。

## 🚀 用户操作流程

### 1. 用户发起文件夹上传

**触发位置**: 项目文件管理页面
**操作方式**: 
- 在文件列表中点击"上传文件夹"按钮
- 或者在指定文件夹上右键选择"上传文件夹"

**前置检查**:
```typescript
// 检查是否可以创建新任务
if (!multiFolderUploadStore.canCreateNewTask) {
    message.warning('当前任务数量已达上限，请等待部分任务完成后再试')
    return
}
```

### 2. 文件选择与验证

**系统行为**:
1. 创建隐藏的 `<input webkitdirectory>` 元素
2. 用户通过浏览器选择文件夹
3. 获取文件列表及相对路径信息

**代码实现**:
```typescript
const input = document.createElement("input")
input.type = "file"
input.multiple = true
input.webkitdirectory = true

input.onchange = async (e) => {
    const fileList = (e.target as HTMLInputElement).files
    if (fileList && fileList.length > 0) {
        const files = Array.from(fileList)
        // 创建上传任务...
    }
}
```

### 3. 任务创建与队列管理

**核心流程**:

#### 3.1 任务初始化
```typescript
// 1. 创建任务实例
const task = new FolderUploadTask(files, baseSuffixDir, {
    projectId: projectId || '',
    projectName: selectedTopic?.name || '未知项目',
    topicId: selectedTopic?.id,
    taskId: '',
    storageType: 'workspace',
    source: UploadSource.ProjectFile,
})

// 2. 添加到全局状态
multiFolderUploadStore.globalState.tasks.set(task.id, task)
```

#### 3.2 项目并发控制
```typescript
// 检查项目任务限制 (每个项目最多2个并发任务)
const projectTasks = this.getTasksByProject(options.projectId)
if (projectTasks.length >= 2) {
    throw new Error('项目任务数量超限')
}

// 检查全局任务限制 (最多10个任务)
if (this.globalState.tasks.size >= 10) {
    throw new Error('全局任务数量超限')
}
```

#### 3.3 优先级队列
```typescript
// 添加到任务队列，按优先级排序
this.taskQueue.enqueue({
    task,
    priority: this.calculateTaskPriority(task), // 当前项目优先级更高
    addedAt: Date.now()
})
```

### 4. 任务执行阶段

#### 4.1 并发许可获取
```typescript
// 获取系统并发许可 (最多3个项目同时执行)
await this.concurrencyController.acquire(task.projectId)
```

#### 4.2 文件预处理
```typescript
// 1. 创建文件夹文件对象
const folderFiles = createFolderFiles(this.files, this.baseSuffixDir)

// 2. 按文件夹路径分组
const folderGroups = groupFilesByFolder(folderFiles, this.baseSuffixDir)

// 3. 计算批次信息
const batchSize = this.options.batchSize || 10 // 每批10个文件
const totalBatches = Array.from(folderGroups.values())
    .reduce((sum, groupFiles) => sum + Math.ceil(groupFiles.length / batchSize), 0)
```

#### 4.3 批量上传处理
```typescript
// 按文件夹分组，逐批处理
for (const [folderPath, groupFiles] of folderGroups.entries()) {
    const batches = chunkArray(groupFiles, batchSize)
    
    for (const batch of batches) {
        // 上传批次并重试
        const batchSuccessCount = await this.uploadBatchWithRetry(batch, folderPath)
        
        // 更新进度
        const progress = calculateProgress(processedFiles, this.files.length)
        this.updateState({ processedFiles, successFiles, progress })
    }
}
```

#### 4.4 重试机制
```typescript
private async uploadBatchWithRetry(batch: FolderUploadFile[], folderPath: string) {
    const maxRetries = this.options.maxRetries || 3
    let retryCount = 0
    
    while (remainingFiles.length > 0 && retryCount < maxRetries) {
        try {
            // 等待暂停状态
            await this.waitIfPaused()
            
            // OSS 上传
            const ossResults = await this.uploadFilesToOSS(remainingFiles, folderPath)
            
            // 批量保存到项目
            await this.saveBatchToProject(ossResults, folderPath)
            
            // 全部成功，退出重试循环
            successCount += remainingFiles.length
            remainingFiles = []
            
        } catch (error) {
            retryCount++
            // 指数退避策略
            await delay(1000 * Math.pow(2, retryCount - 1))
        }
    }
}
```

### 5. 实时状态更新

#### 5.1 进度计算
```typescript
// 文件级进度
const progress = calculateProgress(processedFiles, totalFiles)

// 全局进度
const globalProgress = Math.round(
    (this.globalState.totalProcessedFiles / this.globalState.totalFiles) * 100
)
```

#### 5.2 速度估算
```typescript
// 上传速度 (KB/s)
const speed = calculateUploadSpeed(uploadedBytes, startTime)

// 剩余时间估算
const remaining = estimateTimeRemaining(totalBytes, uploadedBytes, speed)
```

#### 5.3 UI 状态同步
```typescript
// MobX 响应式更新
runInAction(() => {
    task.state = { ...task.state, ...updates }
    this.updateGlobalStats()
})

// 回调通知
this.callbacks.onProgress?.(this.id, this.state)
```

### 6. UI 显示层

#### 6.1 全局进度组件结构
```
MultiFolderUploadToast (全局容器)
├── 头部汇总区域
│   ├── 标题 + 任务计数徽章
│   ├── 总体进度百分比
│   └── 展开/收起按钮
├── TaskSummary (多任务汇总) [当活跃任务 > 1 时显示]
│   ├── 统计信息 (总文件数、已处理、上传中、暂停)
│   ├── 全局进度条
│   └── 批量操作按钮 (全部暂停/继续/取消)
├── TaskItem... (单个任务项)
│   ├── 项目名 + 文件夹路径
│   ├── 任务状态 + 文件进度
│   ├── 进度条 + 颜色指示
│   ├── 速度信息 + 剩余时间
│   ├── 控制按钮 (暂停/继续/取消)
│   └── 错误信息显示
└── 已完成任务切换区域
```

#### 6.2 状态颜色映射
```typescript
const getProgressClass = () => {
    if (task.state.isError) return styles.progressError      // 红色
    if (task.state.isCompleted) return styles.progressSuccess // 绿色  
    if (task.state.isPaused) return styles.progressWarning   // 橙色
    return styles.progressPrimary                             // 蓝色
}
```

#### 6.3 国际化支持
```typescript
// 动态文本
{t("folderUpload.progress.files", { processed, total })}

// 时间格式化
formatTimeRemaining(seconds, t) // "3 分钟" / "3 minutes"

// UI 适配
const isEnglish = i18n.language === "en_US" || i18n.language === "en"
className={cx(styles.container, isEnglish && styles.englishLayout)}
```

### 7. 持久化与恢复

#### 7.1 状态持久化
```typescript
// 保存到 localStorage
const persistData = {
    tasks: Array.from(this.globalState.tasks.entries()).map(([id, task]) => [
        id, task.serialize()
    ]),
    completedTasks: this.globalState.completedTasks.map(task => task.serialize()),
    timestamp: Date.now(),
}
localStorage.setItem('multiFolderUploadTasks', JSON.stringify(persistData))
```

#### 7.2 页面刷新恢复
```typescript
// 检查数据是否过期（24小时）
const isExpired = Date.now() - persistData.timestamp > 24 * 60 * 60 * 1000

// 恢复任务状态（注意：文件对象无法序列化，只恢复显示状态）
const task = FolderUploadTask.deserialize(serializedTask)
```

### 8. 任务控制操作

#### 8.1 暂停任务
```typescript
pauseTask(taskId: string) {
    const task = this.globalState.tasks.get(taskId)
    if (task) {
        task.pause() // 设置 isPaused = true
        // 任务执行循环中会检查暂停状态
    }
}
```

#### 8.2 取消任务
```typescript
cancelTask(taskId: string) {
    const task = this.globalState.tasks.get(taskId)
    if (task) {
        task.cancel() // 调用 abortController.abort()
        // 清理资源和状态
        this.globalState.tasks.delete(taskId)
        this.concurrencyController.release(task.projectId)
    }
}
```

#### 8.3 批量操作
```typescript
// 暂停所有上传中的任务
activeTasks.forEach(task => {
    if (task.state.isUploading && !task.state.isPaused) {
        multiFolderUploadStore.pauseTask(task.id)
    }
})
```

### 9. 错误处理与用户反馈

#### 9.1 错误分类
- **网络错误**: OSS 上传失败，自动重试
- **服务器错误**: API 调用失败，显示错误信息
- **用户取消**: 用户主动取消，清理资源
- **系统限制**: 任务数量超限，友好提示

#### 9.2 用户反馈
```typescript
// 成功消息
message.success(`文件夹上传完成: ${task.projectName}`)

// 警告消息  
message.warning('当前任务数量已达上限，请等待部分任务完成后再试')

// 错误显示
<div className={styles.errorMessage}>
    {task.state.errorMessage}
</div>
```

### 10. 跨路由保持

#### 10.1 全局组件布局
```typescript
// BaseLayout.tsx
<Flex vertical className={styles.global}>
    {/* 页面内容 */}
    {children}
    
    {/* 全局文件夹上传进度组件 - 固定位置 */}
    <MultiFolderUploadToast />
</Flex>
```

#### 10.2 状态独立性
- 上传任务状态存储在全局 MobX Store 中
- 不依赖具体页面组件的生命周期
- 路由切换时任务继续在后台执行

## 🎯 核心特性总结

### ✅ 已实现功能
1. **多项目并发**: 支持不同项目同时上传文件夹
2. **智能队列**: 基于优先级的任务调度
3. **批量处理**: 每次处理10个文件，然后批量保存
4. **失败重试**: 自动重试最多3次，指数退避策略
5. **实时进度**: 详细的进度显示和状态更新
6. **任务控制**: 暂停、继续、取消操作
7. **持久化**: 状态保存与页面刷新恢复
8. **国际化**: 完整的中英文支持
9. **响应式UI**: 适配不同语言的文本长度

### 🔧 技术亮点
- **MobX 状态管理**: 响应式的全局状态
- **TypeScript**: 完整的类型安全
- **并发控制**: 防止系统过载的智能调度
- **模块化设计**: 清晰的职责分离
- **优雅的错误处理**: 用户友好的反馈机制

### 🎨 用户体验
- **直观的进度显示**: 多层级的进度信息
- **灵活的任务控制**: 随时暂停、继续、取消
- **无感的跨页面**: 路由切换不影响上传
- **智能的资源管理**: 自动清理和优化

这个多任务文件夹上传系统提供了企业级的文件管理能力，既保证了性能，又提供了优秀的用户体验。
