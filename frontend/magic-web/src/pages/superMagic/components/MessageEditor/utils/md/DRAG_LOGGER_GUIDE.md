# 拖拽日志记录器使用指南

## 概述

拖拽日志记录器是一个用于调试拖拽@功能的工具，它可以记录从拖拽开始到最终插入mention的完整过程，帮助定位拖拽失效的原因。

**日志级别：**
- 🔍 **本地调试**：所有日志记录到浏览器内存和控制台（默认模式）
- 🔥 **线上上报**：仅关键错误通过 `logger.error` 上报到日志系统（可选启用）

## 快速开始

### 1. 开启日志记录（本地调试）

在浏览器控制台中运行：

```javascript
window.enableDragLogger()
```

日志记录器会被启用，并且配置会保存到 localStorage，下次刷新页面后仍然有效。

**此时：**
- ✅ 所有日志记录到浏览器内存
- ✅ 控制台输出详细日志
- ❌ 不会上报到线上日志系统

### 2. 开启线上上报（可选）

如果需要将关键错误上报到线上日志系统以便排查生产环境问题：

```javascript
window.enableDragLoggerServerReport()
```

**此时：**
- ✅ 所有日志仍记录到浏览器
- ✅ 控制台仍输出详细日志
- 🔥 关键错误会通过 `logger.error` 上报到线上

**关键错误包括：**
1. 数据解析失败（可能是代码 bug）
2. Mention 插入失败（影响用户体验）
3. 编辑器未就绪（如果启用上报）
4. 所有通过 `logError` 记录的错误

### 3. 执行拖拽操作

进行你想要调试的拖拽操作：
- 从 Tab 拖拽文件到输入框
- 从附件列表拖拽文件到输入框
- 从 PPT 预览拖拽 slide 到输入框
- 拖拽多个文件到输入框

### 4. 查看日志

拖拽操作完成后，在控制台运行：

```javascript
window.getDragLogs()
```

这将以表格形式展示所有记录的日志，包括：
- 每个阶段的时间戳
- 经过的时间（相对于拖拽开始）
- 各阶段的详细数据
- 任何发生的错误

### 5. 导出日志（可选）

如果需要保存或分享日志，可以运行：

```javascript
window.exportDragLogs()
```

这会：
1. 在控制台打印完整的 JSON 格式日志
2. 自动复制到剪贴板
3. 你可以将其保存到文件或分享给其他人

### 6. 清空日志

查看完日志后，可以清空以便下次测试：

```javascript
window.clearDragLogs()
```

### 7. 关闭日志记录

调试完成后，可以关闭日志记录：

```javascript
window.disableDragLogger()
```

### 8. 关闭线上上报（如果之前启用了）

```javascript
window.disableDragLoggerServerReport()
```

## 使用场景

### 场景1：本地开发调试（推荐）

```javascript
// 只开启本地日志
window.enableDragLogger()

// 进行拖拽测试
// ...

// 查看日志
window.getDragLogs()
```

**优点：**
- 不会产生线上日志噪音
- 完整的本地调试信息
- 性能开销最小

**适用于：**
- 开发新功能
- 修复已知 bug
- 本地性能测试

### 场景2：生产环境问题排查

```javascript
// 同时开启本地日志和线上上报
window.enableDragLogger()
window.enableDragLoggerServerReport()

// 重现生产环境问题
// ...

// 查看本地日志
window.getDragLogs()

// 导出日志用于报告
window.exportDragLogs()
```

**优点：**
- 本地有完整日志可查看
- 关键错误自动上报到线上
- 便于分析用户实际遇到的问题

**适用于：**
- 用户反馈拖拽失效
- 线上偶现问题排查
- 收集错误数据用于优化

**注意：**
- 仅关键错误会上报，不会产生大量日志
- 排查完成后记得关闭：`window.disableDragLoggerServerReport()`

日志记录器会追踪以下关键阶段：

