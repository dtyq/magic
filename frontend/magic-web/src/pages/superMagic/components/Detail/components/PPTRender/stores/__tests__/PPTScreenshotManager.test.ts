import { describe, expect, it, vi } from "vitest"
import { PPTScreenshotManager } from "../PPTScreenshotManager"
import type { SlideItem } from "../../PPTSidebar/types"

function createLogger() {
	return {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		logOperationStart: vi.fn(),
		logOperationSuccess: vi.fn(),
		logOperationError: vi.fn(),
	}
}

describe("PPTScreenshotManager", () => {
	it("writes a generated thumbnail back to the same slide after indices shift", async () => {
		let resolveScreenshot: (thumbnailUrl: string) => void = () => undefined
		const screenshotService = {
			getCachedScreenshot: vi.fn(() => undefined),
			hasCachedScreenshot: vi.fn(() => false),
			generateScreenshot: vi.fn(
				() =>
					new Promise<string>((resolve) => {
						resolveScreenshot = resolve
					}),
			),
			clearCache: vi.fn(),
			getCacheStats: vi.fn(() => ({})),
		}
		const manager = new PPTScreenshotManager(
			createLogger() as never,
			screenshotService as never,
		)
		const slides: SlideItem[] = [
			{
				id: "slide-before",
				path: "08.html",
				url: "https://example.com/08",
				index: 0,
				content: "<div>before</div>",
				loadingState: "loaded",
			},
			{
				id: "slide-old",
				path: "09.html",
				url: "https://example.com/09",
				index: 1,
				content: "<div>old</div>",
				loadingState: "loaded",
			},
		]
		const oldSlide = slides[1]

		const generationPromise = manager.generateSlideScreenshot(
			oldSlide,
			1,
			slides,
			undefined,
			() => slides.findIndex((slide) => slide.path === "09.html"),
		)

		slides.splice(1, 0, {
			id: "slide-new",
			path: "new.html",
			url: "https://example.com/new",
			index: 1,
			content: "<div>new</div>",
			loadingState: "loaded",
		})
		slides[2].index = 2

		resolveScreenshot("blob:old-thumbnail")
		await generationPromise

		expect(slides[1].path).toBe("new.html")
		expect(slides[1].thumbnailUrl).toBeUndefined()
		expect(slides[2].path).toBe("09.html")
		expect(slides[2].thumbnailUrl).toBe("blob:old-thumbnail")
		expect(slides[2].thumbnailLoading).toBe(false)
	})
})
