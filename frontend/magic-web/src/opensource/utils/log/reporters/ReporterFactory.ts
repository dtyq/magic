import type { ILogReporter, LogReporterConfig } from "./ILogReporter"
import { FetchLogReporter } from "./FetchLogReporter"
import { BeaconLogReporter } from "./BeaconLogReporter"
import { XhrLogReporter } from "./XhrLogReporter"
import { LogQueue, type LogQueueConfig } from "./LogQueue"

/**
 * 支持的上报器类型
 */
export type ReporterType = "fetch" | "beacon" | "xhr"

/**
 * 上报器工厂配置
 */
interface ReporterFactoryConfig {
	/**
	 * 优先级顺序，工厂会按此顺序尝试创建可用的上报器
	 */
	priority?: ReporterType[]

	/**
	 * 各个上报器的具体配置
	 */
	configs?: {
		fetch?: LogReporterConfig
		beacon?: LogReporterConfig
		xhr?: LogReporterConfig
	}

	/**
	 * 是否启用自动回退
	 * 当首选上报器不可用时，自动使用备选方案
	 */
	enableFallback?: boolean

	/**
	 * 队列配置（可选）
	 * 如果提供，将自动包装上报器为带队列的版本
	 */
	queueConfig?: LogQueueConfig
}

/**
 * 日志上报器工厂
 * 负责创建和管理不同类型的日志上报器
 */
class ReporterFactory {
	private static defaultPriority: ReporterType[] = ["fetch", "beacon", "xhr"]
	private static reporterClasses = {
		fetch: FetchLogReporter,
		beacon: BeaconLogReporter,
		xhr: XhrLogReporter,
	}

	/**
	 * 创建指定类型的上报器
	 */
	static create(type: ReporterType, config: LogReporterConfig = {}): ILogReporter | null {
		const ReporterClass = this.reporterClasses[type]
		if (!ReporterClass) {
			console.error(`Unknown reporter type: ${type}`)
			return null
		}

		try {
			const reporter = new ReporterClass(config)
			if (!reporter.isAvailable()) {
				console.warn(`Reporter ${type} is not available`)
				return null
			}
			return reporter
		} catch (error) {
			console.error(`Failed to create ${type} reporter:`, error)
			return null
		}
	}

	/**
	 * 创建最佳可用的上报器
	 * 根据优先级和可用性自动选择
	 */
	static createBest(config: ReporterFactoryConfig = {}): ILogReporter | LogQueue | null {
		const {
			priority = this.defaultPriority,
			configs = {},
			enableFallback = true,
			queueConfig,
		} = config

		// 按优先级尝试创建上报器
		for (const type of priority) {
			const reporterConfig = configs[type] || {}
			const reporter = this.create(type, reporterConfig)

			if (reporter) {
				console.log(`Using ${type} reporter for logging`)

				// 如果提供了队列配置，包装为队列版本
				if (queueConfig) {
					return new LogQueue(reporter, queueConfig)
				}

				return reporter
			}

			if (!enableFallback) {
				break
			}
		}

		console.error("No available log reporter found")
		return null
	}

	/**
	 * 创建多个上报器实例
	 * 用于同时使用多种上报方式
	 */
	static createMultiple(
		types: ReporterType[],
		configs: Record<ReporterType, LogReporterConfig> = {} as any,
	): ILogReporter[] {
		const reporters: ILogReporter[] = []

		for (const type of types) {
			const config = configs[type] || {}
			const reporter = this.create(type, config)

			if (reporter) {
				reporters.push(reporter)
			}
		}

		return reporters
	}

	/**
	 * 检查指定类型的上报器是否可用
	 */
	static isAvailable(type: ReporterType): boolean {
		const ReporterClass = this.reporterClasses[type]
		if (!ReporterClass) {
			return false
		}

		try {
			// 创建临时实例检查可用性
			const tempReporter = new ReporterClass({ enabled: false })
			const available = tempReporter.isAvailable()
			tempReporter.destroy?.()
			return available
		} catch (error) {
			return false
		}
	}

	/**
	 * 获取所有可用的上报器类型
	 */
	static getAvailableTypes(): ReporterType[] {
		return Object.keys(this.reporterClasses).filter((type) =>
			this.isAvailable(type as ReporterType),
		) as ReporterType[]
	}

	/**
	 * 获取推荐的上报器类型
	 * 根据当前环境特性返回最适合的上报器
	 */
	static getRecommendedType(): ReporterType | null {
		// 检查是否支持 Fetch API（现代浏览器）
		if (this.isAvailable("fetch")) {
			return "fetch"
		}

		// 检查是否支持 sendBeacon（适合页面卸载场景）
		if (this.isAvailable("beacon")) {
			return "beacon"
		}

		// 回退到 XMLHttpRequest（兼容性最好）
		if (this.isAvailable("xhr")) {
			return "xhr"
		}

		return null
	}

	/**
	 * 创建推荐的上报器实例
	 */
	static createRecommended(
		config: LogReporterConfig = {},
		queueConfig?: LogQueueConfig,
	): ILogReporter | LogQueue | null {
		const recommendedType = this.getRecommendedType()
		if (!recommendedType) {
			return null
		}

		const reporter = this.create(recommendedType, config)
		if (!reporter) {
			return null
		}

		// 如果提供了队列配置，包装为队列版本
		if (queueConfig) {
			return new LogQueue(reporter, queueConfig)
		}

		return reporter
	}

	/**
	 * 创建带队列的上报器
	 */
	static createWithQueue(
		type: ReporterType,
		reporterConfig: LogReporterConfig = {},
		queueConfig: LogQueueConfig = {},
	): LogQueue | null {
		const reporter = this.create(type, reporterConfig)
		if (!reporter) {
			return null
		}

		return new LogQueue(reporter, queueConfig)
	}
}

export { ReporterFactory, type ReporterFactoryConfig }
