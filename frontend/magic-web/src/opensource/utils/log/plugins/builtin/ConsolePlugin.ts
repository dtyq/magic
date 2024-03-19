import type { LogContext, LoggerPlugin } from "../types"
import { LogType } from "../types"
import { isDev, isProductionEnv } from "../../../env"
import { isDebug } from "../../../debug"

/**
 * 控制台插件配置
 */
export interface ConsolePluginOptions {
	/** 是否启用 */
	enabled?: boolean
	/** 控制台输出配置 */
	console?: {
		/** 启用的日志级别 */
		logType?: LogType[]
		/** 是否在生产环境输出 */
		enableInProduction?: boolean
		/** 是否显示调试信息时才输出 */
		onlyWhenDebug?: boolean
		/** 自定义颜色配置 */
		colors?: Partial<Record<LogType, string>>
		/** 是否显示堆栈跟踪 */
		showTrace?: boolean
		/** 是否使用分组显示 */
		useGrouping?: boolean
	}
}

/**
 * 控制台输出插件
 * 负责将日志输出到浏览器控制台
 */
export class ConsolePlugin implements LoggerPlugin {
	readonly name = "console"
	readonly version = "1.0.0"
	readonly priority = 90 // 较低优先级，在数据处理完成后执行

	public enabled = true
	private readonly options: ConsolePluginOptions

	// 默认颜色配置
	private readonly defaultColors: Record<LogType, string> = {
		[LogType.DEBUG]: "gray",
		[LogType.INFO]: "green",
		[LogType.WARN]: "orange",
		[LogType.ERROR]: "red",
		[LogType.TRACE]: "blue",
		[LogType.REPORT]: "rgb(159,67,237)",
	}

	constructor(options: ConsolePluginOptions = {}) {
		this.options = {
			enabled: true,
			console: {
				logType: [
					LogType.DEBUG,
					LogType.INFO,
					LogType.WARN,
					LogType.ERROR,
					LogType.TRACE,
					LogType.REPORT,
				],
				enableInProduction: false,
				onlyWhenDebug: true,
				colors: {},
				showTrace: true,
				useGrouping: true,
				...options.console,
			},
			...options,
		}
		this.enabled = !!options.enabled
	}

	/**
	 * 检查是否应该处理此日志
	 */
	shouldHandle(context: LogContext): boolean {
		const consoleConfig = this.options.console!

		// 检查是否跳过控制台输出
		if (context.skipConsole) {
			return false
		}

		// 检查日志级别
		if (!consoleConfig.logType?.includes(context.logType)) {
			return false
		}

		// 检查生产环境设置
		if (isProductionEnv() && !consoleConfig.enableInProduction && !isDebug()) {
			return false
		}

		// 检查调试模式设置
		if (consoleConfig.onlyWhenDebug && !isDebug() && isProductionEnv()) {
			return false
		}

		return true
	}

	/**
	 * 处理日志上下文 - 输出到控制台
	 */
	process(context: LogContext): LogContext {
		const consoleConfig = this.options.console!
		try {
			this.outputToConsole(context, consoleConfig)
		} catch (error) {
			// 控制台输出失败不应该影响日志处理流程
			console.error("Console plugin failed:", error)
		}

		return context
	}

	/**
	 * 输出日志到控制台
	 */
	private outputToConsole(
		context: LogContext,
		config: NonNullable<ConsolePluginOptions["console"]>,
	) {
		// if (this.options.enabled) {
		// 	const { logType, namespace, data } = context
		// 	const colors = { ...this.defaultColors, ...config.colors }
		// 	const color = colors[logType]
		// 	const outputArgs = data
		//
		// 	// 构建日志标签
		// 	const label = `[${namespace}${logType !== LogType.INFO ? ` ${logType}` : ""}]`
		// 	const style = `color: white; background: ${color};`
		//
		// 	if (config.useGrouping) {
		// 		/** keep-console */
		// 		console.groupCollapsed(`%c ${label} `, style, context)
		//
		// 		if (config.showTrace) {
		// 			/** keep-console */
		// 			console.trace("trace")
		// 		}
		//
		// 		// 显示元数据（开发模式下）
		// 		if (isDev && context.metadata && Object.keys(context.metadata).length > 0) {
		// 			/** keep-console */
		// 			console.log("Metadata:", context.metadata)
		// 		}
		// 		/** keep-console */
		// 		console.log("logs:", context)
		//
		// 		/** keep-console */
		// 		console.groupEnd()
		// 	} else {
		// 		/** keep-console */
		// 		console.log(`%c ${label} `, style, ...outputArgs)
		//
		// 		if (config.showTrace) {
		// 			/** keep-console */
		// 			console.trace("trace")
		// 		}
		// 	}
		// }
	}

	/**
	 * 更新控制台配置
	 */
	updateConfig(config: Partial<NonNullable<ConsolePluginOptions["console"]>>): void {
		this.options.console = { ...this.options.console, ...config }
	}

	/**
	 * 获取当前配置
	 */
	getConfig() {
		return { ...this.options }
	}
}

/**
 * 控制台插件工厂函数
 */
export function createConsolePlugin(options?: ConsolePluginOptions): ConsolePlugin {
	return new ConsolePlugin(options)
}
