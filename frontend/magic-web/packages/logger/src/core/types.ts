/**
 * 核心类型定义
 */

/**
 * 追踪平台类型
 */
export type ProviderType = "Volcengine" | "Aliyun"

/**
 * 日志级别
 */
export type LogLevel = "debug" | "info" | "warn" | "error"

/**
 * Provider 基础配置接口
 */
export interface IProviderConfig {
	/** 平台类型 */
	type: ProviderType
	/** 应用 ID */
	appId: string | number
	/** 应用 Token */
	token: string
	/** 是否启用 */
	enabled?: boolean
	/** 环境标识 */
	env?: string
	/** 自定义配置 */
	extra?: Record<string, any>
}

/**
 * Logger 配置接口
 */
export interface ILoggerConfig {
	/** Provider 配置 */
	provider: IProviderConfig
	/** 是否自动启动 */
	autoStart?: boolean
	/** 日志级别 */
	logLevel?: LogLevel
	/** 是否启用控制台输出 */
	debug?: boolean
	/** 采样率 (0-1) */
	sampleRate?: number
	/** 插件列表 */
	plugins?: IPlugin[]
}

/**
 * 用户信息接口
 */
export interface IUserInfo {
	id: string | number
	name?: string
	email?: string
	extra?: Record<string, any>
}

/**
 * 自定义事件接口
 */
export interface ICustomEvent {
	/** 事件名称 */
	name: string
	/** 事件属性 */
	properties?: Record<string, any>
	/** 时间戳 */
	timestamp?: number
}

/**
 * 错误信息接口
 */
export interface IErrorInfo {
	/** 错误信息 */
	message: string
	/** 错误堆栈 */
	stack?: string
	/** 错误类型 */
	type?: string
	/** 额外信息 */
	extra?: Record<string, any>
}

/**
 * Provider 基类接口
 */
export interface IProvider {
	/** 初始化 */
	init(config: IProviderConfig): Promise<void>
	/** 启动 */
	start(): void
	/** 停止 */
	stop(): void
	/** 设置实例信息（应用版本、用户ID、设备ID） */
	setConfig(config: Record<string, string | null | undefined>): void
	/** 异常上报 */
	error(...error: any[]): void
	/** 自定义上报方法 */
	report(event: ICustomEvent): void
	// /** 捕获错误 */
	// captureError(error: IErrorInfo): void
	// /** 设置自定义属性 */
	// setCustomProperty(key: string, value: any): void
}

/**
 * 插件接口
 */
export interface IPlugin {
	/** 插件名称 */
	name: string
	/** 插件版本 */
	version?: string
	/** 安装插件 */
	install(logger: ILogger): void
	/** 卸载插件 */
	uninstall?(): void
}

/**
 * Logger 实例接口
 */
export interface ILogger {
	/** 初始化 */
	init(config: ILoggerConfig): Promise<void>
	/** 启动 */
	start(): void
	/** 停止 */
	stop(): void
	/** 异常上报 */
	error(...error: any[]): void
	/** 上报埋点方法 */
	report(value: any): void
	/** 设置配置 */
	setConfig(config: Record<string, string>): void
	/** 获取当前 Provider */
	getProvider(): IProvider | null
	// /** 设置用户信息 */
	// setUser(user: IUserInfo): void
	// /** 追踪事件 */
	// track(event: ICustomEvent): void
	// /** 捕获错误 */
	// captureError(error: Error | IErrorInfo): void
	// /** 设置配置 */
	// setConfig(config: Partial<ILoggerConfig>): void
	// /** 注册插件 */
	// use(plugin: IPlugin): void
}
