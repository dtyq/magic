import type { IPlugin, ILogger } from "../core/types"

/**
 * 插件基类
 * 所有插件都需要继承此类并实现抽象方法
 */
export abstract class BasePlugin implements IPlugin {
	abstract name: string
	version?: string

	protected logger: ILogger | null = null

	install(logger: ILogger): void {
		this.logger = logger
		this.onInstall()
	}

	uninstall(): void {
		this.onUninstall()
		this.logger = null
	}

	protected abstract onInstall(): void
	protected abstract onUninstall(): void
}
