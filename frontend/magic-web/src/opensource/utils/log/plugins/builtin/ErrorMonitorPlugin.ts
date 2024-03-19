import type { LogContext, LoggerPlugin } from "../types"
import type Logger from "../../Logger"

/**
 * 异步错误监控插件配置接口
 */
export interface ErrorMonitorPluginOptions {
	/** 是否启用插件 */
	enabled?: boolean
	/** 是否监控未捕获的 Promise 异常 */
	monitorUnhandledRejection?: boolean
	/** 是否监控全局 JavaScript 错误 */
	monitorGlobalError?: boolean
	/** 需要排除的错误模式列表，支持字符串和正则表达式 */
	excludeErrors?: (string | RegExp)[]
	/** 错误上报频率限制（毫秒，避免错误风暴） */
	throttleInterval?: number
}

/**
 * 错误信息接口
 */
interface ErrorInfo {
	/** 错误类型 */
	type: "unhandledRejection" | "globalError"
	/** 错误消息 */
	message: string
	/** 错误堆栈 */
	stack?: string
	/** 文件名 */
	filename?: string
	/** 行号 */
	lineno?: number
	/** 列号 */
	colno?: number
	/** 错误对象 */
	error?: Error
	/** Promise rejection 原因 */
	reason?: any
	/** 时间戳 */
	timestamp: number
}

/**
 * 异步错误监控插件
 *
 * 核心功能：
 * - 监控全局未捕获的 Promise 异常 (unhandledrejection)
 * - 监控全局 JavaScript 错误 (error)
 * - 通过 logger.report 上报错误信息
 * - 数据脱敏和格式处理交给其他插件处理
 * - 支持错误过滤和频率限制
 */
export class ErrorMonitorPlugin implements LoggerPlugin {
	readonly name = "async-error-monitor"
	readonly version = "1.0.0"
	readonly priority = 1 // 最高优先级，确保第一时间捕获错误

	public enabled = true
	private options: Required<ErrorMonitorPluginOptions>
	private logger: Logger | null = null
	private isInitialized = false
	private lastReportTime = new Map<string, number>()

	constructor(options: ErrorMonitorPluginOptions = {}) {
		// 设置默认配置
		this.options = {
			enabled: true,
			monitorUnhandledRejection: true,
			monitorGlobalError: true,
			excludeErrors: [
				// /Script error/i, // 跨域脚本错误
				// /Non-Error promise rejection captured/i, // 非错误类型的 Promise 拒绝
				// /ResizeObserver loop limit exceeded/i, // 常见的 ResizeObserver 错误
			],
			throttleInterval: 10000, // 10秒内相同错误只上报一次
			...options,
		}

		this.enabled = this.options.enabled
	}

	/**
	 * 插件初始化 - 注册全局错误监听器
	 */
	init(logger: Logger): void {
		if (this.isInitialized || typeof window === "undefined") {
			return
		}

		this.logger = logger
		this.setupGlobalErrorHandlers()
		this.isInitialized = true
	}

	/**
	 * 检查是否应该处理此日志（本插件不处理日志，只负责监控）
	 */
	shouldHandle(): boolean {
		return false
	}

	/**
	 * 处理日志上下文（本插件不处理日志）
	 */
	process(context: LogContext): LogContext {
		return context
	}

	/**
	 * 设置全局错误处理器
	 */
	private setupGlobalErrorHandlers(): void {
		// 监控未捕获的 Promise 异常
		if (this.options.monitorUnhandledRejection) {
			window.addEventListener("unhandledrejection", this.handleUnhandledRejection.bind(this))
		}

		// 监控全局 JavaScript 错误
		if (this.options.monitorGlobalError) {
			window.addEventListener("error", this.handleGlobalError.bind(this))
		}
	}

	/**
	 * 处理未捕获的 Promise 异常
	 */
	private handleUnhandledRejection(event: PromiseRejectionEvent): void {
		const errorInfo: ErrorInfo = {
			type: "unhandledRejection",
			message: this.extractMessage(event.reason),
			stack: this.extractStack(event.reason),
			timestamp: Date.now(),
		}

		if (this.shouldReportError(errorInfo)) {
			// event.reason 为 reject 内容，一般为 Error 对象，需要通过额外的插件做统一的格式解析
			this.logger?.report({
				namespace: "unhandledRejection",
				data: {
					errorInfo,
					reason: event.reason,
				},
			})
		}
	}

	/**
	 * 处理全局 JavaScript 错误
	 */
	private handleGlobalError(event: ErrorEvent): void {
		const errorInfo: ErrorInfo = {
			type: "globalError",
			message: event.message,
			stack: event.error?.stack,
			filename: event.filename,
			lineno: event.lineno,
			colno: event.colno,
			error: event.error,
			timestamp: Date.now(),
		}

		if (this.shouldReportError(errorInfo)) {
			this.logger?.report({ namespace: "globalError", data: { error: event.error } })
		}
	}

	/**
	 * 从错误原因中提取消息
	 */
	private extractMessage(reason: any): string {
		if (reason instanceof Error) {
			return reason.message
		}
		if (typeof reason === "string") {
			return reason
		}
		if (reason && typeof reason.toString === "function") {
			return reason.toString()
		}
		return "Unknown error"
	}

	/**
	 * 从错误原因中提取堆栈信息
	 */
	private extractStack(reason: any): string | undefined {
		if (reason instanceof Error) {
			return reason.stack
		}
		if (reason && typeof reason.stack === "string") {
			return reason.stack
		}
		return undefined
	}

	/**
	 * 检查是否应该上报此错误
	 */
	private shouldReportError(errorInfo: ErrorInfo): boolean {
		// 检查错误是否在排除列表中
		const shouldExclude = this.options.excludeErrors.some((pattern) => {
			if (typeof pattern === "string") {
				return errorInfo.message.includes(pattern)
			}
			return pattern.test(errorInfo.message)
		})

		if (shouldExclude) {
			return false
		}

		// 检查频率限制
		const errorKey = `${errorInfo.type}:${errorInfo.message}`
		const lastReportTime = this.lastReportTime.get(errorKey) || 0
		const now = Date.now()

		if (now - lastReportTime < this.options.throttleInterval) {
			return false
		}

		this.lastReportTime.set(errorKey, now)
		return true
	}

	/**
	 * 插件销毁
	 */
	destroy(): void {
		if (this.isInitialized && typeof window !== "undefined") {
			// 移除事件监听器
			if (this.options.monitorUnhandledRejection) {
				window.removeEventListener(
					"unhandledrejection",
					this.handleUnhandledRejection.bind(this),
				)
			}
			if (this.options.monitorGlobalError) {
				window.removeEventListener("error", this.handleGlobalError.bind(this))
			}
		}

		this.isInitialized = false
		this.logger = null
		this.lastReportTime.clear()
	}
}

/**
 * 异步错误监控插件工厂函数
 *
 * 使用示例：
 * ```typescript
 * const asyncErrorMonitor = createErrorMonitorPlugin({
 *   throttleInterval: 2000, // 2秒内相同错误只上报一次
 *   excludeErrors: [/Script error/, /ResizeObserver/], // 排除特定错误
 *   monitorUnhandledRejection: true, // 监控未捕获的 Promise 异常
 *   monitorGlobalError: true, // 监控全局 JavaScript 错误
 * })
 *
 * logger.plugin(asyncErrorMonitor)
 * ```
 */
export function createErrorMonitorPlugin(options?: ErrorMonitorPluginOptions): ErrorMonitorPlugin {
	return new ErrorMonitorPlugin(options)
}
