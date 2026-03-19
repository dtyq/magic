# 📁 文件夹上传Mock使用指南

## 🎯 功能简介

为了方便开发和测试文件夹上传功能的各种UI状态，我们提供了完整的Mock数据方案。Mock系统可以模拟以下场景：

- 🟡 **正在上传中的任务**（带动态进度）
- ✅ **完全上传成功的任务**
- ⚠️ **上传完成但有失败文件的任务**
- ⏳ **等待上传的任务**（在队列中）
- ⏸️ **暂停的任务**

## 🚀 快速开始

### 方法一：使用开发工具面板（推荐）

在开发环境中，会在页面左下角显示一个开发工具面板：

```
📁 上传组件开发工具
┌─────────────────────────┐
│ 当前状态：              │
│ • 活跃任务：0           │
│ • 已完成任务：0         │
│ • 队列任务：0           │
│                         │
│ [启动Mock] [清理数据]   │
│                         │
│ Mock包含：上传中、已完成、│
│ 有错误、等待中、暂停等状态│
└─────────────────────────┘
```

**操作步骤：**
1. 点击 **"启动Mock"** 按钮
2. 系统会自动创建5个不同状态的上传任务
3. 观察UI中显示的各种状态和交互
4. 点击 **"清理数据"** 按钮清空所有Mock数据

### 方法二：编程调用

在浏览器控制台或代码中直接调用：

```javascript
// 启动Mock
multiFolderUploadStore.mockTasksForTesting()

// 清理Mock数据
multiFolderUploadStore.clearMockTasks()
```

## 📊 Mock数据详情

### 1. 🟡 上传中任务
- **项目**: AI图像生成项目
- **路径**: images/photos
- **文件数**: 25个文件
- **当前进度**: 48% (12/25)
- **特点**: 有动态进度更新和上传速度显示

### 2. ✅ 完成任务
- **项目**: 市场分析报告
- **路径**: documents/reports
- **文件数**: 18个文件
- **状态**: 100%完成，无错误

### 3. ⚠️ 部分失败任务
- **项目**: 产品宣传视频
- **路径**: assets/videos
- **文件数**: 30个文件
- **状态**: 27成功，3失败
- **特点**: 显示重试按钮

### 4. ⏳ 等待任务
- **项目**: 系统配置文件
- **路径**: configs/settings
- **文件数**: 15个文件
- **状态**: 在队列中等待开始

### 5. ⏸️ 暂停任务
- **项目**: 数据库备份文件
- **路径**: backup/database
- **文件数**: 22个文件
- **状态**: 36%时暂停，可以恢复

## 🎬 动态效果

Mock系统提供了真实的动态效果：

- **进度动画**: 上传中任务会自动增长进度（0.5-3.5%/秒）
- **速度显示**: 模拟真实的上传速度（1.8-3.2 MB/s）
- **剩余时间**: 动态计算预估完成时间
- **状态转换**: 任务完成后自动转为已完成状态

## 🔧 开发调试

### 状态检查
```javascript
// 检查当前状态
console.log({
  activeTasks: multiFolderUploadStore.activeTasks.length,
  completedTasks: multiFolderUploadStore.completedTasks.length,
  queuedTasks: multiFolderUploadStore.taskQueue.length,
  globalProgress: multiFolderUploadStore.globalProgress,
})
```

### 手动控制任务
```javascript
// 获取第一个活跃任务
const task = multiFolderUploadStore.activeTasks[0]

// 暂停任务
multiFolderUploadStore.pauseTask(task.id)

// 恢复任务
multiFolderUploadStore.resumeTask(task.id)

// 取消任务
multiFolderUploadStore.cancelTask(task.id)
```

## 🎨 UI状态测试

### 折叠状态测试
Mock数据特别适合测试折叠状态的三种场景：

1. **上传中**: 显示Spin + 进度百分比
2. **上传完成**: 显示✅ + "n/m"文件数
3. **有失败**: 显示⚠️ + "上传完成，n个失败" + 重试按钮

### 展开状态测试
- 任务列表显示
- 进度条动画
- 按钮交互（暂停/恢复/取消）
- 统计信息显示

## ⚠️ 注意事项

1. **仅开发环境**: 开发工具面板仅在`NODE_ENV === 'development'`时显示
2. **数据隔离**: Mock数据不会影响真实的上传功能
3. **自动清理**: 刷新页面后Mock数据会自动清空
4. **性能考虑**: Mock的动画效果会在任务完成后自动停止

## 🔍 故障排除

### 问题：Mock按钮无反应
- 检查是否在开发环境
- 确认没有真实的上传任务正在运行

### 问题：UI组件不显示
- 确认`MultiFolderUploadToast`组件已正确添加到布局中
- 检查浏览器控制台是否有错误

### 问题：动画不流畅
- 这是正常的Mock行为，不影响真实上传的性能

## 📚 相关文档

- [FOLDER_UPLOAD_FLOW.md](./FOLDER_UPLOAD_FLOW.md) - 上传流程说明
- [BUGFIXES.md](./BUGFIXES.md) - 已修复的问题
- [I18N_FIXES.md](./I18N_FIXES.md) - 国际化修复
- [README.md](./README.md) - 组件总览
