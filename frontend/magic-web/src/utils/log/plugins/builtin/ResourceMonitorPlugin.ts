import type { LogContext, LoggerPlugin } from "../types"
import type Logger from "../../Logger"

/**
 * 资源加载监控配置
 */
export interface ResourceMonitorPluginOptions {
	/** 是否启用 */
	enabled?: boolean
	/** 慢资源加载阈值（毫秒） */
	threshold?: number
	/** 需要排除的URL模式 */
	excludeUrls?: (string | RegExp)[]
	/** 需要排除的资源类型 */
	excludeResourceTypes?: string[]
	/** 采样率 (0-1)，1表示100%采样，0.1表示10%采样 */
	sampleRate?: number
}

/**
 * 静态资源加载监控插件
 * 监控资源加载异常和慢资源，通过 logger.report 上报
 */
export class ResourceMonitorPlugin implements LoggerPlugin {
	readonly name = "resource-loading-monitor"
	readonly version = "1.0.0"
	readonly priority = 8

	public enabled = true
	private options: Required<ResourceMonitorPluginOptions>
	private logger: Logger | null = null
	private observer: PerformanceObserver | null = null

	constructor(options: ResourceMonitorPluginOptions = {}) {
		this.options = {
			enabled: true,
			threshold: 500, // 500ms
			sampleRate: 0.1, // 默认10%采样
			excludeUrls: [
				/data:/,
				/blob:/,
				/chrome-extension:/, // 排除特殊协议
				// /.*\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)(\?.*)?$/, // 排除静态资源
			],
			excludeResourceTypes: [
				// 默认排除 API 请求，只监控静态资源
				"fetch",
				"xmlhttprequest",
				"beacon",
			],
			...options,
		}

		this.enabled = this.options.enabled
	}