### 1. dragStart（拖拽开始）
记录内容：
- `source`: 拖拽源（tab/attachment/multipleFiles/pptSlide）
- `itemType`: 项目类型
- `itemId`: 项目ID
- `itemName`: 项目名称
- `dataTransferTypes`: dataTransfer 支持的类型
- `payload`: 拖拽数据预览（前200字符）

### 2. dragEnter（进入编辑器区域）
记录内容：
- `targetElement`: 目标元素
- `dataTransferTypes`: dataTransfer 类型
- `enableFileDrop`: 是否启用文件拖放
- `dragCounter`: 拖拽计数器状态

### 3. dragOver（悬停在编辑器上）
记录内容：
- `targetElement`: 目标元素
- `dataTransferTypes`: dataTransfer 类型
- `dragCounter`: 拖拽计数器状态
- `isDragOver`: 是否处于拖拽状态

注意：此事件会频繁触发，日志使用 debug 级别

### 4. dragLeave（离开编辑器区域）
记录内容：
- `targetElement`: 目标元素
- `dragCounter`: 拖拽计数器状态
- `isDragOver`: 是否仍处于拖拽状态

### 5. drop（放下）
记录内容：
- `targetElement`: 目标元素
- `dataTransferTypes`: dataTransfer 类型
- `hasFiles`: 是否包含文件
- `filesCount`: 文件数量
- `hasCustomData`: 是否包含自定义数据
- `customDataPreview`: 自定义数据预览（前100字符）
- `uploadEnabled`: 上传功能是否启用

### 6. dataParsing（数据解析）
记录内容：
- `success`: 解析是否成功
- `rawData`: 原始数据（前200字符）
- `parsedData`: 解析后的数据
- `dragType`: 拖拽类型
- `error`: 错误信息（如果失败）

### 7. editorCheck（编辑器状态检查）
记录内容：
- `hasEditor`: 编辑器是否存在
- `isDestroyed`: 编辑器是否已销毁
- `isFocused`: 编辑器是否获得焦点
- `canExecuteCommands`: 是否可以执行命令
- `error`: 错误信息（如果有）

### 8. mentionInsert（mention 插入）
记录内容：
- `success`: 插入是否成功
- `mentionType`: mention 类型
- `mentionData`: mention 数据
- `itemsCount`: 项目数量（多文件拖拽时）
- `error`: 错误信息（如果失败）

### 9. dragEnd（拖拽结束）
记录内容：
- `cancelled`: 是否取消
- `totalElapsed`: 总耗时
- `error`: 错误信息（如果有）

## 常见问题诊断

### 问题1：拖拽后没有反应

检查日志中的这些关键点：

1. **是否有 `dragStart` 日志？**
   - 没有 → 拖拽源没有正确设置 `onDragStart` 事件
   - 有 → 继续检查

2. **是否有 `drop` 日志？**
   - 没有 → 可能拖拽到了错误的区域，或者中途取消了拖拽
   - 有 → 继续检查

3. **`dataParsing` 是否成功？**
   - `success: false` → 检查 `error` 字段，通常是 JSON 解析失败
   - `success: true` → 继续检查

4. **`editorCheck` 状态如何？**
   - `hasEditor: false` → 编辑器未初始化
   - `isDestroyed: true` → 编辑器已销毁（可能组件已卸载）
   - `canExecuteCommands: false` → 编辑器对象不完整

5. **`mentionInsert` 是否成功？**
   - `success: false` → 检查 `error` 字段了解失败原因

### 问题2：某些类型的文件拖拽失效

1. 检查 `dragStart` 中的 `itemType` 是否正确
2. 检查 `dataParsing` 中的 `dragType` 是否被识别
3. 检查 `mentionInsert` 中的 `mentionType` 是否匹配

### 问题3：拖拽状态显示异常

