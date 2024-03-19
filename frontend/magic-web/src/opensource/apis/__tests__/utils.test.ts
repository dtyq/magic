import { describe, expect, it } from "vitest"
import { UrlUtils } from "../utils"

describe("UrlUtils", () => {
	describe("hasHost", () => {
		it("should return true for URLs with host", () => {
			expect(UrlUtils.hasHost("https://example.com/path")).toBe(true)
			expect(UrlUtils.hasHost("http://localhost:3000")).toBe(true)
			expect(UrlUtils.hasHost("//example.com/path")).toBe(true)
		})

		it("should return false for URLs without host", () => {
			expect(UrlUtils.hasHost("/path/to/resource")).toBe(false)
			expect(UrlUtils.hasHost("path/to/resource")).toBe(false)
			expect(UrlUtils.hasHost("./relative/path")).toBe(false)
		})
	})

	describe("join", () => {
		it("should correctly join base URL with paths", () => {
			expect(UrlUtils.join("https://example.com", "api")).toBe("https://example.com/api")
			expect(UrlUtils.join("https://example.com/", "/api/")).toBe("https://example.com/api/")
			expect(UrlUtils.join("https://example.com/api", "user")).toBe(
				"https://example.com/api/user",
			)
			expect(UrlUtils.join("https://example.com/api/", "/user/")).toBe(
				"https://example.com/api/user/",
			)
		})

		it("should handle absolute URLs in paths", () => {
			expect(UrlUtils.join("https://example.com", "https://other.com/path")).toBe(
				"https://other.com/path",
			)
			expect(UrlUtils.join("https://example.com", "//other.com/path")).toBe(
				"//other.com/path",
			)
		})

		it("should handle invalid URLs gracefully", () => {
			expect(UrlUtils.join("invalid-url", "path")).toBe("invalid-url/path")
			expect(UrlUtils.join("base", "./relative/path")).toBe("base/relative/path")
		})
	})

	describe("parse", () => {
		it("should correctly parse valid URLs", () => {
			const result = UrlUtils.parse("https://example.com/path?query=1#hash")
			expect(result).toEqual({
				protocol: "https:",
				host: "example.com",
				pathname: "/path",
				search: "?query=1",
				hash: "#hash",
				isValid: true,
			})
		})

		it("should handle invalid URLs gracefully", () => {
			const result = UrlUtils.parse("/path/to/resource")
			expect(result).toEqual({
				protocol: "",
				host: "",
				pathname: "/path/to/resource",
				search: "",
				hash: "",
				isValid: false,
			})
		})
	})
})