	/**
	 * 插件初始化 - 开始监控资源加载
	 */
	init(logger: Logger): void {
		if (!this.enabled || typeof window === "undefined" || !window.PerformanceObserver) {
			return
		}

		// 防止重复初始化导致内存泄露
		if (this.observer) {
			this.observer.disconnect()
			this.observer = null
		}

		this.logger = logger
		this.startMonitoring()
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
	 * 开始监控资源加载
	 */
	private startMonitoring(): void {
		try {
			this.observer = new PerformanceObserver((list) => {
				try {
					this.processEntries(list.getEntries())
				} catch (error) {
					// 防止处理错误导致整个监控失败
					console.error("[ResourceMonitorPlugin] Error processing entries:", error)
				}
			})

			this.observer.observe({ entryTypes: ["resource"] })
		} catch (error) {
			console.error("[ResourceMonitorPlugin] Failed to start monitoring:", error)
			this.observer = null
		}
	}

	/**
	 * 处理性能条目
	 */
	private processEntries(entries: PerformanceEntry[]): void {
		// 边界条件检查
		if (!entries || !Array.isArray(entries) || entries.length === 0) {
			return
		}

		for (const entry of entries) {
			try {
				// 类型检查
				if (!(entry instanceof PerformanceResourceTiming)) continue

				const url = entry.name
				// 防止无效的时间值导致 NaN
				const duration = Math.max(0, (entry.responseEnd || 0) - (entry.startTime || 0))

				// URL 有效性检查
				if (!url || typeof url !== "string") continue

				// 检查是否需要监控此资源（URL 和资源类型过滤）
				if (!this.shouldMonitorResource(url, entry.initiatorType || "unknown")) continue

				// 采样率检查 - 根据采样率决定是否处理此条目
				if (!this.shouldSample()) continue

				// 检查加载异常（加载失败）
				// 注意：responseStart 和 responseEnd 为 0 可能表示：
				// 1. 缓存资源（正常情况）
				// 2. 跨域资源的时间信息被限制（正常情况）
				// 3. 真正的加载失败
				// 更准确的失败判断：duration 为 0 且 transferSize 为 0 且 decodedBodySize 为 0
				if (this.isResourceLoadFailed(entry)) {
					this.reportResourceError(entry)
					continue
				}

				// 检查慢资源 - 添加有效性检查
				if (duration >= this.options.threshold && isFinite(duration)) {
					this.reportSlowResource(entry, duration)
				}
			} catch (error) {
				// 单个条目处理失败不应影响其他条目
				console.error("[ResourceMonitorPlugin] Error processing entry:", error, entry)
			}
		}
	}

	/**
	 * 检查是否需要监控此资源
	 */
	private shouldMonitorResource(url: string, resourceType: string): boolean {
		try {
			// 参数有效性检查
			if (!url || !resourceType) return false

			// 检查是否排除该资源类型
			if (this.options.excludeResourceTypes.includes(resourceType)) {
				return false
			}

			// 检查是否排除该 URL
			return !this.options.excludeUrls.some((pattern) => {
				try {
					if (typeof pattern === "string") {
						return url.includes(pattern)
					}
					// 重置 RegExp 的 lastIndex 防止全局匹配的状态问题
					if (pattern.global) {
						pattern.lastIndex = 0
					}
					return pattern.test(url)
				} catch (error) {
					// 正则表达式错误不应阻止监控
					console.error("[ResourceMonitorPlugin] Pattern matching error:", error, pattern)
					return false
				}
			})
		} catch (error) {
			console.error("[ResourceMonitorPlugin] Error in shouldMonitorResource:", error)
			return false
		}
	}

	/**
	 * 采样率检查 - 根据设置的采样率决定是否处理当前条目
	 */
	private shouldSample(): boolean {
		const sampleRate = this.options.sampleRate

		// 边界值检查和数值有效性验证
		if (!isFinite(sampleRate) || sampleRate >= 1) return true
		if (sampleRate <= 0) return false

		return Math.random() < sampleRate
	}

	/**
	 * 判断资源是否从缓存加载
	 */
	private isFromCache(entry: PerformanceResourceTiming): boolean {
		if (!entry) return false

		const transferSize = entry.transferSize || 0
		const decodedBodySize = entry.decodedBodySize || 0

		return transferSize === 0 && decodedBodySize > 0
	}

	/**
	 * 判断资源是否真正加载失败
	 * 更准确的失败判断逻辑，避免将缓存资源误判为失败
	 */
	private isResourceLoadFailed(entry: PerformanceResourceTiming): boolean {
		if (!entry) return false

		try {
			const responseEnd = entry.responseEnd || 0
			const responseStart = entry.responseStart || 0
			const transferSize = entry.transferSize || 0
			const decodedBodySize = entry.decodedBodySize || 0

			// 如果有响应时间信息，说明资源加载成功
			if (responseEnd > 0 && responseStart > 0) {
				return false
			}

			// 检查是否为缓存资源
			// transferSize 为 0 且 decodedBodySize > 0 表示从缓存加载
			if (this.isFromCache(entry)) {
				return false
			}

			// 真正的失败：没有响应时间，没有传输大小，没有解码大小
			const hasNoResponse = responseEnd === 0 && responseStart === 0
			const hasNoContent = transferSize === 0 && decodedBodySize === 0

			return hasNoResponse && hasNoContent
		} catch (error) {
			console.error("[ResourceMonitorPlugin] Error checking resource failure:", error)
			return false
		}
	}

	/**
	 * 上报资源加载错误
	 */
	private reportResourceError(entry: PerformanceResourceTiming): void {
		if (!this.logger || !entry) return

		try {
			const duration = Math.max(0, (entry.responseEnd || 0) - (entry.startTime || 0))

			this.logger.report({
				namespace: "resourceError",
				data: {
					url: entry.name || "unknown",
					resourceType: entry.initiatorType || "unknown",
					duration: isFinite(duration) ? duration : 0,
				},
			})
		} catch (error) {
			console.error("[ResourceMonitorPlugin] Error reporting resource error:", error)
		}
	}

	/**
	 * 上报慢资源
	 */
	private reportSlowResource(entry: PerformanceResourceTiming, duration: number): void {
		if (!this.logger || !entry) return

		try {
			const size = entry.decodedBodySize || 0

			this.logger.report({
				namespace: "slowResource",
				data: {
					url: entry.name || "unknown",
					resourceType: entry.initiatorType || "unknown",
					duration: isFinite(duration) ? duration : 0,
					threshold: this.options.threshold,
					size: size > 0 ? size : undefined,
					fromCache: this.isFromCache(entry),
				},
			})
		} catch (error) {
			console.error("[ResourceMonitorPlugin] Error reporting slow resource:", error)
		}
	}

	/**
	 * 插件销毁
	 */
	destroy(): void {
		this.observer?.disconnect()
		this.observer = null
		this.logger = null
	}
}

/**
 * 创建资源加载监控插件的工厂函数
 *
 * 使用示例：
 * ```typescript
 * // 默认配置：排除 API 请求，只监控静态资源
 * const resourceMonitor = createResourceMonitorPlugin()
 *
 * // 自定义配置
 * const customResourceMonitor = createResourceMonitorPlugin({
 *   threshold: 1000, // 1秒视为慢资源
 *   excludeUrls: [/analytics/, /tracking/], // 排除统计资源
 *   excludeResourceTypes: ["fetch", "xmlhttprequest"], // 排除 API 请求
 *   sampleRate: 0.1, // 10%采样率，减少日志量
 * })
 *
 * // 只监控 API 请求，排除静态资源
 * const apiOnlyMonitor = createResourceMonitorPlugin({
 *   excludeResourceTypes: ["img", "script", "link", "css"], // 只监控 API
 * })
 *
 * logger.plugin(resourceMonitor)
 * ```
 */
export function createResourceMonitorPlugin(
	options?: ResourceMonitorPluginOptions,
): ResourceMonitorPlugin {
	return new ResourceMonitorPlugin(options)
}