1. 检查 `dragEnter` 和 `dragLeave` 的 `dragCounter` 是否匹配
2. 如果计数器不为0但拖拽已结束，说明事件没有正确配对
3. 查看是否有 `dragEnd` 事件兜底重置

### 问题4：上传功能被禁用

检查 `drop` 日志中的 `uploadEnabled` 字段：
- `false` → 当前场景禁用了上传功能
- 但是项目文件拖拽（自定义数据）仍然可用

## 日志示例

### 成功的拖拽操作

```javascript
[
  {
    timestamp: 1234567890123,
    stage: "dragStart",
    data: {
      source: "tab",
      itemType: "tab",
      itemId: "file-123",
      itemName: "example.tsx",
      sessionId: "drag-1234567890123-abc123",
      elapsed: 0
    }
  },
  {
    timestamp: 1234567890234,
    stage: "dragEnter",
    data: {
      targetElement: "super-message-editor-container",
      dragCounter: 1,
      enableFileDrop: true,
      elapsed: 111
    }
  },
  {
    timestamp: 1234567890456,
    stage: "drop",
    data: {
      hasCustomData: true,
      customDataPreview: '{"type":"tab","data":...',
      uploadEnabled: true,
      elapsed: 333
    }
  },
  {
    timestamp: 1234567890467,
    stage: "dataParsing",
    data: {
      success: true,
      dragType: "tab",
      elapsed: 344
    }
  },
  {
    timestamp: 1234567890478,
    stage: "editorCheck",
    data: {
      hasEditor: true,
      isDestroyed: false,
      canExecuteCommands: true,
      elapsed: 355
    }
  },
  {
    timestamp: 1234567890489,
    stage: "mentionInsert",
    data: {
      success: true,
      mentionType: "project_file",
      mentionData: { file_name: "example.tsx" },
      elapsed: 366
    }
  },
  {
    timestamp: 1234567890500,
    stage: "dragEnd",
    data: {
      totalElapsed: 377
    }
  }
]
```

### 失败的拖拽操作（编辑器未就绪）

```javascript
[
  {
    timestamp: 1234567890123,
    stage: "dragStart",
    data: { /* ... */ }
  },
  {
    timestamp: 1234567890456,
    stage: "drop",
    data: { /* ... */ }
  },
  {
    timestamp: 1234567890467,
    stage: "dataParsing",
    data: {
      success: true,
      dragType: "tab"
    }
  },
  {
    timestamp: 1234567890478,
    stage: "editorCheck",
    data: {
      hasEditor: false,  // ❌ 问题在这里
      elapsed: 355
    },
    error: Error("Editor is null")
  },
  {
    timestamp: 1234567890489,
    stage: "insertMention_error",  // ❌ 插入失败
    data: { /* ... */ },
    error: Error("Editor is null")
  }
]
```

## 高级用法

### 在代码中手动记录日志

如果需要在自定义代码中添加日志：

```typescript
import { dragLogger } from './utils/dragLogger'

// 记录自定义阶段
dragLogger.logError('customStage', new Error('Something went wrong'), {
  extraInfo: 'some data'
})
```

### 条件性启用日志

只在特定条件下启用日志：

```typescript
// 只在开发环境或特定功能开关下启用
if (process.env.NODE_ENV === 'development' || featureFlags.dragDebug) {
  dragLogger.enable()
}
```

### 自动分析日志

编写脚本自动分析日志，找出常见问题：

```javascript
function analyzeDragLogs() {
  const logs = window.dragLogger.getLogs()
  
  // 检查是否有错误
  const errors = logs.filter(log => log.error)
  if (errors.length > 0) {
    console.warn('发现错误:', errors)
  }
  
  // 检查是否完成
  const hasStart = logs.some(log => log.stage === 'dragStart')
  const hasEnd = logs.some(log => log.stage === 'dragEnd')
  const hasInsert = logs.some(log => log.stage === 'mentionInsert' && log.data.success)
  
  if (hasStart && !hasEnd) {
    console.warn('拖拽未正常结束')
  }
  
  if (hasStart && hasEnd && !hasInsert) {
    console.warn('拖拽完成但 mention 未插入')
  }
  
  // 计算性能
  const totalTime = logs[logs.length - 1]?.timestamp - logs[0]?.timestamp
  console.log(`拖拽总耗时: ${totalTime}ms`)
}

// 运行分析
analyzeDragLogs()
```

