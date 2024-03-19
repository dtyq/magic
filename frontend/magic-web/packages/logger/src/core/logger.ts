import type { ILogger, ILoggerConfig, IProvider, ProviderType } from "./types"

/**
 * Logger 主类
 * 提供统一的日志追踪接口
 */
class Logger implements ILogger {
	private provider: IProvider | null = null
	private config: ILoggerConfig | null = null

	async init(config: ILoggerConfig): Promise<void> {
		this.config = config

		// 动态加载 Provider
		const ProviderClass = await this.loadProvider(config.provider.type)
		const provider = new ProviderClass()

		await provider.init(config.provider)
		this.provider = provider

		// 自动启动
		if (config.autoStart !== false) {
			this.start()
		}
	}

	start(): void {
		if (!this.provider) {
			throw new Error("Logger not initialized")
		}

		this.provider.start()

		if (this.config?.debug) {
			console.log("[Logger] Started successfully")
		}
	}

	stop(): void {
		if (this.provider) {
			this.provider.stop()

			if (this.config?.debug) {
				console.log("[Logger] Stopped")
			}
		}
	}

	setConfig(config: Record<string, string | null | undefined>): void {
		return this.provider?.setConfig(config)
	}

	// setConfig(config: Partial<ILoggerConfig>): void {
	// 	this.config = { ...this.config, ...config } as ILoggerConfig
	//
	// 	if (this.config?.debug) {
	// 		console.log("[Logger] Config updated:", config)
	// 	}
	// 	return this.provider?.setConfig(config)
	// }

	getProvider(): IProvider | null {
		return this.provider
	}

	error(...error: any[]) {
		return this.provider?.error(...error)
	}

	report(value: any) {
		return this.provider?.report(value)
	}

	private async loadProvider(type: ProviderType): Promise<new () => IProvider> {
		switch (type) {
			case "Volcengine":
				return (await import("../providers/volcengine")).VolcengineProvider
			case "Aliyun":
				return (await import("../providers/aliyun")).AliyunProvider
			default:
				return (await import("../providers/magic")).MagicProvider
		}
	}
}

// 单例模式
let instance: Logger | null = null

/**
 * 创建 Logger 实例
 */
export function createLogger(config: ILoggerConfig): Logger {
	if (!instance) {
		instance = new Logger()
	}
	instance.init(config)
	return instance
}

/**
 * 获取当前 Logger 实例
 */
export function getLogger(): Logger | null {
	return instance
}
