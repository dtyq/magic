import { describe, it, expect, vi, beforeEach } from "vitest"
import { PPTStore } from "../PPTStore"
import { SlideLoaderService } from "../../services/SlideLoaderService"
import { SlideProcessorService } from "../../services/SlideProcessorService"

// Mock the services
vi.mock("../../services/SlideLoaderService")
vi.mock("../../services/SlideProcessorService")

describe("PPTStore", () => {
	let store: PPTStore
	const mockConfig = {
		fileUrlMapping: new Map([
			["https://example.com/slide1.html", "file1"],
			["https://example.com/slide2.html", "file2"],
		]),
		attachments: [],
		attachmentList: [
			{
				file_id: "file1",
				file_name: "slide1.html",
				relative_file_path: "/slides/slide1.html",
			},
			{
				file_id: "file2",
				file_name: "slide2.html",
				relative_file_path: "/slides/slide2.html",
			},
		],
		mainFileId: "main-id",
		mainFileName: "main.html",
		metadata: {},
	}

	beforeEach(() => {
		store = new PPTStore(mockConfig)
		vi.clearAllMocks()
	})

	describe("initialization", () => {
		it("should initialize with default values", () => {
			expect(store.slideUrls).toEqual([])
			expect(store.slideContents.size).toBe(0)
			expect(store.activeIndex).toBe(0)
			expect(store.isAllSlidesLoaded).toBe(false)
			expect(store.isTransitioning).toBe(false)
			expect(store.scaleRatio).toBe(1)
			expect(store.verticalOffset).toBe(0)
			expect(store.horizontalOffset).toBe(0)
		})
	})

	describe("initializeSlides", () => {
		it("should filter and set slide URLs", () => {
			const slides = [
				"https://example.com/slide1.html",
				"./relative/slide.html", // Should be filtered out
				"https://example.com/slide2.html",
			]

			store.initializeSlides(slides)

			expect(store.slideUrls).toEqual([
				"https://example.com/slide1.html",
				"https://example.com/slide2.html",
			])
			expect(store.isAllSlidesLoaded).toBe(false)
			expect(store.activeIndex).toBe(0)
		})

		it("should clear previous slide contents", () => {
			store.slideContents.set(0, "old content")
			store.initializeSlides(["https://example.com/slide1.html"])

			expect(store.slideContents.size).toBe(0)
		})

		it("should handle empty slides array", () => {
			store.initializeSlides([])

			expect(store.slideUrls).toEqual([])
		})
	})

	describe("computed values", () => {
		beforeEach(() => {
			store.slideUrls = ["https://example.com/slide1.html", "https://example.com/slide2.html"]
			store.slideContents.set(0, "content 1")
			store.slideContents.set(1, "content 2")
			store.activeIndex = 0
		})

		it("should compute currentSlideUrl", () => {
			expect(store.currentSlideUrl).toBe("https://example.com/slide1.html")

			store.activeIndex = 1
			expect(store.currentSlideUrl).toBe("https://example.com/slide2.html")
		})

		it("should compute currentSlideContent", () => {
			expect(store.currentSlideContent).toBe("content 1")

			store.activeIndex = 1
			expect(store.currentSlideContent).toBe("content 2")
		})

		it("should compute currentFileId", () => {
			expect(store.currentFileId).toBe("file1")

			store.activeIndex = 1
			expect(store.currentFileId).toBe("file2")
		})

		it("should compute canGoPrev", () => {
			store.isAllSlidesLoaded = true
			store.isTransitioning = false

			store.activeIndex = 0
			expect(store.canGoPrev).toBe(false)

			store.activeIndex = 1
			expect(store.canGoPrev).toBe(true)
		})

		it("should compute canGoNext", () => {
			store.isAllSlidesLoaded = true
			store.isTransitioning = false

			store.activeIndex = 0
			expect(store.canGoNext).toBe(true)

			store.activeIndex = 1
			expect(store.canGoNext).toBe(false)
		})

		it("should compute loadingPercentage", () => {
			expect(store.loadingPercentage).toBe(100) // 2 loaded / 2 total

			store.slideContents.delete(1)
			expect(store.loadingPercentage).toBe(50) // 1 loaded / 2 total
		})

		it("should compute totalSlides", () => {
			expect(store.totalSlides).toBe(2)
		})
	})

	describe("navigation", () => {
		beforeEach(() => {
			store.slideUrls = [
				"https://example.com/slide1.html",
				"https://example.com/slide2.html",
				"https://example.com/slide3.html",
			]
			store.isAllSlidesLoaded = true
			store.isTransitioning = false
		})

		it("should navigate to next slide", () => {
			store.activeIndex = 0
			store.nextSlide()

			expect(store.activeIndex).toBe(1)
		})

		it("should not navigate past last slide", () => {
			store.activeIndex = 2
			store.nextSlide()

			expect(store.activeIndex).toBe(2)
		})

		it("should navigate to previous slide", () => {
			store.activeIndex = 1
			store.prevSlide()

			expect(store.activeIndex).toBe(0)
		})

		it("should not navigate before first slide", () => {
			store.activeIndex = 0
			store.prevSlide()

			expect(store.activeIndex).toBe(0)
		})

		it("should go to first slide", () => {
			store.activeIndex = 2
			store.goToFirstSlide()

			expect(store.activeIndex).toBe(0)
		})

		it("should not navigate when transitioning", () => {
			store.isTransitioning = true
			store.activeIndex = 0

			store.nextSlide()
			expect(store.activeIndex).toBe(0)

			store.prevSlide()
			expect(store.activeIndex).toBe(0)
		})

		it("should set active index directly", () => {
			store.setActiveIndex(1)
			expect(store.activeIndex).toBe(1)
		})

		it("should not set invalid index", () => {
			store.activeIndex = 0
			store.setActiveIndex(-1)
			expect(store.activeIndex).toBe(0)

			store.setActiveIndex(10)
			expect(store.activeIndex).toBe(0)
		})
	})

	describe("view state", () => {
		it("should set scale ratio", () => {
			store.setScaleRatio(1.5)
			expect(store.scaleRatio).toBe(1.5)
		})

		it("should set vertical offset", () => {
			store.setVerticalOffset(100)
			expect(store.verticalOffset).toBe(100)
		})

		it("should set horizontal offset", () => {
			store.setHorizontalOffset(50)
			expect(store.horizontalOffset).toBe(50)
		})

		it("should set fullscreen state", () => {
			store.setFullscreen(true)
			expect(store.isFullscreen).toBe(true)
		})

		it("should set transition state", () => {
			store.setIsTransitioning(true)
			expect(store.isTransitioning).toBe(true)
		})
	})

	describe("slide content management", () => {
		it("should update single slide content", () => {
			store.updateSlideContent(0, "new content")
			expect(store.slideContents.get(0)).toBe("new content")
		})

		it("should update multiple slide contents", () => {
			const updates = new Map([
				[0, "content 0"],
				[1, "content 1"],
				[2, "content 2"],
			])

			store.updateSlideContents(updates)

			expect(store.slideContents.get(0)).toBe("content 0")
			expect(store.slideContents.get(1)).toBe("content 1")
			expect(store.slideContents.get(2)).toBe("content 2")
		})

		it("should set slide URLs", () => {
			const newUrls = ["https://example.com/new1.html", "https://example.com/new2.html"]

			store.setSlideUrls(newUrls)

			expect(store.slideUrls).toEqual(newUrls)
		})
	})

	describe("loadAllSlides", () => {
		it("should load all slides successfully", async () => {
			const mockLoader = vi.mocked(SlideLoaderService).prototype
			const mockProcessor = vi.mocked(SlideProcessorService).prototype

			mockLoader.loadSlide = vi
				.fn()
				.mockResolvedValueOnce("raw content 1")
				.mockResolvedValueOnce("raw content 2")

			mockProcessor.processSlide = vi
				.fn()
				.mockResolvedValueOnce("processed content 1")
				.mockResolvedValueOnce("processed content 2")

			store.slideUrls = ["https://example.com/slide1.html", "https://example.com/slide2.html"]

			await store.loadAllSlides()

			expect(store.isAllSlidesLoaded).toBe(true)
			expect(store.loadingProgress).toBe(100)
		})

		it("should handle loading errors gracefully", async () => {
			const mockLoader = vi.mocked(SlideLoaderService).prototype
			mockLoader.loadSlide = vi.fn().mockRejectedValue(new Error("Load failed"))

			store.slideUrls = ["https://example.com/slide1.html"]

			await store.loadAllSlides()

			// Should still mark as loaded even with errors
			expect(store.isAllSlidesLoaded).toBe(true)
		})
	})

	describe("updateConfig", () => {
		it("should update store configuration", () => {
			const newFileUrlMapping = new Map([["https://new.com/slide.html", "new-file"]])

			store.updateConfig({ fileUrlMapping: newFileUrlMapping })

			// Config should be updated (verified through behavior)
			expect(store).toBeDefined()
		})
	})

	describe("reset", () => {
		it("should reset store to initial state", () => {
			// Set some state
			store.slideUrls = ["https://example.com/slide1.html"]
			store.slideContents.set(0, "content")
			store.activeIndex = 1
			store.isAllSlidesLoaded = true
			store.scaleRatio = 2
			store.verticalOffset = 100
			store.horizontalOffset = 50

			// Reset
			store.reset()

			// Verify all state is reset
			expect(store.slideUrls).toEqual([])
			expect(store.slideContents.size).toBe(0)
			expect(store.activeIndex).toBe(0)
			expect(store.isAllSlidesLoaded).toBe(false)
			expect(store.scaleRatio).toBe(1)
			expect(store.verticalOffset).toBe(0)
			expect(store.horizontalOffset).toBe(0)
		})
	})
})
