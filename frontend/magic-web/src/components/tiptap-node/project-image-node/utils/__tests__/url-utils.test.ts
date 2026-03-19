import { describe, it, expect } from "vitest"
import { isDirectUrl, isAbsoluteUrl, normalizeImagePath, calculateBackoffDelay } from "../url-utils"

describe("url-utils", () => {
	describe("isDirectUrl", () => {
		it("should return true for http URLs", () => {
			expect(isDirectUrl("http://example.com/image.png")).toBe(true)
		})

		it("should return true for https URLs", () => {
			expect(isDirectUrl("https://example.com/image.png")).toBe(true)
		})

		it("should return false for data URLs", () => {
			expect(isDirectUrl("data:image/png;base64,iVBORw0KGgo=")).toBe(false)
		})

		it("should return false for relative paths", () => {
			expect(isDirectUrl("./images/test.png")).toBe(false)
			expect(isDirectUrl("../images/test.png")).toBe(false)
			expect(isDirectUrl("images/test.png")).toBe(false)
		})

		it("should return false for invalid URLs", () => {
			expect(isDirectUrl("not a url")).toBe(false)
		})
	})

	describe("isAbsoluteUrl", () => {
		it("should return true for data URLs", () => {
			expect(isAbsoluteUrl("data:image/png;base64,iVBORw0KGgo=")).toBe(true)
		})

		it("should return true for http URLs", () => {
			expect(isAbsoluteUrl("http://example.com/image.png")).toBe(true)
		})

		it("should return true for https URLs", () => {
			expect(isAbsoluteUrl("https://example.com/image.png")).toBe(true)
		})

		it("should return false for relative paths", () => {
			expect(isAbsoluteUrl("./images/test.png")).toBe(false)
			expect(isAbsoluteUrl("../images/test.png")).toBe(false)
			expect(isAbsoluteUrl("images/test.png")).toBe(false)
		})
	})

	describe("normalizeImagePath", () => {
		it("should not modify data URLs", () => {
			const dataUrl =
				"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
			expect(normalizeImagePath(dataUrl)).toBe(dataUrl)
		})

		it("should not modify http URLs", () => {
			const httpUrl = "http://example.com/image.png"
			expect(normalizeImagePath(httpUrl)).toBe(httpUrl)
		})

		it("should not modify https URLs", () => {
			const httpsUrl = "https://example.com/image.png"
			expect(normalizeImagePath(httpsUrl)).toBe(httpsUrl)
		})

		it("should add ./ prefix to relative paths", () => {
			expect(normalizeImagePath("images/test.png")).toBe("./images/test.png")
			expect(normalizeImagePath("test.png")).toBe("./test.png")
		})

		it("should not modify paths that already have ./ prefix", () => {
			expect(normalizeImagePath("./images/test.png")).toBe("./images/test.png")
		})

		it("should not modify paths that already have ../ prefix", () => {
			expect(normalizeImagePath("../images/test.png")).toBe("../images/test.png")
		})

		it("should handle edge cases", () => {
			expect(normalizeImagePath("./test.png")).toBe("./test.png")
			expect(normalizeImagePath("../test.png")).toBe("../test.png")
			expect(normalizeImagePath("../../test.png")).toBe("../../test.png")
		})
	})

	describe("calculateBackoffDelay", () => {
		it("should calculate exponential backoff correctly", () => {
			expect(calculateBackoffDelay(0, 100, 1000)).toBe(100)
			expect(calculateBackoffDelay(1, 100, 1000)).toBe(200)
			expect(calculateBackoffDelay(2, 100, 1000)).toBe(400)
			expect(calculateBackoffDelay(3, 100, 1000)).toBe(800)
		})

		it("should respect max delay", () => {
			expect(calculateBackoffDelay(10, 100, 1000)).toBe(1000)
			expect(calculateBackoffDelay(20, 100, 1000)).toBe(1000)
		})

		it("should handle zero initial delay", () => {
			expect(calculateBackoffDelay(0, 0, 1000)).toBe(0)
			expect(calculateBackoffDelay(5, 0, 1000)).toBe(0)
		})
	})
})
