/**
 * 日志插件系统主导出文件
 */

// 核心类型和接口
export type {
	LogData,
	LogContext,
	LoggerPlugin,
	AsyncLoggerPlugin,
	PluginOptions,
	PluginManager,
	PluginFactory,
	LoggerEnableConfig,
} from "./types"

// 枚举值导出
export { LogType } from "./types"

// 插件管理器
export { LoggerPluginManager } from "./PluginManager"

// 内置插件
export * from "./builtin"
