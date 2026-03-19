export const AppInitErrorCode = {
	UserInitFailed: "USER_INIT_FAILED",
	ConfigLoadFailed: "CONFIG_LOAD_FAILED",
	PlatformSettingsRequestFailed: "PLATFORM_SETTINGS_REQUEST_FAILED",
	GlobalConfigInitFailed: "GLOBAL_CONFIG_INIT_FAILED",
	ConfigInitFailed: "CONFIG_INIT_FAILED",
	ConfigInitTimeout: "CONFIG_INIT_TIMEOUT",
	AccountInitFailed: "ACCOUNT_INIT_FAILED",
	Unknown: "UNKNOWN",
} as const

export type AppInitErrorCode = (typeof AppInitErrorCode)[keyof typeof AppInitErrorCode]

export interface AppInitializationErrorOptions {
	code: AppInitErrorCode
	cause?: unknown
	message?: string
}

export class AppInitializationError extends Error {
	readonly code: AppInitErrorCode

	constructor({ code, cause, message }: AppInitializationErrorOptions) {
		super(message ?? code.toString(), { cause })
		this.code = code
	}
}
