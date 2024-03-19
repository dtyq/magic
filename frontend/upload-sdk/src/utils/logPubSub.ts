import type { LogModule } from "../types/log"

/**
 *  日志模块，用于发布日志，收集日志
 */
class LogPubSub {
	private callbacks: LogModule.CallBack[] = []

	// 订阅日志
	subscribe(cb: LogModule.CallBack) {
		this.callbacks.push(cb)
	}

	// 发布日志
	report(createLogConfig: LogModule.CreateLogConfig) {
		const log = LogPubSub.createLog(createLogConfig)

		if (this.callbacks.length > 0) {
			this.callbacks.forEach((cb) => cb(log))
		}
	}

	/**
	 * 创建日志
	 * @param {LogModule.createLogConfig} createLogConfig
	 * @return {LogModule.LogData} LogData
	 */
	static createLog(createLogConfig: LogModule.CreateLogConfig): LogModule.LogData {
		const { type, eventName, eventParams, eventResponse, error, extra } = createLogConfig
		let output = {
			type,
			event_name: eventName,
			event_params: eventParams || "",
			event_response: eventResponse || "",
			exception_type: "",
			exception_message: "",
			exception_file: "",
			exception_line: "",
			exception_row: "",
			extra: extra || "",
			time: new Date(),
			version: "Upload-SDK.js VERSION",
		}
		if (type === "ERROR" && error) {
			const parseError = /at\s+(.*)\s+\((.*):(\d*):(\d*)\)/i.exec(error.stack || "")

			output = {
				...output,
				exception_type: error.name,
				exception_message: error.message,
				exception_file: parseError ? parseError[2] : "",
				exception_line: parseError ? parseError[3] : "",
				exception_row: parseError ? parseError[4] : "",
			}
		}

		return output
	}
}

export default new LogPubSub()
