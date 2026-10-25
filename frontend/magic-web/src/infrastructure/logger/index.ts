import { defaultLogger } from "./runtime"

export type {
	Logger,
	LoggerPort,
	NamespaceLogger,
	StructuredErrorInput,
	LoggerOptions,
	LoggerEnableConfig,
	LogData,
} from "./types"

export const logger = defaultLogger
export const createLogger = logger.createLogger
