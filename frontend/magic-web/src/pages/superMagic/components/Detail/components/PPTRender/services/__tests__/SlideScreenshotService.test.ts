import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { SlideScreenshotService } from "../SlideScreenshotService"

// Mock snapdom
vi.mock("@zumer/snapdom", () => ({
	snapdom: vi.fn().mockResolvedValue({
		toBlob: vi.fn().mockResolvedValue(new Blob(["mock-image"], { type: "image/png" })),
	}),
}))

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => "blob:mock-url-" + Math.random())
global.URL.revokeObjectURL = vi.fn()

describe("SlideScreenshotService", () => {
	let service: SlideScreenshotService

	beforeEach(() => {
		service = new SlideScreenshotService()
		vi.clearAllMocks()
	})

	afterEach(() => {
		service.dispose()
	})

	describe("generateScreenshot", () => {
		it("should generate screenshot for HTML content", async () => {
			const url = "https://example.com/slide1.html"
			const content = "<html><body>Test Content</body></html>"

			const thumbnailUrl = await service.generateScreenshot(url, content)

			expect(thumbnailUrl).toMatch(/^blob:mock-url-/)
			expect(global.URL.createObjectURL).toHaveBeenCalled()
		})

		it("should throw error for empty content", async () => {
			await expect(service.generateScreenshot("url", "")).rejects.toThrow(
				"Content is required",
			)
		})

		it("should cache generated screenshots", async () => {
			const url = "https://example.com/slide1.html"
			const content = "<html><body>Test Content</body></html>"

			// First generation
			const url1 = await service.generateScreenshot(url, content)

			// Second call should return cached result
			const url2 = await service.generateScreenshot(url, content)

			expect(url1).toBe(url2)
			expect(service.hasCachedScreenshot(url)).toBe(true)
		})

		it("should regenerate screenshot when content changes", async () => {
			const url = "https://example.com/slide1.html"
			const content1 = "<html><body>Content 1</body></html>"
			const content2 = "<html><body>Content 2</body></html>"

			const url1 = await service.generateScreenshot(url, content1)
			const url2 = await service.generateScreenshot(url, content2)

			// Should generate new screenshot for different content
			expect(url1).not.toBe(url2)
		})

		it("should handle concurrent requests for same URL", async () => {
			const url = "https://example.com/slide1.html"
			const content = "<html><body>Test Content</body></html>"

			// Start multiple concurrent requests
			const promises = [
				service.generateScreenshot(url, content),
				service.generateScreenshot(url, content),
				service.generateScreenshot(url, content),
			]

			const results = await Promise.all(promises)

			// All should return the same URL
			expect(results[0]).toBe(results[1])
			expect(results[1]).toBe(results[2])
		})
	})

	describe("cache management", () => {
		it("should get cached screenshot", async () => {
			const url = "https://example.com/slide1.html"
			const content = "<html><body>Test Content</body></html>"

			const thumbnailUrl = await service.generateScreenshot(url, content)
			const cached = service.getCachedScreenshot(url)

			expect(cached).toBe(thumbnailUrl)
		})

		it("should return null for non-cached URL", () => {
			const cached = service.getCachedScreenshot("non-existent-url")
			expect(cached).toBeNull()
		})

		it("should check if screenshot is cached", async () => {
			const url = "https://example.com/slide1.html"
			const content = "<html><body>Test Content</body></html>"

			expect(service.hasCachedScreenshot(url)).toBe(false)

			await service.generateScreenshot(url, content)

			expect(service.hasCachedScreenshot(url)).toBe(true)
			expect(service.hasCachedScreenshot(url, content)).toBe(true)
		})

		it("should clear cache for specific URL", async () => {
			const url = "https://example.com/slide1.html"
			const content = "<html><body>Test Content</body></html>"

			await service.generateScreenshot(url, content)
			expect(service.hasCachedScreenshot(url)).toBe(true)

			service.clearCache(url)
			expect(service.hasCachedScreenshot(url)).toBe(false)
			expect(global.URL.revokeObjectURL).toHaveBeenCalled()
		})

		it("should clear all cache", async () => {
			const urls = [
				"https://example.com/slide1.html",
				"https://example.com/slide2.html",
				"https://example.com/slide3.html",
			]
			const content = "<html><body>Test Content</body></html>"

			for (const url of urls) {
				await service.generateScreenshot(url, content)
			}

			expect(service.getCacheStats().size).toBe(3)

			service.clearAllCache()

			expect(service.getCacheStats().size).toBe(0)
			expect(global.URL.revokeObjectURL).toHaveBeenCalledTimes(3)
		})

		it("should clear old cache entries", async () => {
			const url1 = "https://example.com/slide1.html"
			const url2 = "https://example.com/slide2.html"
			const content = "<html><body>Test Content</body></html>"

			// Generate first screenshot
			await service.generateScreenshot(url1, content)

			// Mock timestamp to make it old
			const cache = (service as any).cache
			const entry1 = cache.get(url1)
			entry1.timestamp = Date.now() - 400000 // 6.67 minutes ago

			// Generate second screenshot (recent)
			await service.generateScreenshot(url2, content)

			// Clear old cache (older than 5 minutes)
			service.clearOldCache(300000)

			expect(service.hasCachedScreenshot(url1)).toBe(false)
			expect(service.hasCachedScreenshot(url2)).toBe(true)
		})

		it("should get cache statistics", async () => {
			const urls = ["https://example.com/slide1.html", "https://example.com/slide2.html"]
			const content = "<html><body>Test Content</body></html>"

			for (const url of urls) {
				await service.generateScreenshot(url, content)
			}

			const stats = service.getCacheStats()

			expect(stats.size).toBe(2)
			expect(stats.urls).toEqual(urls)
		})
	})

	describe("dispose", () => {
		it("should cleanup all resources on dispose", async () => {
			const url = "https://example.com/slide1.html"
			const content = "<html><body>Test Content</body></html>"

			await service.generateScreenshot(url, content)

			service.dispose()

			expect(service.getCacheStats().size).toBe(0)
			expect(global.URL.revokeObjectURL).toHaveBeenCalled()
		})
	})

	describe("content hashing", () => {
		it("should detect content changes", async () => {
			const url = "https://example.com/slide1.html"
			const content1 = "<html><body>Content 1</body></html>"
			const content2 = "<html><body>Content 2</body></html>"

			await service.generateScreenshot(url, content1)

			expect(service.hasCachedScreenshot(url, content1)).toBe(true)
			expect(service.hasCachedScreenshot(url, content2)).toBe(false)
		})

		it("should recognize identical content", async () => {
			const url = "https://example.com/slide1.html"
			const content = "<html><body>Test Content</body></html>"

			await service.generateScreenshot(url, content)

			// Same content should be recognized
			expect(service.hasCachedScreenshot(url, content)).toBe(true)
		})
	})
})
