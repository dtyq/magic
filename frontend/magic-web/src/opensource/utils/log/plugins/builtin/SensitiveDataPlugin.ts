import type { LogContext, LoggerPlugin } from "../types"
import { SensitiveMasker } from "../../SensitiveMasker"

/**
 * 敏感数据脱敏插件配置
 */
export interface SensitiveDataPluginOptions {
	/** 是否启用 */
	enabled?: boolean
	/** 自定义脱敏配置 */
	maskerConfig?: Partial<typeof SensitiveMasker.config>
}

/**
 * 敏感数据脱敏插件
 * 对日志数据进行敏感信息脱敏处理
 */
export class SensitiveDataPlugin implements LoggerPlugin {
	readonly name = "sensitiveData"
	readonly version = "1.0.0"
	readonly priority = 20 // 较高优先级，在数据处理早期执行

	enabled = true
	private options: SensitiveDataPluginOptions

	constructor(options: SensitiveDataPluginOptions = {}) {
		this.options = { enabled: true, ...options }
		this.enabled = this.options.enabled ?? true

		// 应用自定义脱敏配置
		if (this.options.maskerConfig) {
			Object.assign(SensitiveMasker.config, this.options.maskerConfig)
		}
	}

	/**
	 * 检查是否应该处理此日志
	 */
	shouldHandle(_context: LogContext): boolean {
		// 所有级别的日志都需要脱敏处理
		return true
	}

	/**
	 * 处理日志上下文 - 对数据进行脱敏
	 */
	process(context: LogContext): LogContext {
		// 处理原始参数
		const sanitizedArgs = SensitiveMasker.sanitize(context.data)

		// 处理URL
		const sanitizedUrl = context.url ? SensitiveMasker.sanitize(context.url) : context.url

		// 处理用户信息中的敏感数据
		// let sanitizedInfo = context.info
		// if (context.info) {
		// 	sanitizedInfo = {
		// 		uId: context.info.uId,
		// 		tOrgCode: context.info.tOrgCode,
		// 		mOrgCode: context.info.mOrgCode,
		// 	}
		// }

		return {
			...context,
			data: sanitizedArgs, // 同时更新处理后的数据
			url: sanitizedUrl,
			// info: sanitizedInfo,
			// metadata: {
			// 	...context.metadata,
			// 	sensitiveDataProcessed: true,
			// 	processedAt: Date.now(),
			// },
		}
	}

	/**
	 * 更新脱敏配置
	 */
	updateConfig(config: Partial<typeof SensitiveMasker.config>): void {
		Object.assign(SensitiveMasker.config, config)
	}

	/**
	 * 获取当前脱敏配置
	 */
	getConfig() {
		return { ...SensitiveMasker.config }
	}
}

/**
 * 敏感数据插件工厂函数
 */
export function createSensitiveDataPlugin(
	options?: SensitiveDataPluginOptions,
): SensitiveDataPlugin {
	return new SensitiveDataPlugin(options)
}
