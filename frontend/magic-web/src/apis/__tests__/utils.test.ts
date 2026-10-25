import { describe, expect, it } from "vitest"
import { ResponseParseError, UrlUtils } from "../utils"

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
				origin: "https://example.com",
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
				origin: "",
				host: "",
				pathname: "/path/to/resource",
				search: "",
				hash: "",
				isValid: false,
			})
		})
	})

	describe("responseParse", () => {
		it("returns empty data for bodyless HTTP responses", async () => {
			const response = new Response(null, { status: 204 })

			await expect(UrlUtils.responseParse(response)).resolves.toEqual({
				data: undefined,
				type: "empty",
			})
		})

		it("parses an empty JSON body without throwing", async () => {
			const response = new Response("", {
				status: 200,
				headers: { "Content-Type": "application/json; charset=utf-8" },
			})

			await expect(UrlUtils.responseParse(response)).resolves.toEqual({
				data: undefined,
				type: "empty",
			})
		})

		it("throws a contextual error for malformed JSON", async () => {
			const response = new Response("<html>bad gateway</html>", {
				status: 502,
				headers: { "Content-Type": "application/json" },
			})

			const result = UrlUtils.responseParse(response)

			await expect(result).rejects.toBeInstanceOf(ResponseParseError)
			await expect(result).rejects.toMatchObject({
				name: "ResponseParseError",
				contentType: "application/json",
				rawText: "<html>bad gateway</html>",
			})
		})

		it("preserves large integers when requested", async () => {
			const response = new Response('{"id":9007199254740993}', {
				status: 200,
				headers: { "Content-Type": "application/json" },
			})

			await expect(
				UrlUtils.responseParse(response, { parseJsonLargeIntAsString: true }),
			).resolves.toEqual({
				data: { id: "9007199254740993" },
				type: "json",
			})
		})
	})
})
