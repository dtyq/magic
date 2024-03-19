import { createLogger, type ILogger, type ILoggerConfig } from "../../../../packages/logger/src"

const APMConfig = JSON.parse(window?.CONFIG?.MAGIC_APM || "{}")
const loggerConfig: ILoggerConfig = {
	provider: {
		type: APMConfig?.strategy,
		appId: APMConfig?.options?.appId,
		token: APMConfig?.options?.token,
	},
}

export const trackLogger: ILogger = createLogger(loggerConfig)
