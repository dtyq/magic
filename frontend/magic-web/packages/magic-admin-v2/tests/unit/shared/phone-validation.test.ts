import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isValidEmail } from "../../../src/utils/contact-validation"
import {
	formatInternationalPhoneNumber,
	isValidInternationalPhoneNumber,
	isValidPhoneNumber,
} from "../../../src/utils/phone"

describe("shared phone validation", () => {
	it("matches the tenant validation for a valid mainland China number", () => {
		assert.equal(isValidPhoneNumber("13800138000", "+86"), true)
		assert.equal(isValidPhoneNumber("13800138000", "86"), true)
	})

	it("rejects invalid numbers and country codes", () => {
		assert.equal(isValidPhoneNumber("1380013800", "+86"), false)
		assert.equal(isValidPhoneNumber("13800138000", "+12345"), false)
		assert.equal(isValidPhoneNumber("13800138000x", "+86"), false)
	})
})

describe("international phone helpers", () => {
	it("formats a local number with its selected country code", () => {
		assert.equal(formatInternationalPhoneNumber(" 13800138000 ", "86"), "+8613800138000")
	})

	it("validates complete international numbers for batch invitations", () => {
		assert.equal(isValidInternationalPhoneNumber("+8613800138000"), true)
		assert.equal(isValidInternationalPhoneNumber("+14155552671"), true)
		assert.equal(isValidInternationalPhoneNumber("13800138000"), false)
		assert.equal(isValidInternationalPhoneNumber("+861380013800"), false)
		assert.equal(isValidInternationalPhoneNumber("+8613800138000x"), false)
	})
})

describe("shared email validation", () => {
	it("accepts a normal email and rejects incomplete addresses", () => {
		assert.equal(isValidEmail(" user@example.com "), true)
		assert.equal(isValidEmail("user@example"), false)
		assert.equal(isValidEmail("user @example.com"), false)
		assert.equal(isValidEmail(""), false)
	})
})
