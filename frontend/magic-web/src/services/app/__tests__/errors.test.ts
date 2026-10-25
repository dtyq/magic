import { describe, expect, it } from "vitest"
import { BUSINESS_API_ERROR_CODE } from "@/constants/api"
import { AppInitErrorCode, AppInitializationError, isAuthenticationFailure } from "../errors"

describe("isAuthenticationFailure", () => {
	it("recognizes an HTTP 401 response", () => {
		expect(isAuthenticationFailure({ response: { status: 401 } })).toBe(true)
	})

	it("recognizes nested authentication business codes", () => {
		const error = new AppInitializationError({
			code: AppInitErrorCode.AccountInitFailed,
			cause: { data: { code: BUSINESS_API_ERROR_CODE.USER_TOKEN_EXPIRED } },
		})

		expect(isAuthenticationFailure(error)).toBe(true)
	})

	it("does not classify network failures as authentication failures", () => {
		const error = new AppInitializationError({
			code: AppInitErrorCode.AccountInitFailed,
			cause: new TypeError("Failed to fetch"),
		})

		expect(isAuthenticationFailure(error)).toBe(false)
	})

	it("does not classify response parsing failures as authentication failures", () => {
		const error = new AppInitializationError({
			code: AppInitErrorCode.AccountInitFailed,
			cause: {
				name: "ResponseParseError",
				response: { status: 502 },
			},
		})

		expect(isAuthenticationFailure(error)).toBe(false)
	})
})
