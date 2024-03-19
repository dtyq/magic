import type { LogContext, LoggerPlugin } from "../types"
import { LogType } from "../types"
import { LogDeduplicator } from "../../LogDeduplicator"

/**
 * 去重插件配置
 */
export interface DeduplicationPluginOptions {
	/** 是否启用 */
	enabled?: boolean
	/** 去重器配置 */
	deduplicatorConfig?: {
		timeWindow?: number
		maxDuplicates?: number
		cacheSize?: number
		cleanupInterval?: number
	}
	/** 需要去重的日志级别 */
	logType?: LogType[]
}

/**
 * 日志去重插件
 * 防止相同日志被重复发送
 */
export class DeduplicationPlugin implements LoggerPlugin {
	readonly name = "deduplication"
	readonly version = "1.0.0"
	readonly priority = 30 // 在数据处理之后，上报之前执行

	enabled = true
	private deduplicator: LogDeduplicator
	private options: DeduplicationPluginOptions

	constructor(options: DeduplicationPluginOptions = {}) {
		this.options = {
			enabled: true,
			logType: [LogType.ERROR, LogType.WARN, LogType.REPORT], // 默认只对错误、警告和上报日志去重
			...options,
		}
		this.enabled = this.options.enabled ?? true

		// 初始化去重器
		this.deduplicator = LogDeduplicator.getInstance(this.options.deduplicatorConfig)
	}

	/**
	 * 检查是否应该处理此日志
	 */
	shouldHandle(context: LogContext): boolean {
		// 只处理指定级别的日志
		return this.options.logType?.includes(context.logType) ?? false
	}

	/**
	 * 处理日志上下文 - 检查是否应该去重
	 */
	process(context: LogContext): LogContext {
		// 构建用于去重检查的日志数据
		const logData = {
			namespace: context.namespace,
			logType: context.logType,
			data: context.data,
			url: context.url,
		}

		// 检查是否应该发送日志
		const shouldSend = this.deduplicator.shouldSendLog(logData)

		if (!shouldSend) {
			// 如果不应该发送，标记跳过上报
			return {
				...context,
				shouldStop: false, // 不停止处理链，允许其他插件处理
				skipReport: true, // 但跳过上报
			}
		}

		return {
			...context,
		}
	}

	/**
	 * 获取去重统计信息
	 */
	getStats() {
		return this.deduplicator.getStats()
	}

	/**
	 * 清空去重缓存
	 */
	clear(): void {
		this.deduplicator.clear()
	}

	/**
	 * 插件销毁
	 */
	destroy(): void {
		// LogDeduplicator 是单例，不需要销毁
		// 但可以清空缓存
		// this.deduplicator.clear()
	}
}

/**
 * 去重插件工厂函数
 */
export function createDeduplicationPlugin(
	options?: DeduplicationPluginOptions,
): DeduplicationPlugin {
	return new DeduplicationPlugin(options)
}
