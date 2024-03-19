import type Logger from "../Logger"

/**
 * 日志级别枚举
 */
export const enum LogType {
	DEBUG = "debug",
	INFO = "info",
	WARN = "warn",
	ERROR = "error",
	TRACE = "trace",
	REPORT = "report",
}

/**
 * 日志上下文接口
 */
export interface LogContext {
	/** 日志级别 */
	logType: LogType
	/** 命名空间 */
	namespace: string
	/** 链路追踪ID */
	traceId: string
	/** 原始参数 */
	data: any
	// /** 处理后的数据 */
	// data?: unknown[]
	/** URL信息 */
	url?: string
	/** 用户信息 */
	info?: {
		uId?: string
		tOrgCode?: string
		mOrgCode?: string
		cluster?: string
	}
	/** 时间戳 */
	timestamp: number
	/** 是否应该停止处理链 */
	shouldStop?: boolean
	/** 是否应该跳过控制台输出 */
	skipConsole?: boolean
	/** 是否应该跳过上报 */
	skipReport?: boolean
	/** 插件间共享的元数据 */
	metadata: Record<string, any>
}

/** api 配置 */
export interface LoggerEnableConfig {
	console?: boolean
	warn?: boolean
	error?: boolean
	trace?: boolean
	report?: boolean
}

export interface LogData extends Partial<
	Pick<LogContext, "namespace" | "logType" | "data" | "metadata">
> {}

/**
 * 插件处理结果
 */
export interface PluginResult {
	/** 是否继续执行后续插件 */
	continue: boolean
	/** 修改后的上下文 */
	context?: Partial<LogContext>
	/** 错误信息 */
	error?: Error
}

/**
 * 日志插件接口
 */
export interface LoggerPlugin {
	/** 插件名称 */
	readonly name: string
	/** 插件版本 */
	readonly version?: string
	/** 插件优先级，数字越小优先级越高 */
	readonly priority?: number
	/** 插件是否启用 */
	enabled: boolean

	/**
	 * 插件初始化
	 */
	init?(logger: Logger, manager: PluginManager): void

	/**
	 * 检查是否应该处理此日志
	 */
	shouldHandle?(context: LogContext): boolean

	/**
	 * 处理日志上下文
	 */
	process(context: LogContext): LogContext | Promise<LogContext>

	/**
	 * 插件销毁
	 */
	destroy?(): void | Promise<void>
}

/**
 * 异步插件接口
 */
export interface AsyncLoggerPlugin extends LoggerPlugin {
	process(context: LogContext): Promise<LogContext>
}

/**
 * 插件配置选项
 */
export interface PluginOptions {
	/** 是否启用 */
	enabled?: boolean
	/** 优先级 */
	priority?: number
	/** 插件特定配置 */
	config?: Record<string, any>
}

/**
 * 插件管理器接口
 */
export interface PluginManager {
	/** 注册插件 */
	register(logger: Logger, plugin: LoggerPlugin, options?: PluginOptions): void

	/** 注销插件 */
	unregister(pluginName: string): void

	/** 获取插件 */
	get(pluginName: string): LoggerPlugin | undefined

	/** 获取所有插件 */
	getAll(): LoggerPlugin[]

	/** 清除所有插件 */
	clear(): void

	/** 处理日志上下文 */
	process(context: LogContext): Promise<LogContext>
}

/**
 * 插件工厂函数类型
 */
export type PluginFactory<T extends LoggerPlugin = LoggerPlugin> = (options?: any) => T

/**
 * 内置插件类型
 */
export interface BuiltinPlugins {
	sensitiveData: PluginFactory
	deduplication: PluginFactory
	errorParser: PluginFactory
	console: PluginFactory
	reporter: PluginFactory
}
