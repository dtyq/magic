/**
 * @magic-web/logger
 * 统一的日志追踪解决方案
 */

// 核心导出
export { createLogger, getLogger } from "./core/logger"
export { BaseProvider } from "./core/base-provider"

// 类型导出
export type {
	ILogger,
	ILoggerConfig,
	IProvider,
	IProviderConfig,
	IPlugin,
	IUserInfo,
	ICustomEvent,
	IErrorInfo,
	ProviderType,
	LogLevel,
} from "./core/types"

export type { IVolcengineConfig, IAliyunConfig, ProviderConfig } from "./config/types"

// Provider 导出
export { VolcengineProvider } from "./providers/volcengine"
export { AliyunProvider } from "./providers/aliyun"
