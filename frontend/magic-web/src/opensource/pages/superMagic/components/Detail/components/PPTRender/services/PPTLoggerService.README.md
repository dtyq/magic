# PPTLoggerService 使用指南

## 概述

`PPTLoggerService` 是为 PPT 渲染模块设计的结构化日志服务，提供了分级日志、性能追踪、操作记录等功能。

## 特性

- ✅ **分级日志**: 支持 debug、info、warn、error 四个级别
- ✅ **结构化输出**: 支持操作名称、幻灯片索引、元数据等上下文信息
- ✅ **性能追踪**: 自动追踪操作执行时间
- ✅ **可配置**: 支持动态调整日志级别、前缀等配置
- ✅ **生产环境友好**: 可完全禁用日志输出

## 基本使用

### 创建日志实例

```typescript
import { createPPTLogger } from "./services"

const logger = createPPTLogger({
  enabled: true,        // 是否启用日志
  level: "info",        // 日志级别：debug | info | warn | error
  prefix: "[PPTStore]", // 日志前缀
  enableTiming: true,   // 是否启用性能追踪
})
```

### 基本日志输出

```typescript
// 调试日志
logger.debug("这是一条调试消息")

// 信息日志
logger.info("这是一条信息消息")

// 警告日志
logger.warn("这是一条警告消息")

// 错误日志
const error = new Error("错误详情")
logger.error("发生错误", error)
```

### 带上下文的日志

```typescript
// 包含操作名称
logger.info("加载完成", {
  operation: "loadSlides",
})
// 输出: [PPTStore] [loadSlides] 加载完成

// 包含幻灯片索引
logger.info("处理中", {
  operation: "processSlide",
  slideIndex: 3,
})
// 输出: [PPTStore] [processSlide] [Slide 3] 处理中

// 包含元数据
logger.info("批量加载完成", {
  operation: "loadAll",
  metadata: {
    totalSlides: 10,
    loadedSlides: 8,
    failedSlides: 2,
  },
})
// 输出: [PPTStore] [loadAll] 批量加载完成 { totalSlides: 10, loadedSlides: 8, failedSlides: 2 }
```

## 操作日志

对于完整的操作流程，使用操作日志方法：

```typescript
// 记录操作开始
logger.logOperationStart("initializeSlides", {
  metadata: { slideCount: 10 },
})

try {
  // 执行操作...
  
  // 记录操作成功
  logger.logOperationSuccess("initializeSlides", {
    metadata: { loadedCount: 10 },
  })
} catch (error) {
  // 记录操作失败
  logger.logOperationError("initializeSlides", error, {
    metadata: { attemptedCount: 10 },
  })
}
```

## 性能追踪

```typescript
// 开始计时
logger.startTiming("loadAllSlides")

// 执行耗时操作...
await loadSlides()

// 结束计时并输出耗时
const duration = logger.endTiming("loadAllSlides", {
  metadata: { slideCount: 10 },
})
// 输出: [PPTStore] [loadAllSlides] Operation completed in 1234ms
```

## 日志分组

```typescript
logger.group("加载幻灯片详情")
logger.info("开始加载幻灯片 1")
logger.info("开始加载幻灯片 2")
logger.info("开始加载幻灯片 3")
logger.groupEnd()
```

## 配置管理

### 运行时更新配置

```typescript
// 更新日志级别
logger.updateConfig({ level: "warn" })

// 禁用日志
logger.updateConfig({ enabled: false })

// 更新前缀
logger.updateConfig({ prefix: "[PPT-Debug]" })
```

### 获取当前配置

```typescript
const config = logger.getConfig()
console.log(config)
// { enabled: true, level: "info", prefix: "[PPTStore]", enableTiming: true }
```

## 日志级别

从低到高的日志级别及其使用场景：

- **debug**: 详细的调试信息，用于开发和问题排查
- **info**: 常规信息，记录重要的操作和状态变化
- **warn**: 警告信息，表示潜在问题但不影响功能
- **error**: 错误信息，表示功能失败或异常

### 级别过滤规则

设置日志级别后，只会输出该级别及以上的日志：

```typescript
logger.updateConfig({ level: "warn" })

logger.debug("不会输出")  // ❌
logger.info("不会输出")   // ❌
logger.warn("会输出")     // ✅
logger.error("会输出")    // ✅
```

## 在 PPTStore 中的集成

PPTStore 已经集成了完整的日志系统：

```typescript
const store = new PPTStore({
  // ... 其他配置
  logger: {
    enabled: true,
    level: "info",
    prefix: "[PPTStore]",
  },
})

// 所有操作都会自动记录日志
await store.initializeSlides(paths)  // 自动记录初始化过程
await store.loadAllSlides()          // 自动记录加载过程
store.nextSlide()                     // 自动记录导航操作
```

## 生产环境配置

在生产环境中，建议使用以下配置：

```typescript
const logger = createPPTLogger({
  enabled: process.env.NODE_ENV !== "production", // 生产环境禁用
  level: "error",                                  // 只记录错误
  enableTiming: false,                             // 禁用性能追踪
})
```

## 最佳实践

1. **开发环境使用 debug 级别**，生产环境使用 error 级别
2. **关键操作使用操作日志方法**（logOperationStart/Success/Error）
3. **性能敏感的操作使用性能追踪**（startTiming/endTiming）
4. **日志消息使用中文**，保持一致性
5. **合理使用元数据**，避免记录敏感信息
6. **生产环境禁用日志或只记录错误**，减少性能影响

## API 参考

### 配置接口

```typescript
interface PPTLoggerConfig {
  enabled?: boolean      // 是否启用日志，默认 true
  level?: LogLevel      // 日志级别，默认 "info"
  prefix?: string       // 日志前缀，默认 "[PPTStore]"
  enableTiming?: boolean // 是否启用性能追踪，默认 true
}

type LogLevel = "debug" | "info" | "warn" | "error"
```

### 上下文接口

```typescript
interface LogContext {
  operation: string              // 操作名称
  slideIndex?: number           // 幻灯片索引
  metadata?: Record<string, unknown> // 附加元数据
  timestamp?: number            // 时间戳
}
```

### 核心方法

- `debug(message: string, context?: Partial<LogContext>): void`
- `info(message: string, context?: Partial<LogContext>): void`
- `warn(message: string, context?: Partial<LogContext>): void`
- `error(message: string, error?: Error | unknown, context?: Partial<LogContext>): void`
- `logOperationStart(operation: string, context?: Partial<Omit<LogContext, "operation">>): void`
- `logOperationSuccess(operation: string, context?: Partial<Omit<LogContext, "operation">>): void`
- `logOperationError(operation: string, error: Error | unknown, context?: Partial<Omit<LogContext, "operation">>): void`
- `startTiming(operationId: string): void`
- `endTiming(operationId: string, context?: Partial<LogContext>): number | undefined`
- `updateConfig(config: Partial<PPTLoggerConfig>): void`
- `getConfig(): Readonly<Required<PPTLoggerConfig>>`
- `clearTimings(): void`
- `group(label: string): void`
- `groupEnd(): void`
