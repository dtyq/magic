import { describe, it, expect, vi, beforeEach } from "vitest"
import { SlideLoaderService } from "../SlideLoaderService"
import * as api from "@/opensource/pages/superMagic/utils/api"

// Mock the API module
vi.mock("@/opensource/pages/superMagic/utils/api", () => ({
	downloadFileContent: vi.fn(),
}))

describe("SlideLoaderService", () => {
	let service: SlideLoaderService

	beforeEach(() => {
		service = new SlideLoaderService()
		vi.clearAllMocks()
	})

	describe("loadSlide", () => {
		it("should load slide content successfully", async () => {
			const mockContent = "<html><body>Test Slide</body></html>"
			vi.mocked(api.downloadFileContent).mockResolvedValue(mockContent)

			const result = await service.loadSlide("https://example.com/slide1.html")

			expect(result).toBe(mockContent)
			expect(api.downloadFileContent).toHaveBeenCalledWith("https://example.com/slide1.html")
		})

		it("should return empty string when content is not a string", async () => {
			vi.mocked(api.downloadFileContent).mockResolvedValue({} as any)

			const result = await service.loadSlide("https://example.com/slide1.html")

			expect(result).toBe("")
		})

		it("should throw error when URL is empty", async () => {
			await expect(service.loadSlide("")).rejects.toThrow("Slide URL is required")
		})

		it("should propagate download errors", async () => {
			const error = new Error("Network error")
			vi.mocked(api.downloadFileContent).mockRejectedValue(error)

			await expect(service.loadSlide("https://example.com/slide1.html")).rejects.toThrow(
				"Network error",
			)
		})
	})

	describe("loadSlides", () => {
		it("should load multiple slides in parallel", async () => {
			const mockContents = [
				"<html><body>Slide 1</body></html>",
				"<html><body>Slide 2</body></html>",
				"<html><body>Slide 3</body></html>",
			]

			vi.mocked(api.downloadFileContent).mockImplementation((url) => {
				const index = parseInt(url.toString().match(/\d+/)?.[0] || "0") - 1
				return Promise.resolve(mockContents[index])
			})

			const urls = [
				"https://example.com/slide1.html",
				"https://example.com/slide2.html",
				"https://example.com/slide3.html",
			]

			const result = await service.loadSlides(urls)

			expect(result.size).toBe(3)
			expect(result.get(0)).toBe(mockContents[0])
			expect(result.get(1)).toBe(mockContents[1])
			expect(result.get(2)).toBe(mockContents[2])
		})

		it("should handle partial failures gracefully", async () => {
			vi.mocked(api.downloadFileContent)
				.mockResolvedValueOnce("<html><body>Slide 1</body></html>")
				.mockRejectedValueOnce(new Error("Failed to load"))
				.mockResolvedValueOnce("<html><body>Slide 3</body></html>")

			const urls = [
				"https://example.com/slide1.html",
				"https://example.com/slide2.html",
				"https://example.com/slide3.html",
			]

			const result = await service.loadSlides(urls)

			expect(result.size).toBe(3)
			expect(result.get(0)).toBe("<html><body>Slide 1</body></html>")
			expect(result.get(1)).toBe("") // Failed slide returns empty string
			expect(result.get(2)).toBe("<html><body>Slide 3</body></html>")
		})

		it("should return empty map for empty URL array", async () => {
			const result = await service.loadSlides([])

			expect(result.size).toBe(0)
		})
	})
})
