/**
 * 简化的日志上报器接口
 * 只负责单次上报，不处理队列和批量逻辑
 */
interface ILogReporter {
	/**
	 * 上报单条或多条日志数据
	 * @param logData 单条日志数据或日志数组
	 * @returns Promise<ReportResult> 上报结果
	 */
	report(logData: Record<string, any> | Record<string, any>[]): Promise<ReportResult>

	/**
	 * 获取上报器名称
	 */
	getName(): string

	/**
	 * 检查上报器是否可用
	 */
	isAvailable(): boolean

	/**
	 * 销毁上报器，清理资源
	 */
	destroy?(): void
}

/**
 * 简化的日志上报配置接口
 */
interface LogReporterConfig {
	/**
	 * 上报 URL
	 */
	url?: string

	/**
	 * 请求超时时间（毫秒）
	 */
	timeout?: number

	/**
	 * 自定义请求头
	 */
	headers?: Record<string, string>

	/**
	 * 是否启用
	 */
	enabled?: boolean
}

/**
 * 上报结果接口
 */
interface ReportResult {
	success: boolean
	error?: Error
	timestamp: number
	duration?: number
}

export type { ILogReporter, LogReporterConfig, ReportResult }
