import type { IProvider, IProviderConfig } from "./types"

/**
 * Provider 基类
 * 所有平台提供者都需要继承此类并实现抽象方法
 */
export abstract class BaseProvider implements IProvider {
	protected config: IProviderConfig | null = null
	protected isInitialized = false
	protected isStarted = false

	abstract init(config: IProviderConfig): Promise<void>

	abstract start(): void

	abstract stop(): void

	abstract setConfig(config: Record<string, string | null | undefined>): void
	
	abstract error(error: any): void

	abstract report(value: any): void

	// protected abstract trackEvent(event: ICustomEvent): void
	// protected abstract trackError(error: IErrorInfo): void
	// protected abstract updateUser(user: IUserInfo): void
	// protected abstract setProperty(key: string, value: any): void
	//
	// setUser(user: IUserInfo): void {
	// 	if (!this.isInitialized) {
	// 		console.warn("[Provider] Provider not initialized")
	// 		return
	// 	}
	// 	this.updateUser(user)
	// }
	//
	// track(event: ICustomEvent): void {
	// 	if (!this.isStarted) {
	// 		console.warn("[Provider] Provider not started")
	// 		return
	// 	}
	//
	// 	// 添加时间戳
	// 	if (!event.timestamp) {
	// 		event.timestamp = Date.now()
	// 	}
	//
	// 	this.trackEvent(event)
	// }
	//
	// captureError(error: IErrorInfo): void {
	// 	if (!this.isStarted) {
	// 		console.warn("[Provider] Provider not started")
	// 		return
	// 	}
	//
	// 	this.trackError(error)
	// }
	//
	// setCustomProperty(key: string, value: any): void {
	// 	if (!this.isInitialized) {
	// 		console.warn("[Provider] Provider not initialized")
	// 		return
	// 	}
	//
	// 	this.setProperty(key, value)
	// }

	protected validateConfig(config: IProviderConfig): void {
		if (!config.appId) {
			throw new Error("appId is required")
		}
		if (!config.token) {
			throw new Error("token is required")
		}
	}
}