## 注意事项

1. **性能影响**：日志记录会有轻微的性能开销，建议仅在需要调试时启用
2. **隐私**：日志中可能包含文件名等信息，导出时注意脱敏
3. **存储**：日志保存在内存中，刷新页面后会清空（但启用状态保存在 localStorage）
4. **浏览器兼容性**：依赖 localStorage 和 clipboard API，旧浏览器可能不完全支持

## 故障排查流程

### 本地调试流程

1. ✅ 开启日志：`window.enableDragLogger()`
2. ✅ 重现问题：执行拖拽操作
3. ✅ 查看日志：`window.getDragLogs()`
4. ✅ 定位问题：查看哪个阶段失败
5. ✅ 导出日志：`window.exportDragLogs()`（如需保存）
6. ✅ 修复问题：根据日志修改代码
7. ✅ 验证修复：重复步骤1-3
8. ✅ 关闭日志：`window.disableDragLogger()`

### 生产环境排查流程

1. ✅ 开启日志：`window.enableDragLogger()`
2. ✅ 开启上报：`window.enableDragLoggerServerReport()`
3. ✅ 重现问题：执行拖拽操作
4. ✅ 查看本地日志：`window.getDragLogs()`
5. ✅ 导出日志：`window.exportDragLogs()`
6. ✅ 查看线上日志：登录日志系统，搜索 `[DragLogger]`
7. ✅ 分析问题：结合本地和线上日志定位
8. ✅ 关闭上报：`window.disableDragLoggerServerReport()`
9. ✅ 关闭日志：`window.disableDragLogger()`

## 常见问题

### Q1：开启线上上报会产生很多日志吗？

**A：** 不会。只有以下情况才会上报：
- 数据解析失败
- Mention 插入失败
- 编辑器未就绪（可选）
- 通过 logError 记录的错误

正常的拖拽流程（dragStart、dragEnter、drop、dragEnd 等）**不会**上报。

### Q2：本地调试需要开启线上上报吗？

**A：** 不需要。本地调试只需要 `enableDragLogger()`，所有日志都在浏览器中，更方便查看。

### Q3：何时应该开启线上上报？

**A：** 以下情况建议开启：
1. 用户反馈拖拽失效，但本地无法重现
2. 需要收集生产环境的错误数据
3. 排查偶现问题，需要长期监控

排查完成后记得关闭：`disableDragLoggerServerReport()`

### Q4：如何查看线上上报的日志？

**A：** 登录线上日志系统，搜索关键词：
- `[DragLogger]` - 所有拖拽相关日志
- `拖拽数据解析失败` - 数据解析错误
- `Mention 插入失败` - 插入失败错误
- `编辑器未就绪` - 编辑器状态错误

### Q5：日志会持久化吗？

**A：**
- **启用状态**：保存在 localStorage，刷新页面仍有效
- **日志内容**：保存在内存，刷新页面会清空
- **线上日志**：如果启用上报，关键错误会永久保存在日志系统

### Q6：性能影响如何？

**A：**
- **本地日志**：轻微影响，主要是内存占用和控制台输出
- **线上上报**：仅在发生错误时才会发送请求，正常流程无影响
- **建议**：非调试场景下关闭日志记录

## 反馈与改进

如果日志记录器缺少关键信息，可以：
1. 在对应的拖拽处理函数中添加更多日志调用
2. 扩展 `dragLogger` 类添加新的日志方法
3. 提交 PR 改进日志记录功能
