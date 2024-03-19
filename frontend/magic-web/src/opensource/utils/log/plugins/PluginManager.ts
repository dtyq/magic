import type { LogContext, LoggerPlugin, PluginManager, PluginOptions } from "./types"
import type Logger from "../Logger"

/**
 * 轻量级插件管理器
 * 负责插件的注册、管理和执行
 */
export class LoggerPluginManager implements PluginManager {
	private plugins = new Map<string, { plugin: LoggerPlugin; options: PluginOptions }>()
	private sortedPlugins: LoggerPlugin[] = []
	private needsSort = false

	/**
	 * 注册插件
	 */
	register(logger: Logger, plugin: LoggerPlugin, options: PluginOptions = {}): void {
		if (this.plugins.has(plugin.name)) {
			console.warn(`Plugin ${plugin.name} is already registered, replacing...`)
		}

		// 合并插件选项
		const finalOptions: PluginOptions = {
			enabled: true,
			priority: plugin.priority || 100,
			...options,
		}

		// 更新插件状态
		plugin.enabled = finalOptions.enabled ?? true

		this.plugins.set(plugin.name, { plugin, options: finalOptions })
		this.needsSort = true

		// 初始化插件
		if (plugin.init && plugin.enabled) {
			try {
				plugin.init(logger, this)
				// if (result instanceof Promise) {
				// 	result.catch((error) => {
				// 		console.error(`Failed to initialize plugin ${plugin.name}:`, error)
				// 		plugin.enabled = false
				// 	})
				// }
			} catch (error) {
				console.error(`Failed to initialize plugin ${plugin.name}:`, error)
				plugin.enabled = false
			}
		}
	}

	/**
	 * 注销插件
	 */
	unregister(pluginName: string): void {
		const entry = this.plugins.get(pluginName)
		if (entry) {
			const { plugin } = entry

			// 销毁插件
			if (plugin.destroy) {
				try {
					const result = plugin.destroy()
					if (result instanceof Promise) {
						result.catch((error) => {
							console.error(`Failed to destroy plugin ${pluginName}:`, error)
						})
					}
				} catch (error) {
					console.error(`Failed to destroy plugin ${pluginName}:`, error)
				}
			}

			this.plugins.delete(pluginName)
			this.needsSort = true
		}
	}

	/**
	 * 获取插件
	 */
	get(pluginName: string): LoggerPlugin | undefined {
		return this.plugins.get(pluginName)?.plugin
	}

	/**
	 * 获取所有插件
	 */
	getAll(): LoggerPlugin[] {
		return Array.from(this.plugins.values()).map((entry) => entry.plugin)
	}

	/**
	 * 清除所有插件
	 */
	clear(): void {
		// 销毁所有插件
		for (const [name] of this.plugins) {
			this.unregister(name)
		}
	}

	/**
	 * 启用/禁用插件
	 */
	setEnabled(pluginName: string, enabled: boolean): void {
		const entry = this.plugins.get(pluginName)
		if (entry) {
			entry.plugin.enabled = enabled
			entry.options.enabled = enabled
		}
	}

	/**
	 * 获取已启用的插件列表（按优先级排序）
	 */
	private getSortedPlugins(): LoggerPlugin[] {
		if (this.needsSort) {
			this.sortedPlugins = Array.from(this.plugins.values())
				.filter((entry) => entry.plugin.enabled)
				.sort((a, b) => (a.options.priority || 100) - (b.options.priority || 100))
				.map((entry) => entry.plugin)
			this.needsSort = false
		}
		return this.sortedPlugins
	}

	/**
	 * 处理日志上下文
	 */
	async process(context: LogContext): Promise<LogContext> {
		const plugins = this.getSortedPlugins()
		let currentContext = { ...context }

		// 性能优化：预过滤插件
		const applicablePlugins = plugins.filter(
			(plugin) => !plugin.shouldHandle || plugin.shouldHandle(currentContext),
		)

		// 如果没有适用的插件，直接返回
		if (applicablePlugins.length === 0) {
			return currentContext
		}

		for (const plugin of applicablePlugins) {
			try {
				const result = plugin.process(currentContext)

				// 处理异步插件
				if (result instanceof Promise) {
					currentContext = await result
				} else {
					currentContext = result
				}

				// 如果插件要求停止处理链
				if (currentContext.shouldStop) {
					break
				}
			} catch (error) {
				console.error(`Plugin ${plugin.name} failed to process log:`, error)

				// 插件错误不应该中断整个日志流程
				// 可以根据需要添加错误处理策略
				continue
			}
		}

		return currentContext
	}

	/**
	 * 获取插件统计信息
	 */
	getStats() {
		const total = this.plugins.size
		const enabled = Array.from(this.plugins.values()).filter(
			(entry) => entry.plugin.enabled,
		).length
		const disabled = total - enabled

		return {
			total,
			enabled,
			disabled,
			plugins: Array.from(this.plugins.entries()).map(([name, { plugin, options }]) => ({
				name,
				enabled: plugin.enabled,
				priority: options.priority,
				version: plugin.version,
			})),
		}
	}

	/**
	 * 检查是否有指定类型的插件
	 */
	hasPlugin(pluginName: string): boolean {
		return this.plugins.has(pluginName)
	}

	/**
	 * 获取插件数量
	 */
	size(): number {
		return this.plugins.size
	}
}
