import type { LogContext, LoggerPlugin } from "../types"
import Logger from "@/utils/log/Logger"

export class DeviceMonitorPlugin implements LoggerPlugin {
	/** 插件名称 */
	readonly name = "DeviceMonitor"
	/** 插件版本 */
	readonly version?: "1.0.0"
	/** 插件优先级，数字越小优先级越高 */
	readonly priority?: 90
	/** 插件是否启用 */
	enabled: boolean = true

	/**
	 * 插件初始化
	 */
	init(logger: Logger) {
		logger?.report({
			namespace: "deviceMeta",
			data: {
				env: window?.navigator?.userAgent,
				sha: window?.CONFIG?.MAGIC_APP_SHA,
				version: window?.CONFIG?.MAGIC_APP_VERSION,
				referrer: document.referrer,
			},
		})
	}

	/**
	 * 检查是否应该处理此日志
	 */
	shouldHandle(_context: LogContext) {
		return false
	}

	/**
	 * 处理日志上下文
	 */
	process(context: LogContext): LogContext {
		return context
	}

	/**
	 * 插件销毁
	 */
	destroy?(): void | Promise<void> { }
}

/**
 * 设备信息采集工厂函数
 */
export function createDeviceMonitorPlugin(): DeviceMonitorPlugin {
	return new DeviceMonitorPlugin()
}
