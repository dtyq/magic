import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { generateUUID, getETag, getLatestAppVersion, isBreakingVersion } from "../utils"

describe("version-check utils", () => {
	describe("generateUUID", () => {
		it("should generate a valid UUID string", () => {
			const uuid = generateUUID()
			// UUID格式：8-4-4-4-12
			expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
		})

		it("should generate unique UUIDs", () => {
			const uuids = new Set()
			for (let i = 0; i < 1000; i += 1) {
				uuids.add(generateUUID())
			}
			// 确保生成的1000个UUID都是唯一的
			expect(uuids.size).toBe(1000)
		})
	})

	describe("getETag", () => {
		const originalFetch = global.fetch
		const mockFetch = vi.fn()

		beforeEach(() => {
			// @ts-ignore
			global.fetch = mockFetch
			// @ts-ignore
			global.self = { location: { origin: "https://example.com" } }
		})

		afterEach(() => {
			global.fetch = originalFetch
			vi.clearAllMocks()
		})

		it("should return etag when available", async () => {
			const mockEtag = '"123456789"'
			mockFetch.mockResolvedValueOnce({
				headers: {
					get: (header: string) => (header === "etag" ? mockEtag : null),
				},
			})

			const etag = await getETag()
			expect(etag).toBe(mockEtag)
			expect(mockFetch).toHaveBeenCalledWith("https://example.com", {
				method: "HEAD",
				cache: "no-cache",
			})
		})

		it("should return last-modified when etag is not available", async () => {
			const mockLastModified = "Fri, 01 Jan 2024 00:00:00 GMT"
			mockFetch.mockResolvedValueOnce({
				headers: {
					get: (header: string) => (header === "last-modified" ? mockLastModified : null),
				},
			})

			const etag = await getETag()
			expect(etag).toBe(mockLastModified)
		})

		it("should throw error when fetch fails", async () => {
			const errorMessage = "Network error"
			mockFetch.mockRejectedValueOnce(new Error(errorMessage))

			await expect(getETag()).rejects.toThrow(`Fetch failed: ${errorMessage}`)
		})
	})

	describe("getLatestAppVersion", () => {
		const originalFetch = global.fetch
		const mockFetch = vi.fn()
		const mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {})

		beforeEach(() => {
			// @ts-ignore
			global.fetch = mockFetch
			// @ts-ignore
			global.self = { location: { origin: "https://example.com" } }
		})

		afterEach(() => {
			global.fetch = originalFetch
			vi.clearAllMocks()
			mockConsoleError.mockReset()
		})

		it("should return app version from config", async () => {
			const mockVersion = "1.2.3"
			mockFetch.mockResolvedValueOnce({
				text: () =>
					Promise.resolve(`window.CONFIG = {"MAGIC_APP_VERSION": "${mockVersion}"}`),
			})

			const version = await getLatestAppVersion()
			expect(version).toBe(mockVersion)
			expect(mockFetch).toHaveBeenCalledWith("https://example.com/config.js", {
				method: "GET",
				cache: "no-cache",
			})
		})

		it("should return undefined when fetch fails", async () => {
			const error = new Error("Network error")
			mockFetch.mockRejectedValueOnce(error)

			const version = await getLatestAppVersion()
			expect(version).toBeUndefined()
			expect(mockConsoleError).toHaveBeenCalledWith(error)
		})

		it("should return undefined when config parsing fails", async () => {
			mockFetch.mockResolvedValueOnce({
				text: () => Promise.resolve("invalid json"),
			})

			const version = await getLatestAppVersion()
			expect(version).toBeUndefined()
			expect(mockConsoleError).toHaveBeenCalled()
		})
	})

	describe("isBreakingVersion", () => {
		it("should return true when major version changes", () => {
			expect(isBreakingVersion("1.2", "2.0")).toBe(true)
			expect(isBreakingVersion("1.2.1", "2.0.0")).toBe(true)
			expect(isBreakingVersion("0.2.1", "1.0.0")).toBe(true)
		})

		it("should return true when minor version changes", () => {
			expect(isBreakingVersion("1.2", "1.3")).toBe(true)
			expect(isBreakingVersion("1.2.1", "1.3.0")).toBe(true)
			expect(isBreakingVersion("0.1.0", "0.2.0")).toBe(true)
		})

		it("should return false when only patch version changes", () => {
			expect(isBreakingVersion("1.2", "1.2.1")).toBe(false)
			expect(isBreakingVersion("1.2.1", "1.2.2")).toBe(false)
			expect(isBreakingVersion("0.1.0", "0.1.1")).toBe(false)
		})

		it("should handle versions with missing patch numbers", () => {
			expect(isBreakingVersion("1.2", "1.2")).toBe(false)
			expect(isBreakingVersion("1.2", "1.2.0")).toBe(false)
			expect(isBreakingVersion("1.2.0", "1.2")).toBe(false)
		})

		it("should handle invalid version formats", () => {
			expect(() => isBreakingVersion("1.2.", "1.3")).toThrow()
			expect(() => isBreakingVersion("1.a.2", "1.3")).toThrow()
			expect(() => isBreakingVersion("", "1.3")).toThrow()
			expect(() => isBreakingVersion("1.2.3.4", "1.3")).toThrow()
		})

		it("should return false when comparing from higher to lower versions", () => {
			expect(isBreakingVersion("2.0", "1.0")).toBe(false)
			expect(isBreakingVersion("1.2", "1.1")).toBe(false)
			expect(isBreakingVersion("1.2.3", "1.2.2")).toBe(false)
		})

		it("should handle same versions", () => {
			expect(isBreakingVersion("1.0", "1.0")).toBe(false)
			expect(isBreakingVersion("1.0.0", "1.0.0")).toBe(false)
		})

		it("should handle invalid version formats", () => {
			expect(() => isBreakingVersion("1", "1.0")).toThrow()
			expect(() => isBreakingVersion("1.0", "1.a")).toThrow()
			expect(() => isBreakingVersion("1.0.0.0", "1.0")).toThrow()
		})
	})
})
