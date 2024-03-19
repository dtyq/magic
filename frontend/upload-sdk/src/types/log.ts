import type { ErrorType } from "./error"

/**
 * 日志模块命名空间
 * */
export namespace LogModule {
	export type LogType = "SUCCESS" | "ERROR" | "WARN" | "DEBUG"

	export type CallBack = (log: any) => void

	export type LogEventType = "upload" | "download"

	export type CreateLogConfig = {
		type: LogType
		/** 事件名称 */
		eventName: LogEventType
		/** 事件参数 */
		eventParams?: any
		/** 事件响应 */
		eventResponse?: any
		error?: ErrorType.UploadError
		/** 额外内容 */
		extra?: string
	}

	/**
	 * 日志数据结构
	 */
	export interface LogData {
		/** 状态类型 */
		type: LogType
		/** 事件名称 */
		event_name: LogEventType
		/** 事件参数 */
		event_params: any
		/** 事件响应 */
		event_response: any
		/** 异常类型 */
		exception_type: string
		/** 异常信息 */
		exception_message: string
		/** 触发异常所处的文件  */
		exception_file: string
		/** 触发异常所处的行数 */
		exception_line: string
		/** 触发异常所处的列数 */
		exception_row: string
		/** 额外内容 */
		extra?: string
		/** 记录时间 */
		time: Date
		/** SDK名称及版本号 */
		version: string
	}
}
