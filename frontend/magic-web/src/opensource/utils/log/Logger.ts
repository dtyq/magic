import { v4 } from "uuid"
import { userStore } from "@/opensource/models/user"
import { LoggerPluginManager, LogType } from "./plugins"
import type { LogContext, LogData, LoggerPlugin, LoggerEnableConfig } from "./plugins"
import { configStore } from "@/opensource/models/config"
import { trackLogger } from "./trackLogger"

/**
 * Logger 配置选项
 */
interface LoggerOptions extends LoggerEnableConfig {
	/** 启用配置 */
	enableConfig?: LoggerEnableConfig | boolean
	/** 自定义插件列表 */
	plugins?: LoggerPlugin[]
}

class Logger {
	private readonly traceId: string

	/** 上下文源数据 */
	private metadata: Record<string, any> = {}

	private enableConfig: LoggerEnableConfig | undefined

	// 插件系统
	private pluginManager: LoggerPluginManager

	/**
	 * 使用插件（新的推荐方式）
	 */
	plugin(plugin: LoggerPlugin): this {
		this.pluginManager.register(this, plugin)
		return this
	}

	constructor(options: LoggerOptions = {}) {
		this.traceId = sessionStorage.getItem("traceId") ?? v4()
		sessionStorage.setItem("traceId", this.traceId)

		// 处理启用配置
		const enableConfig = options.enableConfig
		this.enableConfig =
			typeof enableConfig === "boolean"
				? {
						console: enableConfig,
						warn: enableConfig,
						error: enableConfig,
						trace: enableConfig,
						report: enableConfig,
					}
				: {
						console: true,
						warn: true,
						error: true,
						trace: true,
						report: true,
						...enableConfig,
					}

		// 初始化插件系统
		this.pluginManager = new LoggerPluginManager()

		// 注册默认插件或自定义插件(优先初始化基础能力，优先上报的后初始化确保基础能力初始化后执行)
		const plugins = options.plugins || []
		plugins.reverse().forEach((plugin: LoggerPlugin) => {
			this.pluginManager.register(this, plugin)
		})
	}

	setMetadata(key: string, value: any) {
		this.metadata[key] = value
	}

	/**
	 * @description 记录普通日志
	 * @param {LogData} arg
	 * @param {LoggerEnableConfig} options
	 */
	log(arg: LogData, options?: LoggerEnableConfig): void {
		if (options?.console || this.enableConfig?.console) {
			this.processLog(LogType.INFO, arg)
		}
	}

	/**
	 * @description 警告
	 * @param {LogData} arg
	 * @param {LoggerEnableConfig} options
	 */
	warn(arg: LogData, options?: LoggerEnableConfig): void {
		if (options?.warn || this.enableConfig?.warn) {
			this.processLog(LogType.WARN, arg)
		}
	}

	/**
	 * @description 异常上报
	 * @param {LogData} arg
	 * @param {LoggerEnableConfig} options
	 */
	error(arg: LogData, options?: LoggerEnableConfig): void {
		if (options?.error || this.enableConfig?.error) {
			trackLogger?.error?.(arg)
			this.processLog(LogType.ERROR, arg)
		}
	}

	/**
	 * @description 调试跟踪
	 * @param {LogData} arg
	 * @param {LoggerEnableConfig} options
	 */
	// trace(...args: unknown[]): void {
	// 	this.processLog(LogType.TRACE, ...args)
	// }

	/**
	 * @description 调试日志
	 * @param {LogData} arg
	 * @param {LoggerEnableConfig} options
	 */
	// debug(...args: unknown[]): void {
	// 	this.processLog(LogType.DEBUG, ...args)
	// }

	/**
	 * @description 主动上报
	 * @param {LogData} arg
	 */
	report(arg: LogData): void {
		this.processLog(LogType.REPORT, arg)
	}

	/**
	 * 核心日志处理方法
	 */
	private async processLog(logType: LogType, logData: LogData): Promise<void> {
		try {
			// 构建日志上下文
			const context: LogContext = {
				logType,
				namespace: logData.namespace || "global",
				traceId: this.traceId,
				data: logData?.data,
				url: window?.location?.href,
				info: {
					uId: userStore.user?.userInfo?.magic_id,
					tOrgCode: userStore.user?.teamshareOrganizationCode ?? "",
					mOrgCode: userStore.user?.organizationCode ?? "",
					cluster: configStore.cluster.clusterCode,
				},
				timestamp: Date.now(),
				metadata: { ...this.metadata, ...(logData?.metadata || {}) },
			}

			// 使用插件系统处理
			await this.pluginManager.process(context)
		} catch (error) {
			console.error("Logger processing failed:", error)
		}
	}

	/**
	 * 获取插件管理器
	 */
	getPluginManager(): LoggerPluginManager {
		return this.pluginManager
	}

	/** 派生单个实例共享 logger 配置 */
	createLogger(namespace: string, options?: { enableConfig?: LoggerEnableConfig }) {
		return {
			log: (...args: any[]) => {
				return this.log(
					{
						namespace,
						data: [...args],
					},
					options?.enableConfig,
				)
			},
			warn: (...args: any[]) => {
				return this.warn(
					{
						namespace,
						data: [...args],
					},
					options?.enableConfig,
				)
			},
			error: (...args: any[]) => {
				return this.error(
					{
						namespace,
						data: [...args],
					},
					options?.enableConfig,
				)
			},
			report: (...args: any[]) => {
				return this.report({
					namespace,
					data: [...args],
				})
			},
		}
	}

	// /**
	//  * 获取插件统计信息
	//  */
	// getPluginStats() {
	// 	return this.pluginManager.getStats()
	// }
	//
	// /**
	//  * 启用/禁用插件
	//  */
	// setPluginEnabled(pluginName: string, enabled: boolean): void {
	// 	this.pluginManager.setEnabled(pluginName, enabled)
	// }
	//
	// /**
	//  * 获取全局去重统计信息
	//  */
	// static getGlobalDeduplicationStats() {
	// 	return LogDeduplicator.getInstance().getStats()
	// }
	//
	// /**
	//  * 清空全局日志去重缓存
	//  */
	// static clearGlobalDeduplicationCache() {
	// 	LogDeduplicator.getInstance().clear()
	// }

	/**
	 * 销毁 Logger 实例
	 */
	destroy(): void {}
}

// 导出插件相关内容
export { LogType, LoggerPluginManager } from "./plugins"
export type { LogContext, LoggerPlugin } from "./plugins"

export default Logger
