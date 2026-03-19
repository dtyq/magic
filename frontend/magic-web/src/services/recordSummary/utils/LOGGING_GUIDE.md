# Recording Logger 使用指南

## 概述

`RecordingLogger` 是录音纪要服务的中心化日志管理系统，提供：
- 全局统一的 sessionId/task_key 管理
- 自动为所有日志附加 task_key
- 统一的命名空间管理

## 基本用法

### 1. 在各模块中创建日志实例

```typescript
import { recordingLogger } from "./utils/RecordingLogger"

// 创建命名空间日志（命名空间会自动添加 RecordSummary: 前缀）
const logger = recordingLogger.namespace("Session")
// 实际命名空间：RecordSummary:Session
```

### 2. 在主服务中设置 sessionId（全局设置，一次生效）

```typescript
// 在 RecordSummaryService.startRecording() 中
recordingLogger.setSessionId(session.id)

// 之后所有模块的日志都会自动包含 task_key
```

### 3. 记录日志

```typescript
// 普通日志
logger.log("创建新会话", {
  userId: "xxx",
  workspaceName: "xxx",
})

// 警告日志
logger.warn("会话过期", {
  ageInHours: 25,
})

// 错误日志
logger.error("保存失败", {
  error: error.message,
})

// 主动上报（会被 logger.report 上报到服务器）
logger.report("录音开始", {
  audioSource: "both",
  duration: 0,
})
```

### 4. 清理 sessionId

```typescript
// 在录音结束时
recordingLogger.clearSessionId()
```

## 日志数据格式

所有日志会自动包含以下字段：

```typescript
{
  namespace: "RecordSummary:Session",  // 自动添加前缀
  data: [
    "创建新会话",                         // 日志消息
    {
      userId: "xxx",                     // 业务数据
      workspaceName: "xxx",
      task_key: "session_xxx_xxx"       // 自动添加
    }
  ]
}
```

## 命名空间规范

| 模块 | 命名空间 | 实际日志命名空间 |
|------|---------|-----------------|
| RecordSummaryService | Main | RecordSummary:Main |
| RecordingSessionManager | Session | RecordSummary:Session |
| RecordingPersistence | Persistence | RecordSummary:Persistence |
| UploadTokenManager | Upload:Token | RecordSummary:Upload:Token |
| ChunkUploader | Upload:Chunk | RecordSummary:Upload:Chunk |
| AudioChunkDB | Storage:DB | RecordSummary:Storage:DB |
| MediaRecorderService | Audio:Recorder | RecordSummary:Audio:Recorder |
| RecorderCoreAdapter | Audio:Core | RecordSummary:Audio:Core |

## 优势

### ✅ 中心化管理
- 单一入口管理所有日志
- 统一的 sessionId 管理

### ✅ 简化使用
- 各模块不需要重复设置 sessionId
- 自动附加 task_key，无需手动添加

### ✅ 链路追踪
- 所有日志自动带上 task_key
- 便于追踪同一录音会话的完整链路

## 迁移指南

### 旧方式（不推荐）
```typescript
const logger = Logger.createLogger("RecordSummary:Session")

// 每次调用都需要传 sessionId
logger.log("xxx", { sessionId, ...data })
```

### 新方式（推荐）
```typescript
const logger = recordingLogger.namespace("Session")

// 主服务设置一次 sessionId
recordingLogger.setSessionId(sessionId)

// 之后无需重复传 sessionId，自动附加 task_key
logger.log("xxx", { ...data })
```

## 注意事项

1. **只在主服务设置 sessionId**：避免在子模块中调用 `recordingLogger.setSessionId()`
2. **记得清理 sessionId**：录音结束时调用 `recordingLogger.clearSessionId()`
3. **使用适当的日志级别**：
   - `log` - 正常流程的关键节点
   - `warn` - 可恢复的异常、降级
   - `error` - 不可恢复的错误
   - `report` - 需要主动上报到服务器的关键事件

