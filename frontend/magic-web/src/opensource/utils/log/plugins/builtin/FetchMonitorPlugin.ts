import type { LogContext, LoggerPlugin } from "../types"
import type Logger from "../../Logger"
import { fetch as originFetch } from "../../helpers/fetch"
import { UrlUtils } from "@/opensource/apis/utils"

/**
 * Fetch 监控插件配置接口
 */
export interface FetchMonitorPluginOptions {
	/** 是否启用插件 */
	enabled?: boolean
	/** 慢 API 阈值，超过此时间的请求会被标记为慢请求（毫秒，默认 3000） */
	slowApiThreshold?: number
	/** 需要排除的 URL 模式列表，支持字符串和正则表达式 */
	excludeUrls?: (string | RegExp)[]
}

/**
 * API 请求信息接口
 */
interface ApiRequestInfo {
	/** 请求 URL */
	url: string
	/** 请求体 */
	body?: string
	/** 请求头 */
	headers: Record<string, string>
	/** HTTP 请求方法 */
	method: string
	/** 请求开始时间戳 */
	startTime: number
	/** 请求耗时（毫秒） */
	duration?: number
	/** HTTP 响应状态码 */
	status?: number
	/** HTTP 响应状态文本 */
	statusText?: string
	/** 请求过程中的错误信息 */
	error?: Error | string
	/** 业务请求状态码 */
	responseCode?: string
}

/**
 * Fetch API 监控插件
 *
 * 核心功能：
 * - 拦截所有 fetch 请求
 * - 检测慢请求和异常请求
 * - 通过 logger.report 上报监控数据
 * - 数据处理和脱敏交给其他插件处理
 */
export class FetchMonitorPlugin implements LoggerPlugin {
	readonly name = "fetch-monitor"
	readonly version = "1.0.0"
	readonly priority = 5 // 高优先级，确保早期拦截

	public enabled = true
	private options: Required<FetchMonitorPluginOptions>
	private logger: Logger | null = null
	private isInitialized = false

	constructor(options: FetchMonitorPluginOptions = {}) {
		// 设置默认配置
		this.options = {
			enabled: true,
			slowApiThreshold: 800, // 3秒
			excludeUrls: [
				/.*\.(js|json|css|png|jpg|jpeg|gif|svg|webp|webm|ico|woff|woff2|ttf|eot|wasm|br|gz)(\?.*)?$/, // 排除静态资源（包含 wasm）
			],
			...options,
		}

		this.enabled = this.options.enabled
	}

	/**
	 * 插件初始化 - 拦截 fetch API
	 */
	init(logger: Logger): void {
		if (this.isInitialized || typeof window === "undefined") {
			return
		}

		this.logger = logger
		this.interceptFetch()
		this.isInitialized = true
	}

	/**
	 * 检查是否应该处理此日志（本插件不处理日志，只负责拦截）
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
	 * 拦截 fetch API
	 */
	private interceptFetch(): void {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const self = this

		window.fetch = async function (
			input: RequestInfo | URL,
			init?: RequestInit,
		): Promise<Response> {
			const url = self.extractUrl(input)
			const method = init?.method || "GET"

			const fetch = originFetch.getInstance()

			// 检查是否需要监控此请求
			if (!url || !self.shouldMonitorRequest(url)) {
				return fetch.call(this, input, init)
			}

			// 请求头获取
			const headers: Record<string, any> = {}
			;(init?.headers as Headers)?.forEach?.((v, k) => {
				headers[k] = v
			})

			// 创建请求记录
			const requestInfo: ApiRequestInfo = {
				url,
				headers,
				body: typeof init?.body === "string" ? init.body : undefined,
				method: method.toUpperCase(),
				startTime: performance.now(),
			}

			try {
				// 执行原始请求
				const response = await fetch.call(this, input, init)
				// 记录成功响应
				requestInfo.duration = performance.now() - requestInfo.startTime
				requestInfo.status = response.status
				requestInfo.statusText = response.statusText

				// 检查是否为慢 api 并上报异常
				self.checkSlowApi(requestInfo)

				// 采集业务状态码非异常时
				try {
					// 检查HTTP错误状态码
					const jsonData = (await UrlUtils.responseParse(response.clone())).data
					const isBusinessError = jsonData?.code && jsonData?.code !== 1000
					const isHttpError = requestInfo.status && requestInfo.status !== 200
					if (isBusinessError || isHttpError) {
						requestInfo.responseCode = jsonData?.code
						self.reportError(requestInfo, new Error("stack trace"))
					}
				} catch (error) {
					console.error(error)
				}

				return response
			} catch (error: any) {
				// 记录错误响应
				requestInfo.duration = performance.now() - requestInfo.startTime
				// requestInfo.error = error instanceof Error ? error : String(error)

				// 上报网络错误
				self.reportError(requestInfo, error)

				throw error
			}
		}
	}

