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
	it("delegates cache validation to the async screenshot generation path", async () => {
		const screenshotService = {
			getCachedScreenshot: vi.fn(() => "blob:cached"),
			hasCachedScreenshot: vi.fn(() => true),
			generateScreenshot: vi.fn(async () => "blob:cached"),
			releaseScreenshot: vi.fn(),
			clearCache: vi.fn(),
			getCacheStats: vi.fn(() => ({})),
		}
		const manager = new PPTScreenshotManager(
			createLogger() as never,
			screenshotService as never,
		)
		const slide: SlideItem = {
			id: "slide-1",
			path: "01.html",
			url: "https://example.com/01",
			index: 0,
			content: "<div>cached</div>",
			loadingState: "loaded",
		}

		await manager.generateSlideScreenshot(slide, 0, [slide])

		expect(screenshotService.getCachedScreenshot).not.toHaveBeenCalled()
		expect(screenshotService.hasCachedScreenshot).not.toHaveBeenCalled()
		expect(screenshotService.generateScreenshot).toHaveBeenCalledWith(
			"https://example.com/01",
			"<div>cached</div>",
			"required",
			undefined,
			"use",
		)
		expect(slide.thumbnailUrl).toBe("blob:cached")
		expect(slide.thumbnailLoading).toBe(false)
	})

	it("treats cancelled preview generation as a normal loading stop", async () => {
		const abortError = Object.assign(new Error("cancelled"), { name: "AbortError" })
		const screenshotService = {
			generateScreenshot: vi.fn(async () => Promise.reject(abortError)),
			releaseScreenshot: vi.fn(),
			clearCache: vi.fn(),
			getCacheStats: vi.fn(() => ({})),
		}
		const manager = new PPTScreenshotManager(
			createLogger() as never,
			screenshotService as never,
		)
		const slide: SlideItem = {
			id: "preview-slide",
			path: "preview.html",
			url: "https://example.com/preview",
			index: 0,
			content: "<div>preview</div>",
			loadingState: "loaded",
		}

		await manager.generateSlideScreenshot(slide, 0, [slide], undefined, undefined, "preview")

		expect(slide.thumbnailLoading).toBe(false)
		expect(slide.thumbnailError).toBeUndefined()
		expect(slide.thumbnailUrl).toBeUndefined()
	})

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
			() => slides.find((slide) => slide.path === "09.html"),
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

	it("writes the result to the replacement slide object after sorting", async () => {
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
		const originalSlides: SlideItem[] = [
			{
				id: "slide-1",
				path: "01.html",
				index: 0,
				content: "<div>one</div>",
				loadingState: "loaded",
			},
			{
				id: "slide-2",
				path: "02.html",
				index: 1,
				content: "<div>two</div>",
				loadingState: "loaded",
			},
		]
		let currentSlides = originalSlides

		const generationPromise = manager.generateSlideScreenshot(
			originalSlides[1],
			1,
			originalSlides,
			undefined,
			() => currentSlides.find((slide) => slide.id === "slide-2"),
		)

		currentSlides = [
			{ ...originalSlides[1], index: 0 },
			{ ...originalSlides[0], index: 1 },
		]
		resolveScreenshot("blob:slide-2")
		await generationPromise

		expect(currentSlides[0].thumbnailUrl).toBe("blob:slide-2")
		expect(currentSlides[0].thumbnailLoading).toBe(false)
		expect(currentSlides[1].thumbnailUrl).toBeUndefined()
	})

	it("keeps the newest thumbnail when an older generation finishes last", async () => {
		const resolvers = new Map<string, (thumbnailUrl: string) => void>()
		const screenshotService = {
			getCachedScreenshot: vi.fn(() => undefined),
			hasCachedScreenshot: vi.fn(() => false),
			generateScreenshot: vi.fn(
				(_cacheKey: string, content: string) =>
					new Promise<string>((resolve) => {
						resolvers.set(content, resolve)
					}),
			),
			releaseScreenshot: vi.fn(),
			clearCache: vi.fn(),
			getCacheStats: vi.fn(() => ({})),
		}
		const manager = new PPTScreenshotManager(
			createLogger() as never,
			screenshotService as never,
		)
		const slide: SlideItem = {
			id: "slide-1",
			path: "01.html",
			url: "https://example.com/01",
			index: 0,
			content: "<div>initial</div>",
			loadingState: "loaded",
		}
		const slides = [slide]
		const oldContent = "<div>old</div>"
		const newContent = "<div>new</div>"

		const oldGeneration = manager.generateSlideScreenshot(slide, 0, slides, oldContent)
		const newGeneration = manager.generateSlideScreenshot(slide, 0, slides, newContent)

		resolvers.get(newContent)?.("blob:new")
		await newGeneration
		expect(slide.thumbnailUrl).toBe("blob:new")

		resolvers.get(oldContent)?.("blob:old")
		await oldGeneration

		expect(slide.thumbnailUrl).toBe("blob:new")
		expect(slide.thumbnailLoading).toBe(false)
		expect(slide.thumbnailError).toBeUndefined()
		expect(screenshotService.releaseScreenshot).toHaveBeenCalledWith("blob:old")
	})

	it("keeps the newest thumbnail when a replacement slide receives a new id", async () => {
		const resolvers = new Map<string, (thumbnailUrl: string) => void>()
		const screenshotService = {
			generateScreenshot: vi.fn(
				(_cacheKey: string, content: string) =>
					new Promise<string>((resolve) => {
						resolvers.set(content, resolve)
					}),
			),
			releaseScreenshot: vi.fn(),
			clearCache: vi.fn(),
			getCacheStats: vi.fn(() => ({})),
		}
		const manager = new PPTScreenshotManager(
			createLogger() as never,
			screenshotService as never,
		)
		const oldContent = "<div>old</div>"
		const newContent = "<div>new</div>"
		const originalSlide: SlideItem = {
			id: "transient-old-id",
			path: "01.html",
			url: "https://example.com/01",
			index: 0,
			content: oldContent,
			loadingState: "loaded",
		}
		const slides = [originalSlide]
		const resolveCurrentSlide = () => slides.find((slide) => slide.path === "01.html")

		const oldGeneration = manager.generateSlideScreenshot(
			originalSlide,
			0,
			slides,
			oldContent,
			resolveCurrentSlide,
		)
		const replacementSlide: SlideItem = {
			...originalSlide,
			id: "transient-new-id",
			content: newContent,
		}
		slides[0] = replacementSlide
		const newGeneration = manager.generateSlideScreenshot(
			replacementSlide,
			0,
			slides,
			newContent,
			resolveCurrentSlide,
		)

		resolvers.get(newContent)?.("blob:new-id")
		await newGeneration
		resolvers.get(oldContent)?.("blob:old-id")
		await oldGeneration

		expect(replacementSlide.thumbnailUrl).toBe("blob:new-id")
		expect(replacementSlide.thumbnailLoading).toBe(false)
		expect(screenshotService.releaseScreenshot).toHaveBeenCalledWith("blob:old-id")
	})

	it("ignores an older generation error after the newest thumbnail succeeds", async () => {
		const pending = new Map<
			string,
			{ resolve: (thumbnailUrl: string) => void; reject: (error: Error) => void }
		>()
		const screenshotService = {
			getCachedScreenshot: vi.fn(() => undefined),
			hasCachedScreenshot: vi.fn(() => false),
			generateScreenshot: vi.fn(
				(_cacheKey: string, content: string) =>
					new Promise<string>((resolve, reject) => {
						pending.set(content, { resolve, reject })
					}),
			),
			releaseScreenshot: vi.fn(),
			clearCache: vi.fn(),
			getCacheStats: vi.fn(() => ({})),
		}
		const logger = createLogger()
		const manager = new PPTScreenshotManager(logger as never, screenshotService as never)
		const slide: SlideItem = {
			id: "slide-1",
			path: "01.html",
			url: "https://example.com/01",
			index: 0,
			content: "<div>initial</div>",
			loadingState: "loaded",
		}
		const slides = [slide]
		const oldContent = "<div>old</div>"
		const newContent = "<div>new</div>"

		const oldGeneration = manager.generateSlideScreenshot(slide, 0, slides, oldContent)
		const newGeneration = manager.generateSlideScreenshot(slide, 0, slides, newContent)

		pending.get(newContent)?.resolve("blob:new")
		await newGeneration
		pending.get(oldContent)?.reject(new Error("old generation failed"))
		await oldGeneration

		expect(slide.thumbnailUrl).toBe("blob:new")
		expect(slide.thumbnailLoading).toBe(false)
		expect(slide.thumbnailError).toBeUndefined()
		expect(logger.logOperationError).not.toHaveBeenCalled()
	})

	it("invalidates an unfinished generation when its screenshot is cleared", async () => {
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
			releaseScreenshot: vi.fn(),
			clearCache: vi.fn(),
			getCacheStats: vi.fn(() => ({})),
		}
		const manager = new PPTScreenshotManager(
			createLogger() as never,
			screenshotService as never,
		)
		const slide: SlideItem = {
			id: "slide-1",
			path: "01.html",
			url: "https://example.com/01",
			index: 0,
			content: "<div>slide</div>",
			loadingState: "loaded",
		}
		const slides = [slide]

		const generation = manager.generateSlideScreenshot(slide, 0, slides)
		expect(slide.thumbnailLoading).toBe(true)

		manager.clearSlideScreenshot(slide, 0, slides)
		resolveScreenshot("blob:cleared")
		await generation

		expect(slide.thumbnailUrl).toBeUndefined()
		expect(slide.thumbnailLoading).toBe(false)
		expect(slide.thumbnailError).toBeUndefined()
		expect(screenshotService.releaseScreenshot).toHaveBeenCalledWith("blob:cleared")
	})

	it("invalidates late results on reset and remains reusable for the next deck", async () => {
		const pending: Array<{ resolve: (thumbnailUrl: string) => void }> = []
		const screenshotService = {
			generateScreenshot: vi.fn(
				() =>
					new Promise<string>((resolve) => {
						pending.push({ resolve })
					}),
			),
			releaseScreenshot: vi.fn(),
			clearCache: vi.fn(),
			getCacheStats: vi.fn(() => ({ size: 0, urls: [] })),
		}
		const manager = new PPTScreenshotManager(
			createLogger() as never,
			screenshotService as never,
		)
		const oldSlide: SlideItem = {
			id: "old-slide",
			path: "01.html",
			url: "https://example.com/old-01",
			index: 0,
			content: "<div>old</div>",
			loadingState: "loaded",
		}

		const oldGeneration = manager.generateSlideScreenshot(oldSlide, 0, [oldSlide])
		expect(oldSlide.thumbnailLoading).toBe(true)

		manager.reset([oldSlide])
		pending[0].resolve("blob:late-old-deck")
		await oldGeneration

		expect(oldSlide.thumbnailUrl).toBeUndefined()
		expect(oldSlide.thumbnailLoading).toBe(false)
		expect(oldSlide.thumbnailError).toBeUndefined()
		expect(screenshotService.releaseScreenshot).toHaveBeenCalledWith("blob:late-old-deck")

		const newSlide: SlideItem = {
			...oldSlide,
			id: "new-slide",
			url: "https://example.com/new-01",
			content: "<div>new</div>",
		}
		const newGeneration = manager.generateSlideScreenshot(newSlide, 0, [newSlide])
		pending[1].resolve("blob:new-deck")
		await newGeneration

		expect(newSlide.thumbnailUrl).toBe("blob:new-deck")
		expect(newSlide.thumbnailLoading).toBe(false)
	})

	it("ignores late errors after dispose and permanently blocks new screenshot work", async () => {
		let rejectScreenshot: (error: Error) => void = () => undefined
		const screenshotService = {
			generateScreenshot: vi.fn(
				() =>
					new Promise<string>((_resolve, reject) => {
						rejectScreenshot = reject
					}),
			),
			releaseScreenshot: vi.fn(),
			clearCache: vi.fn(),
			getCacheStats: vi.fn(() => ({ size: 0, urls: [] })),
		}
		const logger = createLogger()
		const manager = new PPTScreenshotManager(logger as never, screenshotService as never)
		const slide: SlideItem = {
			id: "slide-1",
			path: "01.html",
			url: "https://example.com/01",
			index: 0,
			content: "<div>slide</div>",
			loadingState: "loaded",
		}

		const generation = manager.generateSlideScreenshot(slide, 0, [slide])
		manager.dispose([slide])
		manager.dispose([slide])
		rejectScreenshot(new Error("late failure"))
		await generation

		expect(slide.thumbnailLoading).toBe(false)
		expect(slide.thumbnailError).toBeUndefined()
		expect(logger.logOperationError).not.toHaveBeenCalled()

		await manager.generateSlideScreenshot(slide, 0, [slide])
		await manager.generateAllScreenshots([slide])
		expect(screenshotService.generateScreenshot).toHaveBeenCalledTimes(1)
	})
})
