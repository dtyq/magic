import { BUSINESS_API_ERROR_CODE } from "@/constants/api"
import type { AuthFailureKind } from "./contracts"

/** Authentication business codes are numeric top-level response codes only. */
const AUTH_INVALID_CODES = new Set<number>([
	BUSINESS_API_ERROR_CODE.ACCOUNT_NO_PERMISSION,
	BUSINESS_API_ERROR_CODE.USER_TOKEN_EXPIRED,
	BUSINESS_API_ERROR_CODE.USER_NOT_EXIST,
])

export function isAuthInvalidCode(value: unknown): value is number {
	return typeof value === "number" && AUTH_INVALID_CODES.has(value)
}

export function getAuthFailureReason(code: unknown): AuthFailureKind | null {
	if (!isAuthInvalidCode(code)) return null

	return code === BUSINESS_API_ERROR_CODE.ACCOUNT_NO_PERMISSION
		? "account-unauthorized"
		: "token-expired"
}

export function getAuthFailureCodeSet(): ReadonlySet<number> {
	return AUTH_INVALID_CODES
}

/**
 * 账号被平台禁用（`3109`）是账号级别的硬性拦截，不是 token 失效。
 *
 * 刻意不加入 `AUTH_INVALID_CODES`：那套码会走「清理会话 + 跳登录」的恢复流程，
 * 而禁用账号登录时本就没有有效会话可恢复，交给登录流程直接报错终止更准确。
 */
export function isAccountDisabledError(error: unknown): boolean {
	if (!error || typeof error !== "object") return false

	return (error as { code?: unknown }).code === BUSINESS_API_ERROR_CODE.ACCOUNT_DISABLED
}
