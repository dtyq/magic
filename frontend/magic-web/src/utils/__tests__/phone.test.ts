import { describe, it, expect } from "vitest"
import { encryptPhoneWithCountryCode, validatePhone } from "../phone"

describe("encryptPhone", () => {
	it("should return the original phone number if it is invalid", () => {
		expect(encryptPhoneWithCountryCode("123")).toBe("123")
		expect(encryptPhoneWithCountryCode("abcdefghijk")).toBe("abcdefghijk")
	})

	it("should encrypt a valid phone number without country code", () => {
		expect(encryptPhoneWithCountryCode("13800138000")).toBe("+86 138****8000")
	})

	it("should use custom symbol for encryption", () => {
		expect(encryptPhoneWithCountryCode("13800138000", undefined, "#")).toBe("+86 138####8000")
	})
})

describe("validatePhone", () => {
	it("should return true for valid phone numbers", () => {
		expect(validatePhone("13800138000", "+86")).toBe(true)
	})

	it("should return false for invalid phone numbers", () => {
		expect(validatePhone("123", "+86")).toBe(false)
		expect(validatePhone("abcdefghijk", "+86")).toBe(false)
	})
})
