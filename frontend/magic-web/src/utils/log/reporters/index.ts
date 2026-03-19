/**
 * 日志上报器模块导出
 */

// 接口和类型定义
export type { ILogReporter, LogReporterConfig, ReportResult } from "./ILogReporter"
export type { ReporterType, ReporterFactoryConfig } from "./ReporterFactory"
export type { LogQueueConfig, QueueStats } from "./LogQueue"

// 具体实现
export { FetchLogReporter } from "./FetchLogReporter"
export { BeaconLogReporter } from "./BeaconLogReporter"
export { XhrLogReporter } from "./XhrLogReporter"

// 队列管理器
export { LogQueue } from "./LogQueue"

// 工厂类
export { ReporterFactory } from "./ReporterFactory"
