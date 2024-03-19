import { BasePlugin } from "./base-plugin"

/**
 * 性能监控插件
 * 自动收集页面性能指标
 */
export class PerformancePlugin extends BasePlugin {
	name = "performance"
	version = "1.0.0"

	private observer: PerformanceObserver | null = null

	protected onInstall(): void {
		if (typeof window === "undefined" || !window.PerformanceObserver) {
			console.warn("[PerformancePlugin] PerformanceObserver not supported")
			return
		}

		this.observer = new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) {
				this.logger?.track({
					name: "performance",
					properties: {
						entryType: entry.entryType,
						name: entry.name,
						duration: entry.duration,
						startTime: entry.startTime,
					},
				})
			}
		})

		this.observer.observe({ entryTypes: ["navigation", "resource", "paint"] })
	}

	protected onUninstall(): void {
		this.observer?.disconnect()
		this.observer = null
	}
}