	/**
	 * 安全提取 URL
	 */
	private extractUrl(input: RequestInfo | URL): string | null {
		try {
			if (typeof input === "string") {
				return input
			} else if (input instanceof URL) {
				return input.href
			} else {
				return input.url
			}
		} catch {
			return null
		}
	}

	/**
	 * 检查是否需要监控此请求
	 */
	private shouldMonitorRequest(url: string): boolean {
		return !this.options.excludeUrls.some((pattern) => {
			if (typeof pattern === "string") {
				return url.includes(pattern)
			}
			return pattern.test(url)
		})
	}

	/**
	 * 检查请求结果并上报
	 */
	private checkSlowApi(requestInfo: ApiRequestInfo): void {
		// 检查慢请求
		if (requestInfo.duration && requestInfo.duration >= this.options.slowApiThreshold) {
			this.reportSlowApi(requestInfo)
		}

		// // 检查HTTP错误状态码
		// if (requestInfo.status && requestInfo.status !== 200) {
		// 	this.reportError(requestInfo)
		// }
	}

	/**
	 * 上报慢请求
	 */
	private reportSlowApi(requestInfo: ApiRequestInfo): void {
		if (!this.logger) return

		this.logger.report({
			namespace: "slowApi",
			data: {
				url: requestInfo.url,
				method: requestInfo.method,
				headers: requestInfo.headers,
				duration: requestInfo.duration,
				threshold: this.options.slowApiThreshold,
				status: requestInfo.status,
				statusText: requestInfo.statusText,
			},
		})
	}

	/**
	 * 上报异常请求
	 */
	private reportError(requestInfo: ApiRequestInfo, arg: any): void {
		if (!this.logger) return

		this.logger.report({
			namespace: "apiError",
			data: {
				url: requestInfo.url,
				headers: requestInfo.headers,
				method: requestInfo.method,
				duration: requestInfo.duration,
				status: requestInfo.status,
				statusText: requestInfo.statusText,
				error: requestInfo.error,
				arg,
			},
		})
	}

	/**
	 * 插件销毁
	 */
	destroy(): void {
		// 恢复原始 fetch 方法
		if (this.isInitialized && typeof window !== "undefined") {
			window.fetch = originFetch.getInstance()
		}

		this.isInitialized = false
		this.logger = null
	}
}

/**
 * Fetch 监控插件工厂函数
 *
 * 使用示例：
 * ```typescript
 * const fetchMonitor = createFetchMonitorPlugin({
 *   slowApiThreshold: 5000, // 5秒视为慢请求
 *   excludeUrls: [/analytics/, /tracking/], // 排除统计接口
 * })
 *
 * logger.plugin(fetchMonitor)
 * ```
 */
export function createFetchMonitorPlugin(options?: FetchMonitorPluginOptions): FetchMonitorPlugin {
	return new FetchMonitorPlugin(options)
}
