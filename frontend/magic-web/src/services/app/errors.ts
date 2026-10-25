import { BUSINESS_API_ERROR_CODE } from "@/constants/api"

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

/** Initialization failures that can safely invalidate the current login. */
const AUTHENTICATION_ERROR_CODES: ReadonlySet<number> = new Set([
	BUSINESS_API_ERROR_CODE.ACCOUNT_NO_PERMISSION,
	BUSINESS_API_ERROR_CODE.USER_TOKEN_EXPIRED,
])

const AUTHENTICATION_ERROR_MESSAGES = new Set(["unauthorized", "authentication required"])

function isAuthenticationCode(value: unknown): boolean {
	if (typeof value === "number") return AUTHENTICATION_ERROR_CODES.has(value)
	if (typeof value !== "string" || !/^\d+$/.test(value)) return false
	return AUTHENTICATION_ERROR_CODES.has(Number(value))
}

/**
 * Walk nested request causes and response metadata. Network/DNS/parse errors
 * must not be treated as authentication failures merely because they occurred
 * during app bootstrap.
 */
export function isAuthenticationFailure(error: unknown, seen = new Set<object>()): boolean {
	if (!error) return false

	if (typeof error === "string") {
		return AUTHENTICATION_ERROR_MESSAGES.has(error.trim().toLowerCase())
	}

	if (typeof error !== "object") return false
	if (seen.has(error)) return false
	seen.add(error)

	const record = error as Record<string, unknown>
	if (record.status === 401 || isAuthenticationCode(record.code)) return true

	const response = record.response
	if (response && typeof response === "object" && isAuthenticationFailure(response, seen)) {
		return true
	}

	const data = record.data
	if (data && typeof data === "object" && isAuthenticationFailure(data, seen)) return true

	if (
		typeof record.message === "string" &&
		AUTHENTICATION_ERROR_MESSAGES.has(record.message.trim().toLowerCase())
	) {
		return true
	}

	return isAuthenticationFailure(record.cause, seen)
}

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
