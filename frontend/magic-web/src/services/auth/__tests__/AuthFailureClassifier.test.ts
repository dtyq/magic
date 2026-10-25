import { describe, expect, it } from "vitest"
import { BUSINESS_API_ERROR_CODE } from "@/constants/api"
import {
	getAuthFailureReason,
	isAccountDisabledError,
	isAuthInvalidCode,
} from "../AuthFailureClassifier"

describe("AuthFailureClassifier", () => {
	it("accepts only supported numeric top-level authentication codes", () => {
		expect(isAuthInvalidCode(BUSINESS_API_ERROR_CODE.ACCOUNT_NO_PERMISSION)).toBe(true)
		expect(isAuthInvalidCode(BUSINESS_API_ERROR_CODE.USER_TOKEN_EXPIRED)).toBe(true)
		expect(isAuthInvalidCode(BUSINESS_API_ERROR_CODE.USER_NOT_EXIST)).toBe(true)
		expect(isAuthInvalidCode(String(BUSINESS_API_ERROR_CODE.USER_TOKEN_EXPIRED))).toBe(false)
		expect(isAuthInvalidCode({ code: BUSINESS_API_ERROR_CODE.USER_TOKEN_EXPIRED })).toBe(false)
	})

	it("maps supported codes to the shared auth failure vocabulary", () => {
		expect(getAuthFailureReason(BUSINESS_API_ERROR_CODE.ACCOUNT_NO_PERMISSION)).toBe(
			"account-unauthorized",
		)
		expect(getAuthFailureReason(BUSINESS_API_ERROR_CODE.USER_TOKEN_EXPIRED)).toBe(
			"token-expired",
		)
		expect(getAuthFailureReason(BUSINESS_API_ERROR_CODE.USER_NOT_EXIST)).toBe("token-expired")
		expect(getAuthFailureReason(200)).toBeNull()
	})

	it("classifies a disabled account as a hard login block, not an expired session", () => {
		expect(isAccountDisabledError({ code: BUSINESS_API_ERROR_CODE.ACCOUNT_DISABLED })).toBe(
			true,
		)
		expect(isAccountDisabledError({ code: BUSINESS_API_ERROR_CODE.USER_TOKEN_EXPIRED })).toBe(
			false,
		)
		expect(isAccountDisabledError(new Error("该账号已被禁用，无法登录。"))).toBe(false)
		expect(isAccountDisabledError(null)).toBe(false)
		expect(isAccountDisabledError("3109")).toBe(false)

		// 禁用账号不能进入会话失效流程，否则会触发清理会话 + 跳登录的恢复链路。
		expect(isAuthInvalidCode(BUSINESS_API_ERROR_CODE.ACCOUNT_DISABLED)).toBe(false)
	})
})
