import { BaseProvider } from "../../core/base-provider"
import type { IAliyunConfig } from "../../config/types"
import { ArmsRum } from "@arms/rum-browser"

/**
 * 阿里云 ARMS Provider 实现
 * 基于 @arms/rum-browser SDK
 */
export class AliyunProvider extends BaseProvider {
	private arms: ArmsRum | null = null

	async init(config: IAliyunConfig): Promise<void> {
		this.validateConfig(config)
		this.config = config

		// 初始化 RUM Browser SDK
		this.arms = new ArmsRum({
			pid: config.pid || String(config.appId),
			endpoint: config.endpoint || "https://arms-retcode.aliyuncs.com",
			environment: config.env || "production",
			version: config.version || "1.0.0",
			enableSPA: config.enableSPA ?? true,
			sendResource: config.sendResource ?? true,
			...config.extra,
		})

		this.isInitialized = true
	}

	start(): void {
		if (!this.isInitialized) {
			throw new Error("Provider not initialized")
		}
		// RUM Browser SDK 初始化后自动启动
		this.isStarted = true
	}

	stop(): void {
		// ARMS RUM SDK 不支持 stop，通过标记控制
		this.isStarted = false
	}

	setConfig(config: Record<string, null | undefined>): void {
		if (!this.arms) return
		// 设置配置信息
		// this.arms.setConfig(config)
	}

	error(error: any): void {
		if (!this.arms) return
		// 上报异常信息
		// this.arms.error(error)
	}

	report(value: any): void {
		if (!this.arms) return
		// 上报自定义事件
		this.arms.sendEvent(value)
	}
}
