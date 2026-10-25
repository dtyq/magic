import type { LoggerPlugin } from "../types"

export function createDevicePlugin(device: { sha?: string; version?: string } = {}): LoggerPlugin {
	return {
		name: "device",
		scope: "page",
		setup({ logger }) {
			logger.report({
				namespace: "deviceMeta",
				data: { env: navigator.userAgent, ...device, referrer: document.referrer },
			})
		},
	}
}
